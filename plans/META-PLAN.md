# META-PLAN — chores4irl future-feature rollout

> **What this file is.** An orchestration manifest, not a script. It sequences the
> features in `plans/ledger/260630_feature_ledger.md` and defines, for each one,
> a *self-contained* per-feature session that a fresh agent (with no memory of prior
> sessions) can run end-to-end using **only this file and the repository**. This file
> is never run top-to-bottom. It is the index; each feature is a separate session.
>
> **Source list lineage.** `plans/ledger/260630_feature_ledger.md` is the **current**
> source of truth for the backlog. Its predecessors are `260627` → `260628` (deleted,
> folded into 260630) → and the earlier `260625`. When any older list disagrees with
> **260630**, 260630 wins. The diff from the META-PLAN's previous basis (260627) is:
> - **Reworded (no effort change):** F9 chore search ("dynamic … type-as-you-search").
> - **Changed spec:** swipe-swap threshold **50% → 25%** with a progressive action-reveal (→ **F10**).
> - **Reframed into a settings panel:** Undo (was 260627 item 6) and Rotate (was 260627
>   item 7) now live inside a new collapsible **device-control panel**, alongside four
>   net-new controls (brightness, screen-blank, restart, redo). These are **F11–F17**.
>
> **F-ID discipline.** F-IDs are an **append-only audit trail keyed to feature-list items**,
> assigned in the order items first appeared — **not** a priority ranking. Never renumber an
> existing ID. Effort/priority is conveyed by the tables and chain diagram below, not by the
> number. (The previous META-PLAN revision only assigned F1–F9 and silently dropped 260627's
> Undo/Rotate/swipe-swap items; this revision repairs that by assigning F10–F17.)
>
> **Execution model.** Each feature is implemented in its own dedicated session that
> ends with a committed, pushed checkpoint. The **git repository — not conversation
> memory — is the medium that carries state between features.** A feature's "expected
> end state" is written so it is checkable against the repo alone, and it is *identical*
> to the next feature's "assumed starting state." Any cross-cutting decision (naming,
> shared abstractions, endpoint shapes) made while implementing a feature must be
> persisted into the repository (code/tests) or back into this file — context-only
> knowledge does not survive a session boundary.

---

## Where the rollout stands

**The original critical path `F4 → F2 → F5 → F6` is fully merged to `main` and live on the
Pi.** Since the previous reconcile, three more PRs have merged that the old baseline did **not**
record:

- **#21 — event-driven multi-device sync (SSE).** A new `GET /api/events` SSE endpoint + an
  in-process `EventEmitter` (backend) and a `useChoreEvents` hook + `reconcileChores` re-pull
  with a mutation/dialog gate (`App.tsx`). This **changes `App.tsx`** and so is now part of the
  assumed start for every frontend feature — most importantly **F9** (the focus feature) and any
  feature whose optimistic writes must survive a re-pull. Recorded below as a merged non-F item.
- **#19 — Pi display rotation + touch calibration** (deploy/host config only; version-controls
  `kanshi`/`labwc` rotation + touch `calibrationMatrix`). This is the **host-side** half of
  rotation; the in-app **rotate button** (F17) is still pending and builds on this.
- **#20 — plans/ housekeeping** (archive compaction + central findings ledger; no app code).

**There is no longer a single critical path.** The remaining work splits into **three
independent tracks** (frontend chore-list polish, an in-app device-control panel, and an infra
spike), with only soft ordering conventions inside each. The user's **primary focus feature is
F9 (persistent chore-name search filter)** — see *Shortest path to the focus feature* below.

**Already-resolved cleanup.** `feature/progress-bar-decay` (whose decay/urgency bar model shipped
on `main` via `choreBarMath` during the F6 work) **has already been deleted, local and remote** —
it is no longer a branch. It is recorded here only so a cold survey does not resurrect it.

