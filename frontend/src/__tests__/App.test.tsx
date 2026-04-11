import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { fetchAllChores, addChore, completeChore, removeChore } from '../services/choreApi';
import type { Chore } from '@customTypes/SharedTypes';

vi.mock('../services/choreApi', () => ({
    fetchAllChores: vi.fn(),
    addChore: vi.fn(),
    completeChore: vi.fn(),
    removeChore: vi.fn(),
}));

vi.mock('../hooks/useTimeSimulation', () => ({
    useTimeSimulation: () => new Date(2025, 0, 15, 12, 0, 0),
}));

const makeChore = (overrides: Partial<Chore> = {}): Chore => ({
    id: 1,
    name: 'Sweep',
    room: 'Kitchen',
    dateLastCompleted: new Date('2025-01-01T00:00:00.000Z'),
    duration: 10,
    frequency: 7,
    ...overrides,
});

describe('handleDeleteChore', () => {
    beforeEach(() => {
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore()]);
        vi.mocked(addChore).mockResolvedValue(makeChore());
        vi.mocked(completeChore).mockResolvedValue(makeChore());
    });

    it('optimistically removes the chore, rolls back on failure, and sets error', async () => {
        let rejectRemove!: (err: Error) => void;
        vi.mocked(removeChore).mockReturnValue(
            new Promise<void>((_, rej) => { rejectRemove = rej; })
        );

        const user = userEvent.setup();
        render(<App />);

        // Wait for chore to load
        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Delete chore' })).toBeInTheDocument()
        );

        // Click delete — optimistic remove fires synchronously before removeChore resolves
        await user.click(screen.getByRole('button', { name: 'Delete chore' }));

        // Optimistic remove: chore is gone from the DOM
        expect(screen.queryByRole('button', { name: 'Delete chore' })).not.toBeInTheDocument();

        // Reject the in-flight request — triggers rollback and error state
        rejectRemove(new Error('Delete failed'));

        // Rollback: chore reappears
        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Delete chore' })).toBeInTheDocument()
        );

        // Error state is set
        expect(screen.getByText('Delete failed')).toBeInTheDocument();
    });
});
