# Multi-Device Sync (Re-pull from DB)

## Summary
Keep every connected device — the Pi kiosk display and any phones/tablets — showing the latest chore data, regardless of which device made the change. Today the frontend loads chores **once on mount** and never re-reads, so a change made on a phone is written to SQLite correctly but is never reflected on the Pi (or any other device) until that browser reloads the page — which a kiosk never does.

The fix is a **client-side periodic re-pull**: a polling hook that re-fetches `GET /api/chores` on a fixed interval and reconciles the result into existing React state, plus a **refetch-on-visibility** trigger so a phone refreshes the instant it's brought back to the foreground. The reconciliation is careful not to clobber a device's own in-flight optimistic updates or interrupt a user mid-edit. **No backend changes** are required — the single shared `better-sqlite3` process is already the source of truth; the only thing missing is the clients asking it again.

This is intentionally the smallest robust solution for a household LAN app with a handful of devices. Server-push (SSE/WebSocket) is documented at the end as an optional future upgrade, but is not part of this plan.

## Research Findings

- **The bug is a single missing dependency-driven refetch.** `frontend/src/App.tsx:32-43` runs `fetchAllChores()` inside a `useEffect(..., [])` with an empty dependency array — it fires exactly once, on mount. After that, `choreData` (`App.tsx:23`) is only ever mutated by the *same device's* own handlers: `handleAddChore` (`App.tsx:67`), `handleDeleteChore` (`App.tsx:78`), `handleCompleteChore` (`App.tsx:107`), `handleEditChore` (`App.tsx:132`). There is no path for another device's write to enter this state. The Pi kiosk holds whatever it fetched at boot.

- **The backend is already a clean, consistent source of truth.** `backend/src/app.ts` is a plain REST API; `backend/src/chores.ts` reads/writes a single `better-sqlite3` database (WAL mode per the README). Every device writes to the same DB, so the *data* is correct and shared — `GET /api/chores` (`app.ts:15`) always returns the current truth. Nothing on the backend needs to change for re-pull to work.

- **The wire/parse layer already exists and is reusable.** `frontend/src/services/choreApi.ts:17` (`fetchAllChores`) returns fully-parsed `Chore[]` with `dateLastCompleted` as a real `Date`. A polling hook can call this exact function — no new service code needed for the basic re-pull.

- **State derived from `choreData` will update for free.** `uniqueRooms` (`App.tsx:51`), `filteredChores` via `useRoomFilter` (`App.tsx:59`), and the render chain all derive from `choreData`. The one piece that does **not** auto-update is `sortedIds` (`App.tsx:26`) — it's a separate state array holding display order, recomputed only on mount and when `simulatedDate` changes (`App.tsx:45-49`). A re-pull must reconcile `sortedIds` too: append ids for newly-appeared chores, drop ids for chores that vanished, and preserve existing order so the list doesn't visibly reshuffle under the user. `orderChores(chores, simulatedDate)` (`utils/choreSort.ts`) is the canonical ordering function to reuse.

- **Optimistic updates create a reconciliation hazard.** Each handler optimistically mutates `choreData` *before* the network round-trip resolves (e.g. `App.tsx:111-113` for complete). If a poll lands mid-flight and overwrites state with server data that predates the local write, the user's action would appear to "flicker back" and then re-apply. The hook must therefore (a) skip applying poll results while a mutation is in flight, and (b) skip while a form/modal is open so a re-pull can't yank the list out from under someone who is editing. An `isMutating` ref + the existing `showForm`/`editingId`/`pendingDeleteId` state are enough to gate this — no new global state library needed.

- **`document.visibilitychange` is the right mobile trigger.** Phones background tabs aggressively; `setInterval` timers are throttled or paused when a tab is hidden. Listening for `visibilitychange` and refetching on `visible` means a phone shows fresh data the moment the user returns to it, independent of the interval. The Pi kiosk is always visible, so it relies on the interval. The existing `useMidnightClock` hook (`hooks/useMidnightClock.ts`) is the local precedent for an effect-driven hook with cleanup.

