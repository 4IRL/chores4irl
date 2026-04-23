import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChoreList from '../../components/chore/ChoreList';
import { makeChore } from '../fixtures/chore';

const day = new Date(2025, 0, 15, 12, 0, 0);

describe('ChoreList', () => {
    it('passes onDelete to each ChoreTimerBar instance', async () => {
        const onDelete = vi.fn();
        const chores = [
            makeChore({ id: 1, name: 'Sweep' }),
            makeChore({ id: 2, name: 'Mop' }),
        ];

        const user = userEvent.setup();
        render(
            <ChoreList
                chores={chores}
                day={day}
                isSimulating={false}
                onComplete={vi.fn()}
                onDelete={onDelete}
            />
        );

        const deleteButtons = screen.getAllByRole('button', { name: 'Delete chore' });
        expect(deleteButtons).toHaveLength(2);

        await user.click(deleteButtons[0]);
        expect(onDelete).toHaveBeenCalledWith(1);

        await user.click(deleteButtons[1]);
        expect(onDelete).toHaveBeenCalledWith(2);

        expect(onDelete).toHaveBeenCalledTimes(2);
    });

    it('renders one ChoreTimerBar per chore', () => {
        const chores = [
            makeChore({ id: 1, name: 'Sweep' }),
            makeChore({ id: 2, name: 'Mop' }),
            makeChore({ id: 3, name: 'Dust' }),
        ];

        render(
            <ChoreList
                chores={chores}
                day={day}
                isSimulating={false}
                onComplete={vi.fn()}
                onDelete={vi.fn()}
            />
        );

        expect(screen.getAllByRole('button', { name: 'Delete chore' })).toHaveLength(3);
    });

    it('renders the empty-state message when chores is empty', () => {
        render(
            <ChoreList
                chores={[]}
                day={day}
                isSimulating={false}
                onComplete={vi.fn()}
                onDelete={vi.fn()}
            />
        );

        expect(
            screen.getByText('No chores yet — tap + Add Task to get started.')
        ).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Delete chore' })).not.toBeInTheDocument();
    });
});
