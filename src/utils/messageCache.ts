import type { Message } from '../stores/useChatStore';

const CACHE_KEY_PREFIX = 'messenjeong-cache-';
const MAX_CACHED_MESSAGES = 30;

interface CachedRoom {
    messages: Message[];
    updatedAt: number;
}

/**
 * 캐시된 메시지 가져오기
 */
export async function getCachedMessages(roomId: string): Promise<Message[]> {
    try {
        const key = CACHE_KEY_PREFIX + roomId;
        const result = await chrome.storage.local.get(key);
        const cached = result[key] as CachedRoom | undefined;
        return cached?.messages || [];
    } catch {
        return [];
    }
}

/**
 * 메시지 캐시 저장 (최근 50개만)
 */
export async function setCachedMessages(roomId: string, messages: Message[]): Promise<void> {
    try {
        const key = CACHE_KEY_PREFIX + roomId;
        const sliced = messages.slice(-MAX_CACHED_MESSAGES);
        const cached: CachedRoom = {
            messages: sliced,
            updatedAt: Date.now(),
        };
        await chrome.storage.local.set({ [key]: cached });
    } catch {
        // chrome.storage를 사용할 수 없는 경우 무시
    }
}

/**
 * 특정 채팅방 캐시 삭제
 */
export async function clearCachedMessages(roomId: string): Promise<void> {
    try {
        await chrome.storage.local.remove(CACHE_KEY_PREFIX + roomId);
    } catch {
        // ignore
    }
}
