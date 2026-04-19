import { createPortal } from 'react-dom';
import type { Chore } from '@customTypes/SharedTypes';
import AddChoreForm from './AddChoreForm';

type ChoreFormModalProps = {
    onSubmit: (chore: Omit<Chore, 'id'>) => void;
    onCancel: () => void;
};

export default function ChoreFormModal({ onSubmit, onCancel }: ChoreFormModalProps) {
    function handleBackdropClick(event: React.MouseEvent<HTMLDivElement>) {
        if (event.target === event.currentTarget) {
            onCancel();
        }
    }

    return createPortal(
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 px-4 pt-4"
            onClick={handleBackdropClick}
            data-testid="chore-modal-backdrop"
        >
            <AddChoreForm onSubmit={onSubmit} onCancel={onCancel} />
        </div>,
        document.body,
    );
}
