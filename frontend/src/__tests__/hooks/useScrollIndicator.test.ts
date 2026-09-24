import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, fireEvent } from '@testing-library/react';
import {
    computeThumbGeometry,
    useScrollIndicator,
    IDLE_FADE_MS,
    MIN_THUMB_PX,
} from '../../hooks/useScrollIndicator';

type Metrics = { scrollTop: number; scrollHeight: number; clientHeight: number };

/** jsdom's scrollHeight/clientHeight are read-only getters returning 0, so stub them per instance. */
function setMetrics(element: HTMLElement, { scrollTop, scrollHeight, clientHeight }: Metrics) {
    Object.defineProperty(element, 'scrollHeight', { value: scrollHeight, configurable: true });
    Object.defineProperty(element, 'clientHeight', { value: clientHeight, configurable: true });
    element.scrollTop = scrollTop;
}

describe('computeThumbGeometry', () => {
    it('returns null when the element is not scrollable or the track is empty', () => {
        expect(computeThumbGeometry(0, 400, 400)).toBeNull();
        expect(computeThumbGeometry(0, 300, 400)).toBeNull();
        expect(computeThumbGeometry(0, 1000, 20, 12, 12)).toBeNull();
        expect(computeThumbGeometry(0, 1000, 160, 0, 160)).toBeNull();
    });

    it('sizes the thumb as clientHeight² / scrollHeight and maps scrollTop onto the track', () => {
        expect(computeThumbGeometry(0, 1000, 400)).toEqual({ height: 160, top: 0 });
        expect(computeThumbGeometry(600, 1000, 400)).toEqual({ height: 160, top: 240 });
        expect(computeThumbGeometry(300, 1000, 400)?.top).toBe(120);
    });

    it('clamps the thumb to MIN_THUMB_PX, but never beyond the track', () => {
        expect(computeThumbGeometry(0, 100000, 400)?.height).toBe(MIN_THUMB_PX);
        expect(computeThumbGeometry(99600, 100000, 400)?.top).toBe(400 - MIN_THUMB_PX);
        expect(computeThumbGeometry(0, 1000, 40, 12, 12)).toEqual({ height: 16, top: 12 });
        expect(computeThumbGeometry(0, 1000, 170, 0, 160)).toEqual({ height: 10, top: 0 });
    });

    it('applies symmetric (form) and bottom-only (list) track insets', () => {
        const formTop = computeThumbGeometry(0, 1000, 400, 12, 12)!;
        expect(formTop.height).toBeCloseTo(150.4);
        expect(formTop.top).toBeCloseTo(12);
        const formEnd = computeThumbGeometry(600, 1000, 400, 12, 12)!;
        expect(formEnd.top).toBeCloseTo(237.6);

        expect(computeThumbGeometry(0, 1000, 400, 0, 160)).toEqual({ height: 96, top: 0 });
        expect(computeThumbGeometry(300, 1000, 400, 0, 160)?.top).toBe(72);
        const listEnd = computeThumbGeometry(600, 1000, 400, 0, 160)!;
        expect(listEnd.top).toBe(144);
        expect(listEnd.top + listEnd.height).toBe(400 - 160);
        expect(computeThumbGeometry(99600, 100000, 400, 0, 160)).toEqual({
            height: MIN_THUMB_PX,
            top: 240 - MIN_THUMB_PX,
        });
    });
});

