import { createPortal } from 'react-dom';

type ConfirmDialogProps = {
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
};

export default function ConfirmDialog({
    message,
    confirmLabel = 'Delete',
    cancelLabel = 'Cancel',
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    function handleBackdropClick(event: React.MouseEvent<HTMLDivElement>) {
        if (event.target === event.currentTarget) {
            onCancel();
        }
    }

    return createPortal(
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
            onClick={handleBackdropClick}
            data-testid="confirm-dialog-backdrop"
            role="dialog"
            aria-modal="true"
        >
            <div className="bg-gray-800 rounded-xl p-6 w-full max-w-sm">
                <p className="text-white text-base mb-6">{message}</p>
                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        data-testid="confirm-dialog-cancel"
                        className="px-4 py-2 rounded-full bg-gray-600 hover:bg-gray-500 text-white text-sm"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        data-testid="confirm-dialog-confirm"
                        className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white text-sm"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
