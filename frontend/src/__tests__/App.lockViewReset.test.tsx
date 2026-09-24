import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import App from '../App';
import { CLOSING_SETTLE_MS } from '../components/common/TouchLockOverlay';
import { FADE_MS } from '../components/common/ScrollToTopButton';
import { INACTIVITY_MS } from '../hooks/useTouchLock';
import { fetchAllChores, addChore, completeChore, removeChore, updateChore } from '../services/choreApi';
import { makeChore } from './fixtures/chore';
import { FakeEventSource } from './fixtures/fakeEventSource';

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

// Delegates to the real hook by default so the lock engages on real (fake-timer)
// inactivity; individual tests may override it to hand-drive isLocked.
const mockUseTouchLock = vi.hoisted(() => vi.fn());
vi.mock('../hooks/useTouchLock', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../hooks/useTouchLock')>();
    mockUseTouchLock.mockImplementation(actual.useTouchLock);
    return { ...actual, useTouchLock: mockUseTouchLock };
});

// Stable arm/lock stubs for the tests that hand-drive isLocked via mockReturnValue.
const mockArm = vi.hoisted(() => vi.fn());
const mockLock = vi.hoisted(() => vi.fn());

// Delegates to the real sort by default; spied on to observe re-sorts.
const mockOrderChores = vi.hoisted(() => vi.fn());
vi.mock('../utils/choreSort', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../utils/choreSort')>();
    mockOrderChores.mockImplementation(actual.orderChores);
    return { ...actual, orderChores: mockOrderChores };
});

const mockWake = vi.hoisted(() => vi.fn());
const mockUseScreenBlank = vi.hoisted(() => vi.fn(() => ({ isBlanked: false, wake: mockWake })));
vi.mock('../hooks/useScreenBlank', () => ({
    useScreenBlank: mockUseScreenBlank,
}));

// The idle timeout, imported from the hook itself (the mock factory spreads `actual`).
const IDLE_MS = INACTIVITY_MS;

