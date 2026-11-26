import { Body, Controller, Param, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard, Roles } from "./auth.guard";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private auth: AuthService) {}

  @Throttle({ default: { ttl: 3_600_000, limit: 5 } }) // max 5 registrations per hour from the same IP — prevents spam accounts
  @Post("register")
  register(@Body() b: { name: string; email: string; password: string }) {
    return this.auth.register(b.name, b.email, b.password);
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } }) // max 10 attempts per minute — slows IP-based brute force before the account-level lock kicks in
  @Post("login")
  login(@Body() b: { email: string; password: string; deviceId: string; code?: string }) {
    return this.auth.login(b.email, b.password, b.deviceId, b.code);
  }

  // Called by the P3 admin dashboard; only admin/super_admin/owner roles may log in here
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post("admin/login")
  adminLogin(@Body() b: { email: string; password: string; deviceId: string; code?: string }) {
    return this.auth.login(b.email, b.password, b.deviceId, b.code, ["admin", "super_admin", "owner"]);
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post("2fa/verify")
  verify(@Body() b: { challengeId: string; code: string }) { return this.auth.verifyTwoFactor(b.challengeId, b.code); }

  @Post("refresh")
  refresh(@Body() b: { refreshToken: string }) { return this.auth.refresh(b.refreshToken); }

  @Post("logout") @UseGuards(AuthGuard)
  logout(@Body() b: { refreshToken: string }) { return this.auth.logout(b.refreshToken); }

  @Post("admin/users/:id/reset-2fa") @UseGuards(AuthGuard) @Roles("admin", "super_admin", "owner")
  resetTwoFactor(@Req() r: any, @Param("id") id: string) { return this.auth.resetTwoFactorByAdmin(id, r.user.sub); }
}
