import { useEffect, useState, useCallback } from "react";
import { api, ROUTES, setToken, hasToken, getDeviceId } from "./api.js";

const css = `body{margin:0;font-family:system-ui,sans-serif;background:#f3f1f9;color:#1d1830}
.bar{display:flex;gap:.5rem;flex-wrap:wrap;padding:.75rem 1rem;background:#fff;border-bottom:1px solid #d9d3ea}
button{font:inherit;padding:.45rem .8rem;border:0;border-radius:8px;background:#e5254f;color:#fff;cursor:pointer}
button.ghost{background:#ece8f6;color:#1d1830}button.on{background:#1d1830;color:#fff}
main{padding:1rem;overflow-x:auto}table{border-collapse:collapse;width:100%;background:#fff}
th,td{padding:.5rem .7rem;border-bottom:1px solid #eee;text-align:left;font-size:.9rem}
.err{color:#b3261e;margin:.5rem 0}.card{background:#fff;padding:1rem;border-radius:12px;max-width:26rem;margin:10vh auto}
input{font:inherit;padding:.6rem;width:100%;box-sizing:border-box;margin:.3rem 0 .8rem;border:1.5px solid #d9d3ea;border-radius:8px}`;

function Table({ rows, actions }) {
  if (!rows.length) return <p>কোনো তথ্য নেই।</p>;
  const cols = Object.keys(rows[0]).filter((k) => typeof rows[0][k] !== "object");
  return (<table><thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}{actions && <th />}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={r.id ?? i}>{cols.map((c) => <td key={c}>{String(r[c])}</td>)}
      {actions && <td>{actions(r)}</td>}</tr>)}</tbody></table>);
}

function List({ url, actions, reload }) {
  const [rows, setRows] = useState([]); const [err, setErr] = useState("");
  const load = useCallback(() => api(url).then((d) => setRows(d.items ?? d)).catch((e) => setErr(e.message)), [url]);
  useEffect(() => { load(); }, [load, reload]);
  return <>{err && <p className="err">{err}</p>}<Table rows={rows} actions={actions && ((r) => actions(r, load))} /></>;
}

const act = (fn) => async (...a) => { try { await fn(...a); } catch (e) { alert(e.message); } };

function Server() {
  const [s, setS] = useState(null);
  const load = () => api(ROUTES.serverStatus).then(setS).catch((e) => alert(e.message));
  useEffect(() => { load(); }, []);
  const kill = act(async () => {
    if (!confirm("সার্ভার বন্ধ করবেন? সর্বোচ্চ ২৪ ঘণ্টার মধ্যে কার্ড চালু করে আবার চালু করতে হবে।")) return;
    await api(ROUTES.serverKill, "POST", { reason: prompt("কারণ লিখুন") || "" }); load();
  });
  return <><pre>{JSON.stringify(s, null, 2)}</pre><button onClick={kill}>মাস্টার কিল সুইচ</button></>;
}

const TABS = {
  "লেনদেন": () => <List url={ROUTES.transactions} />,
  "উইথড্রয়াল": () => <List url={ROUTES.withdrawals} actions={(r, load) => <>
    <button onClick={act(async () => { await api(ROUTES.withdrawalAction(r.id, "approve"), "POST"); load(); })}>অনুমোদন</button>{" "}
    <button className="ghost" onClick={act(async () => { await api(ROUTES.withdrawalAction(r.id, "reject"), "POST", { reason: prompt("কারণ") || "" }); load(); })}>বাতিল</button></>} />,
  "ফ্রড কেস": () => <List url={ROUTES.fraudCases} actions={(r, load) =>
    <button onClick={act(async () => { await api(ROUTES.fraudResolve(r.id), "POST", { note: prompt("নোট") || "" }); load(); })}>নিষ্পত্তি</button>} />,
  "ঘটনা পর্যালোচনা": () => <List url={ROUTES.incidents} />,
  "সার্ভার": Server,
};

export default function App() {
  const [authed, setAuthed] = useState(hasToken()); const [tab, setTab] = useState("লেনদেন");
  const [err, setErr] = useState(""); const [challenge, setChallenge] = useState(null);
  const login = async (e) => {
    e.preventDefault(); setErr(""); const f = new FormData(e.target);
    try {
      const d = challenge
        ? await api(ROUTES.verify2fa, "POST", { challengeId: challenge, code: f.get("code") })
        : await api(ROUTES.login, "POST", { email: f.get("email"), password: f.get("password"), deviceId: getDeviceId() });
      if (d.requiresTwoFactor) { setChallenge(d.challengeId); return; } // নতুন ডিভাইস: ২FA কোড চাওয়া হচ্ছে
      setToken(d.accessToken); setAuthed(true); setChallenge(null);
    } catch (x) { setErr(x.message); }
  };
  const Tab = TABS[tab];
  return (<><style>{css}</style>
    {!authed ? <form className="card" onSubmit={login}><h2>অ্যাডমিন লগইন</h2>
      {!challenge ? <>
        <input name="email" type="email" placeholder="ইমেইল" required /><input name="password" type="password" placeholder="পাসওয়ার্ড" required />
      </> : <input name="code" inputMode="numeric" maxLength={6} placeholder="নতুন ডিভাইস — অথেনটিকেটরের ৬ সংখ্যার কোড" required autoFocus />}
      <button>{challenge ? "যাচাই করুন" : "লগইন"}</button>{err && <p className="err">{err}</p>}</form>
    : <><div className="bar">{Object.keys(TABS).map((t) => <button key={t} className={t === tab ? "on" : "ghost"} onClick={() => setTab(t)}>{t}</button>)}
      <button className="ghost" onClick={() => { setToken(""); setAuthed(false); }}>লগআউট</button></div><main><Tab key={tab} /></main></>}</>);
}
