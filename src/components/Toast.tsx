import { useUIStore } from '../stores/useUIStore';

export default function Toast() {
    const toast = useUIStore((s) => s.toast);
    const hideToast = useUIStore((s) => s.hideToast);

    if (!toast) return null;

    return (
        <div className="toast" onClick={hideToast}>
            <span className="toast__icon">⚠️</span>
            <span className="toast__message">{toast}</span>
        </div>
    );
}
