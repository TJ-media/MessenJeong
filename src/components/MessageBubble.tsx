import { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useUIStore } from '../stores/useUIStore';
import { getCachedImageURL, cacheImage } from '../utils/imageCache';

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
    const [displayImageURL, setDisplayImageURL] = useState(imageURL || '');

    // 이미지 캐시 확인 → 캐시 hit이면 blob URL 사용
    useEffect(() => {
        if (!imageURL) return;
        let revoke: string | null = null;
        getCachedImageURL(imageURL).then((cachedURL) => {
            if (cachedURL) {
                revoke = cachedURL;
                setDisplayImageURL(cachedURL);
            }
        });
        return () => {
            if (revoke) URL.revokeObjectURL(revoke);
        };
    }, [imageURL]);

    const handleImageLoad = () => {
        setImgLoaded(true);
        // 로드 완료 후 백그라운드에서 캐싱
        if (imageURL) cacheImage(imageURL);
    };

    const formatTime = (ts: Timestamp | null) => {
        if (!ts) return '';
        // 캐시에서 복원된 Timestamp는 일반 객체이므로 toDate()가 없을 수 있음
        const date = typeof ts.toDate === 'function'
            ? ts.toDate()
            : new Date((ts as unknown as { seconds: number }).seconds * 1000);
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
                            src={displayImageURL}
                            alt="전송된 이미지"
                            onClick={() => openImageViewer(imageURL)}
                            onLoad={handleImageLoad}
                        />
                    )}
                    {text && <p className="message__text">{text}</p>}
                </div>
                <span className="message__time">{formatTime(createdAt)}</span>
            </div>
        </div>
    );
}
