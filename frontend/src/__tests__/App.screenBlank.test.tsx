import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

describe('screen blank overlay wiring', () => {
    it('is absent when isBlanked is false, and tap-to-complete still works', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        expect(screen.queryByTestId('screen-blank-overlay')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('chore-bar'));
        await waitFor(() => expect(completeChore).toHaveBeenCalledWith(1, expect.any(Date)));
    });

    it('renders the overlay when isBlanked is true', async () => {
        mockUseScreenBlank.mockReturnValue({ isBlanked: true, wake: mockWake });
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        render(<App />);
        await waitFor(() => expect(screen.getByTestId('screen-blank-overlay')).toBeInTheDocument());
    });

    it('clicking the overlay calls wake and swallows the tap (does not complete the chore)', async () => {
        mockUseScreenBlank.mockReturnValue({ isBlanked: true, wake: mockWake });
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        render(<App />);
        await waitFor(() => expect(screen.getByTestId('screen-blank-overlay')).toBeInTheDocument());

        fireEvent.click(screen.getByTestId('screen-blank-overlay'));

        expect(mockWake).toHaveBeenCalledTimes(1);
        expect(completeChore).not.toHaveBeenCalled();
    });

    it('renders the overlay alongside the loading branch, with the .App wrapper inert', async () => {
        mockUseScreenBlank.mockReturnValue({ isBlanked: true, wake: mockWake });
        vi.mocked(fetchAllChores).mockReturnValue(new Promise(() => {}));

        render(<App />);

        expect(screen.getByText('Loading chores...')).toBeInTheDocument();
        expect(screen.getByTestId('screen-blank-overlay')).toBeInTheDocument();
        expect(screen.getByText('Loading chores...').closest('.App')).toHaveAttribute('inert');
    });

    it('marks the .App wrapper inert when blanked, and not inert otherwise', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        const { rerender } = render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        expect(screen.getByText('Sweep').closest('.App')).not.toHaveAttribute('inert');

        mockUseScreenBlank.mockReturnValue({ isBlanked: true, wake: mockWake });
        rerender(<App />);

        expect(screen.getByText('Sweep').closest('.App')).toHaveAttribute('inert');
    });

    it('auto-dismisses an open delete-confirm dialog when isBlanked flips true (DD-6)', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        const { rerender } = render(<App />);
        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Delete chore' })).toBeInTheDocument()
        );

        await user.click(screen.getByRole('button', { name: 'Delete chore' }));
        expect(screen.getByTestId('confirm-dialog-backdrop')).toBeInTheDocument();

        mockUseScreenBlank.mockReturnValue({ isBlanked: true, wake: mockWake });
        rerender(<App />);

        expect(screen.queryByTestId('confirm-dialog-backdrop')).not.toBeInTheDocument();
    });

    it('auto-dismisses an open edit form when isBlanked flips true (DD-6)', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        const { rerender } = render(<App />);
        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Edit chore' })).toBeInTheDocument()
        );

        await user.click(screen.getByRole('button', { name: 'Edit chore' }));
        expect(screen.getByText('Edit Chore')).toBeInTheDocument();

        mockUseScreenBlank.mockReturnValue({ isBlanked: true, wake: mockWake });
        rerender(<App />);

        expect(screen.queryByText('Edit Chore')).not.toBeInTheDocument();
    });

    it('auto-dismisses an open add-chore form when isBlanked flips true (DD-6)', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        const { rerender } = render(<App />);
        await waitFor(() => expect(screen.getByText('+ Add Task')).toBeInTheDocument());

        await user.click(screen.getByText('+ Add Task'));
        expect(screen.getByText('Add New Chore')).toBeInTheDocument();

        mockUseScreenBlank.mockReturnValue({ isBlanked: true, wake: mockWake });
        rerender(<App />);

        expect(screen.queryByText('Add New Chore')).not.toBeInTheDocument();
    });

    it('swiping still works when not blanked', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        const bar = screen.getAllByTestId('chore-bar')[0];
        stubBarWidth(bar);
        swipe(bar, 350, 100);

        expect(await screen.findByText('Edit Chore')).toBeInTheDocument();
    });

    it('an SSE re-pull still works when not blanked', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        vi.mocked(fetchAllChores).mockResolvedValue([
            makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' }),
            makeChore({ id: 2, name: 'Mop', room: 'Kitchen' }),
        ]);
        lastSource().emit('message');

        await waitFor(() => expect(screen.getByText('Mop')).toBeInTheDocument());
    });

    it('the search filter still works when not blanked', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([
            makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' }),
            makeChore({ id: 2, name: 'Mop', room: 'Kitchen' }),
        ]);

        const user = userEvent.setup();
        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        await user.type(screen.getByPlaceholderText('Search for a chore'), 'mop');

        expect(screen.getByText('Mop')).toBeInTheDocument();
        expect(screen.queryByText('Sweep')).not.toBeInTheDocument();
    });

    it('the room filter still works when not blanked', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([
            makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' }),
            makeChore({ id: 2, name: 'Dust', room: 'Bathroom' }),
        ]);

        const user = userEvent.setup();
        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());

        await user.click(screen.getByRole('button', { name: 'Kitchen' }));

        expect(screen.getByText('Sweep')).toBeInTheDocument();
        expect(screen.queryByText('Dust')).not.toBeInTheDocument();
    });
});
