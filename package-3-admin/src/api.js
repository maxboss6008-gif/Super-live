// P1 ব্যাকএন্ডের রুটের সাথে মিলিয়ে নিন (শুধু এই ফাইলে বদলাতে হবে)
export const ROUTES = {
  login: "/api/auth/admin/login",
  verify2fa: "/api/auth/2fa/verify",
  transactions: "/api/payments/transactions",
  withdrawals: "/api/withdrawals?status=pending",
  withdrawalAction: (id, a) => `/api/withdrawals/${id}/${a}`,
  fraudCases: "/api/fraud/cases",
  fraudResolve: (id) => `/api/fraud/cases/${id}/resolve`,
  incidents: "/api/fraud/incident-reports",
  serverStatus: "/api/admin/server/status",
  serverKill: "/api/admin/server/kill",
};
let token = sessionStorage.getItem("adm") || "";
export const setToken = (t) => { token = t; t ? sessionStorage.setItem("adm", t) : sessionStorage.removeItem("adm"); };
export const hasToken = () => !!token;
export async function api(path, method = "GET", body) {
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) setToken("");
  if (!res.ok) throw new Error(data.message || `ত্রুটি ${res.status}`);
  return data;
}

export function getDeviceId() {
  let id = localStorage.getItem("deviceId");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("deviceId", id); }
  return id;
}
