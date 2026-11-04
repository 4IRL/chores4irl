import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChoresView from './ChoresView';
import { createOutbox } from '../../outbox/outbox';
import { writeChoresCache, readChoresCache, clearChoresCache } from '../../cache/choresCache';
import { getDeviceTimezone } from '@utils/deviceTimezone';

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

afterEach(async () => {
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

  it('edits an existing chore via the edit-chore form, sending its current version', async () => {
    // Pin the clock so the duration-weighted urgency sort is deterministic:
    // at this date Vacuum (id 1) outscores Dishes, so getAllByLabelText('Edit
    // chore')[0] resolves to Vacuum and the PUT hits the stubbed /api/chores/1.
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

    await user.click(screen.getAllByLabelText('Edit chore')[0]);
    const nameInput = await screen.findByLabelText('Name');
    expect(nameInput).toHaveValue('Vacuum');
    await user.clear(nameInput);
    await user.type(nameInput, 'Vacuum Deluxe');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(screen.getByText('Vacuum Deluxe')).toBeInTheDocument());
    expect(putBody).toMatchObject({ version: 1 });
  });

  it('shows a distinguishable conflict dialog, not a generic error, when an edit hits a stale version', async () => {
    // Pin the clock so the duration-weighted urgency sort is deterministic:
    // at this date Vacuum (id 1) outscores Dishes, so getAllByLabelText('Edit
    // chore')[0] resolves to Vacuum and the PUT hits the stubbed /api/chores/1.
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

    await user.click(screen.getAllByLabelText('Edit chore')[0]);
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

    await user.click(screen.getAllByLabelText('Edit chore')[0]);
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
