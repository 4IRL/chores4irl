# META-PLAN — chores4irl future-feature rollout

> **What this file is.** An orchestration manifest, not a script. It sequences the
> features in `plans/ledger/260707_feature_ledger.md` and defines, for each one,
> a *self-contained* per-feature session that a fresh agent (with no memory of prior
> sessions) can run end-to-end using **only this file and the repository**. This file
> is never run top-to-bottom. It is the index; each feature is a separate session.
>
> **Source list lineage.** `plans/ledger/260707_feature_ledger.md` is the **current**
> source of truth for the backlog. Its predecessors are `260630` → `260627` → `260628`
> (deleted, folded into 260630) → the earlier `260625`. When any older list disagrees
> with **260707**, 260707 wins.
>
> **⚠ F-ID renumbering (2026-07-07 reconcile).** The 260707 ledger introduces **its own
> `F#` labels** — six clean, sequential top-level items (`F1`–`F6`), plus a settings-panel
> sub-section whose seven control bullets are unnumbered. Per explicit instruction for this
> reconcile, **those labels are now authoritative** — they supersede the old META-PLAN's
> F1–F17 audit trail for every *remaining/new* feature:
> - **Completed features keep their old (260630-era) `F#`** as a pure historical record —
>   tagged with an `-L` (legacy) suffix below to prevent collision, since several legacy
>   numbers are now reused for unrelated new features (e.g. legacy `F4-L` = confirm-delete,
>   but current `F4` = remove Details/Long-term fields).
> - **Every remaining/new feature uses the bare `F#` from the 260707 ledger's six top-level
>   items**, or, for the settings-panel's seven unnumbered sub-controls, the next integers
>   continuing that same sequence: `F7`–`F13`, in the order they're listed in the ledger.
> - A full **Legacy → Current ID map** is given just below the status ledger.
> - **This renumbering also means other `plans/` files that still cite old F-numbers
>   (`F17` for rotate, `F8` for the URL alias, etc.) are now stale.** `plans/PUSH-REVIEW-FINDINGS.md`,
>   `plans/WORKTREE-PARALLELIZE-PROMPT.md`, and `plans/completed/docker-raspberry-pi/docker-raspberry-pi.md`
>   each got a short note added pointing back here — see their own files; not reproduced here.
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

**Three more features shipped since the last reconcile (260630 basis).** All three were
in the previous "frontend chore-list track" and are now fully merged to `main`, and —
consistent with the 260630→260707 diff pattern — all three were correctly **dropped from
the 260707 ledger** rather than left as stale open checkboxes:

- **#23 — F10-L: swap swipe directions + 25% action-reveal** (`4b6028f`). Swipe-left now
  edits, swipe-right deletes; progressive colour reveal fading in toward the 25% threshold;
  spring-back below threshold. **This was the last outstanding swipe-infra change** — the
  F5-L swipe contract is now fully superseded by this direction mapping.
- **#24 — F3-L: Room field becomes a type-as-you-search `<datalist>`** (`a585d8f`). Native
  `<datalist>` sourced from `uniqueRooms`, threaded through `ChoreFormModal` into the shared
  `ChoreForm`, on both Add and Edit.
- **#25 — F9-L: persistent chore-name search filter** (`8144da4`). **This was the previous
  reconcile's ★FOCUS feature — it is now done.** A `Search`-icon input pinned above the
  scroll region, view-only substring filter composed with the room filter, survives SSE
  re-pulls.

**The primary focus has moved.** With F9-L shipped, the user has supplied a fresh 260707
ledger with a **new primary focus, current-numbering `F1`** — an auto screen-blank/wake
schedule (9pm–6am local time, tap-to-wake, 5-minute re-blank). It has no prerequisites; see
*Shortest path to the focus feature* below.

**Two net-new features appear in 260707** that weren't in any prior list: current `F1`
(auto screen-blank, above) and current `F2` — a cross-device **double-tap accidental-touch
lock** with a padlock-icon overlay animation. Neither has any code on `main` yet.
`F2` is the most architecturally invasive item in the whole backlog (see its section) and is
flagged for careful scoping at its own planning time, not decided here.

**Branch hygiene — done.** Verified against `git log`/`git branch -a`:

- `feature/chore-search-filter`, `feature/room-typeahead`, `feature/swipe-direction-swap`
  were **fully superseded** — every commit on each branch was an ancestor of `main`'s
  squash-merge commits (`8144da4`/`a585d8f`/`4b6028f`). **Deleted 2026-07-07** (local
  `git branch -D`; the remote refs were already gone — GitHub auto-deletes on squash-merge
  in this repo, confirmed via `gh api ... DELETE` returning 422 "Reference does not exist";
  stale local remote-tracking refs dropped via `git update-ref -d`).
- `origin/claude/validate-feature-independence-et7uyy` (remote-only, one commit,
  `2b7f706`, based on pre-#23/#24/#25 `main`) provisioned parallel worktrees to validate
  F9-L/F3-L/F10-L's mutual independence. Since all three shipped **individually** (not via
  that worktree flow) and its premise is now moot, this branch was **also already gone
  remotely — deleted 2026-07-07.**
- `chore/compact-plans-260630` (local + remote) — its substantial content shipped via #22
  (`7f0edb2`), but the branch had two more unpushed commits on top. **Verified byte-identical**
  against what's already on `main` (the small `.vscode/`-gitignore + prompt-wording fix had
  been re-applied to `main` through a different, non-ancestor commit path) — nothing to
  cherry-pick. **Deleted 2026-07-07**, local + remote.
- `deploy/pi-rotation-autostart-script` (local only, no PR ever opened) proposed an
  alternate, kanshi-free Pi-rotation approach. **User confirmed 2026-07-07 this was an
  abandoned experiment** — the shipped/live approach is #19's kanshi config, which `F13`
  (rotate-screen-button, below) builds on. **Deleted 2026-07-07.**
- `plans/feature/swipe-direction-swap/` (plan dir; only had `reviews/` + `tmp/`, no root
  plan file) was left over from the now-shipped F10-L. **Archived 2026-07-07** into
  `plans/completed/swipe-direction-swap/` with a freeze header (per the existing
  `plans/completed/swipe-actions/`-style convention); its two open push-review findings were
  harvested into `plans/PUSH-REVIEW-FINDINGS.md`.
- `plans/WORKTREE-PARALLELIZE-PROMPT.md` is now historical for its original worked example
  (parallelizing F9-L/F3-L/F10-L, all shipped) — the template itself is still reusable, and
  got a short stale-numbering note (see the renumbering callout above).

