import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFunctions, Functions, connectFunctionsEmulator } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaV3Provider, AppCheck } from 'firebase/app-check';

// Firebase 설정 (환경변수에서 로드)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Firebase 앱 초기화 (싱글톤)
let app: FirebaseApp;
let db: Firestore;
let storage: FirebaseStorage;
let functions: Functions;
let appCheck: AppCheck | null = null;

function initializeFirebase() {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }

  db = getFirestore(app);
  storage = getStorage(app);
  functions = getFunctions(app, 'asia-northeast3'); // 서울 리전

  // 로컬 개발 환경에서 에뮬레이터 연결
  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    const useEmulator = process.env.NEXT_PUBLIC_USE_EMULATOR === 'true';
    if (useEmulator) {
      connectFunctionsEmulator(functions, 'localhost', 5001);
    }
  }

  // App Check 초기화 (프로덕션 환경)
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
    try {
      // 디버그 모드 (개발환경)
      if (process.env.NODE_ENV === 'development') {
        // @ts-ignore
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }

      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY),
        isTokenAutoRefreshEnabled: true,
      });
    } catch (error) {
      console.warn('App Check 초기화 실패:', error);
    }
  }

  return { app, db, storage, functions, appCheck };
}

// 클라이언트에서만 초기화
if (typeof window !== 'undefined') {
  initializeFirebase();
}

export { app, db, storage, functions, appCheck };
export { initializeFirebase };
