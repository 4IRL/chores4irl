# META-PLAN — chores4irl future-feature rollout

> **What this file is.** An orchestration manifest, not a script. It sequences the
> features in the current ledger (see *Source list lineage* below) and defines, for each one,
> a *self-contained* per-feature session that a fresh agent (with no memory of prior
> sessions) can run end-to-end using **only this file and the repository**. This file
> is never run top-to-bottom. It is the index; each feature is a separate session.
>
> **Source list lineage.** `plans/ledger/260920_feature_ledger.md` is the **current**
> source of truth for the backlog; every older ledger carries a `PREDECESSOR` banner and
> loses on any disagreement. Backlog changes go through the global `/new-feature` skill
> (which appends a new dated ledger and reconciles this file); the reconcile-by-reconcile
> narrative lives in git history (PRs #26, #29, #30), not here.
>
> **F-ID scheme (fixed at the 2026-07-07 reconcile; never renumber).** Current features
> use the bare `F#` labels from the 260707 ledger — `F1`–`F13`, extended by later adds
> (`F14`, `F15`, `F16`, `F17`, `F18`, `F19`, `F20`, `F21`, …) in ledger order. Features completed *before* that reconcile keep their
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

**Current focus: `F21` — add/edit form polish + the UTC-vs-local date-math fix** (★, ungated,
runnable now; `/run-feature F21`, branch `feature/form-polish-date-fix`) — see *Shortest path
to the focus feature* below. *(Set 2026-09-20 at the close of the `features/meta-plan-additions-260920`
capture batch: the user deferred the ★ re-evaluation to the batch's last `/new-feature`, and
`F21` was that add. `F15` — the previous ★, advanced from `F6` earlier the same day — stays
**gated** on external pi-kiosk Phase 2 parity and remains the kiosk-track head; `F11`/`F12`
wait on Phase 4. `/run-feature F15` must still refuse until parity is verified on the Pi.)*
**`F21` (form polish + date-math fix), `F16` (status-bucketed midnight re-sort), `F17`
(status-count strip), `F18` (floating scroll-to-top button), `F19` (lock-time view reset)
and `F20` (permissive touch lock), all added 2026-09-20 via `/new-feature`, are the
features in this repo that are runnable today** — zero prerequisites, chore-list track,
soft-ordered `F21` → `F16` → `F17` → `F18` → `F20` → `F19` (`F21` first because it fixes a
user-reported bug — a chore added with *Last Completed* = today lands a day early — and
retires the off-by-one caveat `F16`/`F17` otherwise inherit; `F16`/`F17` share a status
classifier extracted from `choreBarMath`; `F18`/`F19` share a `ref` on the scroll container;
`F20` reworks the shipped `F2` lock into a *permissive* lock — padlock only on a blocked
complete/edit/delete, everything else usable — and exposes the idle-expiry tick `F19`
consumes; together they hand `F15` a re-sourcing obligation and reshape pi-kiosk's DD-2;
see *Cross-feature couplings*). The capture batch is **closed** — further ideas enter one
at a time via `/new-feature`, each re-evaluating the ★ on its own.

**Shipped through PR #44** — merged work is recorded by git, not re-tabulated here
(`gh pr list --state merged` / `git log --oneline main`). Since #32: #33, #35, #36, #37,
#40, #41, #42 and #44 were docs/skills-only (META-PLAN reconciles and fold-backs, the replacement
of the `plans/*-PROMPT.md` templates by the `/run-feature`, `/worktree`, `/compact-plans`
skills, and a plans sweep); the app-code merges are **#34 — `F14`, the clear-✕ affordance**
(Standing invariant 10), **#38 — `F4`, the removal of the *Details* / *Long-term task* fields
plus the first `db.ts` boot migration** (Standing invariant 11), and **#39 — `F5`, the frosted
sticky *Add Task* deck** (Standing invariant 12); the one deploy-side merge is **#43 — `F6`,
the LAN name `c4i` / `c4i.local`** (no app code; `deploy/pi/set-hostname.sh` + a cloud-init
drop-in + deploy docs — Standing invariant 13), all now folded into the Baseline below. With
`F5` the **chore-list track is complete**; with `F6` the **infra track is complete**. What each merge left behind that still matters
is captured
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

### Remaining work — three tracks (current numbering, incl. `F15`–`F21`)

```
Chore-list track (re-opened 2026-09-20 by F16–F21; no prerequisites — runnable now):
  ★ F21 (add/edit form polish + UTC-vs-local date-math fix; success/error toast, S–M)  [FOCUS — bug fix first; retires the off-by-one F16/F17 inherit]
      ─soft→ F16 (status-bucketed midnight re-sort + red-quota escalation + Urgency weighting, M)
      ─soft→ F17 (status-count strip under the room tabs, S–M)   [both need the shared status classifier]
      ─soft→ F18 (floating scroll-to-top button over the list, S)  [independent; must clear the F5 deck]
      ─soft→ F20 (permissive touch lock: padlock only on blocked complete/edit/delete; indicator = lock/unlock control, M)
                 [reworks shipped F2; drops the lock's inert gate; timer runs while locked → idle tick]
      ─soft→ F19 (lock-time view reset: top / All / search cleared / today, S)  [keyed off F2/F20's lock signal + idle tick; shares F18's container ref]
    (earlier: F14 — clear-✕ on free-text inputs — shipped #34; F4 — remove Details/Long-term — shipped #38;
     F5 — frosted Add-Task deck — shipped #39)

Kiosk extraction track (2026-07-15 — see plans/feature/kiosk-shell-extraction/):
    [external] rehankalu/pi-kiosk Phases 1–4 ──► F15 (adopt kiosk-shell, M) after Phase 2 parity
        (F15 removes the shipped F1 overlay once the shell reproduces it; for the lock it moves only the
         *timer + state + indicator control* to the shell and keeps F20's in-app guard/padlock — kiosk owns
         the timer, app owns behavior-under-lock; DD-2's all-input-blocking shell overlay is retired by F20)
    F3 · F7 · F8 · F9 · F10 · F13 ── SUPERSEDED (migrated to pi-kiosk; no chores4irl session runs them)
    F11 (undo) ─→ F12 (redo) ── remain here, re-scoped onto the kiosk/v1 postMessage
        contract; deferred until pi-kiosk Phase 4 delivers the contract

Infra track (complete):
    (F6 — local URL alias c4i.local / c4i — shipped #43)
```

