import { MessagesBillingService } from "../src/billing/messages.service";
import { FREE_MESSAGES_PER_DAY, MESSAGE_COST_COINS } from "../src/billing/pricing";

// ioredis-এর হালকা ইন-মেমরি নকল — শুধু এই সার্ভিস যে কমান্ডগুলো ব্যবহার করে সেগুলোই
class FakeRedis {
  store = new Map<string, string>();
  async get(k: string) { return this.store.get(k) ?? null; }
  async set(k: string, v: string, ...opts: any[]) {
    if (opts.includes("NX") && this.store.has(k)) return null;
    this.store.set(k, v); return "OK";
  }
  async incr(k: string) { const n = Number(this.store.get(k) || 0) + 1; this.store.set(k, String(n)); return n; }
  async decr(k: string) { const n = Number(this.store.get(k) || 0) - 1; this.store.set(k, String(n)); return n; }
  async del(k: string) { this.store.delete(k); }
  async expire() { return 1; }
}

describe("MessagesBillingService", () => {
  function build() {
    const redis = new FakeRedis();
    const cfg = { get: async (_k: string, def: number) => def } as any;
    const ent = { isUnlimited: async () => false } as any;
    const charged: string[] = [];
    const wallet = { spend: async () => { charged.push("x"); } } as any;
    const svc = new MessagesBillingService(redis as any, wallet, ent, cfg);
    return { svc, charged };
  }

  it(`দিনে ${FREE_MESSAGES_PER_DAY}টা মেসেজ ফ্রি, এরপর কয়েন কাটে`, async () => {
    const { svc, charged } = build();
    for (let i = 0; i < FREE_MESSAGES_PER_DAY; i++) {
      const r = await svc.charge("u1", `m${i}`);
      expect(r.free).toBe(true);
    }
    const r = await svc.charge("u1", "m-over");
    expect(r.free).toBe(false);
    expect(r.charged).toBe(MESSAGE_COST_COINS);
    expect(charged.length).toBe(1);
  });

  it("একই messageId দ্বিতীয়বার এলে আবার কাটে না", async () => {
    const { svc, charged } = build();
    await svc.charge("u1", "dup1");
    const r = await svc.charge("u1", "dup1");
    expect(r.duplicate).toBe(true);
    expect(charged.length).toBe(0);
  });
});
