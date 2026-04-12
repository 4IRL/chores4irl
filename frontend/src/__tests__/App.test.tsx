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
const mockUseMidnightClock = vi.hoisted(() => {
    // Must duplicate MOCK_DAY literal — vi.hoisted runs before module-level consts are assigned
    const defaultDay = new Date(2025, 0, 15, 12, 0, 0);
    return vi.fn(() => defaultDay);
});
vi.mock('../hooks/useMidnightClock', () => ({
    useMidnightClock: mockUseMidnightClock,
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

        render(<App />);

        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        const fixedNow = new Date(2025, 0, 15, 14, 0, 0);
        vi.useFakeTimers({ now: fixedNow });
        try {
            fireEvent.click(screen.getByText('Sweep'));
        } finally {
            vi.useRealTimers();
        }

        expect(completeChore).toHaveBeenCalledWith(1, fixedNow);
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
        vi.mocked(completeChore).mockResolvedValue(makeChore());
        mockUseMidnightClock.mockReturnValue(MOCK_DAY);
    });

    it('adding a chore appends it to the end without re-sorting', async () => {
        // choreB is more urgent than choreA — on load, orderChores puts choreB first
        const choreA = makeChore({ id: 1, name: 'Chore A', dateLastCompleted: new Date(2025, 0, 14), duration: 10, frequency: 7 });
        const choreB = makeChore({ id: 2, name: 'Chore B', dateLastCompleted: new Date(2024, 11, 1), duration: 10, frequency: 7 });
        vi.mocked(fetchAllChores).mockResolvedValue([choreA, choreB]);
        // choreC has an even older date — would sort before both if re-sorted, so it must appear at the end
        const choreC = makeChore({ id: 3, name: 'Chore C', dateLastCompleted: new Date(2020, 0, 1), duration: 10, frequency: 7 });
        vi.mocked(addChore).mockResolvedValue(choreC);

        const user = userEvent.setup();
        const { container } = render(<App />);

        await waitFor(() => expect(screen.getAllByTestId('chore-bar')).toHaveLength(2));

        // Verify initial frozen order: choreB (most urgent) first, choreA second
        const namesBefore = screen.getAllByTestId('chore-bar').map(el =>
            el.textContent?.match(/Chore [AB]/)?.[0] ?? ''
        );
        expect(namesBefore).toEqual(['Chore B', 'Chore A']);

        // Add choreC via the form
        await user.click(screen.getByText('+ Add Task'));
        await user.type(container.querySelector('input[name="name"]')!, 'Chore C');
        await user.type(container.querySelector('input[name="room"]')!, 'Kitchen');
        await user.type(container.querySelector('input[name="dateLastCompleted"]')!, '2020-01-01');
        await user.type(container.querySelector('input[name="duration"]')!, '10');
        await user.type(container.querySelector('input[name="frequency"]')!, '7');
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(screen.getAllByTestId('chore-bar')).toHaveLength(3));

        // Chore C must appear at the END — frozen sort order, not re-sorted by urgency
        const namesAfter = screen.getAllByTestId('chore-bar').map(el =>
            el.textContent?.match(/Chore [ABC]/)?.[0] ?? ''
        );
        expect(namesAfter).toEqual(['Chore B', 'Chore A', 'Chore C']);
    });

    it('rolling back a failed delete restores the original sort order', async () => {
        const choreA = makeChore({ id: 1, name: 'Chore A', dateLastCompleted: new Date(2024, 11, 1), duration: 10, frequency: 7 });
        const choreB = makeChore({ id: 2, name: 'Chore B', dateLastCompleted: new Date(2025, 0, 14), duration: 10, frequency: 7 });
        vi.mocked(fetchAllChores).mockResolvedValue([choreA, choreB]);

        let rejectRemove!: (err: Error) => void;
        vi.mocked(removeChore).mockReturnValue(
            new Promise<void>((_, rej) => { rejectRemove = rej; })
        );

        const user = userEvent.setup();
        render(<App />);

        await waitFor(() => expect(screen.getAllByTestId('chore-bar')).toHaveLength(2));

        // Capture initial rendered order before delete (order depends on real clock initial sort)
        const orderBefore = screen.getAllByTestId('chore-bar').map(el =>
            el.textContent?.match(/Chore [AB]/)?.[0] ?? ''
        );

        // Delete the first chore in the rendered list — optimistic remove fires immediately
        await user.click(screen.getAllByRole('button', { name: 'Delete chore' })[0]);
        await waitFor(() => expect(screen.getAllByTestId('chore-bar')).toHaveLength(1));

        // Reject the in-flight request — triggers rollback of both choreData and sortedIds
        rejectRemove(new Error('Delete failed'));

        await waitFor(() => expect(screen.getAllByTestId('chore-bar')).toHaveLength(2));

        // Both chores must be back and in the original order (sortedIds rolled back)
        const orderAfter = screen.getAllByTestId('chore-bar').map(el =>
            el.textContent?.match(/Chore [AB]/)?.[0] ?? ''
        );
        expect(orderAfter).toEqual(orderBefore);
        expect(screen.getByText('Delete failed')).toBeInTheDocument();
    });

    it('midnight re-sort recalculates sortedIds when day advances', async () => {
        // The initial fetch effect in App.tsx calls `new Date()` directly (not the mocked day),
        // so the initial sort order is unpredictable in tests. Drive ordering exclusively via
        // [day]-effect rerenders. Use three day values:
        //   MOCK_DAY → data loads → advance to day1 → [day] effect fires → advance to day2 → [day] effect fires
        //
        // choreA: dateLastCompleted=Jan 15, freq=1, dur=10
        //   day1(Jan 16) score: 10*(1/1)=10;   day2(Jan 20) score: 10*(5/1)=50
        // choreB: dateLastCompleted=Jan 5, freq=7, dur=10
        //   day1(Jan 16) score: 10*(11/7)≈15.7; day2(Jan 20) score: 10*(15/7)≈21.4
        //   → day1 order: [B, A];  day2 order: [A, B]
        const day1 = new Date(2025, 0, 16, 12, 0, 0); // one day after MOCK_DAY
        const day2 = new Date(2025, 0, 20, 12, 0, 0);

        const choreA = makeChore({ id: 1, name: 'Chore A', dateLastCompleted: new Date(2025, 0, 15), duration: 10, frequency: 1 });
        const choreB = makeChore({ id: 2, name: 'Chore B', dateLastCompleted: new Date(2025, 0, 5), duration: 10, frequency: 7 });
        vi.mocked(fetchAllChores).mockResolvedValue([choreA, choreB]);

        const { rerender } = render(<App />); // starts with MOCK_DAY = Jan 15
        await waitFor(() => expect(screen.getAllByTestId('chore-bar')).toHaveLength(2));

        // Advance to day1 (Jan 16): [day] effect fires, re-sorts at day1 → [B, A]
        mockUseMidnightClock.mockReturnValue(day1);
        rerender(<App />);

        await waitFor(() => {
            expect(screen.getAllByTestId('chore-bar').map(el =>
                el.textContent?.match(/Chore [AB]/)?.[0] ?? ''
            )).toEqual(['Chore B', 'Chore A']);
        });

        // Advance to day2 (Jan 20): [day] effect fires again, re-sorts at day2 → [A, B]
        mockUseMidnightClock.mockReturnValue(day2);
        rerender(<App />);

        await waitFor(() => {
            expect(screen.getAllByTestId('chore-bar').map(el =>
                el.textContent?.match(/Chore [AB]/)?.[0] ?? ''
            )).toEqual(['Chore A', 'Chore B']);
        });
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
