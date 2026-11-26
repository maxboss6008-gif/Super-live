import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { authenticator } from "otplib";
import { AuthService } from "../src/auth/auth.service";
import { FakeUsersRepo, FakeRedis } from "./fakeUsersRepo";

// JwtService-এর ফেক — আসল সাইনিং ছাড়াই টোকেন "ইস্যু হলো কিনা" যাচাই যথেষ্ট এখানে
const fakeJwt = { signAsync: async (payload: any) => `fake.jwt.${payload.sub}` } as any;

describe("AuthService", () => {
  function build() {
    const repo = new FakeUsersRepo(); const redis = new FakeRedis();
    const svc = new AuthService(repo as any, fakeJwt, redis as any);
    return { svc, repo, redis };
  }

  it("দুর্বল পাসওয়ার্ড বা ডুপ্লিকেট ইমেইলে রেজিস্ট্রেশন প্রত্যাখ্যান করে, সফল হলে TOTP সিক্রেট দেয়", async () => {
    const { svc } = build();
    await expect(svc.register("ক", "a@b.com", "1234567")).rejects.toThrow(); // ৮ অক্ষরের কম
    const r = await svc.register("ক খ", "a@b.com", "password123");
    expect(r.totpSecret).toBeTruthy(); expect(r.otpauthUrl).toContain("otpauth://");
    await expect(svc.register("গ", "a@b.com", "password123")).rejects.toThrow(); // ডুপ্লিকেট ইমেইল
  });

  it(`${5} বার ভুল পাসওয়ার্ডে ৩০ মিনিটের জন্য অ্যাকাউন্ট লক হয়, তারপর সঠিক পাসওয়ার্ডেও ঢুকতে দেয় না`, async () => {
    const { svc } = build();
    await svc.register("ইউজার", "u@b.com", "correct-password");
    for (let i = 0; i < 5; i++) await expect(svc.login("u@b.com", "wrong", "device-1")).rejects.toThrow(UnauthorizedException);
    await expect(svc.login("u@b.com", "correct-password", "device-1")).rejects.toThrow(ForbiddenException);
  });

  it("পরিচিত ডিভাইসে সঠিক পাসওয়ার্ডে সরাসরি টোকেন দেয়, ২FA চায় না", async () => {
    const { svc, repo } = build();
    const { userId } = await svc.register("ইউজার", "u2@b.com", "correct-password");
    await repo.update(userId, { knownDevices: ["device-known"] });
    const r: any = await svc.login("u2@b.com", "correct-password", "device-known");
    expect(r.accessToken).toBeTruthy();
  });

  it("নতুন ডিভাইসে কোড ছাড়া লগইন করলে চ্যালেঞ্জ ফেরত দেয়, ভুল কোডে টোকেন দেয় না, সঠিক কোডে দেয়", async () => {
    const { svc } = build();
    const { userId, totpSecret } = await svc.register("ইউজার", "u3@b.com", "correct-password");
    const step1: any = await svc.login("u3@b.com", "correct-password", "device-new");
    expect(step1.requiresTwoFactor).toBe(true);
    expect(step1.challengeId).toBeTruthy();

    await expect(svc.verifyTwoFactor(step1.challengeId, "000000")).rejects.toThrow(UnauthorizedException);

    const validCode = authenticator.generate(totpSecret);
    const r = await svc.verifyTwoFactor(step1.challengeId, validCode);
    expect(r.accessToken).toBeTruthy();
    expect(r.refreshToken).toBeTruthy();
  });

  it("রিফ্রেশ টোকেন একবার ব্যবহারের পর বাতিল হয়ে যায় (রোটেশন), পুরনোটা দিয়ে আবার রিফ্রেশ করা যায় না", async () => {
    const { svc, repo } = build();
    const { userId } = await svc.register("ইউজার", "u5@b.com", "correct-password");
    await repo.update(userId, { knownDevices: ["device-known"] });
    const first: any = await svc.login("u5@b.com", "correct-password", "device-known");
    const second = await svc.refresh(first.refreshToken);
    expect(second.accessToken).toBeTruthy();
    await expect(svc.refresh(first.refreshToken)).rejects.toThrow(UnauthorizedException); // রি-ইউজ ধরা পড়ে
  });

  it("অ্যাডমিন ২FA রিসেট করলে নতুন TOTP সিক্রেট দেয় ও পুরনো ডিভাইস তালিকা খালি হয়", async () => {
    const { svc, repo } = build();
    const { userId } = await svc.register("ইউজার", "u4@b.com", "correct-password");
    await repo.update(userId, { knownDevices: ["device-old"] });
    const r = await svc.resetTwoFactorByAdmin(userId, "admin-1");
    expect(r.otpauthUrl).toContain("otpauth://");
    const user = await repo.findOne({ where: { id: userId } });
    expect(user.knownDevices).toEqual([]);
    expect(user.withdrawalBlockedUntil).toBeTruthy();
  });
});
