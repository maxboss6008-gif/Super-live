import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { LedgerEntry, Wallet } from "../wallet/wallet.entity";
import { LevelOverride, LevelRule } from "./owner.entities";

@Injectable()
export class LevelService {
  constructor(@InjectRepository(LevelRule) private rules: Repository<LevelRule>, @InjectRepository(LevelOverride) private overrides: Repository<LevelOverride>,
              @InjectRepository(Wallet) private wallets: Repository<Wallet>, @InjectRepository(LedgerEntry) private ledger: Repository<LedgerEntry>) {}

  async levelOf(userId: string) {
    const o = await this.overrides.findOne({ where: { userId } });
    if (o) return { level: o.level, source: "id_override" };
    const w = await this.wallets.findOne({ where: { userId } });
    const r = w ? await this.ledger.createQueryBuilder("l").select("COALESCE(SUM(-l.delta),0)", "t").where("l.walletId = :id AND l.kind = 'gift_out'", { id: w.id }).getRawOne() : { t: 0 };
    const total = Number(r.t);
    const rule = (await this.rules.find({ order: { minGiftedCoins: "DESC" } })).find((x) => x.minGiftedCoins <= total);
    return { level: rule?.level ?? 0, name: rule?.name, source: "gifting", totalGifted: total };
  }
  setRules(rules: LevelRule[]) { return this.rules.save(rules); }
  async setOverride(userId: string, level: number | null, by: string) {
    if (level === null) { await this.overrides.delete({ userId }); return { userId, level: null }; }
    return this.overrides.save({ userId, level, setBy: by });
  }
}
