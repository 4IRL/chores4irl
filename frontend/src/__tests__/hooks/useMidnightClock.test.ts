import { vi, describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMidnightClock } from '../../hooks/useMidnightClock';
import { startOfDay, addDays } from 'date-fns';

describe('useMidnightClock', () => {
    afterEach(() => vi.useRealTimers());

    it('initializes to the current real date', () => {
        const fixedNow = new Date(2025, 0, 15, 14, 30, 0);
        vi.useFakeTimers({ now: fixedNow });
        const { result } = renderHook(() => useMidnightClock());
        expect(result.current.toDateString()).toBe(fixedNow.toDateString());
    });

    it('advances to the next day after midnight fires', async () => {
        const fixedNow = new Date(2025, 0, 15, 23, 59, 0);
        vi.useFakeTimers({ now: fixedNow });
        const { result } = renderHook(() => useMidnightClock());
        const nextMidnight = startOfDay(addDays(fixedNow, 1));
        const msUntilMidnight = nextMidnight.getTime() - fixedNow.getTime();
        await act(async () => { vi.advanceTimersByTime(msUntilMidnight + 1); });
        expect(result.current.toDateString()).toBe(nextMidnight.toDateString());
    });

    it('re-arms and advances a second time after the second midnight', async () => {
        const fixedNow = new Date(2025, 0, 15, 23, 59, 0);
        vi.useFakeTimers({ now: fixedNow });
        const { result } = renderHook(() => useMidnightClock());

        // First midnight: Jan 15 → Jan 16
        const firstMidnight = startOfDay(addDays(fixedNow, 1));
        const msToFirstMidnight = firstMidnight.getTime() - fixedNow.getTime();
        await act(async () => { vi.advanceTimersByTime(msToFirstMidnight + 1); });
        expect(result.current.toDateString()).toBe(firstMidnight.toDateString());

        // Second midnight: Jan 16 → Jan 17 (confirms [now] dep re-arms the timer)
        const secondMidnight = startOfDay(addDays(firstMidnight, 1));
        const msToSecondMidnight = secondMidnight.getTime() - firstMidnight.getTime();
        await act(async () => { vi.advanceTimersByTime(msToSecondMidnight); });
        expect(result.current.toDateString()).toBe(secondMidnight.toDateString());
    });

    it('clears the timer on unmount', () => {
        vi.useFakeTimers();
        const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
        const { unmount } = renderHook(() => useMidnightClock());
        unmount();
        expect(clearSpy).toHaveBeenCalled();
    });
});