beforeEach(async () => {
    vi.clearAllMocks();
    const actualTouchLock = await vi.importActual<typeof import('../hooks/useTouchLock')>('../hooks/useTouchLock');
    const actualSort = await vi.importActual<typeof import('../utils/choreSort')>('../utils/choreSort');
    mockUseTouchLock.mockImplementation(actualTouchLock.useTouchLock);
    mockOrderChores.mockImplementation(actualSort.orderChores);
    mockUseScreenBlank.mockReturnValue({ isBlanked: false, wake: mockWake });
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource as unknown as typeof EventSource);
    vi.mocked(addChore).mockResolvedValue(makeChore());
    vi.mocked(completeChore).mockResolvedValue(makeChore());
    vi.mocked(removeChore).mockResolvedValue(undefined);
    vi.mocked(updateChore).mockResolvedValue(makeChore());
    vi.mocked(fetchAllChores).mockResolvedValue([
        makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' }),
        makeChore({ id: 2, name: 'Dust', room: 'Bathroom' }),
    ]);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

const getSearchInput = () => screen.getByPlaceholderText('Search for a chore') as HTMLInputElement;
const getScrollRegion = () => document.querySelector('.overflow-y-auto') as HTMLElement;

// Kitchen tab + 'sw' search + one day forward + scrolled 200px, all via
// fireEvent (no pointerdown, so a real lock timer would not re-arm).
function driftView(): HTMLElement {
    fireEvent.click(screen.getByRole('button', { name: 'Kitchen' }));
    fireEvent.change(getSearchInput(), { target: { value: 'sw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
    const region = getScrollRegion();
    region.scrollTop = 200;
    fireEvent.scroll(region);

    expect(screen.queryByText('Dust')).not.toBeInTheDocument();
    expect(screen.getByText('Return to today')).toBeInTheDocument();
    expect(getSearchInput().value).toBe('sw');
    expect(region.scrollTop).toBe(200);
    return region;
}

describe('lock-time view reset (F19)', () => {
    it('resets scroll, room, search and day when the lock engages after 5 minutes idle', async () => {
        vi.useFakeTimers({ now: new Date(2025, 0, 15, 12, 0, 0), shouldAdvanceTime: true });
        try {
            render(<App />);
            await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

            // Drift the view with fireEvent only — userEvent dispatches pointerdown,
            // which would re-arm the lock timer.
            fireEvent.click(screen.getByRole('button', { name: 'Kitchen' }));
            const searchInput = screen.getByPlaceholderText('Search for a chore') as HTMLInputElement;
            fireEvent.change(searchInput, { target: { value: 'sw' } });
            fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
            fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
            const region = document.querySelector('.overflow-y-auto') as HTMLElement;
            region.scrollTop = 200;
            fireEvent.scroll(region);

            expect(screen.queryByText('Dust')).not.toBeInTheDocument();
            expect(screen.getByText('Return to today')).toBeInTheDocument();
            expect(searchInput.value).toBe('sw');
            expect(region.scrollTop).toBe(200);

            act(() => {
                vi.advanceTimersByTime(IDLE_MS);
            });

            expect(screen.getByRole('button', { name: 'Unlock screen' })).toBeInTheDocument();
            expect(region.scrollTop).toBe(0);
            expect(searchInput.value).toBe('');
            expect(screen.getByText('Dust')).toBeInTheDocument();
            expect(screen.queryByText('Return to today')).not.toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });

    it('does not reset when the lock is released by a double-tap', async () => {
        vi.useFakeTimers({ now: new Date(2025, 0, 15, 12, 0, 0), shouldAdvanceTime: true });
        try {
            render(<App />);
            await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

            act(() => {
                vi.advanceTimersByTime(IDLE_MS);
            });
            expect(screen.getByRole('button', { name: 'Unlock screen' })).toBeInTheDocument();

            // Under F20 the root is no longer inert, so the view may legitimately
            // drift while locked.
            fireEvent.click(screen.getByRole('button', { name: 'Kitchen' }));
            fireEvent.change(getSearchInput(), { target: { value: 'sw' } });

            // A blocked bar tap seeds the padlock; a tap on its hit circle unlocks.
            fireEvent.click(screen.getByTestId('chore-bar'), { clientX: 100, clientY: 100 });
            fireEvent.click(screen.getByTestId('touch-lock-hit-area'), { clientX: 100, clientY: 100 });

            act(() => {
                vi.advanceTimersByTime(CLOSING_SETTLE_MS);
            });

            // arm() re-armed the idle timer, so no further IDLE_MS is advanced.
            expect(getSearchInput().closest('.App')).not.toHaveAttribute('inert');
            expect(screen.queryByTestId('touch-lock-overlay')).not.toBeInTheDocument();
            expect(getSearchInput().value).toBe('sw');
            expect(screen.queryByText('Dust')).not.toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });

    it('does not reset when the screen blanks without the lock engaging', async () => {
        mockUseTouchLock.mockReturnValue({ isLocked: false, arm: mockArm, lock: mockLock, idleExpiries: 0 });
        const { rerender } = render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        const region = driftView();

        mockUseScreenBlank.mockReturnValue({ isBlanked: true, wake: mockWake });
        rerender(<App />);

        expect(screen.getByTestId('screen-blank-overlay')).toBeInTheDocument();
        expect(region.scrollTop).toBe(200);
        expect(getSearchInput().value).toBe('sw');
        expect(screen.getByText('Return to today')).toBeInTheDocument();
    });

    it('resets when the lock engages while the screen is blanked', async () => {
        mockUseTouchLock.mockReturnValue({ isLocked: false, arm: mockArm, lock: mockLock, idleExpiries: 0 });
        const { rerender } = render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        const region = driftView();

        mockUseScreenBlank.mockReturnValue({ isBlanked: true, wake: mockWake });
        rerender(<App />);
        mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm, lock: mockLock, idleExpiries: 0 });
        rerender(<App />);

        // Blank wins over the lock overlay (F1 precedence), but the reset still ran.
        expect(screen.getByTestId('screen-blank-overlay')).toBeInTheDocument();
        expect(screen.queryByTestId('touch-lock-overlay')).not.toBeInTheDocument();
        expect(region.scrollTop).toBe(0);
        expect(getSearchInput().value).toBe('');
        expect(screen.getByText('Dust')).toBeInTheDocument();
        expect(screen.queryByText('Return to today')).not.toBeInTheDocument();
    });

    it('re-sorts on lock only when a day simulation was active', async () => {
        mockUseTouchLock.mockReturnValue({ isLocked: false, arm: mockArm, lock: mockLock, idleExpiries: 0 });
        const { rerender } = render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        // Case A: already on today — the lock's setDayOffset(0) is a no-op, no re-sort.
        mockOrderChores.mockClear();
        mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm, lock: mockLock, idleExpiries: 0 });
        rerender(<App />);
        expect(mockOrderChores).not.toHaveBeenCalled();

        // Case B: simulating two days ahead — the lock snaps back to today and re-sorts.
        mockUseTouchLock.mockReturnValue({ isLocked: false, arm: mockArm, lock: mockLock, idleExpiries: 0 });
        rerender(<App />);
        fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
        fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
        mockOrderChores.mockClear();
        mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm, lock: mockLock, idleExpiries: 0 });
        rerender(<App />);
        expect(mockOrderChores).toHaveBeenCalled();
        expect(mockOrderChores.mock.calls[0][1]).toEqual(mockDay);
    });

    it('hides the scroll-to-top button once the lock resets the scroll', async () => {
        mockUseTouchLock.mockReturnValue({ isLocked: false, arm: mockArm, lock: mockLock, idleExpiries: 0 });
        const { rerender } = render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        vi.useFakeTimers({ shouldAdvanceTime: true });
        try {
            const region = getScrollRegion();
            region.scrollTop = 200;
            fireEvent.scroll(region);
            const button = screen.getByTestId('scroll-to-top');
            expect(button.className).toContain('opacity-100');

            mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm, lock: mockLock, idleExpiries: 0 });
            rerender(<App />);
            expect(region.scrollTop).toBe(0);

            // jsdom does not dispatch scroll on a programmatic scrollTop write.
            fireEvent.scroll(region);
            expect(screen.getByTestId('scroll-to-top').className).toContain('opacity-0');

            act(() => {
                vi.advanceTimersByTime(FADE_MS);
            });
            expect(screen.getByTestId('scroll-to-top')).toHaveAttribute('inert');
            expect(screen.getByTestId('scroll-to-top')).toHaveAttribute('aria-hidden', 'true');
        } finally {
            vi.useRealTimers();
        }
    });

    it('resets the view again at the next idle tick when it drifted while locked', async () => {
        vi.useFakeTimers({ now: new Date(2025, 0, 15, 12, 0, 0), shouldAdvanceTime: true });
        try {
            render(<App />);
            await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

            act(() => {
                vi.advanceTimersByTime(IDLE_MS);
            });
            expect(screen.getByRole('button', { name: 'Unlock screen' })).toBeInTheDocument();

            // F20: the locked board stays usable, so the view can drift again.
            const region = driftView();

            act(() => {
                vi.advanceTimersByTime(IDLE_MS);
            });

            expect(screen.getByRole('button', { name: 'Unlock screen' })).toBeInTheDocument();
            expect(region.scrollTop).toBe(0);
            expect(getSearchInput().value).toBe('');
            expect(screen.getByText('Dust')).toBeInTheDocument();
            expect(screen.queryByText('Return to today')).not.toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });

    it('an Add form opened under the lock and left open across the next idle tick is closed, and the four resets run', async () => {
        vi.useFakeTimers({ now: new Date(2025, 0, 15, 12, 0, 0), shouldAdvanceTime: true });
        try {
            render(<App />);
            await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

            act(() => {
                vi.advanceTimersByTime(IDLE_MS);
            });
            expect(screen.getByRole('button', { name: 'Unlock screen' })).toBeInTheDocument();

            fireEvent.click(screen.getByText('+ Add Task'));
            expect(screen.getByTestId('chore-modal-backdrop')).toBeInTheDocument();

            const region = driftView();

            act(() => {
                vi.advanceTimersByTime(IDLE_MS);
            });

            expect(screen.queryByTestId('chore-modal-backdrop')).not.toBeInTheDocument();
            expect(region.scrollTop).toBe(0);
            expect(getSearchInput().value).toBe('');
            expect(screen.getByText('Dust')).toBeInTheDocument();
            expect(screen.queryByText('Return to today')).not.toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });

    it('a manual lock from the indicator resets the view', async () => {
        vi.useFakeTimers({ now: new Date(2025, 0, 15, 12, 0, 0), shouldAdvanceTime: true });
        try {
            render(<App />);
            await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

            const region = driftView();

            // No timer advance: lock() engages immediately.
            fireEvent.click(screen.getByRole('button', { name: 'Lock screen' }));

            expect(screen.getByRole('button', { name: 'Unlock screen' })).toBeInTheDocument();
            expect(region.scrollTop).toBe(0);
            expect(getSearchInput().value).toBe('');
            expect(screen.getByText('Dust')).toBeInTheDocument();
            expect(screen.queryByText('Return to today')).not.toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });
});
