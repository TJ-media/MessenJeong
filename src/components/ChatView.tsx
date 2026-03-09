import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useChatStore } from '../stores/useChatStore';
import { useUIStore } from '../stores/useUIStore';
import MessageBubble from './MessageBubble';

export default function ChatView() {
    const user = useAuthStore((s) => s.user);
    const messages = useChatStore((s) => s.messages);
    const subscribeRoomMessages = useChatStore((s) => s.subscribeRoomMessages);
    const sendMessage = useChatStore((s) => s.sendMessage);
    const rooms = useChatStore((s) => s.rooms);
    const markAsRead = useChatStore((s) => s.markAsRead);
    const currentRoomId = useUIStore((s) => s.currentRoomId);
    const setCurrentView = useUIStore((s) => s.setCurrentView);
    const setCurrentRoomId = useUIStore((s) => s.setCurrentRoomId);

    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 현재 방 정보
    const currentRoom = rooms.find((r) => r.id === currentRoomId);

    const getRoomTitle = () => {
        if (!currentRoom || !user) return '채팅';
        const otherUids = currentRoom.participants.filter((uid) => uid !== user.uid);
        if (otherUids.length === 0) return '나와의 대화';
        const names = otherUids.map((uid) => currentRoom.participantNames[uid] || '알 수 없음');
        return names.join(', ');
    };

    // 메시지 구독
    useEffect(() => {
        if (!currentRoomId) return;
        markAsRead(currentRoomId);
        const unsubscribe = subscribeRoomMessages(currentRoomId);
        return () => unsubscribe();
    }, [currentRoomId, subscribeRoomMessages, markAsRead]);

    // 최신 메시지로 자동 스크롤
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !user || !currentRoomId) return;
        const text = input;
        setInput('');
        await sendMessage(currentRoomId, text, user.uid, user.displayName || '익명', user.photoURL || '');
        // 보낸 사람은 즉시 읽음 처리
        markAsRead(currentRoomId);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // IME 한글 조합 중 Enter 방지
        if (e.nativeEvent.isComposing) return;
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend(e);
        }
    };

    const handleBack = () => {
        setCurrentRoomId(null);
        setCurrentView('roomList');
    };

    return (
        <div className="chat-view">
            {/* 채팅방 헤더 */}
            <div className="chat-view__header">
                <button className="chat-view__back" onClick={handleBack} title="뒤로" aria-label="채팅방 목록으로">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                </button>
                <span className="chat-view__title">{getRoomTitle()}</span>
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
