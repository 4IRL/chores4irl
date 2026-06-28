# META-PLAN — chores4irl future-feature rollout

> **What this file is.** An orchestration manifest, not a script. It sequences the
> features in `plans/feature/260627_future_feature_list.md` and defines, for each one,
> a *self-contained* per-feature session that a fresh agent (with no memory of prior
> sessions) can run end-to-end using **only this file and the repository**. This file
> is never run top-to-bottom. It is the index; each feature is a separate session.
>
> **Source list lineage.** `plans/feature/260627_future_feature_list.md` is the **current**
> source of truth for the backlog. It supersedes `plans/feature/260625_future_feature_list.md`
> (the **predecessor**): the four features that have since merged to `main`
> (F4/F2/F5/F6 — see *Completed features*) were removed from the new list, and two new
> features were added (F8 local URL alias, F9 chore search filter). When the two lists
> disagree, **260627 wins**.
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

## Where the rollout stands (the critical path is complete)

**The original critical path `F4 → F2 → F5 → F6` is fully merged to `main` and live on the
Pi.** With the bar redesign (F6) shipped, the gating deliverable is done; everything that
remains is **independent polish + cleanup plus two new features**, with no hard inter-feature
dependency except one soft cleanup-ordering convention (F1 runs last among the form-touching
features). There is no longer a single critical path to drive — this is a **flat backlog**,
prioritized by effort/risk/value rather than by an unlocking chain.

**Superseded branch.** `feature/progress-bar-decay` (plan at `plans/completed/progress-bar-decay.md`)
is **stale and must not be queued**: the decay/urgency bar model it proposed already lives on
`main` (`frontend/src/utils/choreBarMath.ts` — `computeBar` with `remainingRatio`/`growthRatio`,
2× overdue growth, descending `statusColors`) and is live on the Pi. The branch's commits are
**not** in `origin/main`; the functionality landed via the bar work. The branch should be
deleted (local + remote) as a cleanup; it is recorded here only so a future cold survey does
not mistake it for pending work.

### Remaining work — sequencing rationale

Two parallel-capable tracks; within the frontend track, **cleanup (F1) runs last** so nothing
builds on top of removed fields:

```
Frontend track:   F7 (deck blur, S) ─→ F3 (room datalist, S) ─→ F9 (chore search, M) ─→ F1 (remove fields, M · cleanup last)
Infra track:      F8 (local URL alias, M–L · research-first) ── independent; runs anytime, different surface entirely
```

- **F7, F3, F9, F1 touch disjoint frontend surfaces** (footer deck / Room field / list header / Details+Long-term+schema), so their internal order is flexible — the order above is the default, with **F1 deliberately last** (it removes form fields + migrates the live SQLite DB, so running it after F3 means it reconciles the final form surface in one pass).
- **F8 is infra, not app code** — name resolution on the LAN (the Pi/Docker deploy surface). It shares no files with the frontend track and can run in parallel or whenever convenient. It is the **least-confident estimate** in this plan (framed as "Explore options"); treat it as a research spike first.

---

## Summary table

### Completed (merged to `main` — history; effort recorded as built)

