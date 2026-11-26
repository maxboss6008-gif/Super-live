import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { User } from "./entities";
import { AuthService } from "./auth/auth.service";
import { AuthController } from "./auth/auth.controller";
import { RedisModule } from "./redis.module";
import { Entitlement, CallRate, Call } from "./billing/billing.entities";
import { EntitlementsService } from "./billing/entitlements.service";
import { MessagesBillingService } from "./billing/messages.service";
import { CallsService } from "./billing/calls.service";
import { BillingController } from "./billing/billing.controller";
import { SystemState, AppSetting, Banner, LevelRule, LevelOverride } from "./owner/owner.entities";
import { SystemService, CARD_CONTROL, NoopCardControl } from "./owner/system.service";
import { SettingsService } from "./owner/settings.service";
import { LevelService } from "./owner/level.service";
import { OwnerController } from "./owner/owner.controller";
import { ModerationReport, ModerationAccess } from "./moderation/moderation.entities";
import { ModerationService } from "./moderation/moderation.service";
import { ModerationController } from "./moderation/moderation.controller";
import { KycSubmission } from "./kyc/kyc.entities";
import { KycService } from "./kyc/kyc.service";
import { KycController } from "./kyc/kyc.controller";
import { WithdrawalRequest } from "./withdrawals/withdrawal.entities";
import { WithdrawalService } from "./withdrawals/withdrawal.service";
import { WithdrawalController } from "./withdrawals/withdrawal.controller";
import { Wallet, LedgerEntry } from "./wallet/wallet.entity";
import { WalletService } from "./wallet/wallet.service";
import { WalletController } from "./wallet/wallet.controller";
import { PaymentOrder } from "./payments/payment-order.entity";
import { PaymentsService } from "./payments/payments.service";
import { PaymentsController } from "./payments/payments.controller";
import { PAYMENT_GATEWAY } from "./payments/payment-gateway.interface";
import { MockGateway } from "./payments/mock.gateway";
import { StripeGateway } from "./payments/stripe.gateway";

@Module({
  imports: [
    RedisModule,
    JwtModule.register({ global: true, secret: process.env.JWT_SECRET, signOptions: { expiresIn: "15m" } }),
    // Default rate limit: 60 requests/IP per minute. Tighter limits on /auth/* routes via @Throttle in auth.controller.ts.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    TypeOrmModule.forRoot({ type: "postgres", url: process.env.DATABASE_URL, autoLoadEntities: true, synchronize: false, migrations: ["dist/migrations/*.js"], migrationsRun: process.env.RUN_MIGRATIONS === "true" }),
    TypeOrmModule.forFeature([User, Wallet, LedgerEntry, PaymentOrder, Entitlement, CallRate, Call, SystemState, AppSetting, Banner, LevelRule, LevelOverride, ModerationReport, ModerationAccess, KycSubmission, WithdrawalRequest]),
  ],
  controllers: [WalletController, PaymentsController, BillingController, OwnerController, ModerationController, KycController, WithdrawalController, AuthController],
  // When the real gateway (Al Rajhi etc.) is ready, only useClass needs to change
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }, AuthService, KycService, WithdrawalService, ModerationService, SystemService, SettingsService, LevelService, { provide: CARD_CONTROL, useClass: NoopCardControl },
    WalletService, PaymentsService, EntitlementsService, MessagesBillingService, CallsService, { provide: PAYMENT_GATEWAY, useClass: process.env.PAYMENT_GATEWAY === "stripe" ? StripeGateway : MockGateway }],
})
export class AppModule {}
