import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useChatStore, type ChatRoom } from '../stores/useChatStore';
import { useUIStore } from '../stores/useUIStore';
import { Timestamp } from 'firebase/firestore';
import CreateRoomModal from './CreateRoomModal';

export default function RoomList() {
    const user = useAuthStore((s) => s.user);
    const rooms = useChatStore((s) => s.rooms);
    const roomsLoading = useChatStore((s) => s.roomsLoading);
    const subscribeRooms = useChatStore((s) => s.subscribeRooms);
    const unreadCounts = useChatStore((s) => s.unreadCounts);
    const subscribeUnreadCounts = useChatStore((s) => s.subscribeUnreadCounts);
    const setCurrentView = useUIStore((s) => s.setCurrentView);
    const setCurrentRoomId = useUIStore((s) => s.setCurrentRoomId);

    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        if (!user) return;
        const unsubRooms = subscribeRooms(user.uid);
        const unsubUnread = subscribeUnreadCounts(user.uid);
        return () => {
            unsubRooms();
            unsubUnread();
        };
    }, [user, subscribeRooms, subscribeUnreadCounts]);

    const handleRoomClick = (roomId: string) => {
        setCurrentRoomId(roomId);
        setCurrentView('chat');
    };

    const getRoomDisplayName = (room: ChatRoom) => {
        if (!user) return '';
        const otherUids = room.participants.filter((uid) => uid !== user.uid);
        if (otherUids.length === 0) return '나와의 대화';
        const names = otherUids.map((uid) => room.participantNames[uid] || '알 수 없음');
        return names.join(', ');
    };

    const getRoomPhoto = (room: ChatRoom) => {
        if (!user) return '';
        const otherUids = room.participants.filter((uid) => uid !== user.uid);
        if (otherUids.length === 1) {
            return room.participantPhotos[otherUids[0]] || '';
        }
        return '';
    };

    const formatTime = (ts: Timestamp | null) => {
        if (!ts) return '';
        const date = ts.toDate();
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        if (isToday) {
            return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    };

    return (
        <div className="room-list">
            <div className="room-list__header">
                <h2 className="room-list__title">채팅</h2>
                <button
                    className="room-list__new-btn"
                    onClick={() => setShowCreateModal(true)}
                    title="새 채팅"
                    aria-label="새 채팅방 만들기"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                </button>
            </div>

            <div className="room-list__items">
                {roomsLoading && (
                    <div className="room-list__loading">
                        <div className="loading-screen__spinner" />
                    </div>
                )}
                {!roomsLoading && rooms.length === 0 && (
                    <div className="room-list__empty">
                        <p>채팅방이 없습니다.</p>
                        <p>새 채팅을 시작해 보세요! 💬</p>
                    </div>
                )}
                {rooms.map((room) => (
                    <div
                        key={room.id}
                        className="room-item"
                        onClick={() => handleRoomClick(room.id)}
                    >
                        <div className="room-item__avatar-wrap">
                            {getRoomPhoto(room) ? (
                                <img
                                    className="room-item__avatar"
                                    src={getRoomPhoto(room)}
                                    alt=""
                                    referrerPolicy="no-referrer"
                                />
                            ) : (
                                <div className="room-item__avatar room-item__avatar--placeholder">
                                    {room.type === 'group' ? '👥' : '👤'}
                                </div>
                            )}
                        </div>
                        <div className="room-item__info">
                            <div className="room-item__top">
                                <span className="room-item__name">{getRoomDisplayName(room)}</span>
                                <span className="room-item__time">{formatTime(room.lastMessageAt)}</span>
                            </div>
                            <p className="room-item__last-msg">
                                {room.lastMessage || '메시지가 없습니다.'}
                            </p>
                        </div>
                        {(unreadCounts[room.id] || 0) > 0 && (
                            <span className="badge">{unreadCounts[room.id]}</span>
                        )}
                    </div>
                ))}
            </div>

            {showCreateModal && (
                <CreateRoomModal onClose={() => setShowCreateModal(false)} />
            )}
        </div>
    );
}
