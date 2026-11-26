import { WalletService, GIFT_FEE_PERCENT } from "../src/wallet/wallet.service";
import { FakeDataSource } from "./fakeManager";

// এই টেস্ট আসল Postgres ছাড়াই চলে (FakeManager দিয়ে), তাই দ্রুত কিন্তু TypeORM-এর আসল SQL আচরণ যাচাই করে না।
// মূল ডাটাবেজের বিপরীতেও একবার e2e টেস্ট চালানো উচিত (নিচে e2e.todo.md দেখুন)।
describe("WalletService", () => {
  function build() {
    const ds = new FakeDataSource();
    const svc = new WalletService({} as any, {} as any, ds as any);
    return { svc, ds };
  }

  it("ক্রয়ের পর কয়েন জমা হয়, দ্বিতীয়বার একই ref-এ জমা হয় না (idempotent)", async () => {
    const { svc } = build();
    await svc.creditPurchase("u1", 1000, "order:1");
    await svc.creditPurchase("u1", 1000, "order:1"); // ডুপ্লিকেট
    const s = await svc.summary("u1");
    expect(s.coins).toBe(1000);
  });

  it(`গিফটে ${GIFT_FEE_PERCENT}% ফি কাটে, বাকিটা প্রাপকের আয়ে যায়`, async () => {
    const { svc } = build();
    await svc.creditPurchase("sender", 1000, "order:1");
    const r = await svc.gift("sender", "host", 100, "k1");
    expect(r.duplicate).toBe(false);
    expect(r.creatorShare).toBe(80);
    expect(r.platformFee).toBe(20);
    const sSender = await svc.summary("sender"); expect(sSender.coins).toBe(900);
    const sHost = await svc.summary("host"); expect(sHost.earned).toBe(80);
  });

  it("আনলিমিটেড প্রেরকের কয়েন কাটে না, প্রাপকের আয় প্রোমো বাকেটে যায়", async () => {
    const { svc } = build();
    await svc.setUnlimited("sender", true, "admin1");
    const r = await svc.gift("sender", "host", 500, "k2");
    const sSender = await svc.summary("sender"); expect(sSender.coins).toBe(0); // কাটেনি
    const sHost = await svc.summary("host"); expect(sHost.promoEarned).toBe(400); expect(sHost.earned).toBe(0);
  });

  it("ব্যালেন্সের বেশি গিফট করতে চাইলে ত্রুটি দেয়", async () => {
    const { svc } = build();
    await expect(svc.gift("sender", "host", 100, "k3")).rejects.toThrow();
  });

  it("নিজেকে গিফট করা যায় না", async () => {
    const { svc } = build();
    await expect(svc.gift("u1", "u1", 10, "k4")).rejects.toThrow();
  });
});
