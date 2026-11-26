# Schema — ডাটাবেজ টেবিল

`package-1-backend/src/migrations/1700000000000-Init.ts` থেকে সরাসরি জেনারেট করা, যাতে ডকুমেন্ট ও আসল মাইগ্রেশন কখনো আলাদা হয়ে না যায়।


## users
| কলাম | টাইপ |
|---|---|
| id | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` |
| email | `varchar UNIQUE NOT NULL` |
| name | `varchar NOT NULL` |
| passwordHash | `varchar NOT NULL` |
| role | `varchar NOT NULL DEFAULT 'user'` |
| totpSecret | `varchar` |
| knownDevices | `text[] NOT NULL DEFAULT '{}'` |
| failedCount | `int NOT NULL DEFAULT 0` |
| lockedUntil | `timestamptz` |
| lastLockAt | `timestamptz` |
| withdrawalBlockedUntil | `timestamptz` |
| createdAt | `timestamptz NOT NULL DEFAULT now()` |

## wallets
| কলাম | টাইপ |
|---|---|
| id | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` |
| userId | `varchar NOT NULL` |
| role | `varchar NOT NULL DEFAULT 'user'` |
| coins | `bigint NOT NULL DEFAULT 0` |
| earned | `bigint NOT NULL DEFAULT 0` |
| promoEarned | `bigint NOT NULL DEFAULT 0` |
| unlimited | `boolean NOT NULL DEFAULT false` |

## ledger_entries
| কলাম | টাইপ |
|---|---|
| id | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` |
| walletId | `uuid NOT NULL` |
| bucket | `varchar NOT NULL` |
| delta | `bigint NOT NULL` |
| kind | `varchar NOT NULL` |
| ref | `varchar NOT NULL` |
| counterpartyUserId | `varchar` |
| createdAt | `timestamptz NOT NULL DEFAULT now()` |

## payment_orders
| কলাম | টাইপ |
|---|---|
| id | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` |
| userId | `varchar NOT NULL` |
| packageId | `varchar NOT NULL` |
| coins | `int NOT NULL` |
| amountCents | `int NOT NULL` |
| status | `varchar NOT NULL DEFAULT 'pending'` |
| gatewayRef | `varchar` |
| createdAt | `timestamptz NOT NULL DEFAULT now()` |

## entitlements
| কলাম | টাইপ |
|---|---|
| id | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` |
| userId | `varchar NOT NULL` |
| feature | `varchar NOT NULL` |
| unlimited | `boolean NOT NULL DEFAULT false` |
| setBy | `varchar NOT NULL` |
| updatedAt | `timestamptz NOT NULL DEFAULT now()` |

## call_rates
| কলাম | টাইপ |
|---|---|
| hostId | `varchar PRIMARY KEY` |
| coinsPerMinute | `int NOT NULL` |

## calls
| কলাম | টাইপ |
|---|---|
| id | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` |
| callerId | `varchar NOT NULL` |
| hostId | `varchar NOT NULL` |
| rate | `int NOT NULL` |
| status | `varchar NOT NULL DEFAULT 'active'` |
| minutesBilled | `int NOT NULL DEFAULT 0` |
| startedAt | `timestamptz NOT NULL DEFAULT now()` |
| endedAt | `timestamptz` |
| endReason | `varchar` |

## system_state
| কলাম | টাইপ |
|---|---|
| id | `int PRIMARY KEY DEFAULT 1` |
| serverEnabled | `boolean NOT NULL DEFAULT true` |
| cardEnabled | `boolean NOT NULL DEFAULT true` |
| killedAt | `timestamptz` |
| resumeBy | `timestamptz` |
| changedBy | `varchar` |

## app_settings
| কলাম | টাইপ |
|---|---|
| key | `varchar PRIMARY KEY` |
| value | `int NOT NULL` |
| changedBy | `varchar` |

## banners
| কলাম | টাইপ |
|---|---|
| id | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` |
| title | `varchar NOT NULL` |
| imageUrl | `varchar NOT NULL` |
| linkUrl | `varchar` |
| active | `boolean NOT NULL DEFAULT true` |
| startsAt | `timestamptz` |
| endsAt | `timestamptz` |
| createdBy | `varchar NOT NULL` |
| createdAt | `timestamptz NOT NULL DEFAULT now()` |

## level_rules
| কলাম | টাইপ |
|---|---|
| level | `int PRIMARY KEY` |
| name | `varchar NOT NULL` |
| minGiftedCoins | `bigint NOT NULL` |

## level_overrides
| কলাম | টাইপ |
|---|---|
| userId | `varchar PRIMARY KEY` |
| level | `int NOT NULL` |
| setBy | `varchar NOT NULL` |

## moderation_reports
| কলাম | টাইপ |
|---|---|
| id | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` |
| reporterId | `varchar NOT NULL` |
| targetType | `varchar NOT NULL` |
| targetId | `varchar NOT NULL` |
| reason | `varchar NOT NULL` |
| status | `varchar NOT NULL DEFAULT 'open'` |
| resolvedBy | `varchar` |
| resolutionNote | `text` |
| createdAt | `timestamptz NOT NULL DEFAULT now()` |
| resolvedAt | `timestamptz` |

## moderation_access_log
| কলাম | টাইপ |
|---|---|
| id | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` |
| moderatorId | `varchar NOT NULL` |
| reportId | `varchar NOT NULL` |
| targetType | `varchar NOT NULL` |
| targetId | `varchar NOT NULL` |
| visibleToParticipants | `boolean NOT NULL DEFAULT true` |
| enteredAt | `timestamptz NOT NULL DEFAULT now()` |
| exitedAt | `timestamptz` |

## kyc_submissions
| কলাম | টাইপ |
|---|---|
| id | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` |
| userId | `varchar NOT NULL` |
| documents | `jsonb NOT NULL` |
| status | `varchar NOT NULL DEFAULT 'pending'` |
| reviewedBy | `varchar` |
| note | `text` |
| createdAt | `timestamptz NOT NULL DEFAULT now()` |
| reviewedAt | `timestamptz` |

## withdrawal_requests
| কলাম | টাইপ |
|---|---|
| id | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` |
| userId | `varchar NOT NULL` |
| ref | `varchar NOT NULL` |
| coins | `bigint NOT NULL` |
| amountUsd | `decimal(12` |
| method | `varchar NOT NULL` |
| destination | `jsonb NOT NULL` |
| status | `varchar NOT NULL DEFAULT 'pending'` |
| processedBy | `varchar` |
| note | `text` |
| createdAt | `timestamptz NOT NULL DEFAULT now()` |
| processedAt | `timestamptz` |
