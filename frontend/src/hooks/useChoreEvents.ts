import { useEffect, useRef } from 'react';

/**
 * Subscribe to the backend's Server-Sent Events stream and invoke `onChange`
 * whenever the server signals that chores changed — the client then re-pulls
 * the current truth from GET /api/chores.
 *
 * `onChange` is held in a ref so a changing callback identity (it closes over
 * React state) never tears down and reopens the stream. The caller owns any
 * gating/deferral of the actual re-pull; this hook only forwards signals.
 *
 * Fires on three triggers:
 *  - `message`: a "changed" doorbell from a write on any device.
 *  - `open`: initial connect and every automatic reconnect — recovers events
 *    that may have been missed while the stream was down.
 *  - tab `visibilitychange → visible`: phones suspend the EventSource while
 *    backgrounded; re-sync on return to foreground.
 */
export function useChoreEvents(onChange: () => void): void {
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    useEffect(() => {
        const source = new EventSource('/api/events');
        const handle = () => onChangeRef.current();
        source.addEventListener('message', handle);
        source.addEventListener('open', handle);

        const onVisible = () => {
            if (document.visibilityState === 'visible') onChangeRef.current();
        };
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            source.removeEventListener('message', handle);
            source.removeEventListener('open', handle);
            document.removeEventListener('visibilitychange', onVisible);
            source.close();
        };
    }, []);
}
