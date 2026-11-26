import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
const num = { to: (v: number) => v, from: (v: string) => Number(v) };

@Entity("wallets")
export class Wallet {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Index({ unique: true }) @Column() userId: string;
  @Column({ default: "user" }) role: string;                       // user | creator | agent
  @Column({ type: "bigint", default: 0, transformer: num }) coins: number;       // spendable (limited) coins
  @Column({ type: "bigint", default: 0, transformer: num }) earned: number;      // earnings from gifts (withdrawable)
  @Column({ type: "bigint", default: 0, transformer: num }) promoEarned: number; // promo gift earnings (not withdrawable)
  @Column({ default: false }) unlimited: boolean;                  // unlimited coin account (only a super admin can grant this)
}

@Entity("ledger_entries")
@Index(["walletId", "ref"], { unique: true }) // the same reference can never post a second transaction (idempotency)
export class LedgerEntry {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column() walletId: string;
  @Column() bucket: "coins" | "earned" | "promoEarned";
  @Column({ type: "bigint", transformer: num }) delta: number;
  @Column() kind: string;  // purchase | gift_out | gift_in | gift_out_promo | admin
  @Column() ref: string;
  @Column({ nullable: true }) counterpartyUserId: string;
  @CreateDateColumn() createdAt: Date;
}
