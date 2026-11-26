import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, Roles } from "../auth/auth.guard";
import { ModerationService } from "./moderation.service";

@Controller("moderation")
@UseGuards(AuthGuard)
export class ModerationController {
  constructor(private mod: ModerationService) {}

  // Any logged-in user may file a report
  @Post("reports")
  report(@Req() req: any, @Body() b: { targetType: "message" | "room" | "call" | "user"; targetId: string; reason: string }) {
    return this.mod.file(req.user.sub, b);
  }

  @Get("reports") @Roles("admin", "super_admin", "owner") open() { return this.mod.listOpen(); }

  // visibleToParticipants=false is only for sensitive moments of an investigation — it is still in the audit log, never secret
  @Post("reports/:id/enter") @Roles("admin", "super_admin", "owner")
  enter(@Req() req: any, @Param("id") id: string, @Body() b: { visibleToParticipants?: boolean }) {
    return this.mod.enter(req.user.sub, id, b.visibleToParticipants !== false);
  }

  @Post("access/:accessId/exit") @Roles("admin", "super_admin", "owner")
  exit(@Req() req: any, @Param("accessId") id: string) { return this.mod.exit(req.user.sub, id); }

  @Post("reports/:id/resolve") @Roles("admin", "super_admin", "owner")
  resolve(@Req() req: any, @Param("id") id: string, @Body() b: { status: "resolved" | "dismissed"; note: string }) {
    return this.mod.resolve(req.user.sub, id, b.status, b.note);
  }

  @Get("audit") @Roles("owner", "super_admin")
  audit(@Query("targetType") t: string, @Query("targetId") id: string) { return this.mod.auditFor(t, id); }
}
