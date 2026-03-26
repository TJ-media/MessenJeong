const DB_NAME = 'messenjeong-image-cache';
const STORE_NAME = 'images';
const DB_VERSION = 1;
const MAX_CACHED_IMAGES = 100;

/**
 * IndexedDB 열기
 */
function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' });
                store.createIndex('cachedAt', 'cachedAt', { unique: false });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

interface CachedImage {
    url: string;
    blob: Blob;
    cachedAt: number;
}

/**
 * 캐시된 이미지의 blob URL 가져오기
 * 캐시 hit → blob URL 반환, miss → null
 */
export async function getCachedImageURL(originalURL: string): Promise<string | null> {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(originalURL);
            request.onsuccess = () => {
                const cached = request.result as CachedImage | undefined;
                if (cached?.blob) {
                    resolve(URL.createObjectURL(cached.blob));
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => resolve(null);
        });
    } catch {
        return null;
    }
}

/**
 * 이미지를 fetch하여 IndexedDB에 캐싱
 */
export async function cacheImage(originalURL: string): Promise<void> {
    try {
        // 이미 캐시되어 있는지 확인
        const db = await openDB();
        const exists = await new Promise<boolean>((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.count(originalURL);
            request.onsuccess = () => resolve(request.result > 0);
            request.onerror = () => resolve(false);
        });
        if (exists) return;

        // 이미지 fetch
        const response = await fetch(originalURL);
        if (!response.ok) return;
        const blob = await response.blob();

        // 저장
        const entry: CachedImage = {
            url: originalURL,
            blob,
            cachedAt: Date.now(),
        };

        const writeTx = db.transaction(STORE_NAME, 'readwrite');
        const writeStore = writeTx.objectStore(STORE_NAME);
        writeStore.put(entry);

        // LRU 정리: MAX_CACHED_IMAGES 초과 시 오래된 것 삭제
        const countRequest = writeStore.count();
        countRequest.onsuccess = () => {
            if (countRequest.result > MAX_CACHED_IMAGES) {
                const deleteCount = countRequest.result - MAX_CACHED_IMAGES;
                const index = writeStore.index('cachedAt');
                const cursor = index.openCursor(); // 오래된 순서
                let deleted = 0;
                cursor.onsuccess = () => {
                    const cur = cursor.result;
                    if (cur && deleted < deleteCount) {
                        cur.delete();
                        deleted++;
                        cur.continue();
                    }
                };
            }
        };
    } catch {
        // 캐싱 실패 무시 — 다음번에 다시 시도
    }
}
