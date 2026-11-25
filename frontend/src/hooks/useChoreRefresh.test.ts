import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { OutboxEntry } from '../outbox/outbox';
import { useChoreRefresh, type RefreshResult } from './useChoreRefresh';

type FakeOutboxState = {
  flushing: boolean;
  entries: OutboxEntry[];
  flushingListeners: Set<() => void>;
  entryListeners: Set<() => void>;
};

function fakeOutbox() {
  const state: FakeOutboxState = {
    flushing: false,
    entries: [],
    flushingListeners: new Set(),
    entryListeners: new Set(),
  };
  const outbox = {
    isFlushing: () => state.flushing,
    subscribeFlushing: (listener: () => void) => {
      state.flushingListeners.add(listener);
      return () => {
        state.flushingListeners.delete(listener);
      };
    },
    getEntries: () => state.entries,
    subscribe: (listener: () => void) => {
      state.entryListeners.add(listener);
      return () => {
        state.entryListeners.delete(listener);
      };
    },
  };
  return { state, outbox };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const queuedEntry: OutboxEntry = {
  id: 'q1',
  type: 'delete',
  choreId: 1,
  createdAt: '2026-07-01T00:00:00.000Z',
};

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

async function notify(listeners: Set<() => void>) {
  await act(async () => {
    [...listeners].forEach((listener) => listener());
  });
}

function setup(
  options: {
    intervalMs?: number;
    refresh?: (ctx: { isUnchanged: () => boolean }) => Promise<RefreshResult>;
  } = {},
) {
  const { state, outbox } = fakeOutbox();
  const refresh = vi.fn(options.refresh ?? (() => Promise.resolve('done' as const)));
  const hook = renderHook(() =>
    useChoreRefresh({ refresh, intervalMs: options.intervalMs ?? 30_000, outbox }),
  );
  return { state, outbox, refresh, hook };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  setVisibilityState('visible');
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('useChoreRefresh', () => {
  it('does not refresh on mount and refreshes once after one interval', async () => {
    const { refresh } = setup();
    expect(refresh).not.toHaveBeenCalled();
    await advance(30_000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('adds one refresh per further interval', async () => {
    const { refresh } = setup();
    await advance(30_000);
    await advance(30_000);
    await advance(30_000);
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it('does not poll or refresh on focus while hidden', async () => {
    const { refresh } = setup();
    await setVisibility('hidden');
    await advance(120_000);
    await focusWindow();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('refreshes immediately on the hidden-to-visible edge, then again one interval later', async () => {
    const { refresh } = setup();
    await setVisibility('hidden');
    await advance(10_000);
    await setVisibility('visible');
    expect(refresh).toHaveBeenCalledTimes(1);
    await advance(30_000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('refreshes once on window focus', async () => {
    const { refresh } = setup();
    await focusWindow();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('is single-flight: triggers during an in-flight refresh do not start another', async () => {
    const gate = deferred<RefreshResult>();
    const { refresh } = setup({ refresh: () => gate.promise });
    await focusWindow();
    await setVisibility('visible');
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => {
      gate.resolve('done');
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('makes no calls while offline and leaves nothing pending', async () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: false });
    const { refresh, hook } = setup();
    await advance(60_000);
    await focusWindow();
    expect(refresh).not.toHaveBeenCalled();

    vi.stubGlobal('navigator', { ...navigator, onLine: true });
    act(() => {
      hook.result.current.acquireHold();
    });
    act(() => {
      hook.result.current.releaseHold();
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('defers triggers while a hold is held and runs once on the last release', async () => {
    const { refresh, hook } = setup();
    act(() => {
      hook.result.current.acquireHold();
    });
    await advance(30_000);
    await advance(30_000);
    expect(refresh).not.toHaveBeenCalled();

    act(() => {
      hook.result.current.acquireHold();
    });
    act(() => {
      hook.result.current.releaseHold();
    });
    expect(refresh).not.toHaveBeenCalled();

    await act(async () => {
      hook.result.current.releaseHold();
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does not refresh on a release with nothing pending', async () => {
    const { refresh, hook } = setup();
    act(() => {
      hook.result.current.acquireHold();
    });
    await act(async () => {
      hook.result.current.releaseHold();
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('defers a trigger while the outbox is flushing and runs it when the flush ends', async () => {
    const { refresh, state } = setup();
    state.flushing = true;
    await advance(30_000);
    expect(refresh).not.toHaveBeenCalled();
    state.flushing = false;
    await notify(state.flushingListeners);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does not refresh when a flush ends with no deferred trigger', async () => {
    const { refresh, state } = setup();
    state.flushing = true;
    state.flushing = false;
    await notify(state.flushingListeners);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('waits for the last hold release when a flush ends while held', async () => {
    const { refresh, state, hook } = setup();
    state.flushing = true;
    await advance(30_000);
    act(() => {
      hook.result.current.acquireHold();
    });
    state.flushing = false;
    await notify(state.flushingListeners);
    expect(refresh).not.toHaveBeenCalled();
    await act(async () => {
      hook.result.current.releaseHold();
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('disables the poll with intervalMs 0 while focus and visibility still trigger', async () => {
    const { refresh } = setup({ intervalMs: 0 });
    await advance(120_000);
    expect(refresh).not.toHaveBeenCalled();
    await focusWindow();
    expect(refresh).toHaveBeenCalledTimes(1);
    await setVisibility('hidden');
    await setVisibility('visible');
    expect(refresh).toHaveBeenCalledTimes(2);
    await advance(120_000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('clears the interval and every listener on unmount', async () => {
    const before = vi.getTimerCount();
    const { refresh, state, hook } = setup();
    expect(vi.getTimerCount()).toBeGreaterThan(before);
    hook.unmount();
    expect(vi.getTimerCount()).toBe(before);
    expect(state.flushingListeners.size).toBe(0);
    expect(state.entryListeners.size).toBe(0);

    await focusWindow();
    await setVisibility('hidden');
    await setVisibility('visible');
    await advance(60_000);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('keeps acquireHold and releaseHold stable across re-renders', () => {
    const { hook } = setup();
    const first = hook.result.current;
    hook.rerender();
    expect(hook.result.current.acquireHold).toBe(first.acquireHold);
    expect(hook.result.current.releaseHold).toBe(first.releaseHold);
  });

  it('drops a result that lands while a hold is held and refreshes once on the last release', async () => {
    const gate = deferred<void>();
    const { refresh, hook } = setup({
      refresh: async ({ isUnchanged }) => {
        await gate.promise;
        return isUnchanged() ? 'done' : 'deferred';
      },
    });
    await focusWindow();
    expect(refresh).toHaveBeenCalledTimes(1);
    act(() => {
      hook.result.current.acquireHold();
    });
    await act(async () => {
      gate.resolve();
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => {
      hook.result.current.releaseHold();
    });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('re-pulls at once when a hold was taken and released during an in-flight refresh', async () => {
    const gate = deferred<void>();
    let results: RefreshResult[] = [];
    const { refresh, hook } = setup({
      refresh: async ({ isUnchanged }) => {
        await gate.promise;
        const result = isUnchanged() ? 'done' : 'deferred';
        results = [...results, result];
        return result;
      },
    });
    await focusWindow();
    act(() => {
      hook.result.current.acquireHold();
    });
    act(() => {
      hook.result.current.releaseHold();
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => {
      gate.resolve();
    });
    expect(results[0]).toBe('deferred');
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('defers triggers while the outbox has queued entries and runs once when it drains', async () => {
    const { refresh, state } = setup();
    state.entries = [queuedEntry];
    await advance(30_000);
    await focusWindow();
    expect(refresh).not.toHaveBeenCalled();
    state.entries = [];
    await notify(state.entryListeners);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('keeps refreshing after a refresh rejects', async () => {
    const { refresh } = setup({ refresh: () => Promise.reject(new Error('network')) });
    await focusWindow();
    await focusWindow();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('keeps refreshing after a refresh throws synchronously', async () => {
    const { refresh } = setup({
      refresh: () => {
        throw new Error('sync');
      },
    });
    await focusWindow();
    await focusWindow();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('runs a trigger gated during an in-flight refresh once that refresh settles', async () => {
    const gate = deferred<RefreshResult>();
    let calls = 0;
    const { refresh, state } = setup({
      refresh: () => (calls++ === 0 ? gate.promise : Promise.resolve('done')),
    });
    await focusWindow();
    state.entries = [queuedEntry];
    await focusWindow();
    state.entries = [];
    await notify(state.entryListeners);
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => {
      gate.resolve('done');
    });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('does not re-pull after unmount when an in-flight refresh resolves deferred', async () => {
    const gate = deferred<RefreshResult>();
    const { refresh, hook } = setup({ refresh: () => gate.promise });
    await focusWindow();
    hook.unmount();
    await act(async () => {
      gate.resolve('deferred');
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
