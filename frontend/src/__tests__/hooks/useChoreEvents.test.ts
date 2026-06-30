import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useChoreEvents } from '../../hooks/useChoreEvents';
import { FakeEventSource, lastFakeSource as lastSource } from '../fixtures/fakeEventSource';

beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource as unknown as typeof EventSource);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('useChoreEvents', () => {
    it('opens an EventSource against /api/events on mount', () => {
        const onChange = vi.fn();
        renderHook(() => useChoreEvents(onChange));

        expect(FakeEventSource.instances).toHaveLength(1);
        expect(lastSource().url).toBe('/api/events');
    });

    it('invokes the callback when a message frame arrives', () => {
        const onChange = vi.fn();
        renderHook(() => useChoreEvents(onChange));

        lastSource().emit('message');

        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('invokes the callback on open (covers refetch-after-reconnect)', () => {
        const onChange = vi.fn();
        renderHook(() => useChoreEvents(onChange));

        lastSource().emit('open');

        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('invokes the callback when the tab becomes visible again', () => {
        const onChange = vi.fn();
        renderHook(() => useChoreEvents(onChange));

        document.dispatchEvent(new Event('visibilitychange'));

        // jsdom reports visibilityState 'visible' by default.
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('does NOT invoke the callback when visibility flips to hidden', () => {
        const onChange = vi.fn();
        renderHook(() => useChoreEvents(onChange));

        const original = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
        try {
            document.dispatchEvent(new Event('visibilitychange'));
            expect(onChange).not.toHaveBeenCalled();
        } finally {
            if (original) Object.defineProperty(document, 'visibilityState', original);
        }
    });

    it('uses the latest callback without reopening the stream', () => {
        const first = vi.fn();
        const second = vi.fn();
        const { rerender } = renderHook(({ cb }) => useChoreEvents(cb), {
            initialProps: { cb: first },
        });

        rerender({ cb: second });
        lastSource().emit('message');

        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
        // Still the same single stream — no reconnect churn.
        expect(FakeEventSource.instances).toHaveLength(1);
    });

    it('closes the stream and detaches handlers on unmount', () => {
        const onChange = vi.fn();
        const { unmount } = renderHook(() => useChoreEvents(onChange));
        const source = lastSource();

        unmount();

        expect(source.close).toHaveBeenCalledTimes(1);
        // A late frame after unmount must not call back.
        source.emit('message');
        document.dispatchEvent(new Event('visibilitychange'));
        expect(onChange).not.toHaveBeenCalled();
    });
});
