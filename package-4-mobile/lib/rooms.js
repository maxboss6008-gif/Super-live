import { REALTIME_BASE } from "../config";

/** লাইভ রুমের তালিকা — P2-এর REST রুট থেকে (Socket.IO না, সাধারণ fetch, তাই offline cache-এও কাজ করে)। */
export async function fetchRooms(token) {
  const res = await fetch(`${REALTIME_BASE}/rooms`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) { const e = new Error(`রুমের তালিকা আনা যায়নি (${res.status})`); e.status = res.status; throw e; }
  return (await res.json()).rooms;
}