- **Chore-list track: re-opened by `F16`–`F21`.** `F14` (#34), `F4` (#38) and `F5` (#39) shipped
  in the user's 2026-07-08 order (`F14` → `F4` → `F5`); the shared `ChoreForm` carries
  exactly Name (`clearable`), the Room `<datalist>`, Last Completed, Duration, Frequency and
  the Urgency `<select>`, and the *Add Task* deck is the frosted sticky surface recorded in
  Standing invariant 12. **`F21`** (added 2026-09-20, ★FOCUS) is the track's head and the
  batch's only *bug fix*: a chore added through the form with *Last Completed* = today is
  stored a day early because `ChoreForm.tsx` parses the bare `yyyy-mm-dd` input as UTC
  midnight while every `daysSince` diffs against local midnight (and the edit form shows
  the UTC date back). It fixes both directions at the form boundary with `date-fns`
  `parse`/`format`, defaults *Last Completed* to today and *Room* to the active room tab in
  add mode, and adds the success/error **toast** (a new `Toast.tsx` that also replaces the
  red top-of-page error strip) — the `F2-L` follow-up list of 2026-07-08 promoted to an
  F-ID, minus its #2 (modal auto-close after add), which was verified already on `main`.
  **`F16`** (added 2026-09-20) follows: it
  replaces the pure duration-weighted score in `choreSort.ts` with a status-bucketed,
  quota-filled ordering whose red quota escalates with neglect and with each chore's
  `urgency`. It touches only `choreSort.ts`, its test, a constants entry and the README —
  no form, bar, backend or `App.tsx` change — and depends on nothing. **`F17`** (added
  2026-09-20) adds a thin always-visible segmented strip under the room tabs showing
  done-today / due-soon / overdue counts for the *visible* list, live. Both features
  classify chores with the bar's own thresholds, so whichever runs first extracts a shared
  `classifyStatus` helper from `choreBarMath` and the other reuses it — hence the soft
  `F16` → `F17` order (F16 is the bigger behavioural change and the user's first ask).
  **`F18`** (added 2026-09-20) is a floating bottom-right scroll-to-top button that appears
  only once the list has scrolled; independent of both, smallest, and its only constraint
  is clearance from `F5`'s sticky deck + 4 rem frosted overhang (Standing invariant 12).
  **`F19`** (added 2026-09-20) resets the view when `F2`'s touch lock engages — list
  scrolled to the top instantly, room tab back to *All*, search cleared, day simulator back
  to today — so whoever next walks up to the wall meets the canonical boot view behind the
  padlock. One lock-transition effect in `App.tsx` keyed directly off `isLocked` (the
  user's choice over an app-owned idle timer), plus a `ref` on the scroll container it
  shares with `F18`. It is the first feature to give "locked" an *app-side meaning* beyond
  `inert`, which sets the principle `F15` must honor: **the kiosk owns the inactivity timer;
  the app owns what "locked" means for it** (see `F15`'s Open risks (e)).
  **`F20`** (added 2026-09-20) makes that principle concrete by reworking the shipped `F2`
  lock into a **permissive lock**: the padlock overlay appears *only* when a disallowed
  action is attempted — completing (single tap), edit/delete (swipes; bars don't move) —
  while scrolling, search, room tabs, day simulation and Add Task (incl. submit) stay usable;
  the app root drops its `inert` gate for the lock (blank keeps it). Two unlock paths: the
  blocked tap counts as the first of the existing double-tap, and the top-left indicator
  becomes a single-tap lock/unlock control (manual lock without waiting 5 min). The
  inactivity timer keeps running while locked, exposing the idle tick `F19` consumes. It
  retires pi-kiosk DD-2's "shell overlay blocks all input" shape: the shell will own the
  timer + state + indicator control, the app the guard + padlock (`F15` Open risks (e)/(f)).
- **Kiosk extraction track (replaces the device-control panel track):** the console and
  its hardware controls (`F3`, `F7`, `F8`, `F9`, `F10`, `F13`) migrated to
  `rehankalu/pi-kiosk` — no chores4irl session runs them; the sequencing now lives in the
  design doc's Migration Phases. What stays here: `F15` (adopt kiosk-shell — an ordinary
  chores4irl feature, gated on the **external** pi-kiosk Phase 2, removing the shipped
  `F1` overlay code and the lock's *timer/state/indicator*; Standing invariants 8–9 hold
  until then — and, once `F19`/`F20` have shipped, re-sourcing the lock signal from the
  shell's `kiosk-state { locked }` message and sending `lock-request` back rather than
  deleting the app-side lock semantics outright), and `F11`/`F12`
  (app-data undo/redo, re-scoped onto the `kiosk/v1` contract, gated on the external
  Phase 4).
- **Infra track: complete.** `F6` (#43) renamed the Pi to `c4i`, so the app answers at
  `http://c4i.local/` (mDNS) and `http://c4i/` (router DNS) — Standing invariant 13 and
  the Baseline's *Deployment* paragraph record the mechanism. Its alias is the natural
  `target_url` for pi-kiosk (see `F15`'s Open risks (d)).

### Shortest path to the focus feature (`F21`)

**`F21` is the current ★FOCUS — ungated, runnable now.** Set 2026-09-20 when the
`features/meta-plan-additions-260920` capture batch closed: the ★ was deferred across the
batch and, at its last add, moved off the gated `F15` to the first runnable item. `F21` is
first because it is the batch's one *bug fix* (a chore added with *Last Completed* = today
lands a day early — reported 2026-09-20) plus the small form-polish list that rides the
same files, and because shipping it first retires the "inherited UTC off-by-one" caveat
`F16` and `F17` otherwise carry. Path: `/run-feature F21` on branch
`feature/form-polish-date-fix` — no prerequisites. **Then, in soft order:** `F16`
(`feature/status-bucketed-sort`), `F17` (`feature/status-count-strip`), `F18`
(`feature/scroll-to-top`), `F20` (`feature/permissive-lock`), `F19`
(`feature/lock-view-reset`) — all ungated. **Gated, not ★:** `F15` (kiosk-track head)
cannot start until pi-kiosk Phase 2 parity (blank window, wake-tap swallow, 5-min
re-blank, lock re-arm, double-tap unlock) is verified on the wall Pi and recorded in
`plans/feature/kiosk-shell-adoption/`; `/run-feature F15` must check that gate in its cold
survey and refuse — not proceed on a partial parity. `F11`/`F12` wait on pi-kiosk Phase 4.
Once every ungated chore-list item has shipped and the kiosk gates are still shut, the ★
returns to `F15` (gated) by the usual fold-back. `F6`'s alias is live — pi-kiosk's
`target_url` question now belongs to `F15`'s Open risks (d).

- **Do not** re-open the chore-list track's scope — the *Details* / *Long-term task* fields
  are gone (#38, with the `db.ts` boot migration), the clear-✕ affordance shipped (#34), and
  the frosted deck shipped (#39); Standing invariants 10–12 record all three as
  verified-shipped facts. Follow-up polish on any of them enters via `/new-feature`, not by
  reopening the F-ID.
- **Do not** re-open `F6`'s surface — the Pi is `c4i`; `deploy/pi/set-hostname.sh` is
  idempotent and re-applies/rolls back; `http://192.168.1.214/` still works; the kiosk
  keeps `http://localhost/`. Standing invariant 13 records it; follow-ups (e.g. pinning Avahi
  to `wlan0`, anchoring the `*.sh` gitignore rule) enter via `/new-feature`.
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

### Remaining (current numbering, incl. `F15`–`F21`; reassessed against current `main` at the 2026-09-20 `/new-feature` reconcile — batch closed at `F21`)

| Order | Feature | Effort | Depends on | Track |
|---|---|---|---|---|
| ★ 1 *(runnable now)* | **F21** — Add/edit form polish + date-math fix: parse/format the form date as *local* (fixes "added today → 1 day ago" and the edit form's UTC date), default Last Completed = today and Room = active tab in add mode, success/error toast replacing the red error strip **[FOCUS]** *(added 2026-09-20; promotes the F2-L follow-up list)* | **S–M** | none | Chore-list |
| 2 *(runnable now)* | **F16** — Status-bucketed midnight re-sort: red/orange/green buckets, per-bucket ranking, fold quota with red escalation, Urgency weighting *(added 2026-09-20)* | **M** | none | Chore-list |
| 3 *(runnable now)* | **F17** — Status-count strip under the room tabs: done-today / due-soon / overdue for the visible list, live *(added 2026-09-20)* | **S–M** | none hard; soft after F16 (shared status classifier) | Chore-list |
| 4 *(runnable now)* | **F18** — Floating scroll-to-top button over the list, shown only once scrolled *(added 2026-09-20)* | **S** | none hard; must clear the F5 deck (Standing invariant 12) | Chore-list |
| 5 *(runnable now)* | **F20** — Permissive touch lock: padlock only on a blocked complete/edit/delete; scroll, search, rooms, day-sim, Add Task usable while locked; indicator = single-tap lock/unlock control *(added 2026-09-20; reworks shipped F2)* | **M** | none hard; amends the shipped `F2` contract (Standing invariant 9) | Chore-list |
| 6 *(runnable now)* | **F19** — Lock-time view reset: on lock-engage (and each 5-min idle expiry while locked) scroll to top, room → All, search cleared, day → today *(added 2026-09-20; trigger amended by F20)* | **S** | none hard; keyed off the lock signal + idle tick (Standing invariant 9 / F20); soft after F18 (shared ref) and F20 (tick) | Chore-list |
| 7 *(gated)* | **F15** — Adopt kiosk-shell: remove F1/F2 overlays + embeddability guarantee **[kiosk-track head — gated]** *(added 2026-07-15)* | **M** | **external:** pi-kiosk Phase 2 parity verified on the Pi | Kiosk extraction |
| 8 | **F11** — Undo *(re-scoped 2026-07-15 onto the `kiosk/v1` contract)* | **M–L** | **external:** pi-kiosk Phase 4 (`kiosk/v1` contract) | Kiosk extraction |
| 9 | **F12** — Redo *(re-scoped 2026-07-15)* | **M** | F11 + same external gate | Kiosk extraction |
| ~~—~~ | ~~**F3 · F7 · F8 · F9 · F10 · F13** — device-control console + its controls~~ | — | **superseded 2026-07-15** — migrated to pi-kiosk (shell console / agent controls / settings; `F13`'s plan harvested, see its banner) | *(migrated)* |

**Effort tally (remaining, in this repo).** Chore-list track: F21 (S–M≈1–2) + F16 (M=2) + F17 (S–M≈1–2)
+ F18 (S=1) + F20 (M=2) + F19 (S=1) ≈ **8–10 pts**, ungated. Infra track: **0 pts** (complete). Kiosk extraction track: F15
(M=2, re-check at planning — see below) + F11 (M–L≈2–3) + F12 (M=2) ≈ **6–7 pts**, all gated on external pi-kiosk phases.
Total ≈ **14–17 pts**. (S=1 / M=2 / L=3 / XL=5.) F15/F16/F17/F18/F19/F20/F11/F12 were re-checked
against `main` at #44 for `F21`'s add: nothing landed since their last estimate (same day),
so their scores stand. `F21` is **S–M**: two form-boundary date helpers + two add-mode
defaults in `ChoreForm.tsx`, one new `Toast.tsx`, and an `App.tsx` change that swaps the
error strip for the toast and adds three success calls — no backend, sort or data change;
the TZ-pinned tests are the only non-trivial part. `F15` stays **M** on paper but changes *shape*: after `F20` its lock
half is no longer "delete the overlay" — the in-app guard/padlock stays, and only the
timer, lock state and indicator control move to the shell over a `kiosk/v1` addition
(`kiosk-state { locked }` in, `lock-request { locked }` out) that pi-kiosk schedules for
**Phase 4**, not Phase 2. Its plan must decide whether to split (blank removal at Phase 2 /
lock hand-over at Phase 4) — Open risks (f). `F19` stays **S**; the `F20` amendment adds
one more trigger to the same effect.
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
| F7-L blur Add-Task deck | → **F5** *(shipped #39 — folded into Baseline / Standing invariant 12)* |
| F8-L local URL alias | → **F6** *(shipped #43 — folded into Baseline / Standing invariant 13)* |
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
| *(none — new, added 2026-09-20; bare `F16` is distinct from retired `F16-L` redo)* | **F16** — status-bucketed midnight re-sort with red-quota escalation + Urgency weighting |
| *(none — new, added 2026-09-20; bare `F17` is distinct from retired `F17-L` rotate)* | **F17** — status-count strip under the room tabs (done-today / due-soon / overdue, live, visible list) |
| *(none — new, added 2026-09-20)* | **F18** — floating scroll-to-top button over the list (shown only once scrolled) |
| *(none — new, added 2026-09-20)* | **F19** — lock-time view reset (on lock-engage + each idle expiry while locked: scroll to top, room → All, search cleared, day → today) |
| *(none — new, added 2026-09-20)* | **F20** — permissive touch lock (reworks shipped `F2`: padlock only on a blocked complete/edit/delete; scroll, search, rooms, day-sim, Add Task usable while locked; indicator = lock/unlock control) |
| *(none — new, added 2026-09-20; promotes the `F2-L` follow-up list of 2026-07-08)* | **F21** — add/edit form polish + date-math fix (local parse/format of the form date; Last Completed = today + Room = active tab defaults in add mode; success/error toast replacing the red error strip) |

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
| **F21 — add/edit form polish + date-math fix** ★FOCUS *(added 2026-09-20)* | pending *(ungated — runnable now)* | `feature/form-polish-date-fix` | — |
| F16 — status-bucketed midnight re-sort *(added 2026-09-20)* | pending *(ungated; soft after F21)* | `feature/status-bucketed-sort` | — |
| F17 — status-count strip *(added 2026-09-20)* | pending *(ungated; soft after F16)* | `feature/status-count-strip` | — |
| F18 — scroll-to-top button *(added 2026-09-20)* | pending *(ungated; soft after F17)* | `feature/scroll-to-top` | — |
| F20 — permissive touch lock *(added 2026-09-20; reworks shipped F2)* | pending *(ungated; soft after F18)* | `feature/permissive-lock` | — |
| F19 — lock-time view reset *(added 2026-09-20; trigger amended by F20)* | pending *(ungated; soft after F20)* | `feature/lock-view-reset` | — |
| F15 — adopt kiosk-shell *(added 2026-07-15; kiosk-track head)* | pending *(gated on external pi-kiosk Phase 2 parity)* | `feature/kiosk-shell-adoption` | — |
| F11 — undo *(re-scoped 2026-07-15: `kiosk/v1` contract)* | pending *(gated on external pi-kiosk Phase 4)* | `feature/undo` | — |
| F12 — redo *(re-scoped 2026-07-15)* | pending *(gated on F11 + same external gate)* | `feature/redo` | — |
| F3 · F7 · F8 · F9 · F10 · F13 — device-control console + controls | **superseded** *(2026-07-15 — migrated to pi-kiosk; branches never created)* | — | — |

**Branch/dir cleanup:** outstanding as of the 2026-09-20 `F6` fold-back — three merged
features have not been swept yet. `F4` (#38): its local branch
`feature/remove-details-longterm`, its `/worktree` checkout
`c4i-wt-remove-details-longterm`, and its plan dir `plans/feature/remove-details-longterm/`
(whose `reviews/push-review-feature-remove-details-longterm.md` holds four non-blocking
minors — count-alias naming, a greppable log tag before the migration rethrows, an optional
two-connection `BEGIN IMMEDIATE` test, an optional loop inlining). `F5` (#39): its local
branch `feature/translucent-add-deck`, its `/worktree` checkout
`c4i-wt-translucent-add-deck`, and its plan dir `plans/feature/translucent-add-deck/`
(whose `reviews/push-review-feature-translucent-add-deck.md` Review 2 holds three
non-blocking minors — assert the backing's `inset-x-0`/`bottom-0`, tie the
`-top-16`/`black_4rem`/`scroll-pb-40` numbers together in the test, and an
only-if-re-verified-on-the-Pi `isolate`+`-z-10` alternative to the button's `relative`
wrapper). `F6` (#43): its local branch `feature/local-url-alias` and its plan dir
`plans/feature/local-url-alias/` (whose `reviews/push-review-feature-local-url-alias.md`
carries eight review rounds; the still-open items are optional — redacting the LAN IP/MAC in
the planning docs if the repo goes public, anchoring the unanchored `*.sh` gitignore rule so
future `deploy/pi/*.sh` scripts need no `git add -f`, and fixture cases for the
`hostnamectl`/avahi-inactive/`readlink`-failure branches of `set-hostname.sh`). All of it —
plus harvesting those minors into `plans/PUSH-REVIEW-FINDINGS.md` — awaits the next
`/compact-plans` sweep. Everything older is clean: every earlier merged plan dir is frozen under `plans/completed/`. Sweep
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

## Baseline: the codebase as it exists today (`main` at PR #44, `a045b11` — app code unchanged since PR #43, `1c63e0a`)

> **This Baseline reflects `main` after PR #43 (`1c63e0a`).** It is the literal current
> state and the **assumed starting state for every remaining feature.** (PRs #33, #35, #36,
> #37, #40, #41 and #42 touched only `plans/` docs and `.claude/skills/`; **#43 (`1c63e0a`) —
> `F6`** touched no app code — `deploy/pi/set-hostname.sh`, `deploy/pi/cloud-init/`,
> `deploy/pi/README.md`, root `README.md` and `plans/`; the app-code deltas since #32
> are **#34 (`3533b67`) — `F14`**, all under `frontend/src/`, **#38 (`d728989`) — `F4`**,
> spanning `types/SharedTypes.d.ts`, `backend/src/` (`db.ts`, `chores.ts`, tests),
> `frontend/src/` (`ChoreForm.tsx`, `utils/choreSort.ts`, the deleted dead reference file
> `assets/database.ts`, tests) and `README.md`, and **#39 (`a1705b3`) — `F5`**, confined to
> `frontend/src/App.tsx`, `components/form/AddChoreButton.tsx` and their tests.)
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

**Deployment / LAN name** (`F6`, #43): The Pi's hostname is **`c4i`** (was `MilarachiC4I`
until 2026-09-19), so the app answers at `http://c4i.local/` (Avahi mDNS — already on the
Pi, advertises `<hostname>.local`) and `http://c4i/` (the FiOS router registers each DHCP
client's hostname under its `mynetworksettings.com` zone and pushes that search domain);
`http://192.168.1.214/` still works (DHCP-reserved). The rename is held against cloud-init
by three edits, all made by the idempotent **`deploy/pi/set-hostname.sh <name>`**
(force-tracked past the unanchored `.gitignore:55` `*.sh` rule, mode 100755) in its `[1/4]`→
`[3/4]` order: user-data's `hostname:` rewritten + `manage_etc_hosts:` flipped to `false`
(user-data out-ranks `cloud.cfg.d` for that key); `/etc/hosts` `127.0.1.1` first, then
`hostnamectl`; then the drop-in `deploy/pi/cloud-init/99-c4i-hostname.cfg` →
`/etc/cloud/cloud.cfg.d/` (`preserve_hostname: true`, `manage_etc_hosts: false`). It also
clears Chromium's hostname-keyed profile lock (`~/.config/chromium/SingletonLock →
<hostname>-<pid>`), which otherwise blocks the kiosk after a rename. Nothing in the app is
name-aware (`nginx.conf` `server_name _`, relative `/api` URLs); the kiosk keeps
`http://localhost/`. Caveats: single-label `c4i` needs `c4i/` or `http://c4i` in a browser
the first time; Android < 12 needs the IP; WSL's CLI has no `nss-mdns`; the Pi resolves its
own `c4i.local` to its Docker bridge `172.18.0.1` (Avahi publishes on every interface —
still served by nginx on `0.0.0.0:80`). A redeploy (`deploy.sh` = `git archive HEAD` →
tarball → `docker compose up -d --build`) re-extracts the tracked `deploy/pi/` copies but
never touches the installed system files. Runbook + rollback (`set-hostname.sh MilarachiC4I
&& sudo reboot`): `deploy/pi/README.md` § LAN name; decision record + live verification log:
`plans/feature/local-url-alias/research/lan-name-resolution.md` (or its frozen copy under
`plans/completed/`). **Deployment fact (outside the repo):** as of 2026-09-20 the Pi runs
`main` at `1c63e0a`'s app code (the pre-F4 tree it had been running since 2026-09-19 was
replaced, so the `F4` migration + `PUT` edits are verified live) and its `data.db` is
migrated to 7 columns.

**Domain model** (`Chore`): `id, name, room, dateLastCompleted, duration, frequency, urgency?`. The DB `chores` table columns (7): `id, name, room, date_last_completed, duration, frequency, urgency`. **`details` and `long_term_task` are gone (`F4`, #38)** — `grep -rn "longTermTask\|long_term_task" backend frontend types` matches only (a) the `LEGACY_CHORE_COLUMNS` migration list + comment in `backend/src/db.ts`, (b) `backend/src/__tests__/db-migration.test.ts` (legacy DDL + legacy INSERTs), and (c) the stale-client tests in `backend/src/__tests__/chores.test.ts`, `backend/src/__tests__/routes.test.ts`, `frontend/src/__tests__/components/ChoreForm.test.tsx` and `frontend/src/__tests__/utils/choreSort.test.ts`; nothing in `app.ts`, `chores.ts`, `SharedTypes.d.ts`, or any non-test frontend file. `createChore`/`updateChore` build explicit named-param literals, so legacy `details`/`longTermTask` keys from a stale client (e.g. a kiosk page not yet reloaded) are **silently dropped, not rejected** (deliberate — a 400 would break a kiosk page still running the old form until it reloads; accepted as the right call in `F4`'s push review). `urgency` is retained permanently. `frontend/src/__tests__/fixtures/chore.ts`'s `makeChore` never defaulted the removed fields, so it needed no change.

**Sort** (`frontend/src/utils/choreSort.ts`): `orderChores` is a single `calcDurationWeightedScore` sort (`duration × daysSince/frequency`, descending) — the former long-term-task bottom partition left with `F4`, so infrequent maintenance chores now interleave by score instead of pinning below daily upkeep (a user-visible behaviour change, documented in the README). **`F16` replaces this scorer** — the 2026-09-20 review found that because each chore's score grows by a constant `duration/frequency` per day, two chores' rank order can flip at most once and a short-duration chore never overtakes a long one no matter how overdue it gets; the sort never consults the red/orange/green status `computeBar` paints, and `urgency` is read by nothing outside `ChoreForm.tsx`. **Re-sort trigger** (kept by `F16`): the single `useEffect` on `simulatedDate` in `App.tsx` — fires at local midnight (`useMidnightClock`), on every day-simulation step, and on first load; completing a chore, SSE re-pulls (`reconcileChores` keeps existing positions, appends new ids) and screen unblank never re-sort, so a finished chore stays where it was, green, until midnight (the sticky-order rule from #8, `plans/completed/real-time-midnight-sort.md`).

**Backend routes** (`app.ts`): `GET /api/chores`, `GET /api/events` (SSE doorbell), `POST /api/chores`, `PUT /api/chores/:id` (full-replace edit, 200 / 400 `Invalid id` / 400 `Missing required fields` / 404 `Chore not found` / 500), `PATCH /api/chores/:id/complete`, `DELETE /api/chores/:id`. CORS `Access-Control-Allow-Methods` includes `PUT`. Tests for the SSE bus at `backend/src/__tests__/events.test.ts`.

**Frontend API** (`frontend/src/services/choreApi.ts`): `fetchAllChores`, `addChore`, `updateChore(id, chore)`, `completeChore`, `removeChore`.

**Key UI**
- `App.tsx` — orchestrator: holds `choreData`, `sortedIds`, day-simulation (`simulatedDate`/`isSimulating`, real clock via `realToday`), room filter (`uniqueRooms` derived; `useRoomFilter(choreData, selectedRoom)` → `filteredChores`), **search filter** (`searchFilteredChores` derived from `filteredChores`, feeding `orderedChores`), day-simulation handlers, add/edit/delete handlers (F4-L/F2-L/F5-L trio), SSE subscription (`useChoreEvents` + gated `reconcileChores`), and the **two kiosk overlays**: `useScreenBlank()` → `{ isBlanked, wake }` rendering `<ScreenBlankOverlay onWake={wake} />` when `isBlanked` (`F1`, shipped #27), and `useTouchLock()` → `{ isLocked, arm }` rendering `TouchLockIndicator` always plus `TouchLockOverlay` when `(isLocked || isClosing) && !isBlanked` (`F2`, shipped #28), the app root `inert` while either is active, with a force-close-dialogs effect on blank/lock. **Both overlays are slated for removal by `F15`** (kiosk-layer extraction — their behavior moves to the pi-kiosk shell). **Add Task deck (`F5`, shipped #39) — a frosted sticky surface *inside* the scroll region:** the scroll container is `flex-1 overflow-y-auto min-h-0 flex flex-col scroll-pb-40` (the literal `overflow-y-auto` token must stay on this element — `App.search.test.tsx` locates it by class), `ChoreList` first, then the deck as its last child: `data-testid="add-task-deck"`, `sticky bottom-0 mt-auto flex-shrink-0 flex justify-center py-4` with **no border or background of its own**. The tint + blur live on an `aria-hidden` `data-testid="add-task-deck-backing"` child — `pointer-events-none absolute inset-x-0 -top-16 bottom-0 bg-gray-900/60 backdrop-blur-sm [mask-image:linear-gradient(to_bottom,transparent,black_4rem)]` — a progressive blur that fades in over a 4rem overhang above the ~81px deck rather than stopping at a hard edge (tuned on the Pi kiosk: 2rem read as abrupt, 4rem accepted). `AddChoreButton` (`bg-blue-500 hover:bg-blue-600`, now **fully opaque**) sits in a `relative` wrapper *after* the backing so it paints on top. `mt-auto` pins the deck to the bottom for short/empty lists, `sticky` while a long list scrolls beneath the blur; `scroll-pb-40` (160px ≥ 81px deck + 64px overhang) declares the deck plus its fade as obscured so `scrollIntoView`/keyboard focus land bars clear of it (Chrome aligns a Tab-focused sr-only pill's *own* rect to the scroll-padding edge — measured). The deck's own box keeps default pointer events (a frosted surface must not pass taps to half-hidden bars); the overhang is `pointer-events-none` so bars under the fade stay tappable. No z-index anywhere. Tailwind 4.1.18 emits both `-webkit-`/unprefixed `mask-image` and `backdrop-filter`. Note that Tailwind's built-in `mask-t-*` utilities fade the *bottom* edge in (`to top, black <from>, transparent <to>`), so the arbitrary `mask-image` property is the simplest correct form — verified by compiling both (F5 push Review 2). `NavBar` renders room chips **and the persistent search input** above the list. **There is no settings/device-control panel on `main`, and there never will be** — `F3` was superseded 2026-07-15 (migrated to pi-kiosk).
  - **SSE sync — unchanged contract:** subscribes via `useChoreEvents(onChange)` (`hooks/useChoreEvents.ts`; `new EventSource('/api/events')` + `visibilitychange→visible` re-fire). Re-pulls are gated by `isRepullGated()` (`isMutatingRef` || `showForm` || `editingId` || `pendingDeleteId`); deferred via `pendingRefreshRef`. **Any new frontend feature holding uncommitted user input in `App.tsx` state must be added to this gate.**
  - **Visible-list pipeline (three-stage):** `filteredChores = useRoomFilter(choreData, selectedRoom)` → `searchFilteredChores` (substring on `name`, from `F9-L`) → `orderedChores` (maps `sortedIds` over a `Map` of `searchFilteredChores`).
  - **`F1`'s real-clock scheduling (shipped):** `frontend/src/hooks/useScreenBlank.ts` — window-boundary re-arming timeouts driven by `realToday`, **not** `simulatedDate` (adapted from the `useMidnightClock.ts` single-`setTimeout`-to-boundary pattern, which remains available as a precedent for any future real-clock feature).
- `components/chore/ChoreTimerBar.tsx` — **F10-L's current shape**: `useSwipeable` with **swipe-left → `onEdit`**, **swipe-right → `onDelete`** (reversed from the original F5-L mapping), a controlled swipe offset revealing a behind-the-bar action layer (yellow+pencil for edit, red+trash for delete) with a **25%-of-bar-width threshold** and spring-back below it; colour fades in progressively toward the threshold (added in F10-L's third commit). `delta: 50` remains the swipeable trigger threshold (distinct from the 25%-width confirm threshold). Spread-before-explicit-props order, `touch-pan-y`, `isSimulating` guard, `swipingRef` click-suppression all preserved. Bar math from `@utils/choreBarMath` `computeBar(daysSince, frequency)` — **revised in PR #32** (`790a4ab`, untracked by any F-ID): `barColor` is `bg-red-500` only when `isOverdue`, never pre-due (previously red could appear before the due date); `ProgressBar`'s fill re-gained its `opacity-50` translucency, restoring a Tailwind v4 regression that had silently dropped the dead v3 `bg-opacity-50` utility. `h-20 sm:h-16` grid layout from F6-L unchanged.
- `components/common/ConfirmDialog.tsx` (F4-L) — unchanged; reused by the swipe-delete path. *(The former "reuse for `F10` restart confirm" plan left with the migration — restart now lives in pi-kiosk.)*
- `components/form/` — `ChoreFormModal` → **`ChoreForm`** → `FormField`. **Room field is now a `<datalist>` input** (`F3-L`) sourced from `uniqueRooms`, threaded through both Add and Edit — a raw `<input type="text" list="room-options">`, not `FormField`. The form's fields are exactly `Name` (`FormField`, `name="name"`, **`clearable`**), Room (the raw datalist input), `Last Completed` / `Duration (minutes)` / `Frequency (days)` (`FormField`, *not* `clearable`), and `Urgency` (a raw `<select id="urgency">` with blank/low/medium/high, not `FormField`) — the `Details` `FormField` and the `longTermTask` checkbox were deleted by `F4` (#38) without touching `ClearButton.tsx`, `ChoreSearchInput.tsx` or `FormField.tsx` (no diff in #38). **Clear-✕ affordance (`F14`, #34):** `FormField` takes an opt-in `clearable?: boolean` (default `false`; only Name passes it — Last Completed/Duration/Frequency don't) and renders a `ClearButton` when `clearable && value !== ''`; the raw Room `<input>` (`ref={roomInputRef}`, `pr-14`) hand-wires its own `ClearButton` (`anchor="top"`, label `"Clear Room"`). Both clear only that field's local state (no submit/close) and refocus the input.
- `components/chore/ChoreSearchInput.tsx` — the `F9-L` search box (`Search` icon, `placeholder="Search for a chore"`, `pr-14`), pinned above the scroll region. **Has a clear-✕ (`F14`, #34):** renders `ClearButton` (label `"Clear Search"`) when `value !== ''`; clearing calls `onChange('')` and refocuses, restoring the room-filtered list exactly as manual deletion does.
- `components/common/ClearButton.tsx` (`F14`, #34) — the shared clear-✕ primitive: `{ label: string; onClear: () => void; anchor?: 'center' | 'top' }`; `lucide-react` `X` inside an absolutely-positioned `right-3` 44×44 px touch target (the app's kiosk-touch convention, matching `DateNavigationBanner`); `anchor='center'` (default) vertically centres on a label-less input (search), `anchor='top'` pins to the input's top edge so it clears a `FormField`'s label. `aria-label={label}` — the three current labels are Title Case (`"Clear Search"`/`"Clear Name"`/`"Clear Room"`); sentence-casing them is an open `[a11y]` minor in `plans/PUSH-REVIEW-FINDINGS.md`. Inputs that host it reserve `pr-14`.

**Tests**
- **Vitest** unit tests both sides (backend 43, frontend 254 as of #43 — #43 added no tests), now also covering the search filter (component + App-level substring/room composition + SSE-survival tests from `F9-L`), the reversed swipe mapping + threshold (`F10-L`), the clear-✕ affordance (component-level show/clear/refocus + App-level clear-restores-room-filter, from `F14`), and `F4`'s removal: `backend/src/__tests__/db-migration.test.ts` (7 cases — idempotency on `:memory:`, boot wiring against a legacy 9-column temp file, rows/other columns preserved), stale-client-key drop tests on `POST`/`PUT` and `createChore`/`updateChore`, a `ChoreForm` absence test (no Details / Long-term inputs) and a stale-`longTermTask`-flag-ignored sort test, plus `F5`'s `Add Task deck (F5)` describe in `App.test.tsx` (deck sticky/`mt-auto`/last-child inside `.overflow-y-auto` for populated and empty lists, the masked backing layer's classes and backing-before-button paint order, `scroll-pb-40`) and the opaque-button assertion in `AddChoreButton.test.tsx`.
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
9. **Double-tap touch lock**: `useTouchLock()` + `TouchLockOverlay`/`TouchLockIndicator` — local-only/per-tab, arms after 5 minutes' inactivity, unlocks on a second tap within 1500 ms and 60 px, 400 ms `CLOSING_SETTLE_MS` closing handshake, `z-[90]` always defers to the blank overlay's `z-[100]` (F2, shipped #28). *Holds until `F15` relocates this behavior to pi-kiosk and removes the in-app code.* **Pending amendment by `F20`** (added 2026-09-20): the always-on overlay + app-root `inert` gate become a *permissive* lock — padlock only on a blocked complete/edit/delete, everything else usable, indicator = single-tap lock/unlock control, timer running while locked. Once `F20` ships this invariant is rewritten to `F20`'s contract, and what `F15`/pi-kiosk must reproduce is `F20`'s, not the original.
10. **Clear-✕ affordance on every free-text input**: search bar, form Name, form Room each render the shared `ClearButton` only when non-empty; clicking clears that field's local state only (never submits/closes) and refocuses the input; `FormField`'s affordance is opt-in via `clearable` (default off), so no other `FormField` usage (Last Completed, Duration, Frequency) gains it (F14, shipped #34; verified intact after F4 — `ClearButton.tsx`, `ChoreSearchInput.tsx`, `FormField.tsx` had no diff in #38).
11. **No `details` / `longTermTask` anywhere in the live model**: `Chore` is `id, name, room, dateLastCompleted, duration, frequency, urgency?`; the shared `ChoreForm` has no Details field or Long-term checkbox; `app.ts`/`chores.ts` never read or write them (stale keys from old clients are dropped silently, never rejected — deliberate, so a not-yet-reloaded kiosk page keeps working through the rollout; don't "fix" it with a 400); `db.ts` runs the idempotent, crash-loud `dropLegacyChoreColumns` boot migration (`pragma table_info` guard, `BEGIN IMMEDIATE`) so an existing 9-column `data.db` migrates itself to 7 columns on first boot and later boots are no-ops; `orderChores` is a single duration-weighted sort with no long-term partition (F4, shipped #38). Any future schema change adds its own guarded step beside that migration — `CREATE TABLE IF NOT EXISTS` never alters an existing `data.db`. The pre-F4 image cannot write to a migrated DB (its SQL still names the dropped columns), so a rollback restores the pre-deploy snapshot together with the old image.
12. **Frosted sticky *Add Task* deck**: the deck lives *inside* the scroll region as its `sticky bottom-0 mt-auto` last child with no border/background of its own; tint + blur come from a masked, `aria-hidden`, `pointer-events-none` backing layer that overhangs the deck by 4rem and fades in (`bg-gray-900/60 backdrop-blur-sm` + `mask-image` gradient); `AddChoreButton` is fully opaque and paints above the backing; the scroll container carries `scroll-pb-40` so focus/scrollIntoView never rest a bar under the deck or its fade; `.overflow-y-auto` stays the single scrolling element and `ChoreSearchInput` stays outside it (F5, shipped #39). Any change to the deck's height or overhang must re-check `scroll-pb-*` (≥ deck + overhang) and the Tab-focus clearance measured in `plans/feature/translucent-add-deck/` (or its frozen copy under `plans/completed/`).
13. **LAN name `c4i`**: the Pi's hostname is `c4i`, reachable as `http://c4i.local/` and `http://c4i/` with `http://192.168.1.214/` still working; the mechanism is `deploy/pi/set-hostname.sh` + `deploy/pi/cloud-init/99-c4i-hostname.cfg` (idempotent, backup-then-write, crash-safe re-run, rollback = run it with the old name) and nothing in the app is name-aware — no feature may hard-code a hostname or IP in app code, `nginx.conf`, or the kiosk `.desktop` (which stays `http://localhost/`), and any future Pi rename runs the script (it also clears Chromium's hostname-keyed profile lock) rather than `hostnamectl` alone (F6, shipped #43). The deployed `deploy/pi/` copies are refreshed by every redeploy; the installed system files are not.

**Assumptions to revisit at planning time**
1. **Resolved (F4, shipped #38):** `better-sqlite3` bundles SQLite 3.51.3 (≥ 3.35), so `ALTER TABLE … DROP COLUMN` is available and the boot migration uses it — no table-rebuild fallback was needed. Re-verify only if `better-sqlite3` is ever downgraded.
2. Tap-to-complete + the simulation pointer-events guard + the SSE re-pull gate are primary; no new feature may regress them. `F1` (shipped) already coordinates this; `F2`'s implementation resolved the same concern for its own overlay (see item 7 below).
3. **Resolved (F4, shipped #38):** `details` was never rendered, and its removal shipped without a display change; the one user-visible change was the sort (long-term chores no longer pin to the bottom — Standing invariant 11).
4. **Resolved (F6, shipped #43):** its out-of-repo end state (the Pi/LAN rename) is applied and verified live; the deployment docs live in `deploy/pi/README.md` § LAN name and `plans/feature/local-url-alias/research/` (frozen under `plans/completed/` after the next sweep). The frozen Dockerization plan lives at `plans/completed/docker-raspberry-pi/`. *(The former host-bridge controls `F13`/`F7`/`F8`/`F10` migrated to pi-kiosk 2026-07-15 — their host-side end states are now that repo's concern; `F15`'s external gate — "pi-kiosk Phase 2 parity verified on the Pi" — is likewise verified outside this repo and recorded in `F15`'s own plan docs.)*
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

## F2-L — Edit Task functionality  ·  merged (#15, `06e0b00`)  ·  kept: **`F21` targets it** — the follow-up list below was promoted to `F21` on 2026-09-20 (delete this entry when `F21` ships; nothing else targets the contract now that `F4` shipped #38)
**Implemented contract (as built; `F4` (#38) removed `details`/`longTermTask` from every layer of it — the form now emits `Omit<Chore,'id'>` with `name, room, dateLastCompleted, duration, frequency, urgency?`):**
- **Shared form:** default export **`ChoreForm`** at `frontend/src/components/form/ChoreForm.tsx`. Props: `{ mode?: 'add' | 'edit'; initialChore?: Chore; onSubmit: (chore: Omit<Chore,'id'>) => void; onCancel: () => void }` (default `mode='add'`). Internal helper `choreToFormState(chore)` does the inverse mapping; post-submit reset gated to add mode. Its only importer is `ChoreFormModal`.
- **Modal:** `ChoreFormModal` accepts `{ mode?, initialChore?, onSubmit, onCancel }` and forwards to `ChoreForm`. The form emits `Omit<Chore,'id'>`; App supplies the id.
- **Backend:** `PUT /api/chores/:id` (full replace, 200 / 400 `Invalid id` / 400 `Missing required fields` / 404 `Chore not found` / 500); `backend/src/chores.ts` exports `updateChore(id, input): ChoreWire | null`; CORS includes `PUT`. Both handlers and both data-access functions are `details`/`longTermTask`-free since `F4` (#38); stale keys in a request body are dropped, not rejected.
- **API client:** `choreApi.ts` exports `updateChore(id, chore): Promise<Chore>`.
- **App:** `editingId` state + derived `editingChore`; optimistic update + rollback. Add/edit modals mutually exclusive.

**Known follow-up (confirmed by user 2026-07-08; promoted to `F21` on 2026-09-20 — items
1, 3, 4 and 5 are `F21`'s scope, item 2 was found already shipped), UI polish on the
shared add/edit/delete flow:**
1. No toast/confirmation feedback is shown after a chore is successfully added, edited, or
   deleted — success is currently silent.
2. ~~The **Add New Chore** form modal does not close itself after a successful add; the user
   must dismiss it manually.~~ **Already on `main`** (verified 2026-09-20): `handleAddChore`
   in `App.tsx` has called `setShowForm(false)` on success since #15; only a *failed* add
   leaves the modal open, which is deliberate. Dropped from `F21` — no change.
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
   **Confirmed 2026-09-20** by the user's report ("on creation of a new task, the task is
   immediately assigned a last completed date one day before the one used in the form")
   and by code reading: the mirror bug is in `choreToFormState` (`toISOString().slice(0,
   10)` shows the UTC date in the edit form). `F21` fixes both at the form boundary
   (`date-fns` `parse`/`format`, local) and leaves every `daysSince` expression alone.
   *Coupling with `F16`:* the new sort keeps consuming the same `daysSince` expression, so
   it must not fix or widen this in-band; if `F21` ships first (the soft order) the
   caveat is moot, otherwise a green chore completed "today" but parsed as yesterday ranks
   one day lower in the green bucket — cosmetic, not a bucket-flip, since `F16` classifies
   status with the same `daysSince` the bar uses.
5. The **Add New Chore** form's `room` field always defaults to `''` regardless of the
   currently-selected room filter — should default to the currently-selected room if one is
   active; when the room filter is `'All'`, keep the current blank-default behavior.

## Deferred follow-ups from merged features (confirmed, unscheduled — no F-ID yet)

- **Room `<datalist>` on mobile** *(from F3-L, #24; confirmed by user 2026-07-07)*: the
  suggestion dropdown does not appear on mobile even after tapping the `<datalist>` arrow —
  native `<datalist>` mobile support is inconsistent across browsers; likely needs a
  mobile-specific affordance or a custom-listbox fallback for touch. Small fix; assign an
  F-ID via `/new-feature` when scheduled.
- The add/edit/delete **UI-polish list** (toasts, date/room defaults, the UTC-vs-local
  date-math bug) under `F2-L`'s entry above is **no longer deferred — it is `F21`**
  (2026-09-20). It stays listed there only as `F21`'s source wording until `F21` ships,
  when the whole `F2-L` entry is deleted.

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

## F2 — Double-tap accidental-touch lock  ·  merged (#28, `3160dfc`)  ·  kept: `F15` must remove this code and pi-kiosk Phase 2 must reproduce it (parity checklist)  ·  **amended by `F20` (pending, 2026-09-20)** — once `F20` ships, the contract pi-kiosk reproduces is `F20`'s permissive lock (timer/state/indicator in the shell, guard + padlock in the app), and this section is rewritten to the as-built `F20` shape

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

# REMAINING FEATURES (current numbering, incl. `F15`–`F21`)

> Every remaining feature's **Assumed starting state is the Baseline above**. `F1` (#27)
> and `F2` (#28) shipped — their implemented contracts are kept under Completed-Feature
> Contracts (below) because `F15` targets them; `F14` (#34), `F4` (#38) and `F5` (#39) shipped
> and live entirely in the Baseline + Standing invariants 10–12 (no remaining feature builds on
> them); `F6` (#43) shipped and lives in the Baseline's *Deployment* paragraph + Standing
> invariant 13. The **focus feature is `F21` — ungated, runnable now** (see "Shortest path" above); `F15` is the gated kiosk-track head. `F3`/`F7`/`F8`/`F9`/`F10`/`F13`
> are **superseded — migrated to `rehankalu/pi-kiosk`** (2026-07-15, see
> `plans/feature/kiosk-shell-extraction/kiosk-shell-extraction.md`); their sections below
> are retained as banners + history only. `F11`/`F12` remain here, re-scoped; `F15` is new;
`F16`–`F21` were added 2026-09-20 (`F20` reworks the shipped `F2` lock; `F21` promotes the
`F2-L` follow-up list and is ★FOCUS).

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

## F15 — Adopt kiosk-shell (remove F1/F2 overlays + embeddability guarantee)  ·  kiosk-track head — gated (★ moved to `F21` 2026-09-20)  ·  Effort M  ·  (added 2026-07-15)

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
  **If `F19` has shipped first:** its lock-time view reset must *survive* — the app keeps an
  app-side `isLocked` state (no overlay, no timer of its own) fed by the shell, and `F19`'s
  effect is re-keyed to it; see Open risks (e). Deleting the reset along with the overlay
  would regress `F19`'s cumulative invariant.
  **If `F20` has shipped first (expected):** the grep above is *wrong* for the lock half —
  `TouchLockOverlay` (the in-app padlock feedback) and the bar-level guard **stay**; what
  leaves is `useTouchLock`'s timer/state ownership and the `TouchLockIndicator` control
  (raised to the shell). The app-side `isLocked` is then fed by `kiosk-state { locked }`
  and the app sends `lock-request { locked }` (double-tap unlock path; the indicator's
  single-tap lock/unlock lives in the shell). Rewrite this feature's end state at planning
  time against `F20`'s as-built contract — Open risks (f).
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
them in pi-kiosk first; this feature never starts on partial parity. (d) **pi-kiosk
`target_url` after `F6` (#43):** the LAN alias `http://c4i.local/` is live and is the
natural `target_url` for any *remote* kiosk; on the wall Pi itself keep `http://localhost/`
— the kiosk would otherwise depend on Avahi + `nss-mdns` being up at login (boot-order
risk), and the Pi resolves its own `c4i.local` to the Docker bridge `172.18.0.1`
(served, but pointless). Record the choice in pi-kiosk's config when Phase 1/2 land.
(e) **App-side meaning of "locked" (principle set by `F19`, 2026-09-20):** *the kiosk owns
the inactivity timer; the app owns what "locked" means for it.* A `locked` signal — today
`useTouchLock`'s `isLocked`, after this feature the shell's `kiosk/v1` `kiosk-state {
locked }` message (design doc DD-3) — does **not** necessarily mean no interaction is
possible with the app, only that certain actions are guarded by the lock (`F19`'s view
reset is the first such app-side behavior; the blanket `inert` gate is today's
implementation of "guarded", not the definition). Consequence for this feature: remove the
overlays, the indicator and the timer, but **keep a minimal app-side `isLocked` state** and
source it from the shell. The gap is that `kiosk-state` arrives with pi-kiosk **Phase 4**
while this feature is gated on **Phase 2** — decide in this feature's plan whether (i) to
keep `useTouchLock`'s bare inactivity timer (no overlay) as the interim `isLocked` source
until Phase 4 replaces it, or (ii) to pull the `kiosk-state` listener forward into Phase 2
of the pi-kiosk design (it is a one-way, additive message). Option (i) keeps this repo
self-sufficient and is the default if pi-kiosk's Phase 2 lands without the message. Either
way, record the resolution in `plans/feature/kiosk-shell-adoption/` and in the design doc.
(f) **`F20` retires DD-2's shape (2026-09-20).** A shell overlay above the iframe that
blocks *all* input is incompatible with `F20`'s permissive lock (scroll / search / rooms /
day-sim / Add Task must work while locked, and the blocked-tap-as-first-tap unlock needs the
tap to reach the app). The cross-repo split becomes: **shell** owns the inactivity timer
(global evdev feed — it sees activity the app can't), the lock *state*, and the top-left
indicator control (single tap: lock ↔ unlock); **app** owns the guard, the padlock feedback,
the second-tap detection, and `F19`'s reset. Contract additions to specify in the design doc
(DD-2/DD-3 amendment) when this feature plans: shell → app `kiosk-state { blanked, locked }`
(already in DD-3) plus an idle-expiry tick while locked (for `F19`); app → shell
`lock-request { locked: false }` (double-tap path) — and `{ locked: true }` only if the app
ever grows a lock control of its own. Because these ride the `kiosk/v1` contract (Phase 4),
this feature's lock half is effectively Phase-4-gated while its blank half is Phase-2-gated:
decide at planning whether to **split** (blank removal + embeddability at Phase 2; lock
hand-over at Phase 4 — the recommended shape, new F-IDs via `/new-feature` if split) or to
hold the whole feature to Phase 4. Parity checklist for the lock half is `F20`'s contract,
not `F2`'s.

**Session loop.** Run the Per-Feature Session Contract on branch
`feature/kiosk-shell-adoption`.

---

## F16 — Status-bucketed midnight re-sort with red-quota escalation + Urgency weighting  ·  runnable now (ungated; soft after `F21`)  ·  Effort M  ·  (added 2026-09-20)

**Goal.** Make the midnight (and day-simulation) re-sort produce the view the user wants
on the first wake of each day: during normal operation a *balanced spread* of green /
orange / red bars above the fold — some recently accomplished work still visible, not a
wall of red — with a hard guarantee that **the more days a chore is overdue, the higher it
ranks**, and a deterministic escalation that fills the fold with red only once the board
has been neglected long enough. `urgency` finally does something: a High chore climbs and
escalates faster than a Low one. Ledger item: `F16` in
`plans/ledger/260920_feature_ledger.md` (the full normalized spec lives there).

**Why the current scorer fails this** (2026-09-20 review): `score = duration ×
daysSince/frequency` is *minutes of accumulated time-debt*, not *how overdue*. A 60-min
weekly chore at day 3 (green) scores ≈ 26; a 2-min every-3-days chore 10 days overdue
scores ≈ 9. Each day adds a constant `duration/frequency` per chore, so rank order among
chores is nearly frozen — low-slope chores never overtake, which is exactly the "overdue
tasks don't bubble up in simulation" symptom. And recently completed chores score ≈ 0 at
midnight, so the "green on load" the user likes only ever happened by accident (completion
doesn't re-sort; midnight does).

**Rank rationale.** Ungated; second in the chore-list soft order behind `F21`'s bug fix,
which took the ★ when the 2026-09-20 capture batch closed (see *Where the rollout stands*)
— `F16` is the first *feature* after that fix and the batch's biggest behavioural change.

**Effort: M.** One utility rewritten (`choreSort.ts` grows from 14 lines to a bucket →
rank → quota-fill pipeline), a small constants entry, a README paragraph, and a test matrix
wide enough to pin the guarantees below (bucket agreement with `computeBar`, monotonic
red ranking, quota donation, escalation threshold, urgency multiplier, tie stability,
empty/all-one-bucket inputs). No `App.tsx`, form, bar, backend or schema change.

**Design (agreed with the user 2026-09-20; deterministic — no weighted randomness):**
1. **Bucket by the status the bar paints.** Classify each chore red / orange / green using
   the *same* thresholds as `computeBar` (`daysSince > frequency` → red; else
   `remainingRatio ≤ 0.375` → orange; else green) — import or share the helper rather than
   re-deriving, so sort and colour can never disagree. `frequency === 0` chores are never
   red (matches `computeBar`); treat them as green.
2. **Rank inside each bucket by what matters for that bucket:**
   - red — `overdueRatio = (daysSince − frequency) / frequency` **× urgency multiplier**,
     descending; `duration` descending as tiebreak only;
   - orange — `remainingRatio` ascending (closest to due first);
   - green — `daysSince` ascending (**most recently completed first** — the green slots
     must show *recently accomplished* work, not "about to turn orange").
3. **Fold quota.** `FOLD = 8` (≈ one unscrolled kiosk screen at `h-20` bars; a tunable
   constant, re-measure on the Pi). Base split red 4 / orange 2 / green 2. Take the top-N
   of each bucket for the fold; an under-filled bucket donates its unused slots to red
   first, then orange, then green. After the fold, append the remaining reds, then
   oranges, then greens, each still in bucket order.
4. **Escalation.** `pressure` = number of red chores whose urgency-scaled `overdueRatio ≥
   1` (i.e. at least 2× their frequency has elapsed). `redQuota = min(FOLD, baseRed +
   pressure)`, taken from the orange then green quotas. With 0–1 badly overdue chores the
   morning view is the balanced spread; at 4+ the fold is all red.
5. **Urgency (sort only).** Multiplier on `overdueRatio`: `low` ×0.75, `medium` or unset
   ×1, `high` ×1.5 — so a High chore both ranks higher within red and reaches the
   `pressure` threshold sooner. **Bar colour and status thresholds in `choreBarMath` are
   untouched** (user chose "sort only" over "sort + bar status" on 2026-09-20).
6. **Trigger unchanged.** Still only the `simulatedDate` effect in `App.tsx` (midnight +
   day-simulation + first load). Screen unblank does not re-sort (user confirmed); completing
   a chore leaves it in place until midnight. `orderChores(chores: Chore[], today: Date):
   Chore[]` keeps its signature; `calcDurationWeightedScore` may be deleted once nothing
   imports it (only `choreSort.test.ts` does today).

**Assumed starting state** = **Baseline**. Verify:
- `frontend/src/utils/choreSort.ts` exports exactly `calcDurationWeightedScore` and
  `orderChores`; `App.tsx` imports only `orderChores` and calls it in two places
  (`reconcileChores` for newly-seen ids, and the `simulatedDate` effect).
- `grep -rn "urgency" frontend/src --include=*.ts --include=*.tsx -l | grep -v __tests__`
  → only `components/form/ChoreForm.tsx`.
- `choreBarMath.ts`'s `computeBar` is the sole status classifier; `statusColors` in
  `assets/constants.ts` carries the `0.375` orange threshold.

**Expected end state** (repo-checkable):
- `choreSort.ts` implements the six points above; the status classification it uses is
  provably the same function/threshold `computeBar` uses (shared helper or direct import —
  not a copied literal).
- A constants entry (in `assets/constants.ts` or a sibling) holds `FOLD`, the base quotas
  and the urgency multipliers, each with a one-line comment on what it tunes.
- `choreSort.test.ts` covers, at minimum: bucket ↔ `computeBar` agreement across the
  boundaries; a 10-day-overdue 2-min chore outranks a green 60-min chore; among reds,
  larger `overdueRatio` always ranks higher regardless of duration; green ordering is most-
  recent-first; quota fill 4/2/2 on a mixed board; donation when a bucket is short;
  escalation to an all-red fold at `pressure ≥ 4`; `high` vs `low` urgency flips rank and
  pressure at the same `daysSince`; `frequency === 0`; empty input; stable ties.
- README's "sort" paragraph (currently *`score = duration × (daysSince / frequency)`*)
  rewritten to describe buckets, quota, escalation and the urgency multiplier, and to say
  plainly that the order changes only at midnight.
- The Baseline **Sort** paragraph above is rewritten at fold-back; Standing invariant 14
  is added recording the sort ↔ bar status agreement as a durable contract.
- All suites green (frontend 254 → more; backend 43 unchanged).

**Test-suite deltas.** Rewrite `choreSort.test.ts` (the three
`calcDurationWeightedScore` cases go if the function goes; the stale-`longTermTask`
sort test is kept in spirit — a legacy flag must still be ignored). `App.test.tsx` /
`App.sync.test.tsx` fixtures that assert a specific order after a simulated-day step must
be re-checked: they were written against the old score and may need their expected order
updated (not weakened). No e2e change expected (`e2e/smoke.spec.ts` does not assert
order — verify).

**Open risks / decisions.** (a) `FOLD`, the 4/2/2 split, the `≥ 1` pressure threshold and
the 0.75/1/1.5 multipliers are first guesses — tune on the Pi with real household data
via the day simulator, and record the final numbers in the constants file, not here.
(b) With very few chores (< `FOLD`) the quota is moot and the result is simply
reds-then-oranges-then-greens — acceptable, but the test should say so. (c) The
UTC-vs-local date-math off-by-one (`F2-L` follow-up #4) is **`F21`'s** to fix, at the form
boundary — keep it out of scope here; `orderChores` keeps consuming the same `daysSince`
expression before and after `F21`, so nothing in this feature changes either way. (d) Sort and bar must share one status
classifier; if `computeBar`'s thresholds ever move (e.g. a future "sort + bar status"
urgency reading), the sort follows automatically — that is the point of sharing it.

**Session loop.** Run the Per-Feature Session Contract on branch
`feature/status-bucketed-sort`.

---

## F17 — Status-count strip under the room tabs  ·  runnable now (ungated; soft after `F16`)  ·  Effort S–M  ·  (added 2026-09-20)

**Goal.** A glanceable, always-visible tally of the day's state for the list the user is
looking at: how many chores were **completed today**, how many are **due soon** (orange),
how many are **overdue** (red) — without spending real estate the room tabs, date
simulator and search bar already compete for. Ledger item: `F17` in
`plans/ledger/260920_feature_ledger.md`.

**Design (chosen by the user 2026-09-20 from four placements; their notes are binding):**
- **Placement.** A thin segmented strip rendered directly under `NavBar` (between the room
  tabs and `DateNavigationBanner`), full container width, `flex-shrink-0`. Height: just
  enough for the smallest reasonably legible digit (≈ 16–20 px; measure on the Pi). No
  tap-to-reveal — the numbers are always shown.
- **Three counts, from the *visible* list** (`searchFilteredChores` — room filter AND
  search filter applied, so selecting a room tab narrows the strip), evaluated against the
  displayed day (`simulatedDate`):
  - **green = done today** — `dateLastCompleted` falls on the displayed day (same
    `startOfDay` comparison the bars use);
  - **orange = due soon** — bar status orange (`remainingRatio ≤ 0.375`, not overdue);
  - **red = overdue** — bar status red (`daysSince > frequency`).
  A chore that is green-status but was completed on an earlier day belongs to **no**
  segment. That is what makes the strip **orange + red only at the start of each morning**
  (nothing is "done today" yet).
- **Widths ∝ counts.** Each segment's width is its count over the sum of the three
  counts; a zero-count segment collapses to nothing. If **all three are 0** (e.g. every
  chore is green and none done today, or the visible list is empty), render a **full green
  bar with a centred `0`**.
- **Labels.** Each non-zero segment shows its count centred, **bold, white**. A single
  accessible label on the strip (`aria-label` / `title`) reads e.g. `"3 done today · 2 due
  soon · 5 overdue"` so the meaning is discoverable for a new user; the colours are the
  legend otherwise.
- **Colours = the chore bars'.** `bg-green-500` / `bg-orange-500` / `bg-red-500` via the
  shared status classifier — never re-declared literals. (The bars render at `opacity-50`;
  the strip likely needs full opacity for white text contrast — decide on the Pi, but the
  *hue tokens* must be the same.)
- **Live.** Derived from `choreData` on every render — not from `sortedIds` and not
  gated to midnight. Completing an overdue chore moves it red → green immediately
  (green lengthens, red shortens, proportionally). Re-completing an already-green chore
  increments *done today* and proportionally shrinks orange and red. Under day-simulation
  the counts reflect the simulated date (done-today is then normally 0).
- **Standalone.** No collapse/hide toggle for the top section — explicitly kept out of
  scope (a later `/new-feature` if crowding persists once the strip is in).

**Rank rationale.** Ungated; the user's second ask of the 2026-09-20 batch. Soft-ordered
after `F16` only because both need one shared `classifyStatus(daysSince, frequency)`
helper extracted from `computeBar` — whichever runs first creates it. Either order works.

**Effort: S–M.** One new presentational component, one pure counting util (three
numbers from `(chores, day)`), one wiring line in `App.tsx`, unit tests for both, and the
`App.test.tsx` layout assertions (strip sits between `#NavBar` and the date banner; the
`.overflow-y-auto` scroll container is unchanged). No backend, form, sort or schema change.

**Assumed starting state** = **Baseline** (+ `F16` if it ran first — then the shared
classifier already exists). Verify:
- `App.tsx` renders, in order, `NavBar` → `DateNavigationBanner` → `ReturnToTodayButton`
  → `ChoreSearchInput` → the `.overflow-y-auto` scroll region.
- `searchFilteredChores` is the visible-list source (room ∧ search) and `simulatedDate`
  the displayed day.
- `computeBar` in `choreBarMath.ts` is the sole status classifier (or, post-`F16`, a shared
  helper beside it).

**Expected end state** (repo-checkable):
- New `frontend/src/components/nav/StatusCountStrip.tsx` (name may vary) with
  `data-testid="status-count-strip"` and three `data-testid`'d segments; rendered in
  `App.tsx` immediately after `NavBar`, `flex-shrink-0`.
- A pure util (e.g. `utils/choreStatusCounts.ts`) exporting `countStatuses(chores, day)
  → { doneToday, dueSoon, overdue }`, classifying via the shared helper, with the
  done-today test being same-calendar-day on `dateLastCompleted`.
- Tests: util — mixed board, morning board (no green), all-green-not-today → all zeros,
  re-completed green counts as done today, room+search narrowing; component — widths
  proportional, zero segment absent, all-zero → full green `0`, labels bold/white, accessible
  label text, colour tokens equal the bar's; App — strip position, live update after
  `handleCompleteChore` (optimistic) and after an SSE re-pull, narrows on room tab select.
- README gains a one-line description of the strip in the UI overview.
- Frontend suite count rises; backend 43 unchanged; e2e unaffected (verify
  `e2e/smoke.spec.ts` has no positional selector that the new element shifts).

**Open risks / decisions.** (a) A non-zero segment with a tiny share (1 of 30) may be too
narrow for its digit — pick a `min-w` per non-zero segment (or let the digit overflow)
and record the choice; the total must still read as proportional. (b) Opacity: bars are
`opacity-50`; the strip's white text wants full opacity — same hue tokens either way.
(c) Done-today uses the same date arithmetic as `daysSince`; until `F21` ships (soft
order puts it first) a chore added via the form "today" is parsed as yesterday and does
not count as done today — `F21`'s fix at the form boundary resolves it with no change
here; out of scope for this feature. (d) If `F16` has not run yet, extract
the shared classifier in this feature and note it for `F16` to reuse.

**Session loop.** Run the Per-Feature Session Contract on branch
`feature/status-count-strip`.

---

## F18 — Floating scroll-to-top button  ·  runnable now (ungated; soft after `F17`)  ·  Effort S  ·  (added 2026-09-20)

**Goal.** A minimalist way back to the top of a long chore list on the touch kiosk, costing
nothing on the boot view. Ledger item: `F18` in `plans/ledger/260920_feature_ledger.md`.

**Design (chosen by the user 2026-09-20 from three placements):**
- **Floating bottom-right over the list**, positioned against the scroll region's *frame*
  — i.e. a positioned ancestor wrapping the `.overflow-y-auto` container, or a sibling in
  the flex column — **never inside** the scrolling element, so it doesn't scroll away and
  doesn't become another sticky child of the deck's region. The `.overflow-y-auto` element
  keeps its exact class list (single scroller; `App.search.test.tsx` locates it by class).
- **Clear of the F5 deck.** `bottom` ≥ deck height (~81 px) + the 4 rem frosted overhang
  (Standing invariant 12), right-inset ≈ 1 rem; small footprint (a ≥ 44 px circle, icon-
  only, `bg-gray-700/70`-ish translucent, no z-index — later-in-DOM is enough).
- **Visibility.** Hidden at/near the top; fades in once the container's `scrollTop`
  passes a threshold (≈ 80 px, one `h-20` bar — a constant) and fades out again below it.
  Hidden state is fully non-interactive: `aria-hidden`, `tabIndex={-1}`,
  `pointer-events-none`, `opacity-0`, with a short `transition-opacity`. The boot/unblank
  view is pixel-identical to today.
- **Action.** `container.scrollTo({ top: 0, behavior: 'smooth' })`; `behavior: 'auto'` when
  `prefers-reduced-motion: reduce`. `aria-label="Scroll to top"`; lucide `ArrowUp` (or
  `ChevronUp`) per the icon convention. No other side effect (filters, search, day offset
  untouched).
- **Rejected alternatives** (recorded so they aren't re-proposed): a button *inside* the
  frosted deck beside Add Task (zero real estate but visually couples two unrelated
  actions), and tapping the date heading (undiscoverable; collides with the day-simulation
  chevron row).

**Rank rationale.** Ungated, smallest of the batch, independent of `F16`/`F17`; third only
because it is the least consequential — run it whenever a short session is available.

**Effort: S.** One small presentational component, a `ref` + `onScroll` (or a
`useScrollPastThreshold(ref)` hook) on the existing container, a positioned wrapper in
`App.tsx`, and tests. No backend, data or sort change.

**Assumed starting state** = **Baseline**. Verify:
- `App.tsx` renders the list inside `<div className="flex-1 overflow-y-auto min-h-0 flex flex-col scroll-pb-40">`
  with the F5 deck as its sticky last child; no `scrollTo`/`scrollTop` usage anywhere in
  `frontend/src` (true at #44).
- `AddChoreButton` / the deck carry no z-index (Standing invariant 12).

**Expected end state** (repo-checkable):
- New `frontend/src/components/common/ScrollToTopButton.tsx` (name may vary) with
  `data-testid="scroll-to-top"`; rendered outside the `.overflow-y-auto` element, inside a
  positioned frame around it; the container's class string is unchanged.
- Visibility threshold and `bottom` offset live as named constants with a comment tying the
  offset to the deck height + `-top-16` overhang + `scroll-pb-40` numbers.
- Tests: hidden at `scrollTop 0` (and non-interactive), visible past the threshold, hides
  again on return, click calls `scrollTo` with `top: 0` and `behavior: 'smooth'`, `'auto'`
  under reduced motion; App-level: the button is not a descendant of `.overflow-y-auto`, the
  deck tests from F5 still pass unchanged.
- README's UI overview gains one line.
- e2e: `e2e/smoke.spec.ts` unaffected (verify no selector counts buttons).

**Open risks / decisions.** (a) jsdom has no layout — `scrollTop` must be set directly on
the element in tests and `scrollTo` stubbed (`Element.prototype.scrollTo` is undefined in
jsdom). (b) Swipe interplay: a touch beginning on the button must not also start a bar
swipe (see *Cross-feature couplings*); confirm on the Pi with `react-swipeable`'s
`touch-pan-y` bars. (c) Whether to also hide the button while the Add/Edit modal is open is
moot — the app root is not `inert` for modals, but the modal overlay covers it; leave as is.
(d) Under screen-blank the app root is `inert`, which disables the button; under the touch
lock it is `inert` only until `F20` ships — after `F20` scrolling is *allowed* while locked,
so the button must keep working under the lock (it is a scroll control, not a mutation).
(e) **Shared container `ref` with `F19`:** both features need a `ref`
on the `.overflow-y-auto` element (`F18` to read `scrollTop` / call `scrollTo`, `F19` to
reset `scrollTop` on lock); whichever runs first creates it (suggested name
`scrollRegionRef`) and the other reuses it — never two refs on one element. `F19`'s reset
also drives this button's visibility back to hidden (scrollTop 0 → below threshold), so the
unlock view has no stray button — a test in whichever runs second.

**Session loop.** Run the Per-Feature Session Contract on branch `feature/scroll-to-top`.

---

## F19 — Lock-time view reset  ·  runnable now (ungated; soft after `F18` and `F20`)  ·  Effort S  ·  (added 2026-09-20; trigger amended by `F20` the same day)

**Goal.** Whoever next walks up to the wall kiosk meets the canonical boot view — top of the
list, every room, no search, today — instead of whatever the last person left behind
(scrolled to the bottom, a single room tab, a stale search string, or a day-simulation five
days out). Ledger item: `F19` in `plans/ledger/260920_feature_ledger.md`.

**Design (settled with the user 2026-09-20):**
- **Trigger: `F2`'s touch-lock *engage* transition only** — `isLocked` going `false → true`
  (the 5-minute inactivity padlock, any time of day). **Not** the `F1` screen-blank (the
  user explicitly chose lock-only; the lock timer keeps running under a blank, so a blanked
  screen still resets within 5 minutes of its last touch and the 06:00 wake reveals the
  reset view). Never on unlock, never on a repeated render while locked (use a
  transition guard — `justRelocked` already exists in `App.tsx` for the overlay handshake,
  or a `useEffect` on `isLocked` with an early return when `false`).
- **Four resets, in one effect, all synchronous:**
  1. **Scroll to top** — `scrollRegionRef.current.scrollTop = 0` (or `scrollTo({ top: 0,
     behavior: 'auto' })`). **Instant, never smooth**: the app root is `inert` and dimmed
     under the padlock's `bg-black/40` backdrop; nobody is watching the animation.
  2. **Room → All** — `setSelectedRoom('all')`.
  3. **Search cleared** — `setSearchQuery('')` (the user chose to include it: a stale search
     string on the wall display is the same class of leftover state as a stale room tab).
  4. **Day simulator → today** — `setDayOffset(0)`. When a simulation *was* active this
     changes `simulatedDate`, and the existing `simulatedDate` effect re-sorts — exactly
     what the Return-to-today button does today. That is a day-simulation step, so it is
     consistent with the midnight/simulation-only re-sort rule (`F16` keeps it); when no
     simulation was active, `dayOffset` is already `0` and nothing re-sorts.
- **Where it lives.** One effect in `App.tsx` beside the existing force-close-dialogs
  effect (which already fires on `isBlanked || isLocked`; this one is lock-only). No new
  component, hook, state or backend change. The `ref` on the `.overflow-y-auto` container
  is shared with `F18` (see couplings) — the container's class string is unchanged.
- **Trigger source: keyed directly off `useTouchLock`'s `isLocked`** (chosen 2026-09-20 over
  an app-owned idle timer and over deferring to Phase 4). This binds `F19` to the shipped
  `F2` contract (Standing invariant 9) and hands `F15` an obligation — see *F15 ↔ F19*
  under couplings and `F15`'s Open risks (e). The governing principle, recorded so `F15`
  and pi-kiosk honor it: **the kiosk owns the inactivity timer; the app owns what "locked"
  means for it.** A `locked` signal does not necessarily mean no interaction is possible —
  only that certain actions are guarded by the lock. `F19` is the first app-side behavior
  attached to that signal beyond the blanket `inert` gate.
- **Amended by `F20` (2026-09-20):** because `F20` keeps scroll / search / room / day-sim
  usable *while locked*, the view can drift during the locked period. `F19` therefore also
  re-fires on **every subsequent 5-minute idle expiry while locked** (the tick `F20`'s
  `useTouchLock` exposes) and on a **manual lock** from `F20`'s indicator control (an engage
  like any other). If `F19` runs before `F20` it keys off `isLocked` alone and `F20` re-keys
  it to the tick — hence the soft order `F20` → `F19`. "Instant, never smooth" still holds:
  with `F20` the app is no longer `inert` under the lock, but the reset happens at an idle
  expiry, so nobody is watching.
- **Rejected alternatives** (recorded so they aren't re-proposed): resetting on *unlock*
  (the wall display would show stale state behind the padlock for the whole locked period,
  and the unlocking person would see the view jump under their finger); an app-owned
  5-minute idle timer sharing `useTouchLock`'s listeners (survives `F15` on its own, but the
  user prefers the app to *react to* the lock signal rather than run a parallel timer);
  resetting on blank as well (excluded — lock covers it in practice).

**Rank rationale.** Ungated and small; last of the five 2026-09-20 chore-list adds because
its `F18` coupling (reuse the ref) and its `F20` coupling (consume the idle tick rather than
be re-keyed later) are both cheaper to honor second than first. It composes with
`F16`–`F17` without depending on them.

**Effort: S.** One effect + a `ref` in `App.tsx`, four to six App-level tests, one README
line. No backend, data, sort, component or styling change.

**Assumed starting state** = **Baseline** (`F2` on `main` — `useTouchLock` exposes
`isLocked`; `App.tsx` holds `selectedRoom`, `searchQuery`, `dayOffset`). Verify:
- `App.tsx` has the force-close-dialogs effect on `[isBlanked, isLocked]` and the
  `justRelocked` / `wasLockedRef` transition guard (true at #44).
- `useTouchLock`'s `INACTIVITY_MS = 5 * 60 * 1000`; `App.touchLock` tests drive the lock
  with fake timers (reuse that setup).
- If `F18` shipped first, `scrollRegionRef` (or its equivalent) already exists on the
  `.overflow-y-auto` element — reuse it, do not add a second ref.

**Expected end state** (repo-checkable):
- `App.tsx` contains a lock-engage effect that sets `scrollTop = 0` on the scroll container,
  `selectedRoom` to `'all'`, `searchQuery` to `''` and `dayOffset` to `0`; it does not run on
  `isBlanked` and does not run on unlock. **With `F20` present**, the same effect also runs
  on each idle-expiry tick while locked and on a manual lock from the indicator control.
- Tests (App-level, fake timers): after scrolling, picking a room, typing a search and
  stepping the day forward, advancing 5 minutes idle → all four reset and
  `scrollTop === 0`; unlocking (double-tap) does *not* re-run the reset; blanking alone
  (21:00 without the lock timer elapsing) does *not* reset; the re-sort effect fires on
  lock only when `dayOffset` was non-zero (spy on `orderChores` or assert the order);
  `F18`'s button (if present) is hidden after the reset.
- README's touch-lock paragraph gains one line ("locking also returns the view to the top /
  All / today").
- `.overflow-y-auto` keeps its exact class string; e2e unaffected.

**Open risks / decisions.** (a) jsdom: set `scrollTop` directly and assert it (no layout);
if `F18` stubbed `Element.prototype.scrollTo`, share the stub. (b) The reset happens
*behind* the padlock — confirm on the Pi that the `bg-black/40` backdrop is dim enough that
the jump is unobtrusive; if it reads as a flicker, gate the reset behind
`CLOSING_SETTLE_MS`-style timing *inside* the lock, never move it to unlock. (c) SSE re-pull
gate: none of the four resets is uncommitted user input, so `isRepullGated()` is untouched;
a re-pull arriving mid-reset is harmless (order is `sortedIds`-driven). (d) `F15` inherits
the re-sourcing of `isLocked` — this feature must not try to future-proof it by adding a
`kiosk/v1` listener now (the contract is Phase 4; DD-3 is the spec when it lands). (e) If
this runs before `F20`, key off `isLocked` alone and leave a one-line note for `F20` to
re-key to the idle tick; if after, consume `useTouchLock`'s tick from the start and add the
"drifted while locked → reset at next expiry" test.

**Session loop.** Run the Per-Feature Session Contract on branch `feature/lock-view-reset`.

---

## F20 — Permissive touch lock (rework of shipped `F2`)  ·  runnable now (ungated; soft after `F18`)  ·  Effort M  ·  (added 2026-09-20)

**Goal.** The lock should stop *destructive* accidents without taking the board away from
whoever is standing in front of it. Today `F2` makes the whole app `inert` behind an
always-on padlock; after `F20` the padlock appears **only when someone attempts a
disallowed action**, and everything else keeps working. Ledger item: `F20` in
`plans/ledger/260920_feature_ledger.md`. Principle (user, 2026-09-20): **the lock exists to
prevent destructive behavior; creative behavior is accepted.**

**Design (settled with the user 2026-09-20):**
- **Disallowed while locked** (surface the padlock instead of acting):
  - completing a chore — the single tap on a bar (`ChoreTimerBar`'s `resetTask`);
  - edit / delete — the left / right swipes. **Bars do not move at all while locked**
    (the swipe is inert from the first pixel, exactly like today's day-simulation guard
    — `onSwipeStart`/`onSwiping`/`onSwiped` return early; no offset, no reveal layer).
- **Allowed while locked** (no padlock, works as unlocked): scrolling the list (incl.
  `F18`'s scroll-to-top button); the search input and its clear-✕; the room tabs; day
  simulation (chevrons + Return-to-today); **Add Task, including its submit** (creating is
  not destructive). Whether an Add form left open survives the lock *engaging* is Open
  risks (b) — default: it closes, as today.
- **Guard placement.** The app root **drops `inert` for the lock** (`inert={isBlanked}`
  only; blank keeps its full gate). The guard moves to the bar: `ChoreTimerBar` gains an
  `isLocked` prop and an `onGuardedAttempt(point)` callback — when locked, tap and swipe
  route to the callback instead of `onComplete`/`onEdit`/`onDelete`. **No dimming** of
  locked bars (unlike `isSimulating`'s `opacity-60`) — the board must look normal; the
  padlock is the only signal that something was refused. `ChoreList` threads the two
  props. `TouchLockOverlay` is mounted **on attempt**, not on lock.
- **Two ways to unlock:**
  1. **Blocked tap = first tap.** The blocked attempt mounts `TouchLockOverlay` already in
     its `awaiting-second-tap` phase, seeded with the attempt's coordinates as the first
     tap (a swipe seeds its start point). A second tap within the existing
     `SECOND_TAP_WINDOW_MS = 1500` / `SECOND_TAP_MAX_DISTANCE_PX = 60` unlocks (`arm()`),
     and the previously-blocked actions are available (the person re-taps the bar they
     wanted — the unlock tap itself does **not** complete/edit/delete). No follow-up tap →
     the overlay fades after the window and nothing else changes. Keyboard activation
     qualifies as today.
  2. **The indicator is a control.** `TouchLockIndicator` (top-left, currently a
     `pointer-events-none` 20 px icon) becomes a **button** with a ≥ 44 px touch target
     (the app's kiosk-touch convention): **single tap unlocks while locked, and locks
     immediately while unlocked** (manual lock — no 5-minute wait). The corner position is
     its accident guard. It is the *kiosk-level state indicator/control* — the thing `F15`
     raises to the pi-kiosk shell — while the in-list padlock is the *app-level response* to
     that state.
- **Timer semantics.** `useTouchLock`'s inactivity timer **keeps running while locked**
  (today it detaches its listeners once locked): activity re-arms it as before, and each
  expiry while already locked is exposed as an **idle tick** (e.g. an incrementing
  `idleExpiries` counter or an `onIdle` subscription) that `F19` consumes to re-run its
  view reset. The hook also exposes `lock()` for the indicator control. `INACTIVITY_MS`
  stays 5 min. `isLocked` semantics (engage on expiry, `arm()` unlocks + re-arms) are
  unchanged so `F19`'s engage trigger still works.
- **Blank precedence unchanged:** `ScreenBlankOverlay` (`z-[100]`) still wins; the padlock
  overlay renders only when `!isBlanked`; `CLOSING_SETTLE_MS` / `isClosing` handshake stays
  for the unlock animation. The `justRelocked` entrance animation (centered padlock on
  lock-engage) is **removed** — locking is now silent; the indicator flips to closed.
- **Rejected alternatives** (recorded so they aren't re-proposed): a fresh double-tap on
  the overlay after the blocked attempt (two more taps — slower, and the user wants the
  blocked tap to count); overlay as a pure hint with unlock only via the indicator (kept
  *as well as*, not instead of, the double-tap path); guarding Add Task or its submit
  (creative, not destructive); letting the swipe reveal slide and blocking only at the
  25 % threshold (more accidental, more code).

**Rank rationale.** Ungated; the biggest day-to-day feel change of the batch and the one
that reshapes `F15`/pi-kiosk DD-2 — worth settling before `F15` plans. Placed after `F18`
because it is larger and touches the lock suites; before `F19` so `F19` consumes the idle
tick once instead of being re-keyed.

**Effort: M.** Four existing files reworked (`useTouchLock.ts`, `TouchLockOverlay.tsx`,
`TouchLockIndicator.tsx`, `ChoreTimerBar.tsx`) plus `ChoreList` prop threading and the
`App.tsx` wiring (`inert` narrowed to blank; `onGuardedAttempt` state holding the seeded
first tap; overlay mounted on attempt), the `F2` test suites (`useTouchLock`, `TouchLockOverlay`,
`TouchLockIndicator`, `App.touchLock`) reworked rather than deleted, new guard tests on
`ChoreTimerBar`, README's touch-lock paragraph rewritten. No backend, data or sort change.

**Assumed starting state** = **Baseline** (`F2` on `main`, Standing invariant 9 as written).
Verify:
- `App.tsx`: `inert={isBlanked || isLocked}` on the app root; `TouchLockOverlay` rendered
  when `(isLocked || isClosing) && !isBlanked`; `TouchLockIndicator` is `pointer-events-none`.
- `ChoreTimerBar.tsx`: `isSimulating` guard on `resetTask` and the three swipe callbacks
  (the pattern to mirror for `isLocked`, minus the dimming classes).
- `useTouchLock.ts`: activity listeners attached only while `!isLocked` (the line to change).
- If `F18` shipped, its button lives outside `.overflow-y-auto` and must stay usable under
  the lock; if `F19` shipped, its effect keys off `isLocked` and needs the tick added.

**Expected end state** (repo-checkable):
- `grep -n "inert=" frontend/src/App.tsx` → `inert={isBlanked}` only.
- `ChoreTimerBar` accepts `isLocked` + `onGuardedAttempt`; while locked a click calls the
  guard (never `onComplete`), swipes call the guard once per gesture and leave `offset` at
  0; no `opacity-60`/`pointer-events-none` added for the locked state.
- `TouchLockOverlay` mounts only after a guarded attempt (or is always mounted but
  invisible/`pointer-events-none` until one — implementer's choice, tested either way),
  starts in `awaiting-second-tap` seeded with the attempt point, unlocks on a qualifying
  second tap, fades after the window otherwise; `justRelocked` is gone.
- `TouchLockIndicator` is a `<button aria-label="Lock screen" | "Unlock screen">` with a
  ≥ 44 px target; single tap toggles via `lock()` / `arm()`.
- `useTouchLock` exposes `{ isLocked, arm, lock, idleExpiries }` (names may vary); the
  timer re-arms on activity while locked and increments the tick on expiry while locked.
- Tests: guard on tap/swipe while locked (and not while unlocked); blocked-tap-then-second-
  tap unlocks and the *second* tap does not complete the chore; no second tap → overlay
  hidden after 1500 ms and still locked; indicator single-tap locks (immediately) and
  unlocks; search / room / day-sim / Add Task + submit work while locked (App-level);
  scroll container not `inert` while locked; blank still wins over the padlock; idle tick
  increments every 5 min while locked and resets on activity; `F18`/`F19` suites (if
  present) still pass with the new semantics.
- Standing invariant 9 rewritten to this contract; the `F2` kept-contract section rewritten
  to the as-built shape; README's touch-lock paragraph describes the permissive lock and
  the indicator control.
- e2e: `e2e/smoke.spec.ts` — verify nothing waits on the lock (none expected).

**Open risks / decisions.** (a) **Seeding the first tap from a swipe:** use the gesture's
start point (`initial` from `react-swipeable`'s event data) so a follow-up tap on the same
bar qualifies within 60 px. (b) **Lock engaging with the Add form open:** the existing
force-close-dialogs effect closes it on engage; keep that (5 minutes idle with a half-typed
form is abandonment, and `F19` resets the view at the same moment) — but do **not** close
it on a *manual* lock from the indicator if the form is open (the person is present);
decide at planning, default: manual lock also closes it for simplicity. (c) **Dialogs
reachable while locked:** none — edit/delete are guarded, so `ConfirmDialog` and the edit
modal cannot open under the lock; the add modal can, and that is intended. (d) **Overlay
mount strategy:** mount-on-attempt is simplest but the entrance must be instant (no
600 ms `justRelocked` fade) so the second tap can land within the window; an always-mounted
invisible overlay avoids a mount race at the cost of a permanent portal — pick in the plan,
test the 1500 ms budget with fake timers. (e) **Swipe interplay with `F18`:** unchanged —
the guard sits in the bar's own handlers. (f) **pi-kiosk:** this feature is the source of
truth for what the shell must reproduce at `F15` — DD-2 is amended then, not now (this
feature touches no pi-kiosk file). (g) **Accessibility:** the indicator button needs a
visible focus ring and its label must flip with state; the overlay keeps its keyboard path.

**Session loop.** Run the Per-Feature Session Contract on branch `feature/permissive-lock`.

---

## F21 — Add/edit form polish + UTC-vs-local date-math fix  ·  ★ FOCUS — runnable now (ungated; first in the chore-list soft order)  ·  Effort S–M  ·  (added 2026-09-20; promotes the `F2-L` follow-up list of 2026-07-08)

**Goal.** Fix the bug the user reported 2026-09-20 — *"on creation of a new task, the task
is immediately assigned a last completed date one day before the one used in the form"* —
and, in the same session, ship the small add/edit-form polish that was confirmed on
2026-07-08 and parked under `F2-L`'s kept contract (items 1, 3, 5; item 2 turned out to be
already on `main`). Ledger item: `F21` in `plans/ledger/260920_feature_ledger.md`. The user
chose "promote the whole UI-polish list" over "just the date bug" on 2026-09-20.

**Root cause (verified against `main` at #44, 2026-09-20).** `ChoreForm.tsx`'s
`handleSubmit` builds `dateLastCompleted: new Date(formData.dateLastCompleted)` from the
`<input type="date">`'s bare `yyyy-mm-dd` string. Per the ECMAScript date-only form, `Date`
parses that as **UTC midnight**. Every consumer then does
`differenceInDays(startOfDay(today), startOfDay(chore.dateLastCompleted))` (`choreSort.ts`
line 5, `ChoreTimerBar.tsx` line 26 → `computeBar` + `CompletionInfo`'s "N days ago") with
**local** `startOfDay` — in any timezone behind UTC (the household's), UTC midnight is
still the *previous* local day, so the chore is one day older everywhere: "1 day ago" on a
same-day add, one day lower in the sort, one day closer to orange/red. The **mirror bug**
sits in `choreToFormState`: `chore.dateLastCompleted.toISOString().slice(0, 10)` puts the
*UTC* calendar date into the edit form, so a completion made in the evening (`new Date()`
from a bar tap, a real instant) opens for edit showing *tomorrow's* date — and saving the
edit unchanged would then move the chore forward a day. Nothing else is wrong:
`completeChore` sends a real instant, the backend stores `toISOString()` and hands it back
as an ISO string the client re-hydrates as the same instant.

**Design (settled with the user 2026-09-20):**
1. **Date-math fix — at the form boundary only, both directions.** Two tiny helpers (in
   `ChoreForm.tsx` or a `utils/formDate.ts`): `parseFormDate(str) =
   parse(str, 'yyyy-MM-dd', new Date())` (local midnight of that calendar day) and
   `formatFormDate(date) = format(date, 'yyyy-MM-dd')` (local calendar date). `handleSubmit`
   and `choreToFormState` use them. **Do not** touch the `daysSince` expressions,
   `computeBar`, `orderChores`, `completeChore`'s `new Date()`, `choreApi`'s hydration or
   the backend — the stored value is still an instant; only which instant the form means
   changes. Tests pin it under a behind-UTC *and* an ahead-of-UTC `TZ` (Vitest:
   `process.env.TZ = 'America/New_York'` at the top of the file, or a dedicated test file
   per zone — `TZ` must be set before the first `Date` construction in that worker; record
   the mechanism in the plan), asserting a same-day add yields `daysSince === 0` in
   `ChoreTimerBar` and that an evening-instant chore round-trips through the edit form
   unchanged.
2. **Last Completed defaults to today in add mode.** `initialFormState` becomes a function
   (or `useState` initializer) that sets `dateLastCompleted: formatFormDate(new Date())`
   when `mode === 'add'`; edit mode keeps `choreToFormState(initialChore)`. The post-submit
   reset in add mode re-applies the default (not `''`). The field stays `required` and
   *not* `clearable` (Standing invariant 10).
3. **Room defaults to the active room tab in add mode.** `ChoreForm` (and
   `ChoreFormModal`) gain `defaultRoom?: string`; `App.tsx` passes
   `selectedRoom === 'all' ? '' : selectedRoom` to the *add* modal only. The `<datalist>`,
   its `ClearButton` (`"Clear Room"`) and the `pr-14` reservation are unchanged; clearing a
   pre-filled room behaves exactly like clearing a typed one. Edit mode ignores
   `defaultRoom`.
4. **Success feedback + one toast surface** (chosen over `sonner` — no new dependency on
   the kiosk bundle — and over a green variant of the existing top banner, which shifts
   the list). New `frontend/src/components/common/Toast.tsx`:
   `{ tone: 'success' | 'error'; message: string; onDismiss: () => void }`,
   `data-testid="toast"`, `role="status"` + `aria-live="polite"`, a bottom-centred pill
   **positioned against the viewport/frame — never inside `.overflow-y-auto`** (that element
   keeps its exact class list; `App.search.test.tsx` locates it by class), sitting above
   F5's deck footprint **plus** its 4 rem overhang (Standing invariant 12 — reuse/share
   `F18`'s bottom-offset constant if `F18` has landed; `F18`'s button stays bottom-*right*,
   the toast is bottom-*centre*, so they never overlap), `z-[80]` so the lock overlay
   (`z-[90]`) and blank overlay (`z-[100]`) still paint over it. **Success tone** (green,
   `bg-green-600`-ish, white text) auto-dismisses after `TOAST_MS ≈ 2500` (a named
   constant) — "Added «name»" / "Saved «name»" / "Deleted «name»", raised from
   `handleAddChore` / `handleEditChore` / `handleDeleteChore` **on the resolved request
   only** (after `await addChore` / `updateChore` / `removeChore`), never on the
   optimistic update, so a rolled-back mutation shows the error, not a success. **Error
   tone** (red) **replaces the red top-of-page error strip** in `App.tsx` — same `error`
   state and messages, a ✕ / tap-to-dismiss, **no auto-dismiss** (a kiosk failure must be
   seen), and the next successful mutation replaces it. One toast at a time: new replaces
   current (a single `toast: { tone, message } | null` state, timer cleared on replace/
   unmount). Toast state is *not* user input — it is **not** added to `isRepullGated()`.
   The toast renders under `F20`'s permissive lock (Add Task is allowed while locked) and is
   hidden by blank's `inert` app root exactly as today's strip is.

**Rank rationale.** ★FOCUS since 2026-09-20 (batch close). The only *bug fix* in the batch,
user-reported, and small; it also removes the "inherited UTC off-by-one" caveat from
`F16`'s and `F17`'s risk lists, so running it first simplifies both.

**Effort: S–M.** Two helpers + two defaults in `ChoreForm.tsx`; a ~40-line `Toast.tsx`;
`App.tsx` swaps the strip for the toast and adds three success calls plus one prop; the
TZ-pinned tests are the only part needing care. No backend, data, sort or route change.

**Dependencies.** None. Soft: if `F18` has landed, share its deck-clearance constant; if
`F20` has landed, add the "success toast shows for an add made while locked" test.

**Assumed starting state** = **Baseline**. Verify:
- `ChoreForm.tsx` submits `new Date(formData.dateLastCompleted)` and `choreToFormState`
  uses `toISOString().slice(0, 10)`; `initialFormState.dateLastCompleted === ''` and
  `.room === ''`; `date-fns` (^4.1.0) is already a frontend dependency.
- `App.tsx` renders the `error` strip (`bg-red-700 … Dismiss`) above `NavBar`;
  `handleAddChore` already calls `setShowForm(false)` on success (follow-up #2 — no change).
- No toast/snackbar component or dependency exists in `frontend/`.

**Expected end state** (repo-checkable):
- `ChoreForm.tsx` (or `utils/formDate.ts`) exports/uses `parseFormDate` / `formatFormDate`
  built on `date-fns` `parse` / `format`; no `new Date(<string>)` or
  `toISOString().slice` remains in the form.
- Add-mode form opens with Last Completed = today's local date and Room = the active room
  tab (blank under *All*); edit mode shows the chore's own local date and room.
- `components/common/Toast.tsx` exists; `App.tsx` has no `bg-red-700` strip; add/edit/
  delete success each raise a green toast; every former `setError` path raises the red
  toast; the `.overflow-y-auto` container's class string is unchanged.
- Tests: `ChoreForm.test.tsx` — same-day add emits local midnight (TZ-pinned), evening
  instant round-trips through edit, add-mode defaults (date = today, room = `defaultRoom`,
  blank when `''`), post-submit reset re-applies the date default; `Toast.test.tsx` — tone
  classes, auto-dismiss on success (fake timers), no auto-dismiss + dismiss control on
  error, `role="status"`; `App.test.tsx` — the three success toasts, error toast replaces
  the strip assertions, toast is not a descendant of `.overflow-y-auto`, F5 deck tests
  still pass unchanged; `ChoreTimerBar.test.tsx` — a chore whose `dateLastCompleted` is
  today's local midnight renders "0 days ago" under a behind-UTC `TZ`.
- README: the form's defaults + the feedback toast get one line each; the "N days ago"
  wording is unchanged.
- e2e: `e2e/smoke.spec.ts`'s `+ Add Task` flow still passes (it types a date; the default
  must not break `fill`).

**Open risks / decisions.** (a) **TZ in Vitest:** `process.env.TZ` is honoured by Node only
if set before the first `Date` use in the worker — set it at the very top of the test file
(before imports that construct dates) or via `vitest.config` `env`/a setup file per pool;
verify the assertion actually fails on the pre-fix code in a behind-UTC zone before trusting
it. (b) `parse` with an empty string (the form is `required`, but defensive) returns
`Invalid Date` — keep the field `required` and let the browser gate submit; do not add a
second validation layer. (c) **Existing data:** rows created through the old form carry the
UTC-midnight instant; after the fix they still read as one day early (the stored instant is
what it is). Decide in-plan whether to leave them (they self-correct on next completion —
recommended) or add a guarded one-off `db.ts` migration shifting date-only-midnight-UTC
rows; the Baseline's migration convention applies if so. (d) **Toast vs. the modal:** an
add's success toast fires as the modal closes; the toast portal/fixed position must not be
inside the modal. (e) **Delete toast timing:** delete is optimistic; the toast fires after
`removeChore` resolves — fine, it is ~instant on the LAN. (f) Screen-reader double
announcement (the modal closing + the toast) is acceptable. (g) `ReturnToTodayButton`/day
simulation: the add-mode date default is the *real* today, not `simulatedDate` — a chore
added while simulating gets today's real date (state the choice in the README line).

**Session loop.** Run the Per-Feature Session Contract on branch
`feature/form-polish-date-fix`.

---

## Chain integrity (remaining work, current numbering, incl. `F15`–`F21`)

```
CHORE-LIST TRACK (re-opened 2026-09-20; F14 shipped #34, F4 shipped #38, F5 shipped #39 — the 2026-07-08 order F14 → F4 → F5 is honored by history)
  ★ F21 (add/edit form polish + UTC-vs-local date-math fix + success/error toast) — no prerequisites, ★FOCUS, runnable now
    ─soft→ F16 (status-bucketed midnight re-sort + red-quota escalation + Urgency weighting) — no prerequisites; F21 first retires the off-by-one it would inherit
    ─soft→ F17 (status-count strip under the room tabs) — no prerequisites; shares F16's status classifier
    ─soft→ F18 (floating scroll-to-top button) — no prerequisites; must clear the F5 deck
    ─soft→ F20 (permissive touch lock, reworks shipped F2) — no prerequisites; drops the lock's inert gate; exposes the idle tick
    ─soft→ F19 (lock-time view reset) — no prerequisites; keyed off the lock signal + F20's idle tick; shares F18's container ref

KIOSK EXTRACTION TRACK (2026-07-15 — external gates; see plans/feature/kiosk-shell-extraction/)
  [pi-kiosk Phase 1: shell scaffold + iframe passthrough]
  [pi-kiosk Phase 2: agent activity feed + overlay port, parity on the Pi] ──► F15 (adopt kiosk-shell)
      (F15 removes the shipped F1 overlay and moves the lock's timer/state/indicator to the shell —
       Standing invariants 8–9 hold until then; after F20 the in-app guard + padlock STAY and the
       lock half rides the Phase-4 kiosk/v1 contract — F15 may split; see its Open risks (f))
  [pi-kiosk Phase 3: console + agent controls  ·  absorbs F3/F7/F8/F10/F13 — superseded here]
  [pi-kiosk Phase 4: settings (absorbs F9) + kiosk/v1 contract] ──► F11 (undo) ─→ F12 (redo)

INFRA TRACK (complete; F6 shipped #43 — the LAN alias c4i.local / c4i is live; see F15's Open risks (d) for pi-kiosk's target_url)
```

- **No hard chain remains inside this repo.** The old device-control edge (`F3` gates
  `F7`–`F13`) left the repo with the migration — pi-kiosk's Migration Phases carry that
  sequencing now. What remains here: the chore-list track holds six ungated items (`F21`
  ─soft→ `F16` ─soft→ `F17` ─soft→ `F18` ─soft→ `F20` ─soft→ `F19`; its earlier soft `F14` → `F4` → `F5` preference of 2026-07-08 was honored — #34, #38,
  #39), and two **external** gates (`F15` on pi-kiosk Phase 2 parity; `F11`/`F12` on Phase
  4's `kiosk/v1` contract, with `F12` also following `F11`). The infra track completed with
  `F6` (#43).
- **Focus path:** `F21` — ★FOCUS, ungated, the next session (`/run-feature F21`). Then
  `F16`, `F17`, `F18`, `F20`, `F19` in soft order. `F15` is the gated kiosk-track head
  (pi-kiosk Phase 2 parity) and takes the ★ back once the chore-list items are gone;
  `F11`/`F12` follow on Phase 4. The 2026-09-20 capture batch is closed — no deferred
  re-evaluation remains.
- **Cross-feature couplings to honor:**
  - **F21 ↔ `daysSince` consumers (F16, F17, `ChoreTimerBar`):** `F21` changes *which
    instant the form means* (local midnight in, local calendar date out) and nothing else
    — `choreSort.ts`, `ChoreTimerBar.tsx`, `computeBar` and `F16`/`F17`'s shared classifier
    keep the same `differenceInDays(startOfDay(today), startOfDay(date))` expression. No
    consumer may "fix" the off-by-one in-band (e.g. by adding a UTC `startOfDay`) — that
    would double-correct once `F21` lands.
  - **F21 ↔ F5 / F18 (bottom real estate, Standing invariant 12):** the toast is fixed
    against the frame, bottom-*centre*, above the deck + 4 rem overhang; `F18`'s button is
    bottom-*right* at the same clearance. Whichever lands second reuses the first's
    clearance constant; neither lives inside `.overflow-y-auto`.
  - **F21 ↔ F20 (lock):** Add Task is allowed while locked, so its success toast shows
    under the lock (the toast never reads `isLocked`); it paints below the padlock
    (`z-[80]` < `z-[90]`) and below blank.
  - **F21 ↔ SSE gate (Standing invariant 5):** toast state is not uncommitted user input —
    it must **not** be added to `isRepullGated()`; a re-pull while a toast is showing is
    fine.
  - **F21 ↔ F11/F12:** an undo/redo is a mutation like add/edit/delete — whether it
    raises a toast is `F11`'s call (recommended: "Undone «name»" via the same component).
  - **F21 ↔ F2-L kept contract:** `F21` is the last feature targeting it — delete the
    `F2-L` entry under Completed-Feature Contracts at `F21`'s fold-back.
  - **F16 ↔ F17 ↔ `computeBar`:** both classify red/orange/green with the *same*
    function/threshold the bar uses — one shared `classifyStatus` helper extracted from
    `computeBar`, never a copied literal — so a future change to the bar model moves the
    sort and the strip with it. Whichever of F16/F17 runs first extracts it.
  - **F17 ↔ F16 (trigger asymmetry, deliberate):** the strip is *live* (derived from
    `choreData` on every render); the list *order* is midnight-only. A completed chore
    therefore turns green and moves into the strip's green segment immediately while
    staying in place in the list until midnight — that is the intended feel, not a bug.
  - **F17 ↔ F11/F12:** an undo/redo changes `dateLastCompleted`, so the strip's counts
    move with it live, exactly like a completion.
  - **F18 ↔ F5 (Standing invariant 12):** the button floats against the scroll region's
    *frame*, never inside `.overflow-y-auto` (that element stays the single scroller and
    keeps its class — `App.search.test.tsx` locates it by it); it sits above the deck's
    footprint **plus** the 4 rem overhang so it is never under the frost; the deck keeps
    "no z-index" — later-in-DOM positioning is enough. Any change to the deck height or
    overhang re-checks the button's `bottom` alongside `scroll-pb-*`.
  - **F18 ↔ swipe bars (F10-L):** a floating control over the right end of a bar can
    steal the start of a swipe-left (edit); keep the footprint small, bottom-right, and
    verify a swipe that begins under the button still reaches the bar or is cleanly
    ignored — never fires the button *and* the swipe.
  - **F20 ↔ F2 (Standing invariant 9):** `F20` *amends the shipped contract* — same
    hook, overlay and indicator files, same 5-min timer, same 1500 ms / 60 px double-tap
    window, same blank precedence; what changes is *when* the overlay shows (on a blocked
    attempt only), *what* is blocked (complete / edit / delete only), the `inert` gate
    (blank-only afterwards), the indicator (a single-tap lock/unlock control) and the timer
    (runs while locked). Invariant 9 and the `F2` kept-contract section are rewritten to
    `F20`'s as-built shape when it ships.
  - **F20 ↔ F19 (idle tick):** `F20` keeps the inactivity timer running while locked and
    exposes each expiry; `F19` re-runs its reset on every tick (and on a manual lock from
    the indicator, which is an engage). Soft order `F20` → `F19`; if reversed, `F20`
    re-keys `F19`'s effect.
  - **F20 ↔ F18:** scrolling is allowed while locked, so `F18`'s button must work under
    the lock (no `inert`, no guard) — a test in whichever runs second.
  - **F20 ↔ F10-L swipe infra (Standing invariant 3):** the lock guard mirrors the
    `isSimulating` early-returns in `ChoreTimerBar`'s swipe callbacks; bars do not move
    while locked, `swipingRef` click-suppression stays, and no dimming classes are added
    for the locked state.
  - **F20 ↔ F5 / F14 / F9-L (allowed surfaces):** Add Task (deck button + form + submit),
    the search input + its clear-✕, and the room tabs all work while locked — none of them
    may read `isLocked`.
  - **F20 ↔ F15 / pi-kiosk (cross-repo):** `F20` retires DD-2's all-input-blocking shell
    overlay. Split after `F15`: shell = timer + lock state + indicator control; app = guard
    + padlock + second-tap detection + `F19`'s reset. Messages: `kiosk-state { locked }` +
    an idle tick in, `lock-request { locked }` out — `kiosk/v1`, Phase 4 (`F15` Open risks
    (f)). The parity checklist for the lock half is `F20`'s contract.
  - **F20 ↔ F11/F12:** independent — undo/redo are console actions on chore data; whether
    the shell's console is reachable while locked is a pi-kiosk decision, not this repo's.
  - **F19 ↔ F2 (Standing invariant 9):** `F19` is keyed directly off `useTouchLock`'s
    `isLocked` *engage* transition (plus `F20`'s idle tick once present) — never unlock,
    never blank. It adds app-side meaning to "locked" beyond the `inert` gate; the lock
    contract itself (timer, double-tap unlock, z-order) is untouched by `F19` (it is
    `F20` that amends it).
  - **F19 ↔ F15 (cross-repo principle):** *the kiosk owns the inactivity timer; the app owns
    what "locked" means for it.* When `F15` removes the `F2` overlay/timer, it must keep an
    app-side `isLocked` state fed by the shell (`kiosk/v1` `kiosk-state { locked }`, DD-3 —
    or an interim source until Phase 4; `F15` Open risks (e)) and re-key `F19`'s reset to
    it. A `locked` signal does not mean "no interaction possible", only "certain actions are
    guarded"; pi-kiosk's shell must therefore forward the lock state to the app, not merely
    overlay it.
  - **F19 ↔ F18 (shared ref):** one `ref` on the `.overflow-y-auto` element serves both —
    whichever runs first creates it; `F19`'s `scrollTop = 0` also hides `F18`'s button.
  - **F19 ↔ F17:** resetting room → All and search → '' widens the visible list, so the
    strip's counts jump to the whole-board figures on lock — live, as designed.
  - **F19 ↔ F16 (re-sort rule):** the day → today reset re-sorts *only* when a simulation
    was active (it is a day-simulation step, the same path as Return-to-today); a lock with
    `dayOffset === 0` never re-sorts — "unblank/lock never re-sorts" still holds for the
    normal case.
  - **F19 ↔ F11/F12:** independent — the reset touches view state only, never chore data,
    so it is not an undoable action and must not enter the undo cache.
  - **F16 ↔ F11/F12:** an undo that restores an earlier `dateLastCompleted` is a mutation
    like any other — it does **not** re-sort (sticky order until midnight); the undone
    chore keeps its position and its bar simply re-colours.
  - **F16 ↔ F2-L follow-up #4 (UTC date-math) = `F21`:** same `daysSince` expression;
    `F16` must not fix it in-band or widen it — `F21` fixes it at the form boundary, and
    the soft order puts `F21` first.
  - **F16 ↔ F15:** independent. "Unblank never re-sorts" is a chores4irl fact that holds
    whether the blanking is the in-app `F1` overlay or the pi-kiosk shell.
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
- Cumulative invariants that must hold from each feature onward:
  - From **F1**/**F2** *(shipped — Standing invariants 8–9)*: blank + lock contracts as
    recorded under Completed-Feature Contracts; **held until `F15` relocates the behavior to
    pi-kiosk**, at which point they are retired-as-relocated, not regressed.
  - From **F15**: the app is embeddable (no frame-blocking headers — documented in
    `nginx.conf` + README) and contains no kiosk/screen code; it works identically
    standalone at `IP:port` and inside the pi-kiosk shell.
  - From **F11**: bounded undo cache; undo emits on the SSE bus. From **F12**: redo pairs
    with F11's cache.
  - From **F21**: the form parses and formats `dateLastCompleted` as a *local* calendar
    date (a same-day add is `daysSince === 0` in every timezone; an instant round-trips
    through the edit form unchanged); add mode opens with Last Completed = today and Room
    = the active room tab; add/edit/delete success and every error surface through the
    single bottom-centre `Toast` (success auto-dismisses, error persists until dismissed);
    there is no top-of-page error strip; toast state is outside the SSE re-pull gate.
  - From **F16**: list order is a status-bucketed, quota-filled ordering that (i) classifies
    status with the bar's own thresholds, (ii) ranks reds monotonically by urgency-scaled
    overdue ratio, (iii) shows most-recently-completed greens first, (iv) escalates the red
    quota deterministically with neglect, and (v) still changes only at midnight /
    day-simulation — never on completion, SSE re-pull or unblank.
  - From **F17**: a status-count strip sits under the room tabs showing done-today /
    due-soon / overdue for the visible (room ∧ search) list, widths ∝ counts, bar-colour
    tokens, live from `choreData`, all-zero → full green `0`.
  - From **F18**: a floating scroll-to-top control exists, hidden and non-interactive at
    the top of the list, visible once scrolled, always clear of the F5 deck + overhang;
    the boot/unblank view is pixel-identical to pre-F18.
  - From **F19**: the touch-lock *engage* transition (and, with `F20`, every idle expiry
    while locked and every manual lock) resets the view — list scrolled to the top
    (instantly), room → All, search cleared, day → today (re-sorting only if a simulation
    was active); never on unlock, never on blank alone. The app-side `isLocked` signal
    this keys off must survive `F15` (re-sourced from the shell, not deleted).
  - From **F20**: the lock is permissive — the padlock overlay appears only on a blocked
    complete / edit / delete (bars inert to tap and swipe, never dimmed); scroll, search,
    room tabs, day simulation and Add Task (incl. submit) work while locked; the app root
    is `inert` for blank only; the blocked tap counts as the first of the 1500 ms / 60 px
    double-tap and the second tap unlocks without acting; the top-left indicator is a
    ≥ 44 px single-tap lock/unlock control; the 5-min timer runs while locked and exposes
    an idle tick; blank still wins over the padlock. This — not `F2`'s original — is what
    `F15`/pi-kiosk reproduce.
  - From **F6** *(shipped — Standing invariant 13)*: the Pi is `c4i`, reachable by
    `c4i.local` / `c4i`; IP:port still works; nothing in the app is name-aware.
  - **Already holding (legacy, unchanged):** delete-confirm, `PUT`/edit, swipe infra
    (now edit-left/delete-right + 25% reveal), shorter grid bar, SSE re-pull gate, Room
    `<datalist>`, persistent name-search filter, clear-✕ on search/Name/Room with
    opt-in `clearable` on `FormField` (F14, #34 — Standing invariant 10), and no
    `details`/`longTermTask` anywhere in the live model (`app.ts`, `chores.ts`,
    `SharedTypes.d.ts`, non-test frontend) with the idempotent `dropLegacyChoreColumns`
    boot migration in `db.ts` (F4, #38 — Standing invariant 11), and the frosted sticky
    Add-Task deck inside the scroll region with its masked fade-in backing, opaque button
    and `scroll-pb-40` focus clearance (F5, #39 — Standing invariant 12).

> If any session's cold survey finds the repo does **not** match its assumed start, **stop
> and reconcile** before planning. The repository is the single source of truth across
> sessions; this file records the *intended* order and must be updated in-PR whenever the
> actual order diverges.
