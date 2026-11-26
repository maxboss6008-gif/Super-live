# TRD — Technical Requirements Document

## আর্কিটেকচার (সংক্ষেপে)
```
মোবাইল (Expo RN) ─┐                         ┌─ Postgres
                   ├─ package-1-backend ─────┤
অ্যাডমিন (React) ──┘  (NestJS, REST, JWT)    └─ Redis (rate-limit, ২FA চ্যালেঞ্জ, রিফ্রেশ টোকেন)
         │
         └─ package-2-realtime (Socket.IO + Express)
                │
                ├─ src/streaming/  → রুম-স্টেট (Redis), চ্যাট রিলে, LiveKit টোকেন
                ├─ src/management/ → পপুলার হাব, মডারেশন ঘোষণা, কিল-সুইচ সম্প্রচার
                └─ LiveKit SFU (সেলফ-হোস্ট বা Cloud) → আসল অডিও/ভিডিও মিডিয়া
```
P1 ও P2 সরাসরি একে অপরকে সার্ভার-টু-সার্ভার কল করে (`SERVICE_TOKEN` দিয়ে): P2 মেসেজ পাঠানোর
সময় P1-কে কয়েন কাটতে বলে; P1 মডারেশন/কিল-সুইচের সময় P2-কে ওয়েবহুক পাঠায়।

## টেক স্ট্যাক
| প্যাকেজ | স্ট্যাক |
|---|---|
| P1 backend | NestJS, TypeORM, PostgreSQL, Redis (ioredis), JWT, bcryptjs, otplib (TOTP), @nestjs/throttler |
| P2 realtime | Socket.IO v4 (+Redis adapter), Express, livekit-server-sdk |
| P3 admin | React 18, Vite, কোনো UI লাইব্রেরি ছাড়া |
| P4 mobile | Expo/React Native, socket.io-client, livekit-client + @livekit/react-native |

## অথেন্টিকেশন ডিজাইন
- অ্যাক্সেস টোকেন JWT, ১৫ মিনিট মেয়াদ
- রিফ্রেশ টোকেন: Redis-এ, ৩০ দিন, ব্যবহারের পর রোটেট (reuse হলে আটকে যায়)
- নতুন ডিভাইসে TOTP ২FA বাধ্যতামূলক; পরিচিত ডিভাইসে না
- ৫ বার ভুল পাসওয়ার্ডে লক (৩০ মিনিট → ২৪ ঘণ্টা পুনরাবৃত্তিতে)
- `/auth/*`-এ রেট-লিমিট: লগইন ১০/মিনিট, রেজিস্ট্রেশন ৫/ঘণ্টা (প্রতি IP)

## পেমেন্ট গেটওয়ে
`PaymentGateway` ইন্টারফেস (createCheckout, verifyWebhook, refund)। এখন দুটো বাস্তবায়ন:
`MockGateway` (ডেভ) ও `StripeGateway` (বাস্তব প্যাটার্নের রেফারেন্স — Al Rajhi না, কারণ তাদের
আসল API স্পেসিফিকেশন নেই)। `PAYMENT_GATEWAY` env দিয়ে সুইচ হয়।

## রিয়েলটাইম/মিডিয়া
- রুম-মেম্বারশিপ ও মেটাডেটা: Redis হ্যাশ (মাল্টি-ইনস্ট্যান্স-সেফ)
- চ্যাট রিলে: Socket.IO রুম ব্রডকাস্ট
- মিডিয়া: LiveKit (SFU) — P2 শুধু জয়েন-টোকেন ইস্যু করে, মিডিয়া রাউটিং LiveKit সার্ভার করে

## CI/CD
`.github/workflows/ci.yml` — প্রতিটা প্যাকেজের typecheck/lint/audit; backend জবে আসল
Postgres+Redis service container দিয়ে e2e টেস্ট। `eas-build.yml` — EXPO_TOKEN সিক্রেট
দিলে Android APK বিল্ড।

## জানা সীমাবদ্ধতা
docs/SECURITY_AUDIT.md ও docs/FAULT_TOLERANCE.md-এ বিস্তারিত। সংক্ষেপে: npm audit/SAST
টুল কখনো এই কোডের বিপরীতে চালানো হয়নি (লেখার পরিবেশে নেটওয়ার্ক ছিল না); LiveKit
অডিও/ভিডিও কোনো আসল ডিভাইসে পরীক্ষিত না।
