import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { addDays, startOfDay } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { useMidnightClock } from './useMidnightClock';

afterEach(() => {
  vi.useRealTimers();
});

function expectedMsUntilMidnight(nowMs: number, timezone: string): number {
  const zonedNow = toZonedTime(nowMs, timezone);
  const nextZonedMidnight = startOfDay(addDays(zonedNow, 1));
  const nextMidnightUtc = fromZonedTime(nextZonedMidnight, timezone);
  return nextMidnightUtc.getTime() - nowMs;
}

describe('useMidnightClock', () => {
  it('schedules the next tick at local midnight for the passed-in timezone, not the system/ambient one', () => {
    const fixedNow = new Date('2024-06-15T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    // UTC+14, the furthest-ahead IANA zone
    renderHook(() => useMidnightClock('Pacific/Kiritimati'));
    const kiritimatiDelay = setTimeoutSpy.mock.calls.at(-1)![1] as number;

    setTimeoutSpy.mockClear();

    // UTC-11, one of the furthest-behind IANA zones
    renderHook(() => useMidnightClock('Pacific/Niue'));
    const niueDelay = setTimeoutSpy.mock.calls.at(-1)![1] as number;

    expect(kiritimatiDelay).toBe(expectedMsUntilMidnight(fixedNow.getTime(), 'Pacific/Kiritimati'));
    expect(niueDelay).toBe(expectedMsUntilMidnight(fixedNow.getTime(), 'Pacific/Niue'));
    // These two extreme, far-apart zones must produce different delays — proof the
    // hook is actually keyed off the passed-in timezone, not coincidentally
    // matching whatever timezone the test runner's own host happens to be in.
    expect(kiritimatiDelay).not.toBe(niueDelay);
  });

  it('returns the current time and updates once the scheduled midnight timer fires', () => {
    const fixedNow = new Date('2024-06-15T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    const { result } = renderHook(() => useMidnightClock('UTC'));
    const initial = result.current;

    const delay = expectedMsUntilMidnight(fixedNow.getTime(), 'UTC');
    act(() => {
      vi.advanceTimersByTime(delay);
    });

    expect(result.current.getTime()).toBeGreaterThan(initial.getTime());
  });

  it('refreshes now shortly after the timezone changes post-mount', () => {
    const fixedNow = new Date('2024-06-15T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    const { result, rerender } = renderHook(({ tz }) => useMidnightClock(tz), {
      initialProps: { tz: 'America/Los_Angeles' },
    });
    const initial = result.current;

    vi.setSystemTime(new Date(fixedNow.getTime() + 5 * 60 * 1000));
    rerender({ tz: 'UTC' });
    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(result.current.getTime()).toBe(fixedNow.getTime() + 5 * 60 * 1000);
    expect(result.current.getTime()).toBeGreaterThan(initial.getTime());
  });

  it('does not refresh now on a same-timezone rerender', () => {
    const fixedNow = new Date('2024-06-15T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    const { result, rerender } = renderHook(({ tz }) => useMidnightClock(tz), {
      initialProps: { tz: 'UTC' },
    });
    const initial = result.current;

    vi.setSystemTime(new Date(fixedNow.getTime() + 5 * 60 * 1000));
    rerender({ tz: 'UTC' });
    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(result.current).toBe(initial);
  });

  it('leaves no timers after unmount, including after a timezone change', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));
    const before = vi.getTimerCount();

    const { rerender, unmount } = renderHook(({ tz }) => useMidnightClock(tz), {
      initialProps: { tz: 'UTC' },
    });
    expect(vi.getTimerCount()).toBeGreaterThan(before);

    rerender({ tz: 'Pacific/Niue' });
    expect(vi.getTimerCount()).toBeGreaterThan(before);

    unmount();
    expect(vi.getTimerCount()).toBe(before);
  });
});
