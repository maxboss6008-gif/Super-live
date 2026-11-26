import { Body, Controller, Headers, HttpCode, Post, RawBodyRequest, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(private p: PaymentsService) {}

  @Post("checkout") @UseGuards(AuthGuard)
  checkout(@Req() req: any, @Body() b: { packageId?: string; customCoins?: number }) {
    return this.p.checkout(req.user.sub, b.packageId, b.customCoins);
  }

  // Comes from the gateway; verified by signature, not JWT
  @Post("webhook") @HttpCode(200)
  async webhook(@Req() req: RawBodyRequest<any>, @Headers() h: Record<string, any>) {
    await this.p.handleWebhook(req.rawBody as Buffer, h);
    return { received: true };
  }
}
