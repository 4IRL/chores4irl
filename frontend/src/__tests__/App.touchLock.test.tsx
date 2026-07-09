import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { fetchAllChores, addChore, completeChore, removeChore, updateChore } from '../services/choreApi';
import { makeChore } from './fixtures/chore';
import { FakeEventSource, lastFakeSource } from './fixtures/fakeEventSource';
import { CLOSING_SETTLE_MS } from '../components/common/TouchLockOverlay';

vi.mock('../services/choreApi', () => ({
    fetchAllChores: vi.fn(),
    addChore: vi.fn(),
    completeChore: vi.fn(),
    removeChore: vi.fn(),
    updateChore: vi.fn(),
}));

// One stable Date instance — a fresh Date each call spins the re-sort effect forever.
const mockDay = vi.hoisted(() => new Date(2025, 0, 15, 12, 0, 0));
vi.mock('../hooks/useMidnightClock', () => ({
    useMidnightClock: () => mockDay,
}));

const mockArm = vi.hoisted(() => vi.fn());
const mockUseTouchLock = vi.hoisted(() => vi.fn(() => ({ isLocked: false, arm: mockArm })));
vi.mock('../hooks/useTouchLock', () => ({
    useTouchLock: mockUseTouchLock,
}));

const mockWake = vi.hoisted(() => vi.fn());
const mockUseScreenBlank = vi.hoisted(() => vi.fn(() => ({ isBlanked: false, wake: mockWake })));
vi.mock('../hooks/useScreenBlank', () => ({
    useScreenBlank: mockUseScreenBlank,
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

beforeEach(() => {
    vi.clearAllMocks();
    mockUseTouchLock.mockReturnValue({ isLocked: false, arm: mockArm });
    mockUseScreenBlank.mockReturnValue({ isBlanked: false, wake: mockWake });
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource as unknown as typeof EventSource);
    vi.mocked(addChore).mockResolvedValue(makeChore());
    vi.mocked(completeChore).mockResolvedValue(makeChore());
    vi.mocked(removeChore).mockResolvedValue(undefined);
    vi.mocked(updateChore).mockResolvedValue(makeChore());
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('touch lock wiring', () => {
    it('(a) overlay is absent and the indicator shows the open icon when isLocked is false', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        expect(screen.queryByTestId('touch-lock-overlay')).not.toBeInTheDocument();
        expect(
            within(screen.getByTestId('touch-lock-indicator')).getByTestId('touch-lock-icon-open')
        ).toBeInTheDocument();
    });

    it('(b) shows the overlay and closed indicator, and marks the .App wrapper inert, when isLocked is true', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        const { rerender } = render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm });
        rerender(<App />);

        expect(screen.getByTestId('touch-lock-overlay')).toBeInTheDocument();
        expect(
            within(screen.getByTestId('touch-lock-indicator')).getByTestId('touch-lock-icon-closed')
        ).toBeInTheDocument();
        expect(screen.getByTestId('touch-lock-indicator').closest('.App')).toHaveAttribute('inert');
    });

    it('(b2) marks the loading-branch .App wrapper inert when isLocked is true', async () => {
        mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm });
        vi.mocked(fetchAllChores).mockReturnValue(new Promise(() => {}));

        render(<App />);

        expect(screen.getByText('Loading chores...')).toBeInTheDocument();
        expect(screen.getByText('Loading chores...').closest('.App')).toHaveAttribute('inert');
    });

    it('(c) clicking the overlay swallows the tap without triggering any mutation', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        const { rerender } = render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm });
        rerender(<App />);

        fireEvent.click(screen.getByTestId('touch-lock-overlay'));

        expect(completeChore).not.toHaveBeenCalled();
        expect(addChore).not.toHaveBeenCalled();
        expect(updateChore).not.toHaveBeenCalled();
        expect(removeChore).not.toHaveBeenCalled();
    });

    it('(d) tap-to-complete works normally when isLocked is false', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        fireEvent.click(screen.getByTestId('chore-bar'));
        await waitFor(() => expect(completeChore).toHaveBeenCalledWith(1, expect.any(Date)));
    });

    it('(d) swipe-edit works normally when isLocked is false', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        const bar = screen.getAllByTestId('chore-bar')[0];
        stubBarWidth(bar);
        swipe(bar, 350, 100);

        expect(await screen.findByText('Edit Chore')).toBeInTheDocument();
    });

    it('(d) swipe-delete works normally when isLocked is false', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        const bar = screen.getAllByTestId('chore-bar')[0];
        stubBarWidth(bar);
        swipe(bar, 50, 300);

        expect(await screen.findByTestId('confirm-dialog-confirm')).toBeInTheDocument();
        expect(removeChore).not.toHaveBeenCalled();
    });

    it('(d) add-task works normally when isLocked is false', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        render(<App />);
        await waitFor(() => expect(screen.getByText('+ Add Task')).toBeInTheDocument());

        await user.click(screen.getByText('+ Add Task'));

        expect(screen.getByText('Add New Chore')).toBeInTheDocument();
    });

    it('(d) room-filter works normally when isLocked is false', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchAllChores).mockResolvedValue([
            makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' }),
            makeChore({ id: 2, name: 'Dust', room: 'Bathroom' }),
        ]);

        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        await user.click(screen.getByRole('button', { name: 'Kitchen' }));

        expect(screen.getByText('Sweep')).toBeInTheDocument();
        expect(screen.queryByText('Dust')).not.toBeInTheDocument();
    });

    it('(d) search works normally when isLocked is false', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchAllChores).mockResolvedValue([
            makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' }),
            makeChore({ id: 2, name: 'Mop', room: 'Kitchen' }),
        ]);

        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        await user.type(screen.getByPlaceholderText('Search for a chore'), 'mop');

        expect(screen.getByText('Mop')).toBeInTheDocument();
        expect(screen.queryByText('Sweep')).not.toBeInTheDocument();
    });

    it('(e) auto-dismisses an open delete-confirm dialog when isLocked flips true', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        const { rerender } = render(<App />);
        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Delete chore' })).toBeInTheDocument()
        );

        await user.click(screen.getByRole('button', { name: 'Delete chore' }));
        expect(screen.getByTestId('confirm-dialog-backdrop')).toBeInTheDocument();

        mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm });
        rerender(<App />);

        expect(screen.queryByTestId('confirm-dialog-backdrop')).not.toBeInTheDocument();
    });

    it('(e) auto-dismisses an open add-chore form when isLocked flips true', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        const { rerender } = render(<App />);
        await waitFor(() => expect(screen.getByText('+ Add Task')).toBeInTheDocument());

        await user.click(screen.getByText('+ Add Task'));
        expect(screen.getByText('Add New Chore')).toBeInTheDocument();

        mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm });
        rerender(<App />);

        expect(screen.queryByText('Add New Chore')).not.toBeInTheDocument();
    });

    it('(f) touch-lock-overlay is absent when both isBlanked and isLocked are true (F1 precedence)', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        const { rerender } = render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm });
        mockUseScreenBlank.mockReturnValue({ isBlanked: true, wake: mockWake });
        rerender(<App />);

        expect(screen.getByTestId('screen-blank-overlay')).toBeInTheDocument();
        expect(screen.queryByTestId('touch-lock-overlay')).not.toBeInTheDocument();
    });

    it('(g) isClosing keeps the overlay mounted through its close animation after a qualifying double-tap', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        const { rerender } = render(<App />);
        // Load under real timers first — RTL's waitFor polls via its own timer
        // mechanism and will hang if fake timers are already active and never
        // manually advanced.
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm });
        rerender(<App />);

        vi.useFakeTimers();
        try {
            const overlay = screen.getByTestId('touch-lock-overlay');
            // Two real clicks at identical coordinates drive the real
            // TouchLockOverlay/registerTap logic, which calls the real
            // App-level handleArm — this in turn calls the mocked arm() AND
            // sets App's own isClosing to true.
            fireEvent.click(overlay, { clientX: 100, clientY: 100 });
            fireEvent.click(overlay, { clientX: 100, clientY: 100 });

            expect(screen.getByTestId('touch-lock-overlay')).toBeInTheDocument();

            // Represent what the real hook would do once arm() fires.
            mockUseTouchLock.mockReturnValue({ isLocked: false, arm: mockArm });
            rerender(<App />);

            // Still held up purely by isClosing, since isLocked is now false.
            expect(screen.getByTestId('touch-lock-overlay')).toBeInTheDocument();

            act(() => {
                vi.advanceTimersByTime(CLOSING_SETTLE_MS);
            });

            expect(screen.queryByTestId('touch-lock-overlay')).not.toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });

    it('(h) SSE-driven re-pull keeps flowing while isLocked is true', async () => {
        mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm });
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());
        expect(fetchAllChores).toHaveBeenCalledTimes(1);
        // Confirm the app is actually locked while this re-pull happens, so
        // "despite the lock being engaged" is exercised, not just configured.
        expect(screen.getByTestId('touch-lock-overlay')).toBeInTheDocument();
        expect(screen.queryByText('Mop')).not.toBeInTheDocument();

        // Another device added "Mop" while this kiosk sits locked (the default
        // idle state); the doorbell must still trigger a re-pull.
        vi.mocked(fetchAllChores).mockResolvedValue([
            makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' }),
            makeChore({ id: 2, name: 'Mop', room: 'Kitchen' }),
        ]);
        lastFakeSource().emit('message');

        await waitFor(() => expect(screen.getByText('Mop')).toBeInTheDocument());
        expect(screen.getByText('Sweep')).toBeInTheDocument();
        expect(fetchAllChores).toHaveBeenCalledTimes(2);
    });

    it('(i) shows the just-relocked backdrop on the genuine false->true edge, but not on a later remount while isLocked never went false', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        const { rerender } = render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        // The false->true edge mounts a fresh TouchLockOverlay in its
        // 'just-relocked' phase, showing the entrance backdrop immediately.
        mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm });
        rerender(<App />);
        expect(screen.getByTestId('touch-lock-backdrop')).toBeInTheDocument();

        // TouchLockOverlay only reads `justRelocked` at mount time, so a
        // second rerender with isLocked still true wouldn't touch the
        // already-mounted instance's phase either way — that alone wouldn't
        // catch a regression. Force a genuine remount instead, without
        // isLocked ever going false in between: the screen blanking hides
        // the overlay outright (F1 precedence, see test (f)), then waking
        // remounts it. If `justRelocked` ever regressed to plain `isLocked`
        // (instead of a one-shot false->true flag backed by wasLockedRef),
        // this fresh mount would incorrectly show the backdrop again.
        mockUseScreenBlank.mockReturnValue({ isBlanked: true, wake: mockWake });
        rerender(<App />);
        expect(screen.queryByTestId('touch-lock-overlay')).not.toBeInTheDocument();

        mockUseScreenBlank.mockReturnValue({ isBlanked: false, wake: mockWake });
        rerender(<App />);
        expect(screen.getByTestId('touch-lock-overlay')).toBeInTheDocument();
        expect(screen.queryByTestId('touch-lock-backdrop')).not.toBeInTheDocument();
    });
});
