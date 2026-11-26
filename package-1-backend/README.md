# Package 1 – Backend (ধাপ ১)
docker compose up -d && cp .env.example .env && npm install && npm run start:dev
## ডাটাবেজ মাইগ্রেশন (synchronize এখন সবসময় বন্ধ)
প্রথমবার: npm run migration:run  (src/migrations/1700000000000-Init.ts চালাবে)
নতুন এনটিটি/কলাম যোগ করলে: npm run migration:generate -- src/migrations/<নাম>  তারপর migration:run
⚠️ আমি Init মাইগ্রেশনটা এনটিটি থেকে হাতে লিখেছি, কোনো আসল Postgres-এর বিপরীতে চালিয়ে দেখিনি।
প্রথমবার স্টেজিং ডাটাবেজে চালিয়ে কলাম/টাইপ মিলছে কিনা যাচাই করুন।
অ্যাডমিন বানাতে: ইউজার রেজিস্টার করে DB-তে role='admin' বা 'super_admin' করুন।
