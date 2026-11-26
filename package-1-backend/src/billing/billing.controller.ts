import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, Roles } from "../auth/auth.guard";
import { EntitlementsService } from "./entitlements.service";
import { MessagesBillingService } from "./messages.service";
import { CallsService } from "./calls.service";
import { Feature } from "./pricing";

@Controller()
@UseGuards(AuthGuard)
export class BillingController {
  constructor(private msgs: MessagesBillingService, private calls: CallsService, private ent: EntitlementsService) {}

  @Get("messages/quota") quota(@Req() req: any) { return this.msgs.quota(req.user.sub); }

  // For the realtime server (role = service)
  @Post("billing/messages/charge") @Roles("service")
  charge(@Body() b: { senderId: string; messageId: string }) { return this.msgs.charge(b.senderId, b.messageId); }

  @Put("calls/rate") @Roles("creator")
  rate(@Req() req: any, @Body() b: { coinsPerMinute: number }) { return this.calls.setRate(req.user.sub, b.coinsPerMinute); }

  @Post("calls/start") start(@Req() req: any, @Body() b: { hostId: string }) { return this.calls.start(req.user.sub, b.hostId); }
  @Post("calls/:id/end") end(@Req() req: any, @Param("id") id: string) { return this.calls.end(id, req.user.sub); }
  @Post("calls/:id/tick") @Roles("service") tick(@Param("id") id: string) { return this.calls.tick(id); }

  // Super admin: grant or revoke unlimited messages or calls
  @Post("admin/entitlements/:userId") @Roles("super_admin")
  setUnlimited(@Req() req: any, @Param("userId") id: string, @Body() b: { feature: Feature; unlimited: boolean }) {
    return this.ent.set(id, b.feature, !!b.unlimited, req.user.sub);
  }
}
