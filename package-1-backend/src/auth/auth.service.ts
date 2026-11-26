import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import { randomUUID } from "crypto";
import { User, Role } from "../entities";
import { REDIS } from "../redis.module";
import Redis from "ioredis";

const LOCK_30MIN_MS = 30 * 60 * 1000;
const LOCK_24H_MS = 24 * 3600 * 1000;
const FAILS_BEFORE_LOCK = 5;
const CHALLENGE_TTL_SEC = 300; // 2FA code must be entered within 5 minutes
const WITHDRAWAL_BLOCK_AFTER_RESET_MS = 48 * 3600 * 1000;
const REFRESH_TTL_SEC = 30 * 24 * 3600; // 30 days

/**
 * Spec 1.6 — lock the account after 5 wrong passwords (30 minutes the first time,
 * 24 hours if it happens again within 24 hours). TOTP (authenticator app) is mandatory
 * on a new-device login. The challenge (with deviceId) is kept in Redis for 5 minutes
 * because it is temporary, and keeping it in-memory would not be visible to a different
 * P1 instance when the user comes back to verify.
 */
@Injectable()
export class AuthService {
  constructor(@InjectRepository(User) private users: Repository<User>, private jwt: JwtService, @Inject(REDIS) private redis: Redis) {}

  private challengeKey(id: string) { return `2fa:challenge:${id}`; }
  private refreshKey(token: string) { return `refresh:${token}`; }

