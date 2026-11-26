export const PAYMENT_GATEWAY = "PAYMENT_GATEWAY";

export interface WebhookEvent { eventId: string; orderId: string; status: "paid" | "failed" | "refunded"; }

/** Any gateway (Al Rajhi, a card processor, etc.) implements this interface. */
export interface PaymentGateway {
  createCheckout(o: { orderId: string; amountCents: number; currency: string; userId: string }): Promise<{ gatewayRef: string; redirectUrl: string }>;
  verifyWebhook(rawBody: Buffer, headers: Record<string, any>): WebhookEvent; // throws if the signature is invalid
  refund(gatewayRef: string, amountCents: number): Promise<void>;
}
