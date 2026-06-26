import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from '../../components/common/ConfirmDialog';

describe('ConfirmDialog', () => {
    it('renders the message prop text', () => {
        render(
            <ConfirmDialog
                message={'Delete "Sweep"? This can\'t be undone.'}
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />,
        );

        expect(
            screen.getByText('Delete "Sweep"? This can\'t be undone.'),
        ).toBeInTheDocument();
    });

    it('calls onConfirm once and not onCancel when the confirm button is clicked', async () => {
        const user = userEvent.setup();
        const onConfirm = vi.fn();
        const onCancel = vi.fn();
        render(
            <ConfirmDialog
                message={'Delete "Sweep"? This can\'t be undone.'}
                onConfirm={onConfirm}
                onCancel={onCancel}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'Delete' }));

        expect(onConfirm).toHaveBeenCalledOnce();
        expect(onCancel).not.toHaveBeenCalled();
    });

    it('calls onCancel once and not onConfirm when the cancel button is clicked', async () => {
        const user = userEvent.setup();
        const onConfirm = vi.fn();
        const onCancel = vi.fn();
        render(
            <ConfirmDialog
                message={'Delete "Sweep"? This can\'t be undone.'}
                onConfirm={onConfirm}
                onCancel={onCancel}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(onCancel).toHaveBeenCalledOnce();
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('calls onCancel once when the backdrop itself is clicked', async () => {
        const user = userEvent.setup();
        const onCancel = vi.fn();
        render(
            <ConfirmDialog
                message={'Delete "Sweep"? This can\'t be undone.'}
                onConfirm={vi.fn()}
                onCancel={onCancel}
            />,
        );

        await user.click(screen.getByTestId('confirm-dialog-backdrop'));

        expect(onCancel).toHaveBeenCalledOnce();
    });

    it('does not call onCancel via the backdrop handler when a child inside the panel is clicked', async () => {
        const user = userEvent.setup();
        const onCancel = vi.fn();
        render(
            <ConfirmDialog
                message={'Delete "Sweep"? This can\'t be undone.'}
                onConfirm={vi.fn()}
                onCancel={onCancel}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'Delete' }));

        expect(onCancel).not.toHaveBeenCalled();
    });
});
