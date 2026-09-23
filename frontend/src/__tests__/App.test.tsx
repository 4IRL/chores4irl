import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { fetchAllChores, addChore, completeChore, removeChore, updateChore } from '../services/choreApi';
import type { Chore } from '@customTypes/SharedTypes';
import { makeChore } from './fixtures/chore';

vi.mock('../services/choreApi', () => ({
    fetchAllChores: vi.fn(),
    addChore: vi.fn(),
    completeChore: vi.fn(),
    removeChore: vi.fn(),
    updateChore: vi.fn(),
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
vi.mock('../hooks/useScreenBlank', () => ({
    useScreenBlank: () => ({ isBlanked: false, wake: () => {} }),
}));
vi.mock('../hooks/useTouchLock', () => ({
    useTouchLock: () => ({ isLocked: false, arm: () => {} }),
}));

function swipe(bar: HTMLElement, fromX: number, toX: number) {
    fireEvent.mouseDown(bar, { clientX: fromX, clientY: 50 });
    fireEvent.mouseMove(bar, { clientX: (fromX + toX) / 2, clientY: 50 });
    fireEvent.mouseMove(bar, { clientX: toX, clientY: 50 });
    fireEvent.mouseUp(bar, { clientX: toX, clientY: 50 });
}

// jsdom reports 0 for layout, so the 25%-of-width confirm threshold never trips.
// Stub the measured wrapper's width so a full-width drag crosses the threshold.
function stubBarWidth(bar: HTMLElement, width = 400) {
    const measured = bar.parentElement as HTMLElement;
    measured.getBoundingClientRect = () =>
        ({ width, height: 64, top: 0, left: 0, right: width, bottom: 64, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
}

async function openAndFillForm(user: ReturnType<typeof userEvent.setup>) {
    await waitFor(() => expect(screen.getByText('+ Add Task')).toBeInTheDocument());
    await user.click(screen.getByText('+ Add Task'));
    await user.type(screen.getByLabelText('Name'), 'Mop');
    await user.type(screen.getByLabelText('Room'), 'Kitchen');
    await user.clear(screen.getByLabelText('Last Completed'));
    await user.type(screen.getByLabelText('Last Completed'), '2025-01-01');
    await user.type(screen.getByLabelText('Duration (minutes)'), '10');
    await user.type(screen.getByLabelText('Frequency (days)'), '7');
}

describe('swipe gestures', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);
        vi.mocked(addChore).mockResolvedValue(makeChore());
        vi.mocked(completeChore).mockResolvedValue(makeChore());
        vi.mocked(removeChore).mockResolvedValue(undefined);
    });

    it('swiping a bar right opens the delete confirmation without deleting yet', async () => {
        render(<App />);

        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        const bar = screen.getAllByTestId('chore-bar')[0];
        stubBarWidth(bar);
        swipe(bar, 50, 300);

        expect(await screen.findByTestId('confirm-dialog-confirm')).toBeInTheDocument();
        expect(removeChore).not.toHaveBeenCalled();
    });

    it('swiping a bar left opens the pre-populated edit modal', async () => {
        render(<App />);

        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        const bar = screen.getAllByTestId('chore-bar')[0];
        stubBarWidth(bar);
        swipe(bar, 350, 100);

        expect(await screen.findByText('Edit Chore')).toBeInTheDocument();
        expect(screen.getByLabelText('Name')).toHaveValue('Sweep');
    });
});

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

        // Click delete — opens the confirm dialog
        await user.click(screen.getByRole('button', { name: 'Delete chore' }));

        // Confirm the deletion — optimistic remove fires synchronously before removeChore resolves
        await user.click(screen.getByTestId('confirm-dialog-confirm'));

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

describe('delete confirmation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore()]);
        vi.mocked(removeChore).mockResolvedValue(undefined);
    });

    it('opens the dialog and does not delete yet', async () => {
        const user = userEvent.setup();
        render(<App />);

        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Delete chore' })).toBeInTheDocument()
        );

        await user.click(screen.getByRole('button', { name: 'Delete chore' }));

        expect(screen.getByTestId('confirm-dialog-backdrop')).toBeInTheDocument();
        expect(screen.getByText('Delete "Sweep"? This can\'t be undone.')).toBeInTheDocument();
        expect(removeChore).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Delete chore' })).toBeInTheDocument();
    });

    it('deletes the chore when Confirm is clicked', async () => {
        const user = userEvent.setup();
        render(<App />);

        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Delete chore' })).toBeInTheDocument()
        );

        await user.click(screen.getByRole('button', { name: 'Delete chore' }));
        await user.click(screen.getByTestId('confirm-dialog-confirm'));

        expect(removeChore).toHaveBeenCalledWith(1);
        expect(screen.queryByText('Sweep')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Delete chore' })).not.toBeInTheDocument();
        expect(screen.queryByTestId('confirm-dialog-backdrop')).not.toBeInTheDocument();
    });

    it('does not delete the chore when Cancel is clicked', async () => {
        const user = userEvent.setup();
        render(<App />);

        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Delete chore' })).toBeInTheDocument()
        );

        await user.click(screen.getByRole('button', { name: 'Delete chore' }));
        await user.click(screen.getByTestId('confirm-dialog-cancel'));

        expect(removeChore).not.toHaveBeenCalled();
        expect(screen.queryByTestId('confirm-dialog-backdrop')).not.toBeInTheDocument();
        expect(screen.getByText('Sweep')).toBeInTheDocument();
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

describe('handleEditChore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);
        vi.mocked(addChore).mockResolvedValue(makeChore());
        vi.mocked(completeChore).mockResolvedValue(makeChore());
        vi.mocked(removeChore).mockResolvedValue(undefined);
    });

    it('opens a pre-populated edit modal from the pencil button', async () => {
        const user = userEvent.setup();
        render(<App />);

        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Edit chore' })).toBeInTheDocument()
        );

        await user.click(screen.getByRole('button', { name: 'Edit chore' }));

        expect(screen.getByText('Edit Chore')).toBeInTheDocument();
        expect(screen.getByLabelText('Name')).toHaveValue('Sweep');
    });

    it('optimistically updates the chore and reconciles on success', async () => {
        vi.mocked(updateChore).mockResolvedValue(makeChore({ id: 1, name: 'Sweep Edited', room: 'Kitchen' }));

        const user = userEvent.setup();
        render(<App />);

        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Edit chore' })).toBeInTheDocument()
        );

        await user.click(screen.getByRole('button', { name: 'Edit chore' }));
        await user.clear(screen.getByLabelText('Name'));
        await user.type(screen.getByLabelText('Name'), 'Sweep Edited');
        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        await waitFor(() => expect(screen.getByText('Sweep Edited')).toBeInTheDocument());
        expect(screen.queryByText('Edit Chore')).not.toBeInTheDocument();
    });

    it('rolls back and sets error when updateChore rejects', async () => {
        let rejectEdit!: (err: Error) => void;
        vi.mocked(updateChore).mockReturnValue(
            new Promise<Chore>((_, rej) => { rejectEdit = rej; })
        );

        const user = userEvent.setup();
        render(<App />);

        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Edit chore' })).toBeInTheDocument()
        );

        await user.click(screen.getByRole('button', { name: 'Edit chore' }));
        await user.clear(screen.getByLabelText('Name'));
        await user.type(screen.getByLabelText('Name'), 'Sweep Edited');
        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        // Optimistic update applied
        expect(screen.getByText('Sweep Edited')).toBeInTheDocument();

        rejectEdit(new Error('Edit failed'));

        await waitFor(() => expect(screen.getByText('Edit failed')).toBeInTheDocument());
        expect(screen.getByText('Sweep')).toBeInTheDocument();
    });

    it('Cancel closes the edit modal without saving', async () => {
        const user = userEvent.setup();
        render(<App />);

        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Edit chore' })).toBeInTheDocument()
        );

        await user.click(screen.getByRole('button', { name: 'Edit chore' }));
        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(screen.queryByText('Edit Chore')).not.toBeInTheDocument();
        expect(vi.mocked(updateChore)).not.toHaveBeenCalled();
        expect(screen.getByText('Sweep')).toBeInTheDocument();
    });

    it('editing does NOT change list position (frozen sort, Decision 7)', async () => {
        const choreA = makeChore({ id: 1, name: 'Chore A', duration: 60 });
        const choreB = makeChore({ id: 2, name: 'Chore B', duration: 5 });
        vi.mocked(fetchAllChores).mockResolvedValue([choreA, choreB]);
        vi.mocked(updateChore).mockResolvedValue(makeChore({ id: 2, name: 'Chore B', duration: 999 }));

        const user = userEvent.setup();
        render(<App />);

        await waitFor(() => expect(screen.getAllByTestId('chore-bar')).toHaveLength(2));

        const orderBefore = screen.getAllByTestId('chore-bar').map(el =>
            el.textContent?.match(/Chore [AB]/)?.[0] ?? ''
        );

        // Edit the SECOND rendered bar, bumping its duration high so it would sort first if re-sorted
        await user.click(screen.getAllByRole('button', { name: 'Edit chore' })[1]);
        await user.clear(screen.getByLabelText('Duration (minutes)'));
        await user.type(screen.getByLabelText('Duration (minutes)'), '999');
        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        await waitFor(() => expect(screen.queryByText('Edit Chore')).not.toBeInTheDocument());

        const orderAfter = screen.getAllByTestId('chore-bar').map(el =>
            el.textContent?.match(/Chore [AB]/)?.[0] ?? ''
        );
        expect(orderAfter).toEqual(orderBefore);
    });
});

