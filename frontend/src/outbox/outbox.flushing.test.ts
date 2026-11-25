import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createOutbox as createOutboxReal, type Outbox } from './outbox';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function okResponse() {
  return new Response(JSON.stringify({ success: true, data: null }));
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

describe('flushing state', () => {
  it('is false at rest and true while a gated flush is pending', async () => {
    const gate = deferred<Response>();
    const outbox = createOutbox(vi.fn(() => gate.promise) as unknown as typeof fetch);
    outbox.append({ type: 'delete', choreId: 1 });

    expect(outbox.isFlushing()).toBe(false);
    const flushing = outbox.flush();
    expect(outbox.isFlushing()).toBe(true);

    gate.resolve(okResponse());
    await flushing;
    expect(outbox.isFlushing()).toBe(false);
  });

  it('stays true while either of two overlapping flushes is pending', async () => {
    const gates = [deferred<Response>(), deferred<Response>()];
    let call = 0;
    const fetchImpl = vi.fn(() => gates[call++].promise);
    const outbox = createOutbox(fetchImpl as unknown as typeof fetch);
    outbox.append({ type: 'delete', choreId: 1 });

    const first = outbox.flush();
    const second = outbox.flush();
    expect(outbox.isFlushing()).toBe(true);

    gates[0].resolve(okResponse());
    await first;
    expect(outbox.isFlushing()).toBe(true);

    gates[1].resolve(okResponse());
    await second;
    expect(outbox.isFlushing()).toBe(false);
  });

  it('returns to false and notifies when a results listener throws', async () => {
    const gate = deferred<Response>();
    const outbox = createOutbox(vi.fn(() => gate.promise) as unknown as typeof fetch);
    outbox.append({ type: 'delete', choreId: 1 });
    outbox.subscribeResults(() => {
      throw new Error('listener failed');
    });
    const observed: boolean[] = [];
    outbox.subscribeFlushing(() => observed.push(outbox.isFlushing()));

    const flushing = outbox.flush();
    gate.resolve(okResponse());
    await expect(flushing).rejects.toThrow('listener failed');

    expect(outbox.isFlushing()).toBe(false);
    expect(observed).toEqual([true, false]);
  });

  it('returns to false when a flushing listener throws on the rising edge', async () => {
    const outbox = createOutbox(vi.fn(() => Promise.resolve(okResponse())) as unknown as typeof fetch);
    outbox.append({ type: 'delete', choreId: 1 });
    outbox.subscribeFlushing(() => {
      if (outbox.isFlushing()) throw new Error('rising edge failed');
    });

    await expect(outbox.flush()).rejects.toThrow('rising edge failed');

    expect(outbox.isFlushing()).toBe(false);
  });

  it('notifies once on each edge and not per entry', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(okResponse()));
    const outbox = createOutbox(fetchImpl as unknown as typeof fetch);
    outbox.append({ type: 'delete', choreId: 1 });
    outbox.append({ type: 'delete', choreId: 2 });
    outbox.append({ type: 'delete', choreId: 3 });
    const observed: boolean[] = [];
    outbox.subscribeFlushing(() => observed.push(outbox.isFlushing()));

    await outbox.flush();

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(observed).toEqual([true, false]);
  });

  it('fires the true-to-false notification after the results listeners', async () => {
    const outbox = createOutbox(vi.fn(() => Promise.resolve(okResponse())) as unknown as typeof fetch);
    outbox.append({ type: 'delete', choreId: 1 });
    const order: string[] = [];
    outbox.subscribeResults(() => order.push('results'));
    outbox.subscribeFlushing(() => order.push(outbox.isFlushing() ? 'start' : 'end'));

    await outbox.flush();

    expect(order).toEqual(['start', 'results', 'end']);
  });

  it('stops notifying after unsubscribe', async () => {
    const outbox = createOutbox(vi.fn(() => Promise.resolve(okResponse())) as unknown as typeof fetch);
    outbox.append({ type: 'delete', choreId: 1 });
    const listener = vi.fn();
    const unsubscribe = outbox.subscribeFlushing(listener);
    unsubscribe();

    await outbox.flush();

    expect(listener).not.toHaveBeenCalled();
  });
});