- **Testing conventions are established and directly applicable.** Vitest + React Testing Library; `App.test.tsx:9-15` already mocks the entire `choreApi` module, and `vi.useFakeTimers()` is the project's canonical timer-mocking pattern (`__tests__/hooks/useMidnightClock.test.ts`). A polling hook is testable by advancing fake timers and asserting `fetchAllChores` call counts; reconciliation is testable at the `App` level by changing the mock's resolved value between polls.

- **Nginx proxies `/api/*` transparently.** `nginx.conf` reverse-proxies the API on the shared origin; ordinary polling requests need no special proxy config (unlike SSE, which would require disabling proxy buffering). This keeps the basic solution deployment-free beyond shipping the new frontend build.

## Design Decisions

- **Poll interval: 15 seconds (configurable constant).** Fast enough that a chore completed on a phone appears on the kiosk within a few seconds of feeling "live" for a household; slow enough that the request volume on a Pi is trivial (4 req/min/device). Define it as a named constant (e.g. `POLL_INTERVAL_MS` in `frontend/src/assets/constants.ts` if a constants module is the convention) so it's tunable in one place.
- **Reconcile, don't replace.** The poll computes the next `choreData`/`sortedIds` from server truth but preserves existing display order and avoids replacing object identities that haven't changed where practical, to minimize re-render churn on the kiosk.
- **Gate on local activity.** Never apply a poll result while `isMutating`, `showForm`, `editingId !== null`, or `pendingDeleteId !== null`. Skipped polls are simply retried on the next tick — no queueing needed.
- **Simulation mode still polls but the *data* updates underneath the simulated date.** Date-navigation simulation (`dayOffset > 0`) only changes which date the bars are computed against; it doesn't freeze the chore set. Re-pull should still run so that returning to "today" shows current data. (Completion is already disabled while simulating per `App.tsx:108`.)

## Steps

### 1. Extract a reusable `refetch`/reconcile function in `App.tsx`
Refactor the one-shot mount fetch into a named async function that both the initial load and the poller call, and that performs order-preserving reconciliation of `choreData` + `sortedIds`.

**To-do:**
- [ ] In `App.tsx`, add a `reconcileChores(fetched: Chore[])` helper (inside the component or a pure module function taking current `sortedIds`) that: keeps the existing order for ids still present, appends ids for newly-seen chores (ordered via `orderChores(newOnes, simulatedDate)`), and drops ids no longer present. Set both `choreData` and `sortedIds` from it.
- [ ] Replace the body of the mount `useEffect` (`App.tsx:32-43`) so it calls a shared `loadChores()` that uses the reconcile helper on success and preserves the existing `loading`/`error` handling on first load only (polls must not flip `loading` back to true or surface transient network blips as full-screen errors — log/swallow or show a subtle stale indicator instead).
- [ ] Add an `isMutating` ref, set true at the start of each of the four mutation handlers and cleared in their `finally`, so the poller can check it.

**Verification:** `npm test --workspace frontend` still passes (existing `App.test.tsx` behavior unchanged); `npm run build --workspace frontend` is clean.

### 2. Write tests for the polling hook (Red)
Create the test file for a `usePolling` (or `usePeriodicRefetch`) hook before implementing it.

**To-do:**
- [ ] Create `frontend/src/__tests__/hooks/usePolling.test.ts`. Use `vi.useFakeTimers()`.
- [ ] Test: calls the provided callback once per interval after `advanceTimersByTime(intervalMs)`; does **not** call it before the first interval elapses.
- [ ] Test: does not call the callback while a `paused()` predicate returns true (models the mutation/modal gate).
- [ ] Test: cleans up its interval and `visibilitychange` listener on unmount (assert no further calls after unmount + timer advance).
- [ ] Test: invokes the callback immediately on a simulated `visibilitychange` to `visible` (mock `document.visibilityState`).
- [ ] Run the file and confirm all tests fail with module-not-found (Red).

**Verification:** `npm test --workspace frontend -- usePolling.test.ts` — all fail at import resolution.

### 3. Implement the polling hook (Green)
Minimum hook to satisfy Step 2.

