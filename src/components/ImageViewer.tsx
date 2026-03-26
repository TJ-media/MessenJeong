import { useUIStore } from '../stores/useUIStore';

export default function ImageViewer() {
    const imageViewerURL = useUIStore((s) => s.imageViewerURL);
    const closeImageViewer = useUIStore((s) => s.closeImageViewer);

    if (!imageViewerURL) return null;

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            closeImageViewer();
        }
    };

    return (
        <div className="image-viewer" onClick={handleOverlayClick}>
            <button
                className="image-viewer__close"
                onClick={closeImageViewer}
                aria-label="닫기"
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                </svg>
            </button>
            <img
                className="image-viewer__img"
                src={imageViewerURL}
                alt="원본 이미지"
            />
        </div>
    );
}
