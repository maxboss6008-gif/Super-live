import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SystemState } from "./owner.entities";
import { notifyRealtime } from "../realtimeHook";

export const CARD_CONTROL = "CARD_CONTROL";
/** The server-billing card is actually enabled/disabled via a bank/Al Rajhi/cloud API; that integration goes here. */
export interface CardControl { setEnabled(enabled: boolean): Promise<void>; }
@Injectable() export class NoopCardControl implements CardControl { async setEnabled() {} }

const MAX_SHUTDOWN_MS = 24 * 3600 * 1000;

@Injectable()
export class SystemService {
  private cache: { s: SystemState; at: number } | null = null;
  constructor(@InjectRepository(SystemState) private repo: Repository<SystemState>, @Inject(CARD_CONTROL) private card: CardControl) {}

  async state() {
    if (this.cache && Date.now() - this.cache.at < 3000) return this.cache.s;
    let s = (await this.repo.findOne({ where: { id: 1 } })) || (await this.repo.save(this.repo.create({ id: 1 })));
    if (!s.serverEnabled && s.resumeBy && s.resumeBy < new Date()) { // auto-resume once 24 hours have passed
      s.serverEnabled = true; s.killedAt = null; s.resumeBy = null; s.changedBy = "auto-resume-24h"; s = await this.repo.save(s);
    }
    this.cache = { s, at: Date.now() }; return s;
  }
  private async save(s: SystemState) { this.cache = null; return this.repo.save(s); }

  async kill(by: string) { const s = await this.state(); s.serverEnabled = false; s.killedAt = new Date(); s.resumeBy = new Date(Date.now() + MAX_SHUTDOWN_MS); s.changedBy = by; const saved = await this.save(s); await notifyRealtime("/hooks/server-kill", { by }); return saved; }
  async resume(by: string) { const s = await this.state(); s.serverEnabled = true; s.killedAt = null; s.resumeBy = null; s.changedBy = by; return this.save(s); }
  async setCard(enabled: boolean, by: string) { await this.card.setEnabled(enabled); const s = await this.state(); s.cardEnabled = enabled; s.changedBy = by; return this.save(s); }
}
