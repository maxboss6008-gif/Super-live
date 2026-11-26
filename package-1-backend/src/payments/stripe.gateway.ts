import { Injectable } from "@nestjs/common";
import Stripe from "stripe";
import { PaymentGateway, WebhookEvent } from "./payment-gateway.interface";

/**
 * ⚠️ This is NOT Al Rajhi or any specific Saudi/Middle-East gateway — it is
 * written for Stripe, because Stripe's API is publicly well-documented and I know it
 * reliably, whereas I don't have confirmed real endpoint/field names for Al Rajhi or any
 * other regional gateway. Guessing field names for a financial integration is risky, so
 * I did not invent one. This file shows how the PaymentGateway interface is implemented
 * with a real, production-grade gateway (checkout creation, webhook signature
 * verification, refunds). Give me your actual gateway's documentation (Al Rajhi
 * POS/Moyasar/HyperPay/PayTabs, whichever is final) and I will write accurate code for
 * it in this same pattern.
 */
@Injectable()
export class StripeGateway implements PaymentGateway {
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  async createCheckout(o: { orderId: string; amountCents: number; currency: string; userId: string }) {
    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price_data: { currency: o.currency.toLowerCase(), unit_amount: o.amountCents, product_data: { name: `Super Live কয়েন — অর্ডার ${o.orderId}` } }, quantity: 1 }],
      metadata: { orderId: o.orderId, userId: o.userId },
      success_url: process.env.PAYMENT_SUCCESS_URL || "https://example.com/success",
      cancel_url: process.env.PAYMENT_CANCEL_URL || "https://example.com/cancel",
    });
    return { gatewayRef: session.id, redirectUrl: session.url! };
  }

  verifyWebhook(rawBody: Buffer, headers: Record<string, any>): WebhookEvent {
    // Never trust a webhook without verifying its signature — otherwise anyone could send a fake "paid" event.
    const event = this.stripe.webhooks.constructEvent(rawBody, headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET!);
    const obj = event.data.object as any;
    const status = event.type === "checkout.session.completed" ? "paid" : event.type === "checkout.session.expired" ? "failed" : "paid";
    return { eventId: event.id, orderId: obj.metadata?.orderId, status };
  }

  async refund(gatewayRef: string, amountCents: number) {
    const session = await this.stripe.checkout.sessions.retrieve(gatewayRef);
    if (session.payment_intent) await this.stripe.refunds.create({ payment_intent: session.payment_intent as string, amount: amountCents });
  }
}
