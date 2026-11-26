import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";
@Entity("kyc_submissions")
export class KycSubmission {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column() userId: string;
  @Column("jsonb") documents: { type: string; url: string }[]; // URLs coming from real storage (S3/Cloud Storage)
  @Column({ default: "pending" }) status: "pending" | "approved" | "rejected";
  @Column({ nullable: true }) reviewedBy: string;
  @Column({ type: "text", nullable: true }) note: string;
  @CreateDateColumn() createdAt: Date;
  @Column({ type: "timestamptz", nullable: true }) reviewedAt: Date | null;
}
