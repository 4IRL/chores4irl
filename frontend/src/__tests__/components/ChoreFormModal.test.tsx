import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChoreFormModal from '../../components/form/ChoreFormModal';

describe('ChoreFormModal backdrop click', () => {
    it('calls onCancel when the backdrop itself is clicked', async () => {
        const user = userEvent.setup();
        const onCancel = vi.fn();
        render(<ChoreFormModal onSubmit={vi.fn()} onCancel={onCancel} />);

        const backdrop = screen.getByTestId('chore-modal-backdrop');

        await user.click(backdrop);
        expect(onCancel).toHaveBeenCalledOnce();
    });

    it('does not call onCancel when a child element inside the modal is clicked', async () => {
        const user = userEvent.setup();
        const onCancel = vi.fn();
        render(<ChoreFormModal onSubmit={vi.fn()} onCancel={onCancel} />);

        await user.click(screen.getByLabelText('Name'));
        expect(onCancel).not.toHaveBeenCalled();
    });
});
