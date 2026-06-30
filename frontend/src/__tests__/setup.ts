import '@testing-library/jest-dom';

// jsdom does not implement EventSource. Provide a minimal no-op stand-in so
// components that open a stream on mount (App via useChoreEvents) don't throw.
// Tests that need to drive the stream install their own fake via vi.stubGlobal.
if (typeof globalThis.EventSource === 'undefined') {
    class NoopEventSource {
        close() {}
        addEventListener() {}
        removeEventListener() {}
    }
    globalThis.EventSource = NoopEventSource as unknown as typeof EventSource;
}
