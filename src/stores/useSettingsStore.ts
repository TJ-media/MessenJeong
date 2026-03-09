import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type ThemeType = 'dark' | 'light';

interface SettingsState {
    pushNotification: boolean;
    autoMinimizeOnTabSwitch: boolean;
    theme: ThemeType;
    setPushNotification: (value: boolean) => void;
    setAutoMinimizeOnTabSwitch: (value: boolean) => void;
    setTheme: (theme: ThemeType) => void;
}

const chromeSettingsStorage = createJSONStorage<SettingsState>(() => ({
    getItem: async (name: string): Promise<string | null> => {
        try {
            const result = await chrome.storage.local.get(name);
            return (result[name] as string) ?? null;
        } catch { return null; }
    },
    setItem: async (name: string, value: string): Promise<void> => {
        try { await chrome.storage.local.set({ [name]: value }); } catch { /* ignore */ }
    },
    removeItem: async (name: string): Promise<void> => {
        try { await chrome.storage.local.remove(name); } catch { /* ignore */ }
    },
}));

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            pushNotification: true,
            autoMinimizeOnTabSwitch: false,
            theme: 'dark' as ThemeType,
            setPushNotification: (value) => set({ pushNotification: value }),
            setAutoMinimizeOnTabSwitch: (value) => set({ autoMinimizeOnTabSwitch: value }),
            setTheme: (theme) => set({ theme }),
        }),
        {
            name: 'messenjeong-settings',
            storage: chromeSettingsStorage,
        }
    )
);