describe('handleAddChore', () => {
    beforeEach(() => {
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore()]);
        vi.mocked(removeChore).mockResolvedValue(undefined);
        vi.mocked(completeChore).mockResolvedValue(makeChore());
    });

    it('appends the new chore to the list on success', async () => {
        vi.mocked(addChore).mockResolvedValue(makeChore({ id: 2, name: 'Mop' }));

        const user = userEvent.setup();
        render(<App />);

        await openAndFillForm(user);
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(screen.getByText('Mop')).toBeInTheDocument());
    });

    it('shows error banner when addChore rejects', async () => {
        vi.mocked(addChore).mockRejectedValue(new Error('Add failed'));

        const user = userEvent.setup();
        render(<App />);

        await openAndFillForm(user);
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(screen.getByText('Add failed')).toBeInTheDocument());
    });

    it('pre-fills Room with the active room tab (F21)', async () => {
        const user = userEvent.setup();
        render(<App />);

        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());
        await user.click(screen.getByRole('button', { name: 'Kitchen' }));
        await user.click(screen.getByText('+ Add Task'));

        expect(screen.getByLabelText('Room')).toHaveValue('Kitchen');
    });

    it('leaves Room empty under the All tab (F21)', async () => {
        const user = userEvent.setup();
        render(<App />);

        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());
        await user.click(screen.getByText('+ Add Task'));

        expect(screen.getByLabelText('Room')).toHaveValue('');
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
        // choreB is further overdue (red) than choreA — on load, orderChores puts choreB first
        const choreA = makeChore({ id: 1, name: 'Chore A', dateLastCompleted: new Date(2025, 0, 14), duration: 10, frequency: 7 });
        const choreB = makeChore({ id: 2, name: 'Chore B', dateLastCompleted: new Date(2024, 11, 1), duration: 10, frequency: 7 });
        vi.mocked(fetchAllChores).mockResolvedValue([choreA, choreB]);
        // choreC has an even older date — would sort before both if re-sorted, so it must appear at the end
        const choreC = makeChore({ id: 3, name: 'Chore C', dateLastCompleted: new Date(2020, 0, 1), duration: 10, frequency: 7 });
        vi.mocked(addChore).mockResolvedValue(choreC);

        const user = userEvent.setup();
        render(<App />);

        await waitFor(() => expect(screen.getAllByTestId('chore-bar')).toHaveLength(2));

        // Verify initial frozen order: choreB (red, furthest overdue) first, choreA second
        const namesBefore = screen.getAllByTestId('chore-bar').map(el =>
            el.textContent?.match(/Chore [AB]/)?.[0] ?? ''
        );
        expect(namesBefore).toEqual(['Chore B', 'Chore A']);

        // Add choreC via the form
        await user.click(screen.getByText('+ Add Task'));
        await user.type(screen.getByLabelText('Name'), 'Chore C');
        await user.type(screen.getByLabelText('Room'), 'Kitchen');
        await user.clear(screen.getByLabelText('Last Completed'));
        await user.type(screen.getByLabelText('Last Completed'), '2020-01-01');
        await user.type(screen.getByLabelText('Duration (minutes)'), '10');
        await user.type(screen.getByLabelText('Frequency (days)'), '7');
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(screen.getAllByTestId('chore-bar')).toHaveLength(3));

        // Chore C must appear at the END — frozen sort order, not re-sorted
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

        // Capture initial rendered order before delete (initial sort at mocked MOCK_DAY)
        const orderBefore = screen.getAllByTestId('chore-bar').map(el =>
            el.textContent?.match(/Chore [AB]/)?.[0] ?? ''
        );

        // Delete the first chore in the rendered list — confirm to fire optimistic remove
        await user.click(screen.getAllByRole('button', { name: 'Delete chore' })[0]);
        await user.click(screen.getByTestId('confirm-dialog-confirm'));
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
        // The initial load sorts via reconcileChores at the mocked MOCK_DAY (Jan 15): A green,
        // B red → [B, A]; the test then drives re-sorts via [simulatedDate]-effect rerenders.
        // Use three day values:
        //   MOCK_DAY → data loads → advance to day1 → [simulatedDate] effect fires → advance to day2 → [simulatedDate] effect fires
        //
        // choreA: dateLastCompleted=Jan 15, freq=1, dur=10
        //   day1(Jan 16): daysSince 1 / freq 1 → orange (due, not overdue)
        //   day2(Jan 20): daysSince 5 / freq 1 → red, overdueRatio (5−1)/1 = 4
        // choreB: dateLastCompleted=Jan 5, freq=7, dur=10
        //   day1(Jan 16): daysSince 11 / freq 7 → red, overdueRatio 4/7
        //   day2(Jan 20): daysSince 15 / freq 7 → red, overdueRatio 8/7
        //   → day1 order: [B, A] (red before orange);  day2 order: [A, B] (both red, 4 > 8/7)
        // day1's order equals the initial order, so the day2 flip is the assertion that
        // proves the re-sort.
        const day1 = new Date(2025, 0, 16, 12, 0, 0); // one day after MOCK_DAY
        const day2 = new Date(2025, 0, 20, 12, 0, 0);

        const choreA = makeChore({ id: 1, name: 'Chore A', dateLastCompleted: new Date(2025, 0, 15), duration: 10, frequency: 1 });
        const choreB = makeChore({ id: 2, name: 'Chore B', dateLastCompleted: new Date(2025, 0, 5), duration: 10, frequency: 7 });
        vi.mocked(fetchAllChores).mockResolvedValue([choreA, choreB]);

        const { rerender } = render(<App />); // starts with MOCK_DAY = Jan 15
        await waitFor(() => expect(screen.getAllByTestId('chore-bar')).toHaveLength(2));

        // Advance to day1 (Jan 16): [simulatedDate] effect fires, re-sorts at day1 → [B, A]
        mockUseMidnightClock.mockReturnValue(day1);
        rerender(<App />);

        await waitFor(() => {
            expect(screen.getAllByTestId('chore-bar').map(el =>
                el.textContent?.match(/Chore [AB]/)?.[0] ?? ''
            )).toEqual(['Chore B', 'Chore A']);
        });

        // Advance to day2 (Jan 20): [simulatedDate] effect fires again, re-sorts at day2 → [A, B]
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

