import { create } from 'zustand';
import {
    signInWithCredential,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    type User,
    GoogleAuthProvider,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { useUIStore } from './useUIStore';

interface AuthState {
    user: User | null;
    loading: boolean;
    error: string | null;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    initAuth: () => () => void;
}

/** Port 기반 통신 — onDisconnect 핸들러 */
function sendPortMessage(message: { type: string }): Promise<{ success: boolean; token?: string; error?: string }> {
    return new Promise((resolve, reject) => {
        try {
            const port = chrome.runtime.connect({ name: 'messenjeong-auth' });
            let settled = false;

            port.onMessage.addListener((response) => {
                if (!settled) {
                    settled = true;
                    resolve(response);
                    port.disconnect();
                }
            });

            port.onDisconnect.addListener(() => {
                if (!settled) {
                    settled = true;
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

/** Firestore users 컬렉션에 사용자 정보 upsert */
async function saveUserToFirestore(user: User) {
    try {
        await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            displayName: user.displayName || '익명',
            email: user.email || '',
            photoURL: user.photoURL || '',
            updatedAt: serverTimestamp(),
        }, { merge: true });
    } catch (error) {
        console.error('사용자 정보 저장 실패:', error);
    }
}

/**
 * chrome.storage.local에 인증 토큰 저장/로드/삭제
 * → manifest.json "storage" 권한 필요 (탭 간 인증 상태 공유 목적)
 */
async function saveToken(token: string) {
    try { await chrome.storage.local.set({ 'messenjeong-auth-token': token }); } catch { /* ignore */ }
}
async function loadToken(): Promise<string | null> {
    try {
        const result = await chrome.storage.local.get('messenjeong-auth-token');
        return (result['messenjeong-auth-token'] as string) || null;
    } catch { return null; }
}
async function removeToken() {
    try { await chrome.storage.local.remove('messenjeong-auth-token'); } catch { /* ignore */ }
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

            // 토큰을 chrome.storage.local에 저장 (탭 간 공유)
            await saveToken(response.token);

            // Firebase credential 생성 후 로그인
            const credential = GoogleAuthProvider.credential(null, response.token);
            await signInWithCredential(auth, credential);
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error('Google 로그인 실패:', msg);

            if (msg.includes('Extension context invalidated')) {
                useUIStore.getState().showErrorScreen({
                    icon: '🔄',
                    title: '확장 프로그램이 업데이트되었습니다',
                    message: '현재 웹페이지를 새로고침(F5) 해주세요.',
                    actionLabel: '페이지 새로고침',
                    onAction: () => window.location.reload(),
                });
            } else {
                set({ error: msg });
            }
        }
    },

    signOut: async () => {
        try {
            // Background에 토큰 제거 요청 (Port 통신) — 실패해도 Firebase 로그아웃 진행
            await sendPortMessage({ type: 'REMOVE_AUTH_TOKEN' }).catch(() => { });
            await removeToken();
            await firebaseSignOut(auth);
        } catch (error) {
            console.error('로그아웃 실패:', error);
        }
    },

    initAuth: () => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                set({ user, loading: false });
                saveUserToFirestore(user);
            } else {
                // Firebase 인증 없음 → chrome.storage에 저장된 토큰으로 자동 재인증 시도
                const savedToken = await loadToken();
                if (savedToken) {
                    try {
                        const credential = GoogleAuthProvider.credential(null, savedToken);
                        await signInWithCredential(auth, credential);
                        // onAuthStateChanged가 다시 호출되므로 여기서는 set 불필요
                        return;
                    } catch {
                        // 토큰 만료 — 삭제 후 로그인 화면 표시
                        await removeToken();
                    }
                }
                set({ user: null, loading: false });
            }
        });
        return unsubscribe;
    },
}));
