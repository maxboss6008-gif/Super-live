import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, Roles } from "../auth/auth.guard";
import { KycService } from "./kyc.service";

@Controller("kyc") @UseGuards(AuthGuard)
export class KycController {
  constructor(private kyc: KycService) {}
  @Post("submit") submit(@Req() r: any, @Body() b: { documents: { type: string; url: string }[] }) { return this.kyc.submit(r.user.sub, b.documents); }
  @Get("me") me(@Req() r: any) { return this.kyc.statusOf(r.user.sub); }
  @Get("pending") @Roles("admin", "super_admin", "owner") pending() { return this.kyc.listPending(); }
  @Post(":id/review") @Roles("admin", "super_admin", "owner")
  review(@Req() r: any, @Param("id") id: string, @Body() b: { status: "approved" | "rejected"; note: string }) {
    return this.kyc.review(id, r.user.sub, b.status, b.note);
  }
}
