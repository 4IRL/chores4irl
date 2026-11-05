import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createOutbox as createOutboxReal, type ChorePayload, type Outbox } from './outbox';

const chorePayload: ChorePayload = {
  name: 'Vacuum',
  roomId: 1,
  dateLastCompleted: '2026-06-01T00:00:00.000Z',
  duration: 20,
  frequency: 7,
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

let liveOutboxes: Outbox[] = [];
function createOutbox(fetchImpl: typeof fetch): Outbox {
  const instance = createOutboxReal(fetchImpl);
  liveOutboxes.push(instance);
  return instance;
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('navigator', { ...navigator, onLine: true });
  liveOutboxes = [];
});

afterEach(() => {
  liveOutboxes.forEach((o) => o.dispose());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('append', () => {
  it('queues an entry instead of firing a network request', () => {
    const fetchImpl = vi.fn();
    const outbox = createOutbox(fetchImpl);

    outbox.append({ type: 'delete', choreId: 1 });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(outbox.getEntries()).toHaveLength(1);
    expect(outbox.getEntries()[0]).toMatchObject({ type: 'delete', choreId: 1 });
  });

  it('persists the queue to localStorage after every append', () => {
    const outbox = createOutbox(vi.fn());

    outbox.append({ type: 'delete', choreId: 1 });

    const stored = JSON.parse(localStorage.getItem('outbox-v1') ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ type: 'delete', choreId: 1 });
  });

  it('restores the previously-persisted queue when re-instantiated (simulated reload)', () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: false });
    const first = createOutbox(vi.fn());
    first.append({ type: 'delete', choreId: 1 });

    const second = createOutbox(vi.fn());

    expect(second.getEntries()).toHaveLength(1);
    expect(second.getEntries()[0]).toMatchObject({ type: 'delete', choreId: 1 });
  });
});

