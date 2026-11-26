import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Initial schema, hand-written from the entity definitions.
 * Test this against a staging database before running it in production — it has not
 * been run against a real database.
 */
export class Init1700000000000 implements MigrationInterface {
  name = "Init1700000000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`); // needed for gen_random_uuid()

    await q.query(`CREATE TABLE "users" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "email" varchar UNIQUE NOT NULL,
      "name" varchar NOT NULL,
      "passwordHash" varchar NOT NULL,
      "role" varchar NOT NULL DEFAULT 'user',
      "totpSecret" varchar,
      "knownDevices" text[] NOT NULL DEFAULT '{}',
      "failedCount" int NOT NULL DEFAULT 0,
      "lockedUntil" timestamptz,
      "lastLockAt" timestamptz,
      "withdrawalBlockedUntil" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);

    await q.query(`CREATE TABLE "wallets" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" varchar NOT NULL,
      "role" varchar NOT NULL DEFAULT 'user',
      "coins" bigint NOT NULL DEFAULT 0,
      "earned" bigint NOT NULL DEFAULT 0,
      "promoEarned" bigint NOT NULL DEFAULT 0,
      "unlimited" boolean NOT NULL DEFAULT false
    )`);
    await q.query(`CREATE UNIQUE INDEX "idx_wallets_userId" ON "wallets" ("userId")`);

    await q.query(`CREATE TABLE "ledger_entries" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "walletId" uuid NOT NULL,
      "bucket" varchar NOT NULL,
      "delta" bigint NOT NULL,
      "kind" varchar NOT NULL,
      "ref" varchar NOT NULL,
      "counterpartyUserId" varchar,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE UNIQUE INDEX "idx_ledger_wallet_ref" ON "ledger_entries" ("walletId", "ref")`);
    await q.query(`CREATE INDEX "idx_ledger_wallet_created" ON "ledger_entries" ("walletId", "createdAt")`);

    await q.query(`CREATE TABLE "payment_orders" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" varchar NOT NULL,
      "packageId" varchar NOT NULL,
      "coins" int NOT NULL,
      "amountCents" int NOT NULL,
      "status" varchar NOT NULL DEFAULT 'pending',
      "gatewayRef" varchar,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);

    await q.query(`CREATE TABLE "entitlements" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" varchar NOT NULL, "feature" varchar NOT NULL,
      "unlimited" boolean NOT NULL DEFAULT false, "setBy" varchar NOT NULL,
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE UNIQUE INDEX "idx_entitlements_user_feature" ON "entitlements" ("userId", "feature")`);

    await q.query(`CREATE TABLE "call_rates" ("hostId" varchar PRIMARY KEY, "coinsPerMinute" int NOT NULL)`);
    await q.query(`CREATE TABLE "calls" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "callerId" varchar NOT NULL, "hostId" varchar NOT NULL, "rate" int NOT NULL,
      "status" varchar NOT NULL DEFAULT 'active', "minutesBilled" int NOT NULL DEFAULT 0,
      "startedAt" timestamptz NOT NULL DEFAULT now(), "endedAt" timestamptz, "endReason" varchar
    )`);
    await q.query(`CREATE INDEX "idx_calls_caller" ON "calls" ("callerId")`);
    await q.query(`CREATE INDEX "idx_calls_host" ON "calls" ("hostId")`);

    await q.query(`CREATE TABLE "system_state" (
      "id" int PRIMARY KEY DEFAULT 1, "serverEnabled" boolean NOT NULL DEFAULT true,
      "cardEnabled" boolean NOT NULL DEFAULT true, "killedAt" timestamptz, "resumeBy" timestamptz, "changedBy" varchar
    )`);
    await q.query(`CREATE TABLE "app_settings" ("key" varchar PRIMARY KEY, "value" int NOT NULL, "changedBy" varchar)`);
    await q.query(`CREATE TABLE "banners" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "title" varchar NOT NULL, "imageUrl" varchar NOT NULL,
      "linkUrl" varchar, "active" boolean NOT NULL DEFAULT true, "startsAt" timestamptz, "endsAt" timestamptz,
      "createdBy" varchar NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE TABLE "level_rules" ("level" int PRIMARY KEY, "name" varchar NOT NULL, "minGiftedCoins" bigint NOT NULL)`);
    await q.query(`CREATE TABLE "level_overrides" ("userId" varchar PRIMARY KEY, "level" int NOT NULL, "setBy" varchar NOT NULL)`);

    await q.query(`CREATE TABLE "moderation_reports" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "reporterId" varchar NOT NULL,
      "targetType" varchar NOT NULL, "targetId" varchar NOT NULL, "reason" varchar NOT NULL,
      "status" varchar NOT NULL DEFAULT 'open', "resolvedBy" varchar, "resolutionNote" text,
      "createdAt" timestamptz NOT NULL DEFAULT now(), "resolvedAt" timestamptz
    )`);
    await q.query(`CREATE TABLE "moderation_access_log" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "moderatorId" varchar NOT NULL, "reportId" varchar NOT NULL,
      "targetType" varchar NOT NULL, "targetId" varchar NOT NULL, "visibleToParticipants" boolean NOT NULL DEFAULT true,
      "enteredAt" timestamptz NOT NULL DEFAULT now(), "exitedAt" timestamptz
    )`);
    await q.query(`CREATE INDEX "idx_modaccess_target" ON "moderation_access_log" ("targetType", "targetId")`);

    await q.query(`CREATE TABLE "kyc_submissions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "userId" varchar NOT NULL, "documents" jsonb NOT NULL,
      "status" varchar NOT NULL DEFAULT 'pending', "reviewedBy" varchar, "note" text,
      "createdAt" timestamptz NOT NULL DEFAULT now(), "reviewedAt" timestamptz
    )`);
    await q.query(`CREATE INDEX "idx_kyc_user" ON "kyc_submissions" ("userId")`);

    await q.query(`CREATE TABLE "withdrawal_requests" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "userId" varchar NOT NULL, "ref" varchar NOT NULL,
      "coins" bigint NOT NULL, "amountUsd" decimal(12,2) NOT NULL, "method" varchar NOT NULL,
      "destination" jsonb NOT NULL, "status" varchar NOT NULL DEFAULT 'pending',
      "processedBy" varchar, "note" text, "createdAt" timestamptz NOT NULL DEFAULT now(), "processedAt" timestamptz
    )`);
    await q.query(`CREATE INDEX "idx_withdrawal_user" ON "withdrawal_requests" ("userId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const t of ["withdrawal_requests","kyc_submissions","moderation_access_log","moderation_reports","level_overrides","level_rules","banners","app_settings",
      "system_state","calls","call_rates","entitlements","payment_orders","ledger_entries","wallets","users"]) {
      await q.query(`DROP TABLE IF EXISTS "${t}" CASCADE`);
    }
  }
}