describe('date navigation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(removeChore).mockResolvedValue(undefined);
        vi.mocked(addChore).mockResolvedValue(makeChore());
        vi.mocked(completeChore).mockResolvedValue(makeChore());
        mockUseMidnightClock.mockReturnValue(MOCK_DAY);
    });

    it('on initial load, banner shows today\'s date and only the Next button', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep' })]);

        render(<App />);

        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Wed Jan 15 2025');
        expect(screen.getByRole('button', { name: 'Next day' })).toBeInTheDocument();
        // Previous button is in DOM with Tailwind `invisible` class to reserve layout space
        const prevBtn = screen.getByRole('button', { name: 'Previous day' });
        expect(prevBtn).toHaveClass('invisible');
        // Return-to-today pill is NOT in DOM at dayOffset === 0
        expect(screen.queryByRole('button', { name: /return to today/i })).not.toBeInTheDocument();
    });

    it('clicking Next advances the date by one day and reveals Previous and Reset buttons', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep' })]);

        const user = userEvent.setup();
        render(<App />);

        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        await user.click(screen.getByRole('button', { name: 'Next day' }));

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Thu Jan 16 2025');
        expect(screen.getByRole('button', { name: 'Next day' })).toBeInTheDocument();
        const prevBtn = screen.getByRole('button', { name: 'Previous day' });
        expect(prevBtn).toBeInTheDocument();
        expect(prevBtn).not.toHaveClass('invisible');
        expect(screen.getByRole('button', { name: /return to today/i })).toBeInTheDocument();
    });

    it('chore bars become non-clickable when simulating a future date', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep' })]);

        const user = userEvent.setup();
        render(<App />);

        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        await user.click(screen.getByRole('button', { name: 'Next day' }));

        // Use fireEvent.click here: userEvent v14 throws on pointer-events:none,
        // but we want to verify the React guard (resetTask early-return) independently
        // of CSS pointer-events enforcement.
        const choreBar = screen.getByTestId('chore-bar');
        fireEvent.click(choreBar);

        expect(completeChore).not.toHaveBeenCalled();
        expect(choreBar.className).toMatch(/cursor-not-allowed/);
        expect(choreBar.className).toMatch(/pointer-events-none/);
    });

    it('Reset returns to today and re-enables chore clicks', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep' })]);

        const user = userEvent.setup();
        render(<App />);

        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        await user.click(screen.getByRole('button', { name: 'Next day' }));
        await user.click(screen.getByRole('button', { name: 'Next day' }));
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Fri Jan 17 2025');

        await user.click(screen.getByRole('button', { name: /return to today/i }));

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Wed Jan 15 2025');
        expect(screen.queryByRole('button', { name: /return to today/i })).not.toBeInTheDocument();
        // Previous button stays in DOM but becomes invisible again at dayOffset === 0
        expect(screen.getByRole('button', { name: 'Previous day' })).toHaveClass('invisible');

        await user.click(screen.getByTestId('chore-bar'));
        expect(completeChore).toHaveBeenCalledTimes(1);
    });

    it('Previous after Next returns to today but never goes earlier', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep' })]);

        const user = userEvent.setup();
        render(<App />);

        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        await user.click(screen.getByRole('button', { name: 'Next day' }));
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Thu Jan 16 2025');

        await user.click(screen.getByRole('button', { name: 'Previous day' }));
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Wed Jan 15 2025');

        // Previous button stays in DOM at dayOffset === 0 but becomes invisible
        expect(screen.getByRole('button', { name: 'Previous day' })).toHaveClass('invisible');
    });

    it('bar math recomputes against the simulated date', async () => {
        // Chore completed Jan 14, frequency 7. On real today (Jan 15), daysSince = 1, not overdue.
        // After 10 Next clicks, simulated date is Jan 25 → daysSince = 11, overdue (11 > 7).
        const chore = makeChore({
            id: 1,
            name: 'Sweep',
            dateLastCompleted: new Date(2025, 0, 14),
            frequency: 7,
        });
        vi.mocked(fetchAllChores).mockResolvedValue([chore]);

        const user = userEvent.setup();
        render(<App />);

        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());
        expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument();

        const nextBtn = screen.getByRole('button', { name: 'Next day' });
        for (let i = 0; i < 10; i++) {
            await user.click(nextBtn);
        }

        expect(screen.getByText(/overdue/i)).toBeInTheDocument();
    });
});