describe('useScrollIndicator', () => {
    let scrollElement: HTMLDivElement;

    beforeEach(() => {
        scrollElement = document.createElement('div');
        document.body.appendChild(scrollElement);
    });

    afterEach(() => {
        scrollElement.remove();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('returns no geometry and is hidden when ref.current is null', () => {
        const ref = { current: null };
        const { result } = renderHook(() => useScrollIndicator(ref));
        expect(result.current).toEqual({ geometry: null, isVisible: false });
    });

    it('measures geometry on mount without becoming visible (no mount flash)', () => {
        setMetrics(scrollElement, { scrollTop: 0, scrollHeight: 1000, clientHeight: 400 });
        const ref = { current: scrollElement };
        const { result } = renderHook(() => useScrollIndicator(ref));
        expect(result.current.geometry).toEqual({ height: 160, top: 0 });
        expect(result.current.isVisible).toBe(false);
    });

    it('shows on scroll, tracks scrollTop, and hides IDLE_FADE_MS after the last scroll', () => {
        vi.useFakeTimers();
        try {
            setMetrics(scrollElement, { scrollTop: 0, scrollHeight: 1000, clientHeight: 400 });
            const ref = { current: scrollElement };
            const { result } = renderHook(() => useScrollIndicator(ref));

            scrollElement.scrollTop = 300;
            act(() => { fireEvent.scroll(scrollElement); });
            expect(result.current.isVisible).toBe(true);
            expect(result.current.geometry).toEqual({ height: 160, top: 120 });

            act(() => { vi.advanceTimersByTime(IDLE_FADE_MS - 1); });
            expect(result.current.isVisible).toBe(true);
            act(() => { vi.advanceTimersByTime(1); });
            expect(result.current.isVisible).toBe(false);
        } finally {
            vi.useRealTimers();
        }
    });

    it('restarts the idle timer on every scroll event', () => {
        vi.useFakeTimers();
        try {
            setMetrics(scrollElement, { scrollTop: 0, scrollHeight: 1000, clientHeight: 400 });
            const ref = { current: scrollElement };
            const { result } = renderHook(() => useScrollIndicator(ref));

            act(() => { fireEvent.scroll(scrollElement); });
            act(() => { vi.advanceTimersByTime(600); });
            act(() => { fireEvent.scroll(scrollElement); });
            expect(vi.getTimerCount()).toBe(1);

            act(() => { vi.advanceTimersByTime(IDLE_FADE_MS - 1); });
            expect(result.current.isVisible).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });

    it('adds a passive scroll listener, removes the same handler and clears the timer on unmount', () => {
        vi.useFakeTimers();
        try {
            setMetrics(scrollElement, { scrollTop: 0, scrollHeight: 1000, clientHeight: 400 });
            const addSpy = vi.spyOn(scrollElement, 'addEventListener');
            const removeSpy = vi.spyOn(scrollElement, 'removeEventListener');
            const ref = { current: scrollElement };
            const { unmount } = renderHook(() => useScrollIndicator(ref));

            const scrollCall = addSpy.mock.calls.find(([eventType]) => eventType === 'scroll');
            expect(scrollCall).toBeDefined();
            expect(scrollCall![2]).toEqual({ passive: true });
            const handler = scrollCall![1];

            act(() => { fireEvent.scroll(scrollElement); });
            expect(vi.getTimerCount()).toBe(1);

            unmount();

            expect(removeSpy).toHaveBeenCalledWith('scroll', handler);
            expect(vi.getTimerCount()).toBe(0);
        } finally {
            vi.useRealTimers();
        }
    });

    it('observes the element and its children with ResizeObserver, re-measures, and disconnects', () => {
        const observedTargets: Element[] = [];
        let resizeCallback: (() => void) | null = null;
        const disconnectSpy = vi.fn();
        class FakeResizeObserver {
            constructor(callback: () => void) {
                resizeCallback = callback;
            }
            observe(target: Element) {
                observedTargets.push(target);
            }
            unobserve() {}
            disconnect = disconnectSpy;
        }
        vi.stubGlobal('ResizeObserver', FakeResizeObserver);

        const firstChild = document.createElement('div');
        const secondChild = document.createElement('div');
        scrollElement.append(firstChild, secondChild);
        setMetrics(scrollElement, { scrollTop: 0, scrollHeight: 1000, clientHeight: 400 });
        const ref = { current: scrollElement };
        const { result, unmount } = renderHook(() => useScrollIndicator(ref));

        expect(observedTargets).toEqual([scrollElement, firstChild, secondChild]);
        expect(result.current.geometry).toEqual({ height: 160, top: 0 });

        Object.defineProperty(scrollElement, 'scrollHeight', { value: 2000, configurable: true });
        act(() => { resizeCallback!(); });
        expect(result.current.geometry).toEqual({ height: 80, top: 0 });

        unmount();
        expect(disconnectSpy).toHaveBeenCalled();
    });

    it('does not throw when ResizeObserver is unavailable (jsdom default)', () => {
        expect(typeof ResizeObserver).toBe('undefined');
        setMetrics(scrollElement, { scrollTop: 0, scrollHeight: 1000, clientHeight: 400 });
        const ref = { current: scrollElement };
        expect(() => renderHook(() => useScrollIndicator(ref))).not.toThrow();
    });
});
