import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

describe('multi-device sync via SSE', () => {
    it('renders a chore added on another device when a "changed" signal arrives — no reload', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());
        expect(screen.queryByText('Mop')).not.toBeInTheDocument();

        // Another device added "Mop"; the next re-pull will see it.
        vi.mocked(fetchAllChores).mockResolvedValue([
            makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' }),
            makeChore({ id: 2, name: 'Mop', room: 'Kitchen' }),
        ]);

        // Backend pushes the doorbell.
        lastSource().emit('message');

        await waitFor(() => expect(screen.getByText('Mop')).toBeInTheDocument());
        expect(screen.getByText('Sweep')).toBeInTheDocument();
    });

    it('defers a re-pull while an edit modal is open, then applies it once the modal closes', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());
        expect(fetchAllChores).toHaveBeenCalledTimes(1);

        // Open the edit modal — this gates re-pulls.
        await user.click(screen.getByRole('button', { name: 'Edit chore' }));
        expect(screen.getByText('Edit Chore')).toBeInTheDocument();

        // A remote change arrives mid-edit.
        vi.mocked(fetchAllChores).mockResolvedValue([
            makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' }),
            makeChore({ id: 2, name: 'Mop', room: 'Kitchen' }),
        ]);
        lastSource().emit('message');

        // Gated: no re-pull fired, modal intact, new chore not yet shown.
        expect(fetchAllChores).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Edit Chore')).toBeInTheDocument();
        expect(screen.queryByText('Mop')).not.toBeInTheDocument();

        // Close the modal — the deferred re-pull now runs.
        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        await waitFor(() => expect(screen.getByText('Mop')).toBeInTheDocument());
        expect(fetchAllChores).toHaveBeenCalledTimes(2);
    });

    it('defers a re-pull while a mutation is in flight, then flushes it when the mutation settles', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        // Hold the complete() round-trip open so isMutatingRef stays true. The
        // confirm-dialog/form gates are all closed here, so isMutatingRef is the
        // ONLY thing gating the re-pull — this isolates the ref path that the
        // modal test (React state) does not exercise.
        let resolveComplete!: (chore: Chore) => void;
        vi.mocked(completeChore).mockImplementation(
            () => new Promise<Chore>(resolve => { resolveComplete = resolve; })
        );

        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());
        expect(fetchAllChores).toHaveBeenCalledTimes(1);

        // Tapping the bar starts a complete; the promise above never resolves yet.
        await user.click(screen.getByTestId('chore-bar'));

        // A remote change lands mid-mutation.
        vi.mocked(fetchAllChores).mockResolvedValue([
            makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' }),
            makeChore({ id: 2, name: 'Mop', room: 'Kitchen' }),
        ]);
        lastSource().emit('message');

        // Gated by isMutatingRef: no re-pull, new chore not shown yet.
        expect(fetchAllChores).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('Mop')).not.toBeInTheDocument();

        // Settle the mutation — the finally block clears the gate and flushes.
        resolveComplete(makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' }));

        await waitFor(() => expect(screen.getByText('Mop')).toBeInTheDocument());
        expect(fetchAllChores).toHaveBeenCalledTimes(2);
    });

    it('defers a re-pull while the add-chore form is open, then applies it on close', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());
        expect(fetchAllChores).toHaveBeenCalledTimes(1);

        // Open the add form — this gates re-pulls.
        await user.click(screen.getByText('+ Add Task'));
        expect(screen.getByText('Add New Chore')).toBeInTheDocument();

        vi.mocked(fetchAllChores).mockResolvedValue([
            makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' }),
            makeChore({ id: 2, name: 'Mop', room: 'Kitchen' }),
        ]);
        lastSource().emit('message');

        expect(fetchAllChores).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Add New Chore')).toBeInTheDocument();
        expect(screen.queryByText('Mop')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        await waitFor(() => expect(screen.getByText('Mop')).toBeInTheDocument());
        expect(fetchAllChores).toHaveBeenCalledTimes(2);
    });

    it('defers a re-pull while the delete-confirm dialog is open, then applies it on close', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());
        expect(fetchAllChores).toHaveBeenCalledTimes(1);

        // Open the confirm dialog — pendingDeleteId gates re-pulls.
        await user.click(screen.getByRole('button', { name: 'Delete chore' }));
        expect(screen.getByText(/Delete "Sweep"/)).toBeInTheDocument();

        vi.mocked(fetchAllChores).mockResolvedValue([
            makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' }),
            makeChore({ id: 2, name: 'Mop', room: 'Kitchen' }),
        ]);
        lastSource().emit('message');

        expect(fetchAllChores).toHaveBeenCalledTimes(1);
        expect(screen.getByText(/Delete "Sweep"/)).toBeInTheDocument();
        expect(screen.queryByText('Mop')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        await waitFor(() => expect(screen.getByText('Mop')).toBeInTheDocument());
        expect(fetchAllChores).toHaveBeenCalledTimes(2);
    });

    it('reconciles a re-pull that removes a chore — the vanished chore disappears, survivors stay', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([
            makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' }),
            makeChore({ id: 2, name: 'Mop', room: 'Kitchen' }),
            makeChore({ id: 3, name: 'Dust', room: 'Living Room' }),
        ]);

        render(<App />);
        await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());
        expect(screen.getByText('Mop')).toBeInTheDocument();
        expect(screen.getByText('Dust')).toBeInTheDocument();

        // Another device deleted "Mop" and reordered; the re-pull must drop it.
        vi.mocked(fetchAllChores).mockResolvedValue([
            makeChore({ id: 3, name: 'Dust', room: 'Living Room' }),
            makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' }),
        ]);
        lastSource().emit('message');

        await waitFor(() => expect(screen.queryByText('Mop')).not.toBeInTheDocument());
        expect(screen.getByText('Sweep')).toBeInTheDocument();
        expect(screen.getByText('Dust')).toBeInTheDocument();
    });
});