describe('Add Task deck (F5)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore()]);
    });

    it('renders the deck sticky at the bottom of the scroll region with a translucent blurred background', async () => {
        render(<App />);

        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        const deck = screen.getByTestId('add-task-deck');
        expect(deck.className).toContain('sticky');
        expect(deck.className).toContain('bottom-0');
        expect(deck.className).toContain('mt-auto');
        // No hard top edge: the deck itself carries no border or background.
        expect(deck.className).not.toMatch(/\bborder-t\b/);
        expect(deck.className).not.toMatch(/\bbg-/);

        // The tint + blur live on a masked backing layer that overhangs the deck's top
        // edge so the frost fades in over the list rather than stopping at a hard line.
        const backing = within(deck).getByTestId('add-task-deck-backing');
        expect(backing.getAttribute('aria-hidden')).toBe('true');
        expect(backing.className).toContain('absolute');
        expect(backing.className).toContain('-top-16');
        expect(backing.className).toContain('bg-gray-900/60');
        expect(backing.className).toContain('backdrop-blur-sm');
        expect(backing.className).toContain('[mask-image:linear-gradient(to_bottom,transparent,black_4rem)]');
        expect(backing.className).toContain('pointer-events-none');
        // Tailwind v4 dropped bg-opacity-*; it compiles to nothing and leaves the
        // backing fully opaque, so guard against the dead v3 utility creeping back in.
        expect(backing.className).not.toContain('bg-opacity');
        // The button must paint above the backing: backing first in DOM, button in a
        // positioned wrapper after it (both positioned, z-index auto → DOM order).
        expect(deck.firstElementChild).toBe(backing);
        const button = within(deck).getByRole('button', { name: /add task/i });
        expect(button.parentElement).not.toBeNull();
        expect(button.parentElement!.className).toContain('relative');
        expect(backing.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

        const scrollRegion = document.querySelector('.overflow-y-auto');
        expect(scrollRegion).not.toBeNull();
        expect(scrollRegion!.contains(deck)).toBe(true);
        expect((scrollRegion as HTMLElement).className).toContain('scroll-pb-40');
        // mt-auto pinning depends on the deck being the scroll region's last child.
        expect(scrollRegion!.lastElementChild).toBe(deck);

        expect(within(deck).getByRole('button', { name: /add task/i })).toBeInTheDocument();
    });

    it('still renders the deck pinned last inside the scroll region when there are no chores', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([]);

        render(<App />);

        await waitFor(() => expect(screen.getByText(/No chores yet/i)).toBeInTheDocument());

        const deck = screen.getByTestId('add-task-deck');
        const scrollRegion = document.querySelector('.overflow-y-auto');
        expect(scrollRegion).not.toBeNull();
        expect(scrollRegion!.contains(deck)).toBe(true);
        expect(scrollRegion!.lastElementChild).toBe(deck);
        expect(within(deck).getByRole('button', { name: /add task/i })).toBeInTheDocument();
    });
});

