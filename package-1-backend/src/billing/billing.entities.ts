import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity("entitlements")
@Index(["userId", "feature"], { unique: true })
export class Entitlement {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column() userId: string;
  @Column() feature: "messages" | "calls";
  @Column({ default: false }) unlimited: boolean;
  @Column() setBy: string;               // which super admin changed this
  @UpdateDateColumn() updatedAt: Date;
}

@Entity("call_rates")
export class CallRate {
  @PrimaryColumn() hostId: string;
  @Column() coinsPerMinute: number;
}

@Entity("calls")
export class Call {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Index() @Column() callerId: string;
  @Index() @Column() hostId: string;
  @Column() rate: number;                // the rate at the moment the call started (a later rate change has no effect on it)
  @Column({ default: "active" }) status: "active" | "ended";
  @Column({ default: 0 }) minutesBilled: number;
  @CreateDateColumn() startedAt: Date;
  @Column({ type: "timestamptz", nullable: true }) endedAt: Date | null;
  @Column({ type: "varchar", nullable: true }) endReason: string | null;
}
