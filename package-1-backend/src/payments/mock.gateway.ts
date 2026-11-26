import { Injectable } from "@nestjs/common";
import { PaymentGateway, WebhookEvent } from "./payment-gateway.interface";

// Development only. Never use in production.
@Injectable()
export class MockGateway implements PaymentGateway {
  async createCheckout(o: { orderId: string }) { return { gatewayRef: `mock_${o.orderId}`, redirectUrl: `https://example.invalid/pay/${o.orderId}` }; }
  verifyWebhook(raw: Buffer): WebhookEvent {
    if (process.env.NODE_ENV === "production") throw new Error("MockGateway প্রোডাকশনে বন্ধ"); // MockGateway is disabled in production
    return JSON.parse(raw.toString());
  }
  async refund() {}
}
