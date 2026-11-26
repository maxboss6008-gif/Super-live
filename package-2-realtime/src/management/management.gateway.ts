import { Namespace } from "socket.io";
import { AuthUser, ADMIN_ROLES } from "../auth";
import { publicRoomList, clearAllRooms } from "../streaming/rooms";

/**
 * ম্যানেজমেন্ট/অ্যাডমিন ড্যাশবোর্ড ফাইল: পপুলার হাব (লাইভ রুমের তালিকা), ব্যানার/সার্ভার-স্ট্যাটাস
 * পুশ, আর মডারেটর-প্রবেশের প্রকাশ্য ঘোষণা (P1-এর রিপোর্ট-ভিত্তিক মডারেশন থেকে)।
 * এই ফাইল কোনো অডিও/ভিডিও সিগন্যাল বা রুমের বিষয়বস্তু ছোঁয় না — সেটা streaming.gateway.ts-এ।
 * এখানে কোনো গোপন/পরিচয়-লুকানো প্রবেশ নেই: মডারেটরের আইডি সবসময় ঘোষণায় থাকে।
 */
let mgmtNsp: Namespace | null = null;

export function registerManagement(nsp: Namespace) {
  mgmtNsp = nsp;
  nsp.on("connection", async (socket) => {
    const user = socket.data.user as AuthUser;
    if (!ADMIN_ROLES.has(user.role)) { socket.disconnect(true); return; }
    socket.emit("popular:update", await publicRoomList()); // প্রথম সংযোগে এখনকার তালিকা
  });
}

export async function onRoomsChanged() {
  if (mgmtNsp) mgmtNsp.emit("popular:update", await publicRoomList());
}

/** P1-এর /moderation/reports/:id/enter কল হলে এই ফাংশন ডাকুন (HTTP হুক, main.ts দেখুন)। */
export function announceModerationEntry(streamingNsp: Namespace, e: { roomId: string; moderatorId: string; visibleToParticipants: boolean }) {
  if (e.visibleToParticipants) streamingNsp.to(e.roomId).emit("room:moderator_joined", { moderatorId: e.moderatorId });
  mgmtNsp?.emit("moderation:entry", e); // অ্যাডমিন ড্যাশবোর্ড সবসময় দেখে, পরিচয় কখনো লুকানো হয় না
}

/** মালিকের মাস্টার কিল সুইচ (P1 /owner/kill)-এর ওয়েবহুক পেলে সব স্ট্রিমিং ক্লায়েন্ট ডিসকানেক্ট। */
export async function broadcastServerKill(streamingNsp: Namespace) {
  streamingNsp.emit("system:server_killed", { at: Date.now() });
  for (const s of streamingNsp.sockets.values()) s.disconnect(true);
  await clearAllRooms();
}
