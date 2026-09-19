# META-PLAN — chores4irl future-feature rollout

> **What this file is.** An orchestration manifest, not a script. It sequences the
> features in the current ledger (see *Source list lineage* below) and defines, for each one,
> a *self-contained* per-feature session that a fresh agent (with no memory of prior
> sessions) can run end-to-end using **only this file and the repository**. This file
> is never run top-to-bottom. It is the index; each feature is a separate session.
>
> **Source list lineage.** `plans/ledger/260715_feature_ledger.md` is the **current**
> source of truth for the backlog; every older ledger carries a `PREDECESSOR` banner and
> loses on any disagreement. Backlog changes go through the global `/new-feature` skill
> (which appends a new dated ledger and reconciles this file); the reconcile-by-reconcile
> narrative lives in git history (PRs #26, #29, #30), not here.
>
> **F-ID scheme (fixed at the 2026-07-07 reconcile; never renumber).** Current features
> use the bare `F#` labels from the 260707 ledger — `F1`–`F13`, extended by later adds
> (`F14`, `F15`, …) in ledger order. Features completed *before* that reconcile keep their
> old 260630-era number with an `-L` (legacy) suffix, because several legacy digits were
> reused for unrelated current features (e.g. legacy `F4-L` = confirm-delete, current
> `F4` = remove Details/Long-term). The **Legacy → current ID map** below is the full
> audit trail; older `plans/` files that predate the renumbering carry their own
> stale-numbering notes pointing back here.
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

**Current focus: `F5`** (translucent / blur *Add Task* deck) — see *Shortest path to
the focus feature* below. *(Advanced from `F4` on 2026-09-19, once `F4`'s PR #38 was
verified merged.)*

**Shipped through PR #38** — merged work is recorded by git, not re-tabulated here
(`gh pr list --state merged` / `git log --oneline main`). Since #32: #33, #35, #36 and #37
were docs/skills-only (META-PLAN reconciles and fold-backs, and the replacement of the
`plans/*-PROMPT.md` templates by the `/run-feature`, `/worktree`, `/compact-plans` skills);
the two app-code merges are **#34 — `F14`, the clear-✕ affordance** (Standing invariant 10)
and **#38 — `F4`, the removal of the *Details* / *Long-term task* fields plus the first
`db.ts` boot migration** (Standing invariant 11), both now folded into the Baseline below.
What each merge left behind that still matters is captured
*forward*: in the Baseline, the Standing invariants, and the few completed-feature
contracts kept below because a remaining feature builds on or must remove them. **History
policy:** once a feature's PR is *verified* merged (never self-marked) and the
Baseline/invariants absorb its contract, its rows and sections are deleted from this file
— the only history kept is what stops a future session from re-treading already-traveled
design space (the Legacy → current ID map, contracts still targeted by open features,
and confirmed-but-unscheduled follow-ups).

**Kiosk-layer extraction (decided 2026-07-15).** The kiosk/screen features — shipped
`F1`/`F2` behavior and the entire unbuilt device-control panel track — are properties of
the **screen**, not this app, and must run on the Pi **independent of whatever web app is
displayed**. They migrated to a standalone repo on the user's personal GitHub account,
**`rehankalu/pi-kiosk`** *(earlier records wrote `rmilarachi/pi-kiosk`; the repo was
actually created under the `rehankalu` account)*: a *kiosk-shell* web page (Chromium's
kiosk target; embeds the displayed app in a full-viewport iframe and renders the
overlays + console above it) plus a *kiosk-agent* host service (localhost HTTP + SSE:
global evdev input-activity feed, hardware control, config). The full architecture,
design decisions, and migration phases live in
**`plans/feature/kiosk-shell-extraction/kiosk-shell-extraction.md`** — the cross-repo
contract. Consequences here: `F3`/`F7`/`F8`/`F9`/`F10`/`F13` are **superseded
(migrated)**; `F11`/`F12` remain chores4irl features re-scoped onto the `kiosk/v1`
postMessage contract (deferred until pi-kiosk Phase 4); **`F15`** (adopt kiosk-shell:
remove the `F1`/`F2` overlays, commit the embeddability guarantee) is gated on pi-kiosk
Phase 2 parity.

**Branch hygiene — clean as of the 2026-09-16 `/compact-plans` sweep.** The three stale
local branches the 2026-09-10 reconcile flagged (`chore/plan-reconciliation-260708`,
`feature/touch-lock`, `revision/progress-bar-decay`) are gone, and the sweep pruned
`chore/meta-plan-housekeeping-260723` (#31/#33) and `feature/clear-input-buttons` (#34)
after verifying each against its merged PR (this repo squash-merges, so `gh pr list
--state merged` is the check, not `git branch --merged`; GitHub auto-deletes the remote
side on merge). A cold survey finding only `main` (plus any live feature branch) is the
expected state — do not resurrect pruned branches, and do not expect plan dirs for
features that shipped without one (F9-L, F3-L).

### Remaining work — three tracks (current numbering, incl. `F15`)

```
Chore-list track (one item left):
    F5 (blur Add-Task deck, S ★FOCUS)
    (F14 — clear-✕ on free-text inputs — shipped #34; F4 — remove Details/Long-term — shipped #38)

Kiosk extraction track (2026-07-15 — see plans/feature/kiosk-shell-extraction/):
    [external] rehankalu/pi-kiosk Phases 1–4 ──► F15 (adopt kiosk-shell, M) after Phase 2 parity
        (F15 removes the shipped F1/F2 overlay code once the shell reproduces it)
    F3 · F7 · F8 · F9 · F10 · F13 ── SUPERSEDED (migrated to pi-kiosk; no chores4irl session runs them)
    F11 (undo) ─→ F12 (redo) ── remain here, re-scoped onto the kiosk/v1 postMessage
        contract; deferred until pi-kiosk Phase 4 delivers the contract

Infra track:
    F6 (local URL alias, M–L · research-first) ── independent; different surface entirely
```

- **Chore-list track:** only `F5` remains. `F14` (#34) and `F4` (#38) shipped in the
  user's 2026-07-08 order (`F14` → `F4` → `F5`); the shared `ChoreForm` now carries exactly
  Name (`clearable`), the Room `<datalist>`, Last Completed, Duration, Frequency and the
  Urgency `<select>`, and `F5` touches only the `App.tsx` footer deck — no shared-form
  surface at all.
- **Kiosk extraction track (replaces the device-control panel track):** the console and
  its hardware controls (`F3`, `F7`, `F8`, `F9`, `F10`, `F13`) migrated to
  `rehankalu/pi-kiosk` — no chores4irl session runs them; the sequencing now lives in the
  design doc's Migration Phases. What stays here: `F15` (adopt kiosk-shell — an ordinary
  chores4irl feature, gated on the **external** pi-kiosk Phase 2, removing the shipped
  `F1`/`F2` overlay code; Standing invariants 8–9 hold until then), and `F11`/`F12`
  (app-data undo/redo, re-scoped onto the `kiosk/v1` contract, gated on the external
  Phase 4).
- **Infra track:** `F6` (renumbered from legacy `F8-L`) is unchanged — LAN name resolution,
  shares no files with app code. If `F6` lands, its alias becomes the natural
  `target_url` in the pi-kiosk config.

### Shortest path to the focus feature (`F5`)

**`F5` is the current ★FOCUS** (translucent / blur *Add Task* deck) — the chore-list
track's last item in the user's 2026-07-08 order (`F14` → `F4` → `F5`), with nothing
blocking it: purely visual, confined to the `App.tsx` footer deck, no schema or shared-form
surface. It was already in flight when `F4` folded back: its PR #39 was open on
`feature/translucent-add-deck` as of 2026-09-19, and that PR carries its own ledger-row flip
to `in-review`, so the Status ledger below still reads `pending` / `—` on `main` until #39
merges — per the ledger's authority note, trust `gh`, and `/run-feature F5` resumes from the
PR's state, not from Phase A. **After `F5` merges the chore-list track is empty:** the kiosk
extraction features (`F15`, `F11`, `F12`) wait on external pi-kiosk gates, and `F6` is the
only unblocked candidate — `F5`'s own fold-back must decide (ask the user) between starting
`F6` and holding for the pi-kiosk gates, rather than assuming `F6` is next.

- **Do not** re-open `F4`'s or `F14`'s scope — the *Details* / *Long-term task* fields are
  gone (#38, with the `db.ts` boot migration) and the clear-✕ affordance shipped (#34);
  Standing invariants 10–11 record both as verified-shipped facts.
- **Do not** start `F3`/`F7`/`F8`/`F9`/`F10`/`F13` in this repo at all — they are
  superseded (migrated to pi-kiosk, 2026-07-15). `F15` cannot start until pi-kiosk
  Phase 2 parity is verified on the Pi; `F11`/`F12` cannot start until pi-kiosk Phase 4
  delivers the `kiosk/v1` contract.
- **Do not** resurrect `F1`'s "must use real wall-clock time" / "must swallow the waking tap"
  constraints, or `F2`'s lock contract, as open items — they are verified-shipped facts;
  see Standing invariants 8–9 below (held until `F15` relocates the behavior).

---

## Backlog summary (remaining work only)

> Merged features are **not** tabulated here — git is the authority on what shipped
> (`gh pr list --state merged` for PR/SHA/date). History survives in this file only
> where it steers future work: the Baseline, the Standing invariants, the Legacy →
> current ID map, and the kept contracts under Completed-Feature Contracts below.

### Remaining (current numbering, incl. `F15`; reassessed against current `main` after the 2026-09-19 `F4` fold-back)

| Order | Feature | Effort | Depends on | Track |
|---|---|---|---|---|
| ★ | **F5** — Translucent/blur *Add Task* deck **[FOCUS]** | **S** | none blocking *(F4 and F14 already merged)* | Chore-list |
| 1 | **F15** — Adopt kiosk-shell: remove F1/F2 overlays + embeddability guarantee *(added 2026-07-15)* | **M** | **external:** pi-kiosk Phase 2 parity verified on the Pi | Kiosk extraction |
| 2 | **F11** — Undo *(re-scoped 2026-07-15 onto the `kiosk/v1` contract)* | **M–L** | **external:** pi-kiosk Phase 4 (`kiosk/v1` contract) | Kiosk extraction |
| 3 | **F12** — Redo *(re-scoped 2026-07-15)* | **M** | F11 + same external gate | Kiosk extraction |
| — | **F6** — Local URL alias instead of IP:port | **M–L** *(research spike)* | deployment stack (Pi/Docker); independent | Infra (parallel) |
| ~~—~~ | ~~**F3 · F7 · F8 · F9 · F10 · F13** — device-control console + its controls~~ | — | **superseded 2026-07-15** — migrated to pi-kiosk (shell console / agent controls / settings; `F13`'s plan harvested, see its banner) | *(migrated)* |

**Effort tally (remaining, in this repo).** Chore-list track: F5 (S) ≈ **1 pt**.
Kiosk extraction track: F15 (M=2) + F11 (M–L≈2–3) + F12 (M=2) ≈ **6–7 pts**,
all gated on external pi-kiosk phases. Infra: F6 ≈ **2–3 pts**. (S=1 / M=2 / L=3 / XL=5.)
The former device-control tally (~11 pts placeholder-ship + connections) now lives in the
pi-kiosk repo's own planning, not here.

---

## Legacy → current ID map

> Kept because it is the guard against re-treading already-traveled design space under a
> reused digit: several current bare `F#`s collide with retired 260630-era numbers. Only
> **pending** legacy IDs map onto current IDs — the seven **completed** legacy features
> (`F4-L`, `F2-L`, `F5-L`, `F6-L`, `F9-L`, `F3-L`, `F10-L`) are retired history recorded
> by git; their `-L` tags appear in this file only as provenance on Baseline invariants
> and kept contracts.

| Legacy (260630 META-PLAN) | Current (260707 ledger) |
|---|---|
| F1-L remove Details/Long-term | → **F4** *(shipped #38 — folded into Baseline / Standing invariant 11)* |
| F7-L blur Add-Task deck | → **F5** |
| F8-L local URL alias | → **F6** |
| F11-L settings panel container | → **F3** *(superseded 2026-07-15 — migrated to pi-kiosk)* |
| F12-L brightness | → **F7** *(superseded 2026-07-15 — migrated to pi-kiosk)* |
| F13-L screen-blank/wake toggle | → **F8** *(superseded 2026-07-15 — migrated to pi-kiosk)* |
| F14-L restart | → **F10** *(superseded 2026-07-15 — migrated to pi-kiosk)* |
| F15-L undo | → **F11** *(re-scoped 2026-07-15 onto the `kiosk/v1` contract)* |
| F16-L redo | → **F12** *(re-scoped 2026-07-15 onto the `kiosk/v1` contract)* |
| F17-L rotate | → **F13** *(superseded 2026-07-15 — migrated to pi-kiosk)* |
| *(none — new)* | **F1** — auto screen-blank 9pm–6am *(shipped #27 — contract kept below for `F15`)* |
| *(none — new)* | **F2** — double-tap accidental-touch lock *(shipped #28 — contract kept below for `F15`)* |
| *(none — new)* | **F9** — auto-blank settings-UI sub-control *(superseded 2026-07-15 — migrated to pi-kiosk)* |
| *(none — new, added 2026-07-08)* | **F14** — clear-✕ affordance on free-text inputs *(shipped #34 — folded into Baseline / Standing invariant 10)* |
| *(none — new, added 2026-07-15)* | **F15** — adopt kiosk-shell (remove F1/F2 overlays + embeddability guarantee) |

---

## Status ledger

> **Authority note.** Git is the source of truth: a feature is *actually* done only when
> its PR is **merged to main** and its "Expected end state" facts verify against the
> merged tree. **This table is a human-readable mirror, not the authority** — on any
> conflict, the verified repo state wins. Each session updates its own row as part of its
> final commit. Statuses: `pending` → `in-progress` → `in-review` (PR open); once a PR is
> verified merged, its row is **deleted** at the next reconcile — git records merged work,
> this table tracks only what's ahead. IDs are the **current (260707)** numbering; see the
> Legacy → current map above.

| Feature | Status | Branch | PR |
|---|---|---|---|
| **F5 — translucent Add-Task deck** ★FOCUS | pending | `feature/translucent-add-deck` | — |
| F15 — adopt kiosk-shell *(added 2026-07-15)* | pending *(gated on external pi-kiosk Phase 2 parity)* | `feature/kiosk-shell-adoption` | — |
| F11 — undo *(re-scoped 2026-07-15: `kiosk/v1` contract)* | pending *(gated on external pi-kiosk Phase 4)* | `feature/undo` | — |
| F12 — redo *(re-scoped 2026-07-15)* | pending *(gated on F11 + same external gate)* | `feature/redo` | — |
| F6 — local URL alias | pending | `feature/local-url-alias` | — |
| F3 · F7 · F8 · F9 · F10 · F13 — device-control console + controls | **superseded** *(2026-07-15 — migrated to pi-kiosk; branches never created)* | — | — |

**Branch/dir cleanup:** outstanding as of the 2026-09-19 `F4` fold-back — `F4` merged
(#38) but has not been swept yet: its local branch `feature/remove-details-longterm`, its
`/worktree` checkout `c4i-wt-remove-details-longterm`, and its plan dir
`plans/feature/remove-details-longterm/` (whose
`reviews/push-review-feature-remove-details-longterm.md` holds four non-blocking minors —
count-alias naming, a greppable log tag before the migration rethrows, an optional
two-connection `BEGIN IMMEDIATE` test, an optional loop inlining — to harvest into
`plans/PUSH-REVIEW-FINDINGS.md`) all await the next `/compact-plans` sweep. Everything
older is clean: every earlier merged plan dir is frozen under `plans/completed/`. Sweep
history lives in git (PRs #22, #26, #29 and the sweep commits on later branches), not here. Run
`/compact-plans` after each merge, then `/run-feature <F-ID>` on the merged feature so its
Phase C fold-back (ledger row deleted, Baseline/ID-map/★FOCUS refreshed) lands — never
hand-delete a merged row: `/run-feature` keys Phase C off "PR merged + row present", so a
hand-deleted row silently skips the fold-back.

**Ledger update protocol (per session):** set `in-progress` on start; `in-review` + PR
link after `git-push`; once the PR is *verified* merged (never self-marked), the row is
**deleted** rather than kept as `merged` — git carries merged history. Ledger edits ride
in the feature's own commits/PR.

---

## Baseline: the codebase as it exists today (`main` at PR #38, `d728989`)

> **This Baseline reflects `main` after PR #38 (`d728989`).** It is the literal current
> state and the **assumed starting state for every remaining feature.** (PRs #33, #35, #36
> and #37 touched only `plans/` docs and `.claude/skills/`; the app-code deltas since #32 are
> **#34 (`3533b67`) — `F14`**, all under `frontend/src/`, and **#38 (`d728989`) — `F4`**,
> spanning `types/SharedTypes.d.ts`, `backend/src/` (`db.ts`, `chores.ts`, tests),
> `frontend/src/` (`ChoreForm.tsx`, `utils/choreSort.ts`, the deleted dead reference file
> `assets/database.ts`, tests) and `README.md`.)
> Touch-lock is fully on `main`:
> `frontend/src/hooks/useTouchLock.ts`, `components/common/TouchLockOverlay.tsx` (with the
> exported `CLOSING_SETTLE_MS` / `App.tsx` `isClosing` unmount handshake), and
> `TouchLockIndicator.tsx`, wired via `inert={isBlanked || isLocked}` on the app root.

Monorepo using **npm workspaces** (`frontend`, `backend`) with shared types at the repo root.

**Stack**
- **Frontend** (`frontend/`): React 19 + Vite 6 + Tailwind 4, `date-fns`, `lucide-react@^1.8.0`, `react-swipeable@^7.0.2`. Entry `frontend/src/App.tsx`.
- **Backend** (`backend/`): Express + `better-sqlite3`, TypeScript ESM. Entry `backend/src/server.ts`; app `backend/src/app.ts`; data access `backend/src/chores.ts`; schema+seed `backend/src/db.ts`; SSE event bus (in-process `EventEmitter`, emits on every successful write).
- **Shared types**: `types/SharedTypes.d.ts` — declaration-only, imported as `import type` (alias `@customTypes/SharedTypes`).
- **SQLite**: file `data.db` (WAL). Schema is created with `CREATE TABLE IF NOT EXISTS` in `db.ts`, followed at module load by **`dropLegacyChoreColumns(db)` — an idempotent, `pragma table_info('chores')`-guarded boot migration** (`F4`, #38) that issues one `ALTER TABLE chores DROP COLUMN` per still-present legacy column (`LEGACY_CHORE_COLUMNS = ['details', 'long_term_task']`) inside a `BEGIN IMMEDIATE` transaction (`db.transaction(...).immediate()`, so two processes booting the same un-migrated file serialise), then the seed guard. It is deliberately **crash-loud** (no try/catch): a failed `ALTER` aborts the backend before `listen`, the container `HEALTHCHECK` never passes, and compose gives up after `on-failure:5` — the README's "Updating an existing Pi deployment" section now tells the operator to snapshot first and check `docker compose logs backend`. **There is still no general migration framework** — editing the `CREATE TABLE` text never alters an existing `data.db`; any future schema change must add its own guarded step beside `dropLegacyChoreColumns` (SQLite ≥ 3.35 is verified: `better-sqlite3` bundles 3.51.3, so `DROP COLUMN` is available). **Whether the live Pi's `data.db` has been migrated yet is a deployment fact outside this repo** — it happens on the backend container's first boot after the next Pi deploy; the full runbook (inspect `details` values to keep → snapshot via `chores4irl-backup.service` → deploy → verify 7 columns → rollback = snapshot + old image together) is `pr-description.md` in `F4`'s plan dir (`plans/feature/remove-details-longterm/`, or wherever `/compact-plans` freezes it), with the short form in the README.
- **Path aliases**: `@customTypes/*`, `@utils/*`.

**Domain model** (`Chore`): `id, name, room, dateLastCompleted, duration, frequency, urgency?`. The DB `chores` table columns (7): `id, name, room, date_last_completed, duration, frequency, urgency`. **`details` and `long_term_task` are gone (`F4`, #38)** — `grep -rn "longTermTask\|long_term_task" backend frontend types` matches only (a) the `LEGACY_CHORE_COLUMNS` migration list + comment in `backend/src/db.ts`, (b) `backend/src/__tests__/db-migration.test.ts` (legacy DDL + legacy INSERTs), and (c) the stale-client tests in `backend/src/__tests__/chores.test.ts`, `backend/src/__tests__/routes.test.ts`, `frontend/src/__tests__/components/ChoreForm.test.tsx` and `frontend/src/__tests__/utils/choreSort.test.ts`; nothing in `app.ts`, `chores.ts`, `SharedTypes.d.ts`, or any non-test frontend file. `createChore`/`updateChore` build explicit named-param literals, so legacy `details`/`longTermTask` keys from a stale client (e.g. a kiosk page not yet reloaded) are **silently dropped, not rejected** (deliberate — a 400 would break a kiosk page still running the old form until it reloads; accepted as the right call in `F4`'s push review). `urgency` is retained permanently. `frontend/src/__tests__/fixtures/chore.ts`'s `makeChore` never defaulted the removed fields, so it needed no change.

**Sort** (`frontend/src/utils/choreSort.ts`): `orderChores` is a single `calcDurationWeightedScore` sort (`duration × daysSince/frequency`, descending) — the former long-term-task bottom partition left with `F4`, so infrequent maintenance chores now interleave by score instead of pinning below daily upkeep (a user-visible behaviour change, documented in the README).

**Backend routes** (`app.ts`): `GET /api/chores`, `GET /api/events` (SSE doorbell), `POST /api/chores`, `PUT /api/chores/:id` (full-replace edit, 200 / 400 `Invalid id` / 400 `Missing required fields` / 404 `Chore not found` / 500), `PATCH /api/chores/:id/complete`, `DELETE /api/chores/:id`. CORS `Access-Control-Allow-Methods` includes `PUT`. Tests for the SSE bus at `backend/src/__tests__/events.test.ts`.

**Frontend API** (`frontend/src/services/choreApi.ts`): `fetchAllChores`, `addChore`, `updateChore(id, chore)`, `completeChore`, `removeChore`.

**Key UI**
- `App.tsx` — orchestrator: holds `choreData`, `sortedIds`, day-simulation (`simulatedDate`/`isSimulating`, real clock via `realToday`), room filter (`uniqueRooms` derived; `useRoomFilter(choreData, selectedRoom)` → `filteredChores`), **search filter** (`searchFilteredChores` derived from `filteredChores`, feeding `orderedChores`), day-simulation handlers, add/edit/delete handlers (F4-L/F2-L/F5-L trio), SSE subscription (`useChoreEvents` + gated `reconcileChores`), and the **two kiosk overlays**: `useScreenBlank()` → `{ isBlanked, wake }` rendering `<ScreenBlankOverlay onWake={wake} />` when `isBlanked` (`F1`, shipped #27), and `useTouchLock()` → `{ isLocked, arm }` rendering `TouchLockIndicator` always plus `TouchLockOverlay` when `(isLocked || isClosing) && !isBlanked` (`F2`, shipped #28), the app root `inert` while either is active, with a force-close-dialogs effect on blank/lock. **Both overlays are slated for removal by `F15`** (kiosk-layer extraction — their behavior moves to the pi-kiosk shell). Footer deck (`flex-shrink-0 py-4 flex justify-center border-t border-gray-700`, **still opaque** — `F5`'s target — `App.tsx:337`) holds `AddChoreButton`; scroll area directly above is `flex-1 overflow-y-auto min-h-0`. `NavBar` renders room chips **and the persistent search input** above the list. **There is no settings/device-control panel on `main`, and there never will be** — `F3` was superseded 2026-07-15 (migrated to pi-kiosk).
  - **SSE sync — unchanged contract:** subscribes via `useChoreEvents(onChange)` (`hooks/useChoreEvents.ts`; `new EventSource('/api/events')` + `visibilitychange→visible` re-fire). Re-pulls are gated by `isRepullGated()` (`isMutatingRef` || `showForm` || `editingId` || `pendingDeleteId`); deferred via `pendingRefreshRef`. **Any new frontend feature holding uncommitted user input in `App.tsx` state must be added to this gate.**
  - **Visible-list pipeline (three-stage):** `filteredChores = useRoomFilter(choreData, selectedRoom)` → `searchFilteredChores` (substring on `name`, from `F9-L`) → `orderedChores` (maps `sortedIds` over a `Map` of `searchFilteredChores`).
  - **`F1`'s real-clock scheduling (shipped):** `frontend/src/hooks/useScreenBlank.ts` — window-boundary re-arming timeouts driven by `realToday`, **not** `simulatedDate` (adapted from the `useMidnightClock.ts` single-`setTimeout`-to-boundary pattern, which remains available as a precedent for any future real-clock feature).
- `components/chore/ChoreTimerBar.tsx` — **F10-L's current shape**: `useSwipeable` with **swipe-left → `onEdit`**, **swipe-right → `onDelete`** (reversed from the original F5-L mapping), a controlled swipe offset revealing a behind-the-bar action layer (yellow+pencil for edit, red+trash for delete) with a **25%-of-bar-width threshold** and spring-back below it; colour fades in progressively toward the threshold (added in F10-L's third commit). `delta: 50` remains the swipeable trigger threshold (distinct from the 25%-width confirm threshold). Spread-before-explicit-props order, `touch-pan-y`, `isSimulating` guard, `swipingRef` click-suppression all preserved. Bar math from `@utils/choreBarMath` `computeBar(daysSince, frequency)` — **revised in PR #32** (`790a4ab`, untracked by any F-ID): `barColor` is `bg-red-500` only when `isOverdue`, never pre-due (previously red could appear before the due date); `ProgressBar`'s fill re-gained its `opacity-50` translucency, restoring a Tailwind v4 regression that had silently dropped the dead v3 `bg-opacity-50` utility. `h-20 sm:h-16` grid layout from F6-L unchanged.
- `components/common/ConfirmDialog.tsx` (F4-L) — unchanged; reused by the swipe-delete path. *(The former "reuse for `F10` restart confirm" plan left with the migration — restart now lives in pi-kiosk.)*
- `components/form/` — `ChoreFormModal` → **`ChoreForm`** → `FormField`. **Room field is now a `<datalist>` input** (`F3-L`) sourced from `uniqueRooms`, threaded through both Add and Edit — a raw `<input type="text" list="room-options">`, not `FormField`. The form's fields are exactly `Name` (`FormField`, `name="name"`, **`clearable`**), Room (the raw datalist input), `Last Completed` / `Duration (minutes)` / `Frequency (days)` (`FormField`, *not* `clearable`), and `Urgency` (a raw `<select id="urgency">` with blank/low/medium/high, not `FormField`) — the `Details` `FormField` and the `longTermTask` checkbox were deleted by `F4` (#38) without touching `ClearButton.tsx`, `ChoreSearchInput.tsx` or `FormField.tsx` (no diff in #38). **Clear-✕ affordance (`F14`, #34):** `FormField` takes an opt-in `clearable?: boolean` (default `false`; only Name passes it — Last Completed/Duration/Frequency don't) and renders a `ClearButton` when `clearable && value !== ''`; the raw Room `<input>` (`ref={roomInputRef}`, `pr-14`) hand-wires its own `ClearButton` (`anchor="top"`, label `"Clear Room"`). Both clear only that field's local state (no submit/close) and refocus the input.
- `components/chore/ChoreSearchInput.tsx` — the `F9-L` search box (`Search` icon, `placeholder="Search for a chore"`, `pr-14`), pinned above the scroll region. **Has a clear-✕ (`F14`, #34):** renders `ClearButton` (label `"Clear Search"`) when `value !== ''`; clearing calls `onChange('')` and refocuses, restoring the room-filtered list exactly as manual deletion does.
- `components/common/ClearButton.tsx` (`F14`, #34) — the shared clear-✕ primitive: `{ label: string; onClear: () => void; anchor?: 'center' | 'top' }`; `lucide-react` `X` inside an absolutely-positioned `right-3` 44×44 px touch target (the app's kiosk-touch convention, matching `DateNavigationBanner`); `anchor='center'` (default) vertically centres on a label-less input (search), `anchor='top'` pins to the input's top edge so it clears a `FormField`'s label. `aria-label={label}` — the three current labels are Title Case (`"Clear Search"`/`"Clear Name"`/`"Clear Room"`); sentence-casing them is an open `[a11y]` minor in `plans/PUSH-REVIEW-FINDINGS.md`. Inputs that host it reserve `pr-14`.

**Tests**
- **Vitest** unit tests both sides (backend 43, frontend 252 as of #38), now also covering the search filter (component + App-level substring/room composition + SSE-survival tests from `F9-L`), the reversed swipe mapping + threshold (`F10-L`), the clear-✕ affordance (component-level show/clear/refocus + App-level clear-restores-room-filter, from `F14`), and `F4`'s removal: `backend/src/__tests__/db-migration.test.ts` (7 cases — idempotency on `:memory:`, boot wiring against a legacy 9-column temp file, rows/other columns preserved), stale-client-key drop tests on `POST`/`PUT` and `createChore`/`updateChore`, a `ChoreForm` absence test (no Details / Long-term inputs) and a stale-`longTermTask`-flag-ignored sort test.
- **Playwright e2e**: `e2e/smoke.spec.ts`. `swipeBar(page, bar, 'left')` now triggers **edit**, `'right'` triggers **delete** (flipped by F10-L). Still depends on seed chore `Vacuum Bedroom Floor` and the `+ Add Task` flow.
- **CI**: `.github/workflows/ci.yml` unchanged — backend + frontend tests on PRs to `main`; `main` branch-protected.

**Standing invariants now baked into `main` (must not regress):**
1. Delete routes through `ConfirmDialog` (F4-L).
2. `PUT /api/chores/:id` + `updateChore` client + shared `ChoreForm` + edit-mode modal (F2-L).
3. `react-swipeable` infra (spread order, `touch-pan-y`, simulation guard, `swipingRef`) — **direction is now swipe-left=edit / swipe-right=delete with 25%-width progressive reveal + spring-back** (F10-L, current).
4. Shorter `h-20 sm:h-16` grid bar; room/overdue-badge/visible-buttons removed; decay/urgency model in `choreBarMath` (F6-L).
5. SSE re-pull: `GET /api/events` + `useChoreEvents` + gated `reconcileChores`. New writes must emit on the backend bus; new `App.tsx` state must not break `isRepullGated()` or the reconcile.
6. **Room field is a `<datalist>`** sourced from `uniqueRooms`, on both Add and Edit (F3-L).
7. **Persistent name-search filter**, view-only, ANDs with the room filter, survives SSE re-pulls, sits above the scroll region (F9-L).
8. **Auto screen-blank overlay**: `useScreenBlank()` + `ScreenBlankOverlay`, driven by real wall-clock time (`realToday`, never `simulatedDate`), blanks 21:00–06:00 local, tap-to-wake swallows the waking tap, re-blanks after 5 minutes' inactivity inside the window (F1, shipped #27). *Holds until `F15` relocates this behavior to pi-kiosk and removes the in-app code.*
9. **Double-tap touch lock**: `useTouchLock()` + `TouchLockOverlay`/`TouchLockIndicator` — local-only/per-tab, arms after 5 minutes' inactivity, unlocks on a second tap within 1500 ms and 60 px, 400 ms `CLOSING_SETTLE_MS` closing handshake, `z-[90]` always defers to the blank overlay's `z-[100]` (F2, shipped #28). *Holds until `F15` relocates this behavior to pi-kiosk and removes the in-app code.*
10. **Clear-✕ affordance on every free-text input**: search bar, form Name, form Room each render the shared `ClearButton` only when non-empty; clicking clears that field's local state only (never submits/closes) and refocuses the input; `FormField`'s affordance is opt-in via `clearable` (default off), so no other `FormField` usage (Last Completed, Duration, Frequency) gains it (F14, shipped #34; verified intact after F4 — `ClearButton.tsx`, `ChoreSearchInput.tsx`, `FormField.tsx` had no diff in #38).
11. **No `details` / `longTermTask` anywhere in the live model**: `Chore` is `id, name, room, dateLastCompleted, duration, frequency, urgency?`; the shared `ChoreForm` has no Details field or Long-term checkbox; `app.ts`/`chores.ts` never read or write them (stale keys from old clients are dropped silently, never rejected — deliberate, so a not-yet-reloaded kiosk page keeps working through the rollout; don't "fix" it with a 400); `db.ts` runs the idempotent, crash-loud `dropLegacyChoreColumns` boot migration (`pragma table_info` guard, `BEGIN IMMEDIATE`) so an existing 9-column `data.db` migrates itself to 7 columns on first boot and later boots are no-ops; `orderChores` is a single duration-weighted sort with no long-term partition (F4, shipped #38). Any future schema change adds its own guarded step beside that migration — `CREATE TABLE IF NOT EXISTS` never alters an existing `data.db`. The pre-F4 image cannot write to a migrated DB (its SQL still names the dropped columns), so a rollback restores the pre-deploy snapshot together with the old image.

**Assumptions to revisit at planning time**
1. **Resolved (F4, shipped #38):** `better-sqlite3` bundles SQLite 3.51.3 (≥ 3.35), so `ALTER TABLE … DROP COLUMN` is available and the boot migration uses it — no table-rebuild fallback was needed. Re-verify only if `better-sqlite3` is ever downgraded.
2. Tap-to-complete + the simulation pointer-events guard + the SSE re-pull gate are primary; no new feature may regress them. `F1` (shipped) already coordinates this; `F2`'s implementation resolved the same concern for its own overlay (see item 7 below).
3. **Resolved (F4, shipped #38):** `details` was never rendered, and its removal shipped without a display change; the one user-visible change was the sort (long-term chores no longer pin to the bottom — Standing invariant 11).
4. **`F6` has an end state partly outside the repo** (Pi/LAN config) — capture outcomes as deployment docs in `plans/feature/local-url-alias/`. The frozen Dockerization plan lives at `plans/completed/docker-raspberry-pi/`. *(The former host-bridge controls `F13`/`F7`/`F8`/`F10` migrated to pi-kiosk 2026-07-15 — their host-side end states are now that repo's concern; `F15`'s external gate — "pi-kiosk Phase 2 parity verified on the Pi" — is likewise verified outside this repo and recorded in `F15`'s own plan docs.)*
5. **Kiosk-only concerns now live in pi-kiosk** (2026-07-15): the device-control track migrated there, so no remaining chores4irl feature is kiosk-only — the app must simply stay embeddable (`F15`'s guarantee) and keep working standalone at `IP:port` off-kiosk. *(The old "F3–F13 degrade gracefully off-kiosk" note is retired with the migration.)*
5b. **The compose `name:` pin question survives `F13`'s supersession** as an optional, detached infra hardening (DB-volume path determinism) — re-raise it on its own merits if ever needed; nothing depends on it now.
6. **`deploy/pi/` currently has no screen-blank/DPMS/idle config** (verified — no `dpms`/`screen-blank`/`xset`/idle-inhibit files exist there). `F1` shipped without needing to touch this; if host-side auto-blank is later found enabled, disabling it is a deploy-doc note, not a blocker.
7. **Resolved (2026-07-08, in `F2`'s own implementation):** `F1`'s wake gesture and `F2`'s unlock gesture don't conflict — `TouchLockOverlay` only renders when `!isBlanked`, and `ScreenBlankOverlay` sits at a higher z-index (`z-[100]` vs. `z-[90]`), so screen-blank always wins if both would otherwise be simultaneously active. See `F2`'s Open risks (c).

---

## Per-feature session contract (the procedure every feature session runs)

*(Unchanged mechanics from the prior revision — reproduced verbatim; only the F-numbering
above it has changed.)*

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
component/prop names, the panel's control-registration shape, the lock/blank overlay
precedence — must live in the committed code/tests or be written back into this file. If a
session makes a decision that changes a *later* feature's assumed start, update that later
feature's section here in the same PR.

---

## How to run a session (invocation)

Each feature is **one fresh Claude Code session**. Start on an up-to-date checkout of `main`
(`git checkout main && git pull`) and invoke `/run-feature <F-ID>`. The session reads this
file, runs **exactly one** feature's Per-Feature Session Contract, and ends at the pushed PR —
it never chains into the next feature. Re-invoking `/run-feature <F-ID>` later (once you've
verified the branch and merged the PR) resumes at the META-PLAN-update step instead of
restarting the feature — the skill detects this from the PR's state via `gh`.

**Running several features at once.** Independent features (disjoint file surfaces) can be
implemented concurrently in **git worktrees**, one session per worktree. Invoke
`/worktree <F-ID> [<F-ID>...]` to verify the chosen F-IDs cannot merge-conflict — computed live
against the current codebase and the current numbering, never a cached table — and to
provision the worktrees; implementation still runs each feature's own Per-Feature Session
Contract via `/run-feature` inside each worktree, and the merge gate stays serial.

**Why a human gate exists between sessions.** `main` is branch-protected (PR + review + CI
required), so a session can only reach "PR pushed." **You merge the PR**; that merge is the
durable signal that lets `/run-feature` fold the merge back into this file, and lets the next
session's cold survey pass.

**Invocation:**
```
/run-feature <F-ID>
```
`/run-feature` runs cold-survey → `/plan-creator` → `/plan-reviewer` → `/run-plan` (once) →
`/git-commit` → verify "Expected end state" → `/git-push`, then — once you confirm the PR is
merged — folds the merge back into this file's Status ledger, ID map, Baseline, and Standing
invariants on its own small follow-up PR. It never starts a second feature.

**Between sessions — monitoring:** `gh pr list` / `gh pr view <n>`; `gh pr checks <n>`;
`reviews/push-review-<branch>.md` (written by `/git-push` if its review *rejects*);
`git log --oneline origin/main`; the **Status ledger** above (trust git if they disagree).

---

# COMPLETED-FEATURE CONTRACTS STILL IN FORCE

> Merged features are recorded by git and are **not** re-listed here. This section keeps
> only what still steers future work: the implemented contract of a merged feature that a
> *remaining* feature directly targets (builds on, edits, or must remove), plus
> confirmed-but-unscheduled follow-ups that would otherwise be lost. **When the last
> remaining feature depending on a contract ships, delete its entry too.** Everything
> else a merge left behind lives in the Baseline + Standing invariants above; PR/SHA
> lookups go through git (`gh pr list --state merged`).

## F2-L — Edit Task functionality  ·  merged (#15, `06e0b00`)  ·  kept: for its confirmed-but-unscheduled follow-ups (no remaining feature targets the contract itself now that `F4` shipped #38)
**Implemented contract (as built; `F4` (#38) removed `details`/`longTermTask` from every layer of it — the form now emits `Omit<Chore,'id'>` with `name, room, dateLastCompleted, duration, frequency, urgency?`):**
- **Shared form:** default export **`ChoreForm`** at `frontend/src/components/form/ChoreForm.tsx`. Props: `{ mode?: 'add' | 'edit'; initialChore?: Chore; onSubmit: (chore: Omit<Chore,'id'>) => void; onCancel: () => void }` (default `mode='add'`). Internal helper `choreToFormState(chore)` does the inverse mapping; post-submit reset gated to add mode. Its only importer is `ChoreFormModal`.
- **Modal:** `ChoreFormModal` accepts `{ mode?, initialChore?, onSubmit, onCancel }` and forwards to `ChoreForm`. The form emits `Omit<Chore,'id'>`; App supplies the id.
- **Backend:** `PUT /api/chores/:id` (full replace, 200 / 400 `Invalid id` / 400 `Missing required fields` / 404 `Chore not found` / 500); `backend/src/chores.ts` exports `updateChore(id, input): ChoreWire | null`; CORS includes `PUT`. Both handlers and both data-access functions are `details`/`longTermTask`-free since `F4` (#38); stale keys in a request body are dropped, not rejected.
- **API client:** `choreApi.ts` exports `updateChore(id, chore): Promise<Chore>`.
- **App:** `editingId` state + derived `editingChore`; optimistic update + rollback. Add/edit modals mutually exclusive.

**Known follow-up (confirmed by user, 2026-07-08 — not yet scheduled as its own feature),
UI polish on the shared add/edit/delete flow:**
1. No toast/confirmation feedback is shown after a chore is successfully added, edited, or
   deleted — success is currently silent.
2. The **Add New Chore** form modal does not close itself after a successful add; the user
   must dismiss it manually.
3. The **Add New Chore** form's `dateLastCompleted` field (`ChoreForm.tsx`) has no default —
   should default to today's date.
4. **Date-math bug:** a chore created with `dateLastCompleted` = today currently renders as
   "1 day ago" instead of "0 days ago" (displays as if completed the day prior). Likely
   cause: `ChoreForm.tsx`'s submit builds `new Date(formData.dateLastCompleted)` from a bare
   `yyyy-mm-dd` string, which `Date` parses as **UTC midnight**; `choreSort.ts`'s
   `differenceInDays(startOfDay(today), startOfDay(chore.dateLastCompleted))` then compares
   against **local** midnight — in timezones behind UTC this shifts the parsed date back a
   day before the diff is taken. Same root cause likely affects `ChoreTimerBar.tsx`'s
   `daysSince` (feeds `computeBar`) and `CompletionInfo.tsx`'s displayed "days ago" text.
5. The **Add New Chore** form's `room` field always defaults to `''` regardless of the
   currently-selected room filter — should default to the currently-selected room if one is
   active; when the room filter is `'All'`, keep the current blank-default behavior.

## Deferred follow-ups from merged features (confirmed, unscheduled — no F-ID yet)

- **Room `<datalist>` on mobile** *(from F3-L, #24; confirmed by user 2026-07-07)*: the
  suggestion dropdown does not appear on mobile even after tapping the `<datalist>` arrow —
  native `<datalist>` mobile support is inconsistent across browsers; likely needs a
  mobile-specific affordance or a custom-listbox fallback for touch. Small fix; assign an
  F-ID via `/new-feature` when scheduled.
- The add/edit/delete **UI-polish list** (toasts, modal auto-close, date defaults, the
  UTC-vs-local date-math bug) lives under `F2-L`'s entry above, tied to the shared
  add/edit form contract it would touch.

## F1 — Auto screen-blank 9pm–6am  ·  merged (#27, `a633a2a`)  ·  kept: `F15` must remove this code and pi-kiosk Phase 2 must reproduce it (parity checklist)

**Implemented contract (as built):** `frontend/src/hooks/useScreenBlank.ts` — a stateful
hook exposing `{ isBlanked, wake }`, window-boundary re-arming timeouts (21:00 blank / 06:00
wake) driven by real wall-clock time (`realToday`, **never** `simulatedDate`), a 5-minute
inactivity re-blank once woken inside the window, and `visibilitychange` resync.
`frontend/src/components/common/ScreenBlankOverlay.tsx` — a full-viewport overlay rendered
by `App.tsx` when `isBlanked`, taking `onWake={wake}`; the app content becomes `inert` while
blanked (any open dialogs auto-dismiss on blank, per the plan's DD-6); the overlay swallows
the first waking tap rather than letting it fall through to whatever's underneath. Sits at
`z-[100]`, the highest z-index of any overlay in the app — `F2`'s `TouchLockOverlay` (`z-[90]`)
explicitly defers to it (see `F2`'s Open risks (c)).

**Known follow-up:** none recorded yet.

## F2 — Double-tap accidental-touch lock  ·  merged (#28, `3160dfc`)  ·  kept: `F15` must remove this code and pi-kiosk Phase 2 must reproduce it (parity checklist)

**Implemented contract (as built — this is what `F15` must remove and pi-kiosk must
reproduce):** `frontend/src/hooks/useTouchLock.ts` — a stateful hook exposing
`{ isLocked, arm }`; a 5-minute inactivity timer (armed on mount so a fresh load starts
unlocked) re-armed by `document`-level `pointerdown`/`keydown` while unlocked; `arm()`
unlocks and restarts the countdown. `frontend/src/components/common/TouchLockOverlay.tsx` —
full-viewport intercepting portal at `z-[90]`; a second tap qualifies within
`SECOND_TAP_WINDOW_MS = 1500` and `SECOND_TAP_MAX_DISTANCE_PX = 60` (Euclidean, keyboard
activation always qualifies); padlock open/close/minimize CSS animation; exports
`CLOSING_SETTLE_MS = 400`, which `App.tsx`'s `isClosing` state consumes to keep the
overlay mounted through the closing animation. `TouchLockIndicator.tsx` — persistent
top-left `z-[80]` `pointer-events-none` state icon. `App.tsx` wiring: app root
`inert={isBlanked || isLocked}`; overlay rendered when `(isLocked || isClosing) &&
!isBlanked` — **blank always wins** (`z-[100]` vs `z-[90]`); open dialogs force-close on
lock/blank. **Scope as resolved (2026-07-08): local-only / per-browser-tab** — no backend
state, no SSE event, no cross-device sync (the ledger's original "no matter which device"
framing was explicitly decided otherwise; a shell-side lock in pi-kiosk carries the same
local-to-the-kiosk semantics forward).

**Known follow-up:** relocation to the pi-kiosk shell (Phase 2), then removal here via
`F15` — see `plans/feature/kiosk-shell-extraction/kiosk-shell-extraction.md`.

---

# REMAINING FEATURES (current numbering, incl. `F15`)

> Every remaining feature's **Assumed starting state is the Baseline above**. `F1` (#27)
> and `F2` (#28) shipped — their implemented contracts are kept under Completed-Feature
> Contracts (below) because `F15` targets them; `F14` (#34) and `F4` (#38) shipped and live
> entirely in the Baseline + Standing invariants 10–11 (no remaining feature builds on them). The
> **focus feature is `F5`** (see "Shortest path" above). `F3`/`F7`/`F8`/`F9`/`F10`/`F13`
> are **superseded — migrated to `rehankalu/pi-kiosk`** (2026-07-15, see
> `plans/feature/kiosk-shell-extraction/kiosk-shell-extraction.md`); their sections below
> are retained as banners + history only. `F11`/`F12` remain here, re-scoped; `F15` is new.

## F5 — Translucent / blur *Add Task* button deck  ·  ★ FOCUS  ·  Effort S  ·  (260707 item 5)

**Goal.** Bottom *Add Task* deck uses a transparent, blurred background so the chore list is
faintly visible beneath it; the button stays locked at the bottom and opaque while the list
scrolls beneath.

**Rank rationale.** The chore-list track's last item and the current ★FOCUS (advanced from
`F4` on 2026-09-19) — fully independent, purely visual, lowest risk.

**Effort: S.** Focused layout/CSS change to the footer deck + button; verify scroll behavior
beneath the blur on mobile viewports.

**Dependencies.** None.

**Assumed starting state** = **Baseline**. Verify:
- `App.tsx` footer deck is `<div className="flex-shrink-0 py-4 flex justify-center border-t border-gray-700">` wrapping `AddChoreButton` (still opaque — verified, `App.tsx:337`).
- Scroll area directly above is `<div className="flex-1 overflow-y-auto min-h-0">`.

**Expected end state** (repo-checkable):
- Footer deck uses a semi-transparent background with `backdrop-blur` (e.g.
  `bg-gray-900/60 backdrop-blur-*`); chore bars faintly visible beneath/around the button.
- Deck remains pinned at the bottom (`flex-shrink-0`); `AddChoreButton` remains visually opaque/legible.
- No functional/JS behavior change; existing tests still pass.

**Test-suite deltas.** Minimal — optionally assert blur/translucency classes in a small render test. No e2e change.

**Open risks / decisions.** Exact opacity/blur values — default: translucent+blurred deck,
fully opaque button. Confirm `backdrop-blur` performs acceptably on the Pi/mobile browser.

**Session loop.** Run the Per-Feature Session Contract on branch `feature/translucent-add-deck`.

---

## F3 — Settings / device-control panel (container)  ·  SUPERSEDED 2026-07-15 (migrated to pi-kiosk)

> **SUPERSEDED — do not run this feature in this repo.** The console migrated to the
> `rehankalu/pi-kiosk` shell per the kiosk-layer extraction decision
> (`plans/feature/kiosk-shell-extraction/kiosk-shell-extraction.md`). The design below
> (gear↔X NavBar toggle, single-row overlaid banner, control-registration shape,
> placeholder-first rollout) **carries over as the shell console's spec** — it just renders
> in the shell above the app iframe instead of in chores4irl's NavBar, and its controls
> call the kiosk-agent's localhost API instead of gating on an in-app backend. The section
> is retained as the spec source and audit trail.

**Goal.** A collapsible device-control panel: a `NavBar` toggle (gear/settings icon that
swaps to an X when open, co-located at the upper-right) expanding into a single-row overlaid
banner of kiosk/device-control icons. Container for `F7`–`F13`; ships with rotate (`F13`)
functional and the rest as disconnected, optimistic, inert icon placeholders.

**Rank rationale.** Unchanged in shape from the prior reconcile's `F11-L` — net-new UI
surface gating the entire device-control track, independent of the other tracks.

**Effort: M.** New panel component + `NavBar` toggle (gear↔X) + open/close state + overlaid
single-row banner + a control-registration shape for `F7`–`F13` to plug into. No backend in
this feature.

**Dependencies.** None (gates `F7`–`F13`). Coordinate with `F13`, which has a detailed
existing plan (`plans/completed/rotate-screen-button/rotate-screen-button.md`) assuming this
panel houses the rotate control — `F3` and `F13` may be planned together, but `F3` must land
first or in the same PR.

**Assumed starting state** = **Baseline**. Verify:
- `NavBar` renders only room chips + the search input; no settings/gear toggle exists.
- No settings-panel component exists under `frontend/src/components/`.

**Expected end state** (repo-checkable):
- A `NavBar` toggle renders `Settings` (gear), swapping to `X` when open.
- Toggling opens a single-row overlaid banner of device-control icons.
- `F13` (rotate) functional if implemented with/after this feature; the rest (`Sun`
  brightness, `MonitorOff` screen-blank, a control for `F9`'s auto-blank settings,
  `Power` restart, `Undo2` undo, `Redo2` redo) render as inert placeholders.
- A documented control-registration shape persisted in code/tests so `F7`–`F13` can each
  wire a handler without re-architecting the panel.

**Test-suite deltas.** Component test: toggle opens/closes; gear↔X swap; placeholder icons
render/inert; rotate invokes its handler if wired here.

**Open risks / decisions.** (a) Panel-vs-`F13` sequencing — recommended: plan together, keep
the placeholder-only path viable if `F13` slips. (b) Icon set per the ledger
(`Sun`/`MonitorOff`/`Power`/`Undo2`/`Redo2`, gear `Settings`) — `F9`'s icon TBD at its own
planning. (c) Overlay must not permanently obstruct the chore list (single-row, dismissible).
(d) Kiosk-only: degrade gracefully off-kiosk.

**Session loop.** Run the Per-Feature Session Contract on branch `feature/settings-panel`.

---

## F13 — Rotate screen button  ·  SUPERSEDED 2026-07-15 (migrated to pi-kiosk)

> **SUPERSEDED — do not run this feature in this repo.** Rotate migrated to the pi-kiosk
> **agent** (`plans/feature/kiosk-shell-extraction/kiosk-shell-extraction.md`, DD-8): the
> shell console's rotate button calls the agent's localhost HTTP API directly, replacing
> this section's chores-backend host-bridge (Express endpoint → `rotation.json` →
> bind mount → `inotifywait` watcher — all dropped). The existing detailed plan at
> `plans/completed/rotate-screen-button/rotate-screen-button.md` carries its own
> supersession banner listing exactly which of its host-side decisions are harvested
> (connector discovery, transform↔matrix table, sed-anchored persistence, injection
> guard, portrait-only toggle default, user-service Wayland env). The section is retained
> as history only.

**Goal.** In-app rotate control (housed in the `F3` panel) flipping the Pi kiosk's display +
touch orientation between the two portrait orientations (`90 ↔ 270`) without host SSH.

**Rank rationale.** Unchanged — the one functional control the panel ships with; most
involved remaining feature, with an existing detailed plan.

**Effort: L.** Per `plans/completed/rotate-screen-button/rotate-screen-button.md`: React button
→ new Express endpoint → backend writes `rotation.json` into an rmilarachi-owned bind-mounted
host dir → a host-side systemd user service watches the file and applies rotation live
(`wlr-randr`) + persistently (kanshi + labwc `calibrationMatrix`). Builds on the
version-controlled Pi rotation config from #19.

**Dependencies.** `F3` (the panel houses it) + the Pi deploy stack + merged #19 config.
LAN/Pi verification must run unsandboxed.

**Assumed starting state** = **Baseline** + `F3` panel present + the Pi deployment (#19's
kanshi/labwc config under version control). Detailed assumed-start/decisions live in
`plans/completed/rotate-screen-button/rotate-screen-button.md` — read that plan; do not
re-derive it. **That plan (unchanged by this reconcile) contains no F-number self-reference
at all — it was never called "F17" internally, so there's nothing stale to reinterpret inside
it. It's simply this section, `F13`, under the current scheme.**

**Expected end state** (repo-checkable **+ deploy-doc-anchored**):
- A rotate control in the `F3` panel toggles portrait `90 ↔ 270`; landscape unreachable from the button.
- New Express endpoint + `rotation.json` write path (app code, testable); host-side watcher/bind-mount/systemd unit captured as deploy docs under `plans/completed/rotate-screen-button/`.
- Display and touch stay in sync after rotation.

**Test-suite deltas.** Backend test for the endpoint + `rotation.json` write. Host-side
behavior verified manually on the Pi (unsandboxed).

**Open risks / decisions.** Use the existing plan's decisions verbatim (bind-mount required
for the non-root user service; portrait-only toggle; host-bridge file-watch mechanism).
**Do not re-plan from scratch** — refine the existing plan.

**Session loop.** Run the Per-Feature Session Contract on branch `feature/rotate-screen-button`
(refine the existing plan; the `plans/completed/rotate-screen-button/` dir already exists).

---

## F7, F8, F9, F10 — Device controls  ·  SUPERSEDED 2026-07-15 (migrated to pi-kiosk)  ·  F11, F12 — re-scoped, remain here

> **F7 (brightness), F8 (manual blank/wake), F9 (auto-blank settings-UI), and F10
> (restart) are superseded — migrated to pi-kiosk** per
> `plans/feature/kiosk-shell-extraction/kiosk-shell-extraction.md`. In the new design they
> are agent-backed console controls: the shell console calls the kiosk-agent's localhost
> HTTP API directly (no chores-backend state files, no host-bridge). `F9` becomes the
> shell settings UI editing agent-owned config (`PATCH /api/config`), which now owns the
> blank schedule `F1` used to hardcode — the old "F1 must expose its schedule as
> configurable state" prerequisite is retired (the schedule leaves this app entirely at
> `F15`). `F8`-vs-`F1`-vs-`F9` naming distinction (manual toggle vs auto schedule vs
> settings for the schedule) carries over to the pi-kiosk backlog verbatim. `F7`'s
> hardware feasibility question (HDMI panel, likely no backlight sysfs; `ddcutil` or
> software gamma) is deliberately left to pi-kiosk planning (design doc DD-10).

- **F11 — Undo** *(= legacy `F15-L`; re-scoped 2026-07-15)*. Recover from accidental
  touch/completion. **Effort M–L** (bounded action/undo cache; 1–2 levels deep
  acceptable). Must reconcile with the SSE re-pull (an undo is itself a write that must
  emit on the bus). **Remains a chores4irl feature** — undo/redo act on chore data the
  shell can't see. Surfaced through the pi-kiosk console via the **`kiosk/v1` postMessage
  contract** (app registers controls with the shell; shell renders them in the console
  banner and posts `console-action` back) — chores4irl is the contract's first app-side
  client. **Deferred until pi-kiosk Phase 4 delivers the contract.** Branch `feature/undo`.
- **F12 — Redo** *(= legacy `F16-L`; re-scoped 2026-07-15)*. Re-apply an undone action;
  pairs with `F11`'s cache. **Effort M.** Depends on `F11` + the same external Phase 4
  gate. Branch `feature/redo`.

---

## F15 — Adopt kiosk-shell (remove F1/F2 overlays + embeddability guarantee)  ·  Effort M  ·  (added 2026-07-15)

**Goal.** Complete chores4irl's side of the kiosk-layer extraction: once the pi-kiosk
shell reproduces the blank/lock behavior in front of the iframe-embedded app, remove the
now-redundant in-app implementations and make the app's embeddability a documented
guarantee instead of an accident. See
`plans/feature/kiosk-shell-extraction/kiosk-shell-extraction.md` (the cross-repo
contract, incl. DD-9's no-feature-flag decision and the double-overlay interim window).

**Rank rationale.** The only chores4irl code change the extraction requires. Gated
externally, so it floats independent of the chore-list track.

**Effort: M.** Deletion-heavy but wide: two hooks, three components, the `App.tsx`
`inert`/`isClosing`/force-close wiring, and their test suites; plus the nginx/README
embeddability notes; plus verifying no e2e spec depends on the overlays.

**Dependencies.** **External:** pi-kiosk Phase 2 parity verified on the wall Pi (blank
window, wake-tap swallow, 5-min re-blank, lock re-arm, double-tap unlock — checked
against the shipped `F1`/`F2` contracts recorded under Completed-Feature Contracts). Record the
verification (date + what was checked) in `plans/feature/kiosk-shell-adoption/` when this
feature runs. No in-repo dependency.

**Assumed starting state** = **Baseline** (F1/F2 code present on `main`). Verify:
- `grep -rln "useScreenBlank\|useTouchLock" frontend/src` hits the two hooks, `App.tsx`,
  and their tests.
- `nginx.conf` has no `X-Frame-Options`/`frame-ancestors` header (embeddable by accident).
- The kiosk Chromium autostart already points at the shell (pi-kiosk Phase 1 done).

**Expected end state** (repo-checkable):
- `grep -rn "useScreenBlank\|useTouchLock\|ScreenBlankOverlay\|TouchLockOverlay\|TouchLockIndicator" frontend/src`
  → no matches; no `inert` kiosk gate or `isClosing` handshake remains in `App.tsx`.
- Standing invariants 8–9 are retired from the Baseline (annotated as relocated, not
  regressed — the behavior lives in pi-kiosk).
- `nginx.conf` carries a comment guaranteeing embeddability (no frame-blocking headers;
  cite the shell origin); root README points at pi-kiosk for screen concerns.
- All suites green with the F1/F2 test files deleted; invariants 1–7 untouched.

**Test-suite deltas.** Delete the F1/F2 hook/component/App-level suites
(`useScreenBlank`, `useTouchLock`, `App.screenBlank.*`, `App.touchLock`,
`ScreenBlankOverlay`, `TouchLockOverlay`, `TouchLockIndicator`). Check
`e2e/smoke.spec.ts` for overlay references (none expected). No new tests beyond a
possible trivial nginx-config assertion.

**Open risks / decisions.** (a) Double-overlay interim: between pi-kiosk Phase 2 deploy
and this PR, both overlay layers run (shell + in-app) — functional but annoying; keep the
window to one deploy cycle (design doc DD-9). (b) Do **not** carry the removal into a
feature flag — outright deletion per DD-9. (c) If parity verification finds gaps, fix
them in pi-kiosk first; this feature never starts on partial parity.

**Session loop.** Run the Per-Feature Session Contract on branch
`feature/kiosk-shell-adoption`.

---

## F6 — Local URL alias instead of IP:port  ·  Infra track (parallel)  ·  Effort M–L (research spike)  ·  (260707 item 6, = legacy `F8-L`)

**Goal.** Let LAN users reach the app by a memorable name instead of the raw IP — e.g. `c4i`
instead of `[local_IP_address]:[port]`. Explore viable options; implement the best fit for
the Pi/Docker deployment.

**Rank rationale.** Unchanged — entirely separate surface from app code; touches LAN name
resolution / the Pi deployment. Blocks nothing, blocked by nothing. Least-confident estimate
(research spike).

**Effort: M–L (research-first).** Candidates to evaluate at planning time: mDNS/Avahi
(`c4i.local`, low-friction, `.local` suffix required), LAN DNS (router static entry or
`dnsmasq` on the Pi, can resolve a bare `c4i` with a search domain, more setup), hosts-file
entries (rejected — doesn't scale). Confirmed unchanged: no avahi/dnsmasq/`.local` config
exists in the repo today (verified).

**Dependencies.** The deployment stack (Pi, Docker; frozen Dockerization plan at
`plans/completed/docker-raspberry-pi/`). No app-feature dependency.

**Assumed starting state** = **Baseline** + existing Pi deployment (app served at LAN IP on
port 80). Review `plans/completed/docker-raspberry-pi/` and the live compose/nginx config
before planning.

**Expected end state** (repo-checkable **+ deployment-doc-anchored**):
- A documented, reproducible mechanism by which a LAN client reaches the app via a name,
  recorded as deployment docs/config in `plans/feature/local-url-alias/`.
- The chosen name resolves from at least the primary target client(s); raw IP:port still works.
- Decision (mechanism, name, why) and client-side caveats written into the deployment docs.

**Test-suite deltas.** None in app test suites. Manual/operational verification on the Pi +
a LAN client, documented in the deploy docs.

**Open risks / decisions.** Bare `c4i` vs `c4i.local` (single-label names are treated as a
search query by many browsers — `.local` is the low-effort path); client coverage
(iOS/Android/Windows/macOS mDNS support varies); sandbox cannot reach the Pi LAN — verify
unsandboxed; keep additive; deploy-doc capture is mandatory.

**Session loop.** Run the Per-Feature Session Contract on branch `feature/local-url-alias`
(planning begins with a research spike).

---

## Chain integrity (remaining work, current numbering, incl. `F15`)

```
CHORE-LIST TRACK (one item left; F14 shipped #34, F4 shipped #38 — the 2026-07-08 order F14 → F4 → F5 is honored by history)
  Baseline ─★F5★ (blur Add-Task deck)

KIOSK EXTRACTION TRACK (2026-07-15 — external gates; see plans/feature/kiosk-shell-extraction/)
  [pi-kiosk Phase 1: shell scaffold + iframe passthrough]
  [pi-kiosk Phase 2: agent activity feed + overlay port, parity on the Pi] ──► F15 (adopt kiosk-shell)
      (F15 removes the shipped F1/F2 overlay code — Standing invariants 8–9 hold until then)
  [pi-kiosk Phase 3: console + agent controls  ·  absorbs F3/F7/F8/F10/F13 — superseded here]
  [pi-kiosk Phase 4: settings (absorbs F9) + kiosk/v1 contract] ──► F11 (undo) ─→ F12 (redo)

INFRA TRACK
  Baseline ─F6 (LAN alias; independent — if it lands, it becomes pi-kiosk's target_url)
```

- **No hard chain remains inside this repo.** The old device-control edge (`F3` gates
  `F7`–`F13`) left the repo with the migration — pi-kiosk's Migration Phases carry that
  sequencing now. What remains here: no ordering at all inside the chore-list track (its
  soft `F14` → `F4` → `F5` preference of 2026-07-08 is satisfied by history — `F14` #34 and
  `F4` #38 shipped; only `F5` is left), and two **external** gates (`F15` on pi-kiosk
  Phase 2 parity; `F11`/`F12` on Phase 4's `kiosk/v1` contract, with `F12` also following
  `F11`). `F6` is fully parallel.
- **Focus path:** `F5` — the chore-list track's last item; nothing blocks it. Once it
  merges, the kiosk-extraction features still cannot start until their external gates open,
  regardless of local appetite, and `F6` is the only unblocked candidate — `F5`'s fold-back
  decides (ask the user) rather than assuming `F6` becomes ★FOCUS.
- **Cross-feature couplings to honor:**
  - **F1 ↔ F2 — shipped and resolved.** `ScreenBlankOverlay` (`z-[100]`) always wins over
    `TouchLockOverlay` (`z-[90]`); the pi-kiosk port must preserve this precedence, and
    `F15` removes both sides of it here at once (never one overlay without the other).
  - **F1 → F9 — retired.** `F9` migrated to pi-kiosk, where the schedule lives in agent
    config; `F1` no longer needs to expose configurable state (the hardcoded 21:00/06:00
    constants leave with `F15`).
  - **F11/F12 ↔ SSE:** undo/redo are writes — they must emit on the bus and respect the
    re-pull gate, exactly like any other mutation (`kiosk/v1` changes how they're
    *triggered*, not what they *are*).
  - **F15 ↔ e2e:** check `e2e/smoke.spec.ts` for overlay dependencies before deleting the
    F1/F2 suites.
  - **F6** shares no files with any of them.
- Cumulative invariants that must hold from each feature onward:
  - From **F1**/**F2** *(shipped — Standing invariants 8–9)*: blank + lock contracts as
    recorded under Completed-Feature Contracts; **held until `F15` relocates the behavior to
    pi-kiosk**, at which point they are retired-as-relocated, not regressed.
  - From **F5**: translucent/blurred Add-Task deck, opaque button.
  - From **F15**: the app is embeddable (no frame-blocking headers — documented in
    `nginx.conf` + README) and contains no kiosk/screen code; it works identically
    standalone at `IP:port` and inside the pi-kiosk shell.
  - From **F11**: bounded undo cache; undo emits on the SSE bus. From **F12**: redo pairs
    with F11's cache.
  - From **F6**: a documented LAN name-alias to the app; IP:port still works.
  - **Already holding (legacy, unchanged):** delete-confirm, `PUT`/edit, swipe infra
    (now edit-left/delete-right + 25% reveal), shorter grid bar, SSE re-pull gate, Room
    `<datalist>`, persistent name-search filter, clear-✕ on search/Name/Room with
    opt-in `clearable` on `FormField` (F14, #34 — Standing invariant 10), and no
    `details`/`longTermTask` anywhere in the live model (`app.ts`, `chores.ts`,
    `SharedTypes.d.ts`, non-test frontend) with the idempotent `dropLegacyChoreColumns`
    boot migration in `db.ts` (F4, #38 — Standing invariant 11).

> If any session's cold survey finds the repo does **not** match its assumed start, **stop
> and reconcile** before planning. The repository is the single source of truth across
> sessions; this file records the *intended* order and must be updated in-PR whenever the
> actual order diverges.
