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
    startAfter,
    endBefore,
    limitToLast,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { getCachedMessages, setCachedMessages } from '../utils/messageCache';

export interface Message {
    id: string;
    text: string;
    uid: string;
    displayName: string;
    photoURL: string;
    createdAt: Timestamp | null;
    imageURL?: string;
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
    hasMoreMessages: boolean;
    loadingOlder: boolean;
    unreadCounts: Record<string, number>;
    totalUnread: number;
    subscribeRooms: (uid: string) => () => void;
    subscribeRoomMessages: (roomId: string) => () => void;
    loadOlderMessages: (roomId: string) => Promise<void>;
    sendMessage: (roomId: string, text: string, uid: string, displayName: string, photoURL: string) => Promise<void>;
    uploadImage: (roomId: string, file: File) => Promise<string>;
    sendImageMessage: (roomId: string, imageURL: string, uid: string, displayName: string, photoURL: string) => Promise<void>;
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

/**
 * 마지막 읽은 시간 관리 (chrome.storage.local)
 * → manifest.json "storage" 권한 필요 (읽지 않은 메시지 카운트 계산용)
 */
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

const PAGE_SIZE = 30;

export const useChatStore = create<ChatState>((set, get) => ({
    rooms: [],
    messages: [],
    roomsLoading: true,
    messagesLoading: true,
    hasMoreMessages: true,
    loadingOlder: false,
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
        set({ messagesLoading: true, hasMoreMessages: true, messages: [] });

        // 1. 캐시 우선 로드 — 즉시 표시
        getCachedMessages(roomId).then((cached) => {
            if (cached.length > 0) {
                set({ messages: cached, messagesLoading: false });
            }
        });

        let unsubscribe: (() => void) | null = null;

        // 2. 최신 PAGE_SIZE개 초기 로드 후 → 실시간 구독
        const init = async () => {
            try {
                const initialQuery = query(
                    collection(db, 'chatRooms', roomId, 'messages'),
                    orderBy('createdAt', 'desc'),
                    limit(PAGE_SIZE)
                );
                const snapshot = await getDocs(initialQuery);
                const msgs: Message[] = snapshot.docs
                    .map((d) => ({ id: d.id, ...d.data() } as Message))
                    .reverse(); // 시간순 정렬

                set({
                    messages: msgs,
                    messagesLoading: false,
                    hasMoreMessages: snapshot.docs.length >= PAGE_SIZE,
                });

                // 캐시 갱신
                setCachedMessages(roomId, msgs);

                // 3. 마지막 메시지 이후의 새 메시지만 실시간 구독
                const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[0] : null; // desc 정렬이므로 docs[0]이 최신
                const realtimeQuery = lastDoc
                    ? query(
                          collection(db, 'chatRooms', roomId, 'messages'),
                          orderBy('createdAt', 'asc'),
                          startAfter(lastDoc)
                      )
                    : query(
                          collection(db, 'chatRooms', roomId, 'messages'),
                          orderBy('createdAt', 'asc')
                      );

                unsubscribe = onSnapshot(realtimeQuery, (snap) => {
                    if (snap.empty) return;
                    const newMsgs: Message[] = snap.docs.map((d) => ({
                        id: d.id,
                        ...d.data(),
                    } as Message));
                    set((state) => {
                        // 중복 제거
                        const existingIds = new Set(state.messages.map((m) => m.id));
                        const unique = newMsgs.filter((m) => !existingIds.has(m.id));
                        if (unique.length === 0) return state;
                        const merged = [...state.messages, ...unique];
                        // 캐시 갱신 (최신 PAGE_SIZE개만)
                        setCachedMessages(roomId, merged.slice(-PAGE_SIZE));
                        return { messages: merged };
                    });
                }, (error) => {
                    console.error('실시간 메시지 구독 실패:', error);
                });
            } catch (error) {
                console.error('초기 메시지 로드 실패:', error);
                set({ messagesLoading: false });
            }
        };

        init();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    },

    loadOlderMessages: async (roomId: string) => {
        const { messages, loadingOlder, hasMoreMessages } = get();
        if (loadingOlder || !hasMoreMessages || messages.length === 0) return;

        set({ loadingOlder: true });

        try {
            const oldest = messages[0];
            // createdAt이 없는 경우 (serverTimestamp 미적용) 건너뜀
            if (!oldest.createdAt) {
                set({ loadingOlder: false, hasMoreMessages: false });
                return;
            }

            const olderQuery = query(
                collection(db, 'chatRooms', roomId, 'messages'),
                orderBy('createdAt', 'asc'),
                endBefore(oldest.createdAt),
                limitToLast(PAGE_SIZE)
            );
            const snapshot = await getDocs(olderQuery);
            const olderMsgs: Message[] = snapshot.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            } as Message));

            set((state) => {
                const existingIds = new Set(state.messages.map((m) => m.id));
                const unique = olderMsgs.filter((m) => !existingIds.has(m.id));
                return {
                    messages: [...unique, ...state.messages],
                    hasMoreMessages: snapshot.docs.length >= PAGE_SIZE,
                    loadingOlder: false,
                };
            });
        } catch (error) {
            console.error('이전 메시지 로드 실패:', error);
            set({ loadingOlder: false });
        }
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

    uploadImage: async (roomId, file) => {
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storageRef = ref(storage, `chatImages/${roomId}/${timestamp}_${safeName}`);
        const snapshot = await uploadBytes(storageRef, file);
        return await getDownloadURL(snapshot.ref);
    },

    sendImageMessage: async (roomId, imageURL, uid, displayName, photoURL) => {
        try {
            await addDoc(collection(db, 'chatRooms', roomId, 'messages'), {
                text: '',
                imageURL,
                uid,
                displayName,
                photoURL,
                createdAt: serverTimestamp(),
            });
            await updateDoc(doc(db, 'chatRooms', roomId), {
                lastMessage: '📷 사진',
                lastMessageAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
        } catch (error) {
            console.error('이미지 메시지 전송 실패:', error);
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
