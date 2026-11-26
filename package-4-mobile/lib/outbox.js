import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "outbox:v1";

/**
 * অফলাইনে করা কাজের সারি। শুধু "নিরাপদ, আইডেম্পোটেন্ট" কাজ এখানে রাখুন —
 * যেমন চ্যাট মেসেজ (নিজস্ব messageId সহ, সার্ভার দ্বিতীয়বার কাটে না)।
 * কয়েন গিফট/উইথড্রয়ালের মতো তাৎক্ষণিক ব্যালেন্স-নির্ভর কাজ এখানে রাখবেন না —
 * অফলাইনে ব্যালেন্স সঠিক কিনা নিশ্চিত করা যায় না, তাই ওগুলো অনলাইন না হলে বাটন ডিজেবল রাখুন।
 */
async function readAll() { const raw = await AsyncStorage.getItem(KEY); return raw ? JSON.parse(raw) : []; }
async function writeAll(items) { await AsyncStorage.setItem(KEY, JSON.stringify(items)); }

export async function enqueue(item) {
  const items = await readAll();
  items.push({ ...item, id: item.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`, createdAt: Date.now() });
  await writeAll(items);
}

export async function size() { return (await readAll()).length; }

/** send(item) সার্ভারে পাঠানোর ফাংশন — ব্যর্থ হলে সেই আইটেম সারিতেই থেকে যায়, বাকিগুলো চেষ্টা হয়। */
export async function flush(send) {
  const items = await readAll();
  if (!items.length) return { sent: 0, remaining: 0 };
  const remaining = [];
  let sent = 0;
  for (const item of items) {
    try { await send(item); sent++; } catch { remaining.push(item); } // নেটওয়ার্ক আবার গেলে পরেরবার আবার চেষ্টা হবে
  }
  await writeAll(remaining);
  return { sent, remaining: remaining.length };
}
