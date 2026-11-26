// Notifies the P2 realtime server's /hooks/* endpoints. A failure here never blocks the main action (report/kill).
const RT = process.env.REALTIME_URL || "http://localhost:4000";
export async function notifyRealtime(path: string, body: any) {
  try {
    await fetch(RT + path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.SERVICE_TOKEN}` }, body: JSON.stringify(body) });
  } catch { /* P1 keeps working even if P2 is down */ }
}
