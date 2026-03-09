import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface Position {
    x: number;
    y: number;
}

type ViewType = 'roomList' | 'chat' | 'settings';

// 위젯 기본 크기
const WIDGET_WIDTH = 380;
const WIDGET_HEIGHT = 560;
const MINIMIZED_WIDTH = 200;
const MINIMIZED_HEIGHT = 28; // drag-header 높이

interface UIState {
    opacity: number;
    visible: boolean;
    isMinimized: boolean;
    position: Position;
    expandedPosition: Position | null;
    currentView: ViewType;
    currentRoomId: string | null;
    toast: string | null;
    setOpacity: (value: number) => void;
    setVisible: (value: boolean) => void;
    setMinimized: (value: boolean) => void;
    setPosition: (pos: Position) => void;
    setCurrentView: (view: ViewType) => void;
    setCurrentRoomId: (roomId: string | null) => void;
    showToast: (message: string) => void;
    hideToast: () => void;
}

/** chrome.storage.local 기반 커스텀 스토리지 어댑터 */
const chromeStorageAdapter = createJSONStorage<UIState>(() => ({
    getItem: async (name: string): Promise<string | null> => {
        try {
            const result = await chrome.storage.local.get(name);
            return (result[name] as string) ?? null;
        } catch {
            return null;
        }
    },
    setItem: async (name: string, value: string): Promise<void> => {
        try {
            await chrome.storage.local.set({ [name]: value });
        } catch {
            // chrome.storage를 사용할 수 없는 경우 무시
        }
    },
    removeItem: async (name: string): Promise<void> => {
        try {
            await chrome.storage.local.remove(name);
        } catch {
            // chrome.storage를 사용할 수 없는 경우 무시
        }
    },
}));

export const useUIStore = create<UIState>()(
    persist(
        (set, get) => ({
            opacity: 1,
            visible: true,
            isMinimized: false,
            position: { x: window.innerWidth - WIDGET_WIDTH - 20, y: 20 },
            expandedPosition: null,
            currentView: 'roomList' as ViewType,
            currentRoomId: null,
            toast: null,
            setOpacity: (value) => set({ opacity: value }),
            setVisible: (value) => set({ visible: value }),
            setMinimized: (value) => {
                const state = get();
                if (value && !state.isMinimized) {
                    // 최소화: 우하단 고정 — expanded 위치 저장 후 위치 이동
                    const newX = state.position.x + (WIDGET_WIDTH - MINIMIZED_WIDTH);
                    const newY = state.position.y + (WIDGET_HEIGHT - MINIMIZED_HEIGHT);
                    set({
                        isMinimized: true,
                        expandedPosition: { ...state.position },
                        position: { x: newX, y: newY },
                    });
                } else if (!value && state.isMinimized) {
                    // 확장: 원래 위치로 복귀
                    const restorePos = state.expandedPosition || {
                        x: state.position.x - (WIDGET_WIDTH - MINIMIZED_WIDTH),
                        y: state.position.y - (WIDGET_HEIGHT - MINIMIZED_HEIGHT),
                    };
                    set({
                        isMinimized: false,
                        position: restorePos,
                        expandedPosition: null,
                    });
                }
            },
            setPosition: (pos) => set({ position: pos }),
            setCurrentView: (view) => set({ currentView: view }),
            setCurrentRoomId: (roomId) => set({ currentRoomId: roomId }),
            showToast: (message) => {
                set({ toast: message });
                setTimeout(() => set({ toast: null }), 4000);
            },
            hideToast: () => set({ toast: null }),
        }),
        {
            name: 'messenjeong-ui',
            storage: chromeStorageAdapter,
            partialize: (state) => ({
                opacity: state.opacity,
                visible: state.visible,
                isMinimized: state.isMinimized,
                position: state.position,
                expandedPosition: state.expandedPosition,
                currentView: state.currentView,
                currentRoomId: state.currentRoomId,
            }) as unknown as UIState,
        }
    )
);
