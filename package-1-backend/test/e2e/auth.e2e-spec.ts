import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../../src/app.module";
import { authenticator } from "otplib";

/**
 * এটা সত্যিকারের Postgres ও Redis-এর বিপরীতে চলে (process.env.DATABASE_URL/REDIS_URL থেকে),
 * ফেক/মক নয়। তাই এটা শুধু তখনই চলবে যখন আসলেই একটা ডাটাবেজ সংযোগ আছে ও মাইগ্রেশন চালানো
 * হয়ে গেছে — এই পরিবেশে (এই চ্যাটের কন্টেইনারে) সেটা সম্ভব না, কিন্তু GitHub Actions-এ
 * (ci.yml-এর postgres/redis service container-সহ) বা আপনার নিজের মেশিনে এটা আসল সিস্টেম
 * টেস্ট করবে।
 */
describe("Auth flow (e2e, আসল DB/Redis)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  it("রেজিস্টার → নতুন ডিভাইসে লগইন → ২FA চ্যালেঞ্জ → ভেরিফাই → wallet দেখা — পুরো আসল ফ্লো", async () => {
    const email = `e2e-${Date.now()}@test.com`;
    const http = request(app.getHttpServer());

    const reg = await http.post("/api/auth/register").send({ name: "ই ২ই", email, password: "password123" }).expect(201);
    expect(reg.body.totpSecret).toBeTruthy();

    const login1 = await http.post("/api/auth/login").send({ email, password: "password123", deviceId: "e2e-device-1" }).expect(201);
    expect(login1.body.requiresTwoFactor).toBe(true); // নতুন ডিভাইস, তাই সরাসরি টোকেন নয়

    const code = authenticator.generate(reg.body.totpSecret);
    const verify = await http.post("/api/auth/2fa/verify").send({ challengeId: login1.body.challengeId, code }).expect(201);
    expect(verify.body.accessToken).toBeTruthy();
    expect(verify.body.refreshToken).toBeTruthy();

    const wallet = await http.get("/api/wallet").set("Authorization", `Bearer ${verify.body.accessToken}`).expect(200);
    expect(wallet.body.coins).toBe(0); // নতুন ইউজার, কয়েন ০

    // একই ডিভাইস থেকে দ্বিতীয়বার লগইন করলে এবার ২FA ছাড়াই সরাসরি টোকেন পাওয়া উচিত
    const login2 = await http.post("/api/auth/login").send({ email, password: "password123", deviceId: "e2e-device-1" }).expect(201);
    expect(login2.body.accessToken).toBeTruthy();
  });

  it("৫ বার ভুল পাসওয়ার্ডে অ্যাকাউন্ট লক হয়ে যায় (আসল DB-তে)", async () => {
    const email = `e2e-lock-${Date.now()}@test.com`;
    const http = request(app.getHttpServer());
    await http.post("/api/auth/register").send({ name: "লক টেস্ট", email, password: "password123" }).expect(201);
    for (let i = 0; i < 5; i++) await http.post("/api/auth/login").send({ email, password: "wrong", deviceId: "d1" }).expect(401);
    await http.post("/api/auth/login").send({ email, password: "password123", deviceId: "d1" }).expect(403);
  });
});
