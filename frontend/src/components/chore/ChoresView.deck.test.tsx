import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChoresView from './ChoresView';
import { clearChoresCache } from '../../cache/choresCache';

vi.mock('@utils/deviceTimezone', () => ({
  getDeviceTimezone: vi.fn(() => 'UTC'),
}));

const mockRooms = [{ id: 1, householdId: 1, name: 'Living Room' }];

const mockChores = [
  {
    id: 1,
    name: 'Vacuum',
    roomId: 1,
    dateLastCompleted: '2026-06-01T00:00:00.000Z',
    duration: 20,
    frequency: 7,
    version: 1,
  },
];

function okResponse(data: unknown[]) {
  return new Response(JSON.stringify({ success: true, data }), {
    headers: { 'content-type': 'application/json' },
  });
}

function stubFetch(data: unknown[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(okResponse(data))),
  );
}

function stubCoarsePointer(coarse: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: coarse,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function renderView() {
  return render(
    <ChoresView householdTimezone="UTC" rooms={mockRooms} swipeStyle="ios" onSwipeStyleChange={vi.fn()} />,
  );
}

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await clearChoresCache();
});

describe('ChoresView Add Chore deck', () => {
  it('holds the + Add Chore button; wrapper and backing ignore pointer events, the button does not', async () => {
    stubFetch(mockChores);
    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    const deck = screen.getByTestId('add-chore-deck');
    const button = screen.getByRole('button', { name: '+ Add Chore' });
    expect(deck).toContainElement(button);
    expect(deck).toHaveClass('pointer-events-none', 'sticky', 'bottom-0', 'z-20');
    expect(deck.firstElementChild).toHaveClass('pointer-events-none');
    expect(button).not.toHaveClass('pointer-events-none');
    expect(button.parentElement).toHaveClass('pointer-events-auto');
    expect(screen.getAllByRole('button', { name: 'Settings' })).toHaveLength(1);
  });

  it('opens the add modal from the deck button', async () => {
    stubFetch(mockChores);
    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: '+ Add Chore' }));
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('hides the deck (invisible, still mounted) while the search is focused on touch, restoring on blur', async () => {
    stubCoarsePointer(true);
    stubFetch(mockChores);
    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    const deck = screen.getByTestId('add-chore-deck');
    const button = screen.getByRole('button', { name: '+ Add Chore' });
    expect(deck).not.toHaveClass('invisible');
    act(() => screen.getByLabelText('Search chores').focus());
    expect(deck).toHaveClass('invisible', 'pointer-events-none');
    expect(deck).not.toHaveClass('hidden');
    expect(screen.getByRole('button', { hidden: true, name: '+ Add Chore' })).toBe(button);
    act(() => screen.getByLabelText('Search chores').blur());
    expect(deck).not.toHaveClass('invisible');
    expect(screen.getByRole('button', { name: '+ Add Chore' })).toBe(button);
  });

  it('keeps the deck visible on search focus for non-touch devices', async () => {
    stubCoarsePointer(false);
    stubFetch(mockChores);
    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    act(() => screen.getByLabelText('Search chores').focus());
    expect(screen.getByTestId('add-chore-deck')).not.toHaveClass('invisible');
  });

  it('restores the deck when the focused search input becomes disabled, and keeps it after re-enabling', async () => {
    stubCoarsePointer(true);
    // Offline-style stale load with no cache: the input is disabled.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );
    renderView();
    // Focus while still enabled (before the failed load flags the view stale and disables it).
    const input = screen.getByLabelText('Search chores');
    act(() => input.focus());
    expect(screen.getByTestId('add-chore-deck')).toHaveClass('invisible');
    await waitFor(() => expect(screen.getByTestId('chores-unavailable')).toBeInTheDocument());
    expect(input).toBeDisabled();
    expect(screen.getByTestId('add-chore-deck')).not.toHaveClass('invisible');
    // Recover: a successful reload re-enables the input with nothing focused.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(okResponse(mockChores))),
    );
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    expect(screen.getByLabelText('Search chores')).not.toBeDisabled();
    expect(screen.getByTestId('add-chore-deck')).not.toHaveClass('invisible');
  });
});
