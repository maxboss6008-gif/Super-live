# API চুক্তি (P3 অ্যাডমিন ও P4 মোবাইল যা ধরে নিয়েছে)
P1 ব্যাকএন্ডের রুট এর সাথে না মিললে হয় P1 বদলান, নয়তো
package-3-admin/src/api.js ও package-4-mobile/config.js-এর ROUTES বদলান।
সব রিকোয়েস্টে `Authorization: Bearer <accessToken>`।

## মোবাইল (P4), বেস: API_BASE = https://<server>/api
| মেথড | পাথ | রিকোয়েস্ট | সফল উত্তর |
|---|---|---|---|
| POST | /auth/register | {name,email,password} | {userId, totpSecret, otpauthUrl} — otpauthUrl দিয়ে QR বানিয়ে ইউজারকে দেখান |
| POST | /auth/login | {email,password,deviceId,code?} | {accessToken} অথবা নতুন ডিভাইস হলে {requiresTwoFactor:true, challengeId} |
| POST | /auth/2fa/verify | {challengeId,code} | {accessToken} |

deviceId: অ্যাপ প্রথমবার চালু হলে একটা random UUID বানিয়ে SecureStore/localStorage-এ রাখুন,
প্রতিটি লগইন রিকোয়েস্টে এটা পাঠান। পরিচিত ডিভাইস হলে ২FA ছাড়াই টোকেন দেয়; নতুন ডিভাইসে
প্রথমে challengeId আসবে, তারপর অথেনটিকেটরের কোড দিয়ে /auth/2fa/verify কল করলে টোকেন মিলবে।
| GET | /wallet | – | {balance, transactions:[{id,type,amount}]} |
ত্রুটি: 401 ভুল তথ্য/টোকেন, 409 ইমেইল আছে, 423/429 লক (Retry-After হেডারসহ), বডিতে {message}।

## অ্যাডমিন (P3), বেস: /api (ভাইট প্রক্সি → localhost:3000)
| মেথড | পাথ | উত্তর/কাজ |
|---|---|---|
| POST | /auth/admin/login | {email,password,code?} → {accessToken} |
| GET | /payments/transactions | তালিকা (অ্যারে বা {items}) |
| GET | /withdrawals?status=pending | তালিকা |
| POST | /withdrawals/:id/approve · /reject | reject-এ {reason} |
| GET | /fraud/cases | তালিকা |
| POST | /fraud/cases/:id/resolve | {note} |
| GET | /fraud/incident-reports | তালিকা (রিপোর্ট-ভিত্তিক পর্যালোচনা) |
| GET | /admin/server/status | স্ট্যাটাস JSON |
| POST | /admin/server/kill | {reason}; সর্বোচ্চ ২৪ ঘণ্টা |
অ্যাডমিন রুটে শুধু অ্যাডমিন রোল; প্রতিটি কাজ audit_log-এ।
