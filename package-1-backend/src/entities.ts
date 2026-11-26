import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from "typeorm";

export type Role = "user" | "creator" | "agent" | "admin" | "super_admin" | "owner" | "service";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Index({ unique: true }) @Column() email: string;
  @Column() name: string;
  @Column() passwordHash: string;
  @Column({ default: "user" }) role: Role;
  @Column({ nullable: true }) totpSecret: string;
  @Column("text", { array: true, default: "{}" }) knownDevices: string[];
  @Column({ default: 0 }) failedCount: number;
  @Column({ type: "timestamptz", nullable: true }) lockedUntil: Date | null;
  @Column({ type: "timestamptz", nullable: true }) lastLockAt: Date | null;
  @Column({ type: "timestamptz", nullable: true }) withdrawalBlockedUntil: Date | null; // 48 hours after a 2FA reset
  @CreateDateColumn() createdAt: Date;
}
// Wallet and LedgerEntry now live in src/wallet/wallet.entity.ts (with earned/promo buckets)
