import type { ComponentProps } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChoresView from './ChoresView';
import { createOutbox as createOutboxBase } from '../../outbox/outbox';
import { readChoresCache, writeChoresCache, clearChoresCache } from '../../cache/choresCache';

vi.mock('@utils/deviceTimezone', () => ({
  getDeviceTimezone: vi.fn(() => 'America/New_York'),
}));

// Passthrough cache module whose write can be made to fail (DD-23).
const cacheFault = vi.hoisted(() => ({ failWrites: false }));
vi.mock('../../cache/choresCache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../cache/choresCache')>();
  return {
    ...actual,
    writeChoresCache: (async (chores: unknown) => {
      if (cacheFault.failWrites) throw new Error('write failed');
      return actual.writeChoresCache(chores);
    }) as typeof actual.writeChoresCache,
  };
});

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

function errorResponse(status: number, error: string) {
  return Promise.resolve(
    new Response(JSON.stringify({ success: false, error }), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

function unauthorizedResponse() {
  return errorResponse(401, 'Unauthorized');
}

function forbiddenResponse() {
  return errorResponse(403, 'Not a member of this household');
}

function listResponse(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), {
    headers: { 'content-type': 'application/json' },
  });
}

type MutationHandler = (url: string, method: string) => Promise<Response> | undefined;

// The nth GET /api/chores (1-based) is answered by `list`; anything else by `other`.
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
  return { getCount: () => gets };
}

// Every outbox registers a window 'online' listener; dispose them after each test.
const createdOutboxes: ReturnType<typeof createOutboxBase>[] = [];

function createOutbox(fetchImpl?: typeof fetch) {
  const created = createOutboxBase(fetchImpl);
  createdOutboxes.push(created);
  return created;
}

function setVisibilityState(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => state === 'hidden' });
}

