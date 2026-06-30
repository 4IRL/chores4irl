# Push Review: claude/mobile-pi-device-sync-is0teg

## Review 1
Generated: 2026-06-30 01:49
Comparison: origin/main...HEAD
Verdict: **FIXED IN-SESSION → PUSHED** (1 reviewer FAIL on first pass; blocker resolved and re-verified before push)

7 parallel reviewers ran against the multi-device-sync (SSE) diff. Six PASSed; Test Coverage FAILed on one major gap. The major finding plus the highest-value minors were fixed in the same session, all suites re-run green (backend 62, frontend 121, both `tsc` clean, Vite build clean), then the branch was pushed.

### Results by Reviewer

#### 1. Safety & Security — PASS
No critical/major. Minor: `GET /api/events` has no auth / per-IP cap / connection limit; `setMaxListeners(50)` only suppresses warnings. Accepted for a household LAN app (matches the plan's "unauthenticated household LAN tool" scope).

#### 2. Correctness — PASS
No critical/major; emit fires only on success paths, SSE close detaches the listener, gate ordering is safe. Minors: (a) the `open` event fires on the *initial* connection too, so it double-fetches alongside the mount `loadChores(true)` — harmless/idempotent and intentional for reconnect recovery; accepted. (b) `isMutatingRef` is a boolean, not a counter — could clear early if two mutations overlapped; the UI's modal/dialog gates make concurrent mutations unreachable in practice; accepted with documentation.

#### 3. Simplicity & Conciseness — PASS
Minor: `FakeEventSource` duplicated across two test files. **FIXED** — extracted to `frontend/src/__tests__/fixtures/fakeEventSource.ts`.

#### 4. Test Coverage — FAIL → RESOLVED
- **MAJOR (FIXED):** the `isMutatingRef` gate + `flushPendingRefresh`-in-`finally` path was untested (the existing test only covered the React-state/modal gate). Added a test that holds `completeChore` open, fires an SSE signal mid-mutation (asserts deferral), then settles the mutation and asserts the deferred re-pull flushes.
- Minor (FIXED): hidden `visibilitychange` does not fire the callback.
- Minor (FIXED): `showForm` gate deferral + flush-on-close.
- Minor (FIXED): `pendingDeleteId` gate deferral + flush-on-close.
- Minor (FIXED): heartbeat `clearInterval` on SSE close (added a spy assertion to the backend stream test).
- Minor (FIXED): reconcile drop/keep branches — a re-pull removing a chore drops it while survivors remain.

#### 5. Completeness & Cleanup — PASS
Clean — no debug code, commented blocks, TODOs, stubs, or stray files.

#### 6. Consistency & Style — PASS
Minors: single-letter `c` in `reconcileChores` (**FIXED** → `chore`); duplicated `FakeEventSource` (**FIXED**, see #3); `ac` abbreviation in `events.test.ts` (**FIXED** → `controller`).

#### 7. Integration Risk — PASS
No API/schema breakage; nginx `/api/events` block correctly takes precedence. Minors: misleading "wins because placed before" comment (**FIXED** → clarified longest-prefix semantics); non-exact prefix match could catch future `/api/events/*` sub-paths — accepted (no sub-paths exist; documented for future).

### To-Do: Deferred (accepted minors, non-blocking)

- [ ] **Consider a connection cap on `GET /api/events`** — `backend/src/app.ts` — if exposure ever grows beyond the LAN, reject past N concurrent SSE clients (e.g. `listenerCount >= 20 → 503`).
- [ ] **Consider a reference-counted mutation gate** — `frontend/src/App.tsx` — replace boolean `isMutatingRef` with a counter if concurrent mutations ever become reachable in the UI.
- [ ] **Consider skipping the initial `open` re-fetch** — `frontend/src/hooks/useChoreEvents.ts` — guard the `open` handler to fire only on reconnects, avoiding one redundant idempotent fetch per mount.
- [ ] **Consider exact-match nginx location** — `nginx.conf` — `location = /api/events` to scope SSE settings to exactly that path.
