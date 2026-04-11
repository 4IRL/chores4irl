import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChoreTimerBar from '../../components/chore/ChoreTimerBar';
import { makeChore } from '../fixtures/chore';

const day = new Date(2025, 0, 15, 12, 0, 0);

describe('ChoreTimerBar', () => {
    it('renders the delete button with correct aria-label', () => {
        render(
            <ChoreTimerBar
                chore={makeChore()}
                day={day}
                onComplete={vi.fn()}
                onDelete={vi.fn()}
            />
        );
        expect(screen.getByRole('button', { name: 'Delete chore' })).toBeInTheDocument();
    });

    it('calls onDelete with the correct chore id when delete button is clicked', async () => {
        const onDelete = vi.fn();
        const user = userEvent.setup();
        render(
            <ChoreTimerBar
                chore={makeChore({ id: 42 })}
                day={day}
                onComplete={vi.fn()}
                onDelete={onDelete}
            />
        );
        await user.click(screen.getByRole('button', { name: 'Delete chore' }));
        expect(onDelete).toHaveBeenCalledOnce();
        expect(onDelete).toHaveBeenCalledWith(42);
    });

    it('does not call onComplete when the delete button is clicked (stopPropagation)', async () => {
        const onComplete = vi.fn();
        const onDelete = vi.fn();
        const user = userEvent.setup();
        render(
            <ChoreTimerBar
                chore={makeChore()}
                day={day}
                onComplete={onComplete}
                onDelete={onDelete}
            />
        );
        await user.click(screen.getByRole('button', { name: 'Delete chore' }));
        expect(onComplete).not.toHaveBeenCalled();
        expect(onDelete).toHaveBeenCalledOnce();
    });

    it('updates displayed date when chore prop dateLastCompleted changes', () => {
        const chore = makeChore({ dateLastCompleted: new Date('2025-01-01T00:00:00.000Z') });
        const { rerender } = render(
            <ChoreTimerBar chore={chore} day={day} onComplete={vi.fn()} onDelete={vi.fn()} />
        );
        const updatedChore = { ...chore, dateLastCompleted: new Date(2025, 0, 14, 12, 0, 0) };
        rerender(
            <ChoreTimerBar chore={updatedChore} day={day} onComplete={vi.fn()} onDelete={vi.fn()} />
        );
        expect(screen.getByText('1 day ago')).toBeInTheDocument();
    });
});
