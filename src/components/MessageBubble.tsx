import { Timestamp } from 'firebase/firestore';

interface MessageBubbleProps {
    text: string;
    displayName: string;
    photoURL: string;
    createdAt: Timestamp | null;
    isOwn: boolean;
}

export default function MessageBubble({
    text,
    displayName,
    photoURL,
    createdAt,
    isOwn,
}: MessageBubbleProps) {
    const formatTime = (ts: Timestamp | null) => {
        if (!ts) return '';
        const date = ts.toDate();
        return date.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className={`message ${isOwn ? 'message--own' : 'message--other'}`}>
            {!isOwn && (
                <img
                    className="message__avatar"
                    src={photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(displayName)}
                    alt={displayName}
                    referrerPolicy="no-referrer"
                />
            )}
            <div className="message__content">
                {!isOwn && <span className="message__name">{displayName}</span>}
                <div className="message__bubble">
                    <p className="message__text">{text}</p>
                </div>
                <span className="message__time">{formatTime(createdAt)}</span>
            </div>
        </div>
    );
}
