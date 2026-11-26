import { Inject, Injectable } from "@nestjs/common";
import Redis from "ioredis";
import { REDIS } from "../redis.module";
import { WalletService } from "../wallet/wallet.service";
import { EntitlementsService } from "./entitlements.service";
import { FREE_MESSAGES_PER_DAY as D_FREE, MESSAGE_COST_COINS as D_COST } from "./pricing";
import { SettingsService } from "../owner/settings.service";

@Injectable()
export class MessagesBillingService {
  constructor(@Inject(REDIS) private redis: Redis, private wallet: WalletService, private ent: EntitlementsService, private cfg: SettingsService) {}
  private key(userId: string) { return `msgq:${userId}:${new Date().toISOString().slice(0, 10)}`; }

  async quota(userId: string) {
    const FREE = await this.cfg.get("FREE_MESSAGES_PER_DAY", D_FREE), COST = await this.cfg.get("MESSAGE_COST_COINS", D_COST);
    const unlimited = await this.ent.isUnlimited(userId, "messages");
    const used = Number((await this.redis.get(this.key(userId))) || 0);
    return { unlimited, freeRemaining: Math.max(0, FREE - used), costPerMessage: COST };
  }

  /** The realtime server (P2) calls this before sending a message. Without enough coins it throws 400 and the message cannot be sent. */
  async charge(senderId: string, messageId: string) {
    const FREE = await this.cfg.get("FREE_MESSAGES_PER_DAY", D_FREE), COST = await this.cfg.get("MESSAGE_COST_COINS", D_COST);
    if (await this.ent.isUnlimited(senderId, "messages")) return { charged: 0, free: true };
    // If the same messageId arrives a second time, it is neither counted nor charged again
    const first = await this.redis.set(`msgd:${messageId}`, "1", "EX", 86400, "NX");
    if (!first) return { charged: 0, duplicate: true };
    const key = this.key(senderId);
    const n = await this.redis.incr(key);
    if (n === 1) await this.redis.expire(key, 172800);
    if (n <= FREE) return { charged: 0, free: true, freeRemaining: FREE - n };
    try {
      await this.wallet.spend(senderId, COST, "message_fee", `msg:${messageId}`);
      return { charged: COST, free: false };
    } catch (e) {
      await this.redis.decr(key); await this.redis.del(`msgd:${messageId}`); // roll back the count on failure
      throw e;
    }
  }
}
