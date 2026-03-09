import { useCallback, useEffect, useRef } from 'react';
import { useUIStore } from '../stores/useUIStore';

export default function DragHeader() {
    const setVisible = useUIStore((s) => s.setVisible);
    const setPosition = useUIStore((s) => s.setPosition);
    const position = useUIStore((s) => s.position);

    const isDragging = useRef(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            // 닫기 버튼 클릭 시 드래그 방지
            if ((e.target as HTMLElement).closest('.drag-header__close')) return;
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

    return (
        <div className="drag-header" onMouseDown={handleMouseDown}>
            <span className="drag-header__label">메신정</span>
            <button
                className="drag-header__close"
                onClick={handleClose}
                title="닫기"
                aria-label="위젯 닫기"
            >
                ✕
            </button>
        </div>
    );
}
