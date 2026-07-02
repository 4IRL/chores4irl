import { createPortal } from 'react-dom';
import type { Chore } from '@customTypes/SharedTypes';
import ChoreForm from './ChoreForm';

type ChoreFormModalProps = {
    mode?: 'add' | 'edit';
    initialChore?: Chore;
    rooms?: string[];
    onSubmit: (chore: Omit<Chore, 'id'>) => void;
    onCancel: () => void;
};

export default function ChoreFormModal({ mode, initialChore, rooms, onSubmit, onCancel }: ChoreFormModalProps) {
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
            <ChoreForm mode={mode} initialChore={initialChore} rooms={rooms} onSubmit={onSubmit} onCancel={onCancel} />
        </div>,
        document.body,
    );
}
