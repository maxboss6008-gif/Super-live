import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../entities";
import { WalletService } from "../wallet/wallet.service";
import { EntitlementsService } from "./entitlements.service";
import { Call, CallRate } from "./billing.entities";
import { CALL_RATE_DEFAULT, CALL_RATE_MAX as D_MAX, CALL_RATE_MIN as D_MIN } from "./pricing";
import { SettingsService } from "../owner/settings.service";

@Injectable()
export class CallsService {
  constructor(@InjectRepository(Call) private calls: Repository<Call>, @InjectRepository(CallRate) private rates: Repository<CallRate>,
              @InjectRepository(User) private users: Repository<User>, private wallet: WalletService, private ent: EntitlementsService, private cfg: SettingsService) {}

  async setRate(hostId: string, coinsPerMinute: number) {
    const MIN = await this.cfg.get("CALL_RATE_MIN", D_MIN), MAX = await this.cfg.get("CALL_RATE_MAX", D_MAX);
    if (!Number.isInteger(coinsPerMinute) || coinsPerMinute < MIN || coinsPerMinute > MAX)
      throw new BadRequestException(`রেট ${MIN}–${MAX} কয়েন/মিনিটের মধ্যে হতে হবে`); // rate must be between MIN and MAX coins/minute
    return this.rates.save({ hostId, coinsPerMinute });
  }

  // Every minute is charged in advance. The reference call:<id>:m<n> ensures the same minute is never charged twice.
  private async chargeMinute(call: Call, n: number) {
    const unlimited = await this.ent.isUnlimited(call.callerId, "calls");
    await this.wallet.transfer(call.callerId, call.hostId, call.rate, `call:${call.id}:m${n}`, "call", unlimited);
    await this.calls.update({ id: call.id, minutesBilled: n - 1 }, { minutesBilled: n });
  }

  async start(callerId: string, hostId: string) {
    if (callerId === hostId) throw new BadRequestException("নিজেকে কল করা যাবে না"); // cannot call yourself
    const host = await this.users.findOne({ where: { id: hostId } });
    if (!host || host.role !== "creator") throw new NotFoundException("হোস্ট পাওয়া যায়নি"); // host not found
    const busy = await this.calls.findOne({ where: [
      { callerId, status: "active" }, { hostId: callerId, status: "active" }, { callerId: hostId, status: "active" }, { hostId, status: "active" }] });
    if (busy) throw new ConflictException("কল চলছে, একজন একসময়ে একটি কলেই থাকতে পারেন"); // a call is in progress — only one call at a time per person
    const rate = (await this.rates.findOne({ where: { hostId } }))?.coinsPerMinute ?? CALL_RATE_DEFAULT;
    const call = await this.calls.save(this.calls.create({ callerId, hostId, rate }));
    try { await this.chargeMinute(call, 1); }
    catch (e) { await this.calls.update(call.id, { status: "ended", endedAt: new Date(), endReason: "insufficient_coins" }); throw e; }
    return { callId: call.id, ratePerMinute: rate };
  }

  /** The realtime server calls this every 60 seconds. If coins run out, it ends the call and returns ended:true. */
  async tick(callId: string) {
    const call = await this.calls.findOne({ where: { id: callId } });
    if (!call) throw new NotFoundException();
    if (call.status !== "active") return { ended: true };
    try { await this.chargeMinute(call, call.minutesBilled + 1); return { ended: false, minutes: call.minutesBilled + 1 }; }
    catch (e) {
      if (!(e instanceof BadRequestException)) throw e;
      await this.end(callId, null, "insufficient_coins"); return { ended: true, reason: "insufficient_coins" };
    }
  }

  async end(callId: string, userId: string | null, reason = "hangup") {
    const call = await this.calls.findOne({ where: { id: callId } });
    if (!call) throw new NotFoundException();
    if (userId && userId !== call.callerId && userId !== call.hostId) throw new ForbiddenException();
    if (call.status === "active") await this.calls.update(callId, { status: "ended", endedAt: new Date(), endReason: reason });
    return { ended: true, minutesBilled: call.minutesBilled };
  }
}
