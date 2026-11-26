import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, Roles } from "../auth/auth.guard";
import { WithdrawalService } from "./withdrawal.service";

@Controller("withdrawals") @UseGuards(AuthGuard)
export class WithdrawalController {
  constructor(private svc: WithdrawalService) {}

  @Post() request(@Req() r: any, @Body() b: { coins: number; method: "bank_transfer" | "gateway"; destination: Record<string, any> }) {
    return this.svc.request(r.user.sub, b.coins, b.method, b.destination);
  }
  @Get("me") mine(@Req() r: any) { return this.svc.listMine(r.user.sub); }

  // The P3 admin dashboard calls GET /withdrawals?status=pending; with no status it returns all
  @Get() @Roles("admin", "super_admin", "owner") list(@Query("status") s?: string) {
    return this.svc.listByStatus(s);
  }
  @Post(":id/approve") @Roles("admin", "super_admin", "owner") approve(@Req() r: any, @Param("id") id: string) { return this.svc.approve(id, r.user.sub); }
  @Post(":id/reject") @Roles("admin", "super_admin", "owner") reject(@Req() r: any, @Param("id") id: string, @Body() b: { reason: string }) { return this.svc.reject(id, r.user.sub, b.reason); }
}
