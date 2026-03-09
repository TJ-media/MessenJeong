interface ErrorScreenProps {
    title?: string;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
    icon?: string;
}

export default function ErrorScreen({
    title = '오류가 발생했습니다',
    message,
    actionLabel,
    onAction,
    icon = '⚠️',
}: ErrorScreenProps) {
    return (
        <div className="error-screen">
            <div className="error-screen__card">
                <div className="error-screen__icon">{icon}</div>
                <h2 className="error-screen__title">{title}</h2>
                <p className="error-screen__message">{message}</p>
                {actionLabel && onAction && (
                    <button className="error-screen__btn" onClick={onAction}>
                        {actionLabel}
                    </button>
                )}
            </div>
        </div>
    );
}
