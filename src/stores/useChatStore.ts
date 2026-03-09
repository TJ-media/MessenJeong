import { create } from 'zustand';
import {
    collection,
    addDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface Message {
    id: string;
    text: string;
    uid: string;
    displayName: string;
    photoURL: string;
    createdAt: Timestamp | null;
}

interface ChatState {
    messages: Message[];
    loading: boolean;
    subscribeMessages: () => () => void;
    sendMessage: (text: string, uid: string, displayName: string, photoURL: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set) => ({
    messages: [],
    loading: true,

    subscribeMessages: () => {
        const q = query(collection(db, 'messages'), orderBy('createdAt', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs: Message[] = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Message[];
            set({ messages: msgs, loading: false });
        });
        return unsubscribe;
    },

    sendMessage: async (text, uid, displayName, photoURL) => {
        if (!text.trim()) return;
        try {
            await addDoc(collection(db, 'messages'), {
                text: text.trim(),
                uid,
                displayName,
                photoURL,
                createdAt: serverTimestamp(),
            });
        } catch (error) {
            console.error('메시지 전송 실패:', error);
        }
    },
}));
