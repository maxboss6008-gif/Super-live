import { useEffect, useRef, useState } from "react";
import { View, Text, FlatList, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { Room, RoomEvent, Track } from "livekit-client";
import { AudioSession, VideoTrack } from "@livekit/react-native";
import { joinRoom, leaveRoom, sendMessage, lockRoom, unlockRoom } from "../lib/realtime";
import { useOnline } from "../lib/network";

/**
 * একটা লাইভ রুমের ভেতরে: অংশগ্রহণকারীর তালিকা, টেক্সট চ্যাট (কয়েন-চার্জড), লক/আনলক (হোস্ট হলে),
 * ব্ল্যাকআউট নির্দেশক, আর LiveKit দিয়ে আসল অডিও/ভিডিও।
 *
 * ⚠️ জরুরি সতর্কতা: এই LiveKit অংশটা আমি এখানে লিখেছি কিন্তু কোনো ডিভাইস বা এমুলেটরে
 * চালিয়ে পরীক্ষা করতে পারিনি (এই পরিবেশে নেটিভ বিল্ড/নেটওয়ার্ক/ডিভাইস কিছুই নেই)। @livekit/react-native
 * ও livekit-client-এর API আমি প্রশিক্ষণ-জ্ঞান থেকে যতটা নির্ভুল সম্ভব লিখেছি, কিন্তু প্যাকেজ
 * ইনস্টলের পর এর ঠিক hook/prop নাম সামান্য আলাদা হতে পারে — প্রথমবার চালিয়ে কোনো import/API
 * এরর এলে সেটা আমাকে জানালে ঠিক করে দেব। এখন থেকে এই স্ক্রিন প্লেইন Expo Go-তে চলবে না —
 * নেটিভ মডিউল যোগ হয়েছে বলে `npx expo prebuild` + `eas build` (বা `expo run:android`) লাগবে।
 */
export default function RoomScreen({ socket, room, myUserId, onLeave }) {
  const online = useOnline();
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [blackout, setBlackout] = useState(false);
  const [locked, setLocked] = useState(room.locked);
  const [lockPw, setLockPw] = useState(""); const [showLockInput, setShowLockInput] = useState(false);
  const isHost = room.hostId === myUserId;
  const listRef = useRef(null);
  const [lkRoom, setLkRoom] = useState(null);
  const [lkStatus, setLkStatus] = useState("connecting"); // connecting | connected | failed | off
  const [micMuted, setMicMuted] = useState(false);
  const [camOn, setCamOn] = useState(room.kind === "video");
  const [remoteVideos, setRemoteVideos] = useState([]); // [{ sid, track }]

  // LiveKit দিয়ে আসল অডিও/ভিডিও সংযোগ — room.livekit (হোস্ট, create-এর সময় পাওয়া) অথবা
  // joinRoom()-এর ack.livekit (অন্য অংশগ্রহণকারী, নিচের দ্বিতীয় useEffect-এ বসানো) থেকে টোকেন নেয়।
  useEffect(() => {
    const info = room.livekit;
    if (!info?.token || !info?.url) return; // হোস্ট না হলে এখানে কিছু নেই, join ack থেকে আসবে
    connectLiveKit(info);
  }, [room.livekit]);

  async function connectLiveKit({ token, url }) {
    try {
      await AudioSession.startAudioSession(); // স্পিকার/ইয়ারপিস রাউটিং ঠিকভাবে সামলানোর জন্য
      const r = new Room({ adaptiveStream: true, dynacast: true });
      r.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        if (track.kind === Track.Kind.Video) setRemoteVideos((prev) => [...prev.filter((v) => v.sid !== participant.sid), { sid: participant.sid, track }]);
      });
      r.on(RoomEvent.TrackUnsubscribed, (_track, _pub, participant) => setRemoteVideos((prev) => prev.filter((v) => v.sid !== participant.sid)));
      r.on(RoomEvent.Disconnected, () => setLkStatus("off"));
      await r.connect(url, token);
      await r.localParticipant.setMicrophoneEnabled(true);
      if (room.kind === "video") await r.localParticipant.setCameraEnabled(true);
      setLkRoom(r); setLkStatus("connected");
    } catch (e) {
      console.warn("LiveKit সংযোগ ব্যর্থ:", e.message);
      setLkStatus("failed"); // অডিও/ভিডিও ছাড়াই চ্যাট চলতে থাকবে, পুরো স্ক্রিন আটকাবে না
    }
  }

  useEffect(() => {
    return () => { lkRoom?.disconnect(); AudioSession.stopAudioSession().catch(() => {}); };
  }, [lkRoom]);

  const toggleMic = async () => { if (!lkRoom) return; const next = !micMuted; await lkRoom.localParticipant.setMicrophoneEnabled(!next); setMicMuted(next); };
  const toggleCam = async () => { if (!lkRoom) return; const next = !camOn; await lkRoom.localParticipant.setCameraEnabled(next); setCamOn(next); };

  useEffect(() => {
    let mounted = true;
    joinRoom(socket, room.id, room.password)
      .then((ack) => {
        if (!mounted) return;
        setParticipants(ack.participants || []); setBlackout(!!ack.blackout);
        if (!room.livekit && ack.livekit) connectLiveKit(ack.livekit); // হোস্ট না হলে এখান থেকেই টোকেন আসে
      })
      .catch((e) => setErr(e.message));

    const onMsg = (m) => setMessages((prev) => [...prev, m]);
    const onJoin = ({ userId }) => setParticipants((prev) => (prev.find((p) => p.userId === userId) ? prev : [...prev, { userId }]));
    const onLeft = ({ userId }) => setParticipants((prev) => prev.filter((p) => p.userId !== userId));
    const onBlackout = ({ active }) => setBlackout(active);
    const onMod = ({ moderatorId }) => setMessages((prev) => [...prev, { system: true, text: `মডারেটর যুক্ত হয়েছেন (${moderatorId.slice(0, 6)})` }]);

    socket.on("room:message", onMsg);
    socket.on("room:participant_joined", onJoin);
    socket.on("room:participant_left", onLeft);
    socket.on("room:blackout", onBlackout);
    socket.on("room:moderator_joined", onMod);

    return () => {
      mounted = false;
      socket.off("room:message", onMsg); socket.off("room:participant_joined", onJoin);
      socket.off("room:participant_left", onLeft); socket.off("room:blackout", onBlackout); socket.off("room:moderator_joined", onMod);
      leaveRoom(socket);
    };
  }, [socket, room.id]);

  const send = async () => {
    const t = text.trim(); if (!t) return;
    setText("");
    try {
      const ack = await sendMessage(socket, t);
      if (ack.queued) setMessages((prev) => [...prev, { system: true, text: "অফলাইন — সংযোগ ফিরলে পাঠানো হবে" }]);
    } catch (e) { Alert.alert("মেসেজ পাঠানো যায়নি", e.message); } // সাধারণত কয়েন শেষ হলে এখানে ধরা পড়বে
  };

  const toggleLock = async () => {
    try {
      if (locked) { await unlockRoom(socket); setLocked(false); }
      else setShowLockInput(true); // Android/iOS দুটোতেই কাজ করবে এমন ইনপুট — নিচে ইনলাইন ফর্ম দেখুন
    } catch (e) { Alert.alert("ব্যর্থ", e.message); }
  };
  const confirmLock = async () => {
    try { await lockRoom(socket, lockPw); setLocked(true); setShowLockInput(false); setLockPw(""); }
    catch (e) { Alert.alert("লক করা যায়নি", e.message); }
  };

  if (blackout) {
    // স্পেক ৩.১: রেকর্ডিং চেষ্টা ধরা পড়লে স্ক্রিন কালো, কিন্তু চ্যাট/সংযোগ চলতে থাকে
    return (
      <View style={s.blackoutScreen}>
        <Text style={s.blackoutText}>স্ক্রিন সুরক্ষিত — রেকর্ডিং/স্ক্রিনশট চেষ্টা শনাক্ত হয়েছে</Text>
        <Pressable style={s.leaveBtnDark} onPress={onLeave}><Text style={s.bt}>রুম ছাড়ুন</Text></Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={s.header}>
        <Text style={s.title}>{room.kind === "audio" ? "🎙️" : "📹"} রুম #{room.id.slice(0, 6)} · {participants.length} জন</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {isHost && <Pressable style={s.smallBtn} onPress={toggleLock}><Text style={s.smallBt}>{locked ? "আনলক" : "লক"}</Text></Pressable>}
          <Pressable style={s.smallBtn} onPress={onLeave}><Text style={s.smallBt}>বের হন</Text></Pressable>
        </View>
      </View>
      {err ? <Text style={s.err}>{err}</Text> : null}

      {/* অডিও/ভিডিও নিয়ন্ত্রণ — lkStatus "failed" হলেও নিচের চ্যাট স্বাভাবিক চলবে */}
      <View style={s.avBar}>
        <Text style={s.avStatus}>
          {lkStatus === "connecting" && "🎙️ সংযুক্ত হচ্ছে…"}
          {lkStatus === "connected" && "🟢 লাইভ সংযুক্ত"}
          {lkStatus === "failed" && "⚠️ অডিও/ভিডিও সংযোগ ব্যর্থ — শুধু চ্যাট চলছে"}
        </Text>
        {lkStatus === "connected" && (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable style={s.smallBtn} onPress={toggleMic}><Text style={s.smallBt}>{micMuted ? "🔇 আনমিউট" : "🎙️ মিউট"}</Text></Pressable>
            {room.kind === "video" && (
              <Pressable style={s.smallBtn} onPress={toggleCam}><Text style={s.smallBt}>{camOn ? "📹 ক্যামেরা বন্ধ" : "📷 ক্যামেরা চালু"}</Text></Pressable>
            )}
          </View>
        )}
      </View>

      {/* ⚠️ এই ব্লকটাই সবচেয়ে বেশি অনিশ্চিত — VideoTrack কম্পোনেন্টের ঠিক prop-শেপ (trackRef বনাম
          সরাসরি track) প্যাকেজের ভার্সনভেদে বদলাতে পারে, আর আমি এটা ডিভাইসে চালিয়ে দেখতে পারিনি।
          `npm install`-এর পর TypeScript/এডিটর যদি এখানে টাইপ-এরর দেখায়, সেটাই স্বাভাবিক —
          তখন @livekit/react-native-এর বর্তমান README-এর উদাহরণ অনুযায়ী এই একটা ব্লক বদলে নিন। */}
      {room.kind === "video" && remoteVideos.length > 0 && (
        <View style={s.videoGrid}>
          {remoteVideos.map(({ sid, track }) => (
            <VideoTrack key={sid} trackRef={{ participant: { sid }, publication: null, source: Track.Source.Camera, track }} style={s.videoTile} />
          ))}
        </View>
      )}
      {showLockInput && (
        <View style={s.lockRow}>
          <TextInput style={s.input} value={lockPw} onChangeText={setLockPw} placeholder="লক পাসওয়ার্ড লিখুন" secureTextEntry />
          <Pressable style={s.sendBtn} onPress={confirmLock}><Text style={s.bt}>লক করুন</Text></Pressable>
        </View>
      )}
      <FlatList
        ref={listRef} data={messages} keyExtractor={(_, i) => String(i)}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) =>
          item.system
            ? <Text style={s.sysMsg}>{item.text}</Text>
            : <Text style={s.msg}><Text style={s.msgUser}>{item.userId === myUserId ? "আমি" : item.userId.slice(0, 6)}: </Text>{item.text}</Text>
        }
        contentContainerStyle={{ padding: 12 }}
      />
      <View style={s.inputRow}>
        <TextInput style={s.input} value={text} onChangeText={setText} placeholder={online ? "মেসেজ লিখুন…" : "অফলাইন — পাঠালে পরে যাবে"} onSubmitEditing={send} />
        <Pressable style={s.sendBtn} onPress={send}><Text style={s.bt}>পাঠান</Text></Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12, borderBottomWidth: 1, borderBottomColor: "#eee" },
  title: { fontWeight: "700", fontSize: 15 },
  smallBtn: { backgroundColor: "#ece8f6", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }, smallBt: { fontSize: 12, fontWeight: "600" },
  note: { fontSize: 11, color: "#888", textAlign: "center", paddingVertical: 4 },
  avBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 8, backgroundColor: "#f3f1f9" },
  avStatus: { fontSize: 12, color: "#444" },
  videoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4, padding: 4 },
  videoTile: { width: 120, height: 160, backgroundColor: "#000", borderRadius: 8 },
  msg: { marginBottom: 6, fontSize: 14 }, msgUser: { fontWeight: "700" },
  sysMsg: { fontSize: 12, color: "#888", fontStyle: "italic", textAlign: "center", marginBottom: 6 },
  lockRow: { flexDirection: "row", padding: 10, gap: 8 },
  inputRow: { flexDirection: "row", padding: 10, gap: 8, borderTopWidth: 1, borderTopColor: "#eee" },
  input: { flex: 1, borderWidth: 1, borderColor: "#d9d3ea", borderRadius: 10, paddingHorizontal: 12 },
  sendBtn: { backgroundColor: "#e5254f", borderRadius: 10, paddingHorizontal: 16, justifyContent: "center" },
  bt: { color: "#fff", fontWeight: "700" },
  err: { color: "#b3261e", padding: 8 },
  blackoutScreen: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center", padding: 24 },
  blackoutText: { color: "#fff", textAlign: "center", marginBottom: 20 },
  leaveBtnDark: { backgroundColor: "#e5254f", borderRadius: 10, padding: 12, paddingHorizontal: 20 },
});
