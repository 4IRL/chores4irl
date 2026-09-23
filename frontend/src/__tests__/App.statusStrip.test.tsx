import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { fetchAllChores, addChore, completeChore, removeChore, updateChore } from '../services/choreApi';
import { makeChore } from './fixtures/chore';
import { FakeEventSource, lastFakeSource as lastSource } from './fixtures/fakeEventSource';
import type { Chore } from '@customTypes/SharedTypes';

vi.mock('../services/choreApi', () => ({
    fetchAllChores: vi.fn(),
    addChore: vi.fn(),
    completeChore: vi.fn(),
    removeChore: vi.fn(),
    updateChore: vi.fn(),
}));

// Return ONE stable Date instance — a fresh Date each call gives simulatedDate a
// new identity every render and spins the [simulatedDate] re-sort effect forever.
const mockDay = vi.hoisted(() => new Date(2025, 0, 15, 12, 0, 0));
vi.mock('../hooks/useMidnightClock', () => ({
    useMidnightClock: () => mockDay,
}));
vi.mock('../hooks/useScreenBlank', () => ({
    useScreenBlank: () => ({ isBlanked: false, wake: () => {} }),
}));
vi.mock('../hooks/useTouchLock', () => ({
    useTouchLock: () => ({ isLocked: false, arm: () => {} }),
}));

beforeEach(() => {
    vi.clearAllMocks();
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

// daysSince 14 against the mocked 2025-01-15 day — overdue for frequency 7.
const OVERDUE_COMPLETED = new Date(2025, 0, 1, 12, 0);
// Earlier on the mocked day — counts as done today.
const TODAY_MORNING = new Date(2025, 0, 15, 9, 0);

const overdueSweep = () =>
    makeChore({ id: 1, name: 'Sweep', room: 'Kitchen', frequency: 7, dateLastCompleted: OVERDUE_COMPLETED });
const overdueScrub = () =>
    makeChore({ id: 2, name: 'Scrub', room: 'Bathroom', frequency: 7, dateLastCompleted: OVERDUE_COMPLETED });

const stripLabel = () => screen.getByTestId('status-count-strip').getAttribute('aria-label');

async function renderLoaded() {
    render(<App />);
    await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());
}

describe('F17 status-count strip in App', () => {
    it('renders directly after the NavBar, above the date heading and outside the scroll region', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([overdueSweep()]);
        await renderLoaded();

        const strip = screen.getByTestId('status-count-strip');
        expect(document.getElementById('NavBar')!.nextElementSibling).toBe(strip);

        const heading = screen.getByRole('heading', { level: 1 });
        expect(strip.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

        const scrollRegion = document.querySelector('.overflow-y-auto')!;
        expect(scrollRegion.contains(strip)).toBe(false);
        expect(scrollRegion.lastElementChild).toBe(screen.getByTestId('add-task-deck'));
    });

    it('updates live on the optimistic complete, before the server responds, and keeps it after reconcile', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([overdueSweep()]);
        let resolve!: (chore: Chore) => void;
        vi.mocked(completeChore).mockReturnValue(new Promise<Chore>(res => { resolve = res; }));

        await renderLoaded();
        expect(stripLabel()).toBe('0 done today · 0 due soon · 1 overdue');

        vi.useFakeTimers({ now: new Date(2025, 0, 15, 14, 0, 0) });
        try {
            fireEvent.click(screen.getByText('Sweep'));
        } finally {
            vi.useRealTimers();
        }

        await waitFor(() => expect(stripLabel()).toBe('1 done today · 0 due soon · 0 overdue'));

        await act(async () => {
            resolve(makeChore({
                id: 1, name: 'Sweep', room: 'Kitchen', frequency: 7,
                dateLastCompleted: new Date(2025, 0, 15, 14, 0),
            }));
        });
        expect(stripLabel()).toBe('1 done today · 0 due soon · 0 overdue');
    });

    it('updates live after an SSE re-pull', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([overdueSweep()]);
        await renderLoaded();
        expect(stripLabel()).toBe('0 done today · 0 due soon · 1 overdue');

        vi.mocked(fetchAllChores).mockResolvedValue([
            makeChore({ id: 1, name: 'Sweep', room: 'Kitchen', frequency: 7, dateLastCompleted: TODAY_MORNING }),
        ]);
        lastSource().emit('message');

        await waitFor(() => expect(stripLabel()).toBe('1 done today · 0 due soon · 0 overdue'));
    });

    it('narrows to the selected room tab', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchAllChores).mockResolvedValue([overdueSweep(), overdueScrub()]);
        await renderLoaded();
        expect(stripLabel()).toBe('0 done today · 0 due soon · 2 overdue');

        await user.click(screen.getByRole('button', { name: 'Kitchen' }));

        await waitFor(() => expect(stripLabel()).toBe('0 done today · 0 due soon · 1 overdue'));
    });

    it('follows the displayed day (simulatedDate), not the real day', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchAllChores).mockResolvedValue([
            makeChore({ id: 1, name: 'Sweep', room: 'Kitchen', frequency: 7, dateLastCompleted: TODAY_MORNING }),
        ]);
        await renderLoaded();
        expect(stripLabel()).toBe('1 done today · 0 due soon · 0 overdue');

        await user.click(screen.getByRole('button', { name: 'Next day' }));

        // daysSince 1, ratio 6/7 → green but not done today → no segment.
        await waitFor(() => expect(stripLabel()).toBe('0 done today · 0 due soon · 0 overdue'));
    });

    it('narrows to the search query', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchAllChores).mockResolvedValue([overdueSweep(), overdueScrub()]);
        await renderLoaded();
        expect(stripLabel()).toBe('0 done today · 0 due soon · 2 overdue');

        await user.type(screen.getByPlaceholderText('Search for a chore'), 'Scr');

        await waitFor(() => expect(stripLabel()).toBe('0 done today · 0 due soon · 1 overdue'));
    });
});
