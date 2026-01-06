import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, FirebaseStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, Functions, connectFunctionsEmulator } from 'firebase/functions';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
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

// Firebase 인스턴스 (싱글톤)
let _app: FirebaseApp | undefined;
let _db: Firestore | undefined;
let _storage: FirebaseStorage | undefined;
let _functions: Functions | undefined;
let _auth: Auth | undefined;
let _appCheck: AppCheck | null = null;
let _emulatorsConnected = false;
let _initialized = false;

/**
 * Firebase 초기화 (lazy initialization)
 */
export function initializeFirebase() {
  if (_initialized && typeof window !== 'undefined') {
    return { app: _app!, db: _db!, storage: _storage!, functions: _functions!, auth: _auth!, appCheck: _appCheck };
  }

  // SSR 환경에서는 초기화하지 않음
  if (typeof window === 'undefined') {
    throw new Error('Firebase는 클라이언트에서만 사용할 수 있습니다.');
  }

  if (getApps().length === 0) {
    _app = initializeApp(firebaseConfig);
  } else {
    _app = getApps()[0];
  }

  _db = getFirestore(_app);
  _storage = getStorage(_app);
  _functions = getFunctions(_app, 'asia-northeast3');
  _auth = getAuth(_app);

  // 로컬 개발 환경에서 에뮬레이터 연결 (한 번만)
  if (process.env.NODE_ENV === 'development' && !_emulatorsConnected) {
    const useEmulator = process.env.NEXT_PUBLIC_USE_EMULATOR === 'true';
    if (useEmulator) {
      try {
        connectFunctionsEmulator(_functions, 'localhost', 5001);
        connectFirestoreEmulator(_db, 'localhost', 8080);
        connectStorageEmulator(_storage, 'localhost', 9199);
        connectAuthEmulator(_auth, 'http://localhost:9099', { disableWarnings: true });
        _emulatorsConnected = true;
        console.log('[Firebase] Emulators connected');
      } catch (error) {
        console.warn('[Firebase] Emulator connection error:', error);
      }
    }
  }

  // App Check 초기화 (프로덕션 환경)
  if (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && !_appCheck) {
    try {
      if (process.env.NODE_ENV === 'development') {
        // @ts-expect-error - Firebase App Check debug token
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }

      _appCheck = initializeAppCheck(_app, {
        provider: new ReCaptchaV3Provider(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY),
        isTokenAutoRefreshEnabled: true,
      });
    } catch (error) {
      console.warn('App Check 초기화 실패:', error);
    }
  }

  _initialized = true;
  return { app: _app, db: _db, storage: _storage, functions: _functions, auth: _auth, appCheck: _appCheck };
}

// Getter functions (자동 초기화)
function ensureInitialized() {
  if (!_initialized) {
    initializeFirebase();
  }
}

export const app = new Proxy({} as FirebaseApp, {
  get(_, prop) {
    ensureInitialized();
    return (_app as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const db = new Proxy({} as Firestore, {
  get(_, prop) {
    ensureInitialized();
    return (_db as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const storage = new Proxy({} as FirebaseStorage, {
  get(_, prop) {
    ensureInitialized();
    return (_storage as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const functions = new Proxy({} as Functions, {
  get(_, prop) {
    ensureInitialized();
    return (_functions as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const auth = new Proxy({} as Auth, {
  get(_, prop) {
    ensureInitialized();
    return (_auth as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export { _appCheck as appCheck };
