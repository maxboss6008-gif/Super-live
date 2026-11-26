import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";

export const Roles = (...r: string[]) => SetMetadata("roles", r);

// JWT verification + role check. This note is historical: the full auth module (auth.service.ts) now exists and uses this same guard.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private reflector: Reflector) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const h: string = req.headers.authorization || "";
    if (!h.startsWith("Bearer ")) throw new UnauthorizedException();
    try { req.user = await this.jwt.verifyAsync(h.slice(7)); } catch { throw new UnauthorizedException(); }
    const roles = this.reflector.get<string[]>("roles", ctx.getHandler());
    if (roles?.length && !roles.includes(req.user.role)) throw new ForbiddenException();
    return true;
  }
}
