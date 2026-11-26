import { Column, CreateDateColumn, Entity, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";
const num = { to: (v: number) => v, from: (v: string) => Number(v) };

@Entity("system_state")
export class SystemState {
  @PrimaryColumn({ default: 1 }) id: number;
  @Column({ default: true }) serverEnabled: boolean;
  @Column({ default: true }) cardEnabled: boolean;
  @Column({ type: "timestamptz", nullable: true }) killedAt: Date | null;
  @Column({ type: "timestamptz", nullable: true }) resumeBy: Date | null; // killedAt + 24 hours
  @Column({ type: "varchar", nullable: true }) changedBy: string | null;
}

@Entity("app_settings")
export class AppSetting {
  @PrimaryColumn() key: string;
  @Column() value: number;
  @Column({ nullable: true }) changedBy: string;
}

@Entity("banners")
export class Banner {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column() title: string;
  @Column() imageUrl: string;
  @Column({ type: "varchar", nullable: true }) linkUrl: string | null;
  @Column({ default: true }) active: boolean;
  @Column({ type: "timestamptz", nullable: true }) startsAt: Date | null;
  @Column({ type: "timestamptz", nullable: true }) endsAt: Date | null;
  @Column() createdBy: string;
  @CreateDateColumn() createdAt: Date;
}

@Entity("level_rules")
export class LevelRule {
  @PrimaryColumn() level: number;
  @Column() name: string;
  @Column({ type: "bigint", transformer: num }) minGiftedCoins: number; // this level is reached once this many coins have been gifted
}

@Entity("level_overrides")
export class LevelOverride {
  @PrimaryColumn() userId: string;   // a level set by hand for a specific user ID
  @Column() level: number;
  @Column() setBy: string;
}
