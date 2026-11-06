import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChoresView from './ChoresView';
import { clearChoresCache } from '../../cache/choresCache';

vi.mock('@utils/deviceTimezone', () => ({
  getDeviceTimezone: vi.fn(() => 'UTC'),
}));

const mockRooms = [
  { id: 1, householdId: 1, name: 'Living Room' },
  { id: 2, householdId: 1, name: 'Kitchen' },
];

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
  {
    id: 2,
    name: 'Dishes',
    roomId: 2,
    dateLastCompleted: '2026-06-20T00:00:00.000Z',
    duration: 5,
    frequency: 1,
    version: 1,
  },
  {
    id: 3,
    name: 'Dust shelves',
    roomId: 1,
    dateLastCompleted: '2026-06-10T00:00:00.000Z',
    duration: 5,
    frequency: 7,
    version: 1,
  },
];

function stubFetch(data: unknown[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ success: true, data }), {
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ),
  );
}

function renderView(selectedRoom?: string) {
  return render(
    <ChoresView
      householdTimezone="UTC"
      rooms={mockRooms}
      selectedRoom={selectedRoom}
      swipeStyle="ios"
      onSwipeStyleChange={vi.fn()}
    />,
  );
}

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await clearChoresCache();
});

describe('ChoresView search', () => {
  it('filters by name, ANDed with the room filter', async () => {
    stubFetch(mockChores);
    renderView('1');
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText('Search chores'), 'DU');
    expect(screen.getByText('Dust shelves')).toBeInTheDocument();
    expect(screen.queryByText('Vacuum')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 of 2 chores');
  });

  it('shows the no-match state and Show all chores restores the list and focuses the input', async () => {
    stubFetch(mockChores);
    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText('Search chores'), 'zzz');
    expect(screen.getByTestId('chores-no-match')).toHaveTextContent('No chores match “zzz”.');
    expect(screen.queryByTestId('chores-empty-room')).not.toBeInTheDocument();
    expect(screen.queryByText(/No chores yet/)).not.toBeInTheDocument();
    const visible = screen.getByTestId('chores-no-match').querySelector('p') as HTMLElement;
    expect(screen.getByRole('status').textContent).toBe(visible.textContent);
    expect(visible.textContent).toBe('No chores match “zzz”.');
    // The status node is not inside the list's aria-live container.
    const listContainer = screen.getByTestId('chores-no-match').closest('[aria-live]') as HTMLElement;
    expect(listContainer.contains(screen.getByRole('status'))).toBe(false);
    expect(fireEvent.mouseDown(screen.getByLabelText('Search chores'))).toBe(true);
    const showAll = screen.getByRole('button', { name: 'Show all chores' });
    expect(fireEvent.mouseDown(showAll)).toBe(false);
    await userEvent.click(showAll);
    expect(screen.getByText('Vacuum')).toBeInTheDocument();
    expect(screen.getByLabelText('Search chores')).toHaveFocus();
  });

  it('appends "in this room" when a room is selected, and wraps long queries', async () => {
    stubFetch(mockChores);
    renderView('2');
    await waitFor(() => expect(screen.getByText('Dishes')).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText('Search chores'), 'x'.repeat(60));
    const msg = screen.getByTestId('chores-no-match').querySelector('p') as HTMLElement;
    expect(msg).toHaveTextContent(/ in this room\.$/);
    expect(msg).toHaveClass('break-words');
  });

  it('treats a whitespace-only query as empty', async () => {
    stubFetch(mockChores);
    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText('Search chores'), '   ');
    expect(screen.getByText('Vacuum')).toBeInTheDocument();
    expect(screen.getByText('Dishes')).toBeInTheDocument();
    expect(screen.queryByTestId('chores-no-match')).not.toBeInTheDocument();
  });

  it('shows "No chores yet" for a household with no chores even with a query', async () => {
    stubFetch([]);
    renderView();
    await waitFor(() => expect(screen.getByText(/No chores yet/)).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText('Search chores'), 'abc');
    expect(screen.getByText(/No chores yet/)).toBeInTheDocument();
    expect(screen.queryByTestId('chores-no-match')).not.toBeInTheDocument();
  });

  it('keeps the status node empty with no query, and mousedown on Clear search is default-prevented', async () => {
    stubFetch(mockChores);
    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent('');
    await userEvent.type(screen.getByLabelText('Search chores'), 'a');
    expect(fireEvent.mouseDown(screen.getByRole('button', { name: 'Clear search' }))).toBe(false);
  });

  it('keeps the remaining chores in their original order', async () => {
    stubFetch(mockChores);
    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    const order = () => screen.getAllByTestId('chore-bar').map((bar) => bar.textContent ?? '');
    const names = (all: string[]) =>
      all.map((text) => ['Vacuum', 'Dishes', 'Dust shelves'].find((name) => text.includes(name)));
    const full = names(order());
    await userEvent.type(screen.getByLabelText('Search chores'), 'u');
    // 'u' matches Vacuum and Dust shelves, not Dishes.
    expect(names(order())).toEqual(full.filter((name) => name !== 'Dishes'));
  });

  it('opens the edit modal for the unfiltered chore while a query is active', async () => {
    stubFetch(mockChores);
    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText('Search chores'), 'dishes');
    expect(screen.queryByText('Vacuum')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Edit chore'));
    // The modal opens with the chore found in the unfiltered list.
    expect(await screen.findByLabelText('Name')).toHaveValue('Dishes');
  });

  it('keeps the query and filter after a re-pull (reconnect load)', async () => {
    stubFetch(mockChores);
    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText('Search chores'), 'dishes');
    // The re-pull returns a renamed chore, so we can tell the new data was applied.
    stubFetch(mockChores.map((chore) => (chore.id === 2 ? { ...chore, name: 'Dishes (fresh)' } : chore)));
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(screen.getByText('Dishes (fresh)')).toBeInTheDocument());
    expect(screen.getByLabelText('Search chores')).toHaveValue('dishes');
    expect(screen.queryByText('Vacuum')).not.toBeInTheDocument();
  });

  it('clears an active query when the add modal is submitted and shows the new chore', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        const body =
          init?.method === 'POST'
            ? {
                success: true,
                data: {
                  id: 99,
                  name: 'Windows',
                  roomId: 1,
                  dateLastCompleted: '2026-06-01T00:00:00.000Z',
                  duration: 10,
                  frequency: 7,
                  version: 1,
                },
              }
            : { success: true, data: mockChores };
        return Promise.resolve(
          new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }),
        );
      }),
    );
    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText('Search chores'), 'dishes');
    await userEvent.click(screen.getByRole('button', { name: '+ Add Chore' }));
    await userEvent.type(screen.getByLabelText('Name'), 'Windows');
    await userEvent.selectOptions(screen.getByLabelText('Room'), '1');
    await userEvent.type(screen.getByLabelText('Duration (minutes)'), '10');
    await userEvent.type(screen.getByLabelText('Frequency (days)'), '7');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByLabelText('Search chores')).toHaveValue(''));
    expect(await screen.findByText('Windows')).toBeInTheDocument();
    expect(screen.getByText('Vacuum')).toBeInTheDocument();
  });

  it('clears via Clear search while disabled (stale, no cache) and focuses the focus-target sentinel', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('offline'))),
    );
    const onSearchQueryChange = vi.fn();
    render(
      <ChoresView
        householdTimezone="UTC"
        rooms={mockRooms}
        swipeStyle="ios"
        onSwipeStyleChange={vi.fn()}
        searchQuery="leftover"
        onSearchQueryChange={onSearchQueryChange}
      />,
    );
    const input = await screen.findByLabelText('Search chores');
    await waitFor(() => expect(input).toBeDisabled());
    expect(input).toHaveValue('leftover');
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onSearchQueryChange).toHaveBeenCalledWith('');
    expect(screen.getByTestId('focus-target')).toHaveFocus();
  });
});
