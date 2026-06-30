import { EventEmitter } from 'node:events';

/**
 * In-process event bus for chore mutations.
 *
 * Because the single Express process owns the SQLite file, every write flows
 * through here — so a successful mutation is a precise moment to notify all
 * connected SSE clients to re-pull. The payload is intentionally trivial: the
 * event is only a doorbell ("something changed"), and clients re-fetch the
 * full list from GET /api/chores. No broker is needed for one process.
 */
export const choreEvents = new EventEmitter();

// One listener per connected device's SSE stream; raise the default cap of 10
// to a household's worth of devices so Node doesn't warn about a "leak".
choreEvents.setMaxListeners(50);

export const CHORE_CHANGED = 'changed';
