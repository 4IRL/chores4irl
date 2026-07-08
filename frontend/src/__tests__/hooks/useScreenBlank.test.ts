import { vi, describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { isWithinBlankWindow, nextBoundary, useScreenBlank } from '../../hooks/useScreenBlank';

describe('isWithinBlankWindow', () => {
    it('returns false at 20:59 (just before the window opens)', () => {
        expect(isWithinBlankWindow(new Date(2025, 0, 15, 20, 59, 0))).toBe(false);
    });

    it('returns true at 21:00 (window opens)', () => {
        expect(isWithinBlankWindow(new Date(2025, 0, 15, 21, 0, 0))).toBe(true);
    });

    it('returns true at 23:59', () => {
        expect(isWithinBlankWindow(new Date(2025, 0, 15, 23, 59, 0))).toBe(true);
    });

    it('returns true at 00:00', () => {
        expect(isWithinBlankWindow(new Date(2025, 0, 15, 0, 0, 0))).toBe(true);
    });

    it('returns true at 05:59', () => {
        expect(isWithinBlankWindow(new Date(2025, 0, 15, 5, 59, 0))).toBe(true);
    });

    it('returns false at 06:00 (window closes)', () => {
        expect(isWithinBlankWindow(new Date(2025, 0, 15, 6, 0, 0))).toBe(false);
    });

    it('returns false at 12:00 (midday)', () => {
        expect(isWithinBlankWindow(new Date(2025, 0, 15, 12, 0, 0))).toBe(false);
    });
});

describe('nextBoundary', () => {
    it('from midday, returns today at 21:00 (next blank-start)', () => {
        const result = nextBoundary(new Date(2025, 0, 15, 12, 0, 0));
        expect(result).toEqual(new Date(2025, 0, 15, 21, 0, 0));
    });

    it('from 23:30, returns tomorrow at 06:00 (next wake, crossing midnight)', () => {
        const result = nextBoundary(new Date(2025, 0, 15, 23, 30, 0));
        expect(result).toEqual(new Date(2025, 0, 16, 6, 0, 0));
    });

    it('from 02:00 (already inside window), returns today at 06:00', () => {
        const result = nextBoundary(new Date(2025, 0, 15, 2, 0, 0));
        expect(result).toEqual(new Date(2025, 0, 15, 6, 0, 0));
    });

    it('exactly on the blank boundary (21:00:00.000), returns tomorrow at 06:00', () => {
        const result = nextBoundary(new Date(2025, 0, 15, 21, 0, 0, 0));
        expect(result).toEqual(new Date(2025, 0, 16, 6, 0, 0));
    });

    it('exactly on the wake boundary (06:00:00.000), returns today at 21:00', () => {
        const result = nextBoundary(new Date(2025, 0, 15, 6, 0, 0, 0));
        expect(result).toEqual(new Date(2025, 0, 15, 21, 0, 0));
    });
});

describe('useScreenBlank', () => {
    afterEach(() => vi.useRealTimers());

    it('initializes isBlanked: true when now is 23:30 (inside window, no wake yet)', () => {
        vi.useFakeTimers({ now: new Date(2025, 0, 15, 23, 30, 0) });
        const { result } = renderHook(() => useScreenBlank());
        expect(result.current.isBlanked).toBe(true);
    });

    it('initializes isBlanked: false when now is 12:00 (outside window)', () => {
        vi.useFakeTimers({ now: new Date(2025, 0, 15, 12, 0, 0) });
        const { result } = renderHook(() => useScreenBlank());
        expect(result.current.isBlanked).toBe(false);
    });

    it('flips isBlanked to true when advancing timers crosses 21:00', async () => {
        vi.useFakeTimers({ now: new Date(2025, 0, 15, 20, 59, 59) });
        const { result } = renderHook(() => useScreenBlank());
        expect(result.current.isBlanked).toBe(false);
        await act(async () => { vi.advanceTimersByTime(1000); });
        expect(result.current.isBlanked).toBe(true);
    });

    it('flips isBlanked to false when advancing timers crosses 06:00', async () => {
        vi.useFakeTimers({ now: new Date(2025, 0, 15, 5, 59, 59) });
        const { result } = renderHook(() => useScreenBlank());
        expect(result.current.isBlanked).toBe(true);
        await act(async () => { vi.advanceTimersByTime(1000); });
        expect(result.current.isBlanked).toBe(false);
    });

    it('clears the pending timer on unmount', () => {
        vi.useFakeTimers({ now: new Date(2025, 0, 15, 12, 0, 0) });
        const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
        const { unmount } = renderHook(() => useScreenBlank());
        unmount();
        expect(clearSpy).toHaveBeenCalled();
    });
});
