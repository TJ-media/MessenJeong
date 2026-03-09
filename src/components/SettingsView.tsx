import { useUIStore } from '../stores/useUIStore';
import { useSettingsStore } from '../stores/useSettingsStore';

export default function SettingsView() {
    const setCurrentView = useUIStore((s) => s.setCurrentView);
    const pushNotification = useSettingsStore((s) => s.pushNotification);
    const setPushNotification = useSettingsStore((s) => s.setPushNotification);
    const autoMinimize = useSettingsStore((s) => s.autoMinimizeOnTabSwitch);
    const setAutoMinimize = useSettingsStore((s) => s.setAutoMinimizeOnTabSwitch);
    const theme = useSettingsStore((s) => s.theme);
    const setTheme = useSettingsStore((s) => s.setTheme);

    return (
        <div className="settings-view">
            <div className="settings-view__header">
                <button className="chat-view__back" onClick={() => setCurrentView('roomList')} title="뒤로" aria-label="뒤로">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                </button>
                <span className="settings-view__title">설정</span>
            </div>

            <div className="settings-view__list">
                {/* 푸시 알림 */}
                <div className="settings-item">
                    <div className="settings-item__info">
                        <span className="settings-item__label">🔔 푸시 알림</span>
                        <span className="settings-item__desc">새 메시지 알림 받기</span>
                    </div>
                    <label className="toggle">
                        <input
                            type="checkbox"
                            checked={pushNotification}
                            onChange={(e) => setPushNotification(e.target.checked)}
                        />
                        <span className="toggle__slider" />
                    </label>
                </div>

                {/* 탭 전환 시 자동 최소화 */}
                <div className="settings-item">
                    <div className="settings-item__info">
                        <span className="settings-item__label">📌 탭 전환 시 자동 최소화</span>
                        <span className="settings-item__desc">다른 탭으로 이동 시 자동 최소화</span>
                    </div>
                    <label className="toggle">
                        <input
                            type="checkbox"
                            checked={autoMinimize}
                            onChange={(e) => setAutoMinimize(e.target.checked)}
                        />
                        <span className="toggle__slider" />
                    </label>
                </div>

                {/* 테마 선택 */}
                <div className="settings-item">
                    <div className="settings-item__info">
                        <span className="settings-item__label">🎨 테마</span>
                        <span className="settings-item__desc">인터페이스 모드 선택</span>
                    </div>
                    <div className="settings-item__theme-btns">
                        <button
                            className={`settings-item__theme-btn ${theme === 'dark' ? 'settings-item__theme-btn--active' : ''}`}
                            onClick={() => setTheme('dark')}
                        >
                            🌙
                        </button>
                        <button
                            className={`settings-item__theme-btn ${theme === 'light' ? 'settings-item__theme-btn--active' : ''}`}
                            onClick={() => setTheme('light')}
                        >
                            ☀️
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