async function setVisibility(state: 'visible' | 'hidden') {
  await act(async () => {
    setVisibilityState(state);
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

afterEach(async () => {
  createdOutboxes.splice(0).forEach((created) => created.dispose());
  setVisibilityState('visible');
  cacheFault.failWrites = false;
  vi.unstubAllGlobals();
  vi.useRealTimers();
  cleanup();
  localStorage.clear();
  await clearChoresCache();
});

function renderView(
  outbox?: ReturnType<typeof createOutbox>,
  extraProps: Partial<ComponentProps<typeof ChoresView>> = {},
) {
  return render(
    <ChoresView
      householdTimezone="UTC"
      rooms={mockRooms}
      swipeStyle="ios"
      onSwipeStyleChange={vi.fn()}
      outbox={outbox}
      {...extraProps}
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
const urgentChores = [{ ...mockChores[0], urgency: 'high' }, mockChores[1]];
const urgentList = () => jsonResponse({ success: true, data: urgentChores });
const undoButton = () => screen.queryByTestId('feedback-toast-undo');

// Fake clock at a fixed day so "N days ago" and the 8 s windows are deterministic.
function setupClock() {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-07-01T12:00:00.000Z'));
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

function undoStub(
  extra: MutationHandler = () => undefined,
  list: (n: number) => Promise<Response> = urgentList,
) {
  return stubListFetch(list, (url, method) => {
    if (url === '/api/chores/1/complete') return okRow(VACUUM_COMPLETED);
    return extra(url, method);
  });
}

async function completeVacuum(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
  await user.click(barFor('Vacuum'));
  return screen.findByTestId('feedback-toast-undo');
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function stubPointer(coarse: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === '(pointer: coarse)' ? coarse : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}

function dragBar(bar: HTMLElement, fromX: number, toX: number) {
  fireEvent.mouseDown(bar, { clientX: fromX, clientY: 0 });
  fireEvent.mouseMove(document, { clientX: fromX + (toX - fromX) * 0.2, clientY: 0 });
  fireEvent.mouseMove(document, { clientX: toX, clientY: 0 });
  fireEvent.mouseUp(document, { clientX: toX, clientY: 0 });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function focusWindow() {
  await act(async () => {
    window.dispatchEvent(new Event('focus'));
  });
}

async function goOffline() {
  vi.stubGlobal('navigator', { ...navigator, onLine: false });
  await act(async () => {
    window.dispatchEvent(new Event('offline'));
  });
}

async function goOnline() {
  vi.stubGlobal('navigator', { ...navigator, onLine: true });
  await act(async () => {
    window.dispatchEvent(new Event('online'));
  });
}

// The mount load writes the cache after rendering; wait for it so a later write wins.
async function waitForMountCacheWrite() {
  await waitFor(async () => expect(await readChoresCache()).toBeDefined());
}

const renamedVacuum = (extra: object = {}) => [{ ...mockChores[0], name: 'Hoover', ...extra }, mockChores[1]];

async function openEditVacuum(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(rowFor('Vacuum')).getByLabelText('Edit chore'));
  await screen.findByRole('button', { name: 'Save Changes' });
}

describe('ChoresView live refresh', () => {
  describe('triggers', () => {
    it('polls after 30 s and shows a change made on another device', async () => {
      setupClock();
      const { getCount } = stubListFetch((n) =>
        n === 1
          ? jsonResponse({ success: true, data: mockChores })
          : jsonResponse({ success: true, data: renamedVacuum() }),
      );
      renderView();
      await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
      expect(getCount()).toBe(1);

      await advance(30_000);

      expect(getCount()).toBe(2);
      await waitFor(() => expect(screen.getByText('Hoover')).toBeInTheDocument());
    });

    it('does not poll while hidden, and re-pulls once on becoming visible', async () => {
      setupClock();
      const { getCount } = stubListFetch(() => jsonResponse({ success: true, data: mockChores }));
      renderView();
      await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

      await setVisibility('hidden');
      await advance(90_000);
      expect(getCount()).toBe(1);

      await setVisibility('visible');
      expect(getCount()).toBe(2);
    });

    it('re-pulls once on window focus', async () => {
      setupClock();
      const { getCount } = stubListFetch(() => jsonResponse({ success: true, data: mockChores }));
      renderView();
      await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

      await focusWindow();

      await waitFor(() => expect(getCount()).toBe(2));
      await advance(1000);
      expect(getCount()).toBe(2);
    });

    it('does not poll while offline, and a reconnect makes only its own load', async () => {
      setupClock();
      const { getCount } = stubListFetch(() => jsonResponse({ success: true, data: mockChores }));
      renderView();
      await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

      await goOffline();
      await advance(90_000);
      await focusWindow();
      expect(getCount()).toBe(1);

      await goOnline();
      await advance(1000);
      expect(getCount()).toBe(2);
    });
  });

  describe('holds', () => {
    it('holds while the edit form is open and catches up once on cancel', async () => {
      const user = setupClock();
      const { getCount } = stubListFetch((n) =>
        n === 1
          ? jsonResponse({ success: true, data: mockChores })
          : jsonResponse({ success: true, data: [{ ...mockChores[0], version: 2 }, mockChores[1]] }),
      );
      renderView();
      await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

      await openEditVacuum(user);
      const nameInput = screen.getByLabelText('Name');
      await user.clear(nameInput);
      await user.type(nameInput, 'Vacuum Deluxe');
      await advance(90_000);

      expect(getCount()).toBe(1);
      expect(screen.getByLabelText('Name')).toHaveValue('Vacuum Deluxe');

      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(getCount()).toBe(2));
      await advance(1000);
      expect(getCount()).toBe(2);
    });

    it('keeps baseVersion still under a held tick, so a stale save gets the conflict dialog', async () => {
      const user = setupClock();
      stubListFetch(
        (n) =>
          n === 1
            ? jsonResponse({ success: true, data: mockChores })
            : jsonResponse({ success: true, data: [{ ...mockChores[0], version: 2 }, mockChores[1]] }),
        (url, method) =>
          url === '/api/chores/1' && method === 'PUT' ? errorResponse(409, 'changed elsewhere') : undefined,
      );
      renderView();
      await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

      await openEditVacuum(user);
      await advance(30_000);
      await user.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => expect(screen.getByText('This chore was changed elsewhere.')).toBeInTheDocument());
      const puts = callsTo('PUT', '/api/chores/1');
      expect(puts).toHaveLength(1);
      expect(bodyOf(puts[0]).version).toBe(1);
    });

    it.each([
      ['add form', '+ Add Chore', 'Cancel'],
      ['settings modal', 'Settings', 'Close'],
    ] as const)(
      'holds while the %s is open and catches up once on close',
      async (_name, openLabel, closeLabel) => {
        const user = setupClock();
        const { getCount } = stubListFetch(
          () => jsonResponse({ success: true, data: mockChores }),
          (url) => (url.startsWith('/api/notifications') ? errorResponse(500, 'nope') : undefined),
        );
        renderView();
        await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

        await user.click(screen.getByRole('button', { name: openLabel }));
        await advance(30_000);
        expect(getCount()).toBe(1);

        await user.click(screen.getByRole('button', { name: closeLabel }));
        await waitFor(() => expect(getCount()).toBe(2));
        await advance(1000);
        expect(getCount()).toBe(2);
      },
    );

    it('holds while the row delete confirm is open and catches up once on cancel', async () => {
      setupClock();
      stubPointer(true);
      const { getCount } = stubListFetch(() => jsonResponse({ success: true, data: mockChores }));
      renderView(undefined, { swipeStyle: 'android' });
      await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

      dragBar(barFor('Vacuum'), 0, 140);
      await screen.findByTestId('confirm-dialog-backdrop');
      await advance(90_000);
      expect(getCount()).toBe(1);

      fireEvent.click(screen.getByTestId('confirm-dialog-cancel'));
      await waitFor(() => expect(getCount()).toBe(2));
      await advance(1000);
      expect(getCount()).toBe(2);
    });

    it('defers while the outbox is flushing and re-pulls once when the pass ends', async () => {
      setupClock();
      const gate = deferred<Response>();
      const testOutbox = createOutbox(vi.fn(() => gate.promise) as unknown as typeof fetch);
      const { getCount } = stubListFetch(() => jsonResponse({ success: true, data: mockChores }));
      renderView(testOutbox);
      await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

      testOutbox.append({
        type: 'complete',
        choreId: 1,
        payload: { dateLastCompleted: '2026-07-01T00:00:00.000Z' },
      });
      await act(async () => {
        void testOutbox.flush();
      });
      await advance(30_000);
      expect(getCount()).toBe(1);

      await act(async () => {
        gate.resolve(listResponse(VACUUM_COMPLETED));
      });
      await waitFor(() => expect(getCount()).toBe(2));
      await advance(1000);
      expect(getCount()).toBe(2);
    });

    it('defers while an entry stays queued after a failed online write', async () => {
      const user = setupClock();
      const outboxFetch = vi.fn();
      const testOutbox = createOutbox(outboxFetch as unknown as typeof fetch);
      const { getCount } = stubListFetch(urgentList, (url) =>
        url === '/api/chores/1/complete' ? Promise.reject(new Error('network unavailable')) : undefined,
      );
      renderView(testOutbox);
      await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

      await user.click(barFor('Vacuum'));
      await waitFor(() => expect(screen.getByText(/Saved offline/)).toBeInTheDocument());
      expect(within(barFor('Vacuum')).getByText('0 days ago')).toBeInTheDocument();

      await advance(90_000);

      expect(getCount()).toBe(1);
      expect(within(barFor('Vacuum')).getByText('0 days ago')).toBeInTheDocument();

      // Draining the queue runs the deferred re-pull exactly once (no hold leaked from the write).
      outboxFetch.mockImplementation(() => okRow(VACUUM_COMPLETED));
      await act(async () => {
        await testOutbox.flush();
      });
      await waitFor(() => expect(getCount()).toBe(2));
      await advance(1000);
      expect(getCount()).toBe(2);
    });

    it('holds during the mount load, then re-pulls once after it (shared generation)', async () => {
      setupClock();
      const mountGate = deferred<Response>();
      const { getCount } = stubListFetch((n) =>
        n === 1 ? mountGate.promise : jsonResponse({ success: true, data: renamedVacuum() }),
      );
      renderView();

      await focusWindow();
      expect(getCount()).toBe(1);

      await act(async () => {
        mountGate.resolve(listResponse(mockChores));
      });
      await waitFor(() => expect(getCount()).toBe(2));
      await waitFor(() => expect(screen.getByText('Hoover')).toBeInTheDocument());
      await advance(1000);
      expect(getCount()).toBe(2);
    });
  });

  describe('in-flight results', () => {
    it('drops a result that lands after the edit form opened, so a stale save conflicts', async () => {
      const user = setupClock();
      const gate = deferred<Response>();
      const renamed = renamedVacuum({ version: 2 });
      const { getCount } = stubListFetch(
        (n) => {
          if (n === 1) return jsonResponse({ success: true, data: mockChores });
          if (n === 2) return gate.promise;
          return jsonResponse({ success: true, data: renamed });
        },
        (url, method) =>
          url === '/api/chores/1' && method === 'PUT' ? errorResponse(409, 'changed elsewhere') : undefined,
      );
      renderView();
      await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

      await focusWindow();
      await waitFor(() => expect(getCount()).toBe(2));
      await openEditVacuum(user);
      await act(async () => {
        gate.resolve(listResponse(renamed));
      });

      expect(screen.getByLabelText('Name')).toHaveValue('Vacuum');
      await user.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => expect(screen.getByText('This chore was changed elsewhere.')).toBeInTheDocument());
      const puts = callsTo('PUT', '/api/chores/1');
      expect(puts).toHaveLength(1);
      expect(bodyOf(puts[0]).version).toBe(1);
    });

    it('drops a result that lands after a write started, and re-pulls once', async () => {
      const user = setupClock();
      const second = deferred<Response>();
      const third = deferred<Response>();
      const { getCount } = undoStub(undefined, (n) => {
        if (n === 1) return urgentList();
        if (n === 2) return second.promise;
        return third.promise;
      });
      renderView();
      await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

      await focusWindow();
      await waitFor(() => expect(getCount()).toBe(2));
      await completeVacuum(user);

      await act(async () => {
        second.resolve(listResponse(urgentChores));
      });

      expect(within(barFor('Vacuum')).getByText('0 days ago')).toBeInTheDocument();
      await waitFor(() => expect(getCount()).toBe(3));

      await act(async () => {
        third.resolve(listResponse([VACUUM_COMPLETED, mockChores[1]]));
      });
      expect(within(barFor('Vacuum')).getByText('0 days ago')).toBeInTheDocument();
      await advance(1000);
      expect(getCount()).toBe(3);
    });

    it('keeps the form open over a deferred list without its chore, and the catch-up removes the row', async () => {
      const user = setupClock();
      const gate = deferred<Response>();
      const withoutVacuum = [mockChores[1]];
      const { getCount } = stubListFetch((n) => {
        if (n === 1) return jsonResponse({ success: true, data: mockChores });
        if (n === 2) return gate.promise;
        return jsonResponse({ success: true, data: withoutVacuum });
      });
      renderView();
      await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

      await focusWindow();
      await waitFor(() => expect(getCount()).toBe(2));
      await openEditVacuum(user);
      await act(async () => {
        gate.resolve(listResponse(withoutVacuum));
      });
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
      expect(getCount()).toBe(2);

      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(getCount()).toBe(3));
      await waitFor(() => expect(screen.queryByText('Vacuum')).not.toBeInTheDocument());

      await advance(30_000);
      expect(getCount()).toBe(4);
    });
  });

  describe('undo and order', () => {
    it('keeps a live Undo across a refresh (DD-11)', async () => {
      const user = setupClock();
      const { getCount } = undoStub(
        (url, method) =>
          url === '/api/chores/1' && method === 'PUT'
            ? okRow({ ...mockChores[0], urgency: 'high', version: 3 })
            : undefined,
        (n) =>
          n === 1
            ? urgentList()
            : jsonResponse({
                success: true,
                data: [VACUUM_COMPLETED, { ...mockChores[1], name: 'Dishes Renamed' }],
              }),
      );
      renderView();
      await completeVacuum(user);

      await focusWindow();

      await waitFor(() => expect(getCount()).toBe(2));
      await waitFor(() => expect(screen.getByText('Dishes Renamed')).toBeInTheDocument());
      expect(undoButton()).toBeInTheDocument();
      await user.click(undoButton() as HTMLElement);
      await waitFor(() => expect(callsTo('PUT', '/api/chores/1')).toHaveLength(1));
    });

    it('never re-sorts rows on a poll', async () => {
      setupClock();
      let secondList: unknown[] = [];
      const { getCount } = stubListFetch((n) =>
        n === 1
          ? jsonResponse({ success: true, data: mockChores })
          : jsonResponse({ success: true, data: secondList }),
      );
      renderView();
      await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
      const before = rowNames(['Vacuum', 'Dishes']);
      // Complete the top row today (a fresh sort would drop it below the other) and rename the other.
      const topId = before[0] === 'Vacuum' ? 1 : 2;
      secondList = mockChores.map((chore) =>
        chore.id === topId
          ? { ...chore, dateLastCompleted: '2026-07-01T00:00:00.000Z', version: 2 }
          : { ...chore, name: `${chore.name} Renamed` },
      );
      const other = before[1];

      await advance(30_000);

      expect(getCount()).toBe(2);
      await waitFor(() => expect(screen.getByText(`${other} Renamed`)).toBeInTheDocument());
      expect(rowNames([before[0], `${other} Renamed`])).toEqual([before[0], `${other} Renamed`]);
    });
  });

  describe('failures', () => {
    it('keeps the rows on a poll 401, shows Retry and pauses until a connectivity load succeeds', async () => {
      const user = setupClock();
      const { getCount } = undoStub(undefined, (n) => {
        if (n === 1) return urgentList();
        if (n === 2) return unauthorizedResponse();
        return jsonResponse({ success: true, data: [VACUUM_COMPLETED, mockChores[1]] });
      });
      renderView();
      await completeVacuum(user);
      expect(within(barFor('Vacuum')).getByText('0 days ago')).toBeInTheDocument();
      await waitForMountCacheWrite();
      await writeChoresCache([]);

      await advance(30_000);

      expect(getCount()).toBe(2);
      await waitFor(() => expect(screen.getByTestId('status-banner-action')).toBeInTheDocument());
      expect(screen.getByText('Vacuum')).toBeInTheDocument();
      expect(screen.getByText('Dishes')).toBeInTheDocument();
      expect(within(barFor('Vacuum')).getByText('0 days ago')).toBeInTheDocument();

      await advance(90_000);
      await focusWindow();
      await advance(1000);
      expect(getCount()).toBe(2);

      await goOnline();
      await waitFor(() => expect(getCount()).toBe(3));
      await waitFor(() => expect(screen.queryByTestId('status-banner')).not.toBeInTheDocument());
      await advance(30_000);
      expect(getCount()).toBe(4);
    });

    it('runs the revoke cascade once on a poll 403 and stops refreshing', async () => {
      setupClock();
      const onHouseholdRevoked = vi.fn();
      const { getCount } = stubListFetch((n) =>
        n === 1 ? jsonResponse({ success: true, data: mockChores }) : forbiddenResponse(),
      );
      renderView(undefined, { onHouseholdRevoked });
      await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

      await advance(30_000);
      await waitFor(() => expect(onHouseholdRevoked).toHaveBeenCalledTimes(1));
      expect(getCount()).toBe(2);

      await advance(90_000);
      await focusWindow();
      await advance(1000);
      expect(getCount()).toBe(2);
      expect(onHouseholdRevoked).toHaveBeenCalledTimes(1);
    });

    it('stops refreshing after a refetch 403 from Discard on the conflict dialog', async () => {
      const user = setupClock();
      const onHouseholdRevoked = vi.fn();
      const { getCount } = stubListFetch(
        (n) => (n === 1 ? jsonResponse({ success: true, data: mockChores }) : forbiddenResponse()),
        (url, method) =>
          url === '/api/chores/1' && method === 'PUT' ? errorResponse(409, 'changed elsewhere') : undefined,
      );
      renderView(undefined, { onHouseholdRevoked });
      await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

      await openEditVacuum(user);
      await user.click(screen.getByRole('button', { name: 'Save Changes' }));
      await screen.findByText('This chore was changed elsewhere.');
      await user.click(screen.getByRole('button', { name: 'Discard my changes' }));
      await waitFor(() => expect(onHouseholdRevoked).toHaveBeenCalledTimes(1));
      expect(getCount()).toBe(2);

      await advance(90_000);
      await focusWindow();
      await advance(1000);
      expect(getCount()).toBe(2);
    });

    it.each([
      ['500', () => errorResponse(500, 'boom')],
      ['fetch throw', () => Promise.reject(new Error('network'))],
    ] as const)(
      'keeps the rows on a poll %s, and the next good poll clears the banner and hands focus to Add',
      async (_name, failure) => {
        setupClock();
        const { getCount } = stubListFetch((n) => {
          if (n === 2) return failure();
          return jsonResponse({ success: true, data: mockChores });
        });
        renderView();
        await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
        await waitForMountCacheWrite();
        await writeChoresCache([]);

        await advance(30_000);

        expect(getCount()).toBe(2);
        await waitFor(() => expect(screen.getByTestId('status-banner-action')).toBeInTheDocument());
        expect(screen.getByText('Vacuum')).toBeInTheDocument();
        expect(screen.getByText('Dishes')).toBeInTheDocument();

        screen.getByTestId('status-banner-action').focus();
        await advance(30_000);

        expect(getCount()).toBe(3);
        await waitFor(() => expect(screen.queryByTestId('status-banner')).not.toBeInTheDocument());
        expect(screen.getByRole('button', { name: '+ Add Chore' })).toHaveFocus();
      },
    );

    it('shows Retry, not the offline copy, when a poll fails after a fresh reconnect (DD-9)', async () => {
      setupClock();
      const { getCount } = stubListFetch((n) =>
        n === 3 ? unauthorizedResponse() : jsonResponse({ success: true, data: mockChores }),
      );
      renderView();
      await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

      await goOffline();
      await goOnline();
      await waitFor(() => expect(getCount()).toBe(2));

      await advance(30_000);

      expect(getCount()).toBe(3);
      await waitFor(() => expect(screen.getByTestId('status-banner-action')).toBeInTheDocument());
      expect(screen.queryByText(/You're offline/)).not.toBeInTheDocument();
    });

    it('prunes an open form when a connectivity reload drops its chore (DD-24)', async () => {
      const user = setupClock();
      const { getCount } = stubListFetch((n) =>
        n === 1
          ? jsonResponse({ success: true, data: mockChores })
          : jsonResponse({ success: true, data: [mockChores[1]] }),
      );
      renderView();
      await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

      await goOffline();
      await openEditVacuum(user);
      await goOnline();

      await waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument(),
      );
      expect(screen.queryByText('Vacuum')).not.toBeInTheDocument();
      expect(getCount()).toBe(2);

      await advance(30_000);
      expect(getCount()).toBe(3);
    });

    it('applies a polled list even when the cache write fails (DD-23)', async () => {
      setupClock();
      const { getCount } = stubListFetch((n) =>
        n === 1
          ? jsonResponse({ success: true, data: mockChores })
          : jsonResponse({ success: true, data: renamedVacuum() }),
      );
      renderView();
      await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
      await waitForMountCacheWrite();
      cacheFault.failWrites = true;

      await advance(30_000);

      await waitFor(() => expect(screen.getByText('Hoover')).toBeInTheDocument());
      expect(screen.queryByTestId('status-banner')).not.toBeInTheDocument();
      await advance(30_000);
      expect(getCount()).toBe(3);
    });
  });

  describe('rooms re-pull', () => {
    it('does not call onRefreshRooms for the mount load', async () => {
      setupClock();
      const onRefreshRooms = vi.fn();
      stubListFetch(() => jsonResponse({ success: true, data: mockChores }));
      renderView(undefined, { onRefreshRooms });
      await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
      await waitForMountCacheWrite();

      expect(onRefreshRooms).not.toHaveBeenCalled();
    });

    it('calls onRefreshRooms once for a focus refresh that applies', async () => {
      setupClock();
      const onRefreshRooms = vi.fn();
      const { getCount } = stubListFetch((n) =>
        n === 1
          ? jsonResponse({ success: true, data: mockChores })
          : jsonResponse({ success: true, data: renamedVacuum() }),
      );
      renderView(undefined, { onRefreshRooms });
      await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

      await focusWindow();

      await waitFor(() => expect(screen.getByText('Hoover')).toBeInTheDocument());
      expect(getCount()).toBe(2);
      await waitFor(() => expect(onRefreshRooms).toHaveBeenCalledTimes(1));
      await advance(1000);
      expect(onRefreshRooms).toHaveBeenCalledTimes(1);
    });

    it('does not call onRefreshRooms when the refresh answers 500', async () => {
      setupClock();
      const onRefreshRooms = vi.fn();
      const { getCount } = stubListFetch((n) =>
        n === 1 ? jsonResponse({ success: true, data: mockChores }) : errorResponse(500, 'boom'),
      );
      renderView(undefined, { onRefreshRooms });
      await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

      await focusWindow();

      await waitFor(() => expect(getCount()).toBe(2));
      await waitFor(() => expect(screen.getByTestId('status-banner-action')).toBeInTheDocument());
      expect(onRefreshRooms).not.toHaveBeenCalled();
    });

    it('makes no chores or rooms re-pull on focus after a poll 401 paused refresh', async () => {
      setupClock();
      const onRefreshRooms = vi.fn();
      const { getCount } = stubListFetch((n) =>
        n === 1 ? jsonResponse({ success: true, data: mockChores }) : unauthorizedResponse(),
      );
      renderView(undefined, { onRefreshRooms });
      await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());

      await advance(30_000);
      await waitFor(() => expect(screen.getByTestId('status-banner-action')).toBeInTheDocument());
      expect(getCount()).toBe(2);
      const fetchCallsAfterPause = vi.mocked(fetch).mock.calls.length;

      await focusWindow();
      await advance(1000);

      expect(vi.mocked(fetch).mock.calls.length).toBe(fetchCallsAfterPause);
      expect(onRefreshRooms).not.toHaveBeenCalled();
    });
  });
});
