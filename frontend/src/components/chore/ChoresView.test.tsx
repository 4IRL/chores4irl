import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen, waitFor, cleanup, within, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChoresView from './ChoresView';
import { createOutbox as createOutboxBase } from '../../outbox/outbox';
import { writeChoresCache, readChoresCache, clearChoresCache } from '../../cache/choresCache';
import { getDeviceTimezone } from '@utils/deviceTimezone';
import { orderChores } from '@utils/choreSort';

vi.mock('@utils/deviceTimezone', () => ({
  getDeviceTimezone: vi.fn(() => 'America/New_York'),
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
];

function jsonResponse(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }),
  );
}

function stubChoresFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';
      if (url === '/api/chores' && method === 'GET') {
        return jsonResponse({ success: true, data: mockChores });
      }
      throw new Error(`Unhandled fetch: ${method} ${url}`);
    }),
  );
}

function unauthorizedResponse() {
  return Promise.resolve(
    new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

function forbiddenResponse() {
  return Promise.resolve(
    new Response(JSON.stringify({ success: false, error: 'Not a member of this household' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

// Replaces window.location with a stub whose assign() is spied on, so a Retry
// click's real top-level navigation can be asserted without navigating jsdom.
function stubLocationAssign() {
  const assign = vi.fn();
  const original = window.location;
  Object.defineProperty(window, 'location', {
    value: { ...original, assign },
    writable: true,
    configurable: true,
  });
  return {
    assign,
    restore: () =>
      Object.defineProperty(window, 'location', {
        value: original,
        writable: true,
        configurable: true,
      }),
  };
}

// Every outbox registers a window 'online' listener; dispose them after each test so a queued
// entry from an earlier test is not re-flushed (with a stale fetch stub) by a later 'online' event.
const createdOutboxes: ReturnType<typeof createOutboxBase>[] = [];

function createOutbox(fetchImpl?: typeof fetch) {
  const created = createOutboxBase(fetchImpl);
  createdOutboxes.push(created);
  return created;
}

afterEach(async () => {
  createdOutboxes.splice(0).forEach((created) => created.dispose());
  vi.unstubAllGlobals();
  vi.useRealTimers();
  cleanup();
  localStorage.clear();
  await clearChoresCache();
});

describe('ChoresView', () => {
  it('fetches /api/chores and renders them', async () => {
    stubChoresFetch();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-07-01T12:00:00.000Z'));

    render(
      <ChoresView
        householdTimezone="Pacific/Kiritimati"
        rooms={mockRooms}
        swipeStyle="ios"
        onSwipeStyleChange={vi.fn()}
      />,
    );

    await vi.waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    expect(screen.getByText('Dishes')).toBeInTheDocument();
  });

  it('filters visible chores by selectedRoom', async () => {
    stubChoresFetch();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-07-01T12:00:00.000Z'));

    render(
      <ChoresView
        householdTimezone="Pacific/Kiritimati"
        selectedRoom="2"
        rooms={mockRooms}
        swipeStyle="ios"
        onSwipeStyleChange={vi.fn()}
      />,
    );

    await vi.waitFor(() => expect(screen.getByText('Dishes')).toBeInTheDocument());
    expect(screen.queryByText('Vacuum')).not.toBeInTheDocument();
  });

  it("shows a notice when the viewer's device timezone differs from the household's", async () => {
    stubChoresFetch();
    vi.mocked(getDeviceTimezone).mockReturnValue('Asia/Tokyo');

    render(
      <ChoresView
        householdTimezone="America/New_York"
        rooms={mockRooms}
        swipeStyle="ios"
        onSwipeStyleChange={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    expect(screen.getByTestId('timezone-mismatch-notice')).toHaveTextContent(
      /Tokyo \(UTC[+-]\d+(:\d{2})?\).*New York \(UTC[+-]\d+(:\d{2})?\)/,
    );
  });

  it("hides the notice when the viewer's device timezone matches the household's", async () => {
    stubChoresFetch();
    vi.mocked(getDeviceTimezone).mockReturnValue('America/New_York');

    render(
      <ChoresView
        householdTimezone="America/New_York"
        rooms={mockRooms}
        swipeStyle="ios"
        onSwipeStyleChange={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    expect(screen.queryByTestId('timezone-mismatch-notice')).not.toBeInTheDocument();
  });

  it('creates a new chore via the add-chore form and renders it', async () => {
    const user = userEvent.setup();
    const createdChore = {
      id: 3,
      name: 'Mop Floors',
      roomId: 2,
      dateLastCompleted: '2026-06-15T00:00:00.000Z',
      duration: 15,
      frequency: 3,
      version: 1,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method ?? 'GET';
        if (url === '/api/chores' && method === 'GET') {
          return jsonResponse({ success: true, data: mockChores });
        }
        if (url === '/api/chores' && method === 'POST') {
          return jsonResponse({ success: true, data: createdChore });
        }
        throw new Error(`Unhandled fetch: ${method} ${url}`);
      }),
    );

    render(
      <ChoresView householdTimezone="UTC" rooms={mockRooms} swipeStyle="ios" onSwipeStyleChange={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /add chore/i }));
    await user.type(screen.getByLabelText('Name'), 'Mop Floors');
    await user.selectOptions(screen.getByLabelText('Room'), 'Kitchen');
    await user.clear(screen.getByLabelText('Last Completed'));
    await user.type(screen.getByLabelText('Last Completed'), '2026-06-15');
    await user.type(screen.getByLabelText('Duration (minutes)'), '15');
    await user.type(screen.getByLabelText('Frequency (days)'), '3');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByText('Mop Floors')).toBeInTheDocument());
  });

  it('uses the household timezone for the add default and the edit display date', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-07-01T12:00:00.000Z'));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    stubChoresFetch();

    // Kiritimati is UTC+14: 12:00Z on Jul 1 is already Jul 2 there.
    render(
      <ChoresView
        householdTimezone="Pacific/Kiritimati"
        rooms={mockRooms}
        swipeStyle="ios"
        onSwipeStyleChange={vi.fn()}
      />,
    );
    await vi.waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /add chore/i }));
    expect(screen.getByLabelText('Last Completed')).toHaveValue('2026-07-02');
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    // Vacuum completed 2026-06-01T00:00Z = 2026-06-01 14:00 in Kiritimati.
    await user.click(within(rowFor('Vacuum')).getByLabelText('Edit chore'));
    expect(await screen.findByLabelText('Name')).toHaveValue('Vacuum');
    expect(screen.getByLabelText('Last Completed')).toHaveValue('2026-06-01');
  });

  it('edits an existing chore via the edit-chore form, sending its current version', async () => {
    // Pin the clock for deterministic day counts. The target row is selected
    // by name (Vacuum), so the PUT hits the stubbed /api/chores/1 whatever the list order.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-07-01T12:00:00.000Z'));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const updatedChore = {
      id: 1,
      name: 'Vacuum Deluxe',
      roomId: 1,
      dateLastCompleted: '2026-06-01T00:00:00.000Z',
      duration: 20,
      frequency: 7,
      version: 2,
    };
    let putBody: Record<string, unknown> | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method ?? 'GET';
        if (url === '/api/chores' && method === 'GET') {
          return jsonResponse({ success: true, data: mockChores });
        }
        if (url === '/api/chores/1' && method === 'PUT') {
          putBody = init?.body ? JSON.parse(init.body as string) : null;
          return jsonResponse({ success: true, data: updatedChore });
        }
        throw new Error(`Unhandled fetch: ${method} ${url}`);
      }),
    );

    render(
      <ChoresView householdTimezone="UTC" rooms={mockRooms} swipeStyle="ios" onSwipeStyleChange={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await user.click(within(rowFor('Vacuum')).getByLabelText('Edit chore'));
    const nameInput = await screen.findByLabelText('Name');
    expect(nameInput).toHaveValue('Vacuum');
    await user.clear(nameInput);
    await user.type(nameInput, 'Vacuum Deluxe');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(screen.getByText('Vacuum Deluxe')).toBeInTheDocument());
    expect(putBody).toMatchObject({ version: 1 });
  });

  it('shows a distinguishable conflict dialog, not a generic error, when an edit hits a stale version', async () => {
    // Pin the clock for deterministic day counts. The target row is selected
    // by name (Vacuum), so the PUT hits the stubbed /api/chores/1 whatever the list order.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-07-01T12:00:00.000Z'));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method ?? 'GET';
        if (url === '/api/chores' && method === 'GET') {
          return jsonResponse({ success: true, data: mockChores });
        }
        if (url === '/api/chores/1' && method === 'PUT') {
          return Promise.resolve(
            new Response(JSON.stringify({ success: false, error: 'Chore was changed elsewhere' }), {
              status: 409,
              headers: { 'content-type': 'application/json' },
            }),
          );
        }
        throw new Error(`Unhandled fetch: ${method} ${url}`);
      }),
    );

    render(
      <ChoresView householdTimezone="UTC" rooms={mockRooms} swipeStyle="ios" onSwipeStyleChange={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await user.click(within(rowFor('Vacuum')).getByLabelText('Edit chore'));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(screen.getByText('This chore was changed elsewhere.')).toBeInTheDocument());
    expect(screen.getByTestId('confirm-dialog-backdrop')).toBeInTheDocument();
  });

  it('keeps the optimistic completion visible when the complete request fails over the network', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-07-01T12:00:00.000Z'));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method ?? 'GET';
        if (url === '/api/chores' && method === 'GET') {
          return jsonResponse({ success: true, data: mockChores });
        }
        if (url === '/api/chores/1/complete' && method === 'PATCH') {
          return Promise.reject(new Error('network unavailable'));
        }
        throw new Error(`Unhandled fetch: ${method} ${url}`);
      }),
    );

    render(
      <ChoresView householdTimezone="UTC" rooms={mockRooms} swipeStyle="ios" onSwipeStyleChange={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    const vacuumBar = screen.getByText('Vacuum').closest('[data-testid="chore-bar"]') as HTMLElement;
    await user.click(vacuumBar);

    await waitFor(() => expect(within(vacuumBar).getByText('0 days ago')).toBeInTheDocument());
  });

  it('keeps a chore removed from the list when the delete request fails over the network', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method ?? 'GET';
        if (url === '/api/chores' && method === 'GET') {
          return jsonResponse({ success: true, data: mockChores });
        }
        if (url === '/api/chores/1' && method === 'DELETE') {
          return Promise.reject(new Error('network unavailable'));
        }
        throw new Error(`Unhandled fetch: ${method} ${url}`);
      }),
    );

    render(
      <ChoresView householdTimezone="UTC" rooms={mockRooms} swipeStyle="ios" onSwipeStyleChange={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    const vacuumRow = screen.getByText('Vacuum').closest('[data-testid="chore-row"]') as HTMLElement;
    await user.click(within(vacuumRow).getByLabelText('Delete chore'));

    await waitFor(() => expect(screen.queryByText('Vacuum')).not.toBeInTheDocument());
  });

  it('queues a failed complete mutation onto the outbox and reconciles once it later flushes', async () => {
    const user = userEvent.setup();
    let completeAttempts = 0;
    let putBody: Record<string, unknown> | null = null;
    const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';
      if (url === '/api/chores' && method === 'GET') {
        return jsonResponse({ success: true, data: mockChores });
      }
      if (url === '/api/chores/1/complete' && method === 'PATCH') {
        completeAttempts += 1;
        if (completeAttempts === 1) return Promise.reject(new Error('offline'));
        return jsonResponse({
          success: true,
          data: {
            id: 1,
            name: 'Vacuum',
            roomId: 1,
            dateLastCompleted: '2026-07-02T00:00:00.000Z',
            duration: 20,
            frequency: 7,
            version: 2,
          },
        });
      }
      if (url === '/api/chores/1' && method === 'PUT') {
        putBody = init?.body ? JSON.parse(init.body as string) : null;
        return jsonResponse({
          success: true,
          data: {
            id: 1,
            name: 'Vacuum Deluxe',
            roomId: 1,
            dateLastCompleted: '2026-07-02T00:00:00.000Z',
            duration: 20,
            frequency: 7,
            version: 3,
          },
        });
      }
      throw new Error(`Unhandled fetch: ${method} ${url}`);
    });
    vi.stubGlobal('fetch', fetchImpl);
    const testOutbox = createOutbox(fetchImpl);

    render(
      <ChoresView
        householdTimezone="UTC"
        outbox={testOutbox}
        rooms={mockRooms}
        swipeStyle="ios"
        onSwipeStyleChange={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    const vacuumBar = screen.getByText('Vacuum').closest('[data-testid="chore-bar"]') as HTMLElement;
    await user.click(vacuumBar);

    await waitFor(() => expect(testOutbox.getEntries()).toHaveLength(1));

    await act(async () => {
      await testOutbox.flush();
    });
    await waitFor(() => expect(testOutbox.getEntries()).toHaveLength(0));

    const vacuumRowAfterSync = screen.getByText('Vacuum').closest('[data-testid="chore-row"]') as HTMLElement;
    await user.click(within(vacuumRowAfterSync).getByLabelText('Edit chore'));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(putBody).toMatchObject({ version: 2 }));

    testOutbox.dispose();
  });

  it('renders from the IndexedDB cache and marks it stale when the initial fetch fails', async () => {
    await writeChoresCache(mockChores);
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network down'))),
    );

    render(
      <ChoresView householdTimezone="UTC" rooms={mockRooms} swipeStyle="ios" onSwipeStyleChange={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    expect(screen.getByTestId('status-banner')).toBeInTheDocument();
  });

  it('renders from the IndexedDB cache and marks it stale when offline at load time', async () => {
    await writeChoresCache(mockChores);
    vi.stubGlobal('navigator', { ...navigator, onLine: false });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('fetch should not be called while offline');
      }),
    );

    render(
      <ChoresView householdTimezone="UTC" rooms={mockRooms} swipeStyle="ios" onSwipeStyleChange={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    expect(screen.getByTestId('status-banner')).toBeInTheDocument();
  });

  it('clears the stale banner automatically once a live fetch succeeds', async () => {
    await writeChoresCache(mockChores);
    vi.stubGlobal('navigator', { ...navigator, onLine: false });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => jsonResponse({ success: true, data: mockChores })),
    );

    render(
      <ChoresView householdTimezone="UTC" rooms={mockRooms} swipeStyle="ios" onSwipeStyleChange={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByTestId('status-banner')).toBeInTheDocument());

    vi.stubGlobal('navigator', { ...navigator, onLine: true });
    window.dispatchEvent(new Event('online'));

    await waitFor(() => expect(screen.queryByTestId('status-banner')).not.toBeInTheDocument());
  });

  it('shows a chore still pending in the outbox after a reload while offline (not lost)', async () => {
    await writeChoresCache(mockChores);
    vi.stubGlobal('navigator', { ...navigator, onLine: false });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('fetch should not be called while offline');
      }),
    );
    const testOutbox = createOutbox(vi.fn());
    testOutbox.append({
      type: 'create',
      tempId: -123,
      payload: {
        name: 'Mop Floors',
        roomId: 2,
        dateLastCompleted: '2026-06-15T00:00:00.000Z',
        duration: 15,
        frequency: 3,
      },
    });

    render(
      <ChoresView
        householdTimezone="UTC"
        outbox={testOutbox}
        rooms={mockRooms}
        swipeStyle="ios"
        onSwipeStyleChange={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    expect(screen.getByText('Mop Floors')).toBeInTheDocument();

    testOutbox.dispose();
  });

  it('opens Settings from the gear icon and reports a swipe-style change up to the caller', async () => {
    const user = userEvent.setup();
    const onSwipeStyleChange = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method ?? 'GET';
        if (url === '/api/chores' && method === 'GET') {
          return jsonResponse({ success: true, data: mockChores });
        }
        if (url === '/api/me/swipe-style' && method === 'PATCH') {
          return jsonResponse({ success: true, data: { swipeStyle: 'android' } });
        }
        throw new Error(`Unhandled fetch: ${method} ${url}`);
      }),
    );

    render(
      <ChoresView
        householdTimezone="UTC"
        rooms={mockRooms}
        swipeStyle="ios"
        onSwipeStyleChange={onSwipeStyleChange}
      />,
    );
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByTestId('settings-modal-backdrop')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Android/ }));

    expect(onSwipeStyleChange).toHaveBeenCalledWith('android');
  });

  // ---- Tier 2: honest empty state (gate on isStale) ----

  it("shows the genuinely-empty prompt (not the can't-load block) when a fresh fetch returns no chores", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => jsonResponse({ success: true, data: [] })),
    );

    render(
      <ChoresView householdTimezone="UTC" rooms={mockRooms} swipeStyle="ios" onSwipeStyleChange={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByText(/No chores yet — tap \+ Add Chore/)).toBeInTheDocument());
    expect(screen.queryByTestId('chores-unavailable')).not.toBeInTheDocument();
    expect(screen.queryByTestId('status-banner')).not.toBeInTheDocument();
  });

  it("shows the can't-load block (not the empty prompt) when the fetch throws and the cache is empty", async () => {
    await writeChoresCache([]);
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network down'))),
    );

    render(
      <ChoresView householdTimezone="UTC" rooms={mockRooms} swipeStyle="ios" onSwipeStyleChange={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByTestId('chores-unavailable')).toBeInTheDocument());
    expect(screen.queryByText(/No chores yet/)).not.toBeInTheDocument();
  });

  it("shows the can't-load block when a resolved 401 empties the list (DD1 unification)", async () => {
    await writeChoresCache([]);
    vi.stubGlobal(
      'fetch',
      vi.fn(() => unauthorizedResponse()),
    );

    render(
      <ChoresView householdTimezone="UTC" rooms={mockRooms} swipeStyle="ios" onSwipeStyleChange={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByTestId('chores-unavailable')).toBeInTheDocument());
    expect(screen.queryByText(/No chores yet/)).not.toBeInTheDocument();
    // Online + stale => amber banner with a Retry action, not a bare empty list.
    expect(screen.getByTestId('status-banner')).toBeInTheDocument();
  });

  it('renders the benign "no chores in this room" state when a loaded list is filtered to zero', async () => {
    // Rooms 1 & 2 have chores; selecting room 3 (no chores) is a benign filter
    // miss, not an error — must NOT show the amber can't-load block.
    stubChoresFetch();

    render(
      <ChoresView
        householdTimezone="UTC"
        selectedRoom="3"
        rooms={[...mockRooms, { id: 3, householdId: 1, name: 'Garage' }]}
        swipeStyle="ios"
        onSwipeStyleChange={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('chores-empty-room')).toBeInTheDocument());
    expect(screen.queryByTestId('chores-unavailable')).not.toBeInTheDocument();
    expect(screen.queryByText(/No chores yet/)).not.toBeInTheDocument();
  });

  it("shows the can't-load block after a conflict discard hits a resolved 401 (cache evicted)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-07-01T12:00:00.000Z'));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    let getCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method ?? 'GET';
        if (url === '/api/chores' && method === 'GET') {
          getCount += 1;
          if (getCount === 1) return jsonResponse({ success: true, data: mockChores });
          return unauthorizedResponse();
        }
        if (url === '/api/chores/1' && method === 'PUT') {
          return Promise.resolve(
            new Response(JSON.stringify({ success: false, error: 'Chore was changed elsewhere' }), {
              status: 409,
              headers: { 'content-type': 'application/json' },
            }),
          );
        }
        throw new Error(`Unhandled fetch: ${method} ${url}`);
      }),
    );

    render(
      <ChoresView householdTimezone="UTC" rooms={mockRooms} swipeStyle="ios" onSwipeStyleChange={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    // Simulate Safari ITP evicting the IndexedDB chores cache between load and discard.
    await clearChoresCache();

    await user.click(within(rowFor('Vacuum')).getByLabelText('Edit chore'));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(screen.getByText('This chore was changed elsewhere.')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Discard my changes' }));

    await waitFor(() => expect(screen.getByTestId('chores-unavailable')).toBeInTheDocument());
    expect(screen.getByTestId('status-banner')).toBeInTheDocument();
  });

  // ---- Tier 4: Retry button + offline guard + focus management ----

  it('unregisters the SW + clears caches, then does a top-level navigation to / on Retry (DD-1)', async () => {
    // Retry must tear the service worker + caches down first, so that the
    // subsequent navigation to `/` (which is NOT denylisted) reaches the network
    // for Cloudflare Access to re-authenticate instead of being answered the
    // stale precached shell.
    await writeChoresCache(mockChores);
    const location = stubLocationAssign();
    const unregister = vi.fn(() => Promise.resolve(true));
    const cacheDelete = vi.fn(() => Promise.resolve(true));
    vi.stubGlobal('navigator', {
      ...navigator,
      onLine: true,
      serviceWorker: { getRegistrations: vi.fn(() => Promise.resolve([{ unregister }, { unregister }])) },
    });
    vi.stubGlobal('caches', {
      keys: vi.fn(() => Promise.resolve(['workbox-precache-v1', 'assets'])),
      delete: cacheDelete,
    });
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => unauthorizedResponse()),
    );

    try {
      render(
        <ChoresView
          householdTimezone="UTC"
          rooms={mockRooms}
          swipeStyle="ios"
          onSwipeStyleChange={vi.fn()}
        />,
      );
      await waitFor(() => expect(screen.getByTestId('status-banner-action')).toBeInTheDocument());

      await user.click(screen.getByTestId('status-banner-action'));

      // The navigation is still ultimately performed...
      await waitFor(() => expect(location.assign).toHaveBeenCalledWith('/'));
      // ...but only after every SW registration + cache was torn down.
      expect(unregister).toHaveBeenCalledTimes(2);
      expect(cacheDelete).toHaveBeenCalledWith('workbox-precache-v1');
      expect(cacheDelete).toHaveBeenCalledWith('assets');
    } finally {
      location.restore();
    }
  });

  it('still navigates to / on Retry when serviceWorker/caches are unavailable (jsdom degrade path)', async () => {
    await writeChoresCache(mockChores);
    const location = stubLocationAssign();
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => unauthorizedResponse()),
    );

    try {
      render(
        <ChoresView
          householdTimezone="UTC"
          rooms={mockRooms}
          swipeStyle="ios"
          onSwipeStyleChange={vi.fn()}
        />,
      );
      await waitFor(() => expect(screen.getByTestId('status-banner-action')).toBeInTheDocument());

      await user.click(screen.getByTestId('status-banner-action'));
      await waitFor(() => expect(location.assign).toHaveBeenCalledWith('/'));
    } finally {
      location.restore();
    }
  });

  it('still navigates to / on Retry even if SW-unregister / cache-delete rejects (FIX C)', async () => {
    // In Safari/ITP/private-browsing a storage or SW teardown call can reject —
    // that must not block the recovery navigation (a silent no-op Retry is
    // worse than the original bug).
    await writeChoresCache(mockChores);
    const location = stubLocationAssign();
    const unregister = vi.fn(() => Promise.reject(new Error('unregister failed')));
    const cacheDelete = vi.fn(() => Promise.reject(new Error('cache delete failed')));
    vi.stubGlobal('navigator', {
      ...navigator,
      onLine: true,
      serviceWorker: { getRegistrations: vi.fn(() => Promise.resolve([{ unregister }])) },
    });
    vi.stubGlobal('caches', {
      keys: vi.fn(() => Promise.resolve(['workbox-precache-v1'])),
      delete: cacheDelete,
    });
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => unauthorizedResponse()),
    );

    try {
      render(
        <ChoresView
          householdTimezone="UTC"
          rooms={mockRooms}
          swipeStyle="ios"
          onSwipeStyleChange={vi.fn()}
        />,
      );
      await waitFor(() => expect(screen.getByTestId('status-banner-action')).toBeInTheDocument());

      await user.click(screen.getByTestId('status-banner-action'));

      // The teardown was attempted but rejected — navigation still happens.
      await waitFor(() => expect(location.assign).toHaveBeenCalledWith('/'));
      expect(unregister).toHaveBeenCalled();
      expect(cacheDelete).toHaveBeenCalledWith('workbox-precache-v1');
    } finally {
      location.restore();
    }
  });

  it('hides Retry and shows the offline copy when offline, then re-shows Retry once back online (DD7)', async () => {
    await writeChoresCache(mockChores);
    vi.stubGlobal('navigator', { ...navigator, onLine: false });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('fetch should not be called while offline');
      }),
    );

    render(
      <ChoresView householdTimezone="UTC" rooms={mockRooms} swipeStyle="ios" onSwipeStyleChange={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    expect(screen.queryByTestId('status-banner-action')).not.toBeInTheDocument();
    expect(screen.getByText(/You're offline/)).toBeInTheDocument();

    // Back online, but the re-fetch still fails (session expired) => stale stays,
    // so the amber Retry banner is restored.
    vi.stubGlobal('navigator', { ...navigator, onLine: true });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => unauthorizedResponse()),
    );
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(screen.getByTestId('status-banner-action')).toBeInTheDocument());
  });

  it('moves focus to the banner container when a focused Retry is dropped on going offline (DD7)', async () => {
    await writeChoresCache(mockChores);
    vi.stubGlobal(
      'fetch',
      vi.fn(() => unauthorizedResponse()),
    );

    render(
      <ChoresView householdTimezone="UTC" rooms={mockRooms} swipeStyle="ios" onSwipeStyleChange={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByTestId('status-banner-action')).toBeInTheDocument());

    const retry = screen.getByTestId('status-banner-action');
    retry.focus();
    expect(retry).toHaveFocus();

    vi.stubGlobal('navigator', { ...navigator, onLine: false });
    await act(async () => {
      window.dispatchEvent(new Event('offline'));
    });

    await waitFor(() => expect(screen.queryByTestId('status-banner-action')).not.toBeInTheDocument());
    expect(screen.getByTestId('status-banner')).toHaveFocus();
  });

  it('moves focus to "+ Add Chore" when a focused banner is unmounted on a successful reconnect (DD13)', async () => {
    await writeChoresCache(mockChores);
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        calls += 1;
        if (calls === 1) return unauthorizedResponse();
        return jsonResponse({ success: true, data: mockChores });
      }),
    );

    render(
      <ChoresView householdTimezone="UTC" rooms={mockRooms} swipeStyle="ios" onSwipeStyleChange={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByTestId('status-banner-action')).toBeInTheDocument());

    screen.getByTestId('status-banner-action').focus();

    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(screen.queryByTestId('status-banner')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /add chore/i })).toHaveFocus();
  });

  // ---- FIX 2: 403 (removed from household) handled distinctly from 401 ----

  it('does NOT render the revoked household cached chores on a 403 — clears cache and signals revocation', async () => {
    // A populated cache exists for the (now-revoked) household. Unlike a 401,
    // a 403 must not fall back to it under the "session expired — Retry" banner.
    await writeChoresCache(mockChores);
    const onHouseholdRevoked = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => forbiddenResponse()),
    );

    render(
      <ChoresView
        householdTimezone="UTC"
        rooms={mockRooms}
        swipeStyle="ios"
        onSwipeStyleChange={vi.fn()}
        onHouseholdRevoked={onHouseholdRevoked}
      />,
    );

    // The revocation is signalled up to App so it can re-scope us.
    await waitFor(() => expect(onHouseholdRevoked).toHaveBeenCalled());
    // The revoked household's private chores are never shown...
    expect(screen.queryByText('Vacuum')).not.toBeInTheDocument();
    expect(screen.queryByText('Dishes')).not.toBeInTheDocument();
    // ...and no stale "session may have expired" banner promising cached data
    // (that path is reserved for 401 — see the DD1-unification test above).
    expect(screen.queryByTestId('status-banner')).not.toBeInTheDocument();
    // The revoked household's cache is dropped so it can't resurface.
    expect(await readChoresCache()).toBeUndefined();
  });

  // ---- FIX 3: load() ignores a superseded connectivity result ----

  it('does not let a superseded in-flight online load() overwrite the most-recent offline signal', async () => {
    await writeChoresCache(mockChores);
    // Mount offline: renders cached data under the offline (gray) banner.
    vi.stubGlobal('navigator', { ...navigator, onLine: false });

    let resolveChores: (res: Response) => void = () => {};
    const deferred = new Promise<Response>((resolve) => {
      resolveChores = resolve;
    });
    // Only the online-triggered load reaches fetch (the offline mount
    // short-circuits before fetching), so a single deferred response is enough.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => deferred),
    );

    render(
      <ChoresView householdTimezone="UTC" rooms={mockRooms} swipeStyle="ios" onSwipeStyleChange={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByText(/You're offline/)).toBeInTheDocument());

    // Go online — kicks off an in-flight load() that will resolve fresh data.
    vi.stubGlobal('navigator', { ...navigator, onLine: true });
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    // Flap back offline BEFORE the online fetch resolves — this is the newer,
    // authoritative connectivity signal.
    vi.stubGlobal('navigator', { ...navigator, onLine: false });
    await act(async () => {
      window.dispatchEvent(new Event('offline'));
    });

    // The superseded online fetch finally resolves with a fresh success — which,
    // if applied, would clear the stale flag and unmount the offline banner.
    await act(async () => {
      resolveChores(
        new Response(JSON.stringify({ success: true, data: mockChores }), {
          headers: { 'content-type': 'application/json' },
        }),
      );
      await deferred;
    });

    // The generation guard drops the stale result: the most-recent signal
    // (offline) still governs, so the offline banner stays and the online-only
    // amber Retry action never appears.
    expect(screen.getByText(/You're offline/)).toBeInTheDocument();
    expect(screen.queryByTestId('status-banner-action')).not.toBeInTheDocument();
  });
});

function errorResponse(status: number, error: string) {
  return Promise.resolve(
    new Response(JSON.stringify({ success: false, error }), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

type MutationHandler = (url: string, method: string) => Promise<Response> | undefined;

function stubMutationFetch(handler: MutationHandler) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';
    if (url === '/api/chores' && method === 'GET') {
      return jsonResponse({ success: true, data: mockChores });
    }
    const res = handler(url, method);
    if (res) return res;
    throw new Error(`Unhandled fetch: ${method} ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderView(outbox?: ReturnType<typeof createOutbox>) {
  return render(
    <ChoresView
      householdTimezone="UTC"
      rooms={mockRooms}
      swipeStyle="ios"
      onSwipeStyleChange={vi.fn()}
      outbox={outbox}
    />,
  );
}

function barFor(name: string) {
  return screen.getByText(name).closest('[data-testid="chore-bar"]') as HTMLElement;
}

function rowFor(name: string) {
  return screen.getByText(name).closest('[data-testid="chore-row"]') as HTMLElement;
}

// The rendered rows in DOM order, each identified by whichever of `names` it contains.
function rowNames(names: string[]) {
  return screen
    .getAllByTestId('chore-row')
    .map((row) => names.find((name) => within(row).queryByText(name)) ?? '?');
}

describe('ChoresView feedback toast', () => {
  it.each([400, 500, 401, 403])(
    'rolls back a complete answered %i and shows a persistent error toast',
    async (status) => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.setSystemTime(new Date('2026-07-01T12:00:00.000Z'));
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      stubMutationFetch((url) =>
        url === '/api/chores/1/complete' ? errorResponse(status, 'nope') : undefined,
      );
      renderView();
      await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
      expect(within(barFor('Vacuum')).getByText('30 days ago')).toBeInTheDocument();

      await user.click(barFor('Vacuum'));

      const toast = await screen.findByTestId('feedback-toast');
      expect(toast).toHaveAttribute('data-tone', 'error');
      expect(screen.getByRole('alert')).toContainElement(toast);
      expect(
        within(toast).getByText("Couldn't mark the chore complete. Please try again."),
      ).toBeInTheDocument();
      expect(within(barFor('Vacuum')).getByText('30 days ago')).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20000);
      });
      expect(screen.getByTestId('feedback-toast')).toHaveAttribute('data-tone', 'error');
      await user.click(screen.getByTestId('feedback-toast-dismiss'));
      expect(screen.queryByTestId('feedback-toast')).not.toBeInTheDocument();
    },
  );

  it('keeps the row order through an optimistic complete and its rollback', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-07-01T12:00:00.000Z'));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    let resolveComplete: (response: Response) => void = () => {};
    const pendingComplete = new Promise<Response>((resolve) => {
      resolveComplete = resolve;
    });
    stubMutationFetch((url) => (url === '/api/chores/2/complete' ? pendingComplete : undefined));
    renderView();
    await waitFor(() => expect(screen.getByText('Dishes')).toBeInTheDocument());
    // Both mock chores are red; Dishes (weighted overdue 10) outranks Vacuum (3.29).
    expect(rowNames(['Vacuum', 'Dishes'])).toEqual(['Dishes', 'Vacuum']);

    await user.click(barFor('Dishes'));

    // Optimistic completion turns Dishes green, but the stable order keeps it in place.
    await waitFor(() => expect(within(barFor('Dishes')).getByText(/^0\s+days\s+ago$/)).toBeInTheDocument());
    expect(rowNames(['Vacuum', 'Dishes'])).toEqual(['Dishes', 'Vacuum']);
    expect(screen.getAllByTestId('chore-row')).toHaveLength(2);

    resolveComplete(await errorResponse(500, 'nope'));

    expect(await screen.findByTestId('feedback-toast')).toHaveAttribute('data-tone', 'error');
    // Wait for the rollback itself (Dishes back to 11 days ago) so the order check is not vacuous.
    await waitFor(() => expect(within(barFor('Dishes')).getByText('11 days ago')).toBeInTheDocument());
    expect(rowNames(['Vacuum', 'Dishes'])).toEqual(['Dishes', 'Vacuum']);
    expect(screen.getAllByTestId('chore-row')).toHaveLength(2);
  });

  it('shows the room-filtered list as the global order restricted to that room', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const now = new Date('2026-07-01T12:00:00.000Z');
    vi.setSystemTime(now);
    const wire = (id: number, name: string, roomId: number, daysSince: number, frequency: number) => ({
      id,
      name,
      roomId,
      dateLastCompleted: new Date(now.getTime() - daysSince * 86_400_000).toISOString(),
      duration: 10,
      frequency,
      version: 1,
    });
    // Room 1: six reds below the pressure threshold (weighted overdue 0.1 to 0.6) and four greens.
    // Room 2: one red at 0.9 that ranks first globally but adds no pressure.
    const wireChores = [
      ...[11, 12, 13, 14, 15, 16].map((d, i) => wire(i + 1, `Red ${i + 1} x`, 1, d, 10)),
      ...[1, 2, 3, 4].map((d, i) => wire(i + 7, `Green ${i + 1} x`, 1, d, 10)),
      wire(11, 'Other room red x', 2, 19, 10),
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method ?? 'GET';
        if (url === '/api/chores' && method === 'GET') {
          return jsonResponse({ success: true, data: wireChores });
        }
        throw new Error(`Unhandled fetch: ${method} ${url}`);
      }),
    );
    const all = wireChores.map((c) => ({ ...c, dateLastCompleted: new Date(c.dateLastCompleted) }));
    const roomOne = all.filter((c) => c.roomId === 1);
    const filteredAfterSort = orderChores(all, now, 'UTC')
      .filter((c) => c.roomId === 1)
      .map((c) => c.name);
    const sortedAfterFilter = orderChores(roomOne, now, 'UTC').map((c) => c.name);
    // Precondition: the global order restricted to the room differs from sorting the room alone.
    expect(filteredAfterSort).not.toEqual(sortedAfterFilter);

    render(
      <ChoresView
        householdTimezone="UTC"
        selectedRoom="1"
        rooms={mockRooms}
        swipeStyle="ios"
        onSwipeStyleChange={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByText('Red 1 x')).toBeInTheDocument());

    expect(rowNames(all.map((c) => c.name))).toEqual(filteredAfterSort);
    expect(screen.queryByText('Other room red x')).not.toBeInTheDocument();
  });

  it('shows the search-filtered list as the global order restricted to the matches', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const now = new Date('2026-07-01T12:00:00.000Z');
    vi.setSystemTime(now);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const wire = (id: number, name: string, daysSince: number) => ({
      id,
      name,
      roomId: 1,
      dateLastCompleted: new Date(now.getTime() - daysSince * 86_400_000).toISOString(),
      duration: 10,
      frequency: 10,
      version: 1,
    });
    // Matching chores (names contain "x"): six reds below the pressure threshold plus four greens.
    // Non-matching: one red at 0.9 that ranks first globally but adds no pressure.
    const wireChores = [
      ...[11, 12, 13, 14, 15, 16].map((d, i) => wire(i + 1, `Red ${i + 1} x`, d)),
      ...[1, 2, 3, 4].map((d, i) => wire(i + 7, `Green ${i + 1} x`, d)),
      wire(11, 'Other red', 19),
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method ?? 'GET';
        if (url === '/api/chores' && method === 'GET') {
          return jsonResponse({ success: true, data: wireChores });
        }
        throw new Error(`Unhandled fetch: ${method} ${url}`);
      }),
    );
    const all = wireChores.map((c) => ({ ...c, dateLastCompleted: new Date(c.dateLastCompleted) }));
    const searched = all.filter((c) => c.name.includes('x'));
    const filteredAfterSort = orderChores(all, now, 'UTC')
      .filter((c) => c.name.includes('x'))
      .map((c) => c.name);
    const sortedAfterFilter = orderChores(searched, now, 'UTC').map((c) => c.name);
    // Precondition: the global order restricted to the matches differs from sorting the matches alone.
    expect(filteredAfterSort).not.toEqual(sortedAfterFilter);

    renderView();
    await waitFor(() => expect(screen.getByText('Red 1 x')).toBeInTheDocument());

    await user.type(screen.getByRole('searchbox', { name: 'Search chores' }), 'x');

    await waitFor(() => expect(screen.queryByText('Other red')).not.toBeInTheDocument());
    expect(rowNames(all.map((c) => c.name))).toEqual(filteredAfterSort);
  });

  it('appends a new chore after an offline blip and reconnect without reordering existing rows', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const now = new Date('2026-07-01T12:00:00.000Z');
    vi.setSystemTime(now);
    const wire = (id: number, name: string, daysSince: number) => ({
      id,
      name,
      roomId: 1,
      dateLastCompleted: new Date(now.getTime() - daysSince * 86_400_000).toISOString(),
      duration: 10,
      frequency: 10,
      version: 1,
    });
    let list = [wire(1, 'Alpha', 15), wire(2, 'Beta', 19)];
    stubListFetch(() => jsonResponse({ success: true, data: list }));
    renderView();
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    const initial = rowNames(['Alpha', 'Beta', 'Gamma']);
    expect(initial).toEqual(['Beta', 'Alpha']);

    // A reconnect reload returning a new, most-overdue chore appends it; existing rows keep order.
    list = [wire(3, 'Gamma', 40), ...list];
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(screen.getByText('Gamma')).toBeInTheDocument());
    expect(rowNames(['Alpha', 'Beta', 'Gamma'])).toEqual(['Beta', 'Alpha', 'Gamma']);
  });

  it.each([400, 500])('re-inserts a chore when delete is answered %i', async (status) => {
    const user = userEvent.setup();
    stubMutationFetch((url, method) =>
      url === '/api/chores/1' && method === 'DELETE' ? errorResponse(status, 'nope') : undefined,
    );
    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await user.click(within(rowFor('Vacuum')).getByLabelText('Delete chore'));

    expect(await screen.findByText("Couldn't delete the chore. Please try again.")).toBeInTheDocument();
    expect(screen.getByText('Vacuum')).toBeInTheDocument();
  });

  it('restores the edited name and shows the error toast when an edit fails', async () => {
    const user = userEvent.setup();
    stubMutationFetch((url, method) =>
      url === '/api/chores/1' && method === 'PUT' ? errorResponse(500, 'boom') : undefined,
    );
    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await user.click(within(rowFor('Vacuum')).getByLabelText('Edit chore'));
    const name = screen.getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Mop');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText("Couldn't save your changes. Please try again.")).toBeInTheDocument();
    expect(screen.getByText('Vacuum')).toBeInTheDocument();
    expect(screen.queryByText('Mop')).not.toBeInTheDocument();
  });

  it('removes a created chore and shows the error toast when create fails', async () => {
    const user = userEvent.setup();
    stubMutationFetch((url, method) =>
      url === '/api/chores' && method === 'POST' ? errorResponse(500, 'boom') : undefined,
    );
    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: '+ Add Chore' }));
    await user.type(screen.getByLabelText('Name'), 'Windows');
    await user.selectOptions(screen.getByLabelText('Room'), '1');
    await user.type(screen.getByLabelText('Duration (minutes)'), '10');
    await user.type(screen.getByLabelText('Frequency (days)'), '7');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText("Couldn't add the chore. Please try again.")).toBeInTheDocument();
    expect(screen.queryByText('Windows')).not.toBeInTheDocument();
  });

  it('treats a non-JSON 502 as a failure and does not queue it in the outbox', async () => {
    const user = userEvent.setup();
    const outbox = createOutbox(vi.fn());
    stubMutationFetch((url) =>
      url === '/api/chores/1/complete'
        ? Promise.resolve(new Response('<html>Bad Gateway</html>', { status: 502 }))
        : undefined,
    );
    renderView(outbox);
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await user.click(barFor('Vacuum'));

    expect(await screen.findByTestId('feedback-toast')).toHaveAttribute('data-tone', 'error');
    expect(outbox.getEntries()).toHaveLength(0);
  });

  it('treats a 2xx with an unparseable body as a failure', async () => {
    const user = userEvent.setup();
    const outbox = createOutbox(vi.fn());
    stubMutationFetch((url) =>
      url === '/api/chores/1/complete'
        ? Promise.resolve(new Response('not json', { status: 200 }))
        : undefined,
    );
    renderView(outbox);
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await user.click(barFor('Vacuum'));

    expect(await screen.findByTestId('feedback-toast')).toHaveAttribute('data-tone', 'error');
    expect(outbox.getEntries()).toHaveLength(0);
  });

  it('shows the success toast and treats DELETE 404 on a real id as success', async () => {
    const user = userEvent.setup();
    stubMutationFetch((url, method) =>
      url === '/api/chores/1' && method === 'DELETE' ? errorResponse(404, 'Not found') : undefined,
    );
    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await user.click(within(rowFor('Vacuum')).getByLabelText('Delete chore'));

    const toast = await screen.findByTestId('feedback-toast');
    expect(toast).toHaveAttribute('data-tone', 'success');
    expect(toast).toHaveTextContent('Chore deleted');
    expect(screen.queryByText('Vacuum')).not.toBeInTheDocument();
  });

  it('removes a chore locally and says it no longer exists when complete is answered 404', async () => {
    const user = userEvent.setup();
    stubMutationFetch((url) =>
      url === '/api/chores/1/complete' ? errorResponse(404, 'Not found') : undefined,
    );
    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await user.click(barFor('Vacuum'));

    expect(await screen.findByText('That chore no longer exists.')).toBeInTheDocument();
    expect(screen.queryByText('Vacuum')).not.toBeInTheDocument();
  });

  it('removes a chore locally when edit is answered 404', async () => {
    const user = userEvent.setup();
    stubMutationFetch((url, method) =>
      url === '/api/chores/1' && method === 'PUT' ? errorResponse(404, 'Not found') : undefined,
    );
    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await user.click(within(rowFor('Vacuum')).getByLabelText('Edit chore'));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('That chore no longer exists.')).toBeInTheDocument();
    expect(screen.queryByText('Vacuum')).not.toBeInTheDocument();
  });

  it('shows a green toast only after the response arrives, then auto-dismisses it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-07-01T12:00:00.000Z'));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    stubMutationFetch((url) =>
      url === '/api/chores/1/complete'
        ? jsonResponse({ success: true, data: { ...mockChores[0], version: 2 } })
        : undefined,
    );
    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await user.click(barFor('Vacuum'));

    const toast = await screen.findByTestId('feedback-toast');
    expect(toast).toHaveAttribute('data-tone', 'success');
    expect(toast).toHaveTextContent('Chore completed');
    // A completed chore now carries Undo, so the toast lives the 8 s action window, not 4 s.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4500);
    });
    expect(screen.getByTestId('feedback-toast')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(screen.queryByTestId('feedback-toast')).not.toBeInTheDocument();
  });

  it('shows a neutral toast and queues exactly one outbox entry on a network failure', async () => {
    const user = userEvent.setup();
    const outbox = createOutbox(vi.fn());
    stubMutationFetch((url) =>
      url === '/api/chores/1/complete' ? Promise.reject(new Error('network unavailable')) : undefined,
    );
    renderView(outbox);
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await user.click(barFor('Vacuum'));

    const toast = await screen.findByTestId('feedback-toast');
    expect(toast).toHaveAttribute('data-tone', 'neutral');
    expect(toast).toHaveTextContent("Saved offline — will sync when you're back online");
    expect(outbox.getEntries()).toHaveLength(1);
  });

  it.each(['complete', 'create', 'edit', 'delete'] as const)(
    'shows the neutral Saved offline toast and queues a %s entry on a network failure',
    async (type) => {
      const user = userEvent.setup();
      const outbox = createOutbox(vi.fn());
      stubMutationFetch(() => Promise.reject(new Error('network unavailable')));
      renderView(outbox);
      await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

      if (type === 'complete') {
        await user.click(barFor('Vacuum'));
      } else if (type === 'delete') {
        await user.click(within(rowFor('Vacuum')).getByLabelText('Delete chore'));
      } else if (type === 'edit') {
        await user.click(within(rowFor('Vacuum')).getByLabelText('Edit chore'));
        await user.click(screen.getByRole('button', { name: 'Save Changes' }));
      } else {
        await user.click(screen.getByRole('button', { name: '+ Add Chore' }));
        await user.type(screen.getByLabelText('Name'), 'Windows');
        await user.selectOptions(screen.getByLabelText('Room'), '1');
        await user.type(screen.getByLabelText('Duration (minutes)'), '10');
        await user.type(screen.getByLabelText('Frequency (days)'), '7');
        await user.click(screen.getByRole('button', { name: 'Save' }));
      }

      const toast = await screen.findByTestId('feedback-toast');
      expect(toast).toHaveAttribute('data-tone', 'neutral');
      expect(toast).toHaveTextContent("Saved offline — will sync when you're back online");
      expect(outbox.getEntries()).toHaveLength(1);
      expect(outbox.getEntries()[0].type).toBe(type);
    },
  );

  it('keeps a standing error toast when a later network failure would show a neutral one', async () => {
    const user = userEvent.setup();
    const outbox = createOutbox(vi.fn());
    stubMutationFetch((url) => {
      if (url === '/api/chores/1/complete') return errorResponse(500, 'boom');
      if (url === '/api/chores/2/complete') return Promise.reject(new Error('network unavailable'));
      return undefined;
    });
    renderView(outbox);
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await user.click(barFor('Vacuum'));
    expect(await screen.findByTestId('feedback-toast')).toHaveAttribute('data-tone', 'error');
    await user.click(barFor('Dishes'));

    await waitFor(() => expect(outbox.getEntries()).toHaveLength(1));
    expect(screen.getByTestId('feedback-toast')).toHaveAttribute('data-tone', 'error');
    expect(screen.getByTestId('feedback-toast')).toHaveTextContent("Couldn't mark the chore complete");
  });

  it('lets a later success replace a standing error toast', async () => {
    const user = userEvent.setup();
    stubMutationFetch((url) => {
      if (url === '/api/chores/1/complete') return errorResponse(500, 'boom');
      if (url === '/api/chores/2/complete')
        return jsonResponse({ success: true, data: { ...mockChores[1], version: 2 } });
      return undefined;
    });
    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await user.click(barFor('Vacuum'));
    expect(await screen.findByTestId('feedback-toast')).toHaveAttribute('data-tone', 'error');
    await user.click(barFor('Dishes'));

    await waitFor(() => expect(screen.getByTestId('feedback-toast')).toHaveAttribute('data-tone', 'success'));
    expect(screen.getByTestId('feedback-toast')).toHaveTextContent('Chore completed');
    // The success toast now carries Undo and therefore also a Dismiss button.
    expect(screen.getByTestId('feedback-toast-undo')).toBeInTheDocument();
    expect(screen.getByTestId('feedback-toast-dismiss')).toBeInTheDocument();
  });

  it('does not undo a later successful complete when an earlier edit on the same chore fails', async () => {
    const user = userEvent.setup();
    let failEdit: (r: Response) => void = () => {};
    const editPending = new Promise<Response>((resolve) => {
      failEdit = resolve;
    });
    const completedAt = new Date().toISOString();
    stubMutationFetch((url, method) => {
      if (url === '/api/chores/1' && method === 'PUT') return editPending;
      if (url === '/api/chores/1/complete')
        return jsonResponse({
          success: true,
          data: { ...mockChores[0], name: 'Mop', dateLastCompleted: completedAt, version: 2 },
        });
      return undefined;
    });
    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await user.click(within(rowFor('Vacuum')).getByLabelText('Edit chore'));
    const name = screen.getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Mop');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(screen.getByText('Mop')).toBeInTheDocument());
    await user.click(barFor('Mop'));
    await waitFor(() => expect(within(barFor('Mop')).getByText('0 days ago')).toBeInTheDocument());

    await act(async () => {
      failEdit(
        new Response(JSON.stringify({ success: false, error: 'boom' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }),
      );
    });

    expect(await screen.findByText("Couldn't save your changes. Please try again.")).toBeInTheDocument();
    expect(screen.getByText('Vacuum')).toBeInTheDocument();
    expect(within(barFor('Vacuum')).getByText('0 days ago')).toBeInTheDocument();
  });

  it('moves focus to + Add Chore when the focused dismiss button is dismissed', async () => {
    const user = userEvent.setup();
    stubMutationFetch((url) => (url === '/api/chores/1/complete' ? errorResponse(500, 'boom') : undefined));
    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await user.click(barFor('Vacuum'));
    const dismiss = await screen.findByTestId('feedback-toast-dismiss');
    dismiss.focus();
    await user.click(dismiss);

    expect(screen.getByRole('button', { name: '+ Add Chore' })).toHaveFocus();
  });

  it('shows a conflict dialog with no toast on a 409 edit', async () => {
    const user = userEvent.setup();
    stubMutationFetch((url, method) =>
      url === '/api/chores/1' && method === 'PUT' ? errorResponse(409, 'changed elsewhere') : undefined,
    );
    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await user.click(within(rowFor('Vacuum')).getByLabelText('Edit chore'));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('This chore was changed elsewhere.')).toBeInTheDocument();
    expect(screen.queryByTestId('feedback-toast')).not.toBeInTheDocument();
  });

  it('gives the list container bottom padding so the last row clears a sticky toast', async () => {
    stubChoresFetch();
    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    expect(rowFor('Vacuum').closest('[aria-live="polite"]')).toHaveClass('pb-4');
  });

  it('shows the error toast and removes the chore when a create is answered 404', async () => {
    const user = userEvent.setup();
    stubMutationFetch((url, method) =>
      url === '/api/chores' && method === 'POST' ? errorResponse(404, 'Not found') : undefined,
    );
    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: '+ Add Chore' }));
    await user.type(screen.getByLabelText('Name'), 'Windows');
    await user.selectOptions(screen.getByLabelText('Room'), '1');
    await user.type(screen.getByLabelText('Duration (minutes)'), '10');
    await user.type(screen.getByLabelText('Frequency (days)'), '7');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText("Couldn't add the chore. Please try again.")).toBeInTheDocument();
    expect(screen.queryByText('Windows')).not.toBeInTheDocument();
  });

  it('keeps a single chore when a refetch already contains the server copy before the create resolves', async () => {
    const user = userEvent.setup();
    let resolvePost: (r: Response) => void = () => {};
    const postPending = new Promise<Response>((resolve) => {
      resolvePost = resolve;
    });
    const serverChore = { ...mockChores[0], id: 7, name: 'Windows', version: 1 };
    const testOutbox = createOutbox(vi.fn(() => errorResponse(400, 'bad')));
    testOutbox.append({ type: 'edit', choreId: 2, baseVersion: 1, payload: createPayload() });
    stubListFetch(
      (n) => jsonResponse({ success: true, data: n === 1 ? mockChores : [...mockChores, serverChore] }),
      (url, method) => (url === '/api/chores' && method === 'POST' ? postPending : undefined),
    );
    renderView(testOutbox);
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: '+ Add Chore' }));
    await user.type(screen.getByLabelText('Name'), 'Windows');
    await user.selectOptions(screen.getByLabelText('Room'), '1');
    await user.type(screen.getByLabelText('Duration (minutes)'), '10');
    await user.type(screen.getByLabelText('Frequency (days)'), '7');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await act(() => testOutbox.flush());
    await waitFor(() => expect(screen.getByTestId('feedback-toast')).toHaveTextContent('list was refreshed'));
    expect(screen.getAllByText('Windows')).toHaveLength(1);

    await act(async () => {
      resolvePost(
        new Response(JSON.stringify({ success: true, data: serverChore }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }),
      );
    });

    await waitFor(() => expect(screen.getByTestId('feedback-toast')).toHaveTextContent('Chore added'));
    expect(screen.getAllByText('Windows')).toHaveLength(1);
  });
});

function createPayload() {
  return {
    name: 'Windows',
    roomId: 1,
    dateLastCompleted: '2026-07-01T00:00:00.000Z',
    duration: 10,
    frequency: 7,
  };
}

// View-side fetch stub: the nth GET /api/chores (1-based) is answered by `list`; anything else by `other`.
function stubListFetch(list: (n: number) => Promise<Response>, other: MutationHandler = () => undefined) {
  let gets = 0;
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';
    if (url === '/api/chores' && method === 'GET') {
      gets += 1;
      return list(gets);
    }
    const res = other(url, method);
    if (res) return res;
    throw new Error(`Unhandled fetch: ${method} ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, getCount: () => gets };
}

const okList = () => jsonResponse({ success: true, data: mockChores });

describe('ChoresView offline flush results', () => {
  it('shows the refresh error toast and drops a temp-id create seeded before mount when it is answered 400', async () => {
    const testOutbox = createOutbox(vi.fn(() => errorResponse(400, 'bad')));
    testOutbox.append({ type: 'create', tempId: -5, payload: createPayload() });
    const { getCount } = stubListFetch(okList);
    renderView(testOutbox);
    await waitFor(() => expect(screen.getByText('Windows')).toBeInTheDocument());

    await act(() => testOutbox.flush());

    const toast = await screen.findByTestId('feedback-toast');
    expect(toast).toHaveAttribute('data-tone', 'error');
    expect(toast).toHaveTextContent("Some offline changes couldn't be synced. The list was refreshed.");
    expect(screen.queryByText('Windows')).not.toBeInTheDocument();
    expect(getCount()).toBe(2);
  });

  it('shows the retry toast, keeps the entry, does not refetch and keeps a queued create on a 500', async () => {
    const testOutbox = createOutbox(vi.fn(() => errorResponse(500, 'boom')));
    testOutbox.append({ type: 'create', tempId: -5, payload: createPayload() });
    const { getCount } = stubListFetch(okList);
    renderView(testOutbox);
    await waitFor(() => expect(screen.getByText('Windows')).toBeInTheDocument());

    await act(() => testOutbox.flush());

    const toast = await screen.findByTestId('feedback-toast');
    expect(toast).toHaveTextContent(
      "Some offline changes haven't synced yet. They'll sync next time you're online or reopen the app.",
    );
    expect(toast).not.toHaveTextContent('refreshed');
    expect(testOutbox.getEntries()).toHaveLength(1);
    expect(getCount()).toBe(1);
    expect(screen.getByText('Windows')).toBeInTheDocument();
  });

  it.each([401, 403, 408, 429])(
    'treats a %i as kept: retry toast, no refetch, entry stays',
    async (status) => {
      const testOutbox = createOutbox(vi.fn(() => errorResponse(status, 'later')));
      testOutbox.append({
        type: 'complete',
        choreId: 1,
        payload: { dateLastCompleted: '2026-07-01T00:00:00.000Z' },
      });
      const { getCount } = stubListFetch(okList);
      renderView(testOutbox);
      await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

      await act(() => testOutbox.flush());

      expect(await screen.findByTestId('feedback-toast')).toHaveTextContent("haven't synced yet");
      expect(testOutbox.getEntries()).toHaveLength(1);
      expect(getCount()).toBe(1);
    },
  );

  it('refetches once and shows one toast for two dropped entries, keeping a still-queued create', async () => {
    const outboxFetch = vi.fn((url: string) =>
      url === '/api/chores' ? Promise.reject(new Error('offline')) : errorResponse(400, 'bad'),
    );
    const testOutbox = createOutbox(outboxFetch as unknown as typeof fetch);
    stubListFetch(okList);
    renderView(testOutbox);
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    act(() => {
      testOutbox.append({ type: 'edit', choreId: 1, baseVersion: 1, payload: createPayload() });
      testOutbox.append({ type: 'edit', choreId: 2, baseVersion: 1, payload: createPayload() });
      testOutbox.append({ type: 'create', tempId: -9, payload: { ...createPayload(), name: 'Mopping' } });
    });

    await act(() => testOutbox.flush());

    await waitFor(() => expect(screen.getAllByTestId('feedback-toast')).toHaveLength(1));
    expect(screen.getByTestId('feedback-toast')).toHaveTextContent('The list was refreshed.');
    expect(testOutbox.getEntries()).toHaveLength(1);
    expect(screen.getByText('Mopping')).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.filter(([u]) => u === '/api/chores')).toHaveLength(2);
  });

  it('says the list could not be synced without a refresh claim when the refetch falls back to the cache', async () => {
    await writeChoresCache([]);
    // Only PUT is answered (400, dropped); the create stays queued because its request throws.
    const outboxFetch = vi.fn((_url: string, init?: RequestInit) =>
      init?.method === 'PUT' ? errorResponse(400, 'bad') : Promise.reject(new Error('offline')),
    );
    const testOutbox = createOutbox(outboxFetch as unknown as typeof fetch);
    stubListFetch((n) => (n === 1 ? okList() : errorResponse(500, 'down')));
    renderView(testOutbox);
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    act(() => {
      testOutbox.append({ type: 'edit', choreId: 1, baseVersion: 1, payload: createPayload() });
      testOutbox.append({ type: 'create', tempId: -5, payload: createPayload() });
    });

    await act(() => testOutbox.flush());

    const toast = await screen.findByTestId('feedback-toast');
    expect(toast).toHaveTextContent("Some offline changes couldn't be synced.");
    expect(toast).not.toHaveTextContent('refreshed');
    expect(testOutbox.getEntries()).toHaveLength(1);
    expect(screen.getByText('Windows')).toBeInTheDocument();
  });

  it('uses the no-refresh message when the refetch throws', async () => {
    const testOutbox = createOutbox(vi.fn(() => errorResponse(400, 'bad')));
    testOutbox.append({ type: 'edit', choreId: 1, baseVersion: 1, payload: createPayload() });
    stubListFetch((n) => (n === 1 ? okList() : Promise.reject(new Error('offline'))));
    renderView(testOutbox);
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await act(() => testOutbox.flush());

    const toast = await screen.findByTestId('feedback-toast');
    expect(toast).toHaveTextContent("Some offline changes couldn't be synced.");
    expect(toast).not.toHaveTextContent('refreshed');
  });

  it('keeps a queued create visible that was added after mount when a dropped edit triggers the refetch', async () => {
    const outboxFetch = vi.fn((_url: string, init?: RequestInit) =>
      init?.method === 'PUT' ? errorResponse(400, 'bad') : Promise.reject(new Error('offline')),
    );
    const testOutbox = createOutbox(outboxFetch as unknown as typeof fetch);
    stubListFetch(okList);
    renderView(testOutbox);
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    act(() => {
      testOutbox.append({ type: 'edit', choreId: 1, baseVersion: 1, payload: createPayload() });
      testOutbox.append({ type: 'create', tempId: -9, payload: { ...createPayload(), name: 'Mopping' } });
    });

    await act(() => testOutbox.flush());

    await waitFor(() => expect(screen.getByTestId('feedback-toast')).toHaveTextContent('refreshed'));
    expect(screen.getByText('Mopping')).toBeInTheDocument();
  });

  it('shows the refresh error toast for a 409', async () => {
    const testOutbox = createOutbox(vi.fn(() => errorResponse(409, 'changed')));
    testOutbox.append({ type: 'edit', choreId: 1, baseVersion: 1, payload: createPayload() });
    const { getCount } = stubListFetch(okList);
    renderView(testOutbox);
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await act(() => testOutbox.flush());

    expect(await screen.findByTestId('feedback-toast')).toHaveTextContent('The list was refreshed.');
    expect(getCount()).toBe(2);
  });

  it('counts an edit answered 404 as dropped and refreshes', async () => {
    const testOutbox = createOutbox(vi.fn(() => errorResponse(404, 'gone')));
    testOutbox.append({ type: 'edit', choreId: 1, baseVersion: 1, payload: createPayload() });
    const { getCount } = stubListFetch(okList);
    renderView(testOutbox);
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await act(() => testOutbox.flush());

    expect(await screen.findByTestId('feedback-toast')).toHaveTextContent(
      "Some offline changes couldn't be synced. The list was refreshed.",
    );
    expect(getCount()).toBe(2);
  });

  it('shows only the error toast for a mixed pass of success plus 400', async () => {
    const outboxFetch = vi.fn((url: string) =>
      url === '/api/chores/1/complete'
        ? jsonResponse({ success: true, data: { ...mockChores[0], version: 2 } })
        : errorResponse(400, 'bad'),
    );
    const testOutbox = createOutbox(outboxFetch as unknown as typeof fetch);
    testOutbox.append({
      type: 'complete',
      choreId: 1,
      payload: { dateLastCompleted: '2026-07-01T00:00:00.000Z' },
    });
    testOutbox.append({ type: 'edit', choreId: 2, baseVersion: 1, payload: createPayload() });
    stubListFetch(okList);
    renderView(testOutbox);
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await act(() => testOutbox.flush());

    await waitFor(() => expect(screen.getByTestId('feedback-toast')).toHaveAttribute('data-tone', 'error'));
    expect(screen.getByTestId('feedback-toast')).toHaveTextContent('The list was refreshed.');
    expect(screen.getAllByTestId('feedback-toast')).toHaveLength(1);
  });

  it('shows one combined toast when a pass has a dropped 400 and a kept 500', async () => {
    const outboxFetch = vi.fn((url: string) =>
      url === '/api/chores/1' ? errorResponse(400, 'bad') : errorResponse(500, 'boom'),
    );
    const testOutbox = createOutbox(outboxFetch as unknown as typeof fetch);
    testOutbox.append({ type: 'edit', choreId: 1, baseVersion: 1, payload: createPayload() });
    testOutbox.append({ type: 'edit', choreId: 2, baseVersion: 1, payload: createPayload() });
    const { getCount } = stubListFetch(okList);
    renderView(testOutbox);
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await act(() => testOutbox.flush());

    await waitFor(() => expect(screen.getByTestId('feedback-toast')).toHaveAttribute('data-tone', 'error'));
    expect(screen.getByTestId('feedback-toast')).toHaveTextContent(
      "Some offline changes couldn't be synced and the list was refreshed. Others haven't synced yet and will retry.",
    );
    expect(screen.getAllByTestId('feedback-toast')).toHaveLength(1);
    expect(testOutbox.getEntries()).toHaveLength(1);
    expect(getCount()).toBe(2);
  });

  it('drops the refresh claim from the combined toast when the refetch falls back to the cache', async () => {
    await writeChoresCache([]);
    const outboxFetch = vi.fn((url: string) =>
      url === '/api/chores/1' ? errorResponse(400, 'bad') : errorResponse(500, 'boom'),
    );
    const testOutbox = createOutbox(outboxFetch as unknown as typeof fetch);
    testOutbox.append({ type: 'edit', choreId: 1, baseVersion: 1, payload: createPayload() });
    testOutbox.append({ type: 'edit', choreId: 2, baseVersion: 1, payload: createPayload() });
    stubListFetch((n) => (n === 1 ? okList() : errorResponse(500, 'down')));
    renderView(testOutbox);
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await act(() => testOutbox.flush());

    const toast = await screen.findByTestId('feedback-toast');
    expect(toast).toHaveTextContent(
      "Some offline changes couldn't be synced. Others haven't synced yet and will retry.",
    );
    expect(toast).not.toHaveTextContent('refreshed');
  });

  it('rolls back and shows the error toast on a 409 complete that has no conflict handler', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-07-01T12:00:00.000Z'));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    stubMutationFetch((url) =>
      url === '/api/chores/1/complete' ? errorResponse(409, 'conflict') : undefined,
    );
    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await user.click(barFor('Vacuum'));

    const toast = await screen.findByTestId('feedback-toast');
    expect(toast).toHaveAttribute('data-tone', 'error');
    expect(toast).toHaveTextContent("Couldn't mark the chore complete. Please try again.");
    expect(within(barFor('Vacuum')).getByText('30 days ago')).toBeInTheDocument();
  });

  it('does not remove a queued temp-id chore locally when its complete is answered 404', async () => {
    const testOutbox = createOutbox(vi.fn(() => new Promise<Response>(() => {})));
    testOutbox.append({ type: 'create', tempId: -5, payload: createPayload() });
    const user = userEvent.setup();
    stubMutationFetch((url) =>
      url === '/api/chores/-5/complete' ? errorResponse(404, 'Not found') : undefined,
    );
    renderView(testOutbox);
    await waitFor(() => expect(screen.getByText('Windows')).toBeInTheDocument());

    await user.click(barFor('Windows'));

    const toast = await screen.findByTestId('feedback-toast');
    expect(toast).toHaveAttribute('data-tone', 'error');
    expect(toast).not.toHaveTextContent('That chore no longer exists.');
    expect(screen.getByText('Windows')).toBeInTheDocument();
  });

  it('shows no toast for dropped-not-found or a network throw', async () => {
    const notFound = createOutbox(vi.fn(() => errorResponse(404, 'gone')));
    notFound.append({ type: 'delete', choreId: 1 });
    stubListFetch(okList);
    renderView(notFound);
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    await act(() => notFound.flush());
    expect(screen.queryByTestId('feedback-toast')).not.toBeInTheDocument();
    cleanup();
    localStorage.clear();

    const throwing = createOutbox(vi.fn(() => Promise.reject(new Error('offline'))));
    throwing.append({ type: 'delete', choreId: 1 });
    stubListFetch(okList);
    renderView(throwing);
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    await act(() => throwing.flush());
    expect(screen.queryByTestId('feedback-toast')).not.toBeInTheDocument();
  });

  it('shows one aggregate success toast for two successes', async () => {
    const outboxFetch = vi.fn((url: string) =>
      jsonResponse({ success: true, data: { ...mockChores[url.includes('/1/') ? 0 : 1], version: 2 } }),
    );
    const testOutbox = createOutbox(outboxFetch as unknown as typeof fetch);
    testOutbox.append({
      type: 'complete',
      choreId: 1,
      payload: { dateLastCompleted: '2026-07-01T00:00:00.000Z' },
    });
    testOutbox.append({
      type: 'complete',
      choreId: 2,
      payload: { dateLastCompleted: '2026-07-01T00:00:00.000Z' },
    });
    stubListFetch(okList);
    renderView(testOutbox);
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await act(() => testOutbox.flush());

    const toast = await screen.findByTestId('feedback-toast');
    expect(toast).toHaveAttribute('data-tone', 'success');
    expect(toast).toHaveTextContent('Offline changes synced');
    expect(screen.getAllByTestId('feedback-toast')).toHaveLength(1);
  });

  it('replaces the toast on a repeated failed flush and lets a later success replace a standing error', async () => {
    let status = 500;
    const outboxFetch = vi.fn(() =>
      status === 200
        ? jsonResponse({ success: true, data: { ...mockChores[0], version: 2 } })
        : errorResponse(status, 'later'),
    );
    const testOutbox = createOutbox(outboxFetch as unknown as typeof fetch);
    testOutbox.append({
      type: 'complete',
      choreId: 1,
      payload: { dateLastCompleted: '2026-07-01T00:00:00.000Z' },
    });
    stubListFetch(okList);
    renderView(testOutbox);
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await act(() => testOutbox.flush());
    const first = await screen.findByTestId('feedback-toast');
    await act(() => testOutbox.flush());
    expect(screen.getAllByTestId('feedback-toast')).toHaveLength(1);
    expect(screen.getByTestId('feedback-toast')).not.toBe(first);

    status = 200;
    await act(() => testOutbox.flush());
    await waitFor(() => expect(screen.getByTestId('feedback-toast')).toHaveAttribute('data-tone', 'success'));
    expect(screen.getAllByTestId('feedback-toast')).toHaveLength(1);
  });

  it('does not resurrect a rejected temp-id create on a later online event', async () => {
    const testOutbox = createOutbox(vi.fn(() => errorResponse(400, 'bad')));
    testOutbox.append({ type: 'create', tempId: -5, payload: createPayload() });
    const { getCount } = stubListFetch(okList);
    renderView(testOutbox);
    await waitFor(() => expect(screen.getByText('Windows')).toBeInTheDocument());
    await act(() => testOutbox.flush());
    await waitFor(() => expect(screen.queryByText('Windows')).not.toBeInTheDocument());
    const before = getCount();

    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(getCount()).toBeGreaterThan(before));
    // Let load() finish applying its list (GET start precedes the apply) before asserting absence.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.getByText('Vacuum')).toBeInTheDocument();
    expect(screen.queryByText('Windows')).not.toBeInTheDocument();
  });

  it('keeps a queued create visible after discarding a conflict and leaves isStale unchanged', async () => {
    const user = userEvent.setup();
    const testOutbox = createOutbox(vi.fn());
    testOutbox.append({ type: 'create', tempId: -5, payload: createPayload() });
    stubListFetch(okList, (url, method) =>
      url === '/api/chores/1' && method === 'PUT' ? errorResponse(409, 'changed') : undefined,
    );
    renderView(testOutbox);
    await waitFor(() => expect(screen.getByText('Windows')).toBeInTheDocument());

    await user.click(within(rowFor('Vacuum')).getByLabelText('Edit chore'));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    await user.click(await screen.findByRole('button', { name: 'Discard my changes' }));

    await waitFor(() =>
      expect(screen.queryByText('This chore was changed elsewhere.')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Windows')).toBeInTheDocument();
    expect(screen.queryByTestId('status-banner')).not.toBeInTheDocument();
  });

  it('closes the edit form and the conflict dialog when a refetch no longer contains the chore', async () => {
    const user = userEvent.setup();
    const testOutbox = createOutbox(vi.fn(() => errorResponse(400, 'bad')));
    stubListFetch(
      (n) => jsonResponse({ success: true, data: n === 1 ? mockChores : [mockChores[1]] }),
      (url, method) =>
        url === '/api/chores/1' && method === 'PUT' ? errorResponse(409, 'changed') : undefined,
    );
    renderView(testOutbox);
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    // Conflict dialog open for chore 1.
    await user.click(within(rowFor('Vacuum')).getByLabelText('Edit chore'));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(await screen.findByText('This chore was changed elsewhere.')).toBeInTheDocument();
    act(() => {
      testOutbox.append({ type: 'edit', choreId: 2, baseVersion: 1, payload: createPayload() });
    });
    await act(() => testOutbox.flush());

    await waitFor(() => expect(screen.queryByText('Vacuum')).not.toBeInTheDocument());
    expect(screen.queryByText('This chore was changed elsewhere.')).not.toBeInTheDocument();
  });

  it('closes the edit form when a refetch drops the edited chore, but leaves it open when still present', async () => {
    const user = userEvent.setup();
    const testOutbox = createOutbox(vi.fn(() => errorResponse(400, 'bad')));
    let listed = mockChores;
    stubListFetch((n) => (n === 1 ? okList() : jsonResponse({ success: true, data: listed })));
    renderView(testOutbox);
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    await user.click(within(rowFor('Vacuum')).getByLabelText('Edit chore'));
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();

    act(() => {
      testOutbox.append({ type: 'edit', choreId: 2, baseVersion: 1, payload: createPayload() });
    });
    await act(() => testOutbox.flush());
    await screen.findByTestId('feedback-toast');
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();

    listed = [mockChores[1]];
    act(() => {
      testOutbox.append({ type: 'edit', choreId: 2, baseVersion: 1, payload: createPayload() });
    });
    await act(() => testOutbox.flush());

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument(),
    );
  });
});

// ---- Stable row order (snapshot) ----
// Fixture at 2026-07-01T12:00Z (UTC), weighted overdue = (days since - frequency) / frequency:
// Alpha 1.8, Gamma 1.7, Beta 1.5 -> [Alpha, Gamma, Beta]. One household day later Beta (+0.5/day)
// reaches 2.0, Alpha 1.9, Gamma 1.8 -> [Beta, Alpha, Gamma], so a midnight or timezone-day shift flips it.
describe('ChoresView stable row order', () => {
  const NAMES = ['Alpha', 'Beta', 'Gamma', 'Mop'];
  const BEFORE = ['Alpha', 'Gamma', 'Beta'];
  const AFTER = ['Beta', 'Alpha', 'Gamma'];

  function orderChore(id: number, name: string, since: number, frequency: number, roomId = 1) {
    return {
      id,
      name,
      roomId,
      dateLastCompleted: new Date(Date.UTC(2026, 6, 1) - since * 86_400_000).toISOString(),
      duration: 10,
      frequency,
      version: 1,
    };
  }

  function baseList() {
    return [orderChore(1, 'Alpha', 28, 10), orderChore(2, 'Beta', 5, 2), orderChore(3, 'Gamma', 27, 10, 2)];
  }

  // Beta far more overdue: a fresh sort gives [Beta, Alpha, Gamma].
  function reorderedList() {
    return [orderChore(1, 'Alpha', 28, 10), orderChore(2, 'Beta', 20, 2), orderChore(3, 'Gamma', 27, 10, 2)];
  }

  function names() {
    return rowNames(NAMES);
  }

  function pinClock() {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-07-01T12:00:00.000Z'));
  }

  function viewElement(props: Partial<ComponentProps<typeof ChoresView>> = {}, key?: string) {
    return (
      <ChoresView
        key={key}
        householdTimezone="UTC"
        rooms={mockRooms}
        swipeStyle="ios"
        onSwipeStyleChange={vi.fn()}
        {...props}
      />
    );
  }

  const listJson = (data: unknown) => jsonResponse({ success: true, data });

  async function fireOnline() {
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
  }

  beforeEach(() => {
    pinClock();
  });

  it('re-sorts from the fresh list when it replaces a cache-rendered snapshot (stale to fresh)', async () => {
    await writeChoresCache(baseList());
    stubListFetch((n) => (n === 1 ? errorResponse(500, 'down') : listJson(reorderedList())));
    render(viewElement());
    await waitFor(() => expect(screen.getByTestId('status-banner')).toBeInTheDocument());
    expect(names()).toEqual(BEFORE);

    await fireOnline();

    await waitFor(() => expect(screen.queryByTestId('status-banner')).not.toBeInTheDocument());
    expect(names()).toEqual(AFTER);
  });

  it('keeps the order of a fresh snapshot through an offline blip whose reload would reorder', async () => {
    let list = baseList();
    const { getCount } = stubListFetch(() => listJson(list));
    render(viewElement());
    await waitFor(() => expect(names()).toEqual(BEFORE));

    list = [...reorderedList(), orderChore(4, 'Mop', 40, 10)];
    await act(async () => {
      window.dispatchEvent(new Event('offline'));
    });
    await fireOnline();

    await waitFor(() => expect(getCount()).toBe(2));
    // The reload was applied (Beta is now 20 days ago, Mop appeared) but nothing re-sorted.
    await waitFor(() => expect(screen.getByText('Mop')).toBeInTheDocument());
    expect(within(barFor('Beta')).getByText('20 days ago')).toBeInTheDocument();
    expect(names()).toEqual([...BEFORE, 'Mop']);
  });

  it('sorts the whole real list on reconnect after an offline start with an empty cache and a queued create', async () => {
    let outboxUp = false;
    const outboxFetch = vi.fn((_url: string, init?: RequestInit) =>
      outboxUp && init?.method === 'POST'
        ? listJson({ ...orderChore(99, 'Mop', 30, 3), version: 1 })
        : Promise.reject(new Error('offline')),
    );
    const testOutbox = createOutbox(outboxFetch as unknown as typeof fetch);
    testOutbox.append({
      type: 'create',
      tempId: -123,
      payload: {
        name: 'Mop',
        roomId: 1,
        dateLastCompleted: orderChore(0, '', 30, 3).dateLastCompleted,
        duration: 10,
        frequency: 3,
      },
    });
    stubListFetch((n) => (n === 1 ? Promise.reject(new Error('down')) : listJson(baseList())));
    render(viewElement({ outbox: testOutbox }));
    // Pending-only list: shown, but never snapshotted.
    await waitFor(() => expect(screen.getByText('Mop')).toBeInTheDocument());
    expect(screen.getAllByTestId('chore-row')).toHaveLength(1);

    await fireOnline();

    // Mop (very overdue) would sort first if the temp-id chore had leaked into the order.
    await waitFor(() => expect(names()).toEqual([...BEFORE, 'Mop']));

    // A flush replaces the temp-id row in place: it keeps its appended position.
    outboxUp = true;
    await act(() => testOutbox.flush());
    await waitFor(() => expect(testOutbox.getEntries()).toHaveLength(0));
    expect(names()).toEqual([...BEFORE, 'Mop']);
  });

  it('keeps a created chore appended through handleAddSubmit success', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    stubListFetch(
      () => listJson(baseList()),
      (url, method) =>
        url === '/api/chores' && method === 'POST' ? listJson(orderChore(7, 'Mop', 40, 3)) : undefined,
    );
    render(viewElement());
    await waitFor(() => expect(names()).toEqual(BEFORE));

    await user.click(screen.getByRole('button', { name: /add chore/i }));
    await user.type(screen.getByLabelText('Name'), 'Mop');
    await user.selectOptions(screen.getByLabelText('Room'), 'Living Room');
    await user.type(screen.getByLabelText('Duration (minutes)'), '10');
    await user.type(screen.getByLabelText('Frequency (days)'), '3');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByText('Mop')).toBeInTheDocument());
    expect(names()).toEqual([...BEFORE, 'Mop']);
  });

  it('re-snapshots fresh after a 403 clear in load() instead of inheriting the stale-flagged snapshot', async () => {
    await writeChoresCache(baseList());
    const onHouseholdRevoked = vi.fn();
    stubListFetch((n) =>
      n === 1 ? errorResponse(500, 'down') : n === 2 ? forbiddenResponse() : listJson(reorderedList()),
    );
    render(viewElement({ onHouseholdRevoked }));
    await waitFor(() => expect(names()).toEqual(BEFORE));

    await fireOnline();
    await waitFor(() => expect(onHouseholdRevoked).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Alpha')).not.toBeInTheDocument());

    await fireOnline();

    await waitFor(() => expect(names()).toEqual(AFTER));
  });

  it('re-snapshots fresh after a 403 clear in refetchChores instead of inheriting the stale-flagged snapshot', async () => {
    await writeChoresCache(baseList());
    const testOutbox = createOutbox(vi.fn(() => errorResponse(400, 'bad')));
    const onHouseholdRevoked = vi.fn();
    stubListFetch((n) =>
      n === 1 ? errorResponse(500, 'down') : n === 2 ? forbiddenResponse() : listJson(reorderedList()),
    );
    render(viewElement({ outbox: testOutbox, onHouseholdRevoked }));
    await waitFor(() => expect(names()).toEqual(BEFORE));

    act(() => {
      testOutbox.append({ type: 'edit', choreId: 1, baseVersion: 1, payload: createPayload() });
    });
    await act(() => testOutbox.flush());
    await waitFor(() => expect(onHouseholdRevoked).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Alpha')).not.toBeInTheDocument());

    act(() => {
      testOutbox.append({ type: 'edit', choreId: 1, baseVersion: 1, payload: createPayload() });
    });
    await act(() => testOutbox.flush());

    await waitFor(() => expect(names()).toEqual(AFTER));
  });

  it('re-sorts the whole list when the clock passes household midnight', async () => {
    stubListFetch(() => listJson(baseList()));
    render(viewElement());
    await waitFor(() => expect(names()).toEqual(BEFORE));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(12 * 3_600_000 + 1_000);
    });

    await waitFor(() => expect(names()).toEqual(AFTER));
  });

  it('re-sorts when the household timezone changes', async () => {
    stubListFetch(() => listJson(baseList()));
    const { rerender } = render(viewElement());
    await waitFor(() => expect(names()).toEqual(BEFORE));

    // Kiritimati (UTC+14) is already a day ahead of UTC.
    rerender(viewElement({ householdTimezone: 'Pacific/Kiritimati' }));

    await waitFor(() => expect(names()).toEqual(AFTER));
  });

  it('keeps an open edit modal on the same chore through a midnight re-sort', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const puts: string[] = [];
    stubListFetch(
      () => listJson(baseList()),
      (url, method) => {
        if (method !== 'PUT') return undefined;
        puts.push(url);
        return listJson({ ...orderChore(2, 'Beta Two', 5, 2), version: 2 });
      },
    );
    render(viewElement());
    await waitFor(() => expect(names()).toEqual(BEFORE));
    await user.click(within(rowFor('Beta')).getByLabelText('Edit chore'));
    expect(await screen.findByLabelText('Name')).toHaveValue('Beta');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(12 * 3_600_000 + 1_000);
    });

    await waitFor(() => expect(names()).toEqual(AFTER));
    const nameInput = screen.getByLabelText('Name');
    expect(nameInput).toHaveValue('Beta');
    await user.clear(nameInput);
    await user.type(nameInput, 'Beta Two');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(puts).toEqual(['/api/chores/2']));
    await waitFor(() => expect(screen.getByText('Beta Two')).toBeInTheDocument());
  });

  it('yields a freshly sorted list when the view is remounted for a household switch', async () => {
    let list = baseList();
    stubListFetch(() => listJson(list));
    const { rerender } = render(viewElement({}, 'household-1'));
    await waitFor(() => expect(names()).toEqual(BEFORE));

    list = reorderedList();
    rerender(viewElement({}, 'household-2'));

    await waitFor(() => expect(names()).toEqual(AFTER));
  });

  it('does not move rows when an edit would change status or move the chore to another room', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    stubListFetch(
      () => listJson(baseList()),
      (url, method) =>
        url === '/api/chores/2' && method === 'PUT'
          ? // Beta moves to Kitchen and becomes the most overdue chore (frequency 1).
            listJson({ ...orderChore(2, 'Beta', 5, 1, 2), version: 2 })
          : undefined,
    );
    const { rerender } = render(viewElement());
    await waitFor(() => expect(names()).toEqual(BEFORE));

    await user.click(within(rowFor('Beta')).getByLabelText('Edit chore'));
    await user.selectOptions(await screen.findByLabelText('Room'), 'Kitchen');
    const frequency = screen.getByLabelText('Frequency (days)');
    await user.clear(frequency);
    await user.type(frequency, '1');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument(),
    );
    expect(names()).toEqual(BEFORE);

    // In its new room's tab Beta sits at its global-order position (after Gamma), not first.
    rerender(viewElement({ selectedRoom: '2' }));
    await waitFor(() => expect(screen.queryByText('Alpha')).not.toBeInTheDocument());
    expect(names()).toEqual(['Gamma', 'Beta']);
  });

  it('leaves other rows in place on delete and restores a rolled-back delete at its snapshot position', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    let resolveDelete: (response: Response) => void = () => {};
    const pendingDelete = new Promise<Response>((resolve) => {
      resolveDelete = resolve;
    });
    stubListFetch(
      () => listJson(baseList()),
      (url, method) => (url === '/api/chores/3' && method === 'DELETE' ? pendingDelete : undefined),
    );
    render(viewElement());
    await waitFor(() => expect(names()).toEqual(BEFORE));

    await user.click(within(rowFor('Gamma')).getByLabelText('Delete chore'));

    await waitFor(() => expect(screen.queryByText('Gamma')).not.toBeInTheDocument());
    expect(names()).toEqual(['Alpha', 'Beta']);

    resolveDelete(await errorResponse(500, 'nope'));

    await waitFor(() => expect(screen.getByText('Gamma')).toBeInTheDocument());
    expect(names()).toEqual(BEFORE);
  });
});

