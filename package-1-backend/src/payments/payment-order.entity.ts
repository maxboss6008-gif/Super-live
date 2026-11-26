import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";
@Entity("payment_orders")
export class PaymentOrder {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column() userId: string;
  @Column() packageId: string;
  @Column() coins: number;
  @Column() amountCents: number;
  @Column({ default: "pending" }) status: "pending" | "paid" | "failed" | "refunded";
  @Column({ nullable: true }) gatewayRef: string;
  @CreateDateColumn() createdAt: Date;
}
