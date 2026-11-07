import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within, act } from '@testing-library/react';
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

  it('re-sorts on an optimistic complete and restores the original order when it rolls back', async () => {
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

    // Optimistic completion turns Dishes green, so it drops below the red Vacuum.
    await waitFor(() => expect(rowNames(['Vacuum', 'Dishes'])).toEqual(['Vacuum', 'Dishes']));
    expect(screen.getAllByTestId('chore-row')).toHaveLength(2);

    resolveComplete(await errorResponse(500, 'nope'));

    expect(await screen.findByTestId('feedback-toast')).toHaveAttribute('data-tone', 'error');
    await waitFor(() => expect(rowNames(['Vacuum', 'Dishes'])).toEqual(['Dishes', 'Vacuum']));
    expect(screen.getAllByTestId('chore-row')).toHaveLength(2);
  });

  it('applies the bucket quota to the room-filtered subset, not the full list', async () => {
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
    // Precondition: sorting before filtering would give a different list (R5 G2 R1 G2 vs R6 G4).
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

    expect(rowNames(all.map((c) => c.name))).toEqual(sortedAfterFilter);
    expect(screen.queryByText('Other room red x')).not.toBeInTheDocument();
  });

  it('applies the bucket quota to the search-filtered subset, not the full list', async () => {
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
    // Precondition: sorting before searching would give a different list.
    expect(filteredAfterSort).not.toEqual(sortedAfterFilter);

    renderView();
    await waitFor(() => expect(screen.getByText('Red 1 x')).toBeInTheDocument());

    await user.type(screen.getByRole('searchbox', { name: 'Search chores' }), 'x');

    await waitFor(() => expect(screen.queryByText('Other red')).not.toBeInTheDocument());
    expect(rowNames(all.map((c) => c.name))).toEqual(sortedAfterFilter);
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
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4500);
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
    expect(screen.queryByTestId('feedback-toast-dismiss')).not.toBeInTheDocument();
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
