import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

async function uuidFallback() {
  // randomUUID() না থাকলেও (পুরনো Expo SDK) getRandomBytesAsync দিয়ে ক্রিপ্টোগ্রাফিকভাবে
  // নিরাপদ র‍্যান্ডম বাইট থেকে UUID বানানো হয় — Math.random() ব্যবহার করা হয় না, কারণ
  // deviceId এই অ্যাপে নিরাপত্তা-সম্পর্কিত (নতুন ডিভাইসে ২FA বাধ্যতামূলক করার ভিত্তি)।
  const bytes = await Crypto.getRandomBytesAsync(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

/** প্রতিটি ডিভাইসের জন্য একবার বানানো, SecureStore-এ স্থায়ীভাবে রাখা আইডি।
 *  সার্ভার এটা দিয়ে বোঝে এটা "পরিচিত" ডিভাইস কিনা (নতুন ডিভাইসে ২FA বাধ্যতামূলক)। */
export async function getDeviceId() {
  let id = await SecureStore.getItemAsync("deviceId");
  if (!id) {
    try { id = Crypto.randomUUID(); } catch { id = await uuidFallback(); }
    await SecureStore.setItemAsync("deviceId", id);
  }
  return id;
}
