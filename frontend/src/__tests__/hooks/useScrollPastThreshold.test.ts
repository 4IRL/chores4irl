import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, fireEvent } from '@testing-library/react';
import { useScrollPastThreshold } from '../../hooks/useScrollPastThreshold';

describe('useScrollPastThreshold', () => {
    let scrollElement: HTMLDivElement;

    beforeEach(() => {
        scrollElement = document.createElement('div');
        document.body.appendChild(scrollElement);
    });

    afterEach(() => {
        scrollElement.remove();
        vi.restoreAllMocks();
    });

    const scrollTo = (scrollTop: number) => {
        scrollElement.scrollTop = scrollTop;
        act(() => { fireEvent.scroll(scrollElement); });
    };

    it('returns false when scrollTop is 0', () => {
        const ref = { current: scrollElement };
        const { result } = renderHook(() => useScrollPastThreshold(ref, 80));
        expect(result.current).toBe(false);
    });

    it('returns true once scrolled past the threshold', () => {
        const ref = { current: scrollElement };
        const { result } = renderHook(() => useScrollPastThreshold(ref, 80));
        scrollTo(81);
        expect(result.current).toBe(true);
    });

    it('returns false at exactly the threshold (strictly greater than)', () => {
        const ref = { current: scrollElement };
        const { result } = renderHook(() => useScrollPastThreshold(ref, 80));
        scrollTo(80);
        expect(result.current).toBe(false);
    });

    it('returns false again after scrolling back below the threshold', () => {
        const ref = { current: scrollElement };
        const { result } = renderHook(() => useScrollPastThreshold(ref, 80));
        scrollTo(81);
        expect(result.current).toBe(true);
        scrollTo(10);
        expect(result.current).toBe(false);
    });

    it('reads the initial scroll position on mount', () => {
        scrollElement.scrollTop = 200;
        const ref = { current: scrollElement };
        const { result } = renderHook(() => useScrollPastThreshold(ref, 80));
        expect(result.current).toBe(true);
    });

    it('returns false and does not throw when ref.current is null', () => {
        const ref = { current: null };
        const { result } = renderHook(() => useScrollPastThreshold(ref, 80));
        expect(result.current).toBe(false);
    });

    it('re-reads the position when the threshold changes', () => {
        scrollElement.scrollTop = 100;
        const ref = { current: scrollElement };
        const { result, rerender } = renderHook(
            ({ thresholdPx }) => useScrollPastThreshold(ref, thresholdPx),
            { initialProps: { thresholdPx: 80 } },
        );
        expect(result.current).toBe(true);
        rerender({ thresholdPx: 150 });
        expect(result.current).toBe(false);
    });

    it('removes the same scroll listener on unmount', () => {
        const addSpy = vi.spyOn(scrollElement, 'addEventListener');
        const removeSpy = vi.spyOn(scrollElement, 'removeEventListener');
        const ref = { current: scrollElement };
        const { unmount } = renderHook(() => useScrollPastThreshold(ref, 80));

        const scrollCall = addSpy.mock.calls.find(([eventType]) => eventType === 'scroll');
        expect(scrollCall).toBeDefined();
        const handler = scrollCall![1];

        unmount();

        expect(removeSpy).toHaveBeenCalledWith('scroll', handler);
    });
});
