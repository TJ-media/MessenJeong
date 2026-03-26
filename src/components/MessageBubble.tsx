import { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useUIStore } from '../stores/useUIStore';

interface MessageBubbleProps {
    text: string;
    displayName: string;
    photoURL: string;
    createdAt: Timestamp | null;
    isOwn: boolean;
    imageURL?: string;
}

export default function MessageBubble({
    text,
    displayName,
    photoURL,
    createdAt,
    isOwn,
    imageURL,
}: MessageBubbleProps) {
    const openImageViewer = useUIStore((s) => s.openImageViewer);
    const [imgLoaded, setImgLoaded] = useState(!imageURL);

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
                    {imageURL && (
                        <img
                            className={`message__image ${imgLoaded ? 'message__image--loaded' : 'message__image--loading'}`}
                            src={imageURL}
                            alt="전송된 이미지"
                            onClick={() => openImageViewer(imageURL)}
                            onLoad={() => setImgLoaded(true)}
                        />
                    )}
                    {text && <p className="message__text">{text}</p>}
                </div>
                <span className="message__time">{formatTime(createdAt)}</span>
            </div>
        </div>
    );
}
