# e2e টেস্ট — এখন লেখা আছে (`test/e2e/auth.e2e-spec.ts`), এই ফাইলটা পুরনো প্রসঙ্গ হিসেবে রাখা

আপডেট: `test/e2e/auth.e2e-spec.ts` এখন আসল Postgres+Redis-এর বিপরীতে পুরো auth ফ্লো
(রেজিস্টার → নতুন ডিভাইস ২FA চ্যালেঞ্জ → ভেরিফাই → wallet → পরিচিত ডিভাইসে সরাসরি লগইন →
৫ বার ভুল পাসওয়ার্ডে লক) চালিয়ে দেখে। `.github/workflows/ci.yml`-এ postgres+redis service
container দিয়ে এটা এখন প্রতি push-এ স্বয়ংক্রিয়ভাবে চলে। নিচের বিবরণ পুরনো, প্রসঙ্গ হিসেবে রাখা হলো।

---

এই Jest টেস্টগুলো (wallet, calls, messages) ফেক/মক দিয়ে চলে, তাই দ্রুত কিন্তু আসল
Postgres/TypeORM আচরণ (unique index কনফ্লিক্ট, ট্রানজ্যাকশন আইসোলেশন, আসল lock) যাচাই করে না।

এই পরিবেশে আমি আসল Postgres বা Redis চালাতে পারি না (নেটওয়ার্ক বন্ধ), তাই আসল e2e টেস্ট
লিখতে পারিনি। নিজের মেশিনে এভাবে করুন:

1. `docker compose up -d` (postgres + redis চালু হবে, package-1-backend/docker-compose.yml দেখুন)
2. `npm run migration:run`
3. @nestjs/testing দিয়ে `Test.createTestingModule({ imports: [AppModule] })` বানিয়ে
   supertest দিয়ে /wallet, /payments/checkout, /moderation/reports ইত্যাদি আসল DB-এর
   বিপরীতে কল করুন।
4. প্রতিটি টেস্টের আগে/পরে টেবিল খালি করুন (TRUNCATE ... CASCADE)।
