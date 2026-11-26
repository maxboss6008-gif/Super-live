import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = (name) => `cache:${name}`;

/** যেকোনো GET-এর ফলাফল লোকালে রাখে, আর সার্ভার না পেলে সেই পুরনো ফলাফলই (stale চিহ্নসহ) ফেরত দেয়। */
export async function cachedGet(name, fetcher) {
  try {
    const data = await fetcher();
    AsyncStorage.setItem(KEY(name), JSON.stringify({ data, at: Date.now() })).catch(() => {});
    return { data, stale: false };
  } catch (err) {
    const raw = await AsyncStorage.getItem(KEY(name));
    if (!raw) throw err; // সার্ভারও নেই, ক্যাশও নেই — এখন আর কিছু দেখানোর নেই
    const { data, at } = JSON.parse(raw);
    return { data, stale: true, cachedAt: at }; // পুরনো, কিন্তু অ্যাপ বন্ধ হয়ে যাবে না
  }
}
