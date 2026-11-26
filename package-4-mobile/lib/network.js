import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

/** সার্ভার/নেট সংযোগ আছে কিনা — পুরো অ্যাপে এই একটা হুক ব্যবহার করুন। */
export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sub = NetInfo.addEventListener((s) => setOnline(!!(s.isConnected && s.isInternetReachable !== false)));
    return () => sub();
  }, []);
  return online;
}
