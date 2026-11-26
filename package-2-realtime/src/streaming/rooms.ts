import { randomUUID } from "crypto";
import { redis } from "../redis";

export const MAX_PARTICIPANTS = 30;
export interface Participant { userId: string; socketId: string; role: "host" | "speaker" | "listener"; roundFrame: string; }
export interface RoomMeta { id: string; hostId: string; kind: "audio" | "video"; locked: boolean; password: string | null; blackout: boolean; createdAt: number; }

// Redis-ভিত্তিক স্টোর: একাধিক P2 ইনস্ট্যান্স একই রুম-স্টেট শেয়ার করে।
// room:{id}            hash  -> RoomMeta (JSON মান হিসেবে বুলিয়ান/সংখ্যা স্ট্রিং করে রাখা)
// room:{id}:members    hash  -> userId -> Participant (JSON)
// rooms:index          set   -> সক্রিয় রুম আইডি
const metaKey = (id: string) => `room:${id}`;
const membersKey = (id: string) => `room:${id}:members`;
const INDEX = "rooms:index";

function toMeta(h: Record<string, string>, id: string): RoomMeta {
  return { id, hostId: h.hostId, kind: h.kind as any, locked: h.locked === "1", password: h.password || null, blackout: h.blackout === "1", createdAt: Number(h.createdAt) };
}

export async function createRoom(hostId: string, kind: "audio" | "video"): Promise<RoomMeta> {
  const id = randomUUID();
  const meta: RoomMeta = { id, hostId, kind, locked: false, password: null, blackout: false, createdAt: Date.now() };
  await redis.hset(metaKey(id), { hostId, kind, locked: "0", password: "", blackout: "0", createdAt: String(meta.createdAt) });
  await redis.sadd(INDEX, id);
  await addMember(id, { userId: hostId, socketId: "", role: "host", roundFrame: "default" });
  return meta;
}

export async function getRoom(id: string): Promise<RoomMeta | null> {
  const h = await redis.hgetall(metaKey(id));
  return Object.keys(h).length ? toMeta(h, id) : null;
}

export async function setLock(id: string, locked: boolean, password: string | null) {
  await redis.hset(metaKey(id), { locked: locked ? "1" : "0", password: password || "" });
}

export async function setBlackout(id: string, active: boolean) {
  await redis.hset(metaKey(id), { blackout: active ? "1" : "0" });
}

export async function addMember(id: string, p: Participant) {
  await redis.hset(membersKey(id), p.userId, JSON.stringify(p));
}

export async function removeMember(id: string, userId: string) {
  await redis.hdel(membersKey(id), userId);
  const left = await redis.hlen(membersKey(id));
  if (left === 0) { await redis.del(metaKey(id), membersKey(id)); await redis.srem(INDEX, id); }
  return left;
}

export async function getMember(id: string, userId: string): Promise<Participant | null> {
  const v = await redis.hget(membersKey(id), userId);
  return v ? JSON.parse(v) : null;
}

export async function memberCount(id: string) { return redis.hlen(membersKey(id)); }
export async function allMembers(id: string): Promise<Participant[]> {
  const v = await redis.hvals(membersKey(id));
  return v.map((x) => JSON.parse(x));
}

export async function publicRoomList() {
  const ids = await redis.smembers(INDEX);
  const out = [] as any[];
  for (const id of ids) { // ছোট স্কেলের জন্য যথেষ্ট; বড় স্কেলে pipeline ব্যবহার করুন
    const meta = await getRoom(id); if (!meta) continue;
    out.push({ id: meta.id, hostId: meta.hostId, kind: meta.kind, locked: meta.locked, blackout: meta.blackout, count: await memberCount(id) });
  }
  return out;
}

export async function clearAllRooms() {
  const ids = await redis.smembers(INDEX);
  for (const id of ids) await redis.del(metaKey(id), membersKey(id));
  await redis.del(INDEX);
}