describe('flush', () => {
  it('replays queued mutations in original append order on an online event', async () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: false });
    const calls: string[] = [];
    const fetchImpl = vi.fn((url: RequestInfo | URL) => {
      calls.push(url.toString());
      return jsonResponse({ success: true, data: null });
    });
    const outbox = createOutbox(fetchImpl);
    outbox.append({ type: 'delete', choreId: 1 });
    outbox.append({ type: 'delete', choreId: 2 });

    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(calls).toHaveLength(2));

    expect(calls).toEqual(['/api/chores/1', '/api/chores/2']);
  });

  it('removes a successfully replayed entry from the queue and from localStorage', async () => {
    const fetchImpl = vi.fn(() => jsonResponse({ success: true, data: null }));
    const outbox = createOutbox(fetchImpl);
    outbox.append({ type: 'delete', choreId: 1 });

    await outbox.flush();

    expect(outbox.getEntries()).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem('outbox-v1') ?? '[]')).toHaveLength(0);
  });

  it('drops only the conflicting entry on a 409 and continues flushing the rest', async () => {
    const fetchImpl = vi.fn((url: RequestInfo | URL) => {
      if (url.toString() === '/api/chores/1') return jsonResponse({ success: false }, 409);
      return jsonResponse({ success: true, data: null });
    });
    const outbox = createOutbox(fetchImpl);
    outbox.append({ type: 'edit', choreId: 1, baseVersion: 1, payload: chorePayload });
    outbox.append({ type: 'delete', choreId: 2 });

    const results = await outbox.flush();

    expect(results.map((r) => r.outcome)).toEqual(['conflict', 'success']);
    expect(results[0].status).toBe(409);
    expect(outbox.getEntries()).toHaveLength(0);
  });

  it('treats a 404 on a delete replay as success (goal state already holds)', async () => {
    const fetchImpl = vi.fn(() => jsonResponse({ success: false, error: 'not found' }, 404));
    const outbox = createOutbox(fetchImpl);
    outbox.append({ type: 'delete', choreId: 1 });

    const results = await outbox.flush();

    expect(results).toEqual([expect.objectContaining({ outcome: 'dropped-not-found', status: 404 })]);
    expect(outbox.getEntries()).toHaveLength(0);
  });

  it('stops flushing on any other error, leaving that entry and the rest queued', async () => {
    const fetchImpl = vi.fn((url: RequestInfo | URL) => {
      if (url.toString() === '/api/chores/1') return Promise.reject(new Error('network down'));
      return jsonResponse({ success: true, data: null });
    });
    const outbox = createOutbox(fetchImpl);
    outbox.append({ type: 'delete', choreId: 1 });
    outbox.append({ type: 'delete', choreId: 2 });

    const results = await outbox.flush();

    expect(results).toEqual([expect.objectContaining({ outcome: 'error' })]);
    expect(results[0]).not.toHaveProperty('status');
    expect(outbox.getEntries()).toHaveLength(2);
  });

  it('removes a 400-rejected entry, reports its status, and still flushes the next entry', async () => {
    const fetchImpl = vi.fn((url: RequestInfo | URL) => {
      if (url.toString() === '/api/chores/1') return jsonResponse({ success: false }, 400);
      return jsonResponse({ success: true, data: null });
    });
    const outbox = createOutbox(fetchImpl);
    outbox.append({ type: 'edit', choreId: 1, baseVersion: 1, payload: chorePayload });
    outbox.append({ type: 'delete', choreId: 2 });

    const results = await outbox.flush();

    expect(results).toEqual([
      expect.objectContaining({ outcome: 'error', status: 400 }),
      expect.objectContaining({ outcome: 'success', status: 200 }),
    ]);
    expect(outbox.getEntries()).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem('outbox-v1') ?? '[]')).toHaveLength(0);
  });

  it.each([401, 403, 408, 429, 500])(
    'keeps the entry, reports status %i, and stops the pass',
    async (code) => {
      const fetchImpl = vi.fn((url: RequestInfo | URL) => {
        if (url.toString() === '/api/chores/1') return jsonResponse({ success: false }, code);
        return jsonResponse({ success: true, data: null });
      });
      const outbox = createOutbox(fetchImpl);
      outbox.append({ type: 'delete', choreId: 1 });
      outbox.append({ type: 'delete', choreId: 2 });

      const results = await outbox.flush();

      expect(results).toEqual([expect.objectContaining({ outcome: 'error', status: code })]);
      expect(outbox.getEntries()).toHaveLength(2);
      expect(JSON.parse(localStorage.getItem('outbox-v1') ?? '[]')).toHaveLength(2);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps the entry and stops the pass on a 2xx with a non-JSON body without throwing', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response('<html>oops</html>', { status: 200 })));
    const outbox = createOutbox(fetchImpl);
    outbox.append({ type: 'delete', choreId: 1 });
    outbox.append({ type: 'delete', choreId: 2 });

    const results = await outbox.flush();

    expect(results).toEqual([expect.objectContaining({ outcome: 'error', status: 200 })]);
    expect(outbox.getEntries()).toHaveLength(2);
    expect(JSON.parse(localStorage.getItem('outbox-v1') ?? '[]')).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('removes a 404 on an edit entry and reports status 404', async () => {
    const fetchImpl = vi.fn(() => jsonResponse({ success: false }, 404));
    const outbox = createOutbox(fetchImpl);
    outbox.append({ type: 'edit', choreId: 1, baseVersion: 1, payload: chorePayload });

    const results = await outbox.flush();

    expect(results).toEqual([expect.objectContaining({ outcome: 'error', status: 404 })]);
    expect(outbox.getEntries()).toHaveLength(0);
  });

  it('flushes immediately at construction time when already online with a persisted queue', async () => {
    const seed = createOutbox(vi.fn());
    seed.append({ type: 'delete', choreId: 1 });

    const fetchImpl = vi.fn(() => jsonResponse({ success: true, data: null }));
    createOutbox(fetchImpl);

    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
  });

  it('sends the same clientId on every replay of a create entry (idempotency key stability)', async () => {
    const bodies: string[] = [];
    const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(init?.body as string);
      return Promise.reject(new Error('ack lost'));
    });
    const outbox = createOutbox(fetchImpl);
    outbox.append({ type: 'create', tempId: -1, payload: chorePayload });

    await outbox.flush();
    await outbox.flush();

    expect(bodies).toHaveLength(2);
    const clientIds = bodies.map((b) => JSON.parse(b).clientId);
    expect(clientIds[0]).toBe(clientIds[1]);
  });

  it('notifies result subscribers with each entry outcome once a flush completes', async () => {
    const fetchImpl = vi.fn(() => jsonResponse({ success: true, data: { id: 42 } }));
    const outbox = createOutbox(fetchImpl);
    outbox.append({ type: 'delete', choreId: 1 });
    const received: unknown[] = [];
    const unsubscribe = outbox.subscribeResults((results) => received.push(...results));

    await outbox.flush();

    expect(received).toEqual([expect.objectContaining({ outcome: 'success', data: { id: 42 } })]);
    unsubscribe();
  });
});
