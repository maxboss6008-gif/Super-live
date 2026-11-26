import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../entities";
import { WalletService, COINS_PER_USD } from "../wallet/wallet.service";
import { KycService } from "../kyc/kyc.service";
import { WithdrawalRequest } from "./withdrawal.entities";

const MIN_WITHDRAW_COINS = 1000; // sample minimum; will change once a final value is given

@Injectable()
export class WithdrawalService {
  constructor(@InjectRepository(WithdrawalRequest) private repo: Repository<WithdrawalRequest>,
              @InjectRepository(User) private users: Repository<User>,
              private wallet: WalletService, private kyc: KycService) {}

  async request(userId: string, coins: number, method: "bank_transfer" | "gateway", destination: Record<string, any>) {
    if (!Number.isInteger(coins) || coins < MIN_WITHDRAW_COINS) throw new BadRequestException(`ন্যূনতম ${MIN_WITHDRAW_COINS} কয়েন উইথড্র করা যায়`); // minimum withdrawal amount
    if (!(await this.kyc.isApproved(userId))) throw new ForbiddenException("উইথড্রয়ালের আগে KYC অনুমোদন প্রয়োজন"); // spec 1.2 — KYC approval is required before withdrawal
    const u = await this.users.findOne({ where: { id: userId } });
    if (u?.withdrawalBlockedUntil && u.withdrawalBlockedUntil > new Date())
      throw new ForbiddenException("নতুন ডিভাইসে লগইনের পর ৪৮ ঘণ্টা উইথড্রয়াল বন্ধ থাকে"); // spec 1.6 — withdrawals are blocked for 48 hours after a new-device login
    const ref = `withdraw:${userId}:${Date.now()}`;
    await this.wallet.holdForWithdrawal(userId, coins, ref); // immediately held from "earned" to prevent double-spending
    return this.repo.save(this.repo.create({ userId, ref, coins, amountUsd: (coins / COINS_PER_USD).toFixed(2), method, destination, status: "pending" }));
  }

  listPending() { return this.repo.find({ where: { status: "pending" }, order: { createdAt: "ASC" } }); }
  listByStatus(status?: string) {
    const valid = ["pending", "approved", "rejected", "paid"];
    return this.repo.find({ where: status && valid.includes(status) ? { status: status as any } : {}, order: { createdAt: "DESC" } });
  }
  listMine(userId: string) { return this.repo.find({ where: { userId }, order: { createdAt: "DESC" } }); }

  async approve(id: string, adminId: string) {
    const w = await this.repo.findOne({ where: { id } }); if (!w) throw new NotFoundException();
    if (w.status !== "pending") throw new BadRequestException("এই অনুরোধ ইতিমধ্যে প্রসেস হয়েছে"); // this request has already been processed
    // Note: the real bank transfer/payout API call is not wired up here yet — a PayoutProvider
    // interface (in the same pattern as payment-gateway.interface.ts) should be added once the
    // real bank/gateway is chosen. For now this only changes status; sending the money for real
    // must be done manually until that is in place.
    await this.repo.update(id, { status: "approved", processedBy: adminId, processedAt: new Date() });
    return this.repo.findOne({ where: { id } });
  }

  async reject(id: string, adminId: string, note: string) {
    const w = await this.repo.findOne({ where: { id } }); if (!w) throw new NotFoundException();
    if (w.status !== "pending") throw new BadRequestException("এই অনুরোধ ইতিমধ্যে প্রসেস হয়েছে"); // this request has already been processed
    await this.wallet.releaseWithdrawalHold(w.userId, Number(w.coins), w.ref);
    await this.repo.update(id, { status: "rejected", processedBy: adminId, note, processedAt: new Date() });
    return this.repo.findOne({ where: { id } });
  }
}
