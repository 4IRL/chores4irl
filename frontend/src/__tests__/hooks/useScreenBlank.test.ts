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

    it('flips isBlanked correctly across two full day/night cycles within one hook lifetime', async () => {
        vi.useFakeTimers({ now: new Date(2025, 0, 15, 20, 59, 59) });
        const { result } = renderHook(() => useScreenBlank());
        expect(result.current.isBlanked).toBe(false);

        await act(async () => { vi.advanceTimersByTime(1000); }); // -> 21:00:00, blank window opens
        expect(result.current.isBlanked).toBe(true);

        await act(async () => { vi.advanceTimersByTime(9 * 60 * 60 * 1000); }); // -> 06:00:00 next day, window closes
        expect(result.current.isBlanked).toBe(false);

        await act(async () => { vi.advanceTimersByTime(15 * 60 * 60 * 1000); }); // -> 21:00:00, window opens again
        expect(result.current.isBlanked).toBe(true);
    });

    it('clears the pending timer on unmount', () => {
        vi.useFakeTimers({ now: new Date(2025, 0, 15, 12, 0, 0) });
        const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
        const { unmount } = renderHook(() => useScreenBlank());
        unmount();
        expect(clearSpy).toHaveBeenCalled();
    });

    it('wake() flips isBlanked to false immediately while inWindow', () => {
        vi.useFakeTimers({ now: new Date(2025, 0, 15, 23, 0, 0) });
        const { result } = renderHook(() => useScreenBlank());
        expect(result.current.isBlanked).toBe(true);
        act(() => result.current.wake());
        expect(result.current.isBlanked).toBe(false);
    });

    it('re-blanks after 5 minutes of inactivity following wake()', () => {
        vi.useFakeTimers({ now: new Date(2025, 0, 15, 23, 0, 0) });
        const { result } = renderHook(() => useScreenBlank());
        act(() => result.current.wake());
        expect(result.current.isBlanked).toBe(false);
        act(() => { vi.advanceTimersByTime(5 * 60 * 1000); });
        expect(result.current.isBlanked).toBe(true);
    });

    it('pointerdown activity resets the inactivity timer', () => {
        vi.useFakeTimers({ now: new Date(2025, 0, 15, 23, 0, 0) });
        const { result } = renderHook(() => useScreenBlank());
        act(() => result.current.wake());
        act(() => { vi.advanceTimersByTime(4 * 60 * 1000); });
        act(() => { document.dispatchEvent(new Event('pointerdown')); });
        act(() => { vi.advanceTimersByTime(4 * 60 * 1000); });
        expect(result.current.isBlanked).toBe(false);
    });

    it('keydown activity resets the inactivity timer', () => {
        vi.useFakeTimers({ now: new Date(2025, 0, 15, 23, 0, 0) });
        const { result } = renderHook(() => useScreenBlank());
        act(() => result.current.wake());
        act(() => { vi.advanceTimersByTime(4 * 60 * 1000); });
        act(() => { document.dispatchEvent(new Event('keydown')); });
        act(() => { vi.advanceTimersByTime(4 * 60 * 1000); });
        expect(result.current.isBlanked).toBe(false);
    });

    it('stays awake through successive activity events spaced under 5 minutes apart, then blanks 5 minutes after the last one', () => {
        vi.useFakeTimers({ now: new Date(2025, 0, 15, 23, 0, 0) });
        const { result } = renderHook(() => useScreenBlank());
        act(() => result.current.wake());
        expect(result.current.isBlanked).toBe(false);

        act(() => { vi.advanceTimersByTime(4 * 60 * 1000); });
        act(() => { document.dispatchEvent(new Event('pointerdown')); });
        expect(result.current.isBlanked).toBe(false);

        act(() => { vi.advanceTimersByTime(4 * 60 * 1000); });
        act(() => { document.dispatchEvent(new Event('keydown')); });
        expect(result.current.isBlanked).toBe(false);

        act(() => { vi.advanceTimersByTime(4 * 60 * 1000); });
        act(() => { document.dispatchEvent(new Event('pointerdown')); });
        expect(result.current.isBlanked).toBe(false);

        // No further activity after the last event — isBlanked should stay false
        // until a full 5 minutes have passed since that last event, not the first.
        act(() => { vi.advanceTimersByTime(4 * 60 * 1000); });
        expect(result.current.isBlanked).toBe(false);
        act(() => { vi.advanceTimersByTime(60 * 1000); });
        expect(result.current.isBlanked).toBe(true);
    });

    it('outside the window, isBlanked stays false regardless of wake() or inactivity', () => {
        vi.useFakeTimers({ now: new Date(2025, 0, 15, 12, 0, 0) });
        const { result } = renderHook(() => useScreenBlank());
        act(() => result.current.wake());
        expect(result.current.isBlanked).toBe(false);
        act(() => { vi.advanceTimersByTime(5 * 60 * 1000); });
        expect(result.current.isBlanked).toBe(false);
    });

    it('clears the inactivity timer when the window ends while awake', () => {
        vi.useFakeTimers({ now: new Date(2025, 0, 15, 5, 59, 59) });
        const { result, unmount } = renderHook(() => useScreenBlank());
        act(() => result.current.wake());
        act(() => { vi.advanceTimersByTime(1000); });
        expect(result.current.isBlanked).toBe(false);
        const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
        unmount();
        expect(clearSpy).toHaveBeenCalled();
    });

    it('resyncs on visibilitychange without waiting for a stale pending timer', () => {
        vi.useFakeTimers({ now: new Date(2025, 0, 15, 23, 0, 0) });
        const { result } = renderHook(() => useScreenBlank());
        expect(result.current.isBlanked).toBe(true);
        vi.setSystemTime(new Date(2025, 0, 16, 6, 30, 0));
        Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
        act(() => { document.dispatchEvent(new Event('visibilitychange')); });
        expect(result.current.isBlanked).toBe(false);
    });

    it('resyncs on visibilitychange to re-blank when the clock crosses 21:00 while hidden', () => {
        vi.useFakeTimers({ now: new Date(2025, 0, 15, 12, 0, 0) });
        const { result } = renderHook(() => useScreenBlank());
        expect(result.current.isBlanked).toBe(false);
        vi.setSystemTime(new Date(2025, 0, 15, 23, 0, 0));
        Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
        act(() => { document.dispatchEvent(new Event('visibilitychange')); });
        expect(result.current.isBlanked).toBe(true);
    });
});
