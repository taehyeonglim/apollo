'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { initializeFirebase } from './firebase';
import type { Auth } from 'firebase/auth';

// Auth 인스턴스를 lazy하게 가져오기
function getAuth(): Auth {
  return initializeFirebase().auth;
}

// Auth Context 타입
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth Provider
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      console.log('[Auth] Initializing Firebase auth...');
      // Firebase 초기화 및 auth 인스턴스 가져오기
      const authInstance = getAuth();
      console.log('[Auth] Auth instance obtained');

      const unsubscribe = onAuthStateChanged(authInstance, (user) => {
        console.log('[Auth] Auth state changed:', user ? user.email : 'null');
        setUser(user);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('[Auth] Firebase initialization error:', error);
      // 에러 발생 시에도 로딩 상태 해제
      setLoading(false);
    }
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account',
    });

    try {
      await signInWithPopup(getAuth(), provider);
    } catch (error) {
      console.error('[Auth] Google 로그인 실패:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(getAuth());
    } catch (error) {
      console.error('[Auth] 로그아웃 실패:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// Auth Hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// 보호된 라우트 컴포넌트
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, signInWithGoogle } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-100">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
          <div className="text-6xl mb-4">🌙</div>
          <h1 className="text-2xl font-bold text-indigo-900 mb-2">A.P.O.L.L.O.</h1>
          <p className="text-gray-600 mb-6">
            로그인하여 나만의 인스타툰을 만들어보세요
          </p>
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 rounded-xl px-6 py-3 text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 transition-all"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google로 로그인
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
