import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

// import.meta.env를 통해 .env 파일의 값을 불러옵니다.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
// Content Script 환경에서도 인증 상태를 유지하기 위해 browserLocalPersistence 사용
setPersistence(auth, browserLocalPersistence).catch(() => { /* ignore */ });
export const googleProvider = new GoogleAuthProvider();
// 광고 차단기 등에 의한 ERR_BLOCKED_BY_CLIENT 방지를 위해 롱폴링 사용
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});