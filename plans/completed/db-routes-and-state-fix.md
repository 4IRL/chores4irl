> **STATUS: Merged** (early DB-schema/routes/state-propagation fix; predates per-PR plan
> tracking — doc itself entered git via #20 `b823ad4`). Frozen — historical record, do not edit.

# DB Schema, Routes & State Propagation Fix

## Summary

Wire the chores SQLite table, four Express routes, and frontend API client together
into a complete end-to-end data flow, then fix two state management bugs in the React
layer: the server-response being discarded in `handleCompleteChore`, and `ChoreTimerBar`
holding stale local state that doesn't re-sync when its props update. Also surfaces the
already-implemented DELETE route to the UI so all four CRUD operations are usable.

## Research Findings

- **Backend is already complete.** `backend/src/db.ts` has the full `chores` table
  (snake_case columns, CHECK constraint on urgency, `long_term_task` as INTEGER 0/1,
  WAL mode, seed-on-empty). `backend/src/chores.ts` has `getAllChores`, `createChore`,
  `completeChore`, `deleteChore` all wired to `better-sqlite3`. `backend/src/router.ts`
  registers all four routes on the Express app which also calls `app.listen(3000)`.
- **Frontend API client is complete.** `frontend/src/services/choreApi.ts` exports
  `fetchAllChores`, `addChore`, `completeChore`, `removeChore` with the
  `ChoreWire → Chore` date-parsing boundary (`parseChore()`) handled correctly.
- **Bug 1 (mark-complete):** `App.tsx` `handleCompleteChore` applies an optimistic
  `setChoreData` update, calls `completeChore()`, but **discards the returned `Chore`**.
  If the server stores a slightly different ISO date (UTC trim, etc.) the local state
  silently diverges. There is also no rollback on API failure — `setError` fires but
  the stale optimistic value remains in `choreData`.
- **Bug 2 (ChoreTimerBar local state):** `ChoreTimerBar` initialises
  `useState(chore.dateLastCompleted)` on mount. React's `useState` does not re-initialise
  when props change, so if `choreData` in App is updated (e.g. after server reconciliation)
  the timer bar continues displaying the stale mount-time value.
- **DELETE gap:** `removeChore` is implemented in `choreApi.ts` but App.tsx does not
  import it, has no `handleDeleteChore`, and neither `ChoreList` nor `ChoreTimerBar`
  receive an `onDelete` prop.
- **No tests.** No test framework is installed in any workspace; the Final Verification
  step uses manual dev-server smoke testing.

## Steps

### 1. Audit & Confirm Backend Completeness

Read and verify the three backend files are exactly as research describes before
touching the frontend. Confirm no TODOs, stubs, or missing validations remain.

**To-do:**
- [x] Read `backend/src/db.ts` in full. Confirm the CREATE TABLE statement includes
  all nine columns: `id INTEGER PRIMARY KEY AUTOINCREMENT`, `name TEXT NOT NULL`,
  `details TEXT`, `room TEXT NOT NULL`, `date_last_completed TEXT NOT NULL`,
  `duration INTEGER NOT NULL`, `frequency INTEGER NOT NULL`,
  `urgency TEXT CHECK(urgency IN ('low','medium','high'))`, `long_term_task INTEGER NOT NULL DEFAULT 0`.
  Confirm WAL mode is enabled and seed data is inserted in a transaction if count is 0.
  If any column is missing or wrong, correct it and document what changed.
- [x] Read `backend/src/chores.ts` in full. Confirm:
  - `ChoreRow` type has all nine snake_case fields with correct TypeScript types.
  - `ChoreWire` is `Omit<Chore,'dateLastCompleted'> & { dateLastCompleted: string }`.
  - `rowToChore(row: ChoreRow): ChoreWire` maps `date_last_completed → dateLastCompleted`,
    `long_term_task → longTermTask` (0 → `undefined`, 1 → `true`),
    and `urgency: null → undefined`.
  - `getAllChores()` runs `SELECT * FROM chores ORDER BY id` and maps via `rowToChore`.
  - `createChore(input)` inserts all eight non-id fields and returns the created row.
  - `completeChore(id, dateLastCompleted)` updates `date_last_completed WHERE id=?`
    and returns the updated row, or `null` if no rows were changed.
  - `deleteChore(id)` deletes by id and returns `true` if a row was deleted, `false` otherwise.
  - If any function is a stub or missing, implement it here following the patterns above.
- [x] Read `backend/src/router.ts` in full. Confirm all four routes are registered:
  - `GET /api/chores` → calls `getAllChores()`, returns `{ success: true, data: ChoreWire[] }` with 200.
  - `POST /api/chores` → validates `name`, `room`, `dateLastCompleted`, `duration`, `frequency` are present in `req.body`; returns 400 if any are missing; calls `createChore(req.body)`; returns `{ success: true, data: ChoreWire }` with 201.
  - `PATCH /api/chores/:id/complete` → parses `id = Number(req.params.id)`, returns 400 if `isNaN(id)` or `req.body.dateLastCompleted` is absent; calls `completeChore(id, req.body.dateLastCompleted)`; returns 404 if result is `null`; returns `{ success: true, data: ChoreWire }` with 200.
  - `DELETE /api/chores/:id` → parses `id`, returns 400 if `isNaN(id)`; calls `deleteChore(id)`; returns 404 if result is `false`; returns `{ success: true, data: null }` with 200.
  - Confirm `cors()` and `express.json()` middleware are applied globally before routes.
  - If any route is missing or incorrect, implement or fix it following the patterns above.

### 2. Fix `handleCompleteChore` — Server-Response Reconciliation & Error Rollback

Replace the fire-and-forget optimistic update with a proper reconcile-on-success /
rollback-on-failure pattern so `choreData` in App always reflects server truth.

**To-do:**
- [x] Open `frontend/src/App.tsx`. Locate `handleCompleteChore` (the async function
  that calls `completeChore` from `choreApi`).
- [x] Capture the pre-update snapshot before the optimistic update so a rollback is
  possible:
  ```ts
  const prev = choreData;
  ```
- [x] Keep the optimistic `setChoreData` call for responsiveness (maps over `choreData`,
  replaces matching id with `{ ...chore, dateLastCompleted: date }`).
- [x] After `const updated = await completeChore(id, date);`, replace the current
  no-op with a reconciling state update:
  ```ts
  setChoreData(curr => curr.map(c => c.id === id ? updated : c));
  ```
  This replaces the optimistic placeholder with the exact server-returned `Chore`
  (including the server-normalised `dateLastCompleted`).
- [x] In the `catch` block (create one if it doesn't exist), roll back choreData to the
  snapshot and surface the error:
  ```ts
  setChoreData(prev);
  setError(err instanceof Error ? err.message : 'Failed to mark chore complete');
  ```
- [x] Confirm the import of `completeChore` from `'./services/choreApi'` is already
  present (it is, per research). Do not change any other imports.
- [x] Verify the final `handleCompleteChore` signature is still
  `async (id: number, date: Date): Promise<void>` — ChoreList and ChoreTimerBar call
  `onComplete(chore.id, day)` where `day` is a `Date`, so the signature must not change.

### 3. Fix `ChoreTimerBar` — Sync Local State with Updated Props

`ChoreTimerBar` initialises `useState(chore.dateLastCompleted)` once on mount and
never re-syncs. Add a `useEffect` to keep the local display date in sync when
`chore.dateLastCompleted` changes (i.e. after App reconciles with server response).

**To-do:**
- [x] Open `frontend/src/components/chore/ChoreTimerBar.tsx`. Locate the line:
  ```ts
  const [dateLastCompleted, setDateLastCompleted] = useState(chore.dateLastCompleted);
  ```
- [x] Directly below the `useState` line, add a `useEffect` that resets local state
  whenever the prop changes:
  ```ts
  useEffect(() => {
    setDateLastCompleted(chore.dateLastCompleted);
  }, [chore.dateLastCompleted]);
  ```
  This is the minimal fix: the local date display re-derives from props whenever App's
  reconciled server response flows down.
- [x] Confirm `useEffect` is already imported from `'react'` at the top of
  `ChoreTimerBar.tsx`. If not, add it to the existing `import React, { ... }` statement.
- [x] Do not rename or change the `dateLastCompleted` state variable or `setDateLastCompleted`
  setter — `resetTask()` still calls `setDateLastCompleted(day)` for the immediate
  visual response on click; the `useEffect` only fires when the prop changes externally.

### 4. Wire DELETE Flow End-to-End in App.tsx

`removeChore` is implemented in `choreApi.ts` but has no caller. Add
`handleDeleteChore` to App.tsx, prop-drill `onDelete` through ChoreList, and add a
delete trigger in ChoreTimerBar (or ChoreList row level, whichever is consistent with
the existing UI pattern).

**To-do:**
- [x] Open `frontend/src/App.tsx`. Add `removeChore` to the existing import from
  `'./services/choreApi'`:
  ```ts
  import { fetchAllChores, addChore, completeChore, removeChore } from './services/choreApi';
  ```
- [x] Add `handleDeleteChore` alongside the other handlers in App.tsx:
  ```ts
  const handleDeleteChore = async (id: number): Promise<void> => {
    const prev = choreData;
    setChoreData(curr => curr.filter(c => c.id !== id)); // optimistic remove
    try {
      await removeChore(id);
    } catch (err) {
      setChoreData(prev); // rollback
      setError(err instanceof Error ? err.message : 'Failed to delete chore');
    }
  };
  ```
- [x] Pass `onDelete={handleDeleteChore}` to `<ChoreList>` in App.tsx's JSX (alongside
  the existing `onComplete` prop).
- [x] Open `frontend/src/components/chore/ChoreList.tsx`. Add `onDelete: (id: number) => void`
  to the component's props type. Pass it through to the `ChoreTimerBar` (or whichever
  child component renders individual chore rows) as `onDelete={onDelete}`.
