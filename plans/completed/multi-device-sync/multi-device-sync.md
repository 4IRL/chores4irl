> **STATUS: Merged** `42040cc` (#21). Frozen — historical record, do not edit.
> **Outcome:** Shipped as planned — in-process `EventEmitter` on the backend emits a
> `changed` event on every successful write; `GET /api/events` streams an SSE doorbell;
> the frontend `useChoreEvents` hook + gated `reconcileChores` re-pull in `App.tsx` keep
> all devices in sync. **Interface later features inherit:** any new write path must emit
> on the bus, and any new `App.tsx` state holding uncommitted/optimistic input must be
> added to `isRepullGated()` so a stray signal can't clobber it (see META-PLAN Baseline
> invariant 5). Now part of the Baseline for every remaining frontend feature.

# Multi-Device Sync (Event-Driven, On-Demand Re-pull)

## Summary
Keep every connected device — the Pi kiosk display and any phones/tablets — showing the latest chore data, regardless of which device made the change. Today the frontend loads chores **once on mount** and never re-reads, so a change made on a phone is written to SQLite correctly but is never reflected on the Pi (or any other device) until that browser reloads — which a kiosk never does.

The fix is **event-driven push, not periodic polling**: because every write from every device flows through the single Express process that owns the SQLite file, the backend already knows the instant any chore changes. We add a **Server-Sent Events (SSE)** stream — `GET /api/events` — that the backend pushes a lightweight "chores changed" signal onto whenever a mutating request succeeds. Each connected client holds an `EventSource` to that stream and, on each signal, calls the existing `fetchAllChores()` to re-pull the current truth and reconcile it into state. The result is **on-demand sync responsive to any DB change**, with no fixed latency and no wasted request volume.

This is a "notify, then re-pull" design: the event carries only a signal (not a diff), and the client re-fetches the full list. That keeps a single source of truth (`GET /api/chores`), is robust to coalesced/missed events, and reuses the entire existing wire/parse layer unchanged.

## Research Findings

- **The bug is a single missing refetch path.** `frontend/src/App.tsx:32-43` runs `fetchAllChores()` inside a `useEffect(..., [])` with an empty dependency array — it fires exactly once, on mount. After that, `choreData` (`App.tsx:23`) is only mutated by the *same device's* own handlers (`handleAddChore` `:67`, `handleDeleteChore` `:78`, `handleCompleteChore` `:107`, `handleEditChore` `:132`). No other device's write can enter this state. The Pi kiosk holds whatever it fetched at boot.

- **The backend is a single process and the perfect emit point.** `backend/src/app.ts` is a plain REST API; `backend/src/chores.ts` performs every read/write against one in-process `better-sqlite3` database (WAL mode). Crucially, **all four mutations (`createChore` `:36`, `completeChore` `:55`, `updateChore` `:61`, `deleteChore` `:85`) are invoked from route handlers in this one process** — so a successful write is a precise, in-band moment we can emit an event from. There is no second writer to miss (the only out-of-band writer is the backup restore, an admin action — see Out of Scope). This is why an in-memory `EventEmitter` is sufficient: no Redis/broker needed, because one process owns both the DB and every client connection.

- **SSE fits the access pattern better than WebSockets.** Clients only need to *receive* "something changed" — writes still go through the existing REST endpoints. SSE is one-directional (server→client) over plain HTTP, and the browser `EventSource` API reconnects automatically on drop with no client code. WebSockets would add a bidirectional channel and handshake we don't need.

- **The wire/parse layer is fully reusable.** `frontend/src/services/choreApi.ts:17` (`fetchAllChores`) already returns parsed `Chore[]`. The "re-pull" half of the design calls this exact function — no new fetch code. Only the *trigger* changes from "once on mount" to "on every SSE signal."

- **`sortedIds` needs explicit reconciliation.** `sortedIds` (`App.tsx:26`) is a separate state array holding display order, recomputed only on mount and when `simulatedDate` changes (`App.tsx:45-49`). A re-pull must reconcile it: keep order for ids still present, append ids for newly-seen chores (ordered via `orderChores(newOnes, simulatedDate)` from `utils/choreSort.ts`), drop ids that vanished. Everything else (`uniqueRooms` `:51`, `useRoomFilter` `:59`, the render chain) derives from `choreData` and updates for free.

- **Optimistic updates create a reconciliation hazard.** Each handler optimistically mutates `choreData` before its network round-trip resolves (e.g. `App.tsx:111-113`). A re-pull triggered by an event that arrives mid-flight could momentarily overwrite the local write with pre-write server data. The client must therefore defer applying a re-pull while a mutation is in flight or a form/modal is open (`showForm`/`editingId`/`pendingDeleteId`), and apply the deferred re-pull once that clears. Because events are sparse, a single "dirty" flag + gate is enough — no queue.

