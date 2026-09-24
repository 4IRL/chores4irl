import { vi, describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTouchLock, INACTIVITY_MS } from '../../hooks/useTouchLock';

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

    it('exposes idleExpiries: 0 and a lock function on mount', () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useTouchLock());
        expect(result.current.idleExpiries).toBe(0);
        expect(typeof result.current.lock).toBe('function');
    });

    it('increments idleExpiries on the engaging expiry and again every INACTIVITY_MS while locked with no activity', () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useTouchLock());
        act(() => {
            vi.advanceTimersByTime(INACTIVITY_MS);
        });
        expect(result.current.isLocked).toBe(true);
        expect(result.current.idleExpiries).toBe(1);
        act(() => {
            vi.advanceTimersByTime(INACTIVITY_MS);
        });
        expect(result.current.idleExpiries).toBe(2);
        act(() => {
            vi.advanceTimersByTime(INACTIVITY_MS);
        });
        expect(result.current.idleExpiries).toBe(3);
        expect(result.current.isLocked).toBe(true);
    });

    it.each(['pointerdown', 'keydown'])('%s while locked postpones the next idle tick', (eventType) => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useTouchLock());
        act(() => {
            vi.advanceTimersByTime(INACTIVITY_MS);
        });
        expect(result.current.isLocked).toBe(true);
        expect(result.current.idleExpiries).toBe(1);

        act(() => {
            vi.advanceTimersByTime(INACTIVITY_MS - 1000);
        });
        act(() => {
            document.dispatchEvent(new Event(eventType));
        });
        // Activity never unlocks — only arm() does.
        expect(result.current.isLocked).toBe(true);

        // The tick that was due 1000 ms from now has been pushed back.
        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(result.current.idleExpiries).toBe(1);

        // A full INACTIVITY_MS after the activity, the next tick fires.
        act(() => {
            vi.advanceTimersByTime(INACTIVITY_MS - 1000);
        });
        expect(result.current.idleExpiries).toBe(2);
        expect(result.current.isLocked).toBe(true);
    });

    it('lock() engages immediately without incrementing idleExpiries and restarts the countdown', () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useTouchLock());
        act(() => {
            vi.advanceTimersByTime(60_000);
        });
        act(() => result.current.lock());
        expect(result.current.isLocked).toBe(true);
        expect(result.current.idleExpiries).toBe(0);

        act(() => {
            vi.advanceTimersByTime(INACTIVITY_MS - 1);
        });
        expect(result.current.idleExpiries).toBe(0);
        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(result.current.idleExpiries).toBe(1);
        expect(result.current.isLocked).toBe(true);
    });

    it('arm() does not increment idleExpiries', () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useTouchLock());
        act(() => {
            vi.advanceTimersByTime(INACTIVITY_MS);
        });
        expect(result.current.idleExpiries).toBe(1);
        act(() => result.current.arm());
        expect(result.current.isLocked).toBe(false);
        expect(result.current.idleExpiries).toBe(1);
    });

    it('clears the pending timer on unmount while locked', () => {
        vi.useFakeTimers();
        const { result, unmount } = renderHook(() => useTouchLock());
        act(() => {
            vi.advanceTimersByTime(INACTIVITY_MS);
        });
        expect(result.current.isLocked).toBe(true);
        const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
        unmount();
        expect(clearSpy).toHaveBeenCalled();
        // The spy alone passes even if the re-scheduled idle-tick timer leaks.
        expect(vi.getTimerCount()).toBe(0);
    });
});
