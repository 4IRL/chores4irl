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
const mockLock = vi.hoisted(() => vi.fn());
const mockUseTouchLock = vi.hoisted(() => vi.fn(() => ({ isLocked: false, arm: mockArm, lock: mockLock, idleExpiries: 0 })));
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
    mockUseTouchLock.mockReturnValue({ isLocked: false, arm: mockArm, lock: mockLock, idleExpiries: 0 });
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

    it('the indicator locks immediately when tapped while unlocked', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: 'Lock screen' }));

        expect(mockLock).toHaveBeenCalledOnce();
        expect(mockArm).not.toHaveBeenCalled();
    });

    it('the indicator unlocks when tapped while locked', async () => {
        mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm, lock: mockLock, idleExpiries: 0 });
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: 'Unlock screen' }));

        expect(mockArm).toHaveBeenCalledOnce();
        expect(mockLock).not.toHaveBeenCalled();
    });

    it('(b) when locked: closed indicator ("Unlock screen"), no overlay, .App not inert', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        const { rerender } = render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm, lock: mockLock, idleExpiries: 0 });
        rerender(<App />);

        expect(screen.getByRole('button', { name: 'Unlock screen' })).toBeInTheDocument();
        expect(
            within(screen.getByTestId('touch-lock-indicator')).getByTestId('touch-lock-icon-closed')
        ).toBeInTheDocument();
        expect(screen.queryByTestId('touch-lock-overlay')).not.toBeInTheDocument();
        expect(screen.getByTestId('touch-lock-indicator').closest('.App')).not.toHaveAttribute('inert');
    });

    it('(b2) the loading-branch .App is not inert while locked', async () => {
        mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm, lock: mockLock, idleExpiries: 0 });
        vi.mocked(fetchAllChores).mockReturnValue(new Promise(() => {}));

        render(<App />);

        expect(screen.getByText('Loading chores...')).toBeInTheDocument();
        expect(screen.getByText('Loading chores...').closest('.App')).not.toHaveAttribute('inert');
        expect(screen.queryByTestId('touch-lock-overlay')).not.toBeInTheDocument();
    });

    it('(c) tapping a bar while locked calls no mutation and mounts the overlay', async () => {
        mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm, lock: mockLock, idleExpiries: 0 });
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        fireEvent.click(screen.getByTestId('chore-bar'), { clientX: 120, clientY: 40 });

        expect(completeChore).not.toHaveBeenCalled();
        expect(addChore).not.toHaveBeenCalled();
        expect(updateChore).not.toHaveBeenCalled();
        expect(removeChore).not.toHaveBeenCalled();
        expect(screen.getByTestId('touch-lock-overlay')).toBeInTheDocument();
    });

    it('a second tap near the blocked tap unlocks, and does not complete the chore', async () => {
        mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm, lock: mockLock, idleExpiries: 0 });
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        fireEvent.click(screen.getByTestId('chore-bar'), { clientX: 120, clientY: 40 });
        fireEvent.click(screen.getByTestId('touch-lock-hit-area'), { clientX: 125, clientY: 45 });

        expect(mockArm).toHaveBeenCalledOnce();
        expect(completeChore).not.toHaveBeenCalled();
    });

    it('no second tap: the overlay fades after 1500 ms, is gone CLOSING_SETTLE_MS later, and the app is still locked', async () => {
        mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm, lock: mockLock, idleExpiries: 0 });
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        render(<App />);
        // Load under real timers first (waitFor hangs on an un-advanced fake clock).
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        vi.useFakeTimers();
        try {
            // Click only after installing the fake clock, so the overlay's dismiss
            // chain is scheduled on it.
            fireEvent.click(screen.getByTestId('chore-bar'), { clientX: 120, clientY: 40 });
            expect(screen.getByTestId('touch-lock-overlay')).toBeInTheDocument();

            act(() => {
                vi.advanceTimersByTime(1499);
            });
            expect(screen.getByTestId('touch-lock-overlay').className).not.toContain('opacity-0');
            expect(screen.getByTestId('touch-lock-hit-area').className).toContain('pointer-events-auto');

            act(() => {
                vi.advanceTimersByTime(1);
            });
            expect(screen.getByTestId('touch-lock-overlay').className).toContain('opacity-0');
            expect(screen.getByTestId('touch-lock-hit-area').className).toContain('pointer-events-none');

            act(() => {
                vi.advanceTimersByTime(CLOSING_SETTLE_MS);
            });
            expect(screen.queryByTestId('touch-lock-overlay')).not.toBeInTheDocument();
            expect(mockArm).not.toHaveBeenCalled();
            expect(screen.getByRole('button', { name: 'Unlock screen' })).toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });

    it('the indicator is raised above a pending attempt overlay and unlocks it', async () => {
        mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm, lock: mockLock, idleExpiries: 0 });
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        const indicator = screen.getByTestId('touch-lock-indicator');
        expect(indicator.className).toContain('z-40');

        fireEvent.click(screen.getByTestId('chore-bar'), { clientX: 120, clientY: 40 });
        expect(screen.getByTestId('touch-lock-overlay')).toBeInTheDocument();
        expect(indicator.className).toContain('z-[95]');
        expect(indicator.className).not.toContain('z-40');

        // jsdom does no hit-testing, so the z-index class is what pins that a real
        // corner tap reaches the indicator; the smoke proves it in Chromium.
        fireEvent.click(screen.getByRole('button', { name: 'Unlock screen' }));

        expect(mockArm).toHaveBeenCalledOnce();
        expect(screen.queryByTestId('touch-lock-overlay')).not.toBeInTheDocument();
        expect(screen.getByTestId('touch-lock-indicator').className).toContain('z-40');
    });

    // Post-PR amendment (2026-09-24): the padlock overlay is non-blocking — its
    // root is pointer-events-none and only the hit circle around the seed catches
    // taps — so the board stays usable while an attempt shows. jsdom does no
    // hit-testing, so this pins that nothing in App tears the attempt down or
    // re-seeds it on those interactions; the smoke proves the pass-through in
    // Chromium.
    it('a room tab, the search input and the next-day button work while an attempt overlay shows, and the overlay stays up', async () => {
        mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm, lock: mockLock, idleExpiries: 0 });
        vi.mocked(fetchAllChores).mockResolvedValue([
            makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' }),
            makeChore({ id: 2, name: 'Dust', room: 'Bathroom' }),
        ]);

        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        fireEvent.click(screen.getAllByTestId('chore-bar')[0], { clientX: 120, clientY: 40 });
        const overlay = screen.getByTestId('touch-lock-overlay');
        expect(overlay.className).toContain('pointer-events-none');

        fireEvent.click(screen.getByRole('button', { name: 'Kitchen' }));
        expect(screen.queryByText('Dust')).not.toBeInTheDocument();

        const search = screen.getByPlaceholderText('Search for a chore');
        search.focus();
        fireEvent.change(search, { target: { value: 'sw' } });
        expect(search).toHaveValue('sw');
        expect(screen.getByText('Sweep')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
        expect(screen.getByRole('button', { name: 'Return to today' })).toBeInTheDocument();

        // The same attempt is still showing: not dismissed, not re-keyed.
        expect(screen.getByTestId('touch-lock-overlay')).toBe(overlay);
        expect(mockArm).not.toHaveBeenCalled();
        expect(completeChore).not.toHaveBeenCalled();
    });

    it('swipes and the sr-only Edit/Delete buttons are guarded while locked', async () => {
        mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm, lock: mockLock, idleExpiries: 0 });
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        const bar = screen.getAllByTestId('chore-bar')[0];
        stubBarWidth(bar);

        // Each action must raise its own attempt: a new attempt id remounts the
        // overlay (key={lockAttempt.id}), so the node differs from the previous one.
        let previousOverlay: HTMLElement | null = null;
        const expectGuarded = () => {
            const overlay = screen.getByTestId('touch-lock-overlay');
            expect(overlay).not.toBe(previousOverlay);
            previousOverlay = overlay;
            expect(screen.queryByTestId('confirm-dialog-backdrop')).not.toBeInTheDocument();
            expect(screen.queryByText('Edit Chore')).not.toBeInTheDocument();
            expect(removeChore).not.toHaveBeenCalled();
            expect(updateChore).not.toHaveBeenCalled();
            expect(completeChore).not.toHaveBeenCalled();
        };

        swipe(bar, 50, 300);
        expectGuarded();

        swipe(bar, 350, 100);
        expectGuarded();

        fireEvent.click(screen.getByRole('button', { name: 'Edit chore' }));
        expectGuarded();

        fireEvent.click(screen.getByRole('button', { name: 'Delete chore' }));
        expectGuarded();
    });

    it('search, room tabs, day simulation and Add Task (including submit) work while locked', async () => {
        const user = userEvent.setup();
        mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm, lock: mockLock, idleExpiries: 0 });
        vi.mocked(fetchAllChores).mockResolvedValue([
            makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' }),
            makeChore({ id: 2, name: 'Dust', room: 'Bathroom' }),
        ]);

        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());
        const appRoot = screen.getByTestId('touch-lock-indicator').closest('.App');
        expect(appRoot).not.toHaveAttribute('inert');

        // Search
        const search = screen.getByPlaceholderText('Search for a chore');
        fireEvent.change(search, { target: { value: 'sw' } });
        expect(screen.queryByText('Dust')).not.toBeInTheDocument();
        expect(screen.getByText('Sweep')).toBeInTheDocument();
        fireEvent.change(search, { target: { value: '' } });
        expect(screen.getByText('Dust')).toBeInTheDocument();

        // Room tab
        fireEvent.click(screen.getByRole('button', { name: 'Kitchen' }));
        expect(screen.queryByText('Dust')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'All' }));
        expect(screen.getByText('Dust')).toBeInTheDocument();

        // Day simulation
        fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
        expect(screen.getByRole('button', { name: 'Return to today' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Return to today' }));
        expect(screen.queryByRole('button', { name: 'Return to today' })).not.toBeInTheDocument();

        // Add Task, including submit
        vi.mocked(addChore).mockResolvedValueOnce(makeChore({ id: 3, name: 'Vacuum', room: 'Kitchen' }));
        await user.click(screen.getByText('+ Add Task'));
        await user.type(screen.getByLabelText('Name'), 'Vacuum');
        await user.type(screen.getByLabelText('Room'), 'Kitchen');
        await user.clear(screen.getByLabelText('Last Completed'));
        await user.type(screen.getByLabelText('Last Completed'), '2025-01-01');
        await user.type(screen.getByLabelText('Duration (minutes)'), '10');
        await user.type(screen.getByLabelText('Frequency (days)'), '7');
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(addChore).toHaveBeenCalledOnce());
        expect(await screen.findByText('Vacuum')).toBeInTheDocument();
        expect(await screen.findByText('Added "Vacuum"')).toBeInTheDocument();
        expect(screen.queryByTestId('touch-lock-overlay')).not.toBeInTheDocument();
        expect(appRoot).not.toHaveAttribute('inert');
    });

    it("F18's scroll-to-top button works while locked", async () => {
        mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm, lock: mockLock, idleExpiries: 0 });
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);
        Element.prototype.scrollTo = vi.fn();
        try {
            render(<App />);
            await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

            const region = document.querySelector('.overflow-y-auto') as HTMLElement;
            region.scrollTop = 200;
            fireEvent.scroll(region);

            // jsdom ignores `inert`, so the click alone would pass even under the
            // old inert root; pin that no ancestor carries it.
            expect(screen.getByTestId('scroll-to-top').closest('[inert]')).toBeNull();

            fireEvent.click(screen.getByRole('button', { name: 'Scroll to top' }));

            expect(vi.mocked(Element.prototype.scrollTo)).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
        } finally {
            delete (Element.prototype as Partial<Element>).scrollTo;
        }
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

        mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm, lock: mockLock, idleExpiries: 0 });
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

        mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm, lock: mockLock, idleExpiries: 0 });
        rerender(<App />);

        expect(screen.queryByText('Add New Chore')).not.toBeInTheDocument();
    });

    it('(f) blank wins: a pending attempt\'s overlay hides under the blank and does not come back on wake', async () => {
        mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm, lock: mockLock, idleExpiries: 0 });
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        const { rerender } = render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        fireEvent.click(screen.getByTestId('chore-bar'), { clientX: 120, clientY: 40 });
        expect(screen.getByTestId('touch-lock-overlay')).toBeInTheDocument();

        mockUseScreenBlank.mockReturnValue({ isBlanked: true, wake: mockWake });
        rerender(<App />);
        expect(screen.getByTestId('screen-blank-overlay')).toBeInTheDocument();
        expect(screen.queryByTestId('touch-lock-overlay')).not.toBeInTheDocument();

        // Still locked after the wake: the force-close effect dropped the attempt.
        mockUseScreenBlank.mockReturnValue({ isBlanked: false, wake: mockWake });
        rerender(<App />);
        expect(screen.queryByTestId('touch-lock-overlay')).not.toBeInTheDocument();
    });

    it('(g) the overlay stays mounted through its close animation after a qualifying double-tap', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        const { rerender } = render(<App />);
        // Load under real timers first — RTL's waitFor polls via its own timer
        // mechanism and will hang if fake timers are already active and never
        // manually advanced.
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm, lock: mockLock, idleExpiries: 0 });
        rerender(<App />);

        vi.useFakeTimers();
        try {
            // A bar tap seeds the attempt; a nearby tap on its hit circle drives the
            // real registerTap logic, which calls the real App-level handleArm —
            // this calls the mocked arm() and schedules the CLOSING_SETTLE_MS
            // timer that clears lockAttempt.
            fireEvent.click(screen.getByTestId('chore-bar'), { clientX: 100, clientY: 100 });
            fireEvent.click(screen.getByTestId('touch-lock-hit-area'), { clientX: 100, clientY: 100 });

            expect(mockArm).toHaveBeenCalledOnce();
            expect(screen.getByTestId('touch-lock-overlay')).toBeInTheDocument();

            // Represent what the real hook would do once arm() fires.
            mockUseTouchLock.mockReturnValue({ isLocked: false, arm: mockArm, lock: mockLock, idleExpiries: 0 });
            rerender(<App />);

            // Still held up purely by lockAttempt, since isLocked is now false.
            expect(screen.getByTestId('touch-lock-overlay')).toBeInTheDocument();

            act(() => {
                vi.advanceTimersByTime(CLOSING_SETTLE_MS);
            });

            expect(screen.queryByTestId('touch-lock-overlay')).not.toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });

    // F20 accepted interaction (plan "Accepted interactions"): during the 400 ms
    // 'opening' animation the app is already unlocked but the indicator is still
    // raised, so a corner tap there re-locks (its normal unlocked behavior) and
    // the force-close effect then drops the attempt.
    it('(g2) a raised-indicator tap inside the opening window re-locks and the attempt is dropped', async () => {
        mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm, lock: mockLock, idleExpiries: 0 });
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        const { rerender } = render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        vi.useFakeTimers();
        try {
            fireEvent.click(screen.getByTestId('chore-bar'), { clientX: 100, clientY: 100 });
            fireEvent.click(screen.getByTestId('touch-lock-hit-area'), { clientX: 100, clientY: 100 });
            expect(mockArm).toHaveBeenCalledOnce();

            // What the real hook does once arm() fires.
            mockUseTouchLock.mockReturnValue({ isLocked: false, arm: mockArm, lock: mockLock, idleExpiries: 0 });
            rerender(<App />);

            // Still inside CLOSING_SETTLE_MS: the overlay is mid-'opening' and the
            // indicator is still raised, now offering "Lock screen".
            act(() => {
                vi.advanceTimersByTime(CLOSING_SETTLE_MS - 1);
            });
            expect(screen.getByTestId('touch-lock-overlay')).toBeInTheDocument();
            const indicator = screen.getByTestId('touch-lock-indicator');
            expect(indicator.className).toContain('z-[95]');

            fireEvent.click(screen.getByRole('button', { name: 'Lock screen' }));
            expect(mockLock).toHaveBeenCalledOnce();
            expect(mockArm).toHaveBeenCalledOnce();

            // What the real hook does once lock() fires: the force-close effect
            // drops the attempt at once, without waiting for the settle timer.
            mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm, lock: mockLock, idleExpiries: 0 });
            rerender(<App />);
            expect(screen.queryByTestId('touch-lock-overlay')).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Unlock screen' }).className).toContain('z-40');
        } finally {
            vi.useRealTimers();
        }
    });

    // F20 accepted interaction: a keyboard sr-only-pill attempt made with the Add
    // form open raises the indicator above the form's z-50 backdrop, so the
    // corner then unlocks (dropping the padlock) rather than cancelling the form.
    it('(g3) with the Add form open, a keyboard attempt raises the indicator and a corner tap unlocks', async () => {
        const user = userEvent.setup();
        mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm, lock: mockLock, idleExpiries: 0 });
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        await user.click(screen.getByText('+ Add Task'));
        expect(screen.getByText('Add New Chore')).toBeInTheDocument();

        // fireEvent.click carries (0, 0), like a keyboard activation of the pill.
        fireEvent.click(screen.getByRole('button', { name: 'Edit chore' }));
        expect(screen.getByTestId('touch-lock-overlay')).toBeInTheDocument();
        expect(screen.getByTestId('touch-lock-indicator').className).toContain('z-[95]');

        fireEvent.click(screen.getByRole('button', { name: 'Unlock screen' }));

        expect(mockArm).toHaveBeenCalledOnce();
        expect(mockLock).not.toHaveBeenCalled();
        expect(screen.queryByTestId('touch-lock-overlay')).not.toBeInTheDocument();
        expect(screen.getByText('Add New Chore')).toBeInTheDocument();
        expect(updateChore).not.toHaveBeenCalled();
    });

    it('(h) SSE-driven re-pull keeps flowing while isLocked is true', async () => {
        mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm, lock: mockLock, idleExpiries: 0 });
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());
        expect(fetchAllChores).toHaveBeenCalledTimes(1);
        // Confirm the app is actually locked while this re-pull happens, so
        // "despite the lock being engaged" is exercised, not just configured.
        expect(screen.getByRole('button', { name: 'Unlock screen' })).toBeInTheDocument();
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
});
