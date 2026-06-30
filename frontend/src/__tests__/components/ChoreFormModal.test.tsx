import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChoreFormModal from '../../components/form/ChoreFormModal';
import { makeChore } from '../fixtures/chore';

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

describe('ChoreFormModal edit mode', () => {
    it('pre-populates the form', () => {
        render(
            <ChoreFormModal
                mode="edit"
                initialChore={makeChore({ name: 'Mop' })}
                onSubmit={vi.fn()}
                onCancel={vi.fn()}
            />,
        );

        expect(screen.getByLabelText('Name')).toHaveValue('Mop');
        expect(screen.getByText('Edit Chore')).toBeInTheDocument();
    });
});

describe('ChoreFormModal rooms prop', () => {
    it('forwards the rooms prop into the room datalist', () => {
        render(
            <ChoreFormModal
                rooms={['Kitchen', 'Garage']}
                onSubmit={vi.fn()}
                onCancel={vi.fn()}
            />,
        );

        const roomInput = screen.getByLabelText('Room');
        expect(roomInput).toHaveAttribute('list', 'room-options');

        const datalist = document.getElementById('room-options');
        expect(datalist).not.toBeNull();
        expect(Array.from(datalist!.querySelectorAll('option')).map(o => o.getAttribute('value'))).toEqual([
            'Kitchen',
            'Garage',
        ]);
    });
});