type FetchCall = [string, RequestInit | undefined];

function callsTo(method: string, url: string) {
  return (vi.mocked(fetch).mock.calls as unknown as FetchCall[]).filter(
    ([u, init]) => (init?.method ?? 'GET') === method && u === url,
  );
}

function bodyOf(call: FetchCall) {
  return JSON.parse(call[1]?.body as string) as Record<string, unknown>;
}

function okRow(data: object) {
  return jsonResponse({ success: true, data });
}

const VACUUM_COMPLETED = {
  ...mockChores[0],
  urgency: 'high',
  dateLastCompleted: '2026-07-01T00:00:00.000Z',
  version: 2,
};
const DISHES_COMPLETED = { ...mockChores[1], dateLastCompleted: '2026-07-01T00:00:00.000Z', version: 2 };
const urgentList = () =>
  jsonResponse({ success: true, data: [{ ...mockChores[0], urgency: 'high' }, mockChores[1]] });
const undoButton = () => screen.queryByTestId('feedback-toast-undo');
const redoButton = () => screen.queryByTestId('feedback-toast-redo');
const toastText = () => screen.queryByTestId('feedback-toast')?.textContent ?? '';

// Fake clock at a fixed day so "N days ago" and the 8 s windows are deterministic.
function setupUndo() {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-07-01T12:00:00.000Z'));
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

function undoStub(extra: MutationHandler = () => undefined, list: () => Promise<Response> = urgentList) {
  return stubListFetch(list, (url, method) => {
    if (url === '/api/chores/1/complete') return okRow(VACUUM_COMPLETED);
    if (url === '/api/chores/2/complete') return okRow(DISHES_COMPLETED);
    return extra(url, method);
  });
}

async function completeVacuum(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
  await user.click(barFor('Vacuum'));
  return screen.findByTestId('feedback-toast-undo');
}

// Offline complete of Vacuum with an outbox whose own fetch is `outboxFetch`.
async function completeVacuumOffline(
  user: ReturnType<typeof userEvent.setup>,
  outboxFetch: ReturnType<typeof vi.fn> = vi.fn(),
) {
  const testOutbox = createOutbox(outboxFetch as unknown as typeof fetch);
  stubListFetch(urgentList, (url) =>
    url === '/api/chores/1/complete' ? Promise.reject(new Error('network unavailable')) : undefined,
  );
  renderView(testOutbox);
  await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
  await user.click(barFor('Vacuum'));
  await screen.findByTestId('feedback-toast-undo');
  return testOutbox;
}

describe('ChoresView undo of complete and edit', () => {
  it('undoes an online complete with a PUT of the pre-complete payload at the response version', async () => {
    const user = setupUndo();
    undoStub((url, method) =>
      url === '/api/chores/1' && method === 'PUT'
        ? okRow({ ...mockChores[0], urgency: 'high', version: 3 })
        : undefined,
    );
    renderView();

    await user.click(await completeVacuum(user));

    await waitFor(() => expect(toastText()).toContain('Undone'));
    const puts = callsTo('PUT', '/api/chores/1');
    expect(puts).toHaveLength(1);
    expect(bodyOf(puts[0])).toEqual({
      name: 'Vacuum',
      roomId: 1,
      dateLastCompleted: '2026-06-01T00:00:00.000Z',
      duration: 20,
      frequency: 7,
      urgency: 'high',
      version: 2,
    });
    expect(within(barFor('Vacuum')).getByText('30 days ago')).toBeInTheDocument();
    expect(undoButton()).not.toBeInTheDocument();
    expect(redoButton()).toBeInTheDocument();
    expect(screen.getByTestId('feedback-toast')).toHaveAttribute('data-tone', 'neutral');
  });

  it('undoes an edit with the pre-edit fields at the edit response version', async () => {
    const user = setupUndo();
    const edited = { ...mockChores[0], urgency: 'high', name: 'Hoover', version: 2 };
    let putNo = 0;
    undoStub((url, method) => {
      if (url !== '/api/chores/1' || method !== 'PUT') return undefined;
      putNo += 1;
      return okRow(putNo === 1 ? edited : { ...mockChores[0], urgency: 'high', version: 3 });
    });
    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    await user.click(within(rowFor('Vacuum')).getByLabelText('Edit chore'));
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Hoover');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    await user.click(await screen.findByTestId('feedback-toast-undo'));

    await waitFor(() => expect(toastText()).toContain('Undone'));
    const puts = callsTo('PUT', '/api/chores/1');
    expect(puts).toHaveLength(2);
    expect(Object.keys(bodyOf(puts[1])).sort()).toEqual(
      ['dateLastCompleted', 'duration', 'frequency', 'name', 'roomId', 'urgency', 'version'].sort(),
    );
    expect(bodyOf(puts[1])).toEqual({
      name: 'Vacuum',
      roomId: 1,
      dateLastCompleted: '2026-06-01T00:00:00.000Z',
      duration: 20,
      frequency: 7,
      urgency: 'high',
      version: 2,
    });
    expect(undoButton()).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
  });

  it('cancels an offline-queued complete without any request and shows Undone with a Redo action', async () => {
    const user = setupUndo();
    const testOutbox = await completeVacuumOffline(user);
    expect(testOutbox.getEntries()).toHaveLength(1);
    expect(within(barFor('Vacuum')).getByText(/^0\s+days\s+ago$/)).toBeInTheDocument();
    const before = vi.mocked(fetch).mock.calls.length;

    await user.click(screen.getByTestId('feedback-toast-undo'));

    expect(testOutbox.getEntries()).toHaveLength(0);
    expect(vi.mocked(fetch).mock.calls.length).toBe(before);
    expect(toastText()).toContain('Undone');
    expect(undoButton()).not.toBeInTheDocument();
    expect(redoButton()).toBeInTheDocument();
    expect(within(barFor('Vacuum')).getByText('30 days ago')).toBeInTheDocument();
  });

  it('cancels an offline-queued edit without any request', async () => {
    const user = setupUndo();
    const testOutbox = createOutbox(vi.fn());
    stubListFetch(urgentList, (url, method) =>
      url === '/api/chores/1' && method === 'PUT' ? Promise.reject(new Error('offline')) : undefined,
    );
    renderView(testOutbox);
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    await user.click(within(rowFor('Vacuum')).getByLabelText('Edit chore'));
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Hoover');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    await user.click(await screen.findByTestId('feedback-toast-undo'));

    expect(testOutbox.getEntries()).toHaveLength(0);
    expect(callsTo('PUT', '/api/chores/1')).toHaveLength(1);
    expect(toastText()).toContain('Undone');
    expect(screen.getByText('Vacuum')).toBeInTheDocument();
    expect(undoButton()).not.toBeInTheDocument();
  });

  it('moves focus to + Add Chore when the toast action is activated', async () => {
    const user = setupUndo();
    await completeVacuumOffline(user);

    await user.click(screen.getByTestId('feedback-toast-undo'));

    expect(screen.getByRole('button', { name: '+ Add Chore' })).toHaveFocus();
  });

  it('moves focus to + Add Chore when a flush clears Undo while its button is focused', async () => {
    const user = setupUndo();
    const testOutbox = await completeVacuumOffline(
      user,
      vi.fn(() => okRow(VACUUM_COMPLETED)),
    );
    act(() => screen.getByTestId('feedback-toast-undo').focus());
    expect(screen.getByTestId('feedback-toast-undo')).toHaveFocus();

    await act(() => testOutbox.flush());

    expect(undoButton()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Add Chore' })).toHaveFocus();
  });

  describe('flush results', () => {
    it('clears Undo when the flush syncs the armed entry', async () => {
      const user = setupUndo();
      const testOutbox = await completeVacuumOffline(
        user,
        vi.fn(() => okRow(VACUUM_COMPLETED)),
      );

      await act(() => testOutbox.flush());

      expect(toastText()).toContain('Offline changes synced');
      expect(undoButton()).not.toBeInTheDocument();
    });

    it('clears Undo as soon as the armed entry is dropped, before the async refetch toast', async () => {
      const user = setupUndo();
      const testOutbox = createOutbox(vi.fn(() => errorResponse(400, 'bad')));
      stubListFetch(
        (n) => (n === 1 ? urgentList() : new Promise<Response>(() => {})),
        (url) => (url === '/api/chores/1/complete' ? Promise.reject(new Error('offline')) : undefined),
      );
      renderView(testOutbox);
      await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
      await user.click(barFor('Vacuum'));
      await screen.findByTestId('feedback-toast-undo');

      await act(() => testOutbox.flush());

      expect(testOutbox.getEntries()).toHaveLength(0);
      expect(undoButton()).not.toBeInTheDocument();
      expect(toastText()).not.toContain('refreshed');
    });

    it('keeps Undo armed after a status-less network error that leaves the entry queued', async () => {
      const user = setupUndo();
      const testOutbox = await completeVacuumOffline(
        user,
        vi.fn(() => Promise.reject(new Error('offline'))),
      );

      await act(() => testOutbox.flush());

      expect(testOutbox.getEntries()).toHaveLength(1);
      expect(undoButton()).toBeInTheDocument();
    });

    it('drops Undo through the kept-failure toast after a 429 leaves the entry queued', async () => {
      const user = setupUndo();
      const testOutbox = await completeVacuumOffline(
        user,
        vi.fn(() => errorResponse(429, 'slow down')),
      );

      await act(() => testOutbox.flush());

      expect(testOutbox.getEntries()).toHaveLength(1);
      expect(toastText()).toContain("haven't synced yet");
      expect(undoButton()).not.toBeInTheDocument();
    });

    it('shows the still-syncing error and clears the record when the entry is mid-send', async () => {
      const user = setupUndo();
      const testOutbox = await completeVacuumOffline(
        user,
        vi.fn(() => new Promise<Response>(() => {})),
      );
      await act(async () => {
        void testOutbox.flush();
      });

      await user.click(screen.getByTestId('feedback-toast-undo'));

      expect(screen.getByTestId('feedback-toast')).toHaveAttribute('data-tone', 'error');
      expect(toastText()).toContain("Can't undo yet — still syncing");
      expect(undoButton()).not.toBeInTheDocument();
      expect(testOutbox.getEntries()).toHaveLength(1);
    });
  });

  describe('online undo failures', () => {
    it('shows the exact conflict copy, no dialog, and refetches on a 409', async () => {
      const user = setupUndo();
      const { getCount } = undoStub((url, method) =>
        url === '/api/chores/1' && method === 'PUT' ? errorResponse(409, 'changed') : undefined,
      );
      renderView();

      await user.click(await completeVacuum(user));

      await waitFor(() => expect(toastText()).toBe("Can't undo — someone changed it"));
      expect(screen.getByTestId('feedback-toast')).toHaveAttribute('data-tone', 'error');
      expect(screen.queryByText('This chore was changed elsewhere.')).not.toBeInTheDocument();
      await waitFor(() => expect(getCount()).toBe(2));
    });

    it('removes the chore on a 404', async () => {
      const user = setupUndo();
      undoStub((url, method) =>
        url === '/api/chores/1' && method === 'PUT' ? errorResponse(404, 'gone') : undefined,
      );
      renderView();

      await user.click(await completeVacuum(user));

      await waitFor(() => expect(toastText()).toBe('That chore no longer exists.'));
      expect(screen.queryByText('Vacuum')).not.toBeInTheDocument();
    });

    it('rolls back the optimistic revert and says it could not undo on another failure', async () => {
      const user = setupUndo();
      undoStub((url, method) =>
        url === '/api/chores/1' && method === 'PUT' ? errorResponse(500, 'boom') : undefined,
      );
      renderView();

      await user.click(await completeVacuum(user));

      await waitFor(() => expect(toastText()).toBe("Couldn't undo. Please try again."));
      expect(within(barFor('Vacuum')).getByText(/^0\s+days\s+ago$/)).toBeInTheDocument();
      expect(undoButton()).not.toBeInTheDocument();
    });

    it('rolls back, shows the sticky error and queues nothing when the Undo fetch throws', async () => {
      const user = setupUndo();
      const testOutbox = createOutbox(vi.fn());
      undoStub((url, method) =>
        url === '/api/chores/1' && method === 'PUT' ? Promise.reject(new Error('offline')) : undefined,
      );
      renderView(testOutbox);

      await user.click(await completeVacuum(user));

      await waitFor(() => expect(toastText()).toBe("Couldn't undo. Please try again."));
      expect(screen.getByTestId('feedback-toast')).toHaveAttribute('data-tone', 'error');
      expect(testOutbox.getEntries()).toHaveLength(0);
      expect(within(barFor('Vacuum')).getByText(/^0\s+days\s+ago$/)).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20000);
      });
      expect(screen.getByTestId('feedback-toast')).toBeInTheDocument();
    });
  });

  describe('in-flight completion', () => {
    function holdPut() {
      let resolve: (r: Response) => void = () => {};
      const pending = new Promise<Response>((r) => {
        resolve = r;
      });
      return { pending, resolve };
    }

    it.each([
      ['succeeds', () => okRow({ ...mockChores[0], name: 'Hoovered', version: 3 })],
      ['conflicts', () => errorResponse(409, 'changed')],
      ['is not found', () => errorResponse(404, 'gone')],
      ['fails', () => errorResponse(500, 'boom')],
    ] as const)(
      'applies data only and shows no toast when the Undo %s after a second action',
      async (outcome, respond) => {
        const user = setupUndo();
        const held = holdPut();
        const { getCount } = undoStub((url, method) =>
          url === '/api/chores/1' && method === 'PUT' ? held.pending : undefined,
        );
        renderView();
        await user.click(await completeVacuum(user));
        await user.click(barFor('Dishes'));
        await waitFor(() => expect(toastText()).toContain('Chore completed'));

        held.resolve(await respond());
        await act(async () => {
          await vi.advanceTimersByTimeAsync(50);
        });

        expect(toastText()).toContain('Chore completed');
        expect(screen.queryByText("Can't undo — someone changed it")).not.toBeInTheDocument();
        expect(screen.queryByText("Couldn't undo. Please try again.")).not.toBeInTheDocument();
        expect(screen.queryByText('That chore no longer exists.')).not.toBeInTheDocument();
        // The newer record (Dishes) is untouched by the stale completion and its refetch.
        expect(undoButton()).toBeInTheDocument();
        if (outcome === 'succeeds') expect(screen.getByText('Hoovered')).toBeInTheDocument();
        if (outcome === 'is not found') expect(screen.queryByText('Vacuum')).not.toBeInTheDocument();
        if (outcome === 'conflicts' || outcome === 'fails') expect(getCount()).toBe(2);
      },
    );

    it('keeps the toast through 8 s while the request is in flight, then the 30 s cap lands the response stale', async () => {
      const user = setupUndo();
      const held = holdPut();
      undoStub((url, method) => (url === '/api/chores/1' && method === 'PUT' ? held.pending : undefined));
      renderView();
      await user.click(await completeVacuum(user));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(8100);
      });
      expect(screen.getByTestId('feedback-toast')).toBeInTheDocument();
      expect(undoButton()).toHaveAttribute('aria-disabled', 'true');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(22000);
      });
      expect(screen.queryByTestId('feedback-toast')).not.toBeInTheDocument();

      held.resolve(await okRow({ ...VACUUM_COMPLETED, version: 3 }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
      expect(screen.queryByTestId('feedback-toast')).not.toBeInTheDocument();
    });

    it('shows the Undone toast when the request completes while still current', async () => {
      const user = setupUndo();
      const held = holdPut();
      undoStub((url, method) => (url === '/api/chores/1' && method === 'PUT' ? held.pending : undefined));
      renderView();
      await user.click(await completeVacuum(user));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(8100);
      });

      held.resolve(await okRow({ ...VACUUM_COMPLETED, version: 3 }));

      await waitFor(() => expect(toastText()).toContain('Undone'));
    });

    it('sends one request for two synchronous activations', async () => {
      const user = setupUndo();
      const held = holdPut();
      undoStub((url, method) => (url === '/api/chores/1' && method === 'PUT' ? held.pending : undefined));
      renderView();
      const button = await completeVacuum(user);

      act(() => {
        button.click();
        button.click();
      });

      expect(callsTo('PUT', '/api/chores/1')).toHaveLength(1);
    });

    it('does not clear a newer record when an older refetch applies after it', async () => {
      const user = setupUndo();
      let resolveList: (r: Response) => void = () => {};
      const slowList = new Promise<Response>((r) => {
        resolveList = r;
      });
      stubListFetch(
        (n) => (n === 2 ? slowList : urgentList()),
        (url) => {
          if (url === '/api/chores/1/complete') return okRow(VACUUM_COMPLETED);
          if (url === '/api/chores/2/complete') return okRow(DISHES_COMPLETED);
          return undefined;
        },
      );
      renderView();
      await completeVacuum(user);

      act(() => {
        window.dispatchEvent(new Event('online'));
      });
      await user.click(barFor('Dishes'));
      await waitFor(() => expect(toastText()).toContain('Chore completed'));
      resolveList(await urgentList());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });

      expect(undoButton()).toBeInTheDocument();
    });
  });

  describe('invalidation', () => {
    it('drops the button immediately when a second action starts', async () => {
      const user = setupUndo();
      stubListFetch(urgentList, (url) => {
        if (url === '/api/chores/1/complete') return okRow(VACUUM_COMPLETED);
        if (url === '/api/chores/2/complete') return new Promise<Response>(() => {});
        return undefined;
      });
      renderView();
      await completeVacuum(user);

      await user.click(barFor('Dishes'));

      expect(undoButton()).not.toBeInTheDocument();
    });

    it('drops the button when a refetch applies while the record is current', async () => {
      const user = setupUndo();
      const { getCount } = undoStub();
      renderView();
      await completeVacuum(user);

      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => expect(getCount()).toBe(2));
      await waitFor(() => expect(undoButton()).not.toBeInTheDocument());
    });

    it('removes the button and clears the record at the 8 s expiry', async () => {
      const user = setupUndo();
      undoStub();
      renderView();
      await completeVacuum(user);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(8100);
      });

      expect(screen.queryByTestId('feedback-toast')).not.toBeInTheDocument();
      expect(undoButton()).not.toBeInTheDocument();
    });

    it('never offers Undo for a temp-id chore', async () => {
      const user = setupUndo();
      const testOutbox = createOutbox(vi.fn());
      stubListFetch(urgentList, (url, method) =>
        method === 'POST' || url.startsWith('/api/chores/-')
          ? Promise.reject(new Error('offline'))
          : undefined,
      );
      renderView(testOutbox);
      await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: '+ Add Chore' }));
      await user.type(screen.getByLabelText('Name'), 'Windows');
      await user.selectOptions(screen.getByLabelText('Room'), '1');
      await user.type(screen.getByLabelText('Duration (minutes)'), '10');
      await user.type(screen.getByLabelText('Frequency (days)'), '7');
      await user.click(screen.getByRole('button', { name: 'Save' }));
      await screen.findByText('Windows');

      await user.click(barFor('Windows'));

      await waitFor(() => expect(toastText()).toContain('Saved offline'));
      expect(undoButton()).not.toBeInTheDocument();
    });

    it('arms nothing when a standing error toast suppresses the neutral offline toast', async () => {
      const user = setupUndo();
      const testOutbox = createOutbox(vi.fn());
      stubListFetch(urgentList, (url) => {
        if (url === '/api/chores/1/complete') return errorResponse(500, 'boom');
        if (url === '/api/chores/2/complete') return Promise.reject(new Error('offline'));
        return undefined;
      });
      renderView(testOutbox);
      await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
      await user.click(barFor('Vacuum'));
      await waitFor(() => expect(screen.getByTestId('feedback-toast')).toHaveAttribute('data-tone', 'error'));

      await user.click(barFor('Dishes'));

      await waitFor(() => expect(testOutbox.getEntries()).toHaveLength(1));
      expect(screen.getByTestId('feedback-toast')).toHaveAttribute('data-tone', 'error');
      expect(undoButton()).not.toBeInTheDocument();
    });

    it('drops the action on a 403 revocation refetch while the record is current', async () => {
      const user = setupUndo();
      stubListFetch(
        (n) => (n === 1 ? urgentList() : forbiddenResponse()),
        (url) => (url === '/api/chores/1/complete' ? okRow(VACUUM_COMPLETED) : undefined),
      );
      renderView();
      await completeVacuum(user);

      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => expect(undoButton()).not.toBeInTheDocument());
    });
  });

  describe('modalOpen wiring', () => {
    it.each([
      [
        'edit',
        async (user: ReturnType<typeof userEvent.setup>) =>
          user.click(within(rowFor('Dishes')).getByLabelText('Edit chore')),
      ],
      [
        'add',
        async (user: ReturnType<typeof userEvent.setup>) =>
          user.click(screen.getByRole('button', { name: '+ Add Chore' })),
      ],
      [
        'settings',
        async (user: ReturnType<typeof userEvent.setup>) =>
          user.click(screen.getByRole('button', { name: 'Settings' })),
      ],
    ] as const)('holds an action toast while the %s modal is open', async (_name, open) => {
      const user = setupUndo();
      undoStub();
      renderView();
      await completeVacuum(user);

      await open(user);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(8100);
      });

      expect(screen.getByTestId('feedback-toast')).toBeInTheDocument();
      expect(undoButton()).toBeDisabled();
      expect(screen.getByTestId('feedback-toast-dismiss')).toBeDisabled();
    });

    it('lets the held toast expire after a full interval once the modal closes', async () => {
      const user = setupUndo();
      undoStub();
      renderView();
      await completeVacuum(user);
      await user.click(within(rowFor('Dishes')).getByLabelText('Edit chore'));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(8100);
      });
      expect(screen.getByTestId('feedback-toast')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(7500);
      });
      expect(screen.getByTestId('feedback-toast')).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(screen.queryByTestId('feedback-toast')).not.toBeInTheDocument();
    });
  });

  describe('other paths', () => {
    it('keeps the record armed (entry still queued) after a 200 with an unparsable body', async () => {
      const user = setupUndo();
      const testOutbox = await completeVacuumOffline(
        user,
        vi.fn(() => Promise.resolve(new Response('not json', { status: 200 }))),
      );

      await act(() => testOutbox.flush());

      expect(testOutbox.getEntries()).toHaveLength(1);
    });

    it('never arms Undo for a delete answered with a 404', async () => {
      const user = setupUndo();
      undoStub((url, method) =>
        url === '/api/chores/1' && method === 'DELETE' ? errorResponse(404, 'gone') : undefined,
      );
      renderView();
      await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

      await user.click(within(rowFor('Vacuum')).getByLabelText('Delete chore'));

      await waitFor(() => expect(toastText()).toContain('Chore deleted'));
      expect(undoButton()).not.toBeInTheDocument();
    });

    it('drops the first Undo as soon as a second edit starts', async () => {
      const user = setupUndo();
      let putNo = 0;
      undoStub((url, method) => {
        if (url !== '/api/chores/1' || method !== 'PUT') return undefined;
        putNo += 1;
        return putNo === 1
          ? okRow({ ...mockChores[0], name: 'Hoover', version: 2 })
          : new Promise<Response>(() => {});
      });
      renderView();
      await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
      await user.click(within(rowFor('Vacuum')).getByLabelText('Edit chore'));
      await user.clear(screen.getByLabelText('Name'));
      await user.type(screen.getByLabelText('Name'), 'Hoover');
      await user.click(screen.getByRole('button', { name: 'Save Changes' }));
      await screen.findByTestId('feedback-toast-undo');

      await user.click(within(rowFor('Hoover')).getByLabelText('Edit chore'));
      await user.click(screen.getByRole('button', { name: 'Save Changes' }));

      expect(undoButton()).not.toBeInTheDocument();
    });

    it('clears the record when a refetch falls back to the cache (non-ok list)', async () => {
      const user = setupUndo();
      stubListFetch(
        (n) => (n === 1 ? urgentList() : errorResponse(500, 'down')),
        (url) => (url === '/api/chores/1/complete' ? okRow(VACUUM_COMPLETED) : undefined),
      );
      renderView();
      await completeVacuum(user);

      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => expect(undoButton()).not.toBeInTheDocument());
    });
  });
});

