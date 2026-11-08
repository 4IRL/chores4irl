import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createOutbox as createOutboxReal,
  isPermanentRejection,
  type FlushResult,
  type Outbox,
} from './outbox';

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

let live: Outbox[] = [];
function createOutbox(fetchImpl: typeof fetch): Outbox {
  const instance = createOutboxReal(fetchImpl);
  live.push(instance);
  return instance;
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('navigator', { ...navigator, onLine: true });
  live = [];
});

afterEach(() => {
  live.forEach((o) => o.dispose());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('remove', () => {
  it('removes a queued id, persists, notifies subscribers and returns true', () => {
    const fetchImpl = vi.fn();
    const outbox = createOutbox(fetchImpl);
    const listener = vi.fn();
    outbox.subscribe(listener);
    const entry = outbox.append({ type: 'delete', choreId: 1 });
    listener.mockClear();

    expect(outbox.remove(entry.id)).toBe(true);

    expect(outbox.getEntries()).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem('outbox-v1') ?? '[]')).toHaveLength(0);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns false for an unknown id and does not notify', () => {
    const outbox = createOutbox(vi.fn());
    outbox.append({ type: 'delete', choreId: 1 });
    const listener = vi.fn();
    outbox.subscribe(listener);

    expect(outbox.remove('nope')).toBe(false);
    expect(outbox.getEntries()).toHaveLength(1);
    expect(listener).not.toHaveBeenCalled();
  });

  it('refuses to remove the in-flight entry, which is still sent', async () => {
    const gate = deferred<Response>();
    const fetchImpl = vi.fn(() => gate.promise);
    const outbox = createOutbox(fetchImpl as unknown as typeof fetch);
    const entry = outbox.append({ type: 'delete', choreId: 1 });

    const flushing = outbox.flush();
    expect(outbox.remove(entry.id)).toBe(false);
    gate.resolve(new Response(JSON.stringify({ success: true, data: null })));
    const results = await flushing;

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(results[0]).toMatchObject({ outcome: 'success' });
    expect(outbox.getEntries()).toHaveLength(0);
  });

  it('keeps the entry protected until the last of two overlapping flushes finishes', async () => {
    const gates = [deferred<Response>(), deferred<Response>()];
    let call = 0;
    const fetchImpl = vi.fn(() => gates[call++].promise);
    const outbox = createOutbox(fetchImpl as unknown as typeof fetch);
    const entry = outbox.append({ type: 'delete', choreId: 1 });

    const first = outbox.flush();
    const second = outbox.flush();
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    // 503 keeps the entry queued, so remove() is false only because of the in-flight count.
    gates[0].resolve(new Response('{}', { status: 503 }));
    await first;
    expect(outbox.getEntries()).toHaveLength(1);
    expect(outbox.remove(entry.id)).toBe(false);

    gates[1].resolve(new Response('{}', { status: 503 }));
    await second;
    expect(outbox.remove(entry.id)).toBe(true);
    expect(outbox.getEntries()).toHaveLength(0);
  });

  it('never fetches a later queued entry removed while an earlier one is mid-flight', async () => {
    const gate = deferred<Response>();
    const fetchImpl = vi.fn(() => gate.promise);
    const outbox = createOutbox(fetchImpl as unknown as typeof fetch);
    outbox.append({ type: 'delete', choreId: 1 });
    const later = outbox.append({ type: 'delete', choreId: 2 });

    const flushing = outbox.flush();
    expect(outbox.remove(later.id)).toBe(true);
    gate.resolve(new Response(JSON.stringify({ success: true, data: null })));
    await flushing;

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith('/api/chores/1', expect.anything());
  });

  it('a 410 to a queued create removes the entry and reports a dropped error', async () => {
    const outbox = createOutbox(vi.fn(() => jsonResponse({ success: false }, 410)));
    outbox.append({
      type: 'create',
      tempId: -1,
      payload: {
        name: 'a',
        roomId: 1,
        dateLastCompleted: '2026-06-01T00:00:00.000Z',
        duration: 1,
        frequency: 1,
      },
    });

    const results = await outbox.flush();

    expect(results[0]).toMatchObject({ outcome: 'error', status: 410 });
    expect(isPermanentRejection(results[0].status!)).toBe(true);
    expect(outbox.getEntries()).toHaveLength(0);
  });
});

describe('result listener entry state', () => {
  async function entriesSeenByListener(response: () => Promise<Response>) {
    localStorage.clear();
    const outbox = createOutbox(vi.fn(response));
    outbox.append({ type: 'delete', choreId: 1 });
    let seen: number | undefined;
    outbox.subscribeResults((_results: FlushResult[]) => {
      seen = outbox.getEntries().length;
    });
    await outbox.flush();
    return seen;
  }

  it('sees the entry removed after success, conflict and permanent error', async () => {
    expect(await entriesSeenByListener(() => jsonResponse({ success: true, data: null }))).toBe(0);
    expect(await entriesSeenByListener(() => jsonResponse({ success: false }, 409))).toBe(0);
    expect(await entriesSeenByListener(() => jsonResponse({ success: false }, 400))).toBe(0);
  });

  it('sees the entry still present after a network throw, 429, 5xx and unparsable 200', async () => {
    expect(await entriesSeenByListener(() => Promise.reject(new Error('offline')))).toBe(1);
    expect(await entriesSeenByListener(() => jsonResponse({}, 429))).toBe(1);
    expect(await entriesSeenByListener(() => jsonResponse({}, 503))).toBe(1);
    expect(await entriesSeenByListener(() => Promise.resolve(new Response('not json')))).toBe(1);
  });
});
