import { create } from 'zustand';
import {
    signInWithCredential,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    type User,
    GoogleAuthProvider,
} from 'firebase/auth';
import { auth } from '../config/firebase';

interface AuthState {
    user: User | null;
    loading: boolean;
    error: string | null;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    initAuth: () => () => void;
}

/** Port 기반 통신 — onDisconnect 핸들러와 타임아웃 추가 */
function sendPortMessage(message: { type: string }): Promise<{ success: boolean; token?: string; error?: string }> {
    return new Promise((resolve, reject) => {
        try {
            const port = chrome.runtime.connect({ name: 'messenjeong-auth' });
            let settled = false;

            const timeout = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    port.disconnect();
                    reject(new Error('Background 응답 시간 초과 (10초). Service Worker가 정상 동작하는지 확인하세요.'));
                }
            }, 10000);

            port.onMessage.addListener((response) => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timeout);
                    resolve(response);
                    port.disconnect();
                }
            });

            port.onDisconnect.addListener(() => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timeout);
                    const lastError = chrome.runtime.lastError?.message || 'Port가 연결 해제되었습니다. Background service worker를 확인하세요.';
                    reject(new Error(lastError));
                }
            });

            port.postMessage(message);
        } catch (error) {
            reject(error);
        }
    });
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    loading: true,
    error: null,

    signInWithGoogle: async () => {
        set({ error: null });
        try {
            // Background service worker에 토큰 요청 (Port 통신)
            const response = await sendPortMessage({ type: 'GET_AUTH_TOKEN' });
            if (!response || !response.success || !response.token) {
                throw new Error(response?.error || 'Background에서 토큰을 받지 못했습니다. manifest.json의 oauth2.client_id를 확인하세요.');
            }

            // Firebase credential 생성 후 로그인
            const credential = GoogleAuthProvider.credential(null, response.token);
            await signInWithCredential(auth, credential);
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error('Google 로그인 실패:', msg);
            set({ error: msg });
        }
    },

    signOut: async () => {
        try {
            // Background에 토큰 제거 요청 (Port 통신)
            await sendPortMessage({ type: 'REMOVE_AUTH_TOKEN' });
            await firebaseSignOut(auth);
        } catch (error) {
            console.error('로그아웃 실패:', error);
        }
    },

    initAuth: () => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            set({ user, loading: false });
        });
        return unsubscribe;
    },
}));