function vacuumBeforeDishes() {
  const vacuum = screen.getByText('Vacuum');
  const dishes = screen.getByText('Dishes');
  return Boolean(vacuum.compareDocumentPosition(dishes) & Node.DOCUMENT_POSITION_FOLLOWING);
}

async function deleteChore(user: ReturnType<typeof userEvent.setup>, name: string) {
  await waitFor(() => expect(screen.getByText(name)).toBeInTheDocument());
  await user.click(within(rowFor(name)).getByLabelText('Delete chore'));
  return screen.findByTestId('feedback-toast-undo');
}

const deleteVacuum = (user: ReturnType<typeof userEvent.setup>) => deleteChore(user, 'Vacuum');

describe('ChoresView undo of delete', () => {
  it('restores the row at its original position via PATCH restore, ending at the response version', async () => {
    const user = setupUndo();
    undoStub((url, method) => {
      if (url === '/api/chores/2' && method === 'DELETE') return jsonResponse({ success: true, data: null });
      if (url === '/api/chores/2/restore' && method === 'PATCH') {
        return okRow({ ...mockChores[1], version: 7 });
      }
      if (url === '/api/chores/2' && method === 'PUT') return okRow({ ...mockChores[1], version: 8 });
      return undefined;
    });
    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    // Dishes is not last, so a restore that appended at the end would flip this.
    expect(vacuumBeforeDishes()).toBe(false);

    await user.click(await deleteChore(user, 'Dishes'));

    await waitFor(() => expect(toastText()).toContain('Undone'));
    expect(callsTo('PATCH', '/api/chores/2/restore')).toHaveLength(1);
    expect(screen.getByText('Dishes')).toBeInTheDocument();
    expect(vacuumBeforeDishes()).toBe(false);
    expect(undoButton()).not.toBeInTheDocument();
    expect(redoButton()).toBeInTheDocument();
    expect(screen.getByTestId('feedback-toast')).toHaveAttribute('data-tone', 'neutral');

    // The row ends at the restore response's version, not the placeholder: a later edit sends it.
    await user.click(within(rowFor('Dishes')).getByLabelText('Edit chore'));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(callsTo('PUT', '/api/chores/2')).toHaveLength(1));
    expect(bodyOf(callsTo('PUT', '/api/chores/2')[0]).version).toBe(7);
  });

  it('cancels an offline-queued delete without any request and shows Undone with a Redo action', async () => {
    const user = setupUndo();
    const testOutbox = createOutbox(vi.fn());
    stubListFetch(urgentList, (url, method) =>
      url === '/api/chores/2' && method === 'DELETE' ? Promise.reject(new Error('offline')) : undefined,
    );
    renderView(testOutbox);
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    expect(vacuumBeforeDishes()).toBe(false);
    await deleteChore(user, 'Dishes');
    expect(testOutbox.getEntries()).toHaveLength(1);
    expect(screen.queryByText('Dishes')).not.toBeInTheDocument();
    const before = vi.mocked(fetch).mock.calls.length;

    await user.click(screen.getByTestId('feedback-toast-undo'));

    expect(testOutbox.getEntries()).toHaveLength(0);
    expect(vi.mocked(fetch).mock.calls.length).toBe(before);
    expect(toastText()).toContain('Undone');
    expect(undoButton()).not.toBeInTheDocument();
    expect(screen.getByText('Dishes')).toBeInTheDocument();
    expect(vacuumBeforeDishes()).toBe(false);
  });

  it('says it is still syncing when the queued delete is already mid-send', async () => {
    const user = setupUndo();
    const testOutbox = createOutbox(vi.fn());
    stubListFetch(urgentList, (url, method) =>
      url === '/api/chores/1' && method === 'DELETE' ? Promise.reject(new Error('offline')) : undefined,
    );
    renderView(testOutbox);
    await deleteVacuum(user);
    const entryId = testOutbox.getEntries()[0].id;
    const removeSpy = vi.spyOn(testOutbox, 'remove').mockReturnValue(false);

    await user.click(screen.getByTestId('feedback-toast-undo'));

    expect(removeSpy).toHaveBeenCalledWith(entryId);
    expect(screen.getByTestId('feedback-toast')).toHaveAttribute('data-tone', 'error');
    expect(toastText()).toContain("Can't undo yet — still syncing");
    expect(screen.queryByText('Vacuum')).not.toBeInTheDocument();
  });

  it.each([
    ['syncs', () => jsonResponse({ success: true, data: null })],
    ['is dropped as not-found for', () => errorResponse(404, 'gone')],
  ] as const)('clears the Undo button when the flush %s the armed queued delete', async (_label, respond) => {
    const user = setupUndo();
    const testOutbox = createOutbox(vi.fn(respond));
    stubListFetch(urgentList, (url, method) =>
      url === '/api/chores/1' && method === 'DELETE' ? Promise.reject(new Error('offline')) : undefined,
    );
    renderView(testOutbox);
    await deleteVacuum(user);

    await act(() => testOutbox.flush());

    expect(testOutbox.getEntries()).toHaveLength(0);
    expect(undoButton()).not.toBeInTheDocument();
  });

  it('keeps the original version on a cancelled offline delete so a later edit does not conflict', async () => {
    const user = setupUndo();
    const testOutbox = createOutbox(vi.fn());
    stubListFetch(urgentList, (url, method) => {
      if (url === '/api/chores/1' && method === 'DELETE') return Promise.reject(new Error('offline'));
      if (url === '/api/chores/1' && method === 'PUT') return okRow({ ...mockChores[0], version: 9 });
      return undefined;
    });
    renderView(testOutbox);
    await deleteVacuum(user);
    await user.click(screen.getByTestId('feedback-toast-undo'));

    await user.click(within(rowFor('Vacuum')).getByLabelText('Edit chore'));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(callsTo('PUT', '/api/chores/1')).toHaveLength(1));
    expect(bodyOf(callsTo('PUT', '/api/chores/1')[0]).version).toBe(mockChores[0].version);
  });

  it('shows the exact copy and removes the row when the restore is answered with 404', async () => {
    const user = setupUndo();
    undoStub((url, method) => {
      if (url === '/api/chores/1' && method === 'DELETE') return jsonResponse({ success: true, data: null });
      if (url === '/api/chores/1/restore') return errorResponse(404, 'gone');
      return undefined;
    });
    renderView();

    await user.click(await deleteVacuum(user));

    await waitFor(() => expect(toastText()).toBe("Couldn't restore — that chore no longer exists"));
    expect(screen.getByTestId('feedback-toast')).toHaveAttribute('data-tone', 'error');
    expect(screen.queryByText('Vacuum')).not.toBeInTheDocument();
  });

  it('rolls back, shows the sticky error and queues nothing when the restore fetch throws', async () => {
    const user = setupUndo();
    const testOutbox = createOutbox(vi.fn());
    stubListFetch(urgentList, (url, method) => {
      if (url === '/api/chores/1' && method === 'DELETE') return jsonResponse({ success: true, data: null });
      if (url === '/api/chores/1/restore') return Promise.reject(new Error('offline'));
      return undefined;
    });
    renderView(testOutbox);

    await user.click(await deleteVacuum(user));

    await waitFor(() => expect(toastText()).toBe("Couldn't undo. Please try again."));
    expect(screen.getByTestId('feedback-toast')).toHaveAttribute('data-tone', 'error');
    expect(screen.queryByText('Vacuum')).not.toBeInTheDocument();
    expect(testOutbox.getEntries()).toHaveLength(0);
  });
});

