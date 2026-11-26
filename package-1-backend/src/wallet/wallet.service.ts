import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, Repository, Between } from "typeorm";
import { LedgerEntry, Wallet } from "./wallet.entity";

export const COINS_PER_USD = 100;   // 100 coins = 1 USD
export const GIFT_FEE_PERCENT = 20; // platform fee taken on every gift
const MAX_STATEMENT_DAYS = 366;

@Injectable()
export class WalletService {
  constructor(@InjectRepository(Wallet) private wallets: Repository<Wallet>,
              @InjectRepository(LedgerEntry) private ledger: Repository<LedgerEntry>,
              private ds: DataSource) {}

  // Calling this inside a transaction locks the row (pessimistic_write)
  async ensure(userId: string, m: EntityManager = this.ds.manager) {
    const lock = m.queryRunner ? { mode: "pessimistic_write" as const } : undefined;
    let w = await m.findOne(Wallet, { where: { userId }, lock });
    if (!w) {
      await m.createQueryBuilder().insert().into(Wallet).values({ userId }).orIgnore().execute();
      w = await m.findOneOrFail(Wallet, { where: { userId }, lock });
    }
    return w;
  }

  private async entry(m: EntityManager, w: Wallet, bucket: LedgerEntry["bucket"], delta: number, kind: string, ref: string, other?: string) {
    (w as any)[bucket] += delta;
    if ((w as any)[bucket] < 0) throw new BadRequestException("ব্যালেন্স যথেষ্ট নয়"); // insufficient balance
    await m.save(Wallet, w);
    await m.insert(LedgerEntry, { walletId: w.id, bucket, delta, kind, ref, counterpartyUserId: other });
  }

  private async seen(m: EntityManager, walletId: string, ref: string) {
    return !!(await m.findOne(LedgerEntry, { where: { walletId, ref } }));
  }

  /** Credit coins on a successful payment; a duplicate call with the same ref does nothing. */
  async creditPurchase(userId: string, coins: number, ref: string) {
    return this.ds.transaction(async (m) => {
      const w = await this.ensure(userId, m);
      if (await this.seen(m, w.id, ref)) return w;
      await this.entry(m, w, "coins", coins, "purchase", ref);
      return w;
    });
  }

  /** Spend coins (e.g. a message fee) — deducts from the sender's balance, pays no one. */
  async spend(userId: string, coins: number, kind: string, ref: string) {
    if (!Number.isInteger(coins) || coins <= 0) throw new BadRequestException("কয়েনের পরিমাণ সঠিক নয়");
    return this.ds.transaction(async (m) => {
      const w = await this.ensure(userId, m);
      if (await this.seen(m, w.id, ref)) return { duplicate: true };
      await this.entry(m, w, "coins", -coins, kind, ref);
      return { duplicate: false };
    });
  }

  /**
   * Move coins from sender to receiver (gift, call) — 80% goes to the receiver's
   * earnings, 20% is the platform fee. If promo=true or the sender is unlimited, the
   * sender's balance is not deducted, but the receiver's earning becomes non-withdrawable.
   */
  async transfer(senderId: string, receiverId: string, coins: number, ref: string, kind: string, promo = false) {
    if (!Number.isInteger(coins) || coins <= 0) throw new BadRequestException("কয়েনের পরিমাণ সঠিক নয়");
    if (senderId === receiverId) throw new BadRequestException("নিজেকে পাঠানো যাবে না");
    return this.ds.transaction(async (m) => {
      // Always lock in the same order to avoid deadlocks
      const [aId, bId] = [senderId, receiverId].sort();
      const a = await this.ensure(aId, m); const b = await this.ensure(bId, m);
      const s = a.userId === senderId ? a : b; const r = a.userId === senderId ? b : a;
      if (await this.seen(m, s.id, ref)) return { duplicate: true };
      const share = Math.floor((coins * (100 - GIFT_FEE_PERCENT)) / 100);
      if (s.unlimited || promo) {
        await this.entry(m, s, "coins", 0, `${kind}_out_promo`, ref, receiverId);
        await this.entry(m, r, "promoEarned", share, `${kind}_in`, ref, senderId);
      } else {
        await this.entry(m, s, "coins", -coins, `${kind}_out`, ref, receiverId);
        await this.entry(m, r, "earned", share, `${kind}_in`, ref, senderId);
      }
      return { duplicate: false, coins, creatorShare: share, platformFee: coins - share };
    });
  }

  async gift(senderId: string, receiverId: string, coins: number, key: string) {
    if (!key) throw new BadRequestException("idempotency key দরকার");
    return this.transfer(senderId, receiverId, coins, `gift:${key}`, "gift");
  }

  /** On a withdrawal request, the amount is held (deducted) from "earned" immediately,
   *  so the same coins cannot be withdrawn twice. Approve/reject logic lives in the
   *  withdrawals module. */
  async holdForWithdrawal(userId: string, coins: number, ref: string) {
    return this.ds.transaction(async (m) => {
      const w = await this.ensure(userId, m);
      if (await this.seen(m, w.id, ref)) return { duplicate: true };
      await this.entry(m, w, "earned", -coins, "withdrawal_hold", ref);
      return { duplicate: false };
    });
  }
  async releaseWithdrawalHold(userId: string, coins: number, ref: string) {
    return this.ds.transaction(async (m) => {
      const w = await this.ensure(userId, m);
      const releaseRef = `release:${ref}`;
      if (await this.seen(m, w.id, releaseRef)) return { duplicate: true };
      await this.entry(m, w, "earned", coins, "withdrawal_release", releaseRef);
      return { duplicate: false };
    });
  }

  async setUnlimited(targetUserId: string, enabled: boolean, adminId: string) {
    return this.ds.transaction(async (m) => {
      const w = await this.ensure(targetUserId, m);
      w.unlimited = enabled; await m.save(Wallet, w);
      await m.insert(LedgerEntry, { walletId: w.id, bucket: "coins", delta: 0, kind: "admin", ref: `unlimited:${enabled}:${Date.now()}`, counterpartyUserId: adminId }); // audit trail
      return w;
    });
  }

  async summary(userId: string) {
    const w = await this.ensure(userId);
    return { coins: w.coins, earned: w.earned, earnedUsd: w.earned / COINS_PER_USD, promoEarned: w.promoEarned, unlimited: w.unlimited };
  }

  /** Own statement, maximum 1 year */
  async statement(userId: string, from: Date, to: Date) {
    if (isNaN(+from) || isNaN(+to) || from > to) throw new BadRequestException("তারিখ সঠিক নয়");
    if ((+to - +from) / 86400000 > MAX_STATEMENT_DAYS) throw new ForbiddenException("সর্বোচ্চ ১ বছরের স্টেটমেন্ট নেওয়া যায়");
    const w = await this.ensure(userId);
    return this.ledger.find({ where: { walletId: w.id, createdAt: Between(from, to) }, order: { createdAt: "DESC" }, take: 1000 });
  }
}
