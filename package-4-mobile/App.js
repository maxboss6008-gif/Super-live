import "./lib/livekitSetup";
import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, ActivityIndicator, SafeAreaView } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import { usePreventScreenCapture } from "expo-screen-capture";
import { API_BASE, REALTIME_BASE, ROUTES } from "./config";
import { getDeviceId } from "./lib/device";
import { useOnline } from "./lib/network";
import { cachedGet } from "./lib/cache";
import { connectStreaming, createRoom } from "./lib/realtime";
import Rooms from "./screens/Rooms";
import RoomScreen from "./screens/RoomScreen";

let token = null;
let refreshToken = null;

// অ্যাক্সেস টোকেন ১৫ মিনিটে মেয়াদ শেষ হয়ে যায় (ব্যাকএন্ডের ইচ্ছাকৃত নকশা)। ৪০১ পেলে
// একবার রিফ্রেশ-টোকেন দিয়ে নতুন টোকেন নিয়ে আবার চেষ্টা করা হয়, যাতে দীর্ঘ পরীক্ষার সময়
// ইউজারকে বারবার পাসওয়ার্ড+২FA দিয়ে ঢুকতে না হয়।
async function rawApi(path, method, body) {
  const res = await fetch(API_BASE + path, { method, headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.message || `ত্রুটি ${res.status}`); e.status = res.status; throw e; }
  return data;
}
async function api(path, method = "GET", body) {
  try { return await rawApi(path, method, body); }
  catch (e) {
    if (e.status !== 401 || !refreshToken) throw e;
    const r = await rawApi(ROUTES.refresh, "POST", { refreshToken });
    token = r.accessToken; refreshToken = r.refreshToken;
    await SecureStore.setItemAsync("token", token); await SecureStore.setItemAsync("refreshToken", refreshToken);
    return rawApi(path, method, body);
  }
}

/**
 * JWT-এর payload অংশ শুধু পড়ার জন্য (যাচাই না — সেটা সার্ভার করে); userId বের করতে।
 * `atob` ব্যবহার করা হয়নি, কারণ React Native-এর Hermes ইঞ্জিনে সব ভার্সনে এটা থাকে না
 * (এই পরিবেশে সরাসরি পরীক্ষা করে নিশ্চিত হতে পারিনি) — তাই নিজে base64url ডিকোড লেখা হলো।
 */
function base64UrlDecode(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/").padEnd(str.length + ((4 - (str.length % 4)) % 4), "=");
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let i = 0; i < b64.length; i += 4) {
    const [a, b, c, d] = [b64[i], b64[i + 1], b64[i + 2], b64[i + 3]].map((ch) => (ch === "=" || ch === undefined ? 0 : chars.indexOf(ch)));
    output += String.fromCharCode((a << 2) | (b >> 4));
    if (b64[i + 2] !== "=" && b64[i + 2] !== undefined) output += String.fromCharCode(((b & 15) << 4) | (c >> 2));
    if (b64[i + 3] !== "=" && b64[i + 3] !== undefined) output += String.fromCharCode(((c & 3) << 6) | d);
  }
  return output;
}
function decodeUserId(jwt) {
  try { return JSON.parse(base64UrlDecode(jwt.split(".")[1])).sub; } catch { return null; }
}

function Login({ onDone }) {
  const [f, setF] = useState({ email: "", password: "", code: "" });
  const [challenge, setChallenge] = useState(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      const d = challenge ? await api(ROUTES.verify2fa, "POST", { challengeId: challenge, code: f.code })
                          : await api(ROUTES.login, "POST", { email: f.email.trim(), password: f.password, deviceId: await getDeviceId() });
      if (d.requiresTwoFactor) setChallenge(d.challengeId); else onDone(d.accessToken, d.refreshToken);
    } catch (e) { setErr(e.status === 423 || e.status === 429 ? "অ্যাকাউন্ট সাময়িক লক আছে, পরে চেষ্টা করুন।" : e.message); }
    setBusy(false);
  };
  return (<View style={s.box}><Text style={s.h}>Super Live</Text>
    {!challenge ? <><TextInput style={s.in} placeholder="ইমেইল" autoCapitalize="none" keyboardType="email-address" value={f.email} onChangeText={(v) => setF({ ...f, email: v })} />
      <TextInput style={s.in} placeholder="পাসওয়ার্ড" secureTextEntry value={f.password} onChangeText={(v) => setF({ ...f, password: v })} /></>
    : <TextInput style={s.in} placeholder="৬ সংখ্যার কোড" keyboardType="number-pad" maxLength={6} value={f.code} onChangeText={(v) => setF({ ...f, code: v })} />}
    {!!err && <Text style={s.err}>{err}</Text>}
    <Pressable style={[s.btn, busy && { opacity: 0.6 }]} disabled={busy} onPress={submit}><Text style={s.bt}>{challenge ? "যাচাই করুন" : "লগইন"}</Text></Pressable></View>);
}

