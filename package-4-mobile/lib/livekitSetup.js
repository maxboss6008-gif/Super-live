// অ্যাপ শুরু হওয়ার সাথে সাথেই একবার চালাতে হয় (App.js-এর একদম শুরুতে ইমপোর্ট করা আছে),
// যাতে global WebRTC API (RTCPeerConnection ইত্যাদি) প্যাচ হয়ে যায় — LiveKit-এর কোনো Room
// ব্যবহারের আগেই এটা না হলে কানেকশন কাজ করবে না।
import { registerGlobals } from "@livekit/react-native-webrtc";
registerGlobals();
