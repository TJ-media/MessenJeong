import { useAuthStore } from '../stores/useAuthStore';
import { useUIStore } from '../stores/useUIStore';
import DragHeader from './DragHeader';
import RoomList from './RoomList';
import ChatView from './ChatView';
import SettingsView from './SettingsView';
import OpacitySlider from './OpacitySlider';
import Toast from './Toast';
import ImageViewer from './ImageViewer';

export default function ChatApp() {
    const user = useAuthStore((s) => s.user);
    const signOut = useAuthStore((s) => s.signOut);
    const opacity = useUIStore((s) => s.opacity);
    const position = useUIStore((s) => s.position);
    const visible = useUIStore((s) => s.visible);
    const isMinimized = useUIStore((s) => s.isMinimized);
    const currentView = useUIStore((s) => s.currentView);
    const setCurrentView = useUIStore((s) => s.setCurrentView);

    if (!visible) return null;

    return (
        <div
            className={`chat-container${isMinimized ? ' chat-container--minimized' : ''}`}
            style={{
                opacity: opacity,
                left: `${position.x}px`,
                top: `${position.y}px`,
            }}
        >
            <DragHeader />

            {!isMinimized && (
                <>
                    {/* 툴바 */}
                    <div className="toolbar">
                        <div className="toolbar__left">
                            <div className="toolbar__user">
                                {user?.photoURL && (
                                    <img
                                        className="toolbar__avatar"
                                        src={user.photoURL}
                                        alt={user.displayName || ''}
                                        referrerPolicy="no-referrer"
                                    />
                                )}
                                <span className="toolbar__name">{user?.displayName}</span>
                            </div>
                        </div>
                        <div className="toolbar__right">
                            <OpacitySlider />
                            <button
                                className="toolbar__settings"
                                onClick={() => setCurrentView(currentView === 'settings' ? 'roomList' : 'settings')}
                                title="설정"
                                aria-label="설정"
                            >
                                ⚙️
                            </button>
                            <button className="toolbar__logout" onClick={signOut} title="로그아웃" aria-label="로그아웃">
                                🚪
                            </button>
                        </div>
                    </div>

                    {/* 내비게이션 */}
                    {currentView === 'roomList' && <RoomList />}
                    {currentView === 'chat' && <ChatView />}
                    {currentView === 'settings' && <SettingsView />}
                </>
            )}

            <Toast />
            <ImageViewer />
        </div>
    );
}
