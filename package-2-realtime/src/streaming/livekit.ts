import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

/**
 * SFU হিসেবে LiveKit (ওপেন-সোর্স, সেলফ-হোস্টেবল: https://livekit.io) ব্যবহার করা হচ্ছে।
 * কারণ: ৩০ জনের ভিডিও/অডিও রুমের জন্য নিজে থেকে mediasoup/SFU লেখা মাস-কয়েক বড় একটা
 * আলাদা প্রজেক্ট — এটা এই ধাপে বাস্তবসম্মত না এবং আমি এখানে নেটওয়ার্ক ছাড়া সেটা চালিয়ে
 * পরীক্ষাও করতে পারতাম না। LiveKit ব্যবহার করলে মিডিয়া রাউটিং তাদের সার্ভার করে;
 * আমাদের Socket.IO (streaming.gateway.ts) শুধু রুম-পলিসি (লক, ব্ল্যাকআউট, বিলিং, চ্যাট) সামলায়।
 *
 * সেলফ-হোস্ট: https://docs.livekit.io/home/self-hosting/ (Docker ইমেজ আছে)
 * অথবা LiveKit Cloud (ম্যানেজড, ক্রেডিট কার্ড লাগবে)।
 */
const HOST = process.env.LIVEKIT_URL!;           // যেমন: wss://your-livekit.example.com
const API_KEY = process.env.LIVEKIT_API_KEY!;
const API_SECRET = process.env.LIVEKIT_API_SECRET!;

const rooms = new RoomServiceClient(HOST.replace("wss://", "https://").replace("ws://", "http://"), API_KEY, API_SECRET);

export async function ensureLiveKitRoom(roomId: string, maxParticipants: number) {
  try { await rooms.createRoom({ name: roomId, maxParticipants, emptyTimeout: 300 }); }
  catch { /* রুম আগে থেকে থাকলে LiveKit ত্রুটি দেয়; সেটা উপেক্ষা করা নিরাপদ */ }
}

/** ক্লায়েন্ট এই টোকেন নিয়ে LiveKit client SDK (livekit-client) দিয়ে সরাসরি LiveKit সার্ভারে কানেক্ট করে। */
export async function mintJoinToken(roomId: string, userId: string, role: "host" | "speaker" | "listener") {
  const at = new AccessToken(API_KEY, API_SECRET, { identity: userId, ttl: "10m" });
  at.addGrant({ room: roomId, roomJoin: true, canPublish: role !== "listener", canSubscribe: true });
  return { token: await at.toJwt(), url: HOST };
}

export async function kickFromLiveKit(roomId: string, userId: string) {
  try { await rooms.removeParticipant(roomId, userId); } catch { /* আগে থেকেই বেরিয়ে গেলে ঠিক আছে */ }
}