type RedoUser = ReturnType<typeof userEvent.setup>;

async function editVacuumToHoover(user: RedoUser) {
  await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
  await user.click(within(rowFor('Vacuum')).getByLabelText('Edit chore'));
  await user.clear(screen.getByLabelText('Name'));
  await user.type(screen.getByLabelText('Name'), 'Hoover');
  await user.click(screen.getByRole('button', { name: 'Save Changes' }));
  return screen.findByTestId('feedback-toast-undo');
}

const HOOVER = { ...mockChores[0], urgency: 'high', name: 'Hoover' };
const putVersions = (id: number) => callsTo('PUT', `/api/chores/${id}`).map((c) => bodyOf(c).version);

describe('ChoresView redo of complete, edit and delete', () => {
  it('round-trips a complete: undo PUT, redo PUT of the stored row, undo PUT again, on the version chain', async () => {
    const user = setupUndo();
    let putNo = 0;
    undoStub((url, method) => {
      if (url !== '/api/chores/1' || method !== 'PUT') return undefined;
      putNo += 1;
      return okRow({
        ...(putNo === 2 ? VACUUM_COMPLETED : mockChores[0]),
        urgency: 'high',
        version: 2 + putNo,
      });
    });
    renderView();

    await user.click(await completeVacuum(user));
    await waitFor(() => expect(toastText()).toContain('Undone'));
    expect(undoButton()).not.toBeInTheDocument();
    await user.click(await screen.findByTestId('feedback-toast-redo'));
    await waitFor(() => expect(toastText()).toContain('Redone'));
    expect(screen.getByTestId('feedback-toast')).toHaveAttribute('data-tone', 'neutral');
    expect(redoButton()).not.toBeInTheDocument();
    expect(within(barFor('Vacuum')).getByText(/^0\s+days\s+ago$/)).toBeInTheDocument();
    await user.click(await screen.findByTestId('feedback-toast-undo'));
    await waitFor(() => expect(toastText()).toContain('Undone'));

    expect(putVersions(1)).toEqual([2, 3, 4]);
    const puts = callsTo('PUT', '/api/chores/1');
    // Redo re-applies the server row (stored 07-01T00:00), not the tap time.
    expect(bodyOf(puts[1]).dateLastCompleted).toBe('2026-07-01T00:00:00.000Z');
    expect(bodyOf(puts[2]).dateLastCompleted).toBe('2026-06-01T00:00:00.000Z');
    expect(redoButton()).toBeInTheDocument();
  });

  it('round-trips an edit: undo, redo and undo again each send the next version', async () => {
    const user = setupUndo();
    let putNo = 0;
    undoStub((url, method) => {
      if (url !== '/api/chores/1' || method !== 'PUT') return undefined;
      putNo += 1;
      // PUT 1 = the edit, 2 = undo, 3 = redo, 4 = undo again.
      return okRow({
        ...(putNo === 1 || putNo === 3 ? HOOVER : { ...mockChores[0], urgency: 'high' }),
        version: 1 + putNo,
      });
    });
    renderView();

    await user.click(await editVacuumToHoover(user));
    await user.click(await screen.findByTestId('feedback-toast-redo'));
    await waitFor(() => expect(screen.getByText('Hoover')).toBeInTheDocument());
    expect(toastText()).toContain('Redone');
    await user.click(await screen.findByTestId('feedback-toast-undo'));
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

    expect(putVersions(1)).toEqual([mockChores[0].version, 2, 3, 4]);
    const puts = callsTo('PUT', '/api/chores/1');
    expect(bodyOf(puts[2]).name).toBe('Hoover');
    expect(bodyOf(puts[3]).name).toBe('Vacuum');
  });

  it('round-trips a delete: restore, DELETE again with "Redone", restore again', async () => {
    const user = setupUndo();
    undoStub((url, method) => {
      if (url === '/api/chores/2' && method === 'DELETE') return jsonResponse({ success: true, data: null });
      if (url === '/api/chores/2/restore' && method === 'PATCH')
        return okRow({ ...mockChores[1], version: 7 });
      return undefined;
    });
    renderView();

    await user.click(await deleteChore(user, 'Dishes'));
    await waitFor(() => expect(toastText()).toContain('Undone'));
    await user.click(await screen.findByTestId('feedback-toast-redo'));
    await waitFor(() => expect(toastText()).toMatch(/^Redone/));
    // An online-undone delete (cancelled false) takes the DELETE request, never the handler ("Chore deleted").
    expect(callsTo('DELETE', '/api/chores/2')).toHaveLength(2);
    expect(screen.queryByText('Dishes')).not.toBeInTheDocument();
    await user.click(await screen.findByTestId('feedback-toast-undo'));
    await waitFor(() => expect(screen.getByText('Dishes')).toBeInTheDocument());

    expect(callsTo('PATCH', '/api/chores/2/restore')).toHaveLength(2);
    expect(toastText()).toContain('Undone');
  });

  it('shows the sticky "Can\'t redo" error on a 409 and refetches', async () => {
    const user = setupUndo();
    let putNo = 0;
    const { getCount } = undoStub((url, method) => {
      if (url !== '/api/chores/1' || method !== 'PUT') return undefined;
      putNo += 1;
      return putNo === 1
        ? okRow({ ...mockChores[0], urgency: 'high', version: 3 })
        : errorResponse(409, 'conflict');
    });
    renderView();

    await user.click(await completeVacuum(user));
    await user.click(await screen.findByTestId('feedback-toast-redo'));

    await waitFor(() => expect(toastText()).toBe("Can't redo — someone changed it"));
    expect(screen.getByTestId('feedback-toast')).toHaveAttribute('data-tone', 'error');
    expect(redoButton()).not.toBeInTheDocument();
    await waitFor(() => expect(getCount()).toBeGreaterThan(1));
  });

  it('rolls back and shows the sticky error when the redo fetch throws', async () => {
    const user = setupUndo();
    let putNo = 0;
    undoStub((url, method) => {
      if (url !== '/api/chores/1' || method !== 'PUT') return undefined;
      putNo += 1;
      return putNo === 1
        ? okRow({ ...mockChores[0], urgency: 'high', version: 3 })
        : Promise.reject(new Error('offline'));
    });
    renderView();

    await user.click(await completeVacuum(user));
    await user.click(await screen.findByTestId('feedback-toast-redo'));

    await waitFor(() => expect(toastText()).toBe("Couldn't redo. Please try again."));
    expect(screen.getByTestId('feedback-toast')).toHaveAttribute('data-tone', 'error');
    expect(within(barFor('Vacuum')).getByText('30 days ago')).toBeInTheDocument();
  });

  it.each(['complete', 'edit'] as const)(
    'removes the chore when a %s redo is answered with 404',
    async (kind) => {
      const user = setupUndo();
      let putNo = 0;
      undoStub((url, method) => {
        if (url !== '/api/chores/1' || method !== 'PUT') return undefined;
        putNo += 1;
        if (kind === 'edit' && putNo === 1) return okRow({ ...HOOVER, version: 2 });
        return putNo === (kind === 'edit' ? 2 : 1)
          ? okRow({ ...mockChores[0], urgency: 'high', version: 3 })
          : errorResponse(404, 'gone');
      });
      renderView();

      await user.click(kind === 'edit' ? await editVacuumToHoover(user) : await completeVacuum(user));
      await user.click(await screen.findByTestId('feedback-toast-redo'));

      await waitFor(() => expect(toastText()).toBe('That chore no longer exists.'));
      expect(screen.getByTestId('feedback-toast')).toHaveAttribute('data-tone', 'error');
      expect(screen.queryByText(/Vacuum|Hoover/)).not.toBeInTheDocument();
    },
  );

  it('treats a delete redo answered with 404 as a neutral "Redone" with no Undo', async () => {
    const user = setupUndo();
    let deleteNo = 0;
    undoStub((url, method) => {
      if (url === '/api/chores/2' && method === 'DELETE') {
        deleteNo += 1;
        return deleteNo === 1 ? jsonResponse({ success: true, data: null }) : errorResponse(404, 'gone');
      }
      if (url === '/api/chores/2/restore') return okRow({ ...mockChores[1], version: 7 });
      return undefined;
    });
    renderView();

    await user.click(await deleteChore(user, 'Dishes'));
    await user.click(await screen.findByTestId('feedback-toast-redo'));

    await waitFor(() => expect(toastText()).toBe('Redone'));
    expect(screen.getByTestId('feedback-toast')).toHaveAttribute('data-tone', 'neutral');
    expect(undoButton()).not.toBeInTheDocument();
    expect(redoButton()).not.toBeInTheDocument();
    expect(screen.queryByText('Dishes')).not.toBeInTheDocument();
  });

  it('rolls back a delete redo whose fetch throws and shows the sticky error', async () => {
    const user = setupUndo();
    let deleteNo = 0;
    undoStub((url, method) => {
      if (url === '/api/chores/2' && method === 'DELETE') {
        deleteNo += 1;
        return deleteNo === 1
          ? jsonResponse({ success: true, data: null })
          : Promise.reject(new Error('offline'));
      }
      if (url === '/api/chores/2/restore') return okRow({ ...mockChores[1], version: 7 });
      return undefined;
    });
    renderView();

    await user.click(await deleteChore(user, 'Dishes'));
    await user.click(await screen.findByTestId('feedback-toast-redo'));

    await waitFor(() => expect(toastText()).toBe("Couldn't redo. Please try again."));
    expect(screen.getByText('Dishes')).toBeInTheDocument();
  });

  it('sends one request for two synchronous Redo activations', async () => {
    const user = setupUndo();
    let putNo = 0;
    undoStub((url, method) => {
      if (url !== '/api/chores/1' || method !== 'PUT') return undefined;
      putNo += 1;
      return okRow({ ...mockChores[0], urgency: 'high', version: 2 + putNo });
    });
    renderView();

    await user.click(await completeVacuum(user));
    const redo = await screen.findByTestId('feedback-toast-redo');
    fireEvent.click(redo);
    fireEvent.click(redo);

    await waitFor(() => expect(toastText()).toContain('Redone'));
    expect(callsTo('PUT', '/api/chores/1')).toHaveLength(2);
  });

  it('applies data effects only when a redo lands after another mutation, leaving no Redo button', async () => {
    const user = setupUndo();
    let putNo = 0;
    let resolveRedo: (r: Response) => void = () => {};
    undoStub((url, method) => {
      if (url === '/api/chores/2' && method === 'DELETE') return errorResponse(500, 'boom');
      if (url !== '/api/chores/1' || method !== 'PUT') return undefined;
      putNo += 1;
      if (putNo === 1) return okRow({ ...mockChores[0], urgency: 'high', version: 3 });
      return new Promise<Response>((resolve) => {
        resolveRedo = resolve;
      });
    });
    renderView();

    await user.click(await completeVacuum(user));
    await user.click(await screen.findByTestId('feedback-toast-redo'));
    await user.click(within(rowFor('Dishes')).getByLabelText('Delete chore'));
    await waitFor(() => expect(screen.getByTestId('feedback-toast')).toHaveAttribute('data-tone', 'error'));
    const errorText = toastText();
    resolveRedo(await okRow({ ...VACUUM_COMPLETED, version: 4 }));

    await waitFor(() => expect(within(barFor('Vacuum')).getByText(/^0\s+days\s+ago$/)).toBeInTheDocument());
    expect(toastText()).toBe(errorText);
    expect(redoButton()).not.toBeInTheDocument();
    expect(undoButton()).not.toBeInTheDocument();
  });

  it('keeps the newer action toast when a redo lands after a successful mutation', async () => {
    const user = setupUndo();
    let putNo = 0;
    let resolveRedo: (r: Response) => void = () => {};
    undoStub((url, method) => {
      if (url !== '/api/chores/1' || method !== 'PUT') return undefined;
      putNo += 1;
      if (putNo === 1) return okRow({ ...mockChores[0], urgency: 'high', version: 3 });
      return new Promise<Response>((resolve) => {
        resolveRedo = resolve;
      });
    });
    renderView();

    await user.click(await completeVacuum(user));
    await user.click(await screen.findByTestId('feedback-toast-redo'));
    await user.click(barFor('Dishes'));
    await waitFor(() => expect(toastText()).toContain('Chore completed'));
    resolveRedo(await okRow({ ...VACUUM_COMPLETED, version: 4 }));

    await waitFor(() => expect(within(barFor('Vacuum')).getByText(/^0\s+days\s+ago$/)).toBeInTheDocument());
    expect(toastText()).toContain('Chore completed');
    expect(toastText()).not.toContain('Redone');
    expect(redoButton()).not.toBeInTheDocument();
    expect(undoButton()).toBeInTheDocument();
  });

  it('drops the toast and record once the 8 s window ends', async () => {
    const user = setupUndo();
    undoStub((url, method) =>
      url === '/api/chores/1' && method === 'PUT'
        ? okRow({ ...mockChores[0], urgency: 'high', version: 3 })
        : undefined,
    );
    renderView();

    await user.click(await completeVacuum(user));
    await screen.findByTestId('feedback-toast-redo');
    act(() => {
      vi.advanceTimersByTime(9000);
    });

    await waitFor(() => expect(screen.queryByTestId('feedback-toast')).not.toBeInTheDocument());
    expect(redoButton()).not.toBeInTheDocument();
  });

  describe('redo after an offline cancel', () => {
    type Mode = 'offline' | 'online' | 'conflict';

    // Performs `kind` while offline, then Undoes it (cancelling the queued entry); returns controls.
    async function cancelOffline(kind: 'complete' | 'edit' | 'delete', user: RedoUser) {
      let mode: Mode = 'offline';
      const testOutbox = createOutbox(vi.fn());
      stubListFetch(urgentList, (url, method) => {
        const isAction =
          (kind === 'complete' && url === '/api/chores/1/complete') ||
          (kind === 'edit' && url === '/api/chores/1' && method === 'PUT') ||
          (kind === 'delete' && url === '/api/chores/1' && method === 'DELETE');
        if (!isAction) return undefined;
        if (mode === 'offline') return Promise.reject(new Error('offline'));
        if (mode === 'conflict') return errorResponse(409, 'conflict');
        if (kind === 'delete') return jsonResponse({ success: true, data: null });
        return okRow(kind === 'edit' ? { ...HOOVER, version: 2 } : VACUUM_COMPLETED);
      });
      renderView(testOutbox);
      const first =
        kind === 'edit'
          ? await editVacuumToHoover(user)
          : kind === 'delete'
            ? await deleteVacuum(user)
            : await completeVacuum(user);
      const queued = testOutbox.getEntries()[0] as unknown as { payload?: { dateLastCompleted: string } };
      if (kind !== 'delete') expect(queued.payload?.dateLastCompleted).toBeDefined();
      await user.click(first);
      expect(testOutbox.getEntries()).toHaveLength(0);
      expect(toastText()).toContain('Undone');
      return { testOutbox, queued, setMode: (m: Mode) => (mode = m) };
    }

    it.each(['complete', 'edit', 'delete'] as const)('re-queues a %s while still offline', async (kind) => {
      const user = setupUndo();
      const { testOutbox, queued } = await cancelOffline(kind, user);
      // Later tap time must not leak into a re-run of complete.
      vi.setSystemTime(new Date('2026-07-01T15:00:00.000Z'));

      await user.click(await screen.findByTestId('feedback-toast-redo'));

      await waitFor(() => expect(testOutbox.getEntries()).toHaveLength(1));
      const entry = testOutbox.getEntries()[0] as unknown as {
        type: string;
        payload?: { dateLastCompleted: string };
      };
      expect(entry.type).toBe(kind);
      if (kind !== 'delete') expect(entry.payload?.dateLastCompleted).toBe(queued.payload?.dateLastCompleted);
      expect(undoButton()).toBeInTheDocument();
      expect(redoButton()).not.toBeInTheDocument();
    });

    it.each([
      ['complete', 'Chore completed'],
      ['edit', 'Changes saved'],
      ['delete', 'Chore deleted'],
    ] as const)(
      'a %s re-run online shows the handler copy with a fresh Undo, not "Redone"',
      async (kind, copy) => {
        const user = setupUndo();
        const { setMode } = await cancelOffline(kind, user);
        setMode('online');

        await user.click(await screen.findByTestId('feedback-toast-redo'));

        await waitFor(() => expect(toastText()).toMatch(new RegExp(`^${copy}`)));
        expect(undoButton()).toBeInTheDocument();
      },
    );

    it('opens the existing edit conflict dialog on a 409 instead of the sticky redo error', async () => {
      const user = setupUndo();
      const { setMode } = await cancelOffline('edit', user);
      setMode('conflict');

      await user.click(await screen.findByTestId('feedback-toast-redo'));

      await waitFor(() => expect(screen.getByText('This chore was changed elsewhere.')).toBeInTheDocument());
      expect(toastText()).not.toContain("Can't redo");
    });
  });
});
