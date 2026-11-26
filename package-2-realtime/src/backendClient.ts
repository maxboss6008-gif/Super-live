// P1 ব্যাকএন্ডে কয়েন কাটা/মডারেশন লগ করার জন্য সার্ভার-টু-সার্ভার কল
const BASE = process.env.BACKEND_URL || "http://localhost:3000/api";

// P1 সংক্ষিপ্ত সময়ের জন্য সাড়া না দিলে (নেটওয়ার্ক গ্লিচ, রিস্টার্ট) ২ বার পর্যন্ত আবার চেষ্টা করে।
// P1 পুরোপুরি ডাউন বা দীর্ঘ সময় ধরে থাকলে এটা ব্যর্থ হয়েই যাবে — তখন ক্লায়েন্টের outbox
// (lib/outbox.js) নিজে থেকে পরে আবার চেষ্টা করবে, কারণ messageId/ref idempotent।
async function call(path: string, body: any, attempt = 1): Promise<any> {
  try {
    const res = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.SERVICE_TOKEN}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.message || `backend ${res.status}`), { status: res.status, data });
    return data;
  } catch (e: any) {
    const transient = !e.status || e.status >= 500; // নেটওয়ার্ক ত্রুটি বা 5xx-এই শুধু রিট্রাই, 400/401/403-এ না
    if (transient && attempt < 3) { await new Promise((r) => setTimeout(r, attempt * 300)); return call(path, body, attempt + 1); }
    throw e;
  }
}
export const backend = {
  chargeMessage: (senderId: string, messageId: string) => call("/billing/messages/charge", { senderId, messageId }),
  tickCall: (callId: string) => call("/calls/" + callId + "/tick", {}),
};