**Branch hygiene — DONE (2026-06-30 `/compact-plans` sweep).** All merged feature branches have
been **pruned, local + remote**: `feature/confirm-delete` (#14), `feature/edit-task` (#15),
`feature/swipe-actions` (#17), `feature/bar-redesign` (#18), `deploy/docker-raspberry-pi` (#13),
`deploy/pi-display-configs` (#19), `chore/plans-housekeeping` (#20),
`claude/mobile-pi-device-sync-is0teg` (#21), and the remote-only
`claude/dependabot-vulnerabilities-kk09n2` (#16). (Most remote branches were already auto-deleted
on merge; the local refs + the lingering `chore/plans-housekeeping` remote ref were removed in the
sweep.) Only `main` remains, local and remote. None carried unmerged work.

### Remaining work — three tracks

```
Frontend chore-list track (default order; disjoint surfaces, soft order):
    F7 (deck blur, S) ─→ F3 (room datalist, S) ─→ F9 (chore search, M ★FOCUS) ─→ F1 (remove fields, M · cleanup last)
    F10 (swap swipe dirs + 25% reveal, M) ── touches ChoreTimerBar only; independent of the above

Device-control panel track (new; F11 gates the rest):
    F11 (settings panel container, M) ─→ { F17 rotate (L, plan exists) · F15 undo · F16 redo · F12 brightness · F13 screen-blank · F14 restart }
                                          (F12–F16 ship as inert placeholder icons first, connected later)

Infra track:
    F8 (local URL alias, M–L · research-first) ── independent; different surface entirely
```

- **Frontend chore-list track:** F7/F3/F9/F1 touch disjoint surfaces (footer deck / Room field /
  list header / Details+Long-term+schema); F10 touches only `ChoreTimerBar`. Internal order is
  flexible, with **F1 deliberately last** (it removes form fields + migrates the live SQLite DB).
- **Device-control panel track:** **F11 (the panel container) gates F12–F17** — they are housed in
  it. The panel ships with **F17 (rotate)** functional and the rest as disconnected placeholder
  icons; each placeholder is later connected as its own feature.
- **Infra track:** **F8** is LAN name resolution on the Pi/Docker deploy surface — shares no files
  with app code; runs anytime. Least-confident estimate (framed as "Explore options"); spike first.

### Shortest path to the focus feature (F9 — chore-name search filter)

**F9 has no prerequisites.** It composes downstream of `App.tsx`'s existing
`useRoomFilter(choreData, selectedRoom) → filteredChores → orderedChores` pipeline (verified at
`App.tsx:128–134`) and the now-merged SSE `reconcileChores` re-pull. The shortest path is therefore
**a single hop — implement F9 directly as the next session.**

- **Do not** route F7/F3/F1 ahead of it: they touch disjoint surfaces and unlock nothing F9 needs,
  so prepending them is pure churn against the focus goal.
- **Do not** pull the device-control track (F11–F17) or F8 into the path; they are orthogonal.
- **Only integration note (no new dependency):** F9 must be a **view-only** filter derived from
  `filteredChores` (room first, then case-insensitive substring on `name`) so it ANDs with the room
  filter and **survives an SSE re-pull** — it must not mutate `choreData`/`sortedIds` or fight
  `reconcileChores`. This is the lone interface F9 inherits from the merged SSE work.

---

## Summary table

### Completed (merged to `main` — history; effort recorded as built)

| Rank | Feature | Effort | PR | Merge SHA |
|---|---|---|---|---|
| F4 | Confirm intent before delete | **S** | [#14](https://github.com/4IRL/chores4irl/pull/14) | `e30c2b2` |
| F2 | Edit Task functionality | **L** | [#15](https://github.com/4IRL/chores4irl/pull/15) | `06e0b00` |
| F5 | Swipe left=delete / right=edit | **XL** | [#17](https://github.com/4IRL/chores4irl/pull/17) | `0d05453` |
| F6 | Reduce bar height / spread details | **M** | [#18](https://github.com/4IRL/chores4irl/pull/18) | `3a30a42` |

### Merged since last reconcile (non-F — infra/parallel, no backlog F-ID)

| Feature | Effort | PR | Merge SHA | Notes |
|---|---|---|---|---|
| Multi-device sync via SSE | **M** | [#21](https://github.com/4IRL/chores4irl/pull/21) | `42040cc` | New `GET /api/events`; `useChoreEvents` + `reconcileChores` in `App.tsx`. **Now part of the baseline.** |
| Pi display rotation + touch calibration | **M** | [#19](https://github.com/4IRL/chores4irl/pull/19) | `c4153a9` | Host-side rotation config; the in-app rotate button (**F17**) builds on it. |
| plans/ archive housekeeping | **S** | [#20](https://github.com/4IRL/chores4irl/pull/20) | `b823ad4` | Docs/process only. |

### Remaining (reassessed against current `main`)

| Order | Feature (260630 list item) | Effort | Depends on | Track |
|---|---|---|---|---|
| ★ | **F9** — Persistent chore-name search filter (item 5) **[FOCUS]** | **M** | — | Frontend chore-list |
| 1 | **F7** — Translucent/blur *Add Task* deck (item 3) | **S** | — | Frontend chore-list |
| 2 | **F3** — Type-as-you-search *Room* dropdown (item 2) | **S** *(native `<datalist>`)* | F2 *(merged)* | Frontend chore-list |
| 3 | **F1** — Remove *Details* & *Long-term task* fields (item 1) | **M** | F2 *(merged)*; run **after F3** | Frontend + backend + DB migration |
| 4 | **F10** — Swap swipe dirs (left=edit/right=delete) + 25% reveal (item 6) | **M** | F5/F6 swipe infra *(merged)*; **modifies F5's contract** | Frontend chore-list |
| 5 | **F11** — Settings / device-control panel container | **M** | — *(gates F12–F17)* | Device-control panel |
| 6 | **F17** — Rotate screen button (functional, host-bridge) | **L** | **F11**; Pi rotation config (#19, merged) | Device-control panel |
| 7 | **F15** — Undo (placeholder→functional) | **S→M–L** | **F11** | Device-control panel |
| 8 | **F16** — Redo (placeholder→functional) | **S→M** | **F11**, F15 | Device-control panel |
| 9 | **F12** — Brightness control (placeholder→functional) | **S→M** | **F11**; host-bridge | Device-control panel |
| 10 | **F13** — Screen blank/wake toggle (placeholder→functional) | **S→M** | **F11**; host-bridge | Device-control panel |
| 11 | **F14** — Restart (placeholder→functional) | **S→M** | **F11**; host-bridge + confirm | Device-control panel |
| — | **F8** — Local URL alias instead of IP:port (item 4) | **M–L** *(research spike)* | deployment stack (Pi/Docker); independent | Infra (parallel) |

**Effort tally (remaining).** Frontend chore-list track: F9 (M) + F7 (S) + F3 (S) + F1 (M) + F10
(M) ≈ **8 pts**. Device-control track (placeholder ship): F11 (M) + F17 (L) + 5 × placeholder (S)
≈ **10 pts**, growing as each placeholder is connected (each +M). Infra: F8 ≈ **2–3 pts**.
(S=1 / M=2 / L=3 / XL=5.) The **focus path is just F9 (M, ≈2 pts)** — everything else is off it.

---

## Status ledger

> **Authority note.** Git is the source of truth: a feature is *actually* done only when
> its PR is **merged to main** and its "Expected end state" facts verify against the
> merged tree. **This table is a human-readable mirror, not the authority** — on any
> conflict, the verified repo state wins. Each session updates its own row as part of its
> final commit. Statuses: `pending` → `in-progress` → `in-review` (PR open) → `merged`.

| Feature | Status | Branch | PR | Merge SHA |
|---|---|---|---|---|
| F4 — confirm-delete | **merged** | `feature/confirm-delete` *(pruned 2026-06-30)* | [#14](https://github.com/4IRL/chores4irl/pull/14) | `e30c2b2` |
| F2 — edit task | **merged** | `feature/edit-task` *(pruned 2026-06-30)* | [#15](https://github.com/4IRL/chores4irl/pull/15) | `06e0b00` |
| F5 — swipe actions | **merged** | `feature/swipe-actions` *(pruned 2026-06-30)* | [#17](https://github.com/4IRL/chores4irl/pull/17) | `0d05453` |
| F6 — bar redesign | **merged** | `feature/bar-redesign` *(pruned 2026-06-30)* | [#18](https://github.com/4IRL/chores4irl/pull/18) | `3a30a42` |
| *(non-F)* SSE multi-device sync | **merged** | `claude/mobile-pi-device-sync-is0teg` *(pruned 2026-06-30)* | [#21](https://github.com/4IRL/chores4irl/pull/21) | `42040cc` |
| *(non-F)* Pi rotation/touch config | **merged** | `deploy/pi-display-configs` *(pruned 2026-06-30)* | [#19](https://github.com/4IRL/chores4irl/pull/19) | `c4153a9` |
| *(non-F)* plans housekeeping | **merged** | `chore/plans-housekeeping` *(pruned 2026-06-30)* | [#20](https://github.com/4IRL/chores4irl/pull/20) | `b823ad4` |
| **F9 — chore search filter** ★FOCUS | pending | `feature/chore-search-filter` | — | — |
| F7 — translucent deck | pending | `feature/translucent-add-deck` | — | — |
| F3 — room typeahead | pending | `feature/room-typeahead` | — | — |
| F1 — remove Details/Long-term | pending | `feature/remove-details-longterm` | — | — |
| F10 — swap swipe directions | pending | `feature/swipe-direction-swap` | — | — |
| F11 — device-control panel | pending | `feature/settings-panel` | — | — |
| F17 — rotate screen button | pending | `feature/rotate-screen-button` *(plan exists)* | — | — |
| F15 — undo | pending | `feature/undo` | — | — |
| F16 — redo | pending | `feature/redo` | — | — |
| F12 — brightness control | pending | `feature/brightness-control` | — | — |
| F13 — screen blank/wake | pending | `feature/screen-blank-toggle` | — | — |
| F14 — restart control | pending | `feature/restart-control` | — | — |
| F8 — local URL alias | pending | `feature/local-url-alias` | — | — |
| ~~progress-bar-decay~~ | **deleted** (was superseded; functionality on `main`) | *(branch gone)* | — | — |

**Ledger update protocol (per session):**
1. On start, after the cold survey, set this feature's row to `in-progress`.
2. After `git-push` opens/updates the PR, set it to `in-review` and fill the **PR** link.
3. The status reaches `merged` (with the **Merge SHA**) only when the PR lands on main —
   set by whoever merges (you, or the next session if it observes the merge during its
   cold survey). A session **must not** mark its own feature `merged` before the PR is
   actually merged.
4. The ledger edit rides in the feature's own commits/PR; never hand-edit it to a state
   the repo cannot back up.

---

## Baseline: the codebase as it exists today (`main` after F4/F2/F5/F6 **+ SSE #21 + Pi-config #19**)

> **This Baseline reflects `main` after the four F-features *and* the SSE multi-device-sync (#21)
> and Pi rotation config (#19) merged.** It is the literal current state and the **assumed
> starting state for every remaining feature**. Earlier revisions described a pre-SSE baseline —
> that is now historical; ignore it.

Monorepo using **npm workspaces** (`frontend`, `backend`) with shared types at the repo root.

**Stack**
- **Frontend** (`frontend/`): React 19 + Vite 6 + Tailwind 4, `date-fns`, `lucide-react@^1.8.0`, **`react-swipeable@^7.0.2`** (added by F5). Entry `frontend/src/App.tsx`.
- **Backend** (`backend/`): Express + `better-sqlite3`, TypeScript ESM. Entry `backend/src/server.ts`; app `backend/src/app.ts`; data access `backend/src/chores.ts`; schema+seed `backend/src/db.ts`; **SSE event bus added by #21** (in-process `EventEmitter`, emits on every successful write).
- **Shared types**: `types/SharedTypes.d.ts` — declaration-only, imported as `import type` (alias `@customTypes/SharedTypes`).
- **SQLite**: file `data.db` (WAL). Schema is created with `CREATE TABLE IF NOT EXISTS` in `db.ts` — **there is no migration framework**; an existing `data.db` (local and on the deployed Pi) is *not* altered by editing the `CREATE TABLE` text. **(This is the constraint F1 must solve with an explicit idempotent column-drop migration.)**
- **Path aliases** (from F-history): `@customTypes/*`, `@utils/*` (the latter added with `choreBarMath`).

**Domain model** (`Chore`): `id, name, details?, room, dateLastCompleted, duration, frequency, urgency?, longTermTask?`. The DB `chores` table columns: `id, name, details, room, date_last_completed, duration, frequency, urgency, long_term_task`. **`details` and `long_term_task` are still present — F1 has not run.** `urgency` is retained permanently.

**Backend routes** (`app.ts`): `GET /api/chores`, **`GET /api/events`** (SSE doorbell stream — emits a `changed` event to all connected clients on every successful write; added by #21), `POST /api/chores`, **`PUT /api/chores/:id`** (full-replace edit, added by F2 — 200 / 400 `Invalid id` / 400 `Missing required fields` / 404 `Chore not found` / 500), `PATCH /api/chores/:id/complete`, `DELETE /api/chores/:id`. CORS `Access-Control-Allow-Methods` includes `PUT`. Tests for the SSE bus live at `backend/src/__tests__/events.test.ts`.

**Frontend API** (`frontend/src/services/choreApi.ts`): `fetchAllChores`, `addChore`, **`updateChore(id, chore)`** (added by F2), `completeChore`, `removeChore`.

**Key UI**
- `App.tsx` — orchestrator: holds `choreData`, `sortedIds`, day-simulation, room filter (`uniqueRooms` derived; `useRoomFilter(choreData, selectedRoom)`); handlers `handleAddChore`, `handleCompleteChore`, `handleDeleteChore`, plus F2's edit trio (`editingId` state + derived `editingChore`; `handleRequestEdit`/`handleCancelEdit`/`handleEditChore`, optimistic update + rollback; `sortedIds` not re-run on edit). Add/edit modals are mutually exclusive (`!showForm && editingChore`). Footer deck (`flex-shrink-0 py-4 flex justify-center border-t border-gray-700`, **opaque**, `App.tsx:261`) holds `AddChoreButton`; scroll area directly above is `flex-1 overflow-y-auto min-h-0` (`App.tsx:258`). `NavBar` renders the room chips above the list. **There is no chore-name search input yet (F9 adds it).**
  - **SSE sync (#21) — now in `App.tsx`:** subscribes via `useChoreEvents(onChange)` (`hooks/useChoreEvents.ts`, `new EventSource('/api/events')` + `visibilitychange→visible` re-fire). On signal it calls `reconcileChores(fetched)` — order-preserving (`setChoreData` + reconcile `sortedIds`: keep present ids, append newly-seen sorted via `orderChores`, drop vanished). Re-pulls are **gated** by `isRepullGated()` (`isMutatingRef` || `showForm` || `editingId` || `pendingDeleteId`); a deferred refresh fires via `pendingRefreshRef` once the gate clears. `choreDataRef`/`simulatedDateRef` mirror live state for these out-of-render callbacks. **Any new frontend feature touching `App.tsx` state must not break this gate or the reconcile.**
  - **Visible-list pipeline (the surface F9 extends):** `filteredChores = useRoomFilter(choreData, selectedRoom)` → `orderedChores = useMemo(() => { const map = new Map(filteredChores.map(c => [c.id, c])); return sortedIds.map(id => map.get(id)).filter(Boolean) })` → `<ChoreList chores={orderedChores} … />` (`App.tsx:128–134, 258–260`).
- `components/chore/ChoreTimerBar.tsx` — **F6-redesigned**: shorter bar (`h-20 sm:h-16`), `grid grid-cols-3 items-center` spread (name left / frequency center / completion right), **room not displayed**, **no `OverdueBadge`** (deleted; overdue conveyed by bar fill/color + an `sr-only` "Overdue" cue). Bar math comes from `@utils/choreBarMath` `computeBar(daysSince, frequency)`. **Swipe gestures** via `react-swipeable` `useSwipeable` spread (`{...swipeHandlers}` **before** explicit props) on the root `<div>` (which carries `touch-pan-y`): **swipe-left → `onDelete`** (through F4's `ConfirmDialog`), **swipe-right → `onEdit`** (F2's modal); config `delta: 50`, `trackMouse: true`; both `isSimulating`-guarded; a `swipingRef` suppresses the trailing post-swipe click. Tap-to-complete (`onClick`) preserved. Delete/edit buttons are `sr-only` keyboard/AT fallbacks. *(F10 will reverse these directions, add a progressive action-reveal, and a 25% confirm threshold.)*
- `components/common/ConfirmDialog.tsx` (F4) — portal/backdrop confirm dialog (`confirm-dialog-*` testids), reused by the swipe delete path.
- `components/form/` — `ChoreFormModal` → **`ChoreForm`** (the shared add/edit form, F2) → `FormField`. The shared form currently renders a **Details** `FormField` (`ChoreForm.tsx:76`), a plain-text **Room** `FormField` (`ChoreForm.tsx:77`, **F3 target**), and a **Long-term task** checkbox (`ChoreForm.tsx:99–104`, **F1 target**). `AddChoreButton` is the `+ Add Task` button. See the F2 contract below for exact props.

**Tests**
- **Vitest** unit tests both sides: `frontend/src/__tests__/**` (components, hooks, services, utils; fixtures at `__tests__/fixtures/chore.ts`, e.g. `makeChore`; `ChoreTimerBar.barMath.test.ts` covers `computeBar`) and `backend/src/__tests__/**` (`chores.test.ts`, `routes.test.ts`, `db-path.test.ts`, **`events.test.ts`** for the SSE bus). Backend tests use `TEST_DB_PATH=:memory:`.
- **Playwright e2e**: `e2e/smoke.spec.ts` (root `npm run test:e2e`). Depends on seed chore **`Vacuum Bedroom Floor`**, the `+ Add Task` flow, and **F6 delete/edit via swipe** (`swipeBar(page, bar, 'left'|'right')`) with the `sr-only [aria-label="Delete chore"]` button invoked via `dispatchEvent('click')` in cleanup loops; confirm via `getByTestId('confirm-dialog-confirm')`. **There is no `OverdueBadge` / room text / visible `✕` selector anymore.**
- **CI**: `.github/workflows/ci.yml` runs backend + frontend tests on PRs to `main`; `main` is branch-protected (PR + review + CI required). All feature work happens on `feature/*` branches and merges via PR.

**Standing invariants now baked into `main` (must not regress):**
1. Delete routes through `ConfirmDialog` (F4).
2. `PUT /api/chores/:id` + `updateChore` client + shared `ChoreForm` + edit-mode modal (F2).
3. `react-swipeable` gestures + tap-to-complete + simulation guard + `{...swipeHandlers}`-before-explicit-props spread order + `touch-pan-y` (F5). *(Directions are reversed by F10 — the **infrastructure** invariant holds; the **direction** is F10's to flip.)*
4. Shorter `h-20 sm:h-16` grid bar; room/overdue-badge/visible-buttons removed; swipe is the sole *visible* delete/edit affordance with `sr-only` fallbacks; decay/urgency model in `choreBarMath` (F6).
5. **SSE re-pull (#21):** `GET /api/events` + `useChoreEvents` + gated `reconcileChores`. New writes must emit on the backend bus; new `App.tsx` features must not break `isRepullGated()` or the order-preserving reconcile.

**Assumptions to revisit at planning time**
1. `better-sqlite3` bundles SQLite ≥ 3.35 (supports `ALTER TABLE ... DROP COLUMN`, needed by **F1**). Verify at F1 planning (`SELECT sqlite_version()`), else fall back to a table-rebuild migration.
2. Tap-to-complete + the simulation pointer-events guard + the SSE re-pull gate are primary; no new feature may regress them.
3. `details` is **not** rendered anywhere in the UI (only stored), so F1's removal is display-safe.
4. **F8, F17, and the host-bridge controls (F12/F13/F14) have end states partly outside the repo** (Pi/LAN/host config). Capture their outcomes as deployment docs in **the feature's own `plans/feature/<slug>/` plan dir** so they remain repo-anchored despite touching little/no app code. (The original Dockerization plan is now frozen at `plans/completed/docker-raspberry-pi/` — read it for the existing stack, but write *new* deploy docs in the live feature dir.)
5. **F11–F17 are kiosk-only** (the wall-mounted Pi). The settings panel and its host-bridge controls are not expected to do anything meaningful on a phone/desktop browser; design them to degrade gracefully (placeholder icons render inert).

---

## Per-feature session contract (the procedure every feature session runs)

Each feature is handled in **one dedicated session** that performs the steps below and
then **ends**. A separate driver (or the user) starts a fresh session for the next
feature. `run-plan` is invoked **exactly once per session, on this feature's own plan
— never nested, never on this manifest.**

1. **Cold survey & verify start.** With no memory of prior features, independently
   survey the repo and confirm it matches *this feature's* "Assumed starting state"
   (which, for every remaining feature, is the **Baseline** above). The starting state is
   expressed as repo-checkable facts (files, grep results, routes). **If the repo diverges,
   stop and reconcile before proceeding.**
2. **Branch.** Create/checkout the feature branch named in the feature section
   (`feature/<slug>`). `topic_inference` maps this prefix to `plans/feature/<slug>/`.
3. **Plan.** Use **create-plan** (`/plan-creator`) to produce the implementation plan,
   taking this feature's "Assumed starting state" and "Expected end state" as the given
   contract. Resolve the feature's "Open risks / decisions" during planning.
4. **Review.** Use **review-plan** (`/plan-reviewer`) to validate the plan; apply its
   corrections before implementing.
5. **Implement.** Use **run-plan** (`/run-plan`) once on this feature's plan to execute
   all steps.
6. **Commit.** Use **git-commit** to atomize the work into coherent, individually
   committable chunks; run its self-review cycles and apply the corrective actions it
   prescribes.
7. **Verify end state.** Confirm the repo now satisfies this feature's "Expected end
   state" (run the relevant Vitest + e2e suites; check the listed grep/route facts).
   Reconcile any gap before publishing.
8. **Publish checkpoint.** Use **git-push** (`/git-push`) to run the parallel review and
   open/update the PR — the durable checkpoint that hands state to the next feature.

The session then ends.

**Cross-session persistence rule.** Anything a later feature relies on — endpoint shapes,
component/prop names, the chosen room-input mechanism, the search-filter wiring, the panel's
control-registration shape — must live in the committed code/tests or be written back into this
file. If a session makes a decision that changes a *later* feature's assumed start, update that
later feature's section here in the same PR.

---

## How to run a session (invocation)

Each feature is **one fresh Claude Code session**. Start on an up-to-date checkout of `main`
(`git checkout main && git pull`) and paste a kickoff prompt. The session reads this file,
runs **exactly one** feature's contract, and ends at the pushed PR. It never chains into the
next feature — that is a new session, started by you after the prior PR is merged.

**Running several features at once.** Independent features (disjoint file surfaces — see the
**Chain integrity** map) can be implemented concurrently in **git worktrees**, one session per
worktree. Use `plans/WORKTREE-PARALLELIZE-PROMPT.md` to verify the chosen F-IDs cannot
merge-conflict and to provision the worktrees; implementation still runs each feature's own
Per-Feature Session Contract, and the merge gate stays serial.

**Why a human gate exists between sessions.** `main` is branch-protected (PR + review + CI
required), so a session can only reach "PR pushed." **You merge the PR**; that merge is the
durable signal that lets the next session's cold survey pass.

**Kickoff prompt — explicit (recommended):**
```
Read META-PLAN.md. Run feature <F-id> (e.g. F9) and only that feature. Follow its
Per-Feature Session Contract: cold-survey and verify the repo matches the Baseline / that
feature's "Assumed starting state" (STOP and report if it diverges), set its Status ledger
row to in-progress, then create-plan → review-plan → run-plan (once) → git-commit → verify
"Expected end state" → update the ledger row to in-review with the PR link → git-push. End
the session after the PR is pushed. Do not start any other feature.
```

**Kickoff prompt — focus feature (recommended next session):**
```
Read META-PLAN.md. Run feature F9 (persistent chore-name search filter) and only F9.
It has no prerequisites — implement it directly. Per its Per-Feature Session Contract:
cold-survey against the Baseline (verify GET /api/events + useChoreEvents are present and
the filteredChores→orderedChores pipeline is intact), then create-plan → review-plan →
run-plan (once) → git-commit → verify "Expected end state" → git-push. End after the PR.
```

**Skill mapping:** create-plan → `/plan-creator`; review-plan → `/plan-reviewer`; run-plan →
`/run-plan` (once, on this feature's plan only); then `/git-commit` and `/git-push`.

**Between sessions — monitoring:** `gh pr list` / `gh pr view <n>`; `gh pr checks <n>`;
`reviews/push-review-<branch>.md` (written by `/git-push` if its review *rejects*);
`git log --oneline origin/main`; the **Status ledger** above (trust git if they disagree).

---

# COMPLETED FEATURES (merged to `main` — recorded for the contracts later features depend on)

> These are **done**. Their "Implemented contract" notes are preserved because the remaining
> features build on them (F1/F3 target F2's shared `ChoreForm`; F1 must also clean F2's
> `PUT`/`updateChore` path; F10 reverses F5's swipe directions; every `App.tsx` feature inherits
> the SSE re-pull). Do not re-run them.

## F4 — Require confirmation before deleting a chore  ·  merged (#14, `e30c2b2`)
Delete routes through `ConfirmDialog` (`frontend/src/components/common/ConfirmDialog.tsx`,
portal/backdrop, `confirm-dialog-*` testids). `App` owns the confirm state; optimistic
delete + rollback preserved after confirm. **Reused by F5's swipe path.**

## F2 — Edit Task functionality  ·  merged (#15, `06e0b00`)
**Implemented contract (as built — F3/F1 target this):**
- **Shared form:** default export **`ChoreForm`** at `frontend/src/components/form/ChoreForm.tsx` (renamed from `AddChoreForm` via `git mv`). Props: `{ mode?: 'add' | 'edit'; initialChore?: Chore; onSubmit: (chore: Omit<Chore,'id'>) => void; onCancel: () => void }` (default `mode='add'`). Internal helper `choreToFormState(chore)` does the inverse `Chore → FormState` mapping; post-submit reset is gated to add mode. **F3 (room input) and F1 (remove Details/Long-term) target this single component.** Its only importer is `ChoreFormModal`. Title copy: `mode === 'edit' ? 'Edit Chore' : 'Add New Chore'`.
- **Modal:** `ChoreFormModal` accepts `{ mode?, initialChore?, onSubmit, onCancel }` and forwards `mode`/`initialChore` to `ChoreForm`. The form emits `Omit<Chore,'id'>`; App supplies the id.
- **Backend:** `PUT /api/chores/:id` (full replace, 200 / 400 `Invalid id` / 400 `Missing required fields` / 404 `Chore not found` / 500); `backend/src/chores.ts` exports `updateChore(id, input): ChoreWire | null`; CORS `Access-Control-Allow-Methods` includes `PUT`. **F1 must de-reference `details`/`longTermTask` from both `createChore` and `updateChore`, and both `POST` and `PUT` handlers.**
- **API client:** `choreApi.ts` exports `updateChore(id, chore): Promise<Chore>`.
- **App:** `editingId` state + derived `editingChore`; `handleRequestEdit`/`handleCancelEdit`/`handleEditChore` (optimistic update + rollback; `sortedIds` not re-run on edit). Add/edit modals mutually exclusive.

## F5 — Swipe behaviors (left = delete, right = edit)  ·  merged (#17, `0d05453`)
**Implemented contract (as built):** `react-swipeable@^7.0.2` via `useSwipeable`; handlers
spread `{...swipeHandlers}` **before** explicit `data-testid`/`className`/`onClick` on the
`ChoreTimerBar` root `<div>` (config `delta: 50`, `trackMouse: true`,
`preventScrollOnSwipe: false`). **Swipe-left → `onDelete`** (through F4's `ConfirmDialog`),
**swipe-right → `onEdit`** (F2's modal); both `isSimulating`-guarded. Root keeps `onClick`
(tap-to-complete) + `touch-pan-y`; a `swipingRef` set only in `onSwipedLeft/Right` and cleared
in `onTouchStartOrOnMouseDown` suppresses the trailing post-swipe click.
**⚠ F10 reverses these directions** (left=edit, right=delete), adds a progressive action-reveal,
and a 25% confirm threshold — **F10 must preserve the swipe *infrastructure* (spread order,
`touch-pan-y`, simulation guard, `swipingRef` click-suppression) while flipping the direction
mapping.**

## F6 — Reduce bar height / spread details  ·  merged (#18, `3a30a42`)  ·  ORIGINAL CRITICAL-PATH GOAL
Bar is now `h-20 sm:h-16`, `grid grid-cols-3 items-center` (name left / frequency center /
completion right); **room removed**; **`OverdueBadge.tsx` deleted** (overdue → bar fill/color
+ `sr-only` "Overdue" cue); the visible `✕`/pencil buttons are gone, replaced by **`sr-only`
keyboard/AT-fallback buttons** (`aria-label="Delete chore"` / `"Edit chore"`,
`focus:not-sr-only`). Bar math/urgency live in `@utils/choreBarMath` (`computeBar`). e2e
rewritten to delete/edit via swipe + the `sr-only` button. *(The progress-bar decay model that the
now-deleted `feature/progress-bar-decay` branch proposed is part of this shipped `choreBarMath`.)*

## (non-F) Multi-device sync via SSE  ·  merged (#21, `42040cc`)
**Implemented contract (every `App.tsx` feature inherits this):**
- **Backend:** in-process `EventEmitter`; every successful write (`POST`/`PUT`/`PATCH .../complete`/`DELETE`) emits a change. **`GET /api/events`** streams a `changed` SSE doorbell to all connected clients (one-directional, plain text). Tests at `backend/src/__tests__/events.test.ts`.
- **Frontend:** `frontend/src/hooks/useChoreEvents.ts` (`new EventSource('/api/events')`; callback held in a ref; re-fires on `visibilitychange → visible` because phones suspend the stream). `App.tsx` subscribes and on signal runs `reconcileChores(fetched)` — order-preserving (keep present ids, append newly-seen sorted, drop vanished). Re-pulls are **gated** (`isRepullGated()` = mutating || form/edit/delete dialog open); deferred via `pendingRefreshRef`. `choreDataRef`/`simulatedDateRef` carry live state into the out-of-render callback.
- **Obligation for later features:** any new write path must emit on the bus; any new `App.tsx` state that holds uncommitted/optimistic user input must be added to the `isRepullGated()` predicate so a stray signal can't clobber it.

---

# REMAINING FEATURES

> Every remaining feature's **Assumed starting state is the Baseline above**. They touch disjoint
> surfaces; if you re-sequence them, update any affected assumed-start/expected-end facts here **in
> the same PR**. The **focus feature is F9** — its session can run next with no prerequisites.

## F9 — Persistent chore-name search filter  ·  ★ FOCUS  ·  Effort M  ·  (260630 item 5)

**Goal.** Add a type-as-you-search text input **persistently at the top of the chores list**,
independent of the highlighted room. Chores are filtered out of view by substring match on the
name entered, so users can quickly find a chore to update once the list grows. Include a
magnifying-glass icon and placeholder text **"Search for a chore"** so the field's intent is clear.

**Rank rationale.** The user's primary focus. Self-contained frontend feature with **no dependency
on any other remaining feature**; sits above the existing room filter and composes with it. Medium
because it adds a new persistent UI element + filter state that must **AND** with the existing room
filter, stay pinned while the list scrolls, and **survive the SSE re-pull** without mutating state.

**Effort: M.** Cost drivers: a new search-input component (lucide-react `Search` icon +
placeholder), filter state in `App.tsx`, composing the substring filter with the existing
`useRoomFilter`/`selectedRoom` path **without** disturbing `sortedIds` ordering, the day-simulation,
or `reconcileChores`, keeping the input pinned above the scroll region, and tests. lucide-react is
already installed.

**Dependencies.** None. (Uses `App.tsx`'s existing `choreData` + room-filter pipeline + SSE re-pull, all merged.)

**Assumed starting state** = **Baseline**. Verify:
- `App.tsx` derives `filteredChores = useRoomFilter(choreData, selectedRoom)` and builds `orderedChores` by mapping `sortedIds` over a `Map` of those (`App.tsx:128–134`).
- `NavBar` renders room chips above the list; the scroll area is `flex-1 overflow-y-auto min-h-0` (`App.tsx:258`). **No chore-name search input exists.**
- `useChoreEvents` + `reconcileChores` are wired (the filter must be derived state, not stored in `choreData`).
- `lucide-react` is a dependency (the `Search` icon is available).

**Expected end state** (repo-checkable):
- A persistent search `<input>` (with a `Search` magnifying-glass icon and `placeholder="Search for a chore"`) renders **above the chores list, outside the `overflow-y-auto` scroll region**, visible regardless of the selected room.
- Typing filters the visible chores to those whose **name** contains the entered substring (case-insensitive), **composed with** the room filter (both apply). Clearing restores the room-filtered list.
- The filter is **view-only** — derived from `filteredChores` (e.g. a `searchFilteredChores` feeding the `orderedChores` map). It does **not** mutate `choreData`, `sortedIds`, completion, the day-simulation, or interfere with `reconcileChores`; sort order among matches is unchanged; an SSE re-pull leaves the query intact.
- Empty-result state is handled gracefully (no crash; existing empty-list rendering or a brief "no matches" cue).

**Test-suite deltas.** Component test for the search input (icon + placeholder render; typing
filters). App-level test: substring filter ANDs with room filter; clearing restores; ordering
preserved; **a simulated SSE re-pull does not drop the active query**. e2e: optionally type in the
search box and assert a non-matching seed chore hides.

**Open risks / decisions.** (a) **Where the filter composes** — default: derive
`searchFilteredChores` from `filteredChores` (room first, then substring) feeding the `orderedChores`
map; do **not** thread the query into `sortedIds` or `reconcileChores`. (b) Match scope — default:
chore **name** only (per the list); `room`/`details` excluded. (c) Case-insensitive. (d) Debounce —
default none (list is small). (e) Query **persists** across room switches (the point is cross-room
lookup) and across SSE re-pulls.

**Session loop.** Run the Per-Feature Session Contract on branch `feature/chore-search-filter`.

---

## F7 — Translucent / blur *Add Task* button deck  ·  Effort S  ·  (260630 item 3)

**Goal.** Make the bottom *Add Task* deck use a transparent, blurred background so the chore
list is faintly visible beneath it (especially on the sides of the button). The button stays
locked at the bottom and remains opaque while the list scrolls beneath.

**Rank rationale.** Fully independent, purely visual quick win; blocks nothing. Lowest risk.

**Effort: S.** A focused layout/CSS change to the footer deck in `App.tsx` plus the button;
verify scroll behavior beneath the blur on mobile viewports.

**Dependencies.** None.

**Assumed starting state** = **Baseline**. Verify:
- `App.tsx` footer deck is `<div className="flex-shrink-0 py-4 flex justify-center border-t border-gray-700">` wrapping `AddChoreButton` (opaque; below the scroll area) at `App.tsx:261`.
- The scroll area directly above is `<div className="flex-1 overflow-y-auto min-h-0">` (`App.tsx:258`).

**Expected end state** (repo-checkable):
- The footer deck uses a semi-transparent background with `backdrop-blur` (e.g. `bg-gray-900/60 backdrop-blur-*`) so chore bars are faintly visible beneath/around the button; the deck no longer fully occludes content at its edges.
- The deck remains pinned at the bottom (`flex-shrink-0`; list still scrolls via the existing `overflow-y-auto` region); `AddChoreButton` itself remains visually opaque/legible.
- No functional/JS behavior change; existing tests still pass.

**Test-suite deltas.** Minimal. Optionally assert the deck's blur/translucency classes in a
small App/AddChoreButton render test. No e2e change.

**Open risks / decisions.** Exact opacity/blur values and whether `AddChoreButton` keeps any
existing `bg-opacity-*` — **default: make the *deck* translucent+blurred and the *button* fully
opaque.** Confirm `backdrop-blur` performs acceptably on the target Pi/mobile browser.

**Session loop.** Run the Per-Feature Session Contract on branch `feature/translucent-add-deck`.

---

## F3 — Type-as-you-search *Room* dropdown  ·  Effort S  ·  (260630 item 2)

**Goal.** Replace the free-text *Room* input with a type-as-you-search dropdown (autocomplete)
sourced from the rooms already in use, on **both** the Add and Edit forms.

**Rank rationale.** Builds on F2's shared `ChoreForm` (merged), so effectively independent.
Touches only the Room field. **The list explicitly accepts a native `<datalist>`, which drops this
from M to S** — no custom combobox required.

**Effort: S** (down from M). A native `<input list=...>` + `<datalist>` of existing rooms wired
into the shared form (covers both modes at once), plus tests. Free-entry of a new room is inherent
to `<datalist>`.

**Dependencies.** F2's shared `ChoreForm` (merged).

**Assumed starting state** = **Baseline**. Verify:
- The shared `ChoreForm` (default export) is used by both add and edit paths.
- The Room field is currently a plain text `FormField` (`ChoreForm.tsx:77`). *(Details/Long-term fields are still present — F1 has not run; F3 touches only the Room field.)*
- A source of existing rooms is available: `App.tsx` computes `uniqueRooms = Array.from(new Set(choreData.map(c => c.room)))` (`App.tsx:120`).

**Expected end state** (repo-checkable):
- The Room field is a **type-as-you-search dropdown** (native `<datalist>` accepted): typing filters existing-room suggestions; the user can pick a suggestion **or type a brand-new room**; the value flows into the submit payload as `room` (string) exactly as before.
- It appears identically on **both** Add and Edit forms (single shared-form change).
- The suggested-room list is passed in from existing data (e.g. `uniqueRooms` threaded from `App.tsx` through `ChoreFormModal` to `ChoreForm`). Persist the prop/threading in code.
- No schema change — `room` remains a free string the backend already stores.

**Test-suite deltas.** Component test for the room input (renders datalist options, accepts a
new free-text room, emits correct value); update shared-form/modal tests for the new prop;
optionally extend the e2e add flow to pick a room. No backend test change.

**Open risks / decisions.** (a) **Native `<datalist>`** per the list (keeps it S); fall back to a
custom listbox only if datalist's mobile UX proves unacceptable on the Pi (would raise to M). (b)
Must still allow a **new** room (datalist does by default). (c) Reuse `App.tsx`'s `uniqueRooms`.

**Session loop.** Run the Per-Feature Session Contract on branch `feature/room-typeahead`.

---

## F1 — Remove *Details* and *Long-term task* fields  ·  Effort M  ·  CLEANUP (LAST)  ·  (260630 item 1)

**Goal.** Delete the *Details* field and the *Long-term task* toggle from the chore form and
propagate the removal through the shared type, the API layer (both create **and the F2 update
path**), the backend data access, and the SQLite schema/seed — **including a migration of the
already-populated `data.db` on the live Pi.**

**Rank rationale.** Deliberately **last** among the form-touching features: it does not gate
anything, and running it after F3 means it trims the final form surface (post-room-datalist) in
one pass. Its only added cost vs. running earlier is that it must also clean the **`PUT`/
`updateChore` path F2 introduced** (not just create).

**Effort: M.** The change spans type → API (`POST` **and `PUT`**) → backend (`createChore`
**and `updateChore`**) → DB → shared `ChoreForm` → tests (broad but shallow), plus the
**SQLite migration of an already-populated `data.db`** (local + deployed Pi): `CREATE TABLE IF
NOT EXISTS` will not drop existing columns.

**Dependencies.** None as a blocker, but it must reconcile against everything before it —
F2's update path and (if F3 ran first) the F3 room datalist on the shared form.

**Assumed starting state** = **Baseline** (or **F3 end state** if F3 ran first). Verify:
- `types/SharedTypes.d.ts` declares `details?` and `longTermTask?` on `Chore`.
- `backend/src/db.ts` `CREATE TABLE` includes `details` and `long_term_task` (`db.ts:18,24`); `SEED_DATA` rows carry both.
- `backend/src/chores.ts` maps `details`/`longTermTask` in **both** `createChore` and `updateChore`.
- `app.ts` has both `POST` and `PUT /api/chores/:id`, both accepting `details`/`longTermTask`.
- The shared `ChoreForm` renders a *Details* `FormField` (`ChoreForm.tsx:76`) and a `longTermTask` checkbox (`ChoreForm.tsx:99–104`). *(The Room field is plain-text unless F3 ran first, in which case it is the `<datalist>` input — F1 must not disturb it.)*
- `grep -rn "longTermTask\|long_term_task" backend frontend types` returns matches.

**Expected end state** (repo-checkable):
- `grep -rn "longTermTask\|long_term_task" backend frontend types` returns **no matches**; `details` is likewise removed from `Chore`, `db.ts` schema+seed, `chores.ts` (`createChore` **and `updateChore`**), and both `POST` and `PUT` handling. (`urgency` is **retained**.)
- The shared `ChoreForm` no longer renders a Details field or a long-term checkbox; its form state/submit payload drop both. **The F3 room datalist and all F2/F5/F6/SSE behavior are preserved** (F1 touches only these two fields + schema).
- `db.ts` contains an **idempotent migration** that drops `details` and `long_term_task` from an existing `chores` table (guarded by a `pragma table_info('chores')` check), in addition to the cleaned `CREATE TABLE` and seed.
- Backend + frontend Vitest suites pass with the fields removed; `e2e/smoke.spec.ts` still passes.

**Test-suite deltas.** Update `backend/src/__tests__/chores.test.ts` & `routes.test.ts` (drop
long-term/details from create **and update** cases); update frontend shared-form tests and
`fixtures/chore.ts` if they reference the removed fields; **add** a backend test asserting the
migration drops the columns and is idempotent.

**Open risks / decisions.** (a) Confirm `sqlite_version()` ≥ 3.35 for `DROP COLUMN`; else use a
create-new-table-and-copy migration. (b) **Decision: fully delete** `details`. (c) Migration runs
on the Pi's existing `data.db` on next boot — verify on the Pi (**LAN is unreachable from the
sandbox — run Pi checks unsandboxed**). (d) Confirm F2's `updateChore`/`PUT` path is fully
de-referenced.

**Session loop.** Run the Per-Feature Session Contract on branch `feature/remove-details-longterm`.

---

## F10 — Swap swipe directions + 25% action-reveal  ·  Effort M  ·  (260630 item 6 — was 260627 item 8)

**Goal.** Reverse the F5 swipe directions and add a progressive action-reveal with a confirm
threshold: **swipe-left → edit** (reveal a **yellow** background + **white-outline pencil** icon),
**swipe-right → delete** (reveal a **red** background + **white-outline trash-bin** icon). The bar
must shift to reveal the indicator as the user swipes; the action fires **only if the swipe passes
25% of the bar width** from the swipe start, otherwise the bar **animates back** to nominal on release.

**Rank rationale.** Independent of the other frontend features (touches only `ChoreTimerBar`). It
**modifies F5's merged contract** (direction mapping) and extends it with a controlled offset +
visual reveal + threshold — so it is a contract revision, not a brand-new surface.

**Effort: M.** More than a handler swap: it needs a **controlled swipe offset** (track `deltaX`,
translate the bar), a **behind-the-bar action layer** (color + icon that the bar slides to reveal),
**25%-of-width threshold** logic to confirm vs. cancel, and a **spring-back animation** on
sub-threshold release — while preserving the F5 infrastructure (spread order, `touch-pan-y`,
simulation guard, `swipingRef` post-swipe click suppression) and tap-to-complete.

**Dependencies.** F5/F6 swipe infrastructure (merged). No pending-feature dependency.

**Assumed starting state** = **Baseline**. Verify:
- `ChoreTimerBar.tsx` `useSwipeable` has `onSwipedLeft → onDelete`, `onSwipedRight → onEdit`, `delta: 50`, no progressive reveal/threshold (`ChoreTimerBar.tsx:28–32`).
- `onDelete` routes through F4's `ConfirmDialog`; `onEdit` opens F2's modal; both `isSimulating`-guarded; `swipingRef` suppresses the trailing click.
- `lucide-react` provides `Pencil`/`Trash` (or equivalents) for the reveal icons.

**Expected end state** (repo-checkable):
- **swipe-left → `onEdit`**, **swipe-right → `onDelete`** (directions reversed vs. F5).
- During an active swipe the bar translates to reveal an action layer: **left swipe = yellow bg + white-outline pencil**; **right swipe = red bg + white-outline trash**.
- The action fires only when the swipe distance exceeds **25% of bar width**; below that, releasing animates the bar back to its resting position (no action).
- F5 infrastructure preserved: spread-before-explicit-props order, `touch-pan-y`, `isSimulating` guard, `swipingRef` click-suppression, tap-to-complete. Delete still routes through `ConfirmDialog`.
- **e2e updated:** `swipeBar(page, bar, 'left')` now triggers **edit** and `'right'` triggers **delete** (the swipe helpers/expectations in `e2e/smoke.spec.ts` must be flipped to match).

**Test-suite deltas.** Update `ChoreTimerBar` component tests for the reversed mapping + the
threshold (sub-25% cancels, ≥25% fires) + reveal rendering. **Flip the e2e swipe direction
expectations.** Add a test that a sub-threshold swipe does not call `onEdit`/`onDelete`.

**Open risks / decisions.** (a) react-swipeable exposes `eventData.deltaX`/`absX` in
`onSwiping` — drive the offset + threshold from there; `delta:50` (trigger) is separate from the
25%-width confirm. (b) Threshold is **25% of the bar's own width** (measure the element), not a
fixed px. (c) Keep the reveal layer behind the bar (z-order) so the resting bar fully covers it. (d)
Ensure the reversed direction does not desync the `swipingRef` click suppression.

**Session loop.** Run the Per-Feature Session Contract on branch `feature/swipe-direction-swap`.

---

## F11 — Settings / device-control panel (container)  ·  Effort M  ·  (260630 — gates F12–F17)

**Goal.** Add a collapsible **device-control panel**: a single `NavBar` toggle (a gear/settings
icon that swaps to an **X** when open) that expands into a **single-row overlaid banner of
kiosk/device-control icons**. This is the **container** for F12–F17; it ships with the rotate
control (**F17**) functional and the other controls as **disconnected, optimistic icon
placeholders** (rendered, labelled, inert — no backend).

**Rank rationale.** Net-new UI surface that **gates the entire device-control track** — F12–F17 are
housed in it. Independent of the chore-list track. Kiosk-oriented (the wall-mounted Pi).

**Effort: M.** A new panel component + `NavBar` toggle (gear↔X) + open/close state + the overlaid
single-row banner layout, plus a **control-registration shape** that later controls (F12–F17) plug
into. No backend in this feature (placeholders are inert).

**Dependencies.** None (gates F12–F17). Coordinate with **F17**, which already has a detailed plan
(`plans/feature/rotate-screen-button/rotate-screen-button.md`, DD-5) assuming this panel houses the
rotate control — **F11 and F17 may be planned together**, but F11 must land first or in the same PR.

**Assumed starting state** = **Baseline**. Verify:
- `NavBar` (`components/nav/NavBar.tsx`) currently renders only the room chips; there is no settings/gear toggle.
- No settings-panel component exists under `frontend/src/components/`.

**Expected end state** (repo-checkable):
- A `NavBar` toggle renders a gear/settings icon (lucide-react `Settings`) that swaps to an `X` (`X`) when open.
- Toggling opens a **single-row overlaid banner** of device-control icons.
- The panel renders the control set as labelled icons; **F17 (rotate) is functional** if implemented with/after this feature, and the rest (`Sun` brightness, `MonitorOff` screen-blank, `Power` restart, `Undo2` undo, `Redo2` redo) render as **inert placeholders** (present, labelled, no handler/backend).
- A documented control-registration shape so F12–F17 can each wire their handler without re-architecting the panel. Persist it in code/tests.

**Test-suite deltas.** Component test: toggle opens/closes the banner; gear↔X swap; placeholder icons
render and are inert; rotate (if wired here) invokes its handler. No backend test unless F17 lands together.

**Open risks / decisions.** (a) **Panel vs. F17 sequencing** — recommended: plan F11 + F17 together
(the rotate plan assumes the panel) but keep F11's placeholder-only path viable if F17 slips. (b)
Icon set per the 260630 list (`Sun`/`MonitorOff`/`Power`/`Undo2`/`Redo2`, gear `Settings`). (c)
Overlay must not obstruct the chore list permanently (single-row, dismissible). (d) Kiosk-only:
degrade gracefully on phone/desktop.

**Session loop.** Run the Per-Feature Session Contract on branch `feature/settings-panel`.

---

## F17 — Rotate screen button (functional, host-bridge)  ·  Effort L  ·  (260630 — Rotate; plan exists)

**Goal.** A user-facing in-app **rotate** control (housed in the F11 panel) that flips the Pi kiosk's
display + touch orientation between the two **portrait** orientations (`90 ↔ 270`) without editing
host config over SSH.

**Rank rationale.** The one **functional** control the panel ships with. Most involved remaining
feature — a full **host-bridge** (the only one in the backlog with an existing detailed plan).

**Effort: L.** Per `plans/feature/rotate-screen-button/rotate-screen-button.md`: React button →
new Express endpoint → backend writes `rotation.json` into an **rmilarachi-owned bind-mounted host
dir** (separate from the `chores-data` SQLite volume) → a host-side **systemd user service** watches
the file and applies rotation live (`wlr-randr`) + persistently (kanshi config + labwc
`calibrationMatrix`). Builds on the version-controlled Pi rotation config from **#19**.

**Dependencies.** **F11** (the panel houses it) + the Pi deploy stack + the merged #19 rotation/touch
config. **LAN/Pi verification must run unsandboxed** (sandbox cannot reach the Pi LAN).

**Assumed starting state** = **Baseline** + **F11 panel present** + the Pi deployment (with #19's
kanshi/labwc rotation config under version control). The detailed assumed-start/decisions (DD-1…DD-8)
live in `plans/feature/rotate-screen-button/rotate-screen-button.md` — **read that plan; do not
re-derive it.**

**Expected end state** (repo-checkable **+ deploy-doc-anchored**):
- A rotate control in the F11 panel toggles portrait `90 ↔ 270`; landscape (`0`/`180`) intentionally unreachable from the button.
- New Express endpoint + `rotation.json` write path (app code, testable); the host-side watcher service + bind-mount + systemd unit captured as deploy config/docs under `plans/feature/rotate-screen-button/` (the frozen Dockerization plan now lives at `plans/completed/docker-raspberry-pi/`).
- Display and touch stay in sync after rotation (kanshi + labwc `calibrationMatrix`).

**Test-suite deltas.** Backend test for the endpoint + `rotation.json` write (app-side). Host-side
behavior verified manually on the Pi (unsandboxed), documented in the plan/deploy docs.

**Open risks / decisions.** Use the existing plan's decisions verbatim. Key ones: bind-mount vs.
named volume (DD-7: bind-mount required for the non-root user service), portrait-only toggle (DD-8),
host-bridge file-watch mechanism. **Do not re-plan from scratch** — refine the existing plan.

**Session loop.** Run the Per-Feature Session Contract on branch `feature/rotate-screen-button`
(refine the existing plan rather than regenerating it).

---

## F12–F16 — Device-control placeholders (connect later)  ·  housed in F11

> The 260630 settings-panel section ships these as **disconnected, optimistic icon placeholders**
> first (rendered + labelled + inert via **F11**), then connects each as its own feature. Each shares
> the **F11** dependency. Effort is **S as a placeholder** (icon only, lands with F11) and **M (or
> M–L for undo) when connected**. Give each its own session when connecting.

- **F15 — Undo.** Recover from accidental touch/completion. **Functional effort M–L** (needs a
  bounded action/undo cache — wiring `complete`/`edit`/`delete` to be reversible; **1–2 levels deep
  is acceptable** if complexity/cache size is a concern). Placeholder icon `Undo2`. Must reconcile
  with the SSE re-pull (an undo is itself a write that should emit on the bus). Branch `feature/undo`.
- **F16 — Redo.** Re-apply an undone action; pairs with F15's cache (same bounded depth).
  **Functional effort M.** Depends on **F11** + **F15**. Placeholder icon `Redo2`. Branch `feature/redo`.
- **F12 — Brightness control.** Adjust the kiosk backlight from the panel. **Functional effort M** —
  a **host-bridge** mirroring F17 (frontend → backend writes a brightness state file → host agent
  applies it via the backlight sysfs interface or `ddcutil` for the HDMI panel). Placeholder icon
  `Sun`. **Pi verification unsandboxed.** Branch `feature/brightness-control`.
- **F13 — Screen blank / wake toggle.** Manually blank (sleep) or wake the display on demand,
  complementing the auto screen-blank-disable already configured on the Pi. **Functional effort M**
  (host-bridge). Placeholder icon `MonitorOff`. **Pi verification unsandboxed.** Branch
  `feature/screen-blank-toggle`.
- **F14 — Restart.** Trigger a controlled restart (app stack `docker compose restart` and/or the Pi
  host) **behind a confirmation dialog** (reuse F4's `ConfirmDialog`). **Functional effort M**
  (host-bridge + confirm). Placeholder icon `Power`. **Pi verification unsandboxed.** Branch
  `feature/restart-control`.

**Shared expected-end pattern (per control, when connected):** the placeholder icon in the F11 panel
gains a working handler; host-bridge controls (F12/F13/F14) write a state file consumed by a host-side
agent, captured as deploy docs/config so the outcome is repo-anchored; the existing IP:port / kiosk
behavior is never broken; the action (if a write) emits on the SSE bus where relevant.

---

## F8 — Local URL alias instead of IP:port  ·  Infra track (parallel)  ·  Effort M–L (research spike)  ·  (260630 item 4)

**Goal.** Let users on the local network reach the app by a memorable name rather than the raw
IP — e.g. typing `c4i` (or similar) in a browser instead of `[local_IP_address]:[port]`. Explore the
viable options and implement the one that best fits the Pi/Docker deployment.

**Rank rationale.** New, and **entirely separate from the frontend and device-control tracks** — it
touches LAN name resolution / the Pi deployment, not the app's React/Express code. Blocks nothing and
is blocked by nothing. **Least-confident estimate** in this plan (framed as "Explore options").

**Effort: M–L (research-first).** The unknown is the resolution mechanism and how robustly a *bare*
single-label name can be made to work on the target clients. Candidate approaches to evaluate at
planning time (this feature **starts with a spike**, not code):
- **mDNS / Avahi** on the Pi → advertises `c4i.local` (works on most modern OSes; yields a `.local` suffix, **not** a bare `c4i`). Lowest-friction if `.local` is acceptable.
- **LAN DNS** (router static DNS entry, or `dnsmasq` on the Pi as the LAN resolver) → can resolve a bare `c4i` if clients receive an appropriate search domain. More setup; most flexible.
- **hosts-file entries** per device → rejected for not scaling; note only as a fallback.
- Confirm the port: `:80` is HTTP-default, so browsers omit it — the real ask is **name-instead-of-IP**, purely a resolution problem (no app-server change unless a reverse proxy / vhost is introduced).

**Dependencies.** The deployment stack (the Pi, Docker; the live compose/nginx config sits at
the repo root, and the frozen Dockerization plan is at `plans/completed/docker-raspberry-pi/`).
No app-feature dependency.

**Assumed starting state** = **Baseline** + the existing Pi deployment (app served on the Pi at
its LAN IP on port 80). Review the existing deploy setup recorded at
`plans/completed/docker-raspberry-pi/` (and the live compose/nginx config at the repo root)
before planning.

**Expected end state** (repo-checkable **+ deployment-doc-anchored**):
- A documented, reproducible mechanism by which a LAN client reaches the app via a name (`c4i` or `c4i.local`), recorded as deployment docs/config in F8's own `plans/feature/local-url-alias/` plan dir (e.g. an Avahi service file, a `dnsmasq` snippet, or compose/proxy changes) so the outcome is repo-anchored even though it touches no app code.
- The chosen name resolves to the app from at least the primary target client(s); the raw IP:port still works (alias is additive, non-breaking).
- The decision (which mechanism, what name, why) and any client-side caveats (`.local` support, Android quirks) are written into the deployment docs.

**Test-suite deltas.** None in the app test suites. Verification is manual/operational on the Pi +
a LAN client; document the verification steps in the deploy docs.

**Open risks / decisions.** (a) **Bare `c4i` vs `c4i.local`** — single-label names are treated as a
search query by many browsers; `.local` (mDNS) is the low-effort path, bare-name needs LAN DNS. (b)
Client coverage (iOS/Android/Windows/macOS) — mDNS support varies. (c) **Sandbox cannot reach the Pi
LAN** — all Pi/LAN verification must run **unsandboxed**. (d) Keep it additive. (e) Deploy-doc capture
is **mandatory** (end state lives partly outside the repo).

**Session loop.** Run the Per-Feature Session Contract on branch `feature/local-url-alias`
(planning begins with a research spike; "implement" applies the chosen mechanism + docs).

---

## Chain integrity (remaining work)

```
FRONTEND CHORE-LIST TRACK (disjoint surfaces; soft order; ★ = focus)
  Baseline ─F7→ ─F3→ ─★F9★→ ─F1 (cleanup last)
  Baseline ─F10 (swipe swap; ChoreTimerBar only — independent of the row above)

DEVICE-CONTROL PANEL TRACK (F11 gates the rest)
  Baseline ─F11 (panel) ─┬→ F17 (rotate, functional · plan exists)
                         ├→ F15 (undo) ─→ F16 (redo)
                         ├→ F12 (brightness)   ┐
                         ├→ F13 (screen-blank) ├ host-bridge, placeholder→functional
                         └→ F14 (restart)      ┘

INFRA TRACK
  Baseline ─F8 (LAN alias; independent)
```

- **No single hard chain remains.** Arrows in the chore-list track are *recommended* order
  (effort/risk), not requirements — only **F1-after-F3** is a soft convention (both edit
  `ChoreForm`). The **device-control track has one real edge: F11 gates F12–F17** (they are housed in
  the panel; F16 also follows F15). **F8 is fully parallel.**
- **Focus path:** the most-desired feature **F9 is a single hop from Baseline** — implement it next,
  ahead of everything else, with zero prerequisite churn (see *Shortest path to the focus feature*).
- **Cross-feature couplings to honor:**
  - **F3 ↔ F1** both edit the shared `ChoreForm`. If re-sequenced so F1 precedes F3, update F3's "Room field is plain-text" assumed-start and F1's "Room is now a datalist" note **in the same PR**.
  - **F9** composes with the room filter + SSE re-pull but adds no field other features touch.
  - **F10** revises F5's swipe-direction contract — update F5's "Implemented contract" forward-pointer is already in place; F10's PR makes it live and flips the e2e direction expectations.
  - **F11 → F12–F17:** the panel's control-registration shape is the interface; persist it so each control session plugs in without re-architecting.
  - **F17 / F12 / F13 / F14** are host-bridges — their end states are partly outside the repo; capture as deploy docs (Baseline Assumption 4).
  - **F8** shares no files with any of them.
- Cumulative invariants that must hold from each feature onward:
  - From **F9**: a persistent name-search filter above the list, view-only, ANDs with the room filter, survives SSE re-pull.
  - From **F7**: translucent/blurred Add-Task deck, opaque button.
  - From **F3**: Room field is a type-as-you-search `<datalist>` on both forms.
  - From **F1**: no `details` / `longTermTask` / `long_term_task` anywhere (incl. `PUT`/`updateChore`); idempotent column-drop migration in `db.ts`.
  - From **F10**: swipe-left=edit, swipe-right=delete, 25% reveal/threshold with spring-back; F5 infra intact.
  - From **F11**: a NavBar gear↔X toggle opening a single-row device-control banner; control-registration shape in place.
  - From **F17**: in-app portrait rotate via host-bridge; display+touch in sync.
  - From **F8**: a documented LAN name-alias to the app; IP:port still works.

> If any session's cold survey finds the repo does **not** match its assumed start, **stop and
> reconcile** before planning. The repository is the single source of truth across sessions;
> this file records the *intended* order and must be updated in-PR whenever the actual order
> diverges.