No plan directories ever existed for F9-L or F3-L under `plans/feature/` — both shipped
without leaving plan artifacts behind. Nothing to reconcile there.

**Already-resolved cleanup (carried forward, unchanged).** `feature/progress-bar-decay` and
all pre-260630 merged branches (`feature/confirm-delete`, `feature/edit-task`,
`feature/swipe-actions`, `feature/bar-redesign`, `deploy/docker-raspberry-pi`,
`deploy/pi-display-configs`, `chore/plans-housekeeping`,
`claude/mobile-pi-device-sync-is0teg`, `claude/dependabot-vulnerabilities-kk09n2`) remain
pruned. Recorded only so a cold survey doesn't resurrect them.

### Remaining work — four tracks (current 260707 numbering)

```
Chore-list track (small; disjoint surfaces, soft order):
    F4 (remove Details/Long-term fields, M) ── F5 (blur Add-Task deck, S)
    (F3-L room datalist and F9-L search filter — this track's other members — are now done)

Kiosk power & input-safety track (NEW track; contains the focus feature):
    F1 (auto screen-blank 9pm–6am, M ★FOCUS)     ── independent, full-viewport overlay
    F2 (double-tap accidental-touch lock, L)      ── independent, full-viewport overlay
    (F1 and F2 are both full-screen overlays gating taps — coordinate designs once both
     exist; see "Cross-feature couplings" below. Neither blocks the other.)

Device-control panel track (F3 gates the rest):
    F3 (settings panel container, M) ─→ { F13 rotate (L, plan exists) · F11 undo · F12 redo ·
                                           F7 brightness · F8 screen-blank toggle ·
                                           F9 auto-blank settings-UI (needs F1 too) ·
                                           F10 restart }
                                          (F7/F8/F10/F11/F12 ship as inert placeholders first)

Infra track:
    F6 (local URL alias, M–L · research-first) ── independent; different surface entirely
```

- **Chore-list track:** only `F4` and `F5` remain (the other two members, room datalist and
  chore search, shipped). Independent of each other.
- **Kiosk power & input-safety track:** both `F1` and `F2` are new, full-viewport overlay
  behaviors layered over the whole app — thematically distinct from simple list-surface
  edits, so broken out as their own track. `F1` is the current **focus**.
