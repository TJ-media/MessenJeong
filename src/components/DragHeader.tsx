import { useCallback, useEffect, useRef } from 'react';
import { useUIStore } from '../stores/useUIStore';
import { useChatStore } from '../stores/useChatStore';

export default function DragHeader() {
    const setVisible = useUIStore((s) => s.setVisible);
    const setMinimized = useUIStore((s) => s.setMinimized);
    const isMinimized = useUIStore((s) => s.isMinimized);
    const setPosition = useUIStore((s) => s.setPosition);
    const position = useUIStore((s) => s.position);
    const totalUnread = useChatStore((s) => s.totalUnread);

    const isDragging = useRef(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            // 닫기/최소화 버튼 클릭 시 드래그 방지
            if ((e.target as HTMLElement).closest('.drag-header__close, .drag-header__minimize')) return;
            isDragging.current = true;
            dragOffset.current = {
                x: e.clientX - position.x,
                y: e.clientY - position.y,
            };
            e.preventDefault();
        },
        [position]
    );

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!isDragging.current) return;
            setPosition({
                x: e.clientX - dragOffset.current.x,
                y: e.clientY - dragOffset.current.y,
            });
        },
        [setPosition]
    );

    const handleMouseUp = useCallback(() => {
        isDragging.current = false;
    }, []);

    useEffect(() => {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    const handleClose = () => {
        setVisible(false);
    };

    const handleMinimize = () => {
        setMinimized(!isMinimized);
    };

    return (
        <div className="drag-header" onMouseDown={handleMouseDown}>
            <span className="drag-header__label">
                메신정
                {isMinimized && totalUnread > 0 && (
                    <span className="badge">{totalUnread}</span>
                )}
            </span>
            <div className="drag-header__actions">
                <button
                    className="drag-header__minimize"
                    onClick={handleMinimize}
                    title={isMinimized ? '확장' : '최소화'}
                    aria-label={isMinimized ? '위젯 확장' : '위젯 최소화'}
                >
                    {isMinimized ? '□' : '−'}
                </button>
                <button
                    className="drag-header__close"
                    onClick={handleClose}
                    title="닫기"
                    aria-label="위젯 닫기"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}
