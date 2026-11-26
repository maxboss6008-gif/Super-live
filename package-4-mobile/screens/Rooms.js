import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, RefreshControl, TextInput } from "react-native";
import { useOnline } from "../lib/network";
import { cachedGet } from "../lib/cache";
import { fetchRooms } from "../lib/rooms";

/** লাইভ রুমের তালিকা — অডিও/ভিডিও, কতজন আছে, লক আছে কিনা দেখায়। ট্যাপ করলে রুমে ঢোকে। */
export default function Rooms({ token, onOpenRoom, onCreateRoom }) {
  const online = useOnline();
  const [rooms, setRooms] = useState(null); const [stale, setStale] = useState(false);
  const [refreshing, setRefreshing] = useState(false); const [err, setErr] = useState("");
  // লক করা রুমে ট্যাপ করলে এখানে পাসওয়ার্ড চাওয়া হয়; তালিকায় কখনো password আসে না (সার্ভার
  // সেটা পাঠায়ই না, নিরাপত্তার জন্য), তাই এখানে না চাইলে আর কোথাও জিজ্ঞেস করার সুযোগ নেই।
  const [pendingRoom, setPendingRoom] = useState(null); const [pw, setPw] = useState("");

  const load = useCallback(() => {
    cachedGet("rooms", () => fetchRooms(token))
      .then(({ data, stale }) => { setRooms(data); setStale(stale); setErr(""); })
      .catch((e) => setErr(e.message))
      .finally(() => setRefreshing(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (online) load(); }, [online, load]); // সংযোগ ফিরলে তালিকা রিফ্রেশ

  if (!rooms) return err ? <Text style={s.err}>{err}</Text> : <ActivityIndicator style={{ marginTop: 40 }} />;

  return (
    <View style={{ flex: 1 }}>
      {(!online || stale) && (
        <Text style={s.offline}>{!online ? "অফলাইন — " : ""}শেষ জানা তালিকা, সংযোগ ফিরলে রিফ্রেশ হবে</Text>
      )}
      <View style={s.createRow}>
        <Pressable style={[s.btn, !online && s.disabled]} disabled={!online} onPress={() => onCreateRoom("audio")}>
          <Text style={s.bt}>🎙️ অডিও রুম খুলুন</Text>
        </Pressable>
        <Pressable style={[s.btn, !online && s.disabled]} disabled={!online} onPress={() => onCreateRoom("video")}>
          <Text style={s.bt}>📹 ভিডিও রুম খুলুন</Text>
        </Pressable>
      </View>
      <FlatList
        data={rooms} keyExtractor={(r) => r.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={<Text style={s.empty}>এখন কোনো লাইভ রুম নেই — একটা খুলে শুরু করুন।</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={[s.row, !online && s.disabled]} disabled={!online}
            onPress={() => (item.locked ? setPendingRoom(item) : onOpenRoom(item))}
          >
            <Text style={s.rowTitle}>{item.kind === "audio" ? "🎙️" : "📹"} {item.locked ? "🔒 " : ""}রুম #{item.id.slice(0, 6)}</Text>
            <Text style={s.rowSub}>{item.count}/30 জন{item.blackout ? " · ব্ল্যাকআউট সক্রিয়" : ""}</Text>
          </Pressable>
        )}
      />
      {pendingRoom && (
        <View style={s.lockModal}>
          <View style={s.lockBox}>
            <Text style={s.rowTitle}>🔒 রুম #{pendingRoom.id.slice(0, 6)}-এর পাসওয়ার্ড</Text>
            <TextInput style={s.input} value={pw} onChangeText={setPw} placeholder="পাসওয়ার্ড লিখুন" secureTextEntry autoFocus />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <Pressable style={[s.btn, { flex: 1 }]} onPress={() => { onOpenRoom({ ...pendingRoom, password: pw }); setPendingRoom(null); setPw(""); }}>
                <Text style={s.bt}>ঢুকুন</Text>
              </Pressable>
              <Pressable style={[s.btn, s.cancelBtn, { flex: 1 }]} onPress={() => { setPendingRoom(null); setPw(""); }}>
                <Text style={s.bt}>বাতিল</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  createRow: { flexDirection: "row", gap: 8, padding: 12 },
  btn: { flex: 1, backgroundColor: "#e5254f", borderRadius: 10, padding: 12, alignItems: "center" },
  bt: { color: "#fff", fontWeight: "700" }, disabled: { opacity: 0.5 },
  row: { padding: 14, borderBottomWidth: 1, borderBottomColor: "#eee" },
  rowTitle: { fontSize: 16, fontWeight: "600" }, rowSub: { color: "#666", marginTop: 2 },
  empty: { textAlign: "center", marginTop: 40, color: "#666" },
  err: { color: "#b3261e", margin: 16 },
  offline: { backgroundColor: "#fff3cd", color: "#7a5b00", padding: 8, fontSize: 12 },
  lockModal: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 24 },
  lockBox: { backgroundColor: "#fff", borderRadius: 12, padding: 16 },
  input: { borderWidth: 1, borderColor: "#d9d3ea", borderRadius: 10, padding: 10, marginTop: 10 },
  cancelBtn: { backgroundColor: "#999" },
});