  /**
   * The access token is deliberately short-lived (15 minutes) so a leak does limited
   * damage. A long-lived refresh token (in Redis, 30 days) is issued alongside it so the
   * user does not have to log in with password+2FA every 15 minutes. The old refresh
   * token is invalidated and a new one issued each time it is used (rotation) — if a
   * stolen token is reused later, that reuse will be caught.
   */
  private async issueTokens(user: User) {
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role });
    const refreshToken = randomUUID();
    await this.redis.set(this.refreshKey(refreshToken), user.id, "EX", REFRESH_TTL_SEC);
    return { accessToken, refreshToken };
  }

  async refresh(oldRefreshToken: string) {
    const userId = await this.redis.get(this.refreshKey(oldRefreshToken));
    if (!userId) throw new UnauthorizedException("রিফ্রেশ টোকেনের মেয়াদ শেষ বা বাতিল — আবার লগইন করুন");
    await this.redis.del(this.refreshKey(oldRefreshToken)); // Rotation: the old token is invalidated immediately
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.issueTokens(user);
  }

  async logout(refreshToken: string) { await this.redis.del(this.refreshKey(refreshToken)); return { ok: true }; }

  async register(name: string, email: string, password: string) {
    if (!name?.trim() || !email?.trim() || !password || password.length < 8)
      throw new BadRequestException("নাম, ইমেইল ও কমপক্ষে ৮ অক্ষরের পাসওয়ার্ড দিতে হবে");
    if (await this.users.findOne({ where: { email } })) throw new ConflictException("এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট আছে");
    const passwordHash = await bcrypt.hash(password, 12);
    const totpSecret = authenticator.generateSecret(); // 2FA is mandatory, so the secret is generated right at registration
    const user = await this.users.save(this.users.create({ name, email, passwordHash, totpSecret, knownDevices: [] }));
    const otpauthUrl = authenticator.keyuri(email, "Super Live", totpSecret);
    return { userId: user.id, totpSecret, otpauthUrl }; // the client renders this as a QR code for the user
  }

  private async checkLock(user: User) {
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((+user.lockedUntil - Date.now()) / 60000);
      throw new ForbiddenException({ message: `অ্যাকাউন্ট সাময়িক লক আছে, প্রায় ${minutes} মিনিট পরে চেষ্টা করুন`, retryAfterSeconds: minutes * 60 });
    }
  }

  private async registerFailure(user: User) {
    const failedCount = user.failedCount + 1;
    let lockedUntil = user.lockedUntil, lastLockAt = user.lastLockAt;
    if (failedCount >= FAILS_BEFORE_LOCK) {
      const within24h = user.lastLockAt && Date.now() - +user.lastLockAt < LOCK_24H_MS;
      lockedUntil = new Date(Date.now() + (within24h ? LOCK_24H_MS : LOCK_30MIN_MS));
      lastLockAt = new Date();
      await this.users.update(user.id, { failedCount: 0, lockedUntil, lastLockAt });
    } else {
      await this.users.update(user.id, { failedCount });
    }
  }

  /** After a successful password check: issue tokens directly on a known device, otherwise raise a 2FA challenge on a new device. */
  private async proceedAfterPassword(user: User, deviceId: string, code?: string) {
    const known = user.knownDevices.includes(deviceId);
    if (known) { await this.users.update(user.id, { failedCount: 0 }); return this.issueTokens(user); }

    if (!code) {
      const challengeId = randomUUID();
      await this.redis.set(this.challengeKey(challengeId), JSON.stringify({ userId: user.id, deviceId }), "EX", CHALLENGE_TTL_SEC);
      return { requiresTwoFactor: true, challengeId };
    }
    if (!authenticator.check(code, user.totpSecret)) throw new UnauthorizedException("কোডটি ভুল বা মেয়াদ শেষ");
    await this.users.update(user.id, { failedCount: 0, knownDevices: [...user.knownDevices, deviceId] });
    return this.issueTokens(user);
  }

  async login(email: string, password: string, deviceId: string, code?: string, requiredRole?: Role[]) {
    if (!deviceId) throw new BadRequestException("deviceId দিতে হবে");
    const user = await this.users.findOne({ where: { email } });
    if (!user) throw new UnauthorizedException("ইমেইল বা পাসওয়ার্ড ভুল");
    await this.checkLock(user);
    if (!(await bcrypt.compare(password, user.passwordHash))) { await this.registerFailure(user); throw new UnauthorizedException("ইমেইল বা পাসওয়ার্ড ভুল"); }
    if (requiredRole && !requiredRole.includes(user.role)) throw new ForbiddenException("এই পোর্টালে প্রবেশের অনুমতি নেই");
    return this.proceedAfterPassword(user, deviceId, code);
  }

  async verifyTwoFactor(challengeId: string, code: string) {
    const raw = await this.redis.get(this.challengeKey(challengeId));
    if (!raw) throw new UnauthorizedException("চ্যালেঞ্জের মেয়াদ শেষ, আবার লগইন করুন");
    const { userId, deviceId } = JSON.parse(raw);
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (!authenticator.check(code, user.totpSecret)) throw new UnauthorizedException("কোডটি ভুল বা মেয়াদ শেষ");
    await this.redis.del(this.challengeKey(challengeId));
    await this.users.update(user.id, { failedCount: 0, knownDevices: [...user.knownDevices, deviceId] });
    return this.issueTokens(user);
  }

  /** If the phone is lost, an admin verifies identity and calls this (the external ID-verification process is outside this code). */
  async resetTwoFactorByAdmin(userId: string, adminId: string) {
    const user = await this.users.findOne({ where: { id: userId } }); if (!user) throw new BadRequestException("ইউজার পাওয়া যায়নি");
    const totpSecret = authenticator.generateSecret();
    // After a 2FA recovery, withdrawals are blocked for 48 hours on the next new-device
    // login (spec 1.6). Simplification: the block is counted from the moment of reset,
    // not from the next login — this simplification is noted in the README.
    await this.users.update(userId, { totpSecret, knownDevices: [], failedCount: 0, lockedUntil: null, withdrawalBlockedUntil: new Date(Date.now() + WITHDRAWAL_BLOCK_AFTER_RESET_MS) });
    const otpauthUrl = authenticator.keyuri(user.email, "Super Live", totpSecret);
    return { otpauthUrl, resetBy: adminId };
  }
}
