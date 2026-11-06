import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScrollPastThreshold } from './useScrollPastThreshold';

function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', { value, configurable: true });
}

function scrollTo(value: number) {
  act(() => {
    setScrollY(value);
    window.dispatchEvent(new Event('scroll'));
  });
}

afterEach(() => {
  setScrollY(0);
});

describe('useScrollPastThreshold', () => {
  it('is false at 80 and true at 81, flipping back on scroll up', () => {
    setScrollY(0);
    const { result } = renderHook(() => useScrollPastThreshold());
    expect(result.current).toBe(false);
    scrollTo(80);
    expect(result.current).toBe(false);
    scrollTo(81);
    expect(result.current).toBe(true);
    scrollTo(10);
    expect(result.current).toBe(false);
  });

  it('reads the initial position on mount', () => {
    setScrollY(500);
    const { result } = renderHook(() => useScrollPastThreshold());
    expect(result.current).toBe(true);
  });

  it('adds a passive scroll listener and removes the same function on unmount', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useScrollPastThreshold());
    const added = add.mock.calls.find((c) => c[0] === 'scroll');
    expect(added?.[2]).toEqual({ passive: true });
    unmount();
    const removed = remove.mock.calls.find((c) => c[0] === 'scroll');
    expect(removed?.[1]).toBe(added?.[1]);
    add.mockRestore();
    remove.mockRestore();
  });

  it('honours a custom threshold', () => {
    setScrollY(0);
    const { result } = renderHook(() => useScrollPastThreshold(200));
    scrollTo(200);
    expect(result.current).toBe(false);
    scrollTo(201);
    expect(result.current).toBe(true);
  });

  it('does not re-render on scrolls that do not cross the threshold', () => {
    setScrollY(0);
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useScrollPastThreshold();
    });
    const before = renders;
    scrollTo(10);
    scrollTo(40);
    scrollTo(80);
    expect(renders).toBe(before);
    scrollTo(200);
    expect(result.current).toBe(true);
    expect(renders).toBeGreaterThan(before);
  });
});
