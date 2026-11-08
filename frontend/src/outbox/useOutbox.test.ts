import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createOutbox } from './outbox';
import { useOutbox } from './useOutbox';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('navigator', { ...navigator, onLine: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useOutbox', () => {
  it('reflects the current outbox entries and updates on append', () => {
    const instance = createOutbox(vi.fn());
    const { result } = renderHook(() => useOutbox(instance));

    expect(result.current.entries).toHaveLength(0);

    act(() => {
      result.current.append({ type: 'delete', choreId: 1 });
    });

    expect(result.current.entries).toHaveLength(1);
    instance.dispose();
  });

  it('updates when entries are removed after a successful flush', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ success: true, data: null }))),
    );
    const instance = createOutbox(fetchImpl);
    const { result } = renderHook(() => useOutbox(instance));

    act(() => {
      result.current.append({ type: 'delete', choreId: 1 });
    });
    expect(result.current.entries).toHaveLength(1);

    await act(async () => {
      await result.current.flush();
    });

    expect(result.current.entries).toHaveLength(0);
    instance.dispose();
  });

  it('re-exports remove, which cancels a queued entry and updates entries', () => {
    const instance = createOutbox(vi.fn());
    const { result } = renderHook(() => useOutbox(instance));
    let id = '';
    act(() => {
      id = result.current.append({ type: 'delete', choreId: 1 }).id;
    });
    expect(result.current.entries).toHaveLength(1);
    let removed = false;
    act(() => {
      removed = result.current.remove(id);
    });
    expect(removed).toBe(true);
    expect(result.current.entries).toHaveLength(0);
    instance.dispose();
  });

  it('invokes onFlushResults with the outcome once a flush completes', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ success: true, data: { id: 7 } }))),
    );
    const instance = createOutbox(fetchImpl);
    const onFlushResults = vi.fn();
    const { result } = renderHook(() => useOutbox(instance, onFlushResults));

    act(() => {
      result.current.append({ type: 'delete', choreId: 1 });
    });
    await act(async () => {
      await result.current.flush();
    });

    expect(onFlushResults).toHaveBeenCalledWith([
      expect.objectContaining({ outcome: 'success', data: { id: 7 } }),
    ]);
    instance.dispose();
  });
});