- [x] Open `frontend/src/components/chore/ChoreTimerBar.tsx`. Add
  `onDelete: (id: number) => void` to its props type. Add a delete button in the JSX
  that calls `onDelete(chore.id)` on click. Match the visual style of existing buttons
  in the component (inspect the file for the existing button class/pattern and replicate it).
- [x] Ensure no other component that renders `ChoreList` (other than App.tsx) exists —
  per research, App.tsx is the sole consumer. If additional consumers exist, add
  `onDelete` prop to each.

### 5. Manual Smoke Test

No automated test infrastructure exists. Verify all five operations work correctly by
running the dev server and exercising the UI.

**To-do:**
- [ ] Run `npm run dev` from the project root (starts both backend on port 3000 and
  frontend via Vite, per the root package.json `concurrently` setup).
- [ ] Open the browser. Confirm chores load from `/api/chores` (check Network tab —
  expect `{ success: true, data: [...] }` with all seed chores).
- [ ] Mark a chore complete. Confirm: (a) the ChoreTimerBar updates immediately
  (optimistic), (b) the Network tab shows a successful PATCH to
  `/api/chores/:id/complete`, (c) the server-returned date matches what's displayed.
- [ ] Reload the page. Confirm the completed chore's `dateLastCompleted` persisted
  in SQLite and loads correctly (not the old seed value).
- [ ] Add a new chore via the form. Confirm it appears in the list and a POST to
  `/api/chores` returns 201 with the new chore's id.
- [ ] Delete a chore using the new delete button. Confirm it disappears from the list,
  a DELETE to `/api/chores/:id` returns `{ success: true, data: null }`, and it does
  not reappear on page reload.
- [ ] Simulate a backend error (e.g., kill the backend process, then attempt to mark
  complete). Confirm the optimistic update rolls back and an error message appears.

## Status
finished: false
