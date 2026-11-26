import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { ModerationAccess, ModerationReport } from "./moderation.entities";
import { notifyRealtime } from "../realtimeHook";

@Injectable()
export class ModerationService {
  constructor(@InjectRepository(ModerationReport) private reports: Repository<ModerationReport>,
              @InjectRepository(ModerationAccess) private access: Repository<ModerationAccess>) {}

  // Step 1: anyone can file a report — this is the only valid basis for every review that follows
  file(reporterId: string, b: { targetType: ModerationReport["targetType"]; targetId: string; reason: string }) {
    if (!b.reason?.trim()) throw new BadRequestException("কারণ লিখতে হবে"); // a reason must be given
    return this.reports.save(this.reports.create({ reporterId, ...b }));
  }

  listOpen() { return this.reports.find({ where: { status: "open" }, order: { createdAt: "ASC" } }); }

  // Step 2: a moderator may enter only if an open report exists; identity is always disclosed and logged
  async enter(moderatorId: string, reportId: string, visibleToParticipants = true) {
    const r = await this.reports.findOne({ where: { id: reportId } });
    if (!r) throw new NotFoundException("রিপোর্ট পাওয়া যায়নি");
    if (r.status === "resolved" || r.status === "dismissed") throw new ForbiddenException("এই রিপোর্ট ইতিমধ্যে নিষ্পত্তি হয়েছে, নতুন রিপোর্ট দিন");
    if (r.status === "open") await this.reports.update(reportId, { status: "reviewing" });
    const entry = await this.access.save(this.access.create({
      moderatorId, reportId, targetType: r.targetType, targetId: r.targetId, visibleToParticipants,
    }));
    if (r.targetType === "room")
      await notifyRealtime("/hooks/moderation-entry", { roomId: r.targetId, moderatorId, visibleToParticipants });
    return { accessId: entry.id, targetType: r.targetType, targetId: r.targetId, announceInRoom: visibleToParticipants };
  }

  async exit(moderatorId: string, accessId: string) {
    const a = await this.access.findOne({ where: { id: accessId } });
    if (!a || a.moderatorId !== moderatorId) throw new NotFoundException();
    await this.access.update(accessId, { exitedAt: new Date() });
    return { exited: true };
  }

  async resolve(moderatorId: string, reportId: string, status: "resolved" | "dismissed", note: string) {
    const r = await this.reports.findOne({ where: { id: reportId } });
    if (!r) throw new NotFoundException();
    await this.reports.update(reportId, { status, resolvedBy: moderatorId, resolutionNote: note, resolvedAt: new Date() });
    await this.access.update({ reportId, exitedAt: IsNull() }, { exitedAt: new Date() }); // close it if still open
    return { reportId, status };
  }

  // Audit trail: an immutable history of who viewed a given target and when (as legal evidence)
  auditFor(targetType: string, targetId: string) {
    return this.access.find({ where: { targetType: targetType as any, targetId }, order: { enteredAt: "DESC" } });
  }
}
