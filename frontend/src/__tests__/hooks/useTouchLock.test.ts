import { vi, describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTouchLock } from '../../hooks/useTouchLock';

describe('useTouchLock', () => {
    afterEach(() => vi.useRealTimers());

    it('initializes isLocked: false immediately after mount', () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useTouchLock());
        expect(result.current.isLocked).toBe(false);
    });

    it('locks after 5 minutes of inactivity following mount', () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useTouchLock());
        act(() => {
            vi.advanceTimersByTime(5 * 60 * 1000);
        });
        expect(result.current.isLocked).toBe(true);
    });

    it('pointerdown activity resets the inactivity countdown', () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useTouchLock());
        act(() => {
            vi.advanceTimersByTime(4 * 60 * 1000);
        });
        act(() => {
            document.dispatchEvent(new Event('pointerdown'));
        });
        // Advancing the remaining original time (1 more minute) should not lock —
        // only a full fresh 5 minutes of silence after the last event does.
        act(() => {
            vi.advanceTimersByTime(1 * 60 * 1000);
        });
        expect(result.current.isLocked).toBe(false);
        act(() => {
            vi.advanceTimersByTime(4 * 60 * 1000);
        });
        expect(result.current.isLocked).toBe(true);
    });

    it('keydown activity resets the inactivity countdown', () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useTouchLock());
        act(() => {
            vi.advanceTimersByTime(4 * 60 * 1000);
        });
        act(() => {
            document.dispatchEvent(new Event('keydown'));
        });
        act(() => {
            vi.advanceTimersByTime(1 * 60 * 1000);
        });
        expect(result.current.isLocked).toBe(false);
        act(() => {
            vi.advanceTimersByTime(4 * 60 * 1000);
        });
        expect(result.current.isLocked).toBe(true);
    });

    it('arm() flips isLocked back to false while locked and restarts the countdown', () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useTouchLock());
        act(() => {
            vi.advanceTimersByTime(5 * 60 * 1000);
        });
        expect(result.current.isLocked).toBe(true);

        act(() => result.current.arm());
        expect(result.current.isLocked).toBe(false);

        // Restarted countdown: not yet locked after 4 minutes...
        act(() => {
            vi.advanceTimersByTime(4 * 60 * 1000);
        });
        expect(result.current.isLocked).toBe(false);

        // ...but locked once a full fresh 5 minutes have elapsed since arm().
        act(() => {
            vi.advanceTimersByTime(1 * 60 * 1000);
        });
        expect(result.current.isLocked).toBe(true);
    });

    it('clears the pending timer on unmount', () => {
        vi.useFakeTimers();
        const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
        const { unmount } = renderHook(() => useTouchLock());
        unmount();
        expect(clearSpy).toHaveBeenCalled();
    });
});
