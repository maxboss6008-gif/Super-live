import { Namespace, Socket } from "socket.io";
import { AuthUser } from "../auth";
import { createRoom, MAX_PARTICIPANTS, getRoom, setLock, setBlackout, addMember, removeMember, getMember, allMembers } from "./rooms";
import { backend } from "../backendClient";
import { onRoomsChanged } from "../management/management.gateway";
import { ensureLiveKitRoom, mintJoinToken } from "./livekit";

/**
 * The live-streaming file — creating/joining audio-video rooms, the 30-person
 * limit, lock boards, WebRTC signal relay (mesh for small rooms; use the LiveKit SFU for
 * large rooms, see livekit.ts), the protective blackout, and coin-charged messaging. Room
 * state now lives in Redis (rooms.ts), so this can run across multiple P2 instances. This
 * file makes no admin/policy decisions — those live in management.gateway.ts.
 */
export function registerStreaming(nsp: Namespace) {
  nsp.on("connection", (socket: Socket) => {
    const user = (socket.data.user as AuthUser);

    socket.on("room:create", async ({ kind }: { kind: "audio" | "video" }, ack: Function) => {
      const room = await createRoom(user.sub, kind);
      socket.join(room.id); socket.data.roomId = room.id;
      await onRoomsChanged();
      if (process.env.LIVEKIT_URL) await ensureLiveKitRoom(room.id, MAX_PARTICIPANTS);
      const live = process.env.LIVEKIT_URL ? await mintJoinToken(room.id, user.sub, "host") : null;
      ack?.({ roomId: room.id, livekit: live });
    });

    socket.on("room:join", async ({ roomId, password }: { roomId: string; password?: string }, ack: Function) => {
      const room = await getRoom(roomId);
      if (!room) return ack?.({ error: "রুম পাওয়া যায়নি" });
      if (room.locked && room.password !== password) return ack?.({ error: "ভুল পাসওয়ার্ড" });
      const count = (await allMembers(roomId)).length;
      if (count >= MAX_PARTICIPANTS) return ack?.({ error: "রুম পূর্ণ (সর্বোচ্চ ৩০ জন)" });
      await addMember(roomId, { userId: user.sub, socketId: socket.id, role: "listener", roundFrame: "default" });
      socket.join(roomId); socket.data.roomId = roomId;
      nsp.to(roomId).emit("room:participant_joined", { userId: user.sub });
      await onRoomsChanged();
        // LiveKit handles the audio/video media for up to 30 people; here we only issue the join token.
      const live = process.env.LIVEKIT_URL ? await mintJoinToken(roomId, user.sub, "listener") : null;
      ack?.({ ok: true, blackout: room.blackout, participants: await allMembers(roomId), livekit: live });
    });

    socket.on("room:leave", () => leaveCurrentRoom(nsp, socket));
    socket.on("disconnect", () => leaveCurrentRoom(nsp, socket));

    // Spec 1.5.2 / 5.2 — only the host may lock/unlock their own room
    socket.on("room:lock", async ({ password }: { password: string }, ack: Function) => {
      const room = await getRoom(socket.data.roomId);
      if (!room || room.hostId !== user.sub) return ack?.({ error: "অনুমতি নেই" });
      await setLock(room.id, true, password);
      await onRoomsChanged(); ack?.({ ok: true });
    });
    socket.on("room:unlock", async (_: any, ack: Function) => {
      const room = await getRoom(socket.data.roomId);
      if (!room || room.hostId !== user.sub) return ack?.({ error: "অনুমতি নেই" });
      await setLock(room.id, false, null);
      await onRoomsChanged(); ack?.({ ok: true });
    });

    // Spec 3.1 — the client detects a recording/screenshot attempt and reports it here
    socket.on("room:blackout", async ({ active }: { active: boolean }) => {
      const room = await getRoom(socket.data.roomId); if (!room) return;
      await setBlackout(room.id, active);
      nsp.to(room.id).emit("room:blackout", { active }); // host and user can still see each other, only the screen goes black (client-side)
    });

    // WebRTC mesh signaling (small rooms, legacy path) — the Socket.IO Redis adapter routes socketId across the cluster.
    socket.on("rtc:signal", async ({ toUserId, data }: { toUserId: string; data: any }) => {
      const target = await getMember(socket.data.roomId, toUserId);
      if (target?.socketId) nsp.to(target.socketId).emit("rtc:signal", { fromUserId: user.sub, data });
    });

    // Coin-charged messaging — the actual deduction happens in P1's billing service, keyed by an idempotent messageId
    socket.on("room:message", async ({ text, messageId }: { text: string; messageId: string }, ack: Function) => {
      const room = await getRoom(socket.data.roomId); if (!room) return ack?.({ error: "রুমে নেই" });
      try {
        const bill = await backend.chargeMessage(user.sub, messageId);
        nsp.to(room.id).emit("room:message", { userId: user.sub, text, messageId, charged: bill.charged ?? 0 });
        ack?.({ ok: true, ...bill });
      } catch (e: any) {
        ack?.({ error: e.data?.message || "কয়েন যথেষ্ট নয়" }); // Once the free quota is used and coins run out, the message cannot be sent
      }
    });
  });
}

async function leaveCurrentRoom(nsp: Namespace, socket: Socket) {
  const roomId = socket.data.roomId; if (!roomId) return;
  const user = socket.data.user as AuthUser;
  const left = await removeMember(roomId, user.sub);
  nsp.to(roomId).emit("room:participant_left", { userId: user.sub });
  if (left === 0) nsp.in(roomId).socketsLeave(roomId);
  await onRoomsChanged();
}
