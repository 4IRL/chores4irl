import { vi } from 'vitest';

export type Listener = (ev: unknown) => void;

// jsdom has no EventSource. This controllable fake lets a test dispatch
// message/open events, drive the visibilitychange path, and spy on close().
// Shared by the hook unit tests and the App integration tests.
export class FakeEventSource {
    static instances: FakeEventSource[] = [];
    url: string;
    listeners: Record<string, Set<Listener>> = {};
    close = vi.fn();

    constructor(url: string) {
        this.url = url;
        FakeEventSource.instances.push(this);
    }
    addEventListener(type: string, cb: Listener) {
        (this.listeners[type] ??= new Set()).add(cb);
    }
    removeEventListener(type: string, cb: Listener) {
        this.listeners[type]?.delete(cb);
    }
    emit(type: string, ev: unknown = {}) {
        this.listeners[type]?.forEach(cb => cb(ev));
    }
}

export const lastFakeSource = () =>
    FakeEventSource.instances[FakeEventSource.instances.length - 1];
