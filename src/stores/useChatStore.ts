import { create } from 'zustand';
import {
    collection,
    addDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp,
    Timestamp,
    where,
    getDocs,
    doc,
    updateDoc,
    limit,
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

export interface ChatRoom {
    id: string;
    type: 'single' | 'group';
    participants: string[];
    participantNames: Record<string, string>;
    participantPhotos: Record<string, string>;
    lastMessage: string;
    lastMessageAt: Timestamp | null;
    createdAt: Timestamp | null;
    updatedAt: Timestamp | null;
}

export interface SearchedUser {
    uid: string;
    displayName: string;
    email: string;
    photoURL: string;
}

interface ChatState {
    rooms: ChatRoom[];
    messages: Message[];
    roomsLoading: boolean;
    messagesLoading: boolean;
    unreadCounts: Record<string, number>;
    totalUnread: number;
    subscribeRooms: (uid: string) => () => void;
    subscribeRoomMessages: (roomId: string) => () => void;
    sendMessage: (roomId: string, text: string, uid: string, displayName: string, photoURL: string) => Promise<void>;
    createRoom: (
        type: 'single' | 'group',
        participants: string[],
        participantNames: Record<string, string>,
        participantPhotos: Record<string, string>
    ) => Promise<string | null>;
    searchUsers: (queryStr: string) => Promise<SearchedUser[]>;
    findExistingRoom: (myUid: string, otherUid: string) => Promise<string | null>;
    markAsRead: (roomId: string) => void;
    subscribeUnreadCounts: (uid: string) => () => void;
}

/** 마지막 읽은 시간 관리 (chrome.storage.local) */
async function getLastReadTimes(): Promise<Record<string, number>> {
    try {
        const result = await chrome.storage.local.get('messenjeong-last-read');
        return (result['messenjeong-last-read'] as Record<string, number>) || {};
    } catch { return {}; }
}
async function setLastReadTime(roomId: string) {
    const times = await getLastReadTimes();
    times[roomId] = Date.now();
    try { await chrome.storage.local.set({ 'messenjeong-last-read': times }); } catch { /* ignore */ }
}

export const useChatStore = create<ChatState>((set) => ({
    rooms: [],
    messages: [],
    roomsLoading: true,
    messagesLoading: true,
    unreadCounts: {},
    totalUnread: 0,

    subscribeRooms: (uid: string) => {
        const q = query(
            collection(db, 'chatRooms'),
            where('participants', 'array-contains', uid),
            orderBy('lastMessageAt', 'desc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const rooms: ChatRoom[] = snapshot.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            })) as ChatRoom[];
            set({ rooms, roomsLoading: false });
        }, (error) => {
            console.error('채팅방 목록 구독 실패:', error);
            set({ roomsLoading: false });
        });
        return unsubscribe;
    },

    subscribeRoomMessages: (roomId: string) => {
        set({ messagesLoading: true });
        const q = query(
            collection(db, 'chatRooms', roomId, 'messages'),
            orderBy('createdAt', 'asc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs: Message[] = snapshot.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            })) as Message[];
            set({ messages: msgs, messagesLoading: false });
        }, (error) => {
            console.error('메시지 구독 실패:', error);
            set({ messagesLoading: false });
        });
        return unsubscribe;
    },

    sendMessage: async (roomId, text, uid, displayName, photoURL) => {
        if (!text.trim()) return;
        try {
            await addDoc(collection(db, 'chatRooms', roomId, 'messages'), {
                text: text.trim(),
                uid,
                displayName,
                photoURL,
                createdAt: serverTimestamp(),
            });
            // 채팅방의 마지막 메시지 업데이트
            await updateDoc(doc(db, 'chatRooms', roomId), {
                lastMessage: text.trim(),
                lastMessageAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
        } catch (error) {
            console.error('메시지 전송 실패:', error);
        }
    },

    createRoom: async (type, participants, participantNames, participantPhotos) => {
        try {
            const docRef = await addDoc(collection(db, 'chatRooms'), {
                type,
                participants,
                participantNames,
                participantPhotos,
                lastMessage: '',
                lastMessageAt: serverTimestamp(),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            return docRef.id;
        } catch (error) {
            console.error('채팅방 생성 실패:', error);
            return null;
        }
    },

    searchUsers: async (queryStr: string) => {
        if (!queryStr.trim()) return [];
        try {
            // displayName 검색
            const nameQuery = query(
                collection(db, 'users'),
                where('displayName', '>=', queryStr),
                where('displayName', '<=', queryStr + '\uf8ff'),
                limit(10)
            );
            const nameSnapshot = await getDocs(nameQuery);
            const users: SearchedUser[] = nameSnapshot.docs.map((d) => d.data() as SearchedUser);

            // email 정확 검색
            const emailQuery = query(
                collection(db, 'users'),
                where('email', '==', queryStr),
                limit(5)
            );
            const emailSnapshot = await getDocs(emailQuery);
            emailSnapshot.docs.forEach((d) => {
                const user = d.data() as SearchedUser;
                if (!users.find((u) => u.uid === user.uid)) {
                    users.push(user);
                }
            });

            return users;
        } catch (error) {
            console.error('사용자 검색 실패:', error);
            return [];
        }
    },

    findExistingRoom: async (myUid: string, otherUid: string) => {
        try {
            const q = query(
                collection(db, 'chatRooms'),
                where('type', '==', 'single'),
                where('participants', 'array-contains', myUid)
            );
            const snapshot = await getDocs(q);
            const existingRoom = snapshot.docs.find((d) => {
                const data = d.data();
                return data.participants.includes(otherUid) && data.participants.length === 2;
            });
            return existingRoom ? existingRoom.id : null;
        } catch (error) {
            console.error('기존 채팅방 검색 실패:', error);
            return null;
        }
    },

    markAsRead: (roomId: string) => {
        setLastReadTime(roomId);
        set((state) => {
            const newCounts = { ...state.unreadCounts, [roomId]: 0 };
            const total = Object.values(newCounts).reduce((sum, c) => sum + c, 0);
            return { unreadCounts: newCounts, totalUnread: total };
        });
    },

    subscribeUnreadCounts: (uid: string) => {
        const q = query(
            collection(db, 'chatRooms'),
            where('participants', 'array-contains', uid),
            orderBy('lastMessageAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const lastReadTimes = await getLastReadTimes();
            const newCounts: Record<string, number> = {};

            const countPromises = snapshot.docs.map(async (docSnap) => {
                const room = docSnap.data();
                const roomId = docSnap.id;
                const lastReadMs = lastReadTimes[roomId] || 0;
                const lastMsgAt = room.lastMessageAt as Timestamp | null;

                if (!lastMsgAt || lastMsgAt.toMillis() <= lastReadMs) {
                    newCounts[roomId] = 0;
                    return;
                }

                // lastReadTime 이후의 자신이 보내지 않은 메시지 수 계산
                try {
                    const lastReadDate = new Date(lastReadMs);
                    const msgsQuery = query(
                        collection(db, 'chatRooms', roomId, 'messages'),
                        where('createdAt', '>', Timestamp.fromDate(lastReadDate)),
                        orderBy('createdAt', 'asc')
                    );
                    const msgsSnap = await getDocs(msgsQuery);
                    // 자신이 보낸 메시지 제외
                    const unreadCount = msgsSnap.docs.filter((m) => m.data().uid !== uid).length;
                    newCounts[roomId] = unreadCount;
                } catch {
                    // 인덱스 미생성 등 오류 시 간단 표시
                    newCounts[roomId] = 1;
                }
            });

            await Promise.all(countPromises);
            const total = Object.values(newCounts).reduce((sum, c) => sum + c, 0);
            set({ unreadCounts: newCounts, totalUnread: total });
        }, (error) => {
            console.error('미읽 카운트 구독 실패:', error);
        });

        return unsubscribe;
    },
}));