- **SSE needs nginx proxy-buffering disabled.** `nginx.conf` reverse-proxies `/api/*` on the shared origin. Buffered proxying would hold SSE frames back; the events location needs `proxy_buffering off;`, `proxy_http_version 1.1;`, `proxy_set_header Connection '';`, and a long `proxy_read_timeout`. This is the one deployment-side change and is the main reason this is slightly more than a frontend-only edit.

- **Idle connections get reaped without a heartbeat.** Proxies and phones drop idle long-lived connections. The SSE endpoint should emit a periodic comment line (`:ping\n\n`, ~25s) to keep the stream alive; `EventSource` transparently reconnects if it does drop.

- **Testing conventions apply directly.** Backend uses vitest with supertest-style route tests (`backend/src/__tests__/routes.test.ts`); the EventEmitter and emit-on-write behavior are unit-testable without a real socket. Frontend uses Vitest + RTL with the whole `choreApi` module mocked (`App.test.tsx:9-15`); `EventSource` is mockable as a small fake that lets a test dispatch a `message` event and assert a re-pull + re-render.

## Architecture (data flow)

```
Phone taps "complete"  ──PATCH /api/chores/:id/complete──▶  Express handler
                                                              │ 1. write to SQLite (existing)
                                                              │ 2. choreEvents.emit('changed')   ← NEW
                                                              ▼
                                          ┌──────────  in-process EventEmitter  ──────────┐
                                          ▼                                               ▼
                            GET /api/events (SSE) → Pi kiosk            GET /api/events (SSE) → phone
                                          │                                               │
                                  EventSource.onmessage                          EventSource.onmessage
                                          ▼                                               ▼
                                  loadChores() re-pull  ◀── GET /api/chores ──▶   loadChores() re-pull
```

The acting device also receives its own event and re-pulls — harmless, since it reconciles to the same truth it optimistically already showed.

## Steps

### 1. Backend: in-process event bus + emit on every successful write
Create a singleton `EventEmitter` and emit a `changed` event after each successful mutation.