| Rank | Feature | Effort | PR | Merge SHA |
|---|---|---|---|---|
| F4 | Confirm intent before delete | **S** | [#14](https://github.com/4IRL/chores4irl/pull/14) | `e30c2b2` |
| F2 | Edit Task functionality | **L** | [#15](https://github.com/4IRL/chores4irl/pull/15) | `06e0b00` |
| F5 | Swipe left=delete / right=edit | **XL** | [#17](https://github.com/4IRL/chores4irl/pull/17) | `0d05453` |
| F6 | Reduce bar height / spread details | **M** | [#18](https://github.com/4IRL/chores4irl/pull/18) | `3a30a42` |

### Remaining (reassessed against the merged-F6 `main`)

| Order | Feature (260627 list item) | Effort | Depends on | Track |
|---|---|---|---|---|
| 1 | **F7** — Translucent/blur *Add Task* deck (item 3) | **S** | — | Frontend |
| 2 | **F3** — Type-as-you-search *Room* dropdown (item 2) | **S** *(↓ from M — native `<datalist>` now accepted)* | F2 *(merged)* | Frontend |
| 3 | **F9** — Persistent chore-name search filter (item 5, **new**) | **M** | — | Frontend |
| 4 | **F1** — Remove *Details* & *Long-term task* fields (item 1) | **M** | reconcile F2's `PUT`/`updateChore` + shared `ChoreForm` *(merged)*; run **after F3** | Frontend + backend + DB migration |
| — | **F8** — Local URL alias instead of IP:port (item 4, **new**) | **M–L** *(research spike; least confident)* | deployment stack (Pi/Docker); **independent of all app features** | Infra (parallel track) |

**Effort tally (remaining):** S × 2, M × 2, plus the M–L infra spike ≈ **8–9 points**
(S=1 / M=2 / L=3 / XL=5). For comparison the completed critical path was ≈ 11 points
(S + L + XL + M). The remaining frontend work is light; the only real unknown is F8's
name-resolution approach.

---

## Status ledger

> **Authority note.** Git is the source of truth: a feature is *actually* done only when
> its PR is **merged to main** and its "Expected end state" facts verify against the
> merged tree. **This table is a human-readable mirror, not the authority** — on any
> conflict, the verified repo state wins. Each session updates its own row as part of its
> final commit. Statuses: `pending` → `in-progress` → `in-review` (PR open) → `merged`.

| Feature | Status | Branch | PR | Merge SHA |
|---|---|---|---|---|
| F4 — confirm-delete | **merged** | `feature/confirm-delete` | [#14](https://github.com/4IRL/chores4irl/pull/14) | `e30c2b2` |
| F2 — edit task | **merged** | `feature/edit-task` | [#15](https://github.com/4IRL/chores4irl/pull/15) | `06e0b00` |
| F5 — swipe actions | **merged** | `feature/swipe-actions` | [#17](https://github.com/4IRL/chores4irl/pull/17) | `0d05453` |
| F6 — bar redesign | **merged** | `feature/bar-redesign` | [#18](https://github.com/4IRL/chores4irl/pull/18) | `3a30a42` |
| F7 — translucent deck | pending | `feature/translucent-add-deck` | — | — |
| F3 — room typeahead | pending | `feature/room-typeahead` | — | — |
| F9 — chore search filter | pending | `feature/chore-search-filter` | — | — |
| F1 — remove Details/Long-term | pending | `feature/remove-details-longterm` | — | — |
| F8 — local URL alias | pending | `feature/local-url-alias` | — | — |
| ~~progress-bar-decay~~ | **superseded** (functionality on `main`) | `feature/progress-bar-decay` *(delete)* | — | — |

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

## Baseline: the codebase as it exists today (merged-F6 `main`)

> **This Baseline reflects `main` after F4/F2/F5/F6 merged.** It is the literal current state
> and is the **assumed starting state for every remaining feature** (F7/F3/F9/F1/F8). Earlier
> revisions of this file described a *pre-F4* baseline — that is now historical; ignore it.

Monorepo using **npm workspaces** (`frontend`, `backend`) with shared types at the repo root.

**Stack**
- **Frontend** (`frontend/`): React 19 + Vite 6 + Tailwind 4, `date-fns`, `lucide-react@^1.8.0`, **`react-swipeable@^7.0.2`** (added by F5). Entry `frontend/src/App.tsx`.
- **Backend** (`backend/`): Express + `better-sqlite3`, TypeScript ESM. Entry `backend/src/server.ts`; app `backend/src/app.ts`; data access `backend/src/chores.ts`; schema+seed `backend/src/db.ts`.
- **Shared types**: `types/SharedTypes.d.ts` — declaration-only, imported as `import type` (alias `@customTypes/SharedTypes`).
- **SQLite**: file `data.db` (WAL). Schema is created with `CREATE TABLE IF NOT EXISTS` in `db.ts` — **there is no migration framework**; an existing `data.db` (local and on the deployed Pi) is *not* altered by editing the `CREATE TABLE` text. **(This is the constraint F1 must solve with an explicit idempotent column-drop migration.)**
- **Path aliases** (from F-history): `@customTypes/*`, `@utils/*` (the latter added with `choreBarMath`).

**Domain model** (`Chore`): `id, name, details?, room, dateLastCompleted, duration, frequency, urgency?, longTermTask?`. The DB `chores` table columns: `id, name, details, room, date_last_completed, duration, frequency, urgency, long_term_task`. **`details` and `long_term_task` are still present — F1 has not run.** `urgency` is retained permanently.

**Backend routes** (`app.ts`): `GET /api/chores`, `POST /api/chores`, **`PUT /api/chores/:id`** (full-replace edit, added by F2 — 200 / 400 `Invalid id` / 400 `Missing required fields` / 404 `Chore not found` / 500), `PATCH /api/chores/:id/complete`, `DELETE /api/chores/:id`. CORS `Access-Control-Allow-Methods` includes `PUT`.

**Frontend API** (`frontend/src/services/choreApi.ts`): `fetchAllChores`, `addChore`, **`updateChore(id, chore)`** (added by F2), `completeChore`, `removeChore`.

**Key UI**
- `App.tsx` — orchestrator: holds `choreData`, `sortedIds`, day-simulation, room filter (`uniqueRooms` derived; `useRoomFilter(choreData, selectedRoom)`); handlers `handleAddChore`, `handleCompleteChore`, `handleDeleteChore`, plus F2's edit trio (`editingId` state + derived `editingChore`; `handleRequestEdit`/`handleCancelEdit`/`handleEditChore`, optimistic update + rollback; `sortedIds` not re-run on edit). Add/edit modals are mutually exclusive (`!showForm && editingChore`). Footer deck (`flex-shrink-0 py-4 flex justify-center border-t border-gray-700`, **opaque**) holds `AddChoreButton`; scroll area directly above is `flex-1 overflow-y-auto min-h-0`. `NavBar` renders the room chips above the list. **There is no chore-name search input yet (F9 adds it).**
- `components/chore/ChoreTimerBar.tsx` — **F6-redesigned**: shorter bar (`h-20 sm:h-16`), `grid grid-cols-3 items-center` spread (name left / frequency center / completion right), **room not displayed**, **no `OverdueBadge`** (deleted; overdue conveyed by bar fill/color + an `sr-only` "Overdue" cue). Bar math comes from `@utils/choreBarMath` `computeBar(daysSince, frequency) → { isOverdue, remainingRatio, barWidth, barColor }`. **Swipe gestures** via `react-swipeable` `useSwipeable` spread (`{...swipeHandlers}` **before** explicit props) on the root `<div>` (which carries `touch-pan-y`): swipe-left → `onDelete` (through F4's `ConfirmDialog`), swipe-right → `onEdit` (F2's modal); both `isSimulating`-guarded; a `swipingRef` suppresses the trailing post-swipe click so a swipe never also completes. Tap-to-complete (`onClick={resetTask}`) preserved. **Delete/edit buttons are now `sr-only` keyboard/AT fallbacks** (`aria-label="Delete chore"` / `aria-label="Edit chore"`, `focus:not-sr-only`) — the visible `✕`/pencil are gone.
- `components/common/ConfirmDialog.tsx` (F4) — portal/backdrop confirm dialog (`confirm-dialog-*` testids), reused by the swipe-left delete path.
- `components/form/` — `ChoreFormModal` → **`ChoreForm`** (the shared add/edit form, F2 — renamed from `AddChoreForm` via `git mv`) → `FormField`. `AddChoreButton` is the `+ Add Task` button. See the F2 contract below for exact props.

**Tests**
- **Vitest** unit tests both sides: `frontend/src/__tests__/**` (components, hooks, services, utils; fixtures at `__tests__/fixtures/chore.ts`, e.g. `makeChore`; `ChoreTimerBar.barMath.test.ts` covers `computeBar`) and `backend/src/__tests__/**` (`chores.test.ts`, `routes.test.ts`, `db-path.test.ts`). Backend tests use `TEST_DB_PATH=:memory:`.
- **Playwright e2e**: `e2e/smoke.spec.ts` (root `npm run test:e2e`). Depends on seed chore **`Vacuum Bedroom Floor`**, the `+ Add Task` flow, and **F6 delete/edit via swipe** (`swipeBar(page, bar, 'left'|'right')`) with the `sr-only [aria-label="Delete chore"]` button invoked via `dispatchEvent('click')` in cleanup loops; confirm via `getByTestId('confirm-dialog-confirm')`. **There is no `OverdueBadge` / room text / visible `✕` selector anymore.**
- **CI**: `.github/workflows/ci.yml` runs backend + frontend tests on PRs to `main`; `main` is branch-protected (PR + review + CI required). All feature work happens on `feature/*` branches and merges via PR.

**Standing invariants now baked into `main` (must not regress):**
1. Delete routes through `ConfirmDialog` (F4).
2. `PUT /api/chores/:id` + `updateChore` client + shared `ChoreForm` + edit-mode modal (F2).
3. `react-swipeable` gestures: swipe-left=delete-confirm, swipe-right=edit; tap-to-complete + the simulation guard intact; `{...swipeHandlers}`-before-explicit-props spread order + `touch-pan-y` on the bar root (F5).
4. Shorter `h-20 sm:h-16` grid bar; room/overdue-badge/visible-buttons removed; swipe is the sole *visible* delete/edit affordance with `sr-only` button fallbacks for a11y; decay/urgency model in `choreBarMath` (F6).

**Assumptions to revisit at planning time**
1. `better-sqlite3` bundles SQLite ≥ 3.35 (supports `ALTER TABLE ... DROP COLUMN`, needed by **F1**). Verify at F1 planning (`SELECT sqlite_version()`), else fall back to a table-rebuild migration.
2. Tap-to-complete + the simulation pointer-events guard are primary; no new feature may regress them.
3. `details` is **not** rendered anywhere in the UI (only stored), so F1's removal is display-safe.
4. **F8 has an end state partly outside the repo** (Pi/LAN config). Capture its outcome as deployment docs under `plans/deploy/docker-raspberry-pi/` so it remains repo-anchored despite touching no app code.

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
component/prop names, the chosen room-input mechanism, the search-filter wiring — must live
in the committed code/tests or be written back into this file. If a session makes a decision
that changes a *later* feature's assumed start, update that later feature's section here in
the same PR.

---

## How to run a session (invocation)

Each feature is **one fresh Claude Code session**. Start on an up-to-date checkout of `main`
(`git checkout main && git pull`) and paste a kickoff prompt. The session reads this file,
runs **exactly one** feature's contract, and ends at the pushed PR. It never chains into the
next feature — that is a new session, started by you after the prior PR is merged.

**Why a human gate exists between sessions.** `main` is branch-protected (PR + review + CI
required), so a session can only reach "PR pushed." **You merge the PR**; that merge is the
durable signal that lets the next session's cold survey pass.

**Kickoff prompt — explicit (recommended):**
```
Read META-PLAN.md. Run feature <F-id> (e.g. F7) and only that feature. Follow its
Per-Feature Session Contract: cold-survey and verify the repo matches the Baseline / that
feature's "Assumed starting state" (STOP and report if it diverges), set its Status ledger
row to in-progress, then create-plan → review-plan → run-plan (once) → git-commit → verify
"Expected end state" → update the ledger row to in-review with the PR link → git-push. End
the session after the PR is pushed. Do not start any other feature.
```

**Kickoff prompt — auto-detect (next pending feature):**
```
Read META-PLAN.md. Determine the next pending feature: inspect origin/main and merged PRs,
reconcile the Status ledger against git (git wins), and test each remaining feature's
"Expected end state" against main. Run the next pending feature per its Per-Feature Session
Contract, exactly once, updating its ledger row (in-progress → in-review) as you go, and
stop after git-push. Do not start a second feature.
```

**Skill mapping:** create-plan → `/plan-creator`; review-plan → `/plan-reviewer`; run-plan →
`/run-plan` (once, on this feature's plan only); then `/git-commit` and `/git-push`.

**Between sessions — monitoring:** `gh pr list` / `gh pr view <n>`; `gh pr checks <n>`;
`reviews/push-review-<branch>.md` (written by `/git-push` if its review *rejects*);
`git log --oneline origin/main`; the **Status ledger** above (trust git if they disagree).

---

# COMPLETED FEATURES (merged to `main` — recorded for the contracts later features depend on)

> These four are **done**. Their "Implemented contract" notes are preserved because the
> remaining features build on them (F1/F3 target F2's shared `ChoreForm`; F1 must also clean
> F2's `PUT`/`updateChore` path). Do not re-run them.

## F4 — Require confirmation before deleting a chore  ·  merged (#14, `e30c2b2`)
Delete routes through `ConfirmDialog` (`frontend/src/components/common/ConfirmDialog.tsx`,
portal/backdrop, `confirm-dialog-*` testids). `App` owns the confirm state; optimistic
delete + rollback preserved after confirm. **Reused by F5's swipe-left path.**

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
`preventScrollOnSwipe: false`). Swipe-left → `onDelete` (through F4's `ConfirmDialog`),
swipe-right → `onEdit` (F2's modal); both `isSimulating`-guarded. Root keeps `onClick`
(tap-to-complete) + `touch-pan-y`; a `swipingRef` set only in `onSwipedLeft/Right` and cleared
in `onTouchStartOrOnMouseDown` suppresses the trailing post-swipe click. **F6 obligation
(met):** preserve `touch-pan-y` + the spread order when rewriting the root `className`; add an
accessible fallback for delete/edit once the visible buttons are removed.

## F6 — Reduce bar height / spread details  ·  merged (#18, `3a30a42`)  ·  ORIGINAL CRITICAL-PATH GOAL
Bar is now `h-20 sm:h-16`, `grid grid-cols-3 items-center` (name left / frequency center /
completion right); **room removed**; **`OverdueBadge.tsx` deleted** (overdue → bar fill/color
+ `sr-only` "Overdue" cue); the visible `✕`/pencil buttons are gone, replaced by **`sr-only`
keyboard/AT-fallback buttons** (`aria-label="Delete chore"` / `"Edit chore"`,
`focus:not-sr-only`). Bar math/urgency live in `@utils/choreBarMath` (`computeBar`). e2e
rewritten to delete/edit via swipe + the `sr-only` button. **`TODO(#10)` fully resolved.**
*(The progress-bar decay model that `feature/progress-bar-decay` proposed is part of this
shipped `choreBarMath` — that branch is superseded.)*

---

# REMAINING FEATURES (independent; flat backlog — default order F7 → F3 → F9 → F1, plus the F8 infra track)

> Every remaining feature's **Assumed starting state is the Baseline above** (merged-F6 `main`).
> They touch disjoint surfaces; if you re-sequence them, update any affected assumed-start/
> expected-end facts here **in the same PR** — specifically: if **F1 runs before F3**, F3's
> start no longer sees a plain-text Room field; F1's start still sees one.

## F7 — Translucent / blur *Add Task* button deck  ·  Order 1  ·  Effort S

**Goal.** Make the bottom *Add Task* deck use a transparent, blurred background so the chore
list is faintly visible beneath it (especially on the sides of the button). The button stays
locked at the bottom and remains opaque while the list scrolls beneath.

**Rank rationale.** Fully independent, purely visual quick win; blocks nothing. Lowest risk,
so run first.

**Effort: S.** A focused layout/CSS change to the footer deck in `App.tsx` plus the button;
verify scroll behavior beneath the blur on mobile viewports.

**Dependencies.** None.

**Assumed starting state** = **Baseline**. Verify:
- `App.tsx` footer deck is `<div className="flex-shrink-0 py-4 flex justify-center border-t border-gray-700">` wrapping `AddChoreButton` (opaque; below the scroll area).
- The scroll area directly above is `<div className="flex-1 overflow-y-auto min-h-0">`.

**Expected end state** (repo-checkable):
- The footer deck uses a semi-transparent background with `backdrop-blur` (e.g. `bg-gray-900/60 backdrop-blur-*`) so chore bars are faintly visible beneath/around the button; the deck no longer fully occludes content at its edges.
- The deck remains pinned at the bottom (`flex-shrink-0`; list still scrolls via the existing `overflow-y-auto` region); `AddChoreButton` itself remains visually opaque/legible.
- No functional/JS behavior change; existing tests still pass.

**Test-suite deltas.** Minimal. Optionally assert the deck's blur/translucency classes in a
small App/AddChoreButton render test. No e2e change.

**Open risks / decisions.** Exact opacity/blur values and whether `AddChoreButton` keeps any
existing `bg-opacity-*` (which would conflict with "button remains opaque") — **default: make
the *deck* translucent+blurred and the *button* fully opaque.** Confirm `backdrop-blur`
performs acceptably on the target Pi/mobile browser.

**Session loop.** Run the Per-Feature Session Contract on branch `feature/translucent-add-deck`.

---

## F3 — Type-as-you-search *Room* dropdown  ·  Order 2  ·  Effort S

**Goal.** Replace the free-text *Room* input with a type-as-you-search dropdown (autocomplete)
sourced from the rooms already in use, on **both** the Add and Edit forms.

**Rank rationale.** Builds on F2's shared `ChoreForm` (merged), so it is now effectively
independent. Touches only the Room field. **The 260627 list explicitly accepts a native
`<datalist>`, which drops this from M to S** — no custom combobox required.

**Effort: S** (down from M). A native `<input list=...>` + `<datalist>` of existing rooms wired
into the shared form (covers both modes at once), plus tests. Free-entry of a new room is
inherent to `<datalist>`.

**Dependencies.** F2's shared `ChoreForm` (merged).

**Assumed starting state** = **Baseline**. Verify:
- The shared `ChoreForm` (`frontend/src/components/form/ChoreForm.tsx`, default export) is used by both `ChoreFormModal` add and edit paths.
- The Room field is currently a plain text `FormField` in that shared form. *(Details/Long-term fields are still present — F1 has not run; F3 touches only the Room field.)*
- A source of existing rooms is available: `App.tsx` already computes `uniqueRooms = Array.from(new Set(choreData.map(c => c.room)))`.

**Expected end state** (repo-checkable):
- The Room field is a **type-as-you-search dropdown** (native `<datalist>` accepted): typing filters existing-room suggestions; the user can pick a suggestion **or type a brand-new room**; the value flows into the submit payload as `room` (string) exactly as before.
- It appears identically on **both** Add and Edit forms (single shared-form change).
- The suggested-room list is passed in from existing data (e.g. `uniqueRooms` threaded from `App.tsx` through `ChoreFormModal` to `ChoreForm`). Persist the prop/threading in code.
- No schema change — `room` remains a free string the backend already stores.

**Test-suite deltas.** Component test for the room input (renders datalist options, accepts a
new free-text room, emits correct value); update shared-form/modal tests for the new prop;
optionally extend the e2e add flow to pick a room. No backend test change.

**Open risks / decisions.** (a) **Native `<datalist>` vs custom listbox** — **decision: native
`<datalist>`** per the list (keeps it S); only fall back to a custom combobox if datalist's
mobile UX proves unacceptable on the Pi target (would raise to M). (b) Must still allow a
**new** room not in the list (datalist does by default). (c) Where `uniqueRooms` is threaded —
reuse `App.tsx`'s existing derivation.

**Session loop.** Run the Per-Feature Session Contract on branch `feature/room-typeahead`.

---

## F9 — Persistent chore-name search filter  ·  Order 3  ·  Effort M  ·  NEW (260627 item 5)

**Goal.** Add a type-as-you-search text input **persistently at the top of the chores list**,
independent of the highlighted room. Chores are filtered out of view by substring match on the
text entered, so users can quickly find a chore to update once the list grows. Include a
magnifying-glass icon and placeholder text **"Search for a chore"** so the field's intent is
clear.

**Rank rationale.** New, self-contained frontend feature; no dependency on any other remaining
feature. Sits above the existing room filter and composes with it. Medium because it adds a new
persistent UI element + filter state that must **AND** with the existing room filter and stay
pinned while the list scrolls.

**Effort: M.** Cost drivers: a new search-input component (lucide-react `Search` icon +
placeholder), filter state in `App.tsx`, composing the substring filter with the existing
`useRoomFilter`/`selectedRoom` path **without** disturbing `sortedIds` ordering or the
day-simulation, keeping the input pinned above the scroll region, and tests. lucide-react is
already installed.

**Dependencies.** None (uses `App.tsx`'s existing `choreData` + room-filter pipeline, merged).

**Assumed starting state** = **Baseline**. Verify:
- `App.tsx` derives `filteredChores = useRoomFilter(choreData, selectedRoom)` and builds the visible list by mapping `sortedIds` over those.
- `NavBar` renders room chips above the list; the scroll area is `flex-1 overflow-y-auto min-h-0`. **No chore-name search input exists.**
- `lucide-react` is a dependency (the `Search` icon is available).

**Expected end state** (repo-checkable):
- A persistent search `<input>` (with a `Search` magnifying-glass icon and `placeholder="Search for a chore"`) renders **above the chores list, outside the scroll region**, visible regardless of the selected room.
- Typing filters the visible chores to those whose name contains the entered substring (case-insensitive), **composed with** the existing room filter (both apply). Clearing the input restores the room-filtered list.
- The filter is **view-only** — it does not mutate `choreData`, `sortedIds`, completion, or the day-simulation; sort order among matches is unchanged.
- Empty-result state is handled gracefully (no crash; existing empty-list rendering or a brief "no matches" cue).

**Test-suite deltas.** Component test for the search input (icon + placeholder render; typing
filters). App-level test: substring filter ANDs with room filter; clearing restores; ordering
preserved. e2e: optionally type in the search box and assert a non-matching seed chore hides.

**Open risks / decisions.** (a) **Where the filter composes** — default: derive a
`searchFilteredChores` from `filteredChores` (room first, then substring) so room + search AND
cleanly; do **not** thread the query into `sortedIds`. (b) Match scope — default: chore **name**
only (per the list); decide if `room`/`details` should also match (default **no**, name-only).
(c) Case sensitivity — default case-insensitive. (d) Debounce — default none (list is small);
revisit only if perf shows otherwise. (e) Persisted vs reset on room change — default: the
query **persists** across room switches (the point is cross-room lookup).

**Session loop.** Run the Per-Feature Session Contract on branch `feature/chore-search-filter`.

---

## F1 — Remove *Details* and *Long-term task* fields  ·  Order 4  ·  Effort M  ·  CLEANUP (LAST)

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
- `backend/src/db.ts` `CREATE TABLE` includes `details` and `long_term_task`; `SEED_DATA` rows carry both.
- `backend/src/chores.ts` maps `details`/`longTermTask` in **both** `createChore` and `updateChore`.
- `app.ts` has both `POST` and `PUT /api/chores/:id`, both accepting `details`/`longTermTask`.
- The shared `ChoreForm` renders a *Details* `FormField` and a `longTermTask` checkbox. *(The Room field is plain-text unless F3 ran first, in which case it is the `<datalist>` input — F1 must not disturb it.)*
- `grep -rn "longTermTask\|long_term_task" backend frontend types` returns matches.

**Expected end state** (repo-checkable):
- `grep -rn "longTermTask\|long_term_task" backend frontend types` returns **no matches**; `details` is likewise removed from `Chore`, `db.ts` schema+seed, `chores.ts` (`createChore` **and `updateChore`**), and both `POST` and `PUT` handling. (`urgency` is **retained**.)
- The shared `ChoreForm` no longer renders a Details field or a long-term checkbox; its form state/submit payload drop both. **The F3 room datalist and all F2/F5/F6 behavior are preserved** (F1 touches only these two fields + schema).
- `db.ts` contains an **idempotent migration** that drops `details` and `long_term_task` from an existing `chores` table (guarded by a `pragma table_info('chores')` check, so re-running is safe), in addition to the cleaned `CREATE TABLE` and seed.
- Backend + frontend Vitest suites pass with the fields removed; `e2e/smoke.spec.ts` still passes (its add-chore test never filled Details).

**Test-suite deltas.** Update `backend/src/__tests__/chores.test.ts` & `routes.test.ts` (drop
long-term/details from create **and update** cases); update frontend shared-form tests and
`fixtures/chore.ts` if they reference the removed fields; **add** a backend test asserting the
migration drops the columns and is idempotent.

**Open risks / decisions.** (a) Confirm `sqlite_version()` ≥ 3.35 for `DROP COLUMN`; else use a
create-new-table-and-copy migration. (b) **Decision: fully delete** `details` (not a no-op
field) for a clean schema. (c) Migration runs on the Pi's existing `data.db` on next boot (via
`db.ts` on import) — verify on the Pi (**LAN is unreachable from the sandbox — run Pi checks
unsandboxed**). (d) Confirm F2's `updateChore`/`PUT` path is fully de-referenced — the extra
surface created by deferring F1.

**Session loop.** Run the Per-Feature Session Contract on branch `feature/remove-details-longterm`.

---

## F8 — Local URL alias instead of IP:port  ·  Infra track (parallel)  ·  Effort M–L (research spike)  ·  NEW (260627 item 4)

**Goal.** Let users on the local network reach the app by a memorable name rather than the raw
IP — e.g. typing `c4i` (or similar) in a browser instead of `192.168.1.214:80`. Explore the
viable options and implement the one that best fits the Pi/Docker deployment.

**Rank rationale.** New, and **entirely separate from the frontend track** — it touches LAN
name resolution / the Pi deployment, not the app's React/Express code. It blocks nothing and is
blocked by nothing, so it runs as its own parallel track whenever convenient. It is the
**least-confident estimate** in this plan (the list frames it as "Explore options").

**Effort: M–L (research-first).** The unknown is the resolution mechanism and how robustly a
*bare* single-label name can be made to work on the target clients. Candidate approaches to
evaluate at planning time (this feature **starts with a spike**, not code):
- **mDNS / Avahi** on the Pi → advertises `c4i.local` (works on most modern OSes; note it yields a `.local` suffix, **not** a bare `c4i`). Lowest-friction if `.local` is acceptable.
- **LAN DNS** (router static DNS entry, or `dnsmasq` on the Pi as the LAN resolver) → can resolve a bare `c4i` if clients receive an appropriate search domain. More setup; most flexible.
- **hosts-file entries** per device → rejected for not scaling; note only as a fallback.
- Confirm the port: `:80` is already HTTP-default, so browsers omit it — the real ask is **name-instead-of-IP**, which is purely a resolution problem (no app-server change needed unless a reverse proxy / vhost is introduced).

**Dependencies.** The deployment stack (`plans/deploy/docker-raspberry-pi/`, the Pi, Docker).
No app-feature dependency.

**Assumed starting state** = **Baseline** + the existing Pi deployment (app served on the Pi at
its LAN IP on port 80). Verify the current deploy setup under `plans/deploy/docker-raspberry-pi/`
before planning.

**Expected end state** (repo-checkable **+ deployment-doc-anchored**, since the change is
largely Pi config):
- A documented, reproducible mechanism by which a LAN client reaches the app via a name (the chosen `c4i` or `c4i.local`), recorded as deployment docs/config under `plans/deploy/docker-raspberry-pi/` (e.g. an Avahi service file, a `dnsmasq` snippet, or compose/proxy changes) so the outcome is repo-anchored even though it touches no app code.
- The chosen name resolves to the app from at least the primary target client(s); the raw IP:port still works (alias is additive, non-breaking).
- The decision (which mechanism, what name, why) and any client-side caveats (e.g. `.local` support, Android quirks) are written into the deployment docs.

**Test-suite deltas.** None in the app test suites (no app code change expected). Verification is
manual/operational on the Pi + a LAN client; document the verification steps in the deploy docs.

**Open risks / decisions.** (a) **Bare `c4i` vs `c4i.local`** — a single-label name with no DNS
suffix is treated as a search query by many browsers; `.local` (mDNS) is the low-effort path,
true bare-name resolution needs LAN DNS. Decide the acceptable UX at planning. (b) Client
coverage — confirm the household's actual devices (iOS/Android/Windows/macOS) resolve the chosen
name; mDNS support varies. (c) **Sandbox cannot reach the Pi LAN** — all Pi/LAN verification must
run **unsandboxed**. (d) Keep it additive — never break the existing IP:port access. (e) Because
the end state lives partly outside the repo, the deploy-doc capture (Assumption 4 in Baseline) is
**mandatory**, not optional.

**Session loop.** Run the Per-Feature Session Contract on branch `feature/local-url-alias`
(planning begins with a research spike; the "implement" step applies the chosen mechanism + docs).

---

## Chain integrity (remaining work)

```
                       ┌──────────── FRONTEND TRACK (default order) ────────────┐
Baseline (merged-F6) ─F7→ ─F3→ ─F9→ ─F1 (cleanup last)
        │
        └─INFRA TRACK──→ F8 (independent; runs anytime)
```

- Unlike the completed critical path, **the remaining features share no hard chain.** The arrows above are a *recommended* order (by effort/risk), not a dependency requirement — only **F1-after-F3** is a soft convention (both edit `ChoreForm`; F1 is cleanup-last). F8 is fully parallel.
- Each remaining feature's assumed start is the **Baseline** (merged-F6 `main`). The only cross-feature coupling:
  - **F3 ↔ F1** both edit the shared `ChoreForm` (F3 the Room field, F1 the Details/Long-term fields). If re-sequenced so F1 precedes F3, update F3's "Room field is plain-text" assumed-start fact and F1's "Room is now a datalist" note **in the same PR**.
  - **F9** composes with the existing room filter but adds no field other features touch.
  - **F8** shares no files with any of them.
- Cumulative invariants that must hold from each feature onward:
  - From **F7**: translucent/blurred Add-Task deck, opaque button.
  - From **F3**: Room field is a type-as-you-search `<datalist>` on both forms.
  - From **F9**: a persistent name-search filter sits above the list and ANDs with the room filter (view-only).
  - From **F1**: no `details` / `longTermTask` / `long_term_task` anywhere (incl. the `PUT`/`updateChore` paths); idempotent column-drop migration in `db.ts`.
  - From **F8**: a documented LAN name-alias to the app, captured in the deploy docs; IP:port still works.

> If any session's cold survey finds the repo does **not** match its assumed start, **stop and
> reconcile** before planning. The repository is the single source of truth across sessions;
> this file records the *intended* order and must be updated in-PR whenever the actual order
> diverges.
