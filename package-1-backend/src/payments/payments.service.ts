import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PAYMENT_GATEWAY, PaymentGateway } from "./payment-gateway.interface";
import { PaymentOrder } from "./payment-order.entity";
import { WalletService, COINS_PER_USD } from "../wallet/wallet.service";

// Coin packages: give me your final list and I will update these (these are samples)
export const PACKAGES: Record<string, { coins: number; amountCents: number }> = {
  p100: { coins: 10_000, amountCents: (10_000 / COINS_PER_USD) * 100 },
  p500: { coins: 50_000, amountCents: (50_000 / COINS_PER_USD) * 100 },
};
const CUSTOM_MIN_COINS = 1_000, CUSTOM_MAX_COINS = 500_000;

@Injectable()
export class PaymentsService {
  constructor(@InjectRepository(PaymentOrder) private orders: Repository<PaymentOrder>,
              @Inject(PAYMENT_GATEWAY) private gw: PaymentGateway, private wallet: WalletService) {}

  async checkout(userId: string, packageId?: string, customCoins?: number) {
    let coins: number, amountCents: number;
    if (packageId) {
      const p = PACKAGES[packageId]; if (!p) throw new BadRequestException("প্যাকেজ নেই"); // package not found
      ({ coins, amountCents } = p);
    } else {
      if (!Number.isInteger(customCoins) || customCoins! < CUSTOM_MIN_COINS || customCoins! > CUSTOM_MAX_COINS) throw new BadRequestException("কাস্টম পরিমাণ সীমার বাইরে"); // custom amount is out of bounds
      coins = customCoins!; amountCents = Math.round((coins / COINS_PER_USD) * 100);
    }
    const order = await this.orders.save(this.orders.create({ userId, packageId: packageId || "custom", coins, amountCents })); // the price is always decided server-side
    const c = await this.gw.createCheckout({ orderId: order.id, amountCents, currency: "USD", userId });
    await this.orders.update(order.id, { gatewayRef: c.gatewayRef });
    return { orderId: order.id, redirectUrl: c.redirectUrl };
  }

  async handleWebhook(raw: Buffer, headers: Record<string, any>) {
    const ev = this.gw.verifyWebhook(raw, headers);
    const order = await this.orders.findOne({ where: { id: ev.orderId } });
    if (!order) return;
    if (ev.status === "paid" && order.status === "pending") {
      await this.wallet.creditPurchase(order.userId, order.coins, `order:${order.id}`); // idempotent
      await this.orders.update(order.id, { status: "paid" });
    } else if (ev.status === "failed" && order.status === "pending") {
      await this.orders.update(order.id, { status: "failed" });
    }
  }
}
