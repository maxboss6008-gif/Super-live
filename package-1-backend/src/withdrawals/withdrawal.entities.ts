import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";
@Entity("withdrawal_requests")
export class WithdrawalRequest {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column() userId: string;
  @Column() ref: string;                             // used to match the wallet ledger hold/release
  @Column({ type: "bigint" }) coins: number;         // from withdrawable ("earned") coins
  @Column("decimal", { precision: 12, scale: 2 }) amountUsd: string;
  @Column() method: "bank_transfer" | "gateway";
  @Column("jsonb") destination: Record<string, any>; // bank details/gateway account — store only the last 4 digits, never the full number
  @Column({ default: "pending" }) status: "pending" | "approved" | "rejected" | "paid";
  @Column({ nullable: true }) processedBy: string;
  @Column({ type: "text", nullable: true }) note: string;
  @CreateDateColumn() createdAt: Date;
  @Column({ type: "timestamptz", nullable: true }) processedAt: Date | null;
}
