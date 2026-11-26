import "dotenv/config";
import http from "http";
import express from "express";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { verifyToken } from "./auth";
import { publicRoomList } from "./streaming/rooms";
import { registerStreaming } from "./streaming/streaming.gateway";
import { registerManagement, announceModerationEntry, broadcastServerKill } from "./management/management.gateway";

const app = express(); app.use(express.json());
const httpServer = http.createServer(app);
// প্রোডাকশনে "*" বিপজ্জনক — যেকোনো ওয়েবসাইট থেকে সংযোগ নিতে পারবে। ALLOWED_ORIGIN
// (কমা দিয়ে আলাদা করা) দিলে শুধু সেগুলো অনুমতি পাবে; না দিলে ডেভ-সুবিধার জন্য "*" (শুধু ডেভে ব্যবহার করুন)।
const allowedOrigins = process.env.ALLOWED_ORIGIN?.split(",").map((s) => s.trim());
const io = new Server(httpServer, { cors: { origin: allowedOrigins || "*" } });

const pub = new Redis(process.env.REDIS_URL!); const sub = pub.duplicate();
io.adapter(createAdapter(pub, sub)); // একাধিক ইনস্ট্যান্সে রুম-ইভেন্ট সমন্বয়ের জন্য

function authMiddleware(socket: any, next: any) {
  try { socket.data.user = verifyToken(socket.handshake.auth?.token || ""); next(); }
  catch { next(new Error("অননুমোদিত")); }
}

// দুটি প্রধান অংশ: /streaming (অডিও/ভিডিও) ও /management (অ্যাডমিন ড্যাশবোর্ড ও পলিসি)
const streamingNsp = io.of("/streaming"); streamingNsp.use(authMiddleware); registerStreaming(streamingNsp);
const managementNsp = io.of("/management"); managementNsp.use(authMiddleware); registerManagement(managementNsp);

// যেকোনো লগইন-করা ব্যবহারকারী লাইভ রুমের তালিকা দেখতে পারবেন (অ্যাডমিন না হলেও) —
// /management Socket.IO namespace শুধু অ্যাডমিনদের জন্য, তাই মোবাইল অ্যাপের জন্য এই সাধারণ REST রুট।
app.get("/rooms", (req, res) => {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) return res.sendStatus(401);
  try { verifyToken(h.slice(7)); } catch { return res.sendStatus(401); }
  publicRoomList().then((list) => res.json({ rooms: list })).catch(() => res.status(500).json({ message: "রুমের তালিকা আনা যায়নি" }));
});

// P1 ব্যাকএন্ড থেকে সার্ভার-টু-সার্ভার হুক (মডারেশন প্রবেশ, মাস্টার কিল)
app.post("/hooks/moderation-entry", (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.SERVICE_TOKEN}`) return res.sendStatus(401);
  announceModerationEntry(streamingNsp, req.body); res.json({ ok: true });
});
app.post("/hooks/server-kill", async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.SERVICE_TOKEN}`) return res.sendStatus(401);
  await broadcastServerKill(streamingNsp); res.json({ ok: true });
});

// Bind explicitly to 0.0.0.0 so platforms like Render can route external traffic in.
httpServer.listen(Number(process.env.PORT) || 4000, "0.0.0.0");
