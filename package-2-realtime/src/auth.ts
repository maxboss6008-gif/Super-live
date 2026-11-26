import jwt from "jsonwebtoken";
export interface AuthUser { sub: string; role: string; }
export function verifyToken(token: string): AuthUser {
  return jwt.verify(token, process.env.JWT_SECRET as string) as AuthUser; // P1-এর JWT_SECRET-এর সাথে এক হতে হবে
}
export const ADMIN_ROLES = new Set(["admin", "super_admin", "owner"]);
