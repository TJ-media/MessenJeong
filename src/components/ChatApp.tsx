import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useChatStore } from '../stores/useChatStore';
import { useUIStore } from '../stores/useUIStore';
import DragHeader from './DragHeader';
import MessageBubble from './MessageBubble';
import OpacitySlider from './OpacitySlider';

export default function ChatApp() {
    const user = useAuthStore((s) => s.user);
    const signOut = useAuthStore((s) => s.signOut);
    const messages = useChatStore((s) => s.messages);
    const subscribeMessages = useChatStore((s) => s.subscribeMessages);
    const sendMessage = useChatStore((s) => s.sendMessage);
    const opacity = useUIStore((s) => s.opacity);
    const position = useUIStore((s) => s.position);
    const visible = useUIStore((s) => s.visible);

    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 메시지 구독
    useEffect(() => {
        const unsubscribe = subscribeMessages();
        return () => unsubscribe();
    }, [subscribeMessages]);

    // 최신 메시지로 자동 스크롤
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !user) return;
        await sendMessage(input, user.uid, user.displayName || '익명', user.photoURL || '');
        setInput('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend(e);
        }
    };

    if (!visible) return null;

    return (
        <div
            className="chat-container"
            style={{
                '--app-opacity': opacity,
                left: `${position.x}px`,
                top: `${position.y}px`,
            } as React.CSSProperties}
        >
            <DragHeader />

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
                    <button className="toolbar__logout" onClick={signOut} title="로그아웃" aria-label="로그아웃">
                        🚪
                    </button>
                </div>
            </div>

            {/* 메시지 목록 */}
            <div className="messages">
                {messages.length === 0 && (
                    <div className="messages__empty">
                        <p>아직 메시지가 없습니다.</p>
                        <p>첫 메시지를 보내보세요! 💬</p>
                    </div>
                )}
                {messages.map((msg) => (
                    <MessageBubble
                        key={msg.id}
                        text={msg.text}
                        displayName={msg.displayName}
                        photoURL={msg.photoURL}
                        createdAt={msg.createdAt}
                        isOwn={msg.uid === user?.uid}
                    />
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* 입력 영역 */}
            <form className="input-bar" onSubmit={handleSend}>
                <input
                    className="input-bar__text"
                    type="text"
                    placeholder="메시지를 입력하세요..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                />
                <button className="input-bar__send" type="submit" disabled={!input.trim()} aria-label="전송">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 2L11 13" />
                        <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                    </svg>
                </button>
            </form>
        </div>
    );
}
