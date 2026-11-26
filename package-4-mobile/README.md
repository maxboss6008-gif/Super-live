# Package 4 – Mobile App (Expo / React Native)

1. config.js-এ API_BASE ও REALTIME_BASE দিন
2. npm install && npx expo install --fix

## ⚠️ এখন আর Expo Go দিয়ে চলবে না
LiveKit-এর অডিও/ভিডিও (@livekit/react-native, @livekit/react-native-webrtc) নেটিভ
মডিউল ব্যবহার করে, তাই `npx expo start` + Expo Go অ্যাপ দিয়ে টেস্ট করা যাবে না। এখন থেকে:

```
npx expo prebuild          # android/ ও ios/ নেটিভ ফোল্ডার জেনারেট করবে
npx expo run:android       # নিজের ফোনে/এমুলেটরে ইনস্টল করে চালাবে (Android Studio/SDK লাগবে)
```
অথবা সরাসরি EAS দিয়ে একটা ডেভ ক্লায়েন্ট/APK বানিয়ে ফোনে ইনস্টল করুন (নিচে)।

## APK বানানো
```
npm i -g eas-cli && eas login && eas build -p android --profile preview
```
(লোকাল বিল্ড: `npx expo prebuild && cd android && ./gradlew assembleRelease` — Android SDK ও JDK 17 লাগবে)

## ⚠️ LiveKit অংশ সম্পর্কে জরুরি কথা
`screens/RoomScreen.js`-এর অডিও/ভিডিও সংযোগের কোডটা আমি লিখেছি কিন্তু কোনো ডিভাইস,
এমুলেটর বা নেটিভ বিল্ডে চালিয়ে পরীক্ষা করতে পারিনি — এই কাজের পুরোটা সময় আমার
কাছে নেটওয়ার্ক, Android SDK বা কোনো ডিভাইস কিছুই ছিল না। প্যাকেজ ভার্সন ও API
আমার প্রশিক্ষণ-জ্ঞান থেকে যতটা সম্ভব নির্ভুল লেখা, কিন্তু `npm install` ও প্রথম
`expo run:android`-এর পর এরর এলে (বিশেষত `VideoTrack` কম্পোনেন্টের prop-শেপ নিয়ে,
`screens/RoomScreen.js`-এ চিহ্নিত করা আছে) সেটা স্বাভাবিক — এরর মেসেজটা পেস্ট করলে
ঠিক করে দেব। "একবারও না চালিয়ে ভুল-শূন্য" এমন কোনো প্রতিশ্রুতি আমি দিতে পারি না।

## প্রথম বাস্তব পরীক্ষা কীভাবে করবেন
1. আসল Postgres+Redis+package-1-backend+package-2-realtime চালু করুন (docker compose, উপরের প্যাকেজের README দেখুন)
2. .env-এ LIVEKIT_URL/API_KEY/SECRET দিন — নিজের LiveKit সার্ভার সেলফ-হোস্ট করুন অথবা
   https://livekit.io -এ ফ্রি Cloud অ্যাকাউন্ট বানান (এটাও আমি নিজে বানাইনি/করিনি)
3. দুটো ফোনে (বা একটা ফোন + এমুলেটর) APK ইনস্টল করে একই রুমে ঢুকে মাইক/ক্যামেরা পরীক্ষা করুন