**To-do:**
- [x] Add `backend/src/events.ts` exporting a singleton `choreEvents = new EventEmitter()` (raise `setMaxListeners` to a sane bound, e.g. 50, for a household's worth of devices).
- [x] In `backend/src/app.ts`, after a *successful* DB write in the POST (`:30`), PUT (`:47`), PATCH complete (`:67`), and DELETE (`:83`) handlers, call `choreEvents.emit('changed')`. Emit only on success (inside the branch that returns 2xx), never on validation/500 paths.
- [x] Keep the emit payload trivial (no body, or a monotonically increasing counter). The client re-pulls; the event is just a doorbell.

**Verification:** `npm test --workspace backend` passes; add a unit test asserting `choreEvents` fires exactly once per successful create/complete/update/delete and not on a 400/404.

### 2. Backend: SSE endpoint `GET /api/events`
Stream the `changed` signal to all connected clients.

**To-do:**
- [x] Add `app.get('/api/events', ...)` in `backend/src/app.ts`. Set headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`; call `res.flushHeaders()`.
- [x] Subscribe a listener to `choreEvents.on('changed', ...)` that writes `data: changed\n\n` to `res`. Write an initial `:ok\n\n` comment on connect.
- [x] Start a `setInterval` heartbeat writing `:ping\n\n` (~25s) to keep the connection alive; clear it and `choreEvents.off('changed', ...)` on `req.on('close', ...)` to avoid listener leaks.
- [x] Confirm CORS: `app.ts:7` already sets `Access-Control-Allow-Origin: *`; in production the stream is same-origin via nginx, so no change needed.

**Verification:** add a route test that opens the endpoint, emits `choreEvents.emit('changed')`, and asserts a `data: changed` frame is written; assert the `close` handler removes the listener (`choreEvents.listenerCount('changed')` returns to baseline).

### 3. nginx: pass SSE through unbuffered
Allow the stream to flow in real time on the Pi.

**To-do:**
- [x] In `nginx.conf`, add a `location /api/events` block (before the general `/api/` block, or as a more specific match) that proxies to the backend with `proxy_buffering off;`, `proxy_cache off;`, `proxy_http_version 1.1;`, `proxy_set_header Connection '';`, and `proxy_read_timeout 1h;` (or similar long timeout).
- [x] Confirm the existing `/api/` proxy block still handles all other endpoints unchanged.

**Verification:** `docker compose build && docker compose up -d`, then `curl -N http://localhost/api/events` stays open and prints a `data: changed` line when another terminal does `curl -X PATCH .../complete`. (Manual; covered again in Step 7.)

### 4. Frontend: extract a shared `loadChores()` with reconciliation
Refactor the one-shot mount fetch into a reusable re-pull used by both initial load and event-driven refresh.

**To-do:**
- [x] In `App.tsx`, add a `reconcileChores(fetched: Chore[])` that sets `choreData` and reconciles `sortedIds` order-preservingly (keep existing order, append new ids ordered via `orderChores`, drop missing ids).
- [x] Replace the mount `useEffect` body (`:32-43`) with a shared `loadChores()` that uses the reconcile helper. Only the *first* load toggles `loading`/surfaces a full-screen error; event-driven re-pulls swallow transient blips (optionally a subtle "stale" indicator) rather than flipping `loading` or erroring.
- [x] Add an `isMutating` ref set/cleared in the four mutation handlers, plus a `pendingRefresh` ref. Gate predicate: `isMutating || showForm || editingId !== null || pendingDeleteId !== null`. When an event arrives while gated, set `pendingRefresh`; when the gate clears, run the deferred `loadChores()`.

**Verification:** `npm test --workspace frontend` still green; `npm run build --workspace frontend` clean.

### 5. Frontend: tests for the SSE hook (Red)
Write the hook's tests before implementing it, using a fake `EventSource`.

**To-do:**
- [x] Create `frontend/src/__tests__/hooks/useChoreEvents.test.ts`. Install a fake `EventSource` on `globalThis` whose instances expose `onmessage`/`onopen`/`onerror` and a `close()` spy, and let the test dispatch a `message`.
- [x] Test: dispatching a `message` invokes the supplied callback (the re-pull).
- [x] Test: `onopen` (connect/reconnect) invokes the callback too — covers refetch-after-reconnect so events missed during a drop are recovered.
- [x] Test: the gate predicate suppresses the callback while it returns true.
- [x] Test: unmount calls `EventSource.close()` and detaches handlers.
- [x] Run and confirm all fail at import resolution (Red).

**Verification:** `npm test --workspace frontend -- useChoreEvents.test.ts` — all fail to resolve the module.

### 6. Frontend: implement `useChoreEvents` hook + wire into `App` (Green)
Minimum hook to satisfy Step 5, then connect it.

**To-do:**
- [x] Create `frontend/src/hooks/useChoreEvents.ts` exporting `useChoreEvents(onChange: () => void, paused: () => boolean)`. Open `new EventSource('/api/events')`; on `message` and on `open`, call `onChange()` if `!paused()` (else mark pending — or leave gating in `App` and just forward). Use refs for `onChange`/`paused` to avoid reconnect churn. Close the stream and detach on unmount.
- [x] Optionally also refetch on `document.visibilitychange → visible` (covers phones whose OS suspended the `EventSource` while backgrounded).
- [x] In `App.tsx`, call `useChoreEvents(loadChores, gatePredicate)`.

**Verification:** `npm test --workspace frontend -- useChoreEvents.test.ts` passes; `npx tsc --noEmit` clean.

### 7. App-level integration test + manual two-device verification
Prove the reported scenario is fixed.

**To-do:**
- [x] In `App.test.tsx` (or `App.sync.test.tsx`): render `App`, resolve initial `fetchAllChores` with one chore, change the mock to return a second chore, dispatch a fake SSE `message`, flush promises, assert the new chore renders — with no manual reload.
- [x] Test the gate: with a modal open / mutation in flight, an SSE message does not clobber the open modal or the optimistic value; assert the deferred re-pull runs after the gate clears.
- [x] Manual: `docker compose build && docker compose up -d`; open `http://localhost/` in two windows. Add/complete/delete in window A; confirm window B updates within a second with no reload. Background and re-focus B; confirm it stays in sync. Kill and restart the backend container; confirm `EventSource` reconnects and B refetches. `docker compose down` (not `-v`).

**Verification:** all new tests pass; full `npm test` (both workspaces) green; `npx playwright test` smoke unaffected; manual two-window propagation is near-instant.

## Why this over periodic polling
- **No fixed latency.** Updates appear as fast as the write commits, not up to an interval later.
- **No idle request volume.** One held-open connection per device instead of N requests/min forever.
- **Single source of truth preserved.** "Notify then re-pull" reuses `GET /api/chores`; the event is only a doorbell, so coalesced or missed events are self-healing on the next event or reconnect.
- **Trade-off accepted:** it requires a small backend endpoint and an nginx tweak (vs. a frontend-only poll). Given the app is a single-process backend on a LAN, that cost is low and the bus is trivial (in-memory `EventEmitter`).

## Out of Scope
- **Out-of-band DB writes** (e.g. restoring a backup directly into the SQLite file, per the README backup strategy) do not pass through the API and so do not emit. These are rare admin actions followed by a container/app restart, which re-fetches on mount anyway. If ever needed, a low-frequency safety-net refetch on `EventSource` reconnect (already included via `onopen`) covers the gap.
- **Authentication / per-user streams.** The app is an unauthenticated household LAN tool; the stream broadcasts the same "changed" doorbell to all. No per-client filtering is needed.
