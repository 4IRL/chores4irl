import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

// useScreenBlank is deliberately NOT mocked here — this file exercises the real
// hook against a fake-timers-pinned wall clock, proving the overlay tracks real
// time independently of simulatedDate/dayOffset (see App.screenBlank.test.tsx
// for the mocked-hook wiring cases).

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

describe('screen blank overlay — real clock independence from simulatedDate', () => {
    it('stays present after advancing the simulated day, driven only by the real (fake-timers) clock', async () => {
        vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })]);

        // 23:00 is inside the 21:00-06:00 blank window. shouldAdvanceTime keeps
        // the faked clock ticking in step with real elapsed time, so Testing
        // Library's internal setInterval (used by waitFor) still fires under
        // fake timers instead of deadlocking.
        vi.useFakeTimers({ now: new Date(2025, 0, 15, 23, 0, 0), shouldAdvanceTime: true });
        try {
            render(<App />);

            await waitFor(() => expect(screen.getByText('Sweep')).toBeInTheDocument());
            expect(screen.getByTestId('screen-blank-overlay')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
            fireEvent.click(screen.getByRole('button', { name: 'Next day' }));

            expect(screen.getByTestId('screen-blank-overlay')).toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });
});
