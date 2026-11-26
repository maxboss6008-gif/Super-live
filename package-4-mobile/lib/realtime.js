import { io } from "socket.io-client";
import { flush } from "./outbox";

/**
 * সার্ভার ডাউন বা নেট বিচ্ছিন্ন হলেও socket.io-client নিজে থেকেই পুনরায় সংযোগ চেষ্টা করে
 * (exponential backoff)। আমরা শুধু reconnect হলে পেন্ডিং আউটবক্স ফ্লাশ করি।
 *
 * events: { onMessage, onParticipantJoined, onParticipantLeft, onBlackout, onModeratorJoined }
 * — যেগুলো দরকার নেই, বাদ দিলেও চলবে।
 */
export function connectStreaming(baseUrl, token, events = {}) {
  const socket = io(`${baseUrl}/streaming`, {
    auth: { token },
    reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 15000, randomizationFactor: 0.5,
  });
  socket.on("connect", async () => {
    const { sent, remaining } = await flush((item) => new Promise((resolve, reject) => {
      socket.emit(item.type, item.payload, (ack) => (ack?.error ? reject(new Error(ack.error)) : resolve(ack)));
    }));
    if (sent) console.log(`সংযোগ ফিরেছে: ${sent} পেন্ডিং পাঠানো হলো, ${remaining} এখনো বাকি`);
  });
  if (events.onMessage) socket.on("room:message", events.onMessage);
  if (events.onParticipantJoined) socket.on("room:participant_joined", events.onParticipantJoined);
  if (events.onParticipantLeft) socket.on("room:participant_left", events.onParticipantLeft);
  if (events.onBlackout) socket.on("room:blackout", events.onBlackout);
  if (events.onModeratorJoined) socket.on("room:moderator_joined", events.onModeratorJoined);
  return socket;
}

/** রুম তৈরি — ack-এ roomId (আর LiveKit কনফিগার থাকলে livekit token/url) পাওয়া যাবে। */
export function createRoom(socket, kind) {
  return new Promise((resolve, reject) => socket.emit("room:create", { kind }, (ack) => (ack?.error ? reject(new Error(ack.error)) : resolve(ack))));
}

/** রুমে যোগ দেওয়া — লক থাকলে password দিতে হবে। */
export function joinRoom(socket, roomId, password) {
  return new Promise((resolve, reject) => socket.emit("room:join", { roomId, password }, (ack) => (ack?.error ? reject(new Error(ack.error)) : resolve(ack))));
}

export function leaveRoom(socket) { socket.emit("room:leave"); }
export function lockRoom(socket, password) {
  return new Promise((resolve, reject) => socket.emit("room:lock", { password }, (ack) => (ack?.error ? reject(new Error(ack.error)) : resolve(ack))));
}
export function unlockRoom(socket) {
  return new Promise((resolve, reject) => socket.emit("room:unlock", {}, (ack) => (ack?.error ? reject(new Error(ack.error)) : resolve(ack))));
}

/**
 * চ্যাট মেসেজ পাঠানো। অনলাইনে থাকলে সরাসরি পাঠায় (ack-এ কয়েন কাটা হয়েছে কিনা জানা যাবে)।
 * সংযোগ না থাকলে outbox-এ queue হয়ে থাকে, পরে সংযোগ ফিরলে connectStreaming নিজে থেকেই পাঠাবে —
 * messageId স্থির রাখা হয়েছে বলে সার্ভারে দ্বিতীয়বার কয়েন কাটবে না।
 */
export async function sendMessage(socket, text) {
  const messageId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  if (!socket.connected) { const { enqueue } = await import("./outbox"); await enqueue({ type: "room:message", payload: { text, messageId } }); return { queued: true, messageId }; }
  return new Promise((resolve, reject) => socket.emit("room:message", { text, messageId }, (ack) => (ack?.error ? reject(new Error(ack.error)) : resolve(ack))));
}
