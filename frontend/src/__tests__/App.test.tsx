import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { fetchAllChores, addChore, completeChore, removeChore } from '../services/choreApi';
import type { Chore } from '@customTypes/SharedTypes';
import { makeChore } from './fixtures/chore';

vi.mock('../services/choreApi', () => ({
    fetchAllChores: vi.fn(),
    addChore: vi.fn(),
    completeChore: vi.fn(),
    removeChore: vi.fn(),
}));

const MOCK_DAY = new Date(2025, 0, 15, 12, 0, 0);
vi.mock('../hooks/useMidnightClock', () => ({
    useMidnightClock: () => MOCK_DAY,
}));

describe('initial load', () => {
    it('shows error banner when fetchAllChores rejects', async () => {
        vi.mocked(fetchAllChores).mockRejectedValue(new Error('Network error'));

        render(<App />);

        await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
        expect(screen.queryByText('Loading chores...')).not.toBeInTheDocument();
    });
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

describe('handleCompleteChore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore()]);
        vi.mocked(removeChore).mockResolvedValue(undefined);
        vi.mocked(addChore).mockResolvedValue(makeChore());
    });

    it('calls completeChore with the chore id and current day', async () => {
        vi.mocked(completeChore).mockResolvedValue(makeChore());

        const user = userEvent.setup();
        render(<App />);

        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());
        await user.click(screen.getByText('Sweep'));

        expect(completeChore).toHaveBeenCalledWith(1, expect.any(Date));
    });

    it('rolls back and sets error when completeChore rejects', async () => {
        let rejectComplete!: (err: Error) => void;
        vi.mocked(completeChore).mockReturnValue(
            new Promise<Chore>((_, rej) => { rejectComplete = rej; })
        );

        const user = userEvent.setup();
        render(<App />);

        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());
        await user.click(screen.getByText('Sweep'));

        rejectComplete(new Error('Complete failed'));

        await waitFor(() => expect(screen.getByText('Complete failed')).toBeInTheDocument());
        expect(screen.getByText('Sweep')).toBeInTheDocument();
    });

    it('reconciles with the server-returned chore value on success', async () => {
        // Server returns a chore with a different name to distinguish from the initial value
        const serverChore = makeChore({ name: 'Sweep (reconciled)' });
        vi.mocked(completeChore).mockResolvedValue(serverChore);

        const user = userEvent.setup();
        render(<App />);

        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());
        await user.click(screen.getByText('Sweep'));

        await waitFor(() => expect(screen.getByText('Sweep (reconciled)')).toBeInTheDocument());
    });
});

describe('handleAddChore', () => {
    beforeEach(() => {
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore()]);
        vi.mocked(removeChore).mockResolvedValue(undefined);
        vi.mocked(completeChore).mockResolvedValue(makeChore());
    });

    async function openAndFillForm(container: HTMLElement, user: ReturnType<typeof userEvent.setup>) {
        await waitFor(() => expect(screen.getByText('+ Add Task')).toBeInTheDocument());
        await user.click(screen.getByText('+ Add Task'));
        await user.type(container.querySelector('input[name="name"]')!, 'Mop');
        await user.type(container.querySelector('input[name="room"]')!, 'Kitchen');
        await user.type(container.querySelector('input[name="dateLastCompleted"]')!, '2025-01-01');
        await user.type(container.querySelector('input[name="duration"]')!, '10');
        await user.type(container.querySelector('input[name="frequency"]')!, '7');
    }

    it('appends the new chore to the list on success', async () => {
        vi.mocked(addChore).mockResolvedValue(makeChore({ id: 2, name: 'Mop' }));

        const user = userEvent.setup();
        const { container } = render(<App />);

        await openAndFillForm(container, user);
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(screen.getByText('Mop')).toBeInTheDocument());
    });

    it('shows error banner when addChore rejects', async () => {
        vi.mocked(addChore).mockRejectedValue(new Error('Add failed'));

        const user = userEvent.setup();
        const { container } = render(<App />);

        await openAndFillForm(container, user);
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(screen.getByText('Add failed')).toBeInTheDocument());
    });
});

describe('frozen sort order', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(removeChore).mockResolvedValue(undefined);
    });

    it('completing a chore does not change its list position', async () => {
        const choreA = makeChore({ id: 1, name: 'Chore A', dateLastCompleted: new Date(2024, 11, 1) });
        const choreB = makeChore({ id: 2, name: 'Chore B', dateLastCompleted: new Date(2025, 0, 14) });
        vi.mocked(fetchAllChores).mockResolvedValue([choreA, choreB]);
        const updatedA = { ...choreA, dateLastCompleted: new Date(2025, 0, 15, 12, 0, 0) };
        vi.mocked(completeChore).mockResolvedValue(updatedA);
        render(<App />);
        await waitFor(() => expect(screen.getAllByTestId('chore-bar')).toHaveLength(2));
        // Capture name order before completing (names are stable; dates/counters are not)
        const namesBefore = screen.getAllByTestId('chore-bar').map(el =>
            el.textContent?.match(/Chore [AB]/)?.[0] ?? ''
        );
        fireEvent.click(screen.getAllByTestId('chore-bar')[0]);
        await waitFor(() => expect(completeChore).toHaveBeenCalled());
        const namesAfter = screen.getAllByTestId('chore-bar').map(el =>
            el.textContent?.match(/Chore [AB]/)?.[0] ?? ''
        );
        expect(namesAfter).toEqual(namesBefore);
    });
});
