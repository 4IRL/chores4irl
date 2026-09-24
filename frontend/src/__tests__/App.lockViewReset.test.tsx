import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import App from '../App';
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
    return { useTouchLock: mockUseTouchLock };
});

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

// Mirrors useTouchLock's module-private INACTIVITY_MS (5 minutes).
const IDLE_MS = 5 * 60 * 1000;

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

            expect(screen.getByTestId('touch-lock-overlay')).toBeInTheDocument();
            expect(region.scrollTop).toBe(0);
            expect(searchInput.value).toBe('');
            expect(screen.getByText('Dust')).toBeInTheDocument();
            expect(screen.queryByText('Return to today')).not.toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });
});
