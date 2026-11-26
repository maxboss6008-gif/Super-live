import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/** A report filed against a user or host; this is the only valid reason to start a review. */
@Entity("moderation_reports")
export class ModerationReport {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column() reporterId: string;
  @Column() targetType: "message" | "room" | "call" | "user";
  @Column() targetId: string;          // roomId, messageId, callId, or userId
  @Column() reason: string;
  @Column({ default: "open" }) status: "open" | "reviewing" | "resolved" | "dismissed";
  @Column({ nullable: true }) resolvedBy: string;
  @Column({ type: "text", nullable: true }) resolutionNote: string;
  @CreateDateColumn() createdAt: Date;
  @Column({ type: "timestamptz", nullable: true }) resolvedAt: Date | null;
}

/** Immutable audit log of every moderator entry — who, when, based on which report, what was viewed. */
@Entity("moderation_access_log")
@Index(["targetType", "targetId"])
export class ModerationAccess {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column() moderatorId: string;       // identity is never hidden
  @Column() reportId: string;          // an entry is never created without a valid open report
  @Column() targetType: "message" | "room" | "call" | "user";
  @Column() targetId: string;
  @Column({ default: true }) visibleToParticipants: boolean; // whether the room shows "a moderator has joined"
  @CreateDateColumn() enteredAt: Date;
  @Column({ type: "timestamptz", nullable: true }) exitedAt: Date | null;
}