- **Device-control panel track:** unchanged shape from the prior reconcile, renumbered.
  `F3` (the panel) still gates everything else in the track. One new member, `F9`
  (a settings-panel control to configure `F1`'s schedule), depends on **both** `F3` and `F1`.
- **Infra track:** `F6` (renumbered from legacy `F8-L`) is unchanged — LAN name resolution,
  shares no files with app code.

### Shortest path to the focus feature (current `F1` — auto screen-blank 9pm–6am)

**F1 has no prerequisites.** It is implementable **entirely in the frontend**: a
full-viewport overlay component, wall-clock scheduling to the next 9pm/6am transition
(the codebase already has a directly-reusable pattern — `useMidnightClock.ts` schedules a
single `setTimeout` to the next `startOfDay` boundary via `date-fns`), a tap-to-wake
listener, and a 5-minute inactivity re-blank timer. No backend/schema change, no host-bridge
dependency — the ledger's parenthetical ("consider enabling 'auto screen-blank-disable'
already configured on the Pi") just means the **host's own** DPMS/idle-blank must stay off so
this app-level overlay is the sole driver; nothing in `deploy/pi/` currently configures
host-side screen blanking (verified — no `dpms`/`screen-blank`/`xset`/idle-inhibit config
exists there today), so there is nothing to disable. The shortest path is therefore **a
single hop — implement F1 directly as the next session.**

- **Do not** route `F4`/`F5` (chore-list track) or `F3`'s device-control track ahead of it:
  disjoint surfaces, unlocks nothing F1 needs.
- **Do not** pull `F2` (double-tap lock) in ahead of `F1` — no dependency either direction,
  and `F2` is materially larger/riskier; sequencing it first would be pure churn against the
  focus goal.
- **Must use real wall-clock time** (`new Date()` / `realToday`), **not** the existing
  day-simulation's `simulatedDate` — screen power state must track the physical clock, not a
  user-previewed future day. This is the one integration note F1 must honor against the
  existing `App.tsx` simulation state.
- **Must swallow the waking tap** — the overlay needs to fully capture the first
  post-blank interaction (as "wake") rather than letting it fall through to whatever chore
  bar or button happens to be underneath.

---

## Summary table

### Completed (merged to `main` — history; effort recorded as built; legacy `F#-L` IDs, never reused)

| Legacy ID | Feature | Effort | PR | Merge SHA |
|---|---|---|---|---|
| F4-L | Confirm intent before delete | **S** | [#14](https://github.com/4IRL/chores4irl/pull/14) | `e30c2b2` |
| F2-L | Edit Task functionality | **L** | [#15](https://github.com/4IRL/chores4irl/pull/15) | `06e0b00` |
| F5-L | Swipe left=delete / right=edit *(superseded by F10-L's direction swap, below)* | **XL** | [#17](https://github.com/4IRL/chores4irl/pull/17) | `0d05453` |
| F6-L | Reduce bar height / spread details | **M** | [#18](https://github.com/4IRL/chores4irl/pull/18) | `3a30a42` |
| F9-L | Persistent chore-name search filter *(was prior reconcile's ★FOCUS)* | **M** | [#25](https://github.com/4IRL/chores4irl/pull/25) | `8144da4` |
| F3-L | Type-as-you-search Room dropdown | **S** | [#24](https://github.com/4IRL/chores4irl/pull/24) | `a585d8f` |
| F10-L | Swap swipe directions + 25% action-reveal | **M** | [#23](https://github.com/4IRL/chores4irl/pull/23) | `4b6028f` |

### Merged since original baseline (non-F — infra/parallel, no backlog F-ID)

| Feature | Effort | PR | Merge SHA | Notes |
|---|---|---|---|---|
| Multi-device sync via SSE | **M** | [#21](https://github.com/4IRL/chores4irl/pull/21) | `42040cc` | New `GET /api/events`; `useChoreEvents` + `reconcileChores` in `App.tsx`. Part of the baseline. |
| Pi display rotation + touch calibration | **M** | [#19](https://github.com/4IRL/chores4irl/pull/19) | `c4153a9` | Host-side rotation config; current `F13` (rotate button) builds on it. |
| plans/ archive housekeeping | **S** | [#20](https://github.com/4IRL/chores4irl/pull/20) | `b823ad4` | Docs/process only. |
| plans/ compact sweep #2 | **S** | [#22](https://github.com/4IRL/chores4irl/pull/22) | `7f0edb2` | Docs/process only; pruned the 260630-era merged branches. |

### Remaining (current 260707 numbering; reassessed against current `main`)

| Order | Feature (260707 ledger item) | Effort | Depends on | Track |
|---|---|---|---|---|
| ★ | **F1** — Auto screen-blank 9pm–6am, tap-to-wake, 5-min re-blank **[FOCUS]** | **M** | — | Kiosk power & safety |
| 1 | **F2** — Double-tap accidental-touch lock + padlock overlay | **L** *(scope TBD at planning — see risks)* | — *(SSE bus if cross-device sync is chosen)* | Kiosk power & safety |
| 2 | **F4** — Remove *Details* & *Long-term task* fields | **M** | none blocking *(F3-L already merged)* | Chore-list |
| 3 | **F5** — Translucent/blur *Add Task* deck | **S** | — | Chore-list |
| 4 | **F3** — Settings / device-control panel container | **M** | — *(gates F7–F13)* | Device-control panel |
| 5 | **F13** — Rotate screen button (functional, host-bridge) | **L** | **F3**; Pi rotation config (#19, merged) | Device-control panel |
| 6 | **F11** — Undo (placeholder→functional) | **S→M–L** | **F3** | Device-control panel |
| 7 | **F12** — Redo (placeholder→functional) | **S→M** | **F3**, F11 | Device-control panel |
| 8 | **F7** — Brightness control (placeholder→functional) | **S→M** | **F3**; host-bridge | Device-control panel |
| 9 | **F8** — Screen blank/wake manual toggle (placeholder→functional) | **S→M** | **F3**; host-bridge | Device-control panel |
| 10 | **F9** — Auto screen-blank/wake settings-UI (configure F1's schedule) | **S** | **F3**, **F1** | Device-control panel |
| 11 | **F10** — Restart (placeholder→functional) | **S→M** | **F3**; host-bridge + confirm | Device-control panel |
| — | **F6** — Local URL alias instead of IP:port | **M–L** *(research spike)* | deployment stack (Pi/Docker); independent | Infra (parallel) |

**Effort tally (remaining).** Chore-list track: F4 (M) + F5 (S) ≈ **3 pts**. Kiosk
power/safety track: F1 (M) + F2 (L) ≈ **5 pts** — the **focus path is just F1 (M, ≈2 pts)**.
Device-control track (placeholder ship): F3 (M=2) + F13 (L=3) + F9 (S=1) + 5×placeholder
(F7/F8/F10/F11/F12, S=1 each=5) ≈ **11 pts**, growing as each placeholder is connected
(each +M). Infra: F6 ≈ **2–3 pts**. (S=1 / M=2 / L=3 / XL=5.)

---

## Legacy → current ID map

> Only **pending** legacy IDs are mapped here — the seven **completed** legacy features
> (`F4-L`, `F2-L`, `F5-L`, `F6-L`, `F9-L`, `F3-L`, `F10-L`) don't map onto any current ID;
> they're retired history, fully covered by the Completed table above.

| Legacy (260630 META-PLAN) | Current (260707 ledger) |
|---|---|
| F1-L remove Details/Long-term | → **F4** |
| F7-L blur Add-Task deck | → **F5** |
| F8-L local URL alias | → **F6** |
| F11-L settings panel container | → **F3** |
| F12-L brightness | → **F7** |
| F13-L screen-blank/wake toggle | → **F8** |
| F14-L restart | → **F10** |
| F15-L undo | → **F11** |
| F16-L redo | → **F12** |
| F17-L rotate | → **F13** |
| *(none — new)* | **F1** — auto screen-blank 9pm–6am |
| *(none — new)* | **F2** — double-tap accidental-touch lock |
| *(none — new)* | **F9** — auto-blank settings-UI sub-control |

---

## Status ledger

> **Authority note.** Git is the source of truth: a feature is *actually* done only when
> its PR is **merged to main** and its "Expected end state" facts verify against the
> merged tree. **This table is a human-readable mirror, not the authority** — on any
> conflict, the verified repo state wins. Each session updates its own row as part of its
> final commit. Statuses: `pending` → `in-progress` → `in-review` (PR open) → `merged`.
> IDs below are the **current (260707)** numbering; see the Legacy → current map above for
> history.

| Feature | Status | Branch | PR | Merge SHA |
|---|---|---|---|---|
| F4-L — confirm-delete | **merged** | *(pruned)* | [#14](https://github.com/4IRL/chores4irl/pull/14) | `e30c2b2` |
| F2-L — edit task | **merged** | *(pruned)* | [#15](https://github.com/4IRL/chores4irl/pull/15) | `06e0b00` |
| F5-L — swipe actions | **merged** | *(pruned)* | [#17](https://github.com/4IRL/chores4irl/pull/17) | `0d05453` |
| F6-L — bar redesign | **merged** | *(pruned)* | [#18](https://github.com/4IRL/chores4irl/pull/18) | `3a30a42` |
| F10-L — swap swipe directions | **merged** | *(pruned 2026-07-07)* | [#23](https://github.com/4IRL/chores4irl/pull/23) | `4b6028f` |
| F3-L — room typeahead | **merged** | *(pruned 2026-07-07)* | [#24](https://github.com/4IRL/chores4irl/pull/24) | `a585d8f` |
| F9-L — chore search filter | **merged** | *(pruned 2026-07-07)* | [#25](https://github.com/4IRL/chores4irl/pull/25) | `8144da4` |
| *(non-F)* SSE multi-device sync | **merged** | *(pruned)* | [#21](https://github.com/4IRL/chores4irl/pull/21) | `42040cc` |
| *(non-F)* Pi rotation/touch config | **merged** | *(pruned)* | [#19](https://github.com/4IRL/chores4irl/pull/19) | `c4153a9` |
| *(non-F)* plans housekeeping | **merged** | *(pruned)* | [#20](https://github.com/4IRL/chores4irl/pull/20) | `b823ad4` |
| *(non-F)* plans compact sweep #2 | **merged** | *(pruned)* | [#22](https://github.com/4IRL/chores4irl/pull/22) | `7f0edb2` |
| F1 — auto screen-blank | **merged** | *(pruned)* | [#27](https://github.com/4IRL/chores4irl/pull/27) | `a633a2a` |
| **F2 — double-tap accidental-touch lock** ★FOCUS | **in-progress** | `feature/touch-lock` | — | — |
| F4 — remove Details/Long-term | pending | `feature/remove-details-longterm` | — | — |
| F5 — translucent Add-Task deck | pending | `feature/translucent-add-deck` | — | — |
| F3 — device-control panel | pending | `feature/settings-panel` | — | — |
| F13 — rotate screen button | pending | `feature/rotate-screen-button` *(plan exists)* | — | — |
| F11 — undo | pending | `feature/undo` | — | — |
| F12 — redo | pending | `feature/redo` | — | — |
| F7 — brightness control | pending | `feature/brightness-control` | — | — |
| F8 — screen blank/wake manual toggle | pending | `feature/screen-blank-toggle` | — | — |
| F9 — auto-blank settings-UI | pending | `feature/auto-blank-settings-ui` | — | — |
| F10 — restart control | pending | `feature/restart-control` | — | — |
| F6 — local URL alias | pending | `feature/local-url-alias` | — | — |
| ~~progress-bar-decay~~ | **deleted** (superseded; functionality on `main`) | *(branch gone)* | — | — |

**Branch/dir cleanup — all done 2026-07-07:**
1. ~~Delete `feature/chore-search-filter`, `feature/room-typeahead`, `feature/swipe-direction-swap`~~ — done (local + remote; remote refs were already gone).
2. ~~Delete remote-only `claude/validate-feature-independence-et7uyy`~~ — done (already gone remotely).
3. ~~Archive `plans/feature/swipe-direction-swap/` under `plans/completed/`~~ — done (`/compact-plans` sweep): moved to `plans/completed/swipe-direction-swap/` with a freeze header (no original plan body existed to preserve — noted in the frozen file); its two open push-review findings harvested into `plans/PUSH-REVIEW-FINDINGS.md`.
4. ~~Delete `chore/compact-plans-260630`~~ — done, local + remote (verified byte-identical against `main` first — nothing lost).
5. ~~Delete `deploy/pi-rotation-autostart-script`~~ — done (confirmed abandoned experiment by user).

**Ledger update protocol (per session):** unchanged from prior revisions — see the four
numbered steps that were here previously: set `in-progress` on start, `in-review` + PR link
after `git-push`, `merged` + SHA only once actually merged (never self-mark), ledger edits
ride in the feature's own commits/PR.

---

## Baseline: the codebase as it exists today (`main` after F4-L/F2-L/F5-L/F6-L + SSE #21 + Pi-config #19 + F10-L/F3-L/F9-L)

> **This Baseline reflects `main` after all seven legacy-numbered merges above.** It is the
> literal current state and the **assumed starting state for every remaining (current-numbered)
> feature.** Earlier revisions described a pre-#23/#24/#25 baseline — that is now historical.

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
- `App.tsx` — orchestrator: holds `choreData`, `sortedIds`, day-simulation (`simulatedDate`/`isSimulating`, real clock via `realToday`), room filter (`uniqueRooms` derived; `useRoomFilter(choreData, selectedRoom)` → `filteredChores`), **search filter** (new since last reconcile — `searchFilteredChores` derived from `filteredChores`, feeding `orderedChores`), day-simulation handlers, add/edit/delete handlers (F4-L/F2-L/F5-L trio), SSE subscription (`useChoreEvents` + gated `reconcileChores`). Footer deck (`flex-shrink-0 py-4 flex justify-center border-t border-gray-700`, **still opaque** — `F5`'s target — `App.tsx:271`) holds `AddChoreButton`; scroll area directly above is `flex-1 overflow-y-auto min-h-0`. `NavBar` renders room chips **and now the persistent search input** above the list. **There is no settings/device-control panel, no auto screen-blank overlay, and no double-tap lock overlay yet** — `F1`/`F2`/`F3` all target net-new UI surfaces.
  - **SSE sync — unchanged contract:** subscribes via `useChoreEvents(onChange)` (`hooks/useChoreEvents.ts`; `new EventSource('/api/events')` + `visibilitychange→visible` re-fire). Re-pulls are gated by `isRepullGated()` (`isMutatingRef` || `showForm` || `editingId` || `pendingDeleteId`); deferred via `pendingRefreshRef`. **Any new frontend feature holding uncommitted user input in `App.tsx` state must be added to this gate.**
  - **Visible-list pipeline (now three-stage):** `filteredChores = useRoomFilter(choreData, selectedRoom)` → `searchFilteredChores` (substring on `name`, from `F9-L`) → `orderedChores` (maps `sortedIds` over a `Map` of `searchFilteredChores`).
  - **Real-clock precedent for `F1`:** `frontend/src/hooks/useMidnightClock.ts` — a single `setTimeout` to the next `date-fns` `startOfDay` boundary, re-arming on fire. `F1`'s 9pm/6am scheduling should follow this same pattern (two alternating timeouts instead of one daily one), driven by `realToday`, **not** `simulatedDate`.
- `components/chore/ChoreTimerBar.tsx` — **F10-L's current shape**: `useSwipeable` with **swipe-left → `onEdit`**, **swipe-right → `onDelete`** (reversed from the original F5-L mapping), a controlled swipe offset revealing a behind-the-bar action layer (yellow+pencil for edit, red+trash for delete) with a **25%-of-bar-width threshold** and spring-back below it; colour fades in progressively toward the threshold (added in F10-L's third commit). `delta: 50` remains the swipeable trigger threshold (distinct from the 25%-width confirm threshold). Spread-before-explicit-props order, `touch-pan-y`, `isSimulating` guard, `swipingRef` click-suppression all preserved. Bar math from `@utils/choreBarMath` `computeBar(daysSince, frequency)` unchanged (`h-20 sm:h-16` grid layout from F6-L).
- `components/common/ConfirmDialog.tsx` (F4-L) — unchanged; reused by the swipe-delete path and slated for reuse by `F10` (restart confirm).
- `components/form/` — `ChoreFormModal` → **`ChoreForm`** → `FormField`. **Room field is now a `<datalist>` input** (`F3-L`) sourced from `uniqueRooms`, threaded through both Add and Edit. Still renders a Details `FormField` and a Long-term-task checkbox — **`F4`'s target**, unchanged from before.
- **New since last reconcile:** `components/.../ChoreSearchInput` (or equivalent — the `F9-L` search box; `Search` icon, `placeholder="Search for a chore"`), pinned above the scroll region.

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

**Assumptions to revisit at planning time**
1. `better-sqlite3` bundles SQLite ≥ 3.35 (needed by **F4**'s `DROP COLUMN`). Verify at F4 planning, else fall back to a table-rebuild migration. *(Unchanged from prior reconcile — still unverified.)*
2. Tap-to-complete + the simulation pointer-events guard + the SSE re-pull gate are primary; no new feature may regress them. **`F1` and `F2` both add full-viewport overlays that intercept taps — extra care needed here.**
3. `details` is not rendered anywhere in the UI, so `F4`'s removal is display-safe.
4. **`F6`, `F13`, and the host-bridge controls (`F7`/`F8`/`F10`) have end states partly outside the repo** (Pi/LAN/host config). Capture outcomes as deployment docs in the feature's own `plans/feature/<slug>/` dir. The frozen Dockerization plan lives at `plans/completed/docker-raspberry-pi/`.
5. **`F3`–`F13` (device-control track) are kiosk-only** (the wall-mounted Pi); design to degrade gracefully off-kiosk.
6. **`deploy/pi/` currently has no screen-blank/DPMS/idle config** (verified — no `dpms`/`screen-blank`/`xset`/idle-inhibit files exist there). `F1` needs none; if host-side auto-blank is later found enabled, disabling it is a deploy-doc note for `F1`'s session, not a blocker.
7. **`F1` and `F2` both claim the "first tap after an overlay is showing" gesture** (wake vs. unlock) — no conflict today since neither exists, but once both ship, their planning/implementation must agree on precedence if a device is simultaneously blanked *and* locked. Documented as a cross-feature coupling below; not resolved here.

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
Read META-PLAN.md. Run feature <F-id> (current 260707 numbering, e.g. F1) and only that
feature. Follow its Per-Feature Session Contract: cold-survey and verify the repo matches
the Baseline / that feature's "Assumed starting state" (STOP and report if it diverges), set
its Status ledger row to in-progress, then create-plan → review-plan → run-plan (once) →
git-commit → verify "Expected end state" → update the ledger row to in-review with the PR
link → git-push. End the session after the PR is pushed. Do not start any other feature.
```

**Kickoff prompt — focus feature (recommended next session):**
```
Read META-PLAN.md. Run feature F1 (auto screen-blank 9pm-6am) and only F1. It has no
prerequisites — implement it directly. Per its Per-Feature Session Contract: cold-survey
against the Baseline (confirm no screen-blank overlay exists yet and useMidnightClock's
real-wall-clock timeout pattern is available to reuse), then create-plan → review-plan →
run-plan (once) → git-commit → verify "Expected end state" → git-push. End after the PR.
```

**Skill mapping:** create-plan → `/plan-creator`; review-plan → `/plan-reviewer`; run-plan →
`/run-plan` (once, on this feature's plan only); then `/git-commit` and `/git-push`.

**Between sessions — monitoring:** `gh pr list` / `gh pr view <n>`; `gh pr checks <n>`;
`reviews/push-review-<branch>.md` (written by `/git-push` if its review *rejects*);
`git log --oneline origin/main`; the **Status ledger** above (trust git if they disagree).

---

# COMPLETED FEATURES (merged to `main` — recorded for the contracts later features depend on)

> These are **done**, under their **legacy (260630) IDs** — kept for history; do not re-run
> them, and do not reuse these numbers for anything new (the current 260707 ledger reuses
> some of these digits for unrelated features — see the Legacy → current map above).

## F4-L — Require confirmation before deleting a chore  ·  merged (#14, `e30c2b2`)
Delete routes through `ConfirmDialog` (`frontend/src/components/common/ConfirmDialog.tsx`,
portal/backdrop, `confirm-dialog-*` testids). `App` owns the confirm state; optimistic
delete + rollback preserved after confirm. Reused by the swipe-delete path.

## F2-L — Edit Task functionality  ·  merged (#15, `06e0b00`)
**Implemented contract (as built — still targeted by current `F4`):**
- **Shared form:** default export **`ChoreForm`** at `frontend/src/components/form/ChoreForm.tsx`. Props: `{ mode?: 'add' | 'edit'; initialChore?: Chore; onSubmit: (chore: Omit<Chore,'id'>) => void; onCancel: () => void }` (default `mode='add'`). Internal helper `choreToFormState(chore)` does the inverse mapping; post-submit reset gated to add mode. Its only importer is `ChoreFormModal`.
- **Modal:** `ChoreFormModal` accepts `{ mode?, initialChore?, onSubmit, onCancel }` and forwards to `ChoreForm`. The form emits `Omit<Chore,'id'>`; App supplies the id.
- **Backend:** `PUT /api/chores/:id` (full replace, 200 / 400 `Invalid id` / 400 `Missing required fields` / 404 `Chore not found` / 500); `backend/src/chores.ts` exports `updateChore(id, input): ChoreWire | null`; CORS includes `PUT`. **Current `F4` must de-reference `details`/`longTermTask` from both `createChore` and `updateChore`, and both `POST` and `PUT` handlers.**
- **API client:** `choreApi.ts` exports `updateChore(id, chore): Promise<Chore>`.
- **App:** `editingId` state + derived `editingChore`; optimistic update + rollback. Add/edit modals mutually exclusive.

## F5-L — Swipe behaviors (left = delete, right = edit)  ·  merged (#17, `0d05453`)  ·  superseded by F10-L
**Implemented contract (as built, then reversed by F10-L):** `react-swipeable@^7.0.2` via
`useSwipeable`; handlers spread `{...swipeHandlers}` **before** explicit
`data-testid`/`className`/`onClick` (config `delta: 50`, `trackMouse: true`,
`preventScrollOnSwipe: false`). Original mapping (swipe-left → delete, swipe-right → edit)
has been **live-reversed by F10-L** (below) — this entry is kept only for the infra
contract, which F10-L preserved: spread order, `touch-pan-y`, simulation guard,
`swipingRef` post-swipe click suppression, tap-to-complete.

## F6-L — Reduce bar height / spread details  ·  merged (#18, `3a30a42`)
Bar is `h-20 sm:h-16`, `grid grid-cols-3 items-center` (name left / frequency center /
completion right); room removed; `OverdueBadge.tsx` deleted (overdue → bar fill/color +
`sr-only` cue); visible buttons replaced by `sr-only` keyboard/AT fallbacks. Bar
math/urgency in `@utils/choreBarMath` (`computeBar`).

## F10-L — Swap swipe directions + 25% action-reveal  ·  merged (#23, `4b6028f`)
**Implemented contract (as built):** **swipe-left → `onEdit`**, **swipe-right →
`onDelete`** (reversed from F5-L). During an active swipe the bar translates to reveal a
behind-the-bar action layer — yellow background + white-outline pencil for edit-left, red
background + white-outline trash for delete-right — with colour fading in progressively
toward a **25%-of-bar-width** confirm threshold; below threshold the bar spring-backs to
rest on release. F5-L's infra (spread order, `touch-pan-y`, `isSimulating` guard,
`swipingRef` click-suppression, tap-to-complete) is preserved. `e2e/smoke.spec.ts`'s
`swipeBar` helper direction expectations were flipped to match.

## F3-L — Type-as-you-search Room dropdown  ·  merged (#24, `a585d8f`)
**Implemented contract (as built — current `F4` must not disturb this):** Room field is a
native `<input list=...>` + `<datalist>`, sourced from `App.tsx`'s `uniqueRooms`, threaded
through `ChoreFormModal` into the shared `ChoreForm` on **both** Add and Edit. Typing
filters suggestions; the user may still type a brand-new room. No schema change — `room`
remains a free string.

**Known follow-up (confirmed by user, 2026-07-07 — not yet scheduled as its own feature):**
suggestion dropdown does not appear on mobile even after tapping the `<datalist>` arrow.
Native `<datalist>` mobile support is inconsistent across browsers — likely needs either a
mobile-specific affordance or falling back to a custom listbox for touch. Revisit as a small
follow-up fix; not currently assigned an F-ID.

## F9-L — Persistent chore-name search filter  ·  merged (#25, `8144da4`)  ·  was prior ★FOCUS
**Implemented contract (as built):** A persistent search `<input>` (magnifying-glass
`Search` icon, `placeholder="Search for a chore"`) renders above the scroll region,
visible regardless of selected room. Typing filters visible chores by case-insensitive
substring match on `name`, composed with (ANDed against) the existing room filter via a
new `searchFilteredChores` derived stage feeding `orderedChores`. View-only — does not
mutate `choreData`/`sortedIds`; survives SSE re-pulls; clearing restores the room-filtered
list.

**Known follow-up (confirmed by user, 2026-07-07 — not yet scheduled as its own feature):**
no single-click "✕" to clear the search substring — currently requires manually deleting
typed characters. Small addition (a clear button inside/adjacent to the `Search` input,
mirroring the icon-affordance pattern already used elsewhere). Revisit as a small follow-up
fix; not currently assigned an F-ID.

## (non-F) Multi-device sync via SSE  ·  merged (#21, `42040cc`)
**Implemented contract (every `App.tsx` feature inherits this):**
- **Backend:** in-process `EventEmitter`; every successful write (`POST`/`PUT`/`PATCH .../complete`/`DELETE`) emits a change. `GET /api/events` streams a `changed` SSE doorbell. Tests at `backend/src/__tests__/events.test.ts`.
- **Frontend:** `frontend/src/hooks/useChoreEvents.ts` (`EventSource('/api/events')`; ref-held callback; re-fires on `visibilitychange → visible`). `App.tsx` runs `reconcileChores(fetched)` on signal — order-preserving; gated by `isRepullGated()`; deferred via `pendingRefreshRef`.
- **Obligation for later features:** any new write path must emit on the bus; any new `App.tsx` state holding uncommitted/optimistic input must be added to `isRepullGated()`.

---

# REMAINING FEATURES (current 260707 numbering)

> Every remaining feature's **Assumed starting state is the Baseline above**. They map
> onto the ledger's six top-level items (`F1`–`F6`) plus the settings-panel's seven
> unnumbered sub-controls, continued as `F7`–`F13` in ledger order. The **focus feature is
> F1** — its session can run next with no prerequisites.

## F1 — Auto screen-blank 9pm–6am  ·  ★ FOCUS  ·  Effort M  ·  (260707 item 1)

**Goal.** To conserve energy, automatically blank the screen after 9pm and wake it at 6am
local time. During the blanked window, a tap recovers the screen (tap-to-wake), then it
re-blanks if inactive for 5 minutes.

**Rank rationale.** The user's new primary focus, replacing the now-shipped F9-L. Fully
self-contained frontend feature — no dependency on any other remaining feature, no
backend/host change required.

**Effort: M.** Cost drivers: a full-viewport overlay component; wall-clock scheduling to
the next 9pm/6am boundary (reuse the `useMidnightClock.ts` single-`setTimeout`-to-next-
boundary pattern, adapted to two alternating targets); a tap-to-wake listener that fully
captures/swallows the waking tap; a 5-minute inactivity timer that re-arms the blank once
woken inside the window; must derive from **real** wall-clock time (`realToday`), not
`simulatedDate`; tests (Vitest fake timers).

**Dependencies.** None. `deploy/pi/` has no existing screen-blank/DPMS config to reconcile
against (verified).

**Assumed starting state** = **Baseline**. Verify:
- No screen-blank/overlay component exists under `frontend/src/components/`.
- `frontend/src/hooks/useMidnightClock.ts` exists and demonstrates the real-clock
  `setTimeout`-to-boundary pattern to follow.
- `App.tsx` exposes `realToday` distinct from `simulatedDate`/`isSimulating`.
- `deploy/pi/` contains no `dpms`/`screen-blank`/`xset`/idle-inhibit configuration.

**Expected end state** (repo-checkable):
- A full-viewport overlay renders (dark/blank) automatically between 21:00 and 06:00 local
  time, driven by real wall-clock time.
- A tap anywhere while blanked wakes the screen immediately and consumes that tap (it does
  not also trigger whatever is underneath, e.g. tap-to-complete).
- If no further interaction occurs for 5 minutes while inside the 21:00–06:00 window, the
  overlay re-engages.
- Outside the 21:00–06:00 window, the overlay never engages, regardless of inactivity.
- The day-simulation feature (`simulatedDate`/`isSimulating`) is unaffected — screen-blank
  timing tracks the real clock only.
- Existing invariants preserved: tap-to-complete, swipe gestures, SSE re-pull gate, search
  filter, room filter all continue to function outside the blanked window.

**Test-suite deltas.** New component test for the overlay (renders/hides at boundary times
via fake timers; tap-to-wake; 5-min re-blank). App-level test that the overlay uses real
time and ignores `simulatedDate`. No backend test change (no backend involvement).

**Open risks / decisions.** (a) Exact overlay mechanism — a fixed, full-viewport `<div>`
above all other content (z-index) is the simplest; confirm it can capture the wake tap
without a global pointer-event listener workaround. (b) Two-timeout scheduling (9pm, then
6am, then repeat) vs. a single recurring interval — prefer the `useMidnightClock` style
paired `setTimeout`s for consistency with existing code. (c) Interaction with a future `F2`
(double-tap lock) — if a device is later both blanked and locked, precedence between
"tap-to-wake" and "double-tap-to-unlock" must be decided at `F2`'s planning time (not here);
document whatever `F1` ships as the wake gesture so `F2`'s planning can react to it.
(d) Confirm on the physical Pi (unsandboxed) that no host-level DPMS/idle-blank fights the
overlay.

**Session loop.** Run the Per-Feature Session Contract on branch `feature/auto-screen-blank`.

---

## F2 — Double-tap accidental-touch lock  ·  Effort L  ·  scope resolved: local-only  ·  (260707 item 2)

**Goal (ledger-original framing; see Resolved scope below).** Inhibit accidental chore-state
changes: require a double-tap to "arm" interaction after a period of inactivity, **regardless
of which device accesses the app**. Once armed, any subsequent user interacts normally. The
lock re-engages 5 minutes after the last interaction. A lock icon in the top-left
communicates state; an overlay toast animates a padlock opening/closing and minimizing to the
icon location (single tap → padlock appears centered, shrinks to the corner if no follow-up;
a close-enough second tap → padlock opens and immediately minimizes to the corner; 5 minutes
after last interaction → the corner icon's padlock animates centered-and-closed, then
re-minimizes). **As implemented, "regardless of which device" was resolved to local-only /
per-browser-tab — see Open risk (a) and the Expected-end-state bullets below.**

**Rank rationale (ledger-original framing; superseded by the local-only resolution below).**
Entirely new — no equivalent in any prior ledger. At reconcile time this was assessed as the
most architecturally invasive remaining item, since **"no matter which device accesses it"**
was read to imply the lock state must be **shared across all connected devices**, not merely
a per-browser gate. That cross-device reading was explicitly not what got built — see Open
risk (a).

**Effort: L (actual, as implemented; the scope question below is resolved, not TBD).** Cost
drivers actually incurred: (a) a full-viewport intercepting
overlay + a top-left persistent lock icon + padlock open/close/minimize CSS animation
sequence; (b) a global "armed" gate that every existing interactive surface must route
through (tap-to-complete, swipe-edit/delete, `+ Add Task`, room chips, the search input, and
whatever `F3`'s settings panel adds later) without breaking any of their existing tests. Cost
driver (c) anticipated at reconcile time — new backend state plus new SSE/endpoint plumbing
**if cross-device sync had been chosen** — was **not incurred**: see Open risk (a)/(b).

**Dependencies.** None. (The SSE bus, `GET /api/events`, was flagged at reconcile time as the
natural transport had cross-device sync been chosen — moot per the local-only resolution,
see Open risk (b).)

**Assumed starting state** = **Baseline**. Verify:
- No lock/padlock/overlay component exists (`grep -rli "padlock\|touch-lock" frontend/src` — a broad `lock` grep will false-positive on `useMidnightClock`/`unlock`-adjacent words; confirm no true match).
- No global interaction-gating wrapper exists around `App.tsx`'s handlers.

**Expected end state** (repo-checkable):
- A lock icon renders top-left at all times, reflecting current armed/locked state.
- While locked, the first tap anywhere shows a centered padlock overlay that either
  shrinks to the corner (no follow-up) or, on a close-enough second tap, animates open and
  immediately minimizes to the corner (now armed).
- While armed, all existing interactions (tap-to-complete, swipe edit/delete, add task,
  room/search filters) behave exactly as before this feature.
- 5 minutes after the last interaction **on that browser tab**, the lock re-engages: the
  corner icon's padlock animates centered-and-closed, then re-minimizes. (The original
  "(any device)" framing assumed cross-device sync, which was not delivered — see the
  resolved bullet below.)
- **Resolved (2026-07-08): this feature is local-only / per-browser-tab**, not synced across
  devices. The ledger's original "consistent across all connected devices" framing was the
  single biggest open scope question in this section (Open risk (a)) and was explicitly
  decided otherwise: `useTouchLock`'s lock state lives entirely in React state within one
  browser tab, with no backend endpoint, no new SSE event type, and no persisted state.
  Cross-device sync remains a plausible fast-follow but is explicitly out of scope for this
  plan.

**Test-suite deltas.** New component tests for the lock icon + overlay + double-tap
detection + 5-minute re-lock timer. If cross-device: backend test for the new lock-state
endpoint/signal. Regression coverage that every existing gesture still fires once armed.

**Open risks / decisions — resolved during this feature's implementation (2026-07-08):**
(a) **Resolved: local-only, not cross-device.** The ledger's "no matter which device"
framing was explicitly decided otherwise (user decision, 2026-07-08): the lock is a
per-browser-tab `useTouchLock` React hook with no backend state. Cross-device sync is an
explicit out-of-scope fast-follow, not part of this plan.
(b) **Moot**, given (a)'s local-only resolution — there is no cross-device state to sync, so
no transport (a new SSE event type or a dedicated endpoint) was needed.
(c) **Resolved.** `TouchLockOverlay` renders only when `(isLocked || isClosing) && !isBlanked`
— F1's `ScreenBlankOverlay` always wins when both a screen-blank and a touch-lock would
otherwise be simultaneously active, via a lower z-index (`z-[90]` vs. `ScreenBlankOverlay`'s
`z-[100]`).
(d) **Resolved: CSS-only, no animation library.** Tailwind `transition-*`/`duration-*`
utility classes sequenced with `setTimeout`, mirroring `useScreenBlank`/`ChoreTimerBar`'s
existing convention. `lucide-react`'s `LockKeyhole`/`LockKeyholeOpen` icons are used for the
closed/open padlock states.

**Session loop.** Ran the Per-Feature Session Contract on branch `feature/touch-lock`; scope
risk (a) was resolved at the planning session before implementation began, per the contract's
step 3, and the feature has since been implemented and its tests verified green.

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

## F3 — Settings / device-control panel (container)  ·  Effort M  ·  (260707 — gates F7–F13)

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

## F13 — Rotate screen button (functional, host-bridge)  ·  Effort L  ·  (260707 — plan exists)

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

## F7, F8, F9, F10, F11, F12 — Device-control placeholders (connect later)  ·  housed in F3

> Ships as disconnected, optimistic icon placeholders first (via `F3`), then each connects
> as its own feature. Effort is **S as a placeholder** (lands with `F3`) and **M (or M–L for
> undo) when connected**.

- **F7 — Brightness control** *(= legacy `F12-L`)*. Adjust kiosk backlight. **Functional
  effort M** — host-bridge mirroring `F13` (frontend → backend writes a brightness state
  file → host agent applies via backlight sysfs or `ddcutil`). Placeholder icon `Sun`. Pi
  verification unsandboxed. Branch `feature/brightness-control`.
- **F8 — Screen blank/wake manual toggle** *(= legacy `F13-L`)*. Manually blank/wake the
  display on demand, complementing `F1`'s auto schedule. **Functional effort M**
  (host-bridge). Placeholder icon `MonitorOff`. Pi verification unsandboxed. Branch
  `feature/screen-blank-toggle`. **Note the naming collision risk with `F1`/`F9` — this is
  the *manual, on-demand* toggle; `F1` is the *automatic schedule*; `F9` is the settings-UI
  to *configure* F1's schedule. All three are distinct.**
- **F9 — Auto screen-blank/wake settings-UI** *(NEW — no legacy equivalent)*. Lets the user
  set the sleep/wake times that `F1` currently hardcodes at 9pm/6am, from the `F3` panel.
  **Functional effort S** — a time-picker control wired to `F1`'s schedule state (no new
  host-bridge; `F1` is already pure-frontend). **Depends on both `F3` and `F1`** — `F1` must
  expose its schedule as configurable state before this can wire a UI to it. Branch
  `feature/auto-blank-settings-ui`.
- **F10 — Restart** *(= legacy `F14-L`)*. Controlled restart (`docker compose restart`
  and/or Pi host) behind a confirmation dialog (reuse `ConfirmDialog`). **Functional effort
  M** (host-bridge + confirm). Placeholder icon `Power`. Pi verification unsandboxed. Branch
  `feature/restart-control`.
- **F11 — Undo** *(= legacy `F15-L`)*. Recover from accidental touch/completion.
  **Functional effort M–L** (bounded action/undo cache; 1–2 levels deep acceptable). Must
  reconcile with the SSE re-pull (an undo is itself a write that should emit on the bus).
  Placeholder icon `Undo2`. Branch `feature/undo`.
- **F12 — Redo** *(= legacy `F16-L`)*. Re-apply an undone action; pairs with `F11`'s cache.
  **Functional effort M.** Depends on `F3` + `F11`. Placeholder icon `Redo2`. Branch
  `feature/redo`.

**Shared expected-end pattern (per control, when connected):** the placeholder icon in the
`F3` panel gains a working handler; host-bridge controls (`F7`/`F8`/`F10`) write a state file
consumed by a host-side agent, captured as deploy docs/config; existing IP:port/kiosk
behavior never breaks; writes emit on the SSE bus where relevant.

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

## Chain integrity (remaining work, current 260707 numbering)

```
CHORE-LIST TRACK (disjoint surfaces; independent of each other)
  Baseline ─F4 (remove Details/Long-term)
  Baseline ─F5 (blur Add-Task deck)

KIOSK POWER & INPUT-SAFETY TRACK (NEW; ★ = focus)
  Baseline ─★F1★ (auto screen-blank 9pm–6am)
  Baseline ─F2 (double-tap accidental-touch lock — scope decided at its own planning)
  (F1, F2 independent of each other; both are full-viewport overlays — coordinate wake vs.
   unlock precedence once both exist)

DEVICE-CONTROL PANEL TRACK (F3 gates the rest)
  Baseline ─F3 (panel) ─┬→ F13 (rotate, functional · plan exists)
                        ├→ F11 (undo) ─→ F12 (redo)
                        ├→ F7  (brightness)        ┐
                        ├→ F8  (screen-blank toggle)├ host-bridge, placeholder→functional
                        ├→ F10 (restart)           ┘
                        └→ F9  (auto-blank settings-UI) ── also needs F1

INFRA TRACK
  Baseline ─F6 (LAN alias; independent)
```

- **No single hard chain remains.** The device-control track has the one real edge: `F3`
  gates `F7`/`F8`/`F9`/`F10`/`F11`/`F12`/`F13` (housed in the panel; `F12` also follows
  `F11`; `F9` additionally follows `F1`). `F6` is fully parallel. Chore-list and
  kiosk-power tracks are flat/independent internally.
- **Focus path:** `F1` is a single hop from Baseline — implement it next, ahead of
  everything else, with zero prerequisite churn.
- **Cross-feature couplings to honor:**
  - **F1 ↔ F2:** both are full-viewport tap-intercepting overlays. No live conflict until
    both exist; `F2`'s planning session must decide precedence with `F1`'s tap-to-wake.
  - **F1 → F9:** `F9` (settings-UI for the schedule) needs `F1` to expose its 9pm/6am
    times as configurable state, not hardcoded constants — `F1`'s session should keep this
    in mind even though `F9` isn't scheduled next.
  - **F4 ↔ F3-L (already shipped):** `F4` must edit the shared `ChoreForm` without
    disturbing the now-merged Room `<datalist>`.
  - **F3 → F7–F13:** the panel's control-registration shape is the interface; persist it so
    each control session plugs in without re-architecting.
  - **F13 / F7 / F8 / F10** are host-bridges — end states partly outside the repo; capture
    as deploy docs.
  - **F6** shares no files with any of them.
- Cumulative invariants that must hold from each feature onward:
  - From **F1**: a real-wall-clock 9pm–6am blank overlay, tap-to-wake, 5-min re-blank; must not react to `simulatedDate`.
  - From **F4**: no `details`/`longTermTask`/`long_term_task` anywhere (incl. `PUT`/`updateChore`); idempotent column-drop migration in `db.ts`.
  - From **F5**: translucent/blurred Add-Task deck, opaque button.
  - From **F3**: a NavBar gear↔X toggle opening a single-row device-control banner; control-registration shape in place.
  - From **F13**: in-app portrait rotate via host-bridge; display+touch in sync.
  - From **F6**: a documented LAN name-alias to the app; IP:port still works.
  - **Already holding (legacy, unchanged):** delete-confirm, `PUT`/edit, swipe infra
    (now edit-left/delete-right + 25% reveal), shorter grid bar, SSE re-pull gate, Room
    `<datalist>`, persistent name-search filter.

> If any session's cold survey finds the repo does **not** match its assumed start, **stop
> and reconcile** before planning. The repository is the single source of truth across
> sessions; this file records the *intended* order and must be updated in-PR whenever the
> actual order diverges.
