import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "./entities";
import { Wallet, LedgerEntry } from "./wallet/wallet.entity";
import { PaymentOrder } from "./payments/payment-order.entity";
import { Entitlement, CallRate, Call } from "./billing/billing.entities";
import { SystemState, AppSetting, Banner, LevelRule, LevelOverride } from "./owner/owner.entities";
import { ModerationReport, ModerationAccess } from "./moderation/moderation.entities";
import { KycSubmission } from "./kyc/kyc.entities";
import { WithdrawalRequest } from "./withdrawals/withdrawal.entities";

// This single DataSource is used for CLI migrations; app.module.ts's TypeOrmModule.forRoot uses the same entities/options.
export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [User, Wallet, LedgerEntry, PaymentOrder, Entitlement, CallRate, Call, SystemState, AppSetting, Banner, LevelRule, LevelOverride, ModerationReport, ModerationAccess, KycSubmission, WithdrawalRequest],
  migrations: ["src/migrations/*.ts"],
  synchronize: false, // schema never changes without a migration — this is the safe choice in production
});
