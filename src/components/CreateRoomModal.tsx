import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useChatStore, type SearchedUser } from '../stores/useChatStore';
import { useUIStore } from '../stores/useUIStore';

interface CreateRoomModalProps {
    onClose: () => void;
}

export default function CreateRoomModal({ onClose }: CreateRoomModalProps) {
    const user = useAuthStore((s) => s.user);
    const searchUsers = useChatStore((s) => s.searchUsers);
    const createRoom = useChatStore((s) => s.createRoom);
    const findExistingRoom = useChatStore((s) => s.findExistingRoom);
    const setCurrentView = useUIStore((s) => s.setCurrentView);
    const setCurrentRoomId = useUIStore((s) => s.setCurrentRoomId);

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchedUser[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<SearchedUser[]>([]);
    const [searching, setSearching] = useState(false);
    const [creating, setCreating] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const doSearch = useCallback(async (q: string) => {
        if (!q.trim()) {
            setSearchResults([]);
            setHasSearched(false);
            return;
        }
        setSearching(true);
        const results = await searchUsers(q.trim());
        setSearchResults(results.filter((u) => u.uid !== user?.uid));
        setHasSearched(true);
        setSearching(false);
    }, [searchUsers, user?.uid]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchQuery(value);
        // debounce 300ms
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => doSearch(value), 300);
    };

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    const toggleUserSelection = (u: SearchedUser) => {
        setSelectedUsers((prev) => {
            const exists = prev.find((s) => s.uid === u.uid);
            if (exists) return prev.filter((s) => s.uid !== u.uid);
            return [...prev, u];
        });
    };

    const handleCreateRoom = async () => {
        if (!user || selectedUsers.length === 0) return;
        setCreating(true);

        try {
            if (selectedUsers.length === 1) {
                const existingRoomId = await findExistingRoom(user.uid, selectedUsers[0].uid);
                if (existingRoomId) {
                    setCurrentRoomId(existingRoomId);
                    setCurrentView('chat');
                    onClose();
                    return;
                }
            }

            const type = selectedUsers.length === 1 ? 'single' : 'group';
            const participants = [user.uid, ...selectedUsers.map((u) => u.uid)];
            const participantNames: Record<string, string> = {
                [user.uid]: user.displayName || '익명',
            };
            const participantPhotos: Record<string, string> = {
                [user.uid]: user.photoURL || '',
            };
            selectedUsers.forEach((u) => {
                participantNames[u.uid] = u.displayName;
                participantPhotos[u.uid] = u.photoURL;
            });

            const roomId = await createRoom(type, participants, participantNames, participantPhotos);
            if (roomId) {
                setCurrentRoomId(roomId);
                setCurrentView('chat');
                onClose();
            }
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="create-room-modal" onClick={(e) => e.stopPropagation()}>
                <div className="create-room-modal__header">
                    <h3>새 채팅</h3>
                    <button className="create-room-modal__close" onClick={onClose} aria-label="닫기">
                        ✕
                    </button>
                </div>

                <div className="create-room-modal__search">
                    <input
                        className="create-room-modal__input"
                        type="text"
                        placeholder="이름 또는 이메일로 검색..."
                        value={searchQuery}
                        onChange={handleSearchChange}
                        autoFocus
                    />
                    {searching && <span className="create-room-modal__searching">검색 중...</span>}
                </div>

                {/* 선택된 사용자 태그 */}
                {selectedUsers.length > 0 && (
                    <div className="create-room-modal__selected">
                        {selectedUsers.map((u) => (
                            <span key={u.uid} className="create-room-modal__tag" onClick={() => toggleUserSelection(u)}>
                                {u.displayName} ✕
                            </span>
                        ))}
                    </div>
                )}

                {/* 검색 결과 */}
                <div className="create-room-modal__results">
                    {searchResults.length === 0 && !searching && hasSearched && (
                        <p className="create-room-modal__empty">검색 결과가 없습니다.</p>
                    )}
                    {searchResults.map((u) => {
                        const isSelected = selectedUsers.some((s) => s.uid === u.uid);
                        return (
                            <div
                                key={u.uid}
                                className={`create-room-modal__user ${isSelected ? 'create-room-modal__user--selected' : ''}`}
                                onClick={() => toggleUserSelection(u)}
                            >
                                <img
                                    className="create-room-modal__user-avatar"
                                    src={u.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName)}`}
                                    alt=""
                                    referrerPolicy="no-referrer"
                                />
                                <div className="create-room-modal__user-info">
                                    <span className="create-room-modal__user-name">{u.displayName}</span>
                                    <span className="create-room-modal__user-email">{u.email}</span>
                                </div>
                                <div className={`create-room-modal__check ${isSelected ? 'create-room-modal__check--active' : ''}`}>
                                    {isSelected ? '✓' : ''}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* 방 만들기 버튼 */}
                <button
                    className="create-room-modal__create-btn"
                    onClick={handleCreateRoom}
                    disabled={selectedUsers.length === 0 || creating}
                >
                    {creating
                        ? '생성 중...'
                        : selectedUsers.length <= 1
                            ? '1:1 대화 시작'
                            : `그룹 채팅 시작 (${selectedUsers.length}명)`}
                </button>
            </div>
        </div>
    );
}
