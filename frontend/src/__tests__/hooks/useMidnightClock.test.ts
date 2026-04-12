import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, afterEach } from 'vitest';
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

    it('clears the timer on unmount', () => {
        vi.useFakeTimers();
        const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
        const { unmount } = renderHook(() => useMidnightClock());
        unmount();
        expect(clearSpy).toHaveBeenCalled();
    });
});
