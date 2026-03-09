import { useUIStore } from '../stores/useUIStore';

export default function OpacitySlider() {
    const opacity = useUIStore((s) => s.opacity);
    const setOpacity = useUIStore((s) => s.setOpacity);

    return (
        <div className="opacity-slider">
            <label className="opacity-slider__label" htmlFor="opacity-range">
                🔆
            </label>
            <input
                id="opacity-range"
                className="opacity-slider__input"
                type="range"
                min="0.15"
                max="1"
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
            />
        </div>
    );
}