describe('scroll-to-top button (F18)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore()]);
        Element.prototype.scrollTo = vi.fn();
    });

    afterEach(() => {
        delete (Element.prototype as Partial<Element>).scrollTo;
    });

    it('renders the button in a positioned frame beside, not inside, the unchanged scroll region', async () => {
        render(<App />);

        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        const button = screen.getByTestId('scroll-to-top');
        const region = document.querySelector('.overflow-y-auto') as HTMLElement | null;
        expect(region).not.toBeNull();
        expect(document.querySelectorAll('.overflow-y-auto')).toHaveLength(1);
        expect(region!.contains(button)).toBe(false);

        const frame = screen.getByTestId('scroll-region-frame');
        expect(button.parentElement).toBe(frame);
        expect(frame.className).toContain('relative');
        expect(frame.contains(region)).toBe(true);

        // F18's spec requires the scroller's class string to stay byte-identical.
        expect(region!.className).toBe('flex-1 overflow-y-auto min-h-0 flex flex-col scroll-pb-40');
        expect(region!.lastElementChild).toBe(screen.getByTestId('add-task-deck'));
    });

    it('is hidden and non-interactive immediately on load', async () => {
        render(<App />);

        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        const button = screen.getByTestId('scroll-to-top');
        expect(button.getAttribute('aria-hidden')).toBe('true');
        expect(button).toHaveAttribute('inert');
        expect(button.tabIndex).toBe(-1);
        expect(button.className).toContain('opacity-0');
        expect(button.className).toContain('pointer-events-none');
    });

    it('shows once the region is scrolled and scrolls the region to the top without touching filters', async () => {
        render(<App />);

        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        const region = document.querySelector('.overflow-y-auto') as HTMLElement;
        region.scrollTop = 200;
        fireEvent.scroll(region);

        const button = screen.getByTestId('scroll-to-top');
        expect(button.className).toContain('opacity-100');
        expect(button).not.toHaveAttribute('inert');

        fireEvent.click(button);

        const scrollToMock = vi.mocked(Element.prototype.scrollTo);
        expect(scrollToMock).toHaveBeenCalledTimes(1);
        expect(scrollToMock).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
        expect(scrollToMock.mock.contexts[0]).toBe(region);

        expect(screen.getByText('Sweep')).toBeInTheDocument();
        expect((screen.getByLabelText('Search for a chore') as HTMLInputElement).value).toBe('');
        expect(screen.queryByText('Return to today')).toBeNull();
    });
});

