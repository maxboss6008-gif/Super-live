import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, Roles } from "../auth/auth.guard";
import { WalletService } from "./wallet.service";

@Controller()
@UseGuards(AuthGuard)
export class WalletController {
  constructor(private w: WalletService) {}

  @Get("wallet")
  async me(@Req() req: any) {
    const s = await this.w.summary(req.user.sub);
    const tx = await this.w.statement(req.user.sub, new Date(Date.now() - 30 * 864e5), new Date());
    return { balance: s.coins, ...s, transactions: tx.map((t) => ({ id: t.id, type: t.kind, amount: t.delta })) };
  }

  @Get("wallet/statement")
  statement(@Req() req: any, @Query("from") from: string, @Query("to") to: string) {
    return this.w.statement(req.user.sub, new Date(from), new Date(to)); // always only your own
  }

  @Post("wallet/gift")
  gift(@Req() req: any, @Body() b: { receiverId: string; coins: number; key: string }) {
    return this.w.gift(req.user.sub, b.receiverId, b.coins, b.key);
  }

  @Post("admin/wallet/:userId/unlimited")
  @Roles("super_admin")
  unlimited(@Req() req: any, @Param("userId") id: string, @Body() b: { enabled: boolean }) {
    return this.w.setUnlimited(id, !!b.enabled, req.user.sub);
  }
}
