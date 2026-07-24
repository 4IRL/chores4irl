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

**Current focus: `F14`** (clear-✕ affordance on free-text inputs) — see *Shortest path to
the focus feature* below.

**Shipped through PR #28** — merged work is recorded by git, not re-tabulated here
(`gh pr list --state merged` / `git log --oneline main`). What each merge left behind
that still matters is captured *forward*: in the Baseline, the Standing invariants, and
the few completed-feature contracts kept below because a remaining feature builds on or
must remove them. **History policy:** once a feature's PR is *verified* merged (never
self-marked) and the Baseline/invariants absorb its contract, its rows and sections are
deleted from this file — the
only history kept is what stops a future session from re-treading already-traveled
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

**Branch hygiene — clean.** Every merged/superseded/abandoned branch through #28 has been
pruned (local + remote), each verified against `git log`/`gh` before deletion; the
per-branch forensics live in git history (PRs #26, #29, #30). A cold survey finding only
`main` (plus any live feature branch) is the expected state — do not resurrect pruned
branches, and do not expect plan dirs for features that shipped without one (F9-L, F3-L).

### Remaining work — three tracks (current numbering, incl. `F14`/`F15`)

```
Chore-list track (small; disjoint surfaces, soft order):
    F14 (clear-✕ on free-text inputs, S ★FOCUS) ── F4 (remove Details/Long-term fields, M) ── F5 (blur Add-Task deck, S)
    (F14 ordered first per user preference — see its section for why)

Kiosk extraction track (2026-07-15 — see plans/feature/kiosk-shell-extraction/):
    [external] rehankalu/pi-kiosk Phases 1–4 ──► F15 (adopt kiosk-shell, M) after Phase 2 parity
        (F15 removes the shipped F1/F2 overlay code once the shell reproduces it)
    F3 · F7 · F8 · F9 · F10 · F13 ── SUPERSEDED (migrated to pi-kiosk; no chores4irl session runs them)
    F11 (undo) ─→ F12 (redo) ── remain here, re-scoped onto the kiosk/v1 postMessage
        contract; deferred until pi-kiosk Phase 4 delivers the contract

Infra track:
    F6 (local URL alias, M–L · research-first) ── independent; different surface entirely
```

- **Chore-list track:** `F14`, `F4`, and `F5`. Disjoint surfaces; `F14` ordered first per
  explicit user preference (2026-07-08) — this accepts that `F14`'s shared-`FormField`
  clear-affordance work must exclude the still-present Details field via an opt-in prop
  (rather than sequencing `F14` after `F4` to avoid that cost — see `F14`'s section).
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

### Shortest path to the focus feature (`F14`)

**`F14` is the current ★FOCUS and the shortest hop** (clear-✕ affordance on free-text
inputs) — zero prerequisites and the smallest remaining estimate (S). The user explicitly
ordered it ahead of `F4`/`F5` in the chore-list track (2026-07-08), accepting that `F14`'s
shared-`FormField` clear-affordance work must be scoped as an opt-in prop (not a blanket
default) so it doesn't touch the Details field, which `F4` removes later. See `F14`'s own
section for the exact reasoning.

- **Do not** pull `F4`/`F5` ahead of `F14` — the user's ordering choice (2026-07-08) put
  `F14` first in the chore-list track.
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

### Remaining (current numbering incl. `F14`/`F15`; reassessed against current `main` after the 2026-07-15 extraction reconcile)

| Order | Feature | Effort | Depends on | Track |
|---|---|---|---|---|
| ★ | **F14** — Clear-✕ affordance on every free-text input *(added 2026-07-08)* **[FOCUS]** | **S** | — | Chore-list |
| 1 | **F4** — Remove *Details* & *Long-term task* fields | **M** | none blocking *(F3-L already merged)* | Chore-list |
| 2 | **F5** — Translucent/blur *Add Task* deck | **S** | — | Chore-list |
| 3 | **F15** — Adopt kiosk-shell: remove F1/F2 overlays + embeddability guarantee *(added 2026-07-15)* | **M** | **external:** pi-kiosk Phase 2 parity verified on the Pi | Kiosk extraction |
| 4 | **F11** — Undo *(re-scoped 2026-07-15 onto the `kiosk/v1` contract)* | **M–L** | **external:** pi-kiosk Phase 4 (`kiosk/v1` contract) | Kiosk extraction |
| 5 | **F12** — Redo *(re-scoped 2026-07-15)* | **M** | F11 + same external gate | Kiosk extraction |
| — | **F6** — Local URL alias instead of IP:port | **M–L** *(research spike)* | deployment stack (Pi/Docker); independent | Infra (parallel) |
| ~~—~~ | ~~**F3 · F7 · F8 · F9 · F10 · F13** — device-control console + its controls~~ | — | **superseded 2026-07-15** — migrated to pi-kiosk (shell console / agent controls / settings; `F13`'s plan harvested, see its banner) | *(migrated)* |

**Effort tally (remaining, in this repo).** Chore-list track: F14 (S) + F4 (M) + F5 (S) ≈
**4 pts**. Kiosk extraction track: F15 (M=2) + F11 (M–L≈2–3) + F12 (M=2) ≈ **6–7 pts**,
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
| F1-L remove Details/Long-term | → **F4** |
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
| *(none — new, added 2026-07-08)* | **F14** — clear-✕ affordance on free-text inputs |
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
| **F14 — clear-✕ affordance on free-text inputs** *(added 2026-07-08)* ★FOCUS | pending | `feature/clear-input-buttons` | — |
| F4 — remove Details/Long-term | pending | `feature/remove-details-longterm` | — |
| F5 — translucent Add-Task deck | pending | `feature/translucent-add-deck` | — |
| F15 — adopt kiosk-shell *(added 2026-07-15)* | pending *(gated on external pi-kiosk Phase 2 parity)* | `feature/kiosk-shell-adoption` | — |
| F11 — undo *(re-scoped 2026-07-15: `kiosk/v1` contract)* | pending *(gated on external pi-kiosk Phase 4)* | `feature/undo` | — |
| F12 — redo *(re-scoped 2026-07-15)* | pending *(gated on F11 + same external gate)* | `feature/redo` | — |
| F6 — local URL alias | pending | `feature/local-url-alias` | — |
| F3 · F7 · F8 · F9 · F10 · F13 — device-control console + controls | **superseded** *(2026-07-15 — migrated to pi-kiosk; branches never created)* | — | — |

**Branch/dir cleanup:** all sweeps through 2026-07-08 are done — no `(prune)` markers
outstanding; per-branch details live in git history (PRs #22, #26, #29). Future sweeps run
`plans/COMPACT-PLANS-PROMPT.md`.

**Ledger update protocol (per session):** set `in-progress` on start; `in-review` + PR
link after `git-push`; once the PR is *verified* merged (never self-marked), the row is
**deleted** rather than kept as `merged` — git carries merged history. Ledger edits ride
in the feature's own commits/PR.

---

## Baseline: the codebase as it exists today (`main` at PR #28, `3160dfc`)

> **This Baseline reflects `main` after PR #28 (`3160dfc`).** It is the literal current
> state and the **assumed starting state for every remaining feature.**
> Touch-lock is fully on `main`:
> `frontend/src/hooks/useTouchLock.ts`, `components/common/TouchLockOverlay.tsx` (with the
> exported `CLOSING_SETTLE_MS` / `App.tsx` `isClosing` unmount handshake), and
> `TouchLockIndicator.tsx`, wired via `inert={isBlanked || isLocked}` on the app root.

Monorepo using **npm workspaces** (`frontend`, `backend`) with shared types at the repo root.

**Stack**
- **Frontend** (`frontend/`): React 19 + Vite 6 + Tailwind 4, `date-fns`, `lucide-react@^1.8.0`, `react-swipeable@^7.0.2`. Entry `frontend/src/App.tsx`.
- **Backend** (`backend/`): Express + `better-sqlite3`, TypeScript ESM. Entry `backend/src/server.ts`; app `backend/src/app.ts`; data access `backend/src/chores.ts`; schema+seed `backend/src/db.ts`; SSE event bus (in-process `EventEmitter`, emits on every successful write).
- **Shared types**: `types/SharedTypes.d.ts` — declaration-only, imported as `import type` (alias `@customTypes/SharedTypes`).
- **SQLite**: file `data.db` (WAL). Schema is created with `CREATE TABLE IF NOT EXISTS` in `db.ts` — **there is no migration framework**; an existing `data.db` (local and on the deployed Pi) is *not* altered by editing the `CREATE TABLE` text. **(This is the constraint F4 must solve with an explicit idempotent column-drop migration; verified still true — no `DROP COLUMN`/`pragma table_info` migration exists yet.)**
- **Path aliases**: `@customTypes/*`, `@utils/*`.

**Domain model** (`Chore`): `id, name, details?, room, dateLastCompleted, duration, frequency, urgency?, longTermTask?`. The DB `chores` table columns: `id, name, details, room, date_last_completed, duration, frequency, urgency, long_term_task`. **`details` and `long_term_task` are still present — verified via `grep -rn "longTermTask\|long_term_task" backend/src frontend/src types` — `F4` has not run.** `urgency` is retained permanently.

**Backend routes** (`app.ts`): `GET /api/chores`, `GET /api/events` (SSE doorbell), `POST /api/chores`, `PUT /api/chores/:id` (full-replace edit, 200 / 400 `Invalid id` / 400 `Missing required fields` / 404 `Chore not found` / 500), `PATCH /api/chores/:id/complete`, `DELETE /api/chores/:id`. CORS `Access-Control-Allow-Methods` includes `PUT`. Tests for the SSE bus at `backend/src/__tests__/events.test.ts`.

**Frontend API** (`frontend/src/services/choreApi.ts`): `fetchAllChores`, `addChore`, `updateChore(id, chore)`, `completeChore`, `removeChore`.

**Key UI**
- `App.tsx` — orchestrator: holds `choreData`, `sortedIds`, day-simulation (`simulatedDate`/`isSimulating`, real clock via `realToday`), room filter (`uniqueRooms` derived; `useRoomFilter(choreData, selectedRoom)` → `filteredChores`), **search filter** (`searchFilteredChores` derived from `filteredChores`, feeding `orderedChores`), day-simulation handlers, add/edit/delete handlers (F4-L/F2-L/F5-L trio), SSE subscription (`useChoreEvents` + gated `reconcileChores`), and the **two kiosk overlays**: `useScreenBlank()` → `{ isBlanked, wake }` rendering `<ScreenBlankOverlay onWake={wake} />` when `isBlanked` (`F1`, shipped #27), and `useTouchLock()` → `{ isLocked, arm }` rendering `TouchLockIndicator` always plus `TouchLockOverlay` when `(isLocked || isClosing) && !isBlanked` (`F2`, shipped #28), the app root `inert` while either is active, with a force-close-dialogs effect on blank/lock. **Both overlays are slated for removal by `F15`** (kiosk-layer extraction — their behavior moves to the pi-kiosk shell). Footer deck (`flex-shrink-0 py-4 flex justify-center border-t border-gray-700`, **still opaque** — `F5`'s target — `App.tsx:271`) holds `AddChoreButton`; scroll area directly above is `flex-1 overflow-y-auto min-h-0`. `NavBar` renders room chips **and the persistent search input** above the list. **There is no settings/device-control panel on `main`, and there never will be** — `F3` was superseded 2026-07-15 (migrated to pi-kiosk).
  - **SSE sync — unchanged contract:** subscribes via `useChoreEvents(onChange)` (`hooks/useChoreEvents.ts`; `new EventSource('/api/events')` + `visibilitychange→visible` re-fire). Re-pulls are gated by `isRepullGated()` (`isMutatingRef` || `showForm` || `editingId` || `pendingDeleteId`); deferred via `pendingRefreshRef`. **Any new frontend feature holding uncommitted user input in `App.tsx` state must be added to this gate.**
  - **Visible-list pipeline (three-stage):** `filteredChores = useRoomFilter(choreData, selectedRoom)` → `searchFilteredChores` (substring on `name`, from `F9-L`) → `orderedChores` (maps `sortedIds` over a `Map` of `searchFilteredChores`).
  - **`F1`'s real-clock scheduling (shipped):** `frontend/src/hooks/useScreenBlank.ts` — window-boundary re-arming timeouts driven by `realToday`, **not** `simulatedDate` (adapted from the `useMidnightClock.ts` single-`setTimeout`-to-boundary pattern, which remains available as a precedent for any future real-clock feature).
- `components/chore/ChoreTimerBar.tsx` — **F10-L's current shape**: `useSwipeable` with **swipe-left → `onEdit`**, **swipe-right → `onDelete`** (reversed from the original F5-L mapping), a controlled swipe offset revealing a behind-the-bar action layer (yellow+pencil for edit, red+trash for delete) with a **25%-of-bar-width threshold** and spring-back below it; colour fades in progressively toward the threshold (added in F10-L's third commit). `delta: 50` remains the swipeable trigger threshold (distinct from the 25%-width confirm threshold). Spread-before-explicit-props order, `touch-pan-y`, `isSimulating` guard, `swipingRef` click-suppression all preserved. Bar math from `@utils/choreBarMath` `computeBar(daysSince, frequency)` unchanged (`h-20 sm:h-16` grid layout from F6-L).
- `components/common/ConfirmDialog.tsx` (F4-L) — unchanged; reused by the swipe-delete path. *(The former "reuse for `F10` restart confirm" plan left with the migration — restart now lives in pi-kiosk.)*
- `components/form/` — `ChoreFormModal` → **`ChoreForm`** → `FormField`. **Room field is now a `<datalist>` input** (`F3-L`) sourced from `uniqueRooms`, threaded through both Add and Edit — a raw `<input type="text" list="room-options">`, not `FormField`. `Name` renders via `FormField` (`name="name"`); `Details` also renders via `FormField` (`name="details"`) — **`F4`'s target**, unchanged from before. **None of Name/Room/the search bar currently has a clear-✕ affordance — `F14`'s target.**
- `components/chore/ChoreSearchInput.tsx` — the `F9-L` search box (`Search` icon, `placeholder="Search for a chore"`), pinned above the scroll region. **No clear-✕ button yet — `F14`'s target** (absorbs the prior unscheduled follow-up note under `F9-L`).

**Tests**
- **Vitest** unit tests both sides, now also covering the search filter (component + App-level substring/room composition + SSE-survival tests from `F9-L`) and the reversed swipe mapping + threshold (`F10-L`).
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

**Assumptions to revisit at planning time**
1. `better-sqlite3` bundles SQLite ≥ 3.35 (needed by **F4**'s `DROP COLUMN`). Verify at F4 planning, else fall back to a table-rebuild migration. *(Unchanged from prior reconcile — still unverified.)*
2. Tap-to-complete + the simulation pointer-events guard + the SSE re-pull gate are primary; no new feature may regress them. `F1` (shipped) already coordinates this; `F2`'s implementation resolved the same concern for its own overlay (see item 7 below).
3. `details` is not rendered anywhere in the UI, so `F4`'s removal is display-safe.
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
(`git checkout main && git pull`) and paste a kickoff prompt. The session reads this file,
runs **exactly one** feature's contract, and ends at the pushed PR. It never chains into the
next feature — that is a new session, started by you after the prior PR is merged.

**Running several features at once.** Independent features (disjoint file surfaces) can be
implemented concurrently in **git worktrees**, one session per worktree. Use
`plans/WORKTREE-PARALLELIZE-PROMPT.md` to verify the chosen F-IDs cannot merge-conflict and
to provision the worktrees; implementation still runs each feature's own Per-Feature Session
Contract, and the merge gate stays serial. **Use the current (260707) F-IDs when filling in
`FEATURES`** — that template's own worked example still cites old F-numbers (see its stale-
numbering note), but the mechanism itself is numbering-scheme-agnostic, it just needs valid
slugs.

**Why a human gate exists between sessions.** `main` is branch-protected (PR + review + CI
required), so a session can only reach "PR pushed." **You merge the PR**; that merge is the
durable signal that lets the next session's cold survey pass.

**Kickoff prompt — explicit (recommended):**
```
Read META-PLAN.md. Run feature <F-id> (current numbering, e.g. F14) and only that
feature. Follow its Per-Feature Session Contract: cold-survey and verify the repo matches
the Baseline / that feature's "Assumed starting state" (STOP and report if it diverges), set
its Status ledger row to in-progress, then create-plan → review-plan → run-plan (once) →
git-commit → verify "Expected end state" → update the ledger row to in-review with the PR
link → git-push. End the session after the PR is pushed. Do not start any other feature.
```

**Kickoff prompt — focus feature (recommended next session; `F2` merged #28, so `F14` is up):**
```
Read META-PLAN.md. Run feature F14 (clear-✕ affordance on free-text inputs) and only F14. It
has no prerequisites — implement it directly. Per its Per-Feature Session Contract: cold-survey
against the Baseline (confirm no clear-✕ button exists yet on the search bar, Name, or Room
fields), then create-plan → review-plan → run-plan (once) → git-commit → verify "Expected end
state" → git-push. End after the PR.
```

**Skill mapping:** create-plan → `/plan-creator`; review-plan → `/plan-reviewer`; run-plan →
`/run-plan` (once, on this feature's plan only); then `/git-commit` and `/git-push`.

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

## F2-L — Edit Task functionality  ·  merged (#15, `06e0b00`)  ·  kept: current `F4` edits this contract
**Implemented contract (as built — still targeted by current `F4`):**
- **Shared form:** default export **`ChoreForm`** at `frontend/src/components/form/ChoreForm.tsx`. Props: `{ mode?: 'add' | 'edit'; initialChore?: Chore; onSubmit: (chore: Omit<Chore,'id'>) => void; onCancel: () => void }` (default `mode='add'`). Internal helper `choreToFormState(chore)` does the inverse mapping; post-submit reset gated to add mode. Its only importer is `ChoreFormModal`.
- **Modal:** `ChoreFormModal` accepts `{ mode?, initialChore?, onSubmit, onCancel }` and forwards to `ChoreForm`. The form emits `Omit<Chore,'id'>`; App supplies the id.
- **Backend:** `PUT /api/chores/:id` (full replace, 200 / 400 `Invalid id` / 400 `Missing required fields` / 404 `Chore not found` / 500); `backend/src/chores.ts` exports `updateChore(id, input): ChoreWire | null`; CORS includes `PUT`. **Current `F4` must de-reference `details`/`longTermTask` from both `createChore` and `updateChore`, and both `POST` and `PUT` handlers.**
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
  UTC-vs-local date-math bug) lives under `F2-L`'s entry above, tied to the contract `F4`
  will edit.

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

# REMAINING FEATURES (current numbering, incl. `F14`/`F15`)

> Every remaining feature's **Assumed starting state is the Baseline above**. `F1` (#27)
> and `F2` (#28) shipped — their implemented contracts are kept under Completed-Feature
> Contracts (below) because `F15` targets them. The
> **focus feature is `F14`** (see "Shortest path" above). `F3`/`F7`/`F8`/`F9`/`F10`/`F13`
> are **superseded — migrated to `rehankalu/pi-kiosk`** (2026-07-15, see
> `plans/feature/kiosk-shell-extraction/kiosk-shell-extraction.md`); their sections below
> are retained as banners + history only. `F11`/`F12` remain here, re-scoped; `F15` is new.

## F14 — Clear-✕ affordance on every free-text input  ·  ★ FOCUS  ·  Effort S  ·  (added 2026-07-08)

**Goal.** Add a single-click "✕" to every free-text input field so a user can clear typed
content without manually deleting characters: the persistent chore-search bar
(`ChoreSearchInput`), and the Add/Edit chore form's Name and Room fields. The "✕" appears
only when the field has content, and empties it on click, mirroring the icon-affordance
pattern already used elsewhere in the app (e.g. the search bar's `Search` icon).

**Scope, resolved 2026-07-08 (was the day's design decision):**
- **In scope:** search bar, chore-name field (`ChoreForm`'s `name`), room field (`ChoreForm`'s
  `room`, the `<datalist>` input).
- **Out of scope:** the Details field (`FormField` `name="details"`) — `F4` removes it
  entirely, so building a clear-affordance for it would be wasted work; Duration/Frequency
  (numeric inputs) and Last Completed (date input) — clearing a typed substring doesn't fit
  those input types the same way.
- **Absorbs and supersedes** the previously-unscheduled follow-up note under `F9-L`, which
  only covered the search bar.

**Rank rationale.** Ordered **ahead of `F4`/`F5`** in the chore-list track per explicit user
choice (2026-07-08) — smallest remaining estimate, zero prerequisites. This ordering accepts
a cost: since `F4` hasn't removed the Details field yet when `F14` runs, `F14`'s change to the
shared `FormField` component must be **opt-in per-field** (e.g. a `clearable` prop defaulted
off), not a blanket default-on — otherwise Details would transiently gain a clear-✕ button
that `F4` then deletes along with the whole field. `ChoreSearchInput` and the raw `room`
`<input>` aren't shared with Details, so no equivalent care is needed there.

**Effort: S.** Three call sites (search bar, `FormField` for Name — opt-in prop, raw Room
`<input>`), each needing: track "has content" state (already available via each field's
existing `value`), a positioned "✕" button visible only when non-empty, and an `onClick`
that clears the field's state. No backend/schema change.

**Dependencies.** None. Independent of `F4`/`F5` (disjoint change within shared components,
scoped via the opt-in prop above) and of every other track.

**Assumed starting state** = **Baseline**. Verify:
- `frontend/src/components/chore/ChoreSearchInput.tsx` renders a text input with no clear
  button.
- `frontend/src/components/form/FormField.tsx` renders a plain labeled input with no clear
  button; `ChoreForm.tsx` uses it for `name` (and `details`, until `F4` removes it).
- `ChoreForm.tsx`'s raw `room` `<input type="text" list="room-options">` has no clear button.

**Expected end state** (repo-checkable):
- Typing into the search bar, or the Add/Edit form's Name or Room fields, reveals a "✕"
  once the field is non-empty; clicking it clears that field's value and the "✕"
  disappears again.
- Clearing the search bar restores the room-filtered (unsearched) chore list, unchanged from
  today's behavior when manually deleting the text.
- Clearing Name/Room in the form does not submit or close the form — it only clears that
  field's local state.
- `FormField`'s new clear-affordance is **opt-in** (e.g. a `clearable` prop) — the Details
  field usage in `ChoreForm.tsx` does **not** pass it, so Details is unaffected.
- No regression to existing search/room-filter/add/edit behavior or tests.

**Test-suite deltas.** Component tests for each of the three call sites: "✕" hidden when
empty, visible when non-empty, clears on click. App-level test that clearing the search bar
still restores the room-filtered list (existing `F9-L` behavior, unchanged).

**Open risks / decisions.** (a) Exact "✕" placement/icon — likely `lucide-react`'s `X`,
absolutely positioned inside the input's padding, consistent with the app's existing
icon-affordance style. (b) Confirm the opt-in prop approach on `FormField` doesn't leak into
any other current or planned `FormField` usage (checked: only `name` and `details` currently
use `FormField`; `dateLastCompleted`/`duration`/`frequency` also use it but are excluded per
the resolved scope above — the prop must default to *off* for those too, not just Details).

**Session loop.** Run the Per-Feature Session Contract on branch `feature/clear-input-buttons`.

---

## F4 — Remove *Details* and *Long-term task* fields  ·  Effort M  ·  (260707 item 4)

**Goal.** Delete the *Details* field and the *Long-term task* toggle from the chore form and
propagate the removal through the shared type, the API layer (both create and the `PUT`
update path), backend data access, and the SQLite schema/seed — including a migration of the
already-populated `data.db` on the live Pi.

**Rank rationale.** No longer gated by ordering relative to the room field — `F3-L` (room
datalist) already shipped, so this can run anytime; the "run after room datalist"
convention from the prior reconcile is now moot (satisfied by history, not by scheduling).

**Effort: M.** Unchanged from the prior reconcile's estimate: spans type → API (`POST` and
`PUT`) → backend (`createChore` and `updateChore`) → DB → shared `ChoreForm` → tests, plus
the SQLite migration of an already-populated `data.db` (local + Pi).

**Dependencies.** None as a blocker; must reconcile against the now-merged `F3-L` datalist
on the shared form (leave it untouched).

**Assumed starting state** = **Baseline**. Verify:
- `types/SharedTypes.d.ts` declares `details?` and `longTermTask?` on `Chore`.
- `backend/src/db.ts` `CREATE TABLE` includes `details` and `long_term_task`; `SEED_DATA` rows carry both.
- `backend/src/chores.ts` maps `details`/`longTermTask` in both `createChore` and `updateChore`.
- `app.ts` has both `POST` and `PUT /api/chores/:id`, both accepting `details`/`longTermTask`.
- The shared `ChoreForm` renders a Details `FormField` and a `longTermTask` checkbox; its
  Room field is now the `<datalist>` input (`F3-L`) — **do not disturb it.**
- `grep -rn "longTermTask\|long_term_task" backend frontend types` returns matches (verified true as of this reconcile).

**Expected end state** (repo-checkable):
- `grep -rn "longTermTask\|long_term_task" backend frontend types` returns **no matches**; `details` likewise removed from `Chore`, `db.ts` schema+seed, `chores.ts` (both functions), both `POST`/`PUT` handling. `urgency` retained.
- The shared `ChoreForm` no longer renders a Details field or long-term checkbox; **the F3-L room datalist and all F2-L/F5-L/F6-L/F10-L/SSE/F9-L behavior are preserved.**
- `db.ts` contains an idempotent migration dropping `details`/`long_term_task` from an existing `chores` table (guarded by `pragma table_info('chores')`), plus the cleaned `CREATE TABLE`/seed.
- Backend + frontend Vitest suites pass; `e2e/smoke.spec.ts` still passes.

**Test-suite deltas.** Update `chores.test.ts`/`routes.test.ts` (drop long-term/details from
create and update cases); update shared-form tests and `fixtures/chore.ts`; add a migration
idempotency test.

**Open risks / decisions.** (a) Confirm `sqlite_version()` ≥ 3.35 for `DROP COLUMN`; else
table-rebuild migration. (b) Decision: fully delete `details`. (c) Migration runs on the
Pi's live `data.db` on next boot — verify unsandboxed on the Pi (LAN unreachable from
sandbox). (d) Confirm the `PUT`/`updateChore` path is fully de-referenced.

**Session loop.** Run the Per-Feature Session Contract on branch `feature/remove-details-longterm`.

---

## F5 — Translucent / blur *Add Task* button deck  ·  Effort S  ·  (260707 item 5)

**Goal.** Bottom *Add Task* deck uses a transparent, blurred background so the chore list is
faintly visible beneath it; the button stays locked at the bottom and opaque while the list
scrolls beneath.

**Rank rationale.** Unchanged from prior reconcile — fully independent, purely visual, lowest
risk.

**Effort: S.** Focused layout/CSS change to the footer deck + button; verify scroll behavior
beneath the blur on mobile viewports.

**Dependencies.** None.

**Assumed starting state** = **Baseline**. Verify:
- `App.tsx` footer deck is `<div className="flex-shrink-0 py-4 flex justify-center border-t border-gray-700">` wrapping `AddChoreButton` (still opaque — verified, `App.tsx:271`).
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
existing plan (`plans/feature/rotate-screen-button/rotate-screen-button.md`) assuming this
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
> `plans/feature/rotate-screen-button/rotate-screen-button.md` carries its own
> supersession banner listing exactly which of its host-side decisions are harvested
> (connector discovery, transform↔matrix table, sed-anchored persistence, injection
> guard, portrait-only toggle default, user-service Wayland env). The section is retained
> as history only.

**Goal.** In-app rotate control (housed in the `F3` panel) flipping the Pi kiosk's display +
touch orientation between the two portrait orientations (`90 ↔ 270`) without host SSH.

**Rank rationale.** Unchanged — the one functional control the panel ships with; most
involved remaining feature, with an existing detailed plan.

**Effort: L.** Per `plans/feature/rotate-screen-button/rotate-screen-button.md`: React button
→ new Express endpoint → backend writes `rotation.json` into an rmilarachi-owned bind-mounted
host dir → a host-side systemd user service watches the file and applies rotation live
(`wlr-randr`) + persistently (kanshi + labwc `calibrationMatrix`). Builds on the
version-controlled Pi rotation config from #19.

**Dependencies.** `F3` (the panel houses it) + the Pi deploy stack + merged #19 config.
LAN/Pi verification must run unsandboxed.

**Assumed starting state** = **Baseline** + `F3` panel present + the Pi deployment (#19's
kanshi/labwc config under version control). Detailed assumed-start/decisions live in
`plans/feature/rotate-screen-button/rotate-screen-button.md` — read that plan; do not
re-derive it. **That plan (unchanged by this reconcile) contains no F-number self-reference
at all — it was never called "F17" internally, so there's nothing stale to reinterpret inside
it. It's simply this section, `F13`, under the current scheme.**

**Expected end state** (repo-checkable **+ deploy-doc-anchored**):
- A rotate control in the `F3` panel toggles portrait `90 ↔ 270`; landscape unreachable from the button.
- New Express endpoint + `rotation.json` write path (app code, testable); host-side watcher/bind-mount/systemd unit captured as deploy docs under `plans/feature/rotate-screen-button/`.
- Display and touch stay in sync after rotation.

**Test-suite deltas.** Backend test for the endpoint + `rotation.json` write. Host-side
behavior verified manually on the Pi (unsandboxed).

**Open risks / decisions.** Use the existing plan's decisions verbatim (bind-mount required
for the non-root user service; portrait-only toggle; host-bridge file-watch mechanism).
**Do not re-plan from scratch** — refine the existing plan.

**Session loop.** Run the Per-Feature Session Contract on branch `feature/rotate-screen-button`
(refine the existing plan; the `plans/feature/rotate-screen-button/` dir already exists).

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

## Chain integrity (remaining work, current numbering incl. `F14`/`F15`)

```
CHORE-LIST TRACK (disjoint surfaces; soft order — F14 before F4 before F5, per 2026-07-08 pref)
  Baseline ─★F14★ (clear-✕ on free-text inputs) ─(soft: precedes)→ F4 (remove Details/Long-term)
  Baseline ─F5 (blur Add-Task deck)

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
  sequencing now. What remains here: the chore-list track's one **soft** ordering
  preference (`F14` before `F4`, user choice — see `F14`'s Rank rationale), and two
  **external** gates (`F15` on pi-kiosk Phase 2 parity; `F11`/`F12` on Phase 4's
  `kiosk/v1` contract, with `F12` also following `F11`). `F6` is fully parallel.
- **Focus path:** `F14` — zero prerequisites, smallest estimate, explicitly prioritized by
  the user (2026-07-08) ahead of `F4`/`F5`. The kiosk-extraction features cannot start
  until their external gates open, regardless of local appetite.
- **Cross-feature couplings to honor:**
  - **F1 ↔ F2 — shipped and resolved.** `ScreenBlankOverlay` (`z-[100]`) always wins over
    `TouchLockOverlay` (`z-[90]`); the pi-kiosk port must preserve this precedence, and
    `F15` removes both sides of it here at once (never one overlay without the other).
  - **F1 → F9 — retired.** `F9` migrated to pi-kiosk, where the schedule lives in agent
    config; `F1` no longer needs to expose configurable state (the hardcoded 21:00/06:00
    constants leave with `F15`).
  - **F14 ↔ F4:** `F14` runs first per user choice, so its `FormField` clear-affordance
    change must be an opt-in prop (not default-on) to avoid transiently touching the Details
    field that `F4` later removes. See `F14`'s Rank rationale.
  - **F4 ↔ F3-L (already shipped):** `F4` must edit the shared `ChoreForm` without
    disturbing the now-merged Room `<datalist>`.
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
  - From **F4**: no `details`/`longTermTask`/`long_term_task` anywhere (incl. `PUT`/`updateChore`); idempotent column-drop migration in `db.ts`.
  - From **F5**: translucent/blurred Add-Task deck, opaque button.
  - From **F14**: single-click "✕" clear affordance on search/Name/Room, opt-in per-field on `FormField`.
  - From **F15**: the app is embeddable (no frame-blocking headers — documented in
    `nginx.conf` + README) and contains no kiosk/screen code; it works identically
    standalone at `IP:port` and inside the pi-kiosk shell.
  - From **F11**: bounded undo cache; undo emits on the SSE bus. From **F12**: redo pairs
    with F11's cache.
  - From **F6**: a documented LAN name-alias to the app; IP:port still works.
  - **Already holding (legacy, unchanged):** delete-confirm, `PUT`/edit, swipe infra
    (now edit-left/delete-right + 25% reveal), shorter grid bar, SSE re-pull gate, Room
    `<datalist>`, persistent name-search filter.

> If any session's cold survey finds the repo does **not** match its assumed start, **stop
> and reconcile** before planning. The repository is the single source of truth across
> sessions; this file records the *intended* order and must be updated in-PR whenever the
> actual order diverges.
