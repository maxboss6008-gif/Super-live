// প্রোডাকশনে HTTPS/WSS URL দিন
export const API_BASE = "https://YOUR-SERVER/api";         // package-1-backend
export const REALTIME_BASE = "https://YOUR-REALTIME-SERVER"; // package-2-realtime (Socket.IO + REST /rooms)
export const ROUTES = { login: "/auth/login", register: "/auth/register", verify2fa: "/auth/2fa/verify", refresh: "/auth/refresh", wallet: "/wallet" };