describe('feedback toast (F21)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore()]);
        vi.mocked(addChore).mockResolvedValue(makeChore({ id: 2, name: 'Mop' }));
        vi.mocked(updateChore).mockResolvedValue(makeChore({ id: 1, name: 'Sweep Edited' }));
        vi.mocked(removeChore).mockResolvedValue(undefined);
        vi.mocked(completeChore).mockResolvedValue(makeChore());
    });

    it('shows a green success toast after addChore resolves', async () => {
        vi.mocked(addChore).mockResolvedValue(makeChore({ id: 2, name: 'Mop' }));

        const user = userEvent.setup();
        render(<App />);

        await openAndFillForm(user);
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(screen.getByTestId('toast')).toHaveTextContent('Added "Mop"'));
        expect(screen.getByTestId('toast')).toHaveAttribute('data-tone', 'success');
    });

    it('shows a success toast after updateChore resolves, not on the optimistic apply', async () => {
        let resolveUpdate!: (chore: Chore) => void;
        vi.mocked(updateChore).mockReturnValue(
            new Promise<Chore>(resolve => { resolveUpdate = resolve; })
        );

        const user = userEvent.setup();
        render(<App />);

        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Edit chore' })).toBeInTheDocument()
        );

        await user.click(screen.getByRole('button', { name: 'Edit chore' }));
        await user.clear(screen.getByLabelText('Name'));
        await user.type(screen.getByLabelText('Name'), 'Sweep Edited');
        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        // Optimistic apply + modal close happen before the request settles — no toast yet
        expect(screen.getByText('Sweep Edited')).toBeInTheDocument();
        expect(screen.queryByTestId('toast')).toBeNull();

        resolveUpdate(makeChore({ name: 'Sweep Edited' }));

        await waitFor(() => expect(screen.getByTestId('toast')).toHaveTextContent('Saved "Sweep Edited"'));
        expect(screen.getByTestId('toast')).toHaveAttribute('data-tone', 'success');
    });

    it('shows a success toast after removeChore resolves, not on the optimistic removal', async () => {
        let resolveRemove!: () => void;
        vi.mocked(removeChore).mockReturnValue(
            new Promise<void>(resolve => { resolveRemove = resolve; })
        );

        const user = userEvent.setup();
        render(<App />);

        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Delete chore' })).toBeInTheDocument()
        );

        await user.click(screen.getByRole('button', { name: 'Delete chore' }));
        await user.click(screen.getByTestId('confirm-dialog-confirm'));

        // Optimistic removal is already on screen while the request is pending — no toast yet
        expect(screen.queryByText('Sweep')).not.toBeInTheDocument();
        expect(screen.queryByTestId('toast')).toBeNull();

        resolveRemove();

        await waitFor(() => expect(screen.getByTestId('toast')).toHaveTextContent('Deleted "Sweep"'));
        expect(screen.getByTestId('toast')).toHaveAttribute('data-tone', 'success');
    });

    it('a failed mutation shows a red toast with the message and no success toast', async () => {
        vi.mocked(addChore).mockRejectedValueOnce(new Error('Add failed'));

        const user = userEvent.setup();
        render(<App />);

        await openAndFillForm(user);
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(screen.getByTestId('toast')).toHaveAttribute('data-tone', 'error'));
        expect(screen.getByTestId('toast')).toHaveTextContent('Add failed');
        expect(screen.getAllByTestId('toast')).toHaveLength(1);
    });

    it('the error toast replaces the old strip', async () => {
        vi.mocked(addChore).mockRejectedValueOnce(new Error('Add failed'));

        const user = userEvent.setup();
        render(<App />);

        await openAndFillForm(user);
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(screen.getByTestId('toast')).toHaveAttribute('data-tone', 'error'));

        const red = document.querySelector('.bg-red-700');
        expect(red).not.toBeNull();
        expect(red).toHaveAttribute('data-testid', 'toast');
        // The strip's underlined text button is gone; the toast's control is an icon button with an aria-label
        expect(screen.queryByText('Dismiss')).toBeNull();
    });

    it('the toast is not inside the scroll region and the deck is still its last child', async () => {
        const user = userEvent.setup();
        render(<App />);

        await openAndFillForm(user);
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(screen.getByTestId('toast')).toHaveTextContent('Added "Mop"'));

        const region = document.querySelector('.overflow-y-auto');
        expect(region).not.toBeNull();
        expect(region!.contains(screen.getByTestId('toast'))).toBe(false);
        expect(region!.lastElementChild).toBe(screen.getByTestId('add-task-deck'));
    });

    it('a newer toast replaces the current one', async () => {
        vi.mocked(addChore).mockRejectedValueOnce(new Error('Add failed'));

        const user = userEvent.setup();
        render(<App />);

        await openAndFillForm(user);
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(screen.getByTestId('toast')).toHaveAttribute('data-tone', 'error'));

        // The failed add left the modal open (App closes it only on success) with the form
        // reset to add-mode defaults, so re-filling works: "+ Add Task" is a no-op click and
        // user.clear on the date field replaces the prefilled default.
        vi.mocked(addChore).mockResolvedValue(makeChore({ id: 2, name: 'Mop' }));
        await openAndFillForm(user);
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            const toasts = screen.getAllByTestId('toast');
            expect(toasts).toHaveLength(1);
            expect(toasts[0]).toHaveAttribute('data-tone', 'success');
        });
    });

    it('a successful complete clears a standing error toast without raising a success toast', async () => {
        vi.mocked(completeChore).mockRejectedValueOnce(new Error('Complete failed'));

        render(<App />);

        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());
        fireEvent.click(screen.getByTestId('chore-bar'));

        await waitFor(() => expect(screen.getByTestId('toast')).toHaveAttribute('data-tone', 'error'));
        expect(screen.getByTestId('toast')).toHaveTextContent('Complete failed');

        // The Once rejection is consumed; beforeEach's resolving mock now answers
        fireEvent.click(screen.getByTestId('chore-bar'));

        await waitFor(() => expect(screen.queryByTestId('toast')).toBeNull());
        expect(completeChore).toHaveBeenCalledTimes(2);
    });

    it('an identical success message remounts the toast (F21 key restart)', async () => {
        vi.mocked(addChore)
            .mockResolvedValueOnce(makeChore({ id: 2, name: 'Mop' }))
            .mockResolvedValueOnce(makeChore({ id: 3, name: 'Mop' }));

        const user = userEvent.setup();
        render(<App />);

        await openAndFillForm(user);
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(screen.getByTestId('toast')).toHaveTextContent('Added "Mop"'));
        const first = screen.getByTestId('toast');

        // The modal closed on success, so "+ Add Task" reopens it. Real timers on purpose —
        // userEvent cannot run under fake timers; the re-fill takes far less than
        // SUCCESS_TOAST_MS, and if it ever did not, not.toBe(first) still holds because the
        // first toast self-dismissed.
        await openAndFillForm(user);
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            const now = screen.getByTestId('toast');
            expect(now).not.toBe(first);
            expect(now).toHaveTextContent('Added "Mop"');
        });
    });

    it('the error toast is removed by its Dismiss button', async () => {
        vi.mocked(addChore).mockRejectedValueOnce(new Error('Add failed'));

        const user = userEvent.setup();
        render(<App />);

        await openAndFillForm(user);
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(screen.getByTestId('toast')).toHaveAttribute('data-tone', 'error'));

        await user.click(screen.getByRole('button', { name: 'Dismiss' }));

        expect(screen.queryByTestId('toast')).toBeNull();
    });

    it('completing a chore raises no toast', async () => {
        // A distinguishable server response lets the test wait for the *resolved* state
        // (reconciled name on screen), so a toast raised after the await would be caught.
        vi.mocked(completeChore).mockResolvedValue(makeChore({ name: 'Sweep (reconciled)' }));

        render(<App />);

        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());
        fireEvent.click(screen.getByTestId('chore-bar'));

        await waitFor(() => expect(completeChore).toHaveBeenCalled());
        await waitFor(() => expect(screen.getByText('Sweep (reconciled)')).toBeInTheDocument());
        expect(screen.queryByTestId('toast')).toBeNull();
    });
});