**To-do:**
- [ ] Create `frontend/src/hooks/usePolling.ts` exporting `usePolling(callback: () => void, { intervalMs, paused }: { intervalMs: number; paused: () => boolean })`.
- [ ] Use `setInterval`; on each tick, call `callback()` only if `!paused()`. Store `callback`/`paused` in refs so the interval needn't be recreated when they change (avoid stale closures without churning timers).
- [ ] Add a `visibilitychange` listener that calls `callback()` (subject to `!paused()`) when `document.visibilityState === 'visible'`.
- [ ] Return nothing; clean up both the interval and the listener on unmount.

**Verification:** `npm test --workspace frontend -- usePolling.test.ts` passes; `npx tsc --noEmit` clean.

### 4. Wire the hook into `App.tsx`
Connect the poller to the shared `loadChores()` with the activity gate.

**To-do:**
- [ ] In `App.tsx`, call `usePolling(loadChores, { intervalMs: POLL_INTERVAL_MS, paused: () => isMutatingRef.current || showForm || editingId !== null || pendingDeleteId !== null })`.
- [ ] Add `POLL_INTERVAL_MS = 15000` as a named constant (in `assets/constants.ts` if that module exists, else top of `App.tsx`).
- [ ] Confirm `loadChores` reads the current `simulatedDate`/`sortedIds` correctly (via refs or by passing them) so reconciliation orders new chores against the active simulated date.

**Verification:** `npm test --workspace frontend` passes; `npm run build --workspace frontend` clean.

### 5. App-level integration test for cross-device re-pull (Red→Green)
Prove the behavior the user reported is fixed: a change "from another device" (simulated by changing the mock's resolved value) appears without a manual reload.

**To-do:**
- [ ] In `App.test.tsx` (or a new `App.sync.test.tsx`), with fake timers: render `App`, let the initial `fetchAllChores` resolve with one chore, then change `vi.mocked(fetchAllChores).mockResolvedValue(...)` to include a second chore (or an updated completion date), `advanceTimersByTime(POLL_INTERVAL_MS)`, flush promises, and assert the new/updated chore is now on screen.
- [ ] Test the gate: while a form/modal is open or a mutation is mid-flight, an interval tick does **not** replace the list (assert the open modal stays and the optimistic value is not clobbered).
- [ ] Test visibility refetch: dispatch a `visibilitychange` event with state `visible` and assert an immediate refetch + render of changed data.

**Verification:** all new tests pass; full `npm test --workspace frontend` green; `npx playwright test` smoke unaffected.

### 6. Manual end-to-end verification
Confirm on the real two-device flow before shipping to the Pi.

**To-do:**
- [ ] `docker compose build && docker compose up -d` (per README local smoke test). Open `http://localhost/` in two browser windows (one simulating the Pi, one the phone).
- [ ] In window A, add/complete/delete a chore. Confirm window B reflects it within ~15s without a manual reload. Background window B's tab and re-focus it — confirm it refreshes immediately.
- [ ] Confirm no flicker/regression on the acting window's own optimistic updates, and that editing in one window is not interrupted by a poll.
- [ ] `docker compose down` (not `-v`).

**Verification:** Changes propagate across both windows; no clobbered edits; existing add/complete/delete/edit flows unchanged.

## Out of Scope / Future Upgrade: Server Push (SSE)

Polling is sufficient for a LAN household app and requires zero backend/nginx changes. If near-instant propagation is later wanted, the lowest-friction upgrade is **Server-Sent Events**:

- Add a `GET /api/events` SSE endpoint in `backend/src/app.ts` backed by a simple in-process `EventEmitter`. The four mutating handlers (`createChore`/`completeChore`/`updateChore`/`deleteChore`) emit a `chores-changed` event after a successful DB write; the SSE handler forwards it to all connected clients. Because there is a single backend process owning the SQLite file, an in-memory emitter reaches every client — no message broker needed.
- Frontend: replace (or supplement) the interval with an `EventSource('/api/events')` that calls the same `loadChores()` on each event. Keep a slow interval (e.g. 60s) as a fallback for missed events.
- Deployment: `nginx.conf` must disable proxy buffering for the events location (`proxy_buffering off;`, `proxy_set_header Connection '';`, HTTP/1.1) so events aren't held back — this is the main reason SSE is deferred rather than done now.

This plan deliberately ships re-pull first: it solves the reported problem immediately and the `loadChores()` seam it introduces is exactly what an SSE upgrade would reuse.
