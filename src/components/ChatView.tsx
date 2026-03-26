import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useChatStore } from '../stores/useChatStore';
import { useUIStore } from '../stores/useUIStore';
import MessageBubble from './MessageBubble';

interface PendingUpload {
    id: string;
    file: File;
    previewURL: string;
    status: 'uploading' | 'failed';
    cancelledRef: { current: boolean };
}

export default function ChatView() {
    const user = useAuthStore((s) => s.user);
    const messages = useChatStore((s) => s.messages);
    const messagesLoading = useChatStore((s) => s.messagesLoading);
    const subscribeRoomMessages = useChatStore((s) => s.subscribeRoomMessages);
    const sendMessage = useChatStore((s) => s.sendMessage);
    const uploadImage = useChatStore((s) => s.uploadImage);
    const sendImageMessage = useChatStore((s) => s.sendImageMessage);
    const rooms = useChatStore((s) => s.rooms);
    const markAsRead = useChatStore((s) => s.markAsRead);
    const currentRoomId = useUIStore((s) => s.currentRoomId);
    const setCurrentView = useUIStore((s) => s.setCurrentView);
    const setCurrentRoomId = useUIStore((s) => s.setCurrentRoomId);
    const showToast = useUIStore((s) => s.showToast);

    const [input, setInput] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [confirmFile, setConfirmFile] = useState<File | null>(null);
    const [confirmPreview, setConfirmPreview] = useState<string | null>(null);
    const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragCounterRef = useRef(0);

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
    }, [messages, pendingUploads]);

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

    // ── 이미지 관련 ──────────────────────────────

    const isImageFile = (file: File) => file.type.startsWith('image/');

    const showImageConfirm = useCallback((file: File) => {
        if (!isImageFile(file)) {
            showToast('이미지 파일만 전송할 수 있습니다.');
            return;
        }
        const url = URL.createObjectURL(file);
        setConfirmFile(file);
        setConfirmPreview(url);
    }, [showToast]);

    // 업로드 실행 (pendingUploads에 추가 후 비동기 업로드)
    const startUpload = useCallback(async (file: File, previewURL: string, uploadId?: string) => {
        if (!user || !currentRoomId) return;

        const id = uploadId || `pending_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const cancelledRef = { current: false };

        // 기존 항목이 있으면 상태를 uploading으로 변경, 없으면 추가
        setPendingUploads((prev) => {
            const exists = prev.find((p) => p.id === id);
            if (exists) {
                return prev.map((p) => p.id === id ? { ...p, status: 'uploading' as const, cancelledRef } : p);
            }
            return [...prev, { id, file, previewURL, status: 'uploading' as const, cancelledRef }];
        });

        try {
            const imageURL = await uploadImage(currentRoomId, file);
            // 업로드 도중 취소된 경우
            if (cancelledRef.current) return;
            await sendImageMessage(currentRoomId, imageURL, user.uid, user.displayName || '익명', user.photoURL || '');
            markAsRead(currentRoomId);
            // 성공: pendingUploads에서 제거
            setPendingUploads((prev) => {
                const item = prev.find((p) => p.id === id);
                if (item) URL.revokeObjectURL(item.previewURL);
                return prev.filter((p) => p.id !== id);
            });
        } catch {
            if (cancelledRef.current) return;
            // 실패: 상태 변경
            setPendingUploads((prev) =>
                prev.map((p) => p.id === id ? { ...p, status: 'failed' as const } : p)
            );
        }
    }, [user, currentRoomId, uploadImage, sendImageMessage, markAsRead]);

    // 확인 모달에서 전송 클릭 → 모달 닫고 → 채팅방에 업로드 중 버블 표시
    const handleConfirmSend = () => {
        if (!confirmFile || !confirmPreview) return;
        const file = confirmFile;
        const preview = confirmPreview;
        // 모달 즉시 닫기
        setConfirmFile(null);
        setConfirmPreview(null);
        // 업로드 시작
        startUpload(file, preview);
    };

    const handleConfirmCancel = () => {
        if (confirmPreview) URL.revokeObjectURL(confirmPreview);
        setConfirmFile(null);
        setConfirmPreview(null);
    };

    // 업로드 중 취소
    const handleUploadCancel = (id: string) => {
        setPendingUploads((prev) =>
            prev.map((p) => {
                if (p.id === id) {
                    p.cancelledRef.current = true;
                    return { ...p, status: 'failed' as const };
                }
                return p;
            })
        );
    };

    // 실패한 업로드 재전송
    const handleRetry = (id: string) => {
        const item = pendingUploads.find((p) => p.id === id);
        if (!item) return;
        startUpload(item.file, item.previewURL, id);
    };

    // 실패한 업로드 삭제
    const handleRemovePending = (id: string) => {
        setPendingUploads((prev) => {
            const item = prev.find((p) => p.id === id);
            if (item) URL.revokeObjectURL(item.previewURL);
            return prev.filter((p) => p.id !== id);
        });
    };

    // 파일 선택
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) showImageConfirm(file);
        // input value 초기화 (같은 파일 다시 선택 가능)
        e.target.value = '';
    };

    // 드래그 앤 드롭
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current++;
        if (dragCounterRef.current === 1) setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current--;
        if (dragCounterRef.current === 0) setIsDragging(false);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current = 0;
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) showImageConfirm(file);
    };

    return (
        <div
            className="chat-view"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
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
                {messagesLoading && (
                    <div className="messages__loading">
                        <div className="loading-screen__spinner" />
                    </div>
                )}
                {!messagesLoading && messages.length === 0 && pendingUploads.length === 0 && (
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
                        imageURL={msg.imageURL}
                    />
                ))}

                {/* 업로드 중 / 실패 버블 */}
                {pendingUploads.map((pending) => (
                    <div key={pending.id} className="message message--own">
                        <div className="message__content">
                            <div className="message__bubble message__bubble--pending">
                                <div className="pending-image">
                                    <img
                                        className={`message__image ${pending.status === 'failed' ? 'message__image--failed' : ''}`}
                                        src={pending.previewURL}
                                        alt="전송 중 이미지"
                                    />
                                    {pending.status === 'uploading' && (
                                        <div className="pending-image__overlay">
                                            <div className="pending-image__spinner" />
                                            <button
                                                className="pending-image__cancel"
                                                onClick={() => handleUploadCancel(pending.id)}
                                                title="전송 취소"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    )}
                                    {pending.status === 'failed' && (
                                        <div className="pending-image__actions">
                                            <button
                                                className="pending-image__btn"
                                                onClick={() => handleRetry(pending.id)}
                                                title="재전송"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M1 4v6h6M23 20v-6h-6" />
                                                    <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
                                                </svg>
                                                <span>재전송</span>
                                            </button>
                                            <button
                                                className="pending-image__btn pending-image__btn--delete"
                                                onClick={() => handleRemovePending(pending.id)}
                                                title="삭제"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M18 6L6 18M6 6l12 12" />
                                                </svg>
                                                <span>삭제</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {pending.status === 'failed' && (
                                <span className="message__time" style={{ color: '#ff6b6b' }}>전송 실패</span>
                            )}
                        </div>
                    </div>
                ))}

                <div ref={messagesEndRef} />
            </div>

            {/* 드래그 오버레이 */}
            {isDragging && (
                <div className="drop-overlay">
                    <div className="drop-overlay__content">
                        <span className="drop-overlay__icon">📷</span>
                        <span className="drop-overlay__text">이미지를 놓아주세요</span>
                    </div>
                </div>
            )}

            {/* 이미지 전송 확인 모달 */}
            {confirmFile && confirmPreview && (
                <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleConfirmCancel(); }}>
                    <div className="confirm-modal">
                        <div className="confirm-modal__header">
                            <h3>이미지 전송</h3>
                        </div>
                        <div className="confirm-modal__body">
                            <img className="confirm-modal__preview" src={confirmPreview} alt="미리보기" />
                            <p className="confirm-modal__filename">{confirmFile.name}</p>
                        </div>
                        <div className="confirm-modal__actions">
                            <button
                                className="confirm-modal__btn confirm-modal__btn--cancel"
                                onClick={handleConfirmCancel}
                            >
                                취소
                            </button>
                            <button
                                className="confirm-modal__btn confirm-modal__btn--send"
                                onClick={handleConfirmSend}
                            >
                                전송
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 입력 영역 */}
            <form className="input-bar" onSubmit={handleSend}>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                />
                <button
                    className="input-bar__attach"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="이미지 첨부"
                    title="이미지 첨부"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                    </svg>
                </button>
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
