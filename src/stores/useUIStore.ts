import { create } from 'zustand';

interface Position {
    x: number;
    y: number;
}

interface UIState {
    opacity: number;
    visible: boolean;
    position: Position;
    setOpacity: (value: number) => void;
    setVisible: (value: boolean) => void;
    setPosition: (pos: Position) => void;
}

export const useUIStore = create<UIState>((set) => ({
    opacity: 1,
    visible: true,
    position: { x: window.innerWidth - 400, y: window.innerHeight - 580 },
    setOpacity: (value) => set({ opacity: value }),
    setVisible: (value) => set({ visible: value }),
    setPosition: (pos) => set({ position: pos }),
}));
