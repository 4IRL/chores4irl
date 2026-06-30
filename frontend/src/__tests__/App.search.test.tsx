import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { fetchAllChores, addChore, completeChore, removeChore, updateChore } from '../services/choreApi';
import { makeChore } from './fixtures/chore';
import { FakeEventSource, lastFakeSource as lastSource } from './fixtures/fakeEventSource';

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

const renderedNames = () =>
    screen.getAllByTestId('chore-bar').map(el => el.textContent?.match(/Chore [A-Z]/)?.[0] ?? '');

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

describe('chore-name search filter (F9)', () => {
    it('filters visible chores by case-insensitive substring on name', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([
            makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' }),
            makeChore({ id: 2, name: 'Mop', room: 'Kitchen' }),
            makeChore({ id: 3, name: 'Wipe', room: 'Bathroom' }),
        ]);

        const user = userEvent.setup();
        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        // Upper-case query matches lower-case content → case-insensitive
        await user.type(screen.getByPlaceholderText('Search for a chore'), 'WIP');

        expect(screen.getByText('Wipe')).toBeInTheDocument();
        expect(screen.queryByText('Sweep')).not.toBeInTheDocument();
        expect(screen.queryByText('Mop')).not.toBeInTheDocument();
    });

    it('matches the chore NAME only, not the room', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([
            makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' }),
            makeChore({ id: 2, name: 'Mop', room: 'Bathroom' }),
        ]);

        const user = userEvent.setup();
        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        // "Kitchen" is a room, not a name — nothing should match
        await user.type(screen.getByPlaceholderText('Search for a chore'), 'Kitchen');

        expect(screen.queryByText('Sweep')).not.toBeInTheDocument();
        expect(screen.queryByText('Mop')).not.toBeInTheDocument();
    });

    it('ANDs the substring filter with the room filter', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([
            makeChore({ id: 1, name: 'Mop Floor', room: 'Kitchen' }),
            makeChore({ id: 2, name: 'Mop Tiles', room: 'Bathroom' }),
            makeChore({ id: 3, name: 'Sweep', room: 'Kitchen' }),
        ]);

        const user = userEvent.setup();
        render(<App />);
        await waitFor(() => expect(screen.getByText('Mop Floor')).toBeInTheDocument());

        // Select the Kitchen room tab
        await user.click(screen.getByRole('button', { name: 'Kitchen' }));
        // Search for "mop" — only the Kitchen "Mop Floor" should remain
        await user.type(screen.getByPlaceholderText('Search for a chore'), 'mop');

        expect(screen.getByText('Mop Floor')).toBeInTheDocument();
        expect(screen.queryByText('Mop Tiles')).not.toBeInTheDocument(); // filtered by room
        expect(screen.queryByText('Sweep')).not.toBeInTheDocument(); // filtered by query
    });

    it('clearing the query restores the room-filtered list', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([
            makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' }),
            makeChore({ id: 2, name: 'Mop', room: 'Kitchen' }),
        ]);

        const user = userEvent.setup();
        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        const input = screen.getByPlaceholderText('Search for a chore');
        await user.type(input, 'mop');
        expect(screen.queryByText('Sweep')).not.toBeInTheDocument();

        await user.clear(input);
        expect(screen.getByText('Sweep')).toBeInTheDocument();
        expect(screen.getByText('Mop')).toBeInTheDocument();
    });

    it('preserves sort order among matches', async () => {
        // choreB is more urgent → renders before choreA in the frozen sort
        const choreA = makeChore({ id: 1, name: 'Chore A scrub', dateLastCompleted: new Date(2025, 0, 14), duration: 10, frequency: 7 });
        const choreB = makeChore({ id: 2, name: 'Chore B scrub', dateLastCompleted: new Date(2024, 11, 1), duration: 10, frequency: 7 });
        vi.mocked(fetchAllChores).mockResolvedValue([choreA, choreB]);

        const user = userEvent.setup();
        render(<App />);
        await waitFor(() => expect(screen.getAllByTestId('chore-bar')).toHaveLength(2));

        const orderBefore = renderedNames();
        expect(orderBefore).toEqual(['Chore B', 'Chore A']);

        // Both names contain "scrub" → both remain, order unchanged
        await user.type(screen.getByPlaceholderText('Search for a chore'), 'scrub');

        await waitFor(() => expect(screen.getAllByTestId('chore-bar')).toHaveLength(2));
        expect(renderedNames()).toEqual(orderBefore);
    });

    it('keeps the active query intact across a room switch', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([
            makeChore({ id: 1, name: 'Mop', room: 'Kitchen' }),
            makeChore({ id: 2, name: 'Mop', room: 'Bathroom' }),
            makeChore({ id: 3, name: 'Sweep', room: 'Kitchen' }),
        ]);

        const user = userEvent.setup();
        render(<App />);
        await waitFor(() => expect(screen.getAllByTestId('chore-bar')).toHaveLength(3));

        await user.type(screen.getByPlaceholderText('Search for a chore'), 'mop');
        await user.click(screen.getByRole('button', { name: 'Bathroom' }));

        // Query survives the room switch and still applies
        expect(screen.getByPlaceholderText('Search for a chore')).toHaveValue('mop');
        expect(screen.getAllByTestId('chore-bar')).toHaveLength(1);
        expect(screen.queryByText('Sweep')).not.toBeInTheDocument();
    });

    it('keeps the active query intact across an SSE re-pull', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([
            makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' }),
            makeChore({ id: 2, name: 'Mop', room: 'Kitchen' }),
        ]);

        const user = userEvent.setup();
        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        await user.type(screen.getByPlaceholderText('Search for a chore'), 'mop');
        expect(screen.queryByText('Sweep')).not.toBeInTheDocument();

        // Another device added a chore; the re-pull returns the larger list.
        vi.mocked(fetchAllChores).mockResolvedValue([
            makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' }),
            makeChore({ id: 2, name: 'Mop', room: 'Kitchen' }),
            makeChore({ id: 3, name: 'Mop Ceiling', room: 'Kitchen' }),
        ]);
        lastSource().emit('message');

        // Re-pull happened (new "Mop Ceiling" matches the query) but the query
        // is still active — "Sweep" remains filtered out.
        await waitFor(() => expect(screen.getByText('Mop Ceiling')).toBeInTheDocument());
        expect(screen.getByPlaceholderText('Search for a chore')).toHaveValue('mop');
        expect(screen.getByText('Mop')).toBeInTheDocument();
        expect(screen.queryByText('Sweep')).not.toBeInTheDocument();
    });

    it('renders gracefully when no chore matches the query', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([
            makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' }),
        ]);

        const user = userEvent.setup();
        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        await user.type(screen.getByPlaceholderText('Search for a chore'), 'zzzzz');

        expect(screen.queryByTestId('chore-bar')).not.toBeInTheDocument();
        // Empty-list rendering is shown, no crash
        expect(screen.getByText(/No chores/i)).toBeInTheDocument();
    });

    it('renders the search input above the scrollable chores list', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep' })]);

        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        // The search input is OUTSIDE the overflow-y-auto scroll region.
        const input = screen.getByPlaceholderText('Search for a chore');
        const scrollRegion = document.querySelector('.overflow-y-auto');
        expect(scrollRegion).not.toBeNull();
        expect(scrollRegion!.contains(input)).toBe(false);
        // And the chore list lives inside that scroll region.
        expect(within(scrollRegion as HTMLElement).getByText('Sweep')).toBeInTheDocument();
    });
});