function Wallet({ onLogout }) {
  usePreventScreenCapture(); // Android FLAG_SECURE: স্ক্রিনশট/রেকর্ডিং ব্লক
  const online = useOnline();
  const [w, setW] = useState(null); const [stale, setStale] = useState(false); const [err, setErr] = useState("");

  const load = () => {
    cachedGet("wallet", () => api(ROUTES.wallet))
      .then(({ data, stale }) => { setW(data); setStale(stale); })
      .catch((e) => e.status === 401 ? onLogout() : setErr(e.message));
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (online) load(); }, [online]);

  if (err) return <Text style={s.err}>{err}</Text>;
  if (!w) return <ActivityIndicator style={{ marginTop: 40 }} />;
  return (<View style={{ flex: 1, padding: 16 }}>
    {(!online || stale) && (
      <Text style={s.offline}>
        {!online ? "অফলাইন — " : ""}শেষ জানা তথ্য দেখানো হচ্ছে{stale ? ", এখনো আপডেট হয়নি" : ""}। সংযোগ ফিরলে এমনিতেই রিফ্রেশ হবে।
      </Text>
    )}
    <Text style={s.h}>ওয়ালেট</Text><Text style={s.bal}>{w.balance} কয়েন</Text>
    <FlatList data={w.transactions || []} keyExtractor={(t, i) => String(t.id ?? i)} ListEmptyComponent={<Text>কোনো লেনদেন নেই।</Text>}
      renderItem={({ item }) => <Text style={s.row}>{item.type}  {item.amount}</Text>} />
    <Pressable style={[s.btn, !online && { opacity: 0.5 }]} disabled={!online} onPress={() => { /* গিফট/উইথড্রয়াল: অফলাইনে ব্যালেন্স নিশ্চিত না, তাই বন্ধ রাখা */ }}>
      <Text style={s.bt}>{online ? "গিফট পাঠান" : "অফলাইনে গিফট পাঠানো যাবে না"}</Text>
    </Pressable></View>);
}

export default function App() {
  const [ready, setReady] = useState(false); const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState("wallet");            // "wallet" | "rooms"
  const [activeRoom, setActiveRoom] = useState(null);   // রুমে ঢুকলে সেট হয়
  const [socket, setSocket] = useState(null);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    SecureStore.getItemAsync("token").then(async (t) => {
      token = t; refreshToken = await SecureStore.getItemAsync("refreshToken");
      if (t) setUserId(decodeUserId(t));
      setAuthed(!!t); setReady(true);
    });
  }, []);

  const done = async (t, rt) => {
    token = t; refreshToken = rt; setUserId(decodeUserId(t));
    await SecureStore.setItemAsync("token", t); if (rt) await SecureStore.setItemAsync("refreshToken", rt);
    setAuthed(true);
  };
  const out = async () => {
    socket?.disconnect(); setSocket(null); setActiveRoom(null);
    token = null; refreshToken = null;
    await SecureStore.deleteItemAsync("token"); await SecureStore.deleteItemAsync("refreshToken");
    setAuthed(false);
  };

  // "রুম" ট্যাবে প্রথমবার ঢুকলেই Socket.IO সংযোগ — পুরো সেশনে একটাই সংযোগ রাখা হয়
  useEffect(() => {
    if (tab === "rooms" && !socket && authed) setSocket(connectStreaming(REALTIME_BASE, token));
  }, [tab, authed]);

  const handleCreateRoom = async (kind) => {
    try { const ack = await createRoom(socket, kind); setActiveRoom({ id: ack.roomId, kind, hostId: userId, locked: false, livekit: ack.livekit }); }
    catch (e) { console.warn("রুম তৈরি ব্যর্থ:", e.message); }
  };

  if (!ready) return <ActivityIndicator style={{ marginTop: 80 }} />;

  let body;
  if (!authed) body = <Login onDone={done} />;
  else if (activeRoom) body = <RoomScreen socket={socket} room={activeRoom} myUserId={userId} onLeave={() => setActiveRoom(null)} />;
  else body = (
    <View style={{ flex: 1 }}>
      <View style={s.tabs}>
        <Pressable style={[s.tabBtn, tab === "wallet" && s.tabBtnOn]} onPress={() => setTab("wallet")}><Text style={s.tabText}>ওয়ালেট</Text></Pressable>
        <Pressable style={[s.tabBtn, tab === "rooms" && s.tabBtnOn]} onPress={() => setTab("rooms")}><Text style={s.tabText}>লাইভ রুম</Text></Pressable>
        <Pressable style={s.tabBtn} onPress={out}><Text style={s.tabText}>লগআউট</Text></Pressable>
      </View>
      {tab === "wallet"
        ? <Wallet onLogout={out} />
        : socket
          ? <Rooms token={token} onOpenRoom={(r) => setActiveRoom(r)} onCreateRoom={handleCreateRoom} />
          : <ActivityIndicator style={{ marginTop: 40 }} />}
    </View>
  );

  return <SafeAreaView style={{ flex: 1, backgroundColor: "#ece8f6" }}><StatusBar style="dark" />{body}</SafeAreaView>;
}

const s = StyleSheet.create({
  box: { flex: 1, justifyContent: "center", padding: 24 }, h: { fontSize: 28, fontWeight: "700", marginBottom: 16 },
  in: { backgroundColor: "#fff", borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#d9d3ea" },
  btn: { backgroundColor: "#e5254f", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 8 }, bt: { color: "#fff", fontWeight: "700" },
  err: { color: "#b3261e", marginBottom: 8 }, bal: { fontSize: 24, marginBottom: 12 }, row: { paddingVertical: 8 },
  offline: { backgroundColor: "#fff3cd", color: "#7a5b00", padding: 8, borderRadius: 8, marginBottom: 10, fontSize: 12 },
  tabs: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#eee" },
  tabBtn: { flex: 1, padding: 12, alignItems: "center" }, tabBtnOn: { borderBottomWidth: 2, borderBottomColor: "#e5254f" },
  tabText: { fontWeight: "600" },
});
