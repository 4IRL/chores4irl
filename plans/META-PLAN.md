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
> (`F14`, `F15`, `F16`, `F17`, `F18`, `F19`, `F20`, `F21`, `F22`, …) in ledger order. Features completed *before* that reconcile keep their
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

**Current focus: `F20` — permissive touch lock** (★, ungated, runnable now;
`/run-feature F20`, branch `feature/permissive-lock`) — see *Shortest path to the focus
feature* below. *(Advanced 2026-09-23 at `F22`'s fold-back (#57): `F22` held the ★ from
`F18`'s fold-back (#55); with it shipped, the ★ moves to the next item in the chore-list
soft order `F22` → `F20` (`F19`, originally after `F20`, shipped #56 ahead of it), which
has zero prerequisites. `F15` — the ★ before `F21`
— stays **gated** on external pi-kiosk Phase 2 parity as the kiosk-track head. `F19`'s
fold-back did not move the ★ — `F19` shipped without holding it.)*
**`F20` (permissive touch lock), added 2026-09-20 via `/new-feature`, is the feature in
this repo that is runnable today** — zero prerequisites, chore-list track. (`F21` — the batch's bug fix —
shipped #46 and retired the off-by-one caveat; `F16` — the status-bucketed midnight
re-sort — shipped #50 and left the shared `classifyStatus(daysSince, frequency)` in
`utils/choreBarMath.ts`; `F17` — the status-count strip — shipped #52 between `NavBar` and
the date banner; `F18` — the floating scroll-to-top button — shipped #54 and left the
single `scrollRegionRef` on the scroller plus the positioned `scroll-region-frame` around
it; `F22` — the fading overlay scrollbar + full-bleed scroll region — shipped #57, hid the
native scrollbars behind indicator-only overlay thumbs in that frame and in the form card,
and moved the outer column's `px-4` onto the header rows and list content so the `F5`
frost reaches both screen edges; `F19` — the lock-time view reset — shipped #56 as one
lock-engage effect in `App.tsx` keyed off `isLocked` alone (Standing invariant 19), which
`F20` must re-key to its idle tick; `F20` reworks the shipped `F2` lock into a *permissive*
lock — padlock only on a blocked complete/edit/delete, everything else usable — and
exposes the idle-expiry tick the shipped `F19` reset must then also fire on; together they hand `F15` a re-sourcing
obligation and reshape pi-kiosk's DD-2; see *Cross-feature couplings*.) The capture batch
is **closed** — further ideas enter one at a time via `/new-feature`, each re-evaluating
the ★ on its own; `F22` was the first such single add (later on 2026-09-20).

**Shipped through PR #57** — merged work is recorded by git, not re-tabulated here
(`gh pr list --state merged` / `git log --oneline main`). Since #32: #33, #35, #36, #37,
#40, #41, #42, #44, #45, #47, #48, #49, #51, #53, #55 and #59 were docs/skills-only (META-PLAN reconciles and
fold-backs, the replacement of the `plans/*-PROMPT.md` templates by the `/run-feature`,
`/worktree`, `/compact-plans` skills, and plans sweeps); the app-code merges are **#34 —
`F14`, the clear-✕ affordance** (Standing invariant 10), **#38 — `F4`, the removal of the
*Details* / *Long-term task* fields plus the first `db.ts` boot migration** (Standing
invariant 11), **#39 — `F5`, the frosted sticky *Add Task* deck** (Standing invariant 12),
**#46 — `F21`, the form-boundary date-math fix + add-mode defaults + the feedback `Toast`**
(Standing invariant 14), **#50 — `F16`, the status-bucketed quota sort with red-quota
escalation + Urgency weighting over the shared `classifyStatus`** (Standing invariant 15),
**#52 — `F17`, the live status-count strip under the room tabs** (Standing invariant
16), **#54 — `F18`, the floating bottom-centre scroll-to-top button plus the shared
`scrollRegionRef` + positioned `scroll-region-frame` around the list scroller** (Standing
invariant 17, with its frame and toast-line clauses in invariants 12 and 14), **#56 —
`F19`, the lock-time view reset: one lock-engage effect in `App.tsx` returning the view to
top / All / no search / today** (Standing invariant 19), and **#57 —
`F22`, the fading indicator-only overlay scrollbar on the list and the form card plus the
full-bleed scroll region** (Standing invariant 18, with its clauses in invariants 12, 14
and 16); the one
deploy-side merge is **#43 — `F6`, the LAN name `c4i` / `c4i.local`** (no app code;
`deploy/pi/set-hostname.sh` + a cloud-init drop-in + deploy docs — Standing invariant 13),
all now folded into the Baseline below. With `F6` the **infra track is
complete**; the chore-list track, re-opened by the 2026-09-20 batch, has one ungated item
left (`F20`) after `F21`, `F16`, `F17`, `F18`, `F19` and `F22`. What each merge left behind that still matters
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

### Remaining work — three tracks (current numbering, incl. `F15`–`F22`)

```
Chore-list track (re-opened 2026-09-20 by F16–F22; no prerequisites — runnable now):
  ★ F20 (permissive touch lock: padlock only on blocked complete/edit/delete; indicator = lock/unlock control, M)  [FOCUS]
                 [reworks shipped F2; drops the lock's inert gate; timer runs while locked → idle tick; re-keys shipped F19's reset to it]
    (earlier: F14 — clear-✕ on free-text inputs — shipped #34; F4 — remove Details/Long-term — shipped #38;
     F5 — frosted Add-Task deck — shipped #39; F21 — form date-math fix + defaults + Toast — shipped #46;
     F16 — status-bucketed midnight re-sort + red-quota escalation + Urgency weighting — shipped #50;
     F17 — status-count strip under the room tabs — shipped #52;
     F18 — floating scroll-to-top button + shared frame/ref — shipped #54;
     F19 — lock-time view reset (top / All / search cleared / today on lock-engage) — shipped #56;
     F22 — fading overlay scrollbar + full-bleed scroll region — shipped #57)

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

- **Chore-list track: re-opened by `F16`–`F22`; `F21`, `F16`, `F17`, `F18`, `F19` and `F22` shipped.** `F14` (#34), `F4` (#38) and `F5` (#39) shipped
  in the user's 2026-07-08 order (`F14` → `F4` → `F5`); the shared `ChoreForm` carries
  exactly Name (`clearable`), the Room `<datalist>`, Last Completed, Duration, Frequency and
  the Urgency `<select>`, and the *Add Task* deck is the frosted sticky surface recorded in
  Standing invariant 12. **`F21`** (added 2026-09-20, the batch's only *bug fix*) shipped
  #46 on 2026-09-22 and now lives in the Baseline + Standing invariant 14: the form parses
  and formats `dateLastCompleted` as a *local* calendar day (`utils/formDate.ts`), add mode
  opens with *Last Completed* = today and *Room* = the active room tab, and every mutation's
  success/failure surfaces through the bottom `Toast` (the red top-of-page error strip is
  gone). **`F16`** (added 2026-09-20) shipped #50 on 2026-09-22 and now lives in the
  Baseline's **Sort** paragraph + Standing invariant 15: `orderChores` buckets chores
  red/orange/green through the bar's own `classifyStatus`, ranks within each bucket, and
  fills an 8-slot fold 4/2/2 whose red quota escalates with urgency-weighted neglect.
  **`F17`** (added 2026-09-20) shipped #52 on 2026-09-23 and now lives in the Baseline's
  `StatusCountStrip` Key-UI bullet + Standing invariant 16: a thin always-visible segmented
  strip between `NavBar` and the date banner tallies done-today / due-soon / overdue for the
  *visible* list, live, through the shared `classifyStatus` and `STATUS_BAR_COLOR`.
  **`F18`** (added 2026-09-20) shipped #54 on 2026-09-23 and now lives in the Baseline's
  `ScrollToTopButton` Key-UI bullet + Standing invariants 12, 14 and 17: an opaque 44 px
  button floats bottom-centre over the list at the `F21` toast's `bottom-40` line (a toast
  covers it while shown), fades in once the scroller passes 80 px and scrolls it back to
  the top; it also created the single `scrollRegionRef` on the `.overflow-y-auto` scroller
  and the positioned `scroll-region-frame` around it that `F22`'s thumb reuses and `F19`'s
  reset writes to.
  **`F19`** (added 2026-09-20) shipped #56 on 2026-09-23 and now lives in the Baseline's
  `App.tsx` Key-UI bullet + Standing invariant 19 (and its kept contract under
  Completed-Feature Contracts, because `F20` and `F15` target it): when `F2`'s touch lock
  engages, one effect in `App.tsx` keyed directly off `isLocked` (the user's choice over an
  app-owned idle timer) scrolls the list to the top instantly through `F18`'s
  `scrollRegionRef`, returns the room tab to *All*, clears the search and puts the day
  simulator back on today — so whoever next walks up to the wall meets the canonical boot
  view behind the padlock. It is the first feature to give "locked" an *app-side meaning*
  beyond `inert`, which sets the principle `F15` must honor: **the kiosk owns the
  inactivity timer; the app owns what "locked" means for it** (see `F15`'s Open risks (e)).
  **`F22`** (added later on 2026-09-20, after the batch closed) shipped #57 on 2026-09-23 and
  now lives in the Baseline's `OverlayScrollbar` Key-UI bullet + Standing invariants 12, 14,
  16 and 18: the native scrollbars on the list and on the Add/Edit form card are hidden
  (`scrollbar-none`) behind an indicator-only thumb that shows on `scroll` and fades 1 s
  after the last one; the list's thumb sits in `F18`'s frame (before the button) and ends
  level with the last chore bar at full scroll; the outer column's `px-4` moved onto the
  header rows and `ChoreList`, so the scroll container and the `F5` frost run edge to edge.
  `F19`'s programmatic lock-time `scrollTop = 0` fires a native `scroll`, so the list's
  thumb flashes on lock — accepted, no programmatic flag.
  **`F20`** (added 2026-09-20; ★FOCUS since `F22`'s fold-back) is now the track's head. It makes that principle concrete by reworking the shipped `F2`
  lock into a **permissive lock**: the padlock overlay appears *only* when a disallowed
  action is attempted — completing (single tap), edit/delete (swipes; bars don't move) —
  while scrolling, search, room tabs, day simulation and Add Task (incl. submit) stay usable;
  the app root drops its `inert` gate for the lock (blank keeps it). Two unlock paths: the
  blocked tap counts as the first of the existing double-tap, and the top-left indicator
  becomes a single-tap lock/unlock control (manual lock without waiting 5 min). The
  inactivity timer keeps running while locked, exposing an idle tick, and `F20` re-keys the
  shipped `F19` reset to fire on every tick and on a manual lock, closing an Add modal left
  open under the lock first (Standing invariant 19; `F19` kept contract). It
  retires pi-kiosk DD-2's "shell overlay blocks all input" shape: the shell will own the
  timer + state + indicator control, the app the guard + padlock (`F15` Open risks (e)/(f)).
- **Kiosk extraction track (replaces the device-control panel track):** the console and
  its hardware controls (`F3`, `F7`, `F8`, `F9`, `F10`, `F13`) migrated to
  `rehankalu/pi-kiosk` — no chores4irl session runs them; the sequencing now lives in the
  design doc's Migration Phases. What stays here: `F15` (adopt kiosk-shell — an ordinary
  chores4irl feature, gated on the **external** pi-kiosk Phase 2, removing the shipped
  `F1` overlay code and the lock's *timer/state/indicator*; Standing invariants 8–9 hold
  until then — and, since `F19` has shipped (and once `F20` has), re-sourcing the lock signal from the
  shell's `kiosk-state { locked }` message and sending `lock-request` back rather than
  deleting the app-side lock semantics outright), and `F11`/`F12`
  (app-data undo/redo, re-scoped onto the `kiosk/v1` contract, gated on the external
  Phase 4).
- **Infra track: complete.** `F6` (#43) renamed the Pi to `c4i`, so the app answers at
  `http://c4i.local/` (mDNS) and `http://c4i/` (router DNS) — Standing invariant 13 and
  the Baseline's *Deployment* paragraph record the mechanism. Its alias is the natural
  `target_url` for pi-kiosk (see `F15`'s Open risks (d)).

### Shortest path to the focus feature (`F20`)

**`F20` is the current ★FOCUS — ungated, runnable now.** Advanced 2026-09-23 at `F22`'s
fold-back (#57): `F22` had taken the ★ at `F18`'s fold-back (#55) and shipped the fading
indicator-only overlay scrollbar on the list and the form card plus the full-bleed scroll
region (Standing invariants 12, 14, 16 and 18); with it merged, the next item in the
chore-list soft order `F22` → `F20` — `F20`, zero prerequisites — is the
unambiguous next step. Path: `/run-feature F20` on branch `feature/permissive-lock` — no
prerequisites; it amends the shipped `F2` contract (Standing invariant 9), must keep the
shipped `F18` button usable under the lock (Standing invariant 17), leaves `F22`'s
thumbs untouched (they read no lock state — Standing invariant 18), and re-keys the
shipped `F19` reset (#56, the soft-order item originally after `F20`, which ran ahead of
it) to its idle tick + manual lock with the close-Add-modal step 0 (Standing invariant 19
and the `F19` kept contract; see *F20 ↔ the shipped F19 reset* under couplings). `F19`
shipped while `F22` held the ★ and did not move it. **Gated, not ★:** `F15` (kiosk-track head)
cannot start until pi-kiosk Phase 2 parity (blank window, wake-tap swallow, 5-min
re-blank, lock re-arm, double-tap unlock) is verified on the wall Pi and recorded in
`plans/feature/kiosk-shell-adoption/`; `/run-feature F15` must check that gate in its cold
survey and refuse — not proceed on a partial parity. `F11`/`F12` wait on pi-kiosk Phase 4.
Once every ungated chore-list item has shipped and the kiosk gates are still shut, the ★
returns to `F15` (gated) by the usual fold-back. `F6`'s alias is live — pi-kiosk's
`target_url` question now belongs to `F15`'s Open risks (d).

- **Do not** re-open the shipped chore-list items' scope — the *Details* / *Long-term task*
  fields are gone (#38, with the `db.ts` boot migration), the clear-✕ affordance shipped
  (#34), the frosted deck shipped (#39), the form-boundary date fix + add-mode defaults
  + feedback `Toast` shipped (#46), the status-bucketed quota sort shipped (#50), the
  status-count strip shipped (#52), the scroll-to-top button shipped (#54), the lock-time
  view reset shipped (#56), and the overlay scrollbar + full-bleed scroll region shipped
  (#57); Standing invariants 10–12 and 14–19 record all nine as verified-shipped facts
  (`F20`'s re-key of the `F19` reset is `F20`'s own scope, not a reopening of `F19`).
  Follow-up polish on any of them (e.g. the six minor push-review notes harvested for
  `F21`, `F16`'s, `F17`'s, `F18`'s, `F19`'s and `F22`'s push-review minors, on-Pi tuning of the `SORT_*`
  constants, or on-Pi tuning of the strip's height/contrast) enters via
  `/new-feature` (or, for the constants, a direct edit of `assets/constants.ts`), not by
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

### Remaining (current numbering, incl. `F15`–`F22`; reassessed against current `main` at the 2026-09-20 `/new-feature` reconciles — batch closed at `F21`; `F22` added singly the same day; `F21` shipped #46 on 2026-09-22, `F16` shipped #50 on 2026-09-22, `F17` shipped #52 on 2026-09-23, `F18` shipped #54 on 2026-09-23, `F19` shipped #56 on 2026-09-23 and `F22` shipped #57 on 2026-09-23, all leaving the table)

| Order | Feature | Effort | Depends on | Track |
|---|---|---|---|---|
| ★ 1 *(runnable now)* | **F20** — Permissive touch lock: padlock only on a blocked complete/edit/delete; scroll, search, rooms, day-sim, Add Task usable while locked; indicator = single-tap lock/unlock control **[FOCUS]** *(added 2026-09-20; reworks shipped F2)* | **M** | none hard; amends the shipped `F2` contract (Standing invariant 9) and re-keys the shipped `F19` reset to its idle tick + manual lock (Standing invariant 19) | Chore-list |
| 2 *(gated)* | **F15** — Adopt kiosk-shell: remove F1/F2 overlays + embeddability guarantee **[kiosk-track head — gated]** *(added 2026-07-15)* | **M** | **external:** pi-kiosk Phase 2 parity verified on the Pi | Kiosk extraction |
| 3 | **F11** — Undo *(re-scoped 2026-07-15 onto the `kiosk/v1` contract)* | **M–L** | **external:** pi-kiosk Phase 4 (`kiosk/v1` contract) | Kiosk extraction |
| 4 | **F12** — Redo *(re-scoped 2026-07-15)* | **M** | F11 + same external gate | Kiosk extraction |
| ~~—~~ | ~~**F3 · F7 · F8 · F9 · F10 · F13** — device-control console + its controls~~ | — | **superseded 2026-07-15** — migrated to pi-kiosk (shell console / agent controls / settings; `F13`'s plan harvested, see its banner) | *(migrated)* |

**Effort tally (remaining, in this repo).** Chore-list track: F20 (M=2) ≈ **2 pts**,
ungated. Infra track: **0 pts** (complete). Kiosk extraction track: F15
(M=2, re-check at planning — see below) + F11 (M–L≈2–3) + F12 (M=2) ≈ **6–7 pts**, all gated on external pi-kiosk phases.
Total ≈ **8–9 pts**. (S=1 / M=2 / L=3 / XL=5.) F15/F20/F11/F12 were re-checked
against `main` at #44 for `F21`'s add, and all of them again for `F22`'s: nothing
landed since their last estimate (same day), so their scores stand; `F21` itself shipped
#46 (2026-09-22) at its estimated S–M and left the tally; `F16` shipped #50 (2026-09-22) at
its estimated M and left it too; `F17` shipped #52 (2026-09-23) at its estimated S–M and
left it; `F18` shipped #54 (2026-09-23) at its estimated S and left it; `F19` shipped #56
(2026-09-23) at its estimated S and left it; `F22` shipped #57
(2026-09-23) at its estimated S–M and left it as well. `F15` stays **M** on paper but changes *shape*: after `F20` its lock
half is no longer "delete the overlay" — the in-app guard/padlock stays, and only the
timer, lock state and indicator control move to the shell over a `kiosk/v1` addition
(`kiosk-state { locked }` in, `lock-request { locked }` out) that pi-kiosk schedules for
**Phase 4**, not Phase 2. Its plan must decide whether to split (blank removal at Phase 2 /
lock hand-over at Phase 4) — Open risks (f). `F20` stays **M**: re-keying the shipped
`F19` effect to the idle tick + manual lock (with the close-Add-modal step 0) is one more
trigger on an existing effect plus two App-level tests.
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
| *(none — new, added 2026-09-20; bare `F16` is distinct from retired `F16-L` redo)* | **F16** — status-bucketed midnight re-sort with red-quota escalation + Urgency weighting *(shipped #50 — folded into Baseline **Sort** / Standing invariant 15)* |
| *(none — new, added 2026-09-20; bare `F17` is distinct from retired `F17-L` rotate)* | **F17** — status-count strip under the room tabs (done-today / due-soon / overdue, live, visible list) *(shipped #52 — folded into Baseline `StatusCountStrip` Key UI / Standing invariant 16)* |
| *(none — new, added 2026-09-20)* | **F18** — floating scroll-to-top button over the list (shown only once scrolled) *(shipped #54 — folded into Baseline `ScrollToTopButton` Key UI / Standing invariants 12, 14 and 17)* |
| *(none — new, added 2026-09-20)* | **F19** — lock-time view reset (on lock-engage + each idle expiry while locked: scroll to top, room → All, search cleared, day → today) *(shipped #56 — folded into Baseline `App.tsx` Key UI / Standing invariant 19; lock-engage only as built — the idle-tick trigger is `F20`'s to add; contract kept below for `F20`/`F15`)* |
| *(none — new, added 2026-09-20)* | **F20** — permissive touch lock (reworks shipped `F2`: padlock only on a blocked complete/edit/delete; scroll, search, rooms, day-sim, Add Task usable while locked; indicator = lock/unlock control) |
| *(none — new, added 2026-09-20; promotes the `F2-L` follow-up list of 2026-07-08)* | **F21** — add/edit form polish + date-math fix *(shipped #46 — folded into Baseline / Standing invariant 14; the `F2-L` kept contract it targeted was deleted with it)* |
| *(none — new, added 2026-09-20 after the batch closed)* | **F22** — fading overlay scrollbar + full-bleed scroll region (native scrollbar hidden; indicator-only overlay thumb on the list + form scroll box, shown while scrolling, fades ≈ 1 s after; outer `px-4` moved to header rows + list content so the container, deck backing and thumb reach the screen edges) *(shipped #57 — folded into Baseline `OverlayScrollbar` Key UI / Standing invariants 12, 14, 16 and 18)* |

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
| **F20 — permissive touch lock** ★FOCUS *(added 2026-09-20; reworks shipped F2)* | in-review | `feature/permissive-lock` | [#60](https://github.com/4IRL/chores4irl/pull/60) |
| F15 — adopt kiosk-shell *(added 2026-07-15; kiosk-track head)* | pending *(gated on external pi-kiosk Phase 2 parity)* | `feature/kiosk-shell-adoption` | — |
| F11 — undo *(re-scoped 2026-07-15: `kiosk/v1` contract)* | pending *(gated on external pi-kiosk Phase 4)* | `feature/undo` | — |
| F12 — redo *(re-scoped 2026-07-15)* | pending *(gated on F11 + same external gate)* | `feature/redo` | — |
| F3 · F7 · F8 · F9 · F10 · F13 — device-control console + controls | **superseded** *(2026-07-15 — migrated to pi-kiosk; branches never created)* | — | — |

**Branch/dir cleanup:** `F16` (#50, merged 2026-09-22), `F17` (#52, merged 2026-09-23),
`F18` (#54, merged 2026-09-23), `F19` (#56, merged 2026-09-23) and `F22` (#57, merged
2026-09-23) are the five outstanding sweeps — `plans/feature/status-bucketed-sort/`,
`plans/feature/status-count-strip/`, `plans/feature/scroll-to-top/`,
`plans/feature/lock-view-reset/` and `plans/feature/overlay-scrollbar/` (each plan + review +
push-review) await their `/compact-plans` freeze under `plans/completed/`, and their
non-blocking push-review minors (`reviews/push-review-feature-status-bucketed-sort.md`,
`reviews/push-review-feature-status-count-strip.md`,
`reviews/push-review-feature-scroll-to-top.md`,
`reviews/push-review-feature-lock-view-reset.md` and
`reviews/push-review-feature-overlay-scrollbar.md`; listed under *`F16` follow-ups*, *`F17`
follow-ups*, *`F18` follow-ups*, *`F19` follow-ups* and *`F22` follow-ups* below) await
harvesting into `plans/PUSH-REVIEW-FINDINGS.md`; the local `feature/status-bucketed-sort`,
`feature/status-count-strip`, `feature/scroll-to-top`, `feature/lock-view-reset` and
`feature/overlay-scrollbar` branches are prunable, as are the local
`chore/compact-plans-before-f16` (#48), `chore/compact-plans-batched-cadence` (#49),
`chore/meta-plan-update-f16` (#51), `chore/meta-plan-update-f17` (#53),
`chore/meta-plan-update-f18` (#55) and `chore/meta-plan-update-f22` (#59) branches (GitHub
auto-deleted the remote side of each on merge — verify with `gh api` before pruning).
Everything before them was clean as
of the 2026-09-22 sweep (#48): `F21` (#46) was frozen under
`plans/completed/form-polish-date-fix/` with its push-review minors harvested into
`plans/PUSH-REVIEW-FINDINGS.md` (section F21), `F4` (#38) and `F5` (#39) by the 2026-09-19
sweep (#42), and `F6` (#43) by the 2026-09-20 sweep (sections F4, F5 and F6 — current
numbering). Everything older is clean: every earlier merged plan dir is frozen under `plans/completed/`. Sweep
history lives in git (PRs #22, #26, #29 and the sweep commits on later branches), not here. After each merge run
`/run-feature <F-ID>` on the merged feature so its Phase C fold-back (ledger row deleted,
Baseline/ID-map/★FOCUS refreshed) lands; `/compact-plans` is **batched** — one sweep every
few features, after their fold-backs, not one per merge. Never hand-delete a merged row:
`/run-feature` keys Phase C off "PR merged + row present", so a hand-deleted row silently
skips the fold-back.

**Ledger update protocol (per session):** set `in-progress` on start; `in-review` + PR
link after `git-push`; once the PR is *verified* merged (never self-marked), the row is
**deleted** rather than kept as `merged` — git carries merged history. Ledger edits ride
in the feature's own commits/PR.

---

## Baseline: the codebase as it exists today (`main` at PR #57, `0277f79`)

> **This Baseline reflects `main` after PR #57 (`0277f79`) — `F22`** (on top of `F19`'s #56,
> `fca7118`, whose delta is described below too). It is the literal current
> state and the **assumed starting state for every remaining feature.** (PRs #33, #35, #36,
> #37, #40, #41, #42, #44, #45, #47, #48, #49, #51, #53, #55 and #59 touched only `plans/` docs and `.claude/skills/`; **#43 (`1c63e0a`) —
> `F6`** touched no app code — `deploy/pi/set-hostname.sh`, `deploy/pi/cloud-init/`,
> `deploy/pi/README.md`, root `README.md` and `plans/`; the app-code deltas since #32
> are **#34 (`3533b67`) — `F14`**, all under `frontend/src/`, **#38 (`d728989`) — `F4`**,
> spanning `types/SharedTypes.d.ts`, `backend/src/` (`db.ts`, `chores.ts`, tests),
> `frontend/src/` (`ChoreForm.tsx`, `utils/choreSort.ts`, the deleted dead reference file
> `assets/database.ts`, tests) and `README.md`, **#39 (`a1705b3`) — `F5`**, confined to
> `frontend/src/App.tsx`, `components/form/AddChoreButton.tsx` and their tests, and
> **#46 (`85cf985`) — `F21`**, confined to `frontend/src/` (`utils/formDate.ts` new,
> `components/common/Toast.tsx` new, `components/form/ChoreForm.tsx` + `ChoreFormModal.tsx`,
> `App.tsx`, tests), `e2e/smoke.spec.ts` and root `README.md` — no backend, type or schema
> change, **#50 (`7bbbdab`) — `F16`**, confined to `frontend/src/` (`utils/choreSort.ts`,
> `utils/choreBarMath.ts`, `assets/constants.ts`, tests), root `README.md`, one `.gitignore`
> line (`graphify-out/*`) and `plans/` — no `App.tsx`, form, backend, type or schema change,
> **#52 (`9da2c64`) — `F17`**, confined to `frontend/src/` (`utils/choreStatusCounts.ts`
> new, `components/nav/StatusCountStrip.tsx` new, an 8-line `App.tsx` wiring, tests), root
> `README.md` and `plans/` — no backend, type, schema, sort, bar or e2e change, and
> **#54 (`3bb26ee`) — `F18`**, confined to `frontend/src/` (`hooks/useScrollPastThreshold.ts`
> new, `components/common/ScrollToTopButton.tsx` new, the `App.tsx` `scrollRegionRef` +
> `scroll-region-frame` wiring, tests), one new e2e spec `e2e/scroll-to-top.spec.ts`, root
> `README.md` and `plans/` — no backend, type, schema, sort, bar, deck or form change; the
> scroller's class string is unchanged, **#56 (`fca7118`) — `F19`**, confined to one
> 15-line lock-engage `useEffect` in `frontend/src/App.tsx`, one new test file
> `frontend/src/__tests__/App.lockViewReset.test.tsx`, a touch-lock paragraph in the root
> `README.md` and `plans/` — no backend, type, schema, sort, component, hook, styling or
> e2e change; the scroller's class string is unchanged, and **#57 (`0277f79`) — `F22`**, confined to
> `frontend/src/` (`hooks/useScrollIndicator.ts` new, `components/common/OverlayScrollbar.tsx`
> new, `App.tsx`, `components/form/ChoreForm.tsx`, the `px-4` relocation across `NavBar`,
> `DateNavigationBanner`, `ReturnToTodayButton`, `ChoreSearchInput`, `ChoreList` and
> `StatusCountStrip`, tests), one new e2e spec `e2e/overlay-scrollbar.spec.ts`, root `README.md`
> and `plans/` — no backend, type, schema, sort, bar or lock change.)
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

**Date semantics at the form boundary** (`F21`, #46): `dateLastCompleted` is stored and
transported as an ISO instant (`toISOString()` on the client, verbatim `TEXT` in SQLite,
`new Date(iso)` on hydration — unchanged), and every consumer diffs it against *local*
midnight (`differenceInDays(startOfDay(today), startOfDay(date))` in `choreSort.ts`,
`ChoreTimerBar.tsx` and — since `F17` (#52) — `utils/choreStatusCounts.ts`; `CompletionInfo.tsx` renders `toDateString()`). The one place a
*calendar day* becomes an instant, and back, is `frontend/src/utils/formDate.ts`:
`parseFormDate(str)` = `date-fns` `parse(str, 'yyyy-MM-dd', new Date())` (local midnight of
the typed day) and `formatFormDate(date)` = `format(date, 'yyyy-MM-dd')` (local calendar
day) — `ChoreForm.tsx` uses them in both directions, so a same-day add is `daysSince === 0`
in every timezone and an evening tap-to-complete round-trips through the edit form on the
same day. Never `new Date('yyyy-mm-dd')` (UTC midnight) or `toISOString().slice(0, 10)`
(UTC date) at the form. A form-created row now serialises as local midnight expressed in
UTC (e.g. `…T04:00:00.000Z` in New York), which the backend neither parses nor validates.
**Legacy rows** written by the pre-#46 form carry a UTC-midnight instant and can still read
one day early in zones behind UTC until their next tap-to-complete overwrites them with a
real instant — no migration was written (deliberate: a server-side shift cannot know the
creating browser's zone; documented in the README); re-saving one from the edit form
persists local midnight of the day the bar shows, so they never drift further. Tests pin
both directions under `America/New_York` *and* `Asia/Tokyo` via
`frontend/src/__tests__/components/ChoreForm.dateBoundary.test.tsx` (a `describe.each`
that sets `process.env.TZ` in `beforeAll` — Node re-reads it at runtime; the forks pool
isolates the assignment per file), which is the mechanism for any future TZ-sensitive test.

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

**Domain model** (`Chore`): `id, name, room, dateLastCompleted, duration, frequency, urgency?`. The DB `chores` table columns (7): `id, name, room, date_last_completed, duration, frequency, urgency`. **`details` and `long_term_task` are gone (`F4`, #38)** — `grep -rn "longTermTask\|long_term_task" backend frontend types` matches only (a) the `LEGACY_CHORE_COLUMNS` migration list + comment in `backend/src/db.ts`, (b) `backend/src/__tests__/db-migration.test.ts` (legacy DDL + legacy INSERTs), and (c) the stale-client tests in `backend/src/__tests__/chores.test.ts`, `backend/src/__tests__/routes.test.ts`, `frontend/src/__tests__/components/ChoreForm.test.tsx` and `frontend/src/__tests__/utils/choreSort.test.ts`; nothing in `app.ts`, `chores.ts`, `SharedTypes.d.ts`, or any non-test frontend file. `createChore`/`updateChore` build explicit named-param literals, so legacy `details`/`longTermTask` keys from a stale client (e.g. a kiosk page not yet reloaded) are **silently dropped, not rejected** (deliberate — a 400 would break a kiosk page still running the old form until it reloads; accepted as the right call in `F4`'s push review). `urgency` is retained permanently; outside tests it is read by `components/form/ChoreForm.tsx` (the `<select>`) and — since `F16` (#50) — by `utils/choreSort.ts` via `SORT_URGENCY_MULTIPLIER` in `assets/constants.ts` (sort weighting only; the bar ignores it). `frontend/src/__tests__/fixtures/chore.ts`'s `makeChore` never defaulted the removed fields, so it needed no change.

**Sort** (`frontend/src/utils/choreSort.ts`, `F16`, #50): `orderChores(chores, today): Chore[]` (signature unchanged; `calcDurationWeightedScore` is **deleted** — the old `duration × daysSince/frequency` score let two chores' rank flip at most once and never let a short chore overtake a long one) is a status-bucketed, quota-filled pipeline. (1) **Bucket** each chore red / orange / green via **`classifyStatus(daysSince, frequency): ChoreStatus`**, exported from `utils/choreBarMath.ts` — the *one* status classifier, which `computeBar` also calls to derive `isOverdue` and `barColor` (red iff `frequency > 0 && daysSince > frequency`; otherwise the `statusColors` threshold `0.375` on `remainingRatio` splits green / orange; `frequency === 0` → green). `daysSince` is the same local-`startOfDay` `differenceInDays` expression `ChoreTimerBar` uses. (2) **Rank** within each bucket: red by urgency-weighted `overdueRatio = (daysSince − frequency) / frequency × SORT_URGENCY_MULTIPLIER[urgency ?? 'medium']` descending, `duration` descending as tiebreak; orange by `remainingRatio` ascending (closest to due first); green by `daysSince` ascending (most recently completed first); `Array.prototype.sort` is stable, so remaining ties keep input order. (3) **Fold quota**: the first `SORT_FOLD = 8` slots are filled per `SORT_BASE_QUOTA = { red: 4, orange: 2, green: 2 }` (a test pins the sum `=== SORT_FOLD`), with **red escalation** — `pressure` = reds whose weighted `overdueRatio ≥ SORT_PRESSURE_THRESHOLD` (`1`, i.e. ≥ 2× the frequency elapsed), `redQuota = min(SORT_FOLD, 4 + pressure)`, the extra slots taken from orange then green — and unused slots **donated red → orange → green**; after the fold come the remaining reds, then oranges, then greens, each in bucket order. The tunables live in `frontend/src/assets/constants.ts` beside the new `ChoreStatus` type (`'red' | 'orange' | 'green'`), `STATUS_BAR_COLOR` (the single status → `bg-*-500` map the bar paints from) and `statusColors`, whose entries are now `{ threshold, status }` (no colour field; the last threshold must stay `-Infinity` — a comment-only invariant). `SORT_URGENCY_MULTIPLIER = { low: 0.75, medium: 1, high: 1.5 }` weights the **sort only** — bar colour and status thresholds ignore urgency. All four `SORT_*` values are first guesses awaiting on-Pi tuning (record final numbers in `constants.ts`). The README's "How prioritization works" section describes the pipeline. **Re-sort trigger** (unchanged by `F16`): the full order is computed by `reconcileChores` on first load (every id is newly seen) and recomputed by the single `useEffect` on `simulatedDate` in `App.tsx` — at local midnight (`useMidnightClock`) and on every day-simulation step; completing a chore, SSE re-pulls (`reconcileChores` keeps existing positions, appends new ids) and screen unblank never re-sort, so a finished chore stays where it was, green, until midnight (the sticky-order rule from #8, `plans/completed/real-time-midnight-sort.md`).

**Backend routes** (`app.ts`): `GET /api/chores`, `GET /api/events` (SSE doorbell), `POST /api/chores`, `PUT /api/chores/:id` (full-replace edit, 200 / 400 `Invalid id` / 400 `Missing required fields` / 404 `Chore not found` / 500), `PATCH /api/chores/:id/complete`, `DELETE /api/chores/:id`. CORS `Access-Control-Allow-Methods` includes `PUT`. Tests for the SSE bus at `backend/src/__tests__/events.test.ts`.

**Frontend API** (`frontend/src/services/choreApi.ts`): `fetchAllChores`, `addChore`, `updateChore(id, chore)`, `completeChore`, `removeChore`.

**Key UI**
- `App.tsx` — orchestrator: holds `choreData`, `sortedIds`, day-simulation (`simulatedDate`/`isSimulating`, real clock via `realToday`), room filter (`uniqueRooms` derived; `useRoomFilter(choreData, selectedRoom)` → `filteredChores`), **search filter** (`searchFilteredChores` derived from `filteredChores`, feeding `orderedChores`), day-simulation handlers, add/edit/delete handlers (F4-L/F2-L/F5-L trio), SSE subscription (`useChoreEvents` + gated `reconcileChores`), **the feedback toast (`F21`, #46)** — a single `toast: { id, tone: 'success' | 'error', message } | null` state (`ToastState`) with `showToast(tone, message)` / `dismissToast` `useCallback`s and a `toastIdRef` counter so `{toast && <Toast key={toast.id} …/>}` remounts (and restarts the timer) on every new toast, rendered **inline inside the `.App` root** (so the root's `inert` covers it like the strip it replaced), after the main column and before the modals; **there is no `error` state and no top-of-page error strip any more** — every former `setError(msg)` is `showToast('error', msg)` with the same message expressions (`loadChores` initial-only, add, delete, complete, edit), `Added "<name>"` / `Saved "<name>"` / `Deleted "<name>"` fire only after the awaited `addChore` / `updateChore` / `removeChore` resolves (never on the optimistic write), and a successful tap-to-complete raises no toast but clears a standing error one (`setToast(prev => prev?.tone === 'error' ? null : prev)`); `loadChores`'s deps are `[reconcileChores, showToast]` — and the **two kiosk overlays**: `useScreenBlank()` → `{ isBlanked, wake }` rendering `<ScreenBlankOverlay onWake={wake} />` when `isBlanked` (`F1`, shipped #27), and `useTouchLock()` → `{ isLocked, arm }` rendering `TouchLockIndicator` always plus `TouchLockOverlay` when `(isLocked || isClosing) && !isBlanked` (`F2`, shipped #28), the app root `inert` while either is active, with a force-close-dialogs effect on blank/lock. **Lock-time view reset (`F19`, #56):** directly after that force-close effect sits a second `useEffect` on `[isLocked]` — `if (!isLocked) return;` then `scrollRegionRef.current.scrollTop = 0` (null-guarded — the ref is unset during the loading render — and instant, never smooth: the app is `inert` behind the padlock), `setSelectedRoom('all')`, `setSearchQuery('')`, `setDayOffset(0)`. It fires on the lock *engage* only — never on unlock, and never on blank (`isBlanked` is not referenced), though a lock engaging *under* a blank still resets, so the 06:00 wake shows the reset view; `setDayOffset(0)` re-sorts only when a simulation was active (through the existing `[simulatedDate]` effect). It adds no ref, frame, component, hook or state (it reuses `F18`'s `scrollRegionRef`), and its code comment carries the `F20` note (re-key to the idle-expiry tick + manual lock, closing an Add modal left open first — Standing invariant 19). **Both overlays are slated for removal by `F15`** (kiosk-layer extraction — their behavior moves to the pi-kiosk shell). **Add Task deck (`F5`, shipped #39) — a frosted sticky surface *inside* the scroll region:** the scroll container is `flex-1 overflow-y-auto min-h-0 flex flex-col scroll-pb-40 scrollbar-none` (`scrollbar-none` added by `F22`, #57; the literal `overflow-y-auto` token must stay on this element — `App.search.test.tsx` locates it by class), `ChoreList` first, then the deck as its last child: `data-testid="add-task-deck"`, `sticky bottom-0 mt-auto flex-shrink-0 flex justify-center py-4` with **no border or background of its own**. The tint + blur live on an `aria-hidden` `data-testid="add-task-deck-backing"` child — `pointer-events-none absolute inset-x-0 -top-16 bottom-0 bg-gray-900/60 backdrop-blur-sm [mask-image:linear-gradient(to_bottom,transparent,black_4rem)]` — a progressive blur that fades in over a 4rem overhang above the ~81px deck rather than stopping at a hard edge (tuned on the Pi kiosk: 2rem read as abrupt, 4rem accepted). `AddChoreButton` (`bg-blue-500 hover:bg-blue-600`, now **fully opaque**) sits in a `relative` wrapper *after* the backing so it paints on top. `mt-auto` pins the deck to the bottom for short/empty lists, `sticky` while a long list scrolls beneath the blur; `scroll-pb-40` (160px ≥ 81px deck + 64px overhang) declares the deck plus its fade as obscured so `scrollIntoView`/keyboard focus land bars clear of it (Chrome aligns a Tab-focused sr-only pill's *own* rect to the scroll-padding edge — measured). **Scroll-region frame + shared ref (`F18`, #54):** the scroll container carries `ref={scrollRegionRef}` — the **single** `useRef<HTMLDivElement>(null)` on that element, declared in `App.tsx` with a comment reserving it for `F18` (read/scroll to top), `F19` (reset on lock — its effect writes `scrollTop = 0` through it since #56) and `F22` (overlay thumb); never add a second ref there — and is wrapped by exactly one positioned frame, `<div data-testid="scroll-region-frame" className="relative flex-1 min-h-0 flex flex-col">`, whose children are, in order, the scroller (keeping its exact class string as a `flex-1` child — no `h-full`), then **`F22`'s list thumb** `<OverlayScrollbar scrollRegionRef={scrollRegionRef} trackInsetBottomPx={LIST_THUMB_BOTTOM_INSET_PX} />` (#57), and, as the frame's **last child**, `<ScrollToTopButton scrollRegionRef={scrollRegionRef} />`. The frame, not the scroller, is what floating controls anchor against. `LIST_THUMB_BOTTOM_INSET_PX = 96` (module-level in `App.tsx`, unexported) = the deck's 80 px (`py-4` + the 48 px button) + `ChoreList`'s `pb-4` 16 px, so at full scroll the thumb's bottom meets the last chore bar's bottom (the user's choice after seeing the branch, replacing a 160 px stop above the frost; `e2e/overlay-scrollbar.spec.ts` pins the alignment). **Full-bleed column (`F22`, #57):** the frame (with the scroll container and deck inside) sits inside the outer `flex flex-col h-full overflow-hidden bg-gray-900 pt-4` column — **no horizontal padding** (locate it by that class string — its line number drifts; `grep -n "flex flex-col h-full overflow-hidden bg-gray-900 pt-4" frontend/src/App.tsx`) — which renders, in order, `NavBar` → **`StatusCountStrip`** (`F17`, #52) → `DateNavigationBanner` → `ReturnToTodayButton` → `ChoreSearchInput` → the `scroll-region-frame`. The 16 px inset lives on the content instead: `px-4` on the roots of `NavBar` (`border-b border-gray-700 flex-shrink-0 px-4`, so its divider is full-bleed while the tabs stay inset), `DateNavigationBanner`, `ReturnToTodayButton`'s wrapper, `ChoreSearchInput`, and both `ChoreList` branch roots (empty `px-4`, populated `space-y-3 pb-4 px-4`); `StatusCountStrip` carries `mx-4` instead of `w-full`. So the scroll container, the deck backing's `inset-x-0` frost and the thumb span the full width while bars, tabs, strip, banner and search keep their inset. `index.css`'s `.scrollbar-none` utility (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`) is used by `NavBar`'s chip row, the list scroller and `ChoreForm`'s card (all since #57 except `NavBar`). The loading branch's `mx-auto px-4` wrapper is a separate tree and unchanged. The deck's own box keeps default pointer events (a frosted surface must not pass taps to half-hidden bars); the overhang is `pointer-events-none` so bars under the fade stay tappable. No z-index anywhere. Tailwind 4.1.18 emits both `-webkit-`/unprefixed `mask-image` and `backdrop-filter`. Note that Tailwind's built-in `mask-t-*` utilities fade the *bottom* edge in (`to top, black <from>, transparent <to>`), so the arbitrary `mask-image` property is the simplest correct form — verified by compiling both (F5 push Review 2). `NavBar` renders room chips **and the persistent search input** above the list. **There is no settings/device-control panel on `main`, and there never will be** — `F3` was superseded 2026-07-15 (migrated to pi-kiosk).
  - **SSE sync — unchanged contract:** subscribes via `useChoreEvents(onChange)` (`hooks/useChoreEvents.ts`; `new EventSource('/api/events')` + `visibilitychange→visible` re-fire). Re-pulls are gated by `isRepullGated()` (`isMutatingRef` || `showForm` || `editingId` || `pendingDeleteId`); deferred via `pendingRefreshRef`. **Any new frontend feature holding uncommitted user input in `App.tsx` state must be added to this gate** — the `F21` toast state is *not* user input and is deliberately outside it (a re-pull while a toast shows is fine).
  - **Visible-list pipeline (three-stage):** `filteredChores = useRoomFilter(choreData, selectedRoom)` → `searchFilteredChores` (substring on `name`, from `F9-L`) → `orderedChores` (maps `sortedIds` over a `Map` of `searchFilteredChores`). Beside it (`F17`, #52), `statusCounts = useMemo(() => countStatuses(searchFilteredChores, simulatedDate), [searchFilteredChores, simulatedDate])` feeds `<StatusCountStrip counts={statusCounts} />` — derived from the live chore data, never from `sortedIds`, so it updates on completion, edit and SSE re-pull while the list order stays midnight-only.
  - **`F1`'s real-clock scheduling (shipped):** `frontend/src/hooks/useScreenBlank.ts` — window-boundary re-arming timeouts driven by `realToday`, **not** `simulatedDate` (adapted from the `useMidnightClock.ts` single-`setTimeout`-to-boundary pattern, which remains available as a precedent for any future real-clock feature).
- `components/chore/ChoreTimerBar.tsx` — **F10-L's current shape**: `useSwipeable` with **swipe-left → `onEdit`**, **swipe-right → `onDelete`** (reversed from the original F5-L mapping), a controlled swipe offset revealing a behind-the-bar action layer (yellow+pencil for edit, red+trash for delete) with a **25%-of-bar-width threshold** and spring-back below it; colour fades in progressively toward the threshold (added in F10-L's third commit). `delta: 50` remains the swipeable trigger threshold (distinct from the 25%-width confirm threshold). Spread-before-explicit-props order, `touch-pan-y`, `isSimulating` guard, `swipingRef` click-suppression all preserved. Bar math from `@utils/choreBarMath` `computeBar(daysSince, frequency)` — since `F16` (#50) it derives `isOverdue` / `barColor` from the shared `classifyStatus` + `STATUS_BAR_COLOR` (Standing invariant 15) with unchanged output; **revised in PR #32** (`790a4ab`, untracked by any F-ID): `barColor` is `bg-red-500` only when `isOverdue`, never pre-due (previously red could appear before the due date); `ProgressBar`'s fill re-gained its `opacity-50` translucency, restoring a Tailwind v4 regression that had silently dropped the dead v3 `bg-opacity-50` utility. `h-20 sm:h-16` grid layout from F6-L unchanged.
- `components/common/ConfirmDialog.tsx` (F4-L) — unchanged; reused by the swipe-delete path. *(The former "reuse for `F10` restart confirm" plan left with the migration — restart now lives in pi-kiosk.)*
- `components/form/` — `ChoreFormModal` → **`ChoreForm`** → `FormField`. **Props (as of `F21`, #46):** `ChoreForm` takes `{ mode?: 'add' | 'edit'; initialChore?: Chore; rooms?: string[]; defaultRoom?: string; onSubmit: (chore: Omit<Chore,'id'>) => void; onCancel: () => void }` (default `mode='add'`, `defaultRoom=''`), `ChoreFormModal` mirrors and forwards them; the form emits `Omit<Chore,'id'>` (`name, room, dateLastCompleted, duration, frequency, urgency?`) and App supplies the id. **Add-mode defaults:** `initialAddState(defaultRoom)` (a function, not a constant) seeds Room with `defaultRoom` and Last Completed with `formatFormDate(new Date())` — the *real* clock, captured when the modal mounts, never `simulatedDate` — and the post-submit reset in add mode re-applies both; `App.tsx` passes `defaultRoom={selectedRoom === 'all' ? '' : selectedRoom}` to the *add* modal only (edit mode pre-fills from `initialChore` via `choreToFormState`, which formats the date with `formatFormDate`). A pre-filled Room shows its clear-✕ on mount (Standing invariant 10 unchanged). Note for tests: `user.type` into a prefilled `<input type="date">` leaves it empty in jsdom — `user.clear` first, as every add-mode test now does. **Room field is now a `<datalist>` input** (`F3-L`) sourced from `uniqueRooms`, threaded through both Add and Edit — a raw `<input type="text" list="room-options">`, not `FormField`. The form's fields are exactly `Name` (`FormField`, `name="name"`, **`clearable`**), Room (the raw datalist input), `Last Completed` / `Duration (minutes)` / `Frequency (days)` (`FormField`, *not* `clearable`), and `Urgency` (a raw `<select id="urgency">` with blank/low/medium/high, not `FormField`) — the `Details` `FormField` and the `longTermTask` checkbox were deleted by `F4` (#38) without touching `ClearButton.tsx`, `ChoreSearchInput.tsx` or `FormField.tsx` (no diff in #38). **Clear-✕ affordance (`F14`, #34):** `FormField` takes an opt-in `clearable?: boolean` (default `false`; only Name passes it — Last Completed/Duration/Frequency don't) and renders a `ClearButton` when `clearable && value !== ''`; the raw Room `<input>` (`ref={roomInputRef}`, `pr-14`) hand-wires its own `ClearButton` (`anchor="top"`, label `"Clear Room"`). Both clear only that field's local state (no submit/close) and refocus the input. **Card + overlay thumb (`F22`, #57):** `ChoreForm` renders a card-sized positioned wrapper `<div className="relative w-full max-w-md">` (card-sized so a click beside the card still lands on `ChoreFormModal`'s backdrop — backdrop-click cancel semantics unchanged) holding the card — still the scroller, `ref={scrollBoxRef}`, class `bg-gray-800 rounded-xl p-6 w-full max-w-md overflow-y-auto max-h-[90dvh] scrollbar-none` — and then, after the card inside the wrapper, `<OverlayScrollbar scrollRegionRef={scrollBoxRef} trackInsetTopPx={FORM_THUMB_TRACK_INSET_PX} trackInsetBottomPx={FORM_THUMB_TRACK_INSET_PX} />` with `FORM_THUMB_TRACK_INSET_PX = 12` (module-level, unexported — the `rounded-xl` radius, so the thumb stays inside the rounded corners over the `p-6` padding). The modal is a body portal mounted only while open, so tests' `.overflow-y-auto` first-match selectors still hit the list in the base tree.
- `components/chore/ChoreSearchInput.tsx` — the `F9-L` search box (`Search` icon, `placeholder="Search for a chore"`, `pr-14`), pinned above the scroll region. **Has a clear-✕ (`F14`, #34):** renders `ClearButton` (label `"Clear Search"`) when `value !== ''`; clearing calls `onChange('')` and refocuses, restoring the room-filtered list exactly as manual deletion does.
- `components/common/ClearButton.tsx` (`F14`, #34) — the shared clear-✕ primitive: `{ label: string; onClear: () => void; anchor?: 'center' | 'top' }`; `lucide-react` `X` inside an absolutely-positioned `right-3` 44×44 px touch target (the app's kiosk-touch convention, matching `DateNavigationBanner`); `anchor='center'` (default) vertically centres on a label-less input (search), `anchor='top'` pins to the input's top edge so it clears a `FormField`'s label. `aria-label={label}` — the three current labels are Title Case (`"Clear Search"`/`"Clear Name"`/`"Clear Room"`); sentence-casing them is an open `[a11y]` minor in `plans/PUSH-REVIEW-FINDINGS.md`. Inputs that host it reserve `pr-14`.
- `components/common/Toast.tsx` (`F21`, #46) — the single feedback surface: `{ tone: 'success' | 'error'; message: string; onDismiss: () => void }` plus the exported `SUCCESS_TOAST_MS = 2500`. Markup is a **click-through frame** (`pointer-events-none fixed inset-x-4 bottom-40 z-[80] flex justify-center` — `bottom-40` = the `F5` deck's ~5 rem footprint + its 4 rem `-top-16` overhang, the same 10 rem `scroll-pb-40` declares; `z-[80]` sits above the `z-50` body-portaled modals and below `TouchLockOverlay` `z-[90]` / `ScreenBlankOverlay` `z-[100]`; positioned against the viewport, **never inside `.overflow-y-auto`**) around the pill (`role="status" aria-live="polite" data-testid="toast" data-tone={tone}`, `min-w-0 max-w-full rounded-full …`, message in a `min-w-0 truncate` span so long text ellipsises rather than wrapping). **Success** (`bg-green-600`) inherits the frame's `pointer-events: none` — a tap passes through to whatever is beneath, so the 2.5 s green pill never blocks the form's Save/Cancel — and self-dismisses via an effect-scoped `setTimeout(onDismiss, SUCCESS_TOAST_MS)` cleared on unmount. **Error** (`bg-red-700`, the token the old strip used) never auto-dismisses: the pill is `pointer-events-auto cursor-pointer` with `onClick={onDismiss}`, and its ✕ (`aria-label="Dismiss"`, 44×44 px, lucide `X` `w-4 h-4`) calls `stopPropagation()` then `onDismiss()`. `onDismiss` is an effect dependency and must be referentially stable (App passes a `useCallback([])`). e2e selects the error pill via `[data-testid="toast"][data-tone="error"]` (`ERROR_TOAST` in `smoke.spec.ts`); the success pill's text (`Added "<name>"`) also matches Playwright's substring `text=<name>` engine, so chore-name assertions there are scoped to `.bg-gray-800.rounded-full` bars.
- `components/nav/StatusCountStrip.tsx` + `utils/choreStatusCounts.ts` (`F17`, #52) — the live status tally. **Util:** `countStatuses(chores, day): StatusCounts` (`type StatusCounts = { doneToday; dueSoon; overdue }`) computes each chore's `daysSince` with the same local-`startOfDay` `differenceInDays` expression as the bar and the sort; `daysSince === 0` → *done today*, otherwise `classifyStatus(daysSince, frequency)` decides — red → *overdue*, orange → *due soon*, green (completed on an earlier day, or after the displayed day) → no segment — so a morning board is orange + red only. **Component:** `{ counts: StatusCounts }`; the root is `data-testid="status-count-strip"`, `role="img"` with one `aria-label` = `title` (e.g. `"3 done today · 2 due soon · 5 overdue"`), class `flex flex-shrink-0 mx-4 h-5 mt-2 rounded-sm overflow-hidden bg-gray-800` (`mx-4` **replaced** `w-full` in `F22`, #57 — the column lost its `px-4`, and `w-full` + `mx-4` would overflow by 32 px; the column's default `align-items: stretch` still fills the row) — it deliberately carries **neither `rounded-full` nor `overflow-y-auto`**, so e2e's `.bg-gray-800.rounded-full` `.first()` bar selector and the tests' `.overflow-y-auto` first-match selectors never hit it. A `SEGMENTS` table maps `doneToday`/`dueSoon`/`overdue` → `data-testid` `status-count-done-today` / `status-count-due-soon` / `status-count-overdue` and status `green`/`orange`/`red`. All three segments stay mounted: width is `flexGrow = count` (`flexBasis 0`) with `min-w-5` on any non-zero segment (a bold 2-digit label stays legible on a tiny share) and `flexGrow 0` / `min-w-0` at zero, animated with the bar fill's own `transition-all duration-300 ease-in-out`. Each segment paints like the bar — an inner `absolute inset-0` fill in the `STATUS_BAR_COLOR` hue at `opacity-50` over the root's `bg-gray-800` track — with a bold white `text-xs` label at full opacity (the user's PR-review call, superseding the spec's "full opacity" idea). An all-zero count renders the done-today segment as a full green bar reading `0`. Height/contrast/animation are still to be eyeballed on the Pi (see *`F17` follow-ups*).
- `components/common/ScrollToTopButton.tsx` + `hooks/useScrollPastThreshold.ts` (`F18`, #54) — the list's way back to the top. **Hook:** `useScrollPastThreshold(ref, thresholdPx): boolean` attaches a passive `scroll` listener to `ref.current` in an effect and reads `scrollTop` once on attach (so a remount mid-scroll is correct); true while `scrollTop > thresholdPx`. It requires the element to be mounted when the caller's effects run (render the caller alongside, after, the scroller) — a null ref returns silently and is not re-tried. **Component:** `{ scrollRegionRef }`; a `<button type="button" data-testid="scroll-to-top" aria-label="Scroll to top">` holding a lucide `ArrowUp` (`w-5 h-5`, `aria-hidden`), class `absolute bottom-40 left-1/2 -translate-x-1/2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-gray-800 text-white shadow-lg transition-opacity duration-500` — a 44 px opaque circle **bottom-centre** in the frame, **no z-index** (later in DOM than the scroller). `bottom-40` is the same 10 rem the `F5` deck + overhang and `scroll-pb-40` and the `Toast` frame use, so the button sits on the toast's bottom-centre line and a toast (`z-[80]`) **covers it while shown** (the user's post-review call on #54, superseding the planned translucent bottom-right placement). Exported constants: `SCROLL_TO_TOP_THRESHOLD_PX = 80` (one `h-20` bar) and `FADE_MS = 500` (must equal `duration-500`). **Two-phase visibility:** `isVisible` (from the hook) drives only `opacity-100`/`opacity-0`; a separate `isInteractive` state drives `pointer-events-none`, `inert`, `aria-hidden` and `tabIndex={-1}` — it turns true right after `isVisible` does and false only `FADE_MS` after the fade-out starts (timer cleared on re-show/unmount), and starts false, so the boot view is non-interactive at once while a tap during the fade-out lands on the fading button (a harmless re-scroll) instead of completing the bar beneath. **Click:** `scrollRegionRef.current.scrollTo({ top: 0, behavior: 'smooth' })`, or `'auto'` under `prefers-reduced-motion: reduce` (`window.matchMedia?.(…)` is optional-called — jsdom has none); the opacity fade is kept under reduced motion; no other side effect (room, search, day offset untouched). No lock awareness: blank's root `inert` disables it; after `F20` it must keep working under the lock. The README's UI overview has one line on it.
- `components/common/OverlayScrollbar.tsx` + `hooks/useScrollIndicator.ts` (`F22`, #57) — the indicator-only overlay scrollbar that stands in for the hidden native one. **Pure geometry:** `computeThumbGeometry(scrollTop, scrollHeight, clientHeight, trackInsetTopPx = 0, trackInsetBottomPx = 0): ThumbGeometry | null` over a *track* `= clientHeight − top − bottom`: `height = min(max(track · clientHeight / scrollHeight, MIN_THUMB_PX), track)`, `top = trackInsetTopPx + clamp(scrollTop / (scrollHeight − clientHeight), 0, 1) · (track − height)`; `null` when `scrollHeight ≤ clientHeight` or `track ≤ 0` (a deliberate departure from the original unclamped `clientHeight² / scrollHeight` full-height formula — the thumb never leaves its track). **Hook:** `useScrollIndicator(ref, trackInsetTopPx = 0, trackInsetBottomPx = 0) → { geometry, isVisible }` measures on attach, attaches its own passive `scroll` listener (beside `F18`'s, not replacing it) that re-measures, sets `isVisible` and restarts an `IDLE_FADE_MS = 1000` idle timer, and — only where `ResizeObserver` exists (guarded: jsdom has none) — re-measures on resizes of the scroller and its children present at attach time; it skips a `setState` when the geometry is unchanged; `isVisible` starts false, so there is **no mount flash** (boot/unblank view pixel-identical). Like `useScrollPastThreshold`, it needs the element mounted when the caller's effects run. Exported: `IDLE_FADE_MS = 1000`, `MIN_THUMB_PX = 24`, `ThumbGeometry`. **Component:** `{ scrollRegionRef; trackInsetTopPx?; trackInsetBottomPx? }`; renders **nothing** when geometry is `null`, otherwise a `<div data-testid="overlay-scrollbar" aria-hidden="true">` with class `pointer-events-none absolute rounded-full bg-gray-300/50 transition-opacity motion-reduce:transition-none` + `opacity-100 duration-150` (visible) / `opacity-0 duration-400` (hidden) and inline `top`/`height`/`width: THUMB_WIDTH_PX (4)`/`right: THUMB_EDGE_INSET_PX (2)`; **no z-index** (paints over the scroller and the frost by DOM order), no `role`, not draggable, never `bg-gray-800` (e2e locates bars by `.bg-gray-800.rounded-full`). Exported `FADE_IN_MS = 150` / `FADE_OUT_MS = 400` document the literal classes (Tailwind needs literals). Two call sites: the list (in `F18`'s `scroll-region-frame`, bottom inset `LIST_THUMB_BOTTOM_INSET_PX`) and the form card (top/bottom inset `FORM_THUMB_TRACK_INSET_PX`). It reads no lock state. The README's UI overview has one paragraph on it.

**Tests**
- **Vitest** unit tests both sides (backend 43 across 5 files — untouched by `F16`/`F17`/`F18`/`F19`/`F21`/`F22`; frontend 397 across 40 files as of #57 — of the 31 added since #54, `F19` (#56) added 6 in the new `App.lockViewReset.test.tsx` (real `useTouchLock` + fake timers: lock after 5 min idle resets scroll/room/search/day; a double-tap unlock does not reset; a blank alone does not reset; a lock engaging under a blank resets; the lock re-sorts only when a day simulation was active; `F18`'s scroll-to-top button hides after the reset — `fireEvent.scroll(region)` after the write, then `vi.advanceTimersByTime(FADE_MS)` before asserting `inert`/`aria-hidden`) and `F22` added 25: `hooks/useScrollIndicator.test.ts` (11 — `computeThumbGeometry` null/size/min-clamp/track-inset cases, no mount flash, show on scroll + hide after `IDLE_FADE_MS` with the timer restarted per event, passive listener + cleanup, a stubbed `ResizeObserver` observed/re-measured/disconnected, and no throw without one), `components/OverlayScrollbar.test.tsx` (6 — nothing when not scrollable, hidden z-index-free thumb with inline px geometry, fade under fake timers, form- and list-shaped insets, the fade constants pinned to the class literals), a 4-case `overlay scrollbar (F22)` describe in `App.test.tsx` (thumb in the frame between the scroller and the button, hidden on load; the track end level with the last bar under stubbed metrics; no thumb at jsdom's default metrics; the full-bleed column with each content row inset), a 2-case `overlay scrollbar (F22)` describe in `ChoreForm.test.tsx` (the card-sized wrapper's exact className + the inset thumb), and inset assertions in `ReturnToTodayButton.test.tsx` / `StatusCountStrip.test.tsx` (plus an updated one in `ChoreList.test.tsx`); `F22` also updated `F18`'s pinned scroller-className literal to add `scrollbar-none`; before that `F18` added 20: `hooks/useScrollPastThreshold.test.ts` (8), `components/ScrollToTopButton.test.tsx` (9 — hidden + non-interactive at mount, visible + interactive past the threshold, the two-phase `FADE_MS` fade-out under fake timers incl. re-show cancel and unmount cleanup, smooth / reduced-motion / no-`matchMedia` clicks with `Element.prototype.scrollTo` stubbed, the centred opaque 44 px classes with no z-index) and a 3-case `scroll-to-top button (F18)` describe in `App.test.tsx` whose case 1 pins the scroller's **exact** className (`'flex-1 overflow-y-auto min-h-0 flex flex-col scroll-pb-40 scrollbar-none'` since `F22`, #57), the single `.overflow-y-auto`, the button as a child of `scroll-region-frame` outside the scroller, and the deck as the scroller's last child — note that jsdom neither dispatches `scroll` on a programmatic `scrollTop` write (tests call `fireEvent.scroll(region)`) nor honours `inert` (tests assert the attribute only); before that `F17` added 24 in three new files: `utils/choreStatusCounts.test.ts` (8), `components/StatusCountStrip.test.tsx` (10 — proportional widths, zero collapse with all segments mounted, all-zero full-green `0`, labels, accessible label, colour tokens = `STATUS_BAR_COLOR`, the bar's transition, identity across a grow rerender, selector avoidance) and `App.statusStrip.test.tsx` (6 — position after `NavBar`, live update on completion and SSE re-pull, room/search narrowing, displayed day); before that `F16` added 26, almost all in the rewritten `utils/choreSort.test.ts` (bucket ↔ `classifyStatus` agreement across the boundaries, monotonic red ranking, most-recent-first greens, 4/2/2 fill, donation, escalation to an all-red fold, `high`/`low` urgency flipping rank and pressure, unset = `medium`, `frequency === 0`, empty input, stable ties, the `SORT_BASE_QUOTA` sum pin, the stale-`longTermTask` flag still ignored) plus `classifyStatus` cases in `components/ChoreTimerBar.barMath.test.ts`, with only comments re-worded in `App.test.tsx` / `App.search.test.tsx` (their expected orders held); before that `F21` added 42 frontend tests: `utils/formDate.test.ts`, the TZ-pinned `components/ChoreForm.dateBoundary.test.tsx` (Cases A/B/B2/C/D under New York + Tokyo, each verified red on the pre-fix code), `components/Toast.test.tsx` (7), an add-mode-defaults describe in `ChoreForm.test.tsx`, a `defaultRoom` forwarding test in `ChoreFormModal.test.tsx`, and in `App.test.tsx` two room-tab pre-fill tests plus the 11-test `feedback toast (F21)` describe with a module-scope `openAndFillForm` helper), now also covering the search filter (component + App-level substring/room composition + SSE-survival tests from `F9-L`), the reversed swipe mapping + threshold (`F10-L`), the clear-✕ affordance (component-level show/clear/refocus + App-level clear-restores-room-filter, from `F14`), and `F4`'s removal: `backend/src/__tests__/db-migration.test.ts` (7 cases — idempotency on `:memory:`, boot wiring against a legacy 9-column temp file, rows/other columns preserved), stale-client-key drop tests on `POST`/`PUT` and `createChore`/`updateChore`, a `ChoreForm` absence test (no Details / Long-term inputs) and a stale-`longTermTask`-flag-ignored sort test, plus `F5`'s `Add Task deck (F5)` describe in `App.test.tsx` (deck sticky/`mt-auto`/last-child inside `.overflow-y-auto` for populated and empty lists, the masked backing layer's classes and backing-before-button paint order, `scroll-pb-40`) and the opaque-button assertion in `AddChoreButton.test.tsx`.
- **Playwright e2e**: `e2e/smoke.spec.ts` (14 tests) plus, since `F18` (#54), the read-only `e2e/scroll-to-top.spec.ts` (1 test — hidden + `inert` at load, fade-in past 80 px, anchored while the region scrolls, clear of the deck's frosted overhang, click → back to top, still hit-testable and not `inert` at the first faded frame, hidden + `inert` after the fade) and, since `F22` (#57), the read-only `e2e/overlay-scrollbar.spec.ts` (4 tests — full-bleed scroll region + frost with inset header rows and bars and `scrollbar-width: none` applied; the list thumb fades in on scroll at the right edge, ends level with the last bar's bottom at full scroll (±1 px), is click-through and fades out; the form thumb stays inside the card and a tap beside the card still closes the modal; reduced motion drops the transition) — 19 in all. Headless Playwright Chromium runs with `--hide-scrollbars`, so no e2e can prove the *visible* gutter is gone — that is a Pi check (*`F22` follow-ups*). Since #54 smoke's `.bg-gray-800.rounded-full` bar locators also match the (icon-only, later-in-DOM) scroll-to-top button; they stay correct because each uses `.first()` or a `hasText` filter — keep it that way. `swipeBar(page, bar, 'left')` now triggers **edit**, `'right'` triggers **delete** (flipped by F10-L). Still depends on seed chore `Vacuum Bedroom Floor` and the `+ Add Task` flow. Since `F21` (#46): the error toast is located by the `ERROR_TOAST` constant (`[data-testid="toast"][data-tone="error"]`, replacing every `.bg-red-700` locator), the four post-mutation chore-name assertions are scoped to `.bg-gray-800.rounded-full` bars (the success toast's text would otherwise make the substring `text=<name>` engine resolve to two elements — a non-retriable strict-mode violation), the add test asserts the green `Added "…"` pill's text/tone, and it asserts the added bar shows `Thu Jan 01 2026` (the typed local day; red pre-fix only on a behind-UTC host — the Vitest TZ suite is the real guard). Playwright's `fill()` replaces the pre-filled date default, so the five `fill` lines are unchanged. `F17` (#52) changed no e2e file — the strip's root avoids the `.bg-gray-800.rounded-full` bar selector (it is `rounded-sm`); `F19` (#56) changed none either.
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
9. **Permissive touch lock**: `useTouchLock()` → `{ isLocked, arm, lock, idleExpiries }` — local-only/per-tab; a 5-minute inactivity timer (armed on mount) re-armed by `document`-level `pointerdown`/`keydown` that **keeps running while locked**: every expiry locks and bumps `idleExpiries`, then re-schedules itself, so while locked it ticks every 5 minutes (activity only postpones the next tick, never unlocks); `arm()` unlocks and restarts the countdown; `lock()` locks immediately (manual lock) and restarts it without bumping `idleExpiries`. The app root is `inert={isBlanked}` only — the lock is **not** an `inert` gate. **The guard lives in `ChoreTimerBar`:** while `isLocked`, a bar tap, a horizontal (`Left`/`Right`) swipe and the sr-only *Edit chore*/*Delete chore* buttons call `onGuardedAttempt(point)` instead of acting (tap/pill → the click's `clientX`/`clientY`, keyboard `(0, 0)`; swipe → its start point `eventData.initial`); the bar never moves or dims, a vertical drag raises nothing, and `swipingRef` still swallows the post-swipe click. `ConfirmDialog` and the edit modal also render only while `!isLocked` (a JSX gate closing the one-commit gap before the force-close effect clears their state); the Add form is allowed while locked (a lock engage still force-closes it). **`TouchLockOverlay`** is mounted by `App` only on a guarded attempt (`lockAttempt: { id, point }`, keyed by `id`), seeded with the attempt as the first tap of the double-tap unlock (second tap within `SECOND_TAP_WINDOW_MS = 1500` and `SECOND_TAP_MAX_DISTANCE_PX = 60`; keyboard Enter/Space registers `(0, 0)`); it focuses itself on mount; with no qualifying tap it fades after the window (`'dismissing'` phase: `opacity-0` over 400 ms, hit circle `pointer-events-none` — every tap passes through to the still-locked board, keys are ignored) and calls `onDismiss` `CLOSING_SETTLE_MS` later; after a qualifying tap `App` holds `lockAttempt` for the `CLOSING_SETTLE_MS = 400` handshake, during which the hit circle stays hit-testable (`'opening'`), so a rapid third tap on the same spot within ~0.4 s of the unlock is swallowed rather than completing a chore; on unmount focus returns to the previously focused element only if focus is still on the overlay or the body (it never steals focus the user moved elsewhere); `z-[90]`, rendered only while `!isBlanked` — **blank always wins** (`z-[100]`), and the force-close effect drops a pending attempt on blank or lock engage so it never reappears after a wake. The overlay is **non-blocking** (post-PR amendment 2026-09-24): its full-viewport root is `pointer-events-none` in every phase and the only hit-testable element is a `touch-lock-hit-area` circle of radius `SECOND_TAP_MAX_DISTANCE_PX` (120 × 120 px, `rounded-full`) centred on the seed and clamped fully on-screen, with the padlock drawn in it; a second tap inside it unlocks. Every tap outside it passes straight through to the board — scrolling (incl. touch-drag), room tabs, day arrows, search and Add Task all work while the padlock shows — and never re-seeds or restarts the window; a tap on another chore bar is simply a new guarded attempt (the overlay re-keys). Keyboard Enter/Space still reach the focused root and are measured against the raw seed. **`TouchLockIndicator`** is a 44 px lock/unlock `<button>` (`aria-label` `"Lock screen"`/`"Unlock screen"`) at `fixed top-2 left-2` `z-40` — below the `z-50` modal backdrops, so an open modal covers it and a corner tap cancels the modal — with `NavBar`'s `pl-14` gutter keeping the *All* tab clear of it; it is raised to `z-[95]` (`raised={lockAttempt !== null}`: above the `z-[90]` overlay, under the `z-[100]` blank) while a padlock shows, so a single corner tap unlocks then, and unlocking from it also clears a pending attempt overlay. Accepted: a keyboard sr-only-pill attempt made with the Add form open raises it above that form's backdrop, so the corner then unlocks rather than cancelling the form. **Simulation wins over the lock:** while `isSimulating`, bar taps/swipes do nothing and raise no padlock (the sr-only pills still raise it via keyboard — accepted) (F2, shipped #28; reworked by F20). *Holds until `F15` relocates this behavior to pi-kiosk and removes the in-app code* — see the `F2` kept contract for what `F15` removes and pi-kiosk reproduces. `isLocked` also keys the lock-time view reset (Standing invariant 19) — beyond the `!isLocked` dialog gate it gates no input itself; the bar guard does.
10. **Clear-✕ affordance on every free-text input**: search bar, form Name, form Room each render the shared `ClearButton` only when non-empty; clicking clears that field's local state only (never submits/closes) and refocuses the input; `FormField`'s affordance is opt-in via `clearable` (default off), so no other `FormField` usage (Last Completed, Duration, Frequency) gains it (F14, shipped #34; verified intact after F4 — `ClearButton.tsx`, `ChoreSearchInput.tsx`, `FormField.tsx` had no diff in #38).
11. **No `details` / `longTermTask` anywhere in the live model**: `Chore` is `id, name, room, dateLastCompleted, duration, frequency, urgency?`; the shared `ChoreForm` has no Details field or Long-term checkbox; `app.ts`/`chores.ts` never read or write them (stale keys from old clients are dropped silently, never rejected — deliberate, so a not-yet-reloaded kiosk page keeps working through the rollout; don't "fix" it with a 400); `db.ts` runs the idempotent, crash-loud `dropLegacyChoreColumns` boot migration (`pragma table_info` guard, `BEGIN IMMEDIATE`) so an existing 9-column `data.db` migrates itself to 7 columns on first boot and later boots are no-ops; `orderChores` has no long-term partition (F4, shipped #38) and, since `F16` (#50), is the status-bucketed quota sort (Standing invariant 15). Any future schema change adds its own guarded step beside that migration — `CREATE TABLE IF NOT EXISTS` never alters an existing `data.db`. The pre-F4 image cannot write to a migrated DB (its SQL still names the dropped columns), so a rollback restores the pre-deploy snapshot together with the old image.
12. **Frosted sticky *Add Task* deck**: the deck lives *inside* the scroll region as its `sticky bottom-0 mt-auto` last child with no border/background of its own; tint + blur come from a masked, `aria-hidden`, `pointer-events-none` backing layer that overhangs the deck by 4rem and fades in (`bg-gray-900/60 backdrop-blur-sm` + `mask-image` gradient); `AddChoreButton` is fully opaque and paints above the backing; the scroll container carries `scroll-pb-40` so focus/scrollIntoView never rest a bar under the deck or its fade; `.overflow-y-auto` stays the single scrolling element and `ChoreSearchInput` stays outside it (F5, shipped #39). Any change to the deck's height or overhang must re-check `scroll-pb-*` (≥ deck + overhang) and the Tab-focus clearance measured in `plans/feature/translucent-add-deck/` (or its frozen copy under `plans/completed/`). **Scroll-region frame (`F18`, shipped #54; amended by `F22`, shipped #57):** the scroller — class string exactly `flex-1 overflow-y-auto min-h-0 flex flex-col scroll-pb-40 scrollbar-none` (`F22` added only `scrollbar-none`, hiding the native bar), pinned byte-for-byte by `App.test.tsx`'s `scroll-to-top button (F18)` case 1 — carries the app's **single** `scrollRegionRef` and is wrapped by exactly **one** positioned frame, `data-testid="scroll-region-frame"`, `relative flex-1 min-h-0 flex flex-col` (the scroller stays its `flex-1` child; no `h-full`); floating controls live in that frame **after** the scroller, never inside it — in order `F22`'s list `OverlayScrollbar` (Standing invariant 18) then, as the **last child**, `F18`'s `ScrollToTopButton` (`absolute bottom-40 left-1/2 -translate-x-1/2`, no z-index; Standing invariant 17). Every consumer (`F18`'s button, `F22`'s thumb, `F19`'s lock-time `scrollTop = 0` write — #56, Standing invariant 19 — and any later one) reuses this ref and frame — never a second ref on the scroller or a second frame; the deck stays the scroller's last child. **Full-bleed (`F22`, #57):** the outer column carries no horizontal padding (`flex flex-col h-full overflow-hidden bg-gray-900 pt-4`), so the scroller, the backing's `inset-x-0` frost and the thumb reach both screen edges; the 16 px inset lives on the header rows' roots (`NavBar` — `pl-14 pr-4` (F20: a 56 px left gutter clears the fixed 44 px lock button at `top-2 left-2`; its divider stays full-bleed), pinned by `App.test.tsx`'s full-bleed test; `DateNavigationBanner`, `ReturnToTodayButton`'s wrapper, `ChoreSearchInput` — `px-4`; `StatusCountStrip` — `mx-4`) and on both `ChoreList` branch roots (`px-4`) — never re-add it to the column or a wrapper div (`App.statusStrip.test.tsx` pins `NavBar`'s next sibling). `#root`'s 768 px desktop cap is unchanged. **Re-check rule:** any change to the deck's height or overhang, or to `ChoreList`'s bottom padding, re-checks together `scroll-pb-*` (≥ deck + overhang), the button's and toast's `bottom-40` line, and `LIST_THUMB_BOTTOM_INSET_PX` in `App.tsx` (96 = deck 80 px + `ChoreList` `pb-4` 16 px, so the thumb ends level with the last bar — pinned by `e2e/overlay-scrollbar.spec.ts`).
13. **LAN name `c4i`**: the Pi's hostname is `c4i`, reachable as `http://c4i.local/` and `http://c4i/` with `http://192.168.1.214/` still working; the mechanism is `deploy/pi/set-hostname.sh` + `deploy/pi/cloud-init/99-c4i-hostname.cfg` (idempotent, backup-then-write, crash-safe re-run, rollback = run it with the old name) and nothing in the app is name-aware — no feature may hard-code a hostname or IP in app code, `nginx.conf`, or the kiosk `.desktop` (which stays `http://localhost/`), and any future Pi rename runs the script (it also clears Chromium's hostname-keyed profile lock) rather than `hostnamectl` alone (F6, shipped #43). The deployed `deploy/pi/` copies are refreshed by every redeploy; the installed system files are not.
14. **Local calendar days at the form boundary + one feedback toast**: the form parses and formats `dateLastCompleted` as a *local* calendar day through `utils/formDate.ts` (`parseFormDate` / `formatFormDate`; never `new Date('yyyy-mm-dd')` or `toISOString().slice(0, 10)` in `ChoreForm.tsx`), so a same-day add is `daysSince === 0` in every timezone and an instant round-trips through the edit form on the same day — every `daysSince` consumer keeps its local-`startOfDay` expression and **no consumer may "fix" timezone drift in-band** (that would double-correct); add mode opens with Last Completed = today (real clock, never `simulatedDate`) and Room = the active room tab (blank under *All*), both re-applied by the post-submit reset; **there is no top-of-page error strip** — add/edit/delete success and every failure surface through the single bottom-centre `Toast` (`components/common/Toast.tsx`: click-through frame `fixed inset-x-4 bottom-40 z-[80]`, never inside `.overflow-y-auto`, above the `z-50` modals and below lock/blank; success `bg-green-600` auto-dismisses after `SUCCESS_TOAST_MS` and is click-through, error `bg-red-700` persists until tapped or ✕'d), success fires only after the awaited request (never on an optimistic write), a later successful mutation — including tap-to-complete, which raises no toast of its own — retires a standing error, one toast at a time (keyed remount), and **toast state stays outside `isRepullGated()`** (F21, shipped #46). `F18`'s scroll-to-top button (shipped #54, Standing invariant 17) **shares the toast's bottom-centre `bottom-40` line** — centred in the scroll-region frame, no z-index — so a toast (`z-[80]`, fixed, later in DOM) covers it while shown and it is usable again once the toast dismisses (the user's call on #54 over raising the button above the toast; this supersedes the earlier "bottom-right beside the toast" plan). `F22`'s list thumb (shipped #57, Standing invariant 18) **adds no bottom real estate**: it rides the frame's right edge (4 px wide, 2 px in), so it never meets the centred button; its track ends `LIST_THUMB_BOTTOM_INSET_PX` (96 px) above the frame bottom — level with the last bar, so its lower travel overlaps the deck's frosted overhang but never the deck itself; on the Pi (frame spans the viewport) it never meets the `fixed inset-x-4` toast, and on desktop viewports wider than 800 px (`#root` capped at 768 px and centred) a long toast pill can cover the lower track — harmless, the toast (`z-[80]`) paints above the z-index-free thumb. Any further feature that adds bottom real estate uses the same `bottom-40` clearance and must decide its relation to that shared line; anything that widens the modal or the blank/lock layers must keep the `z-50 < z-[80] < z-[90] < z-[100]` ladder.
15. **Sort ↔ bar status agreement**: `orderChores` (`utils/choreSort.ts`) buckets chores red / orange / green **only** via `classifyStatus(daysSince, frequency)` in `utils/choreBarMath.ts` — the one classifier `computeBar` also uses for `isOverdue` / `barColor` (colours from the single `STATUS_BAR_COLOR` map) — so sort, bar and every status consumer — including the shipped `F17` strip's `countStatuses` (#52, Standing invariant 16) and any future one — can never disagree; status thresholds change **only** there and in `statusColors` (never a copied `0.375` or `daysSince > frequency` literal elsewhere). `urgency` weights the **sort only** (`SORT_URGENCY_MULTIPLIER`, unset = `medium`), never bar colour or status. Ranking, fold quota and red escalation are tuned solely through the `SORT_*` constants in `assets/constants.ts` (`SORT_BASE_QUOTA` must sum to `SORT_FOLD` — test-pinned). **Re-sort triggers are unchanged:** first load (`reconcileChores`), local midnight and day-simulation steps (the `simulatedDate` effect) — **never** on completion, edit, SSE re-pull or unblank (F16, shipped #50).
16. **Live status-count strip under the room tabs**: `StatusCountStrip` renders directly after `NavBar` (before `DateNavigationBanner`), `flex-shrink-0`, outside `.overflow-y-auto`; its counts are `countStatuses(searchFilteredChores, simulatedDate)` — the *visible* list (room ∧ search) on the *displayed* day, recomputed from live chore data on every change and **never** from `sortedIds` (the strip is live while the list order stays midnight-only — deliberate). `daysSince === 0` is done today; otherwise status comes **only** from `classifyStatus` (Standing invariant 15) and colour **only** from `STATUS_BAR_COLOR` — no copied threshold or `bg-*-500` literal. Widths ∝ counts (`flexGrow = count`, `min-w-5` per non-zero segment), all three segments always mounted so a change animates with the bar's `transition-all duration-300 ease-in-out`; segments paint at `opacity-50` over a `bg-gray-800` track like the bar, labels bold white at full opacity; all-zero → a full green `0`; one `role="img"` `aria-label`/`title` on the root. The root must **never** gain `rounded-full` or `overflow-y-auto` (it would capture e2e's `.bg-gray-800.rounded-full` `.first()` and the tests' `.overflow-y-auto` first-match selectors), and its four `data-testid`s (`status-count-strip`, `status-count-done-today`, `status-count-due-soon`, `status-count-overdue`) are the test contract (F17, shipped #52). **Inset (`F22`, shipped #57):** with the outer column no longer padded, the root's `w-full` was **replaced** by `mx-4` (16 px inset — `w-full` + `mx-4` would overflow by 32 px; the column's `align-items: stretch` fills the row), keeping `rounded-sm` and today's look; the root class is exactly `flex flex-shrink-0 mx-4 h-5 mt-2 rounded-sm overflow-hidden bg-gray-800` (`StatusCountStrip.test.tsx` asserts the `mx-4`). Any later re-layout of the header rows keeps the strip's position and these rules and only revisits its inset.
17. **Floating scroll-to-top button**: `ScrollToTopButton` (`data-testid="scroll-to-top"`, `aria-label="Scroll to top"`, lucide `ArrowUp`, a 44 px opaque `bg-gray-800` `rounded-full` circle) is the last child of the `scroll-region-frame`, **never inside** `.overflow-y-auto`, positioned `absolute bottom-40 left-1/2 -translate-x-1/2` with **no z-index** — bottom-centre on the `F21` toast's line, which covers it while a toast shows (Standing invariants 12 + 14). Visibility comes from `useScrollPastThreshold(scrollRegionRef, SCROLL_TO_TOP_THRESHOLD_PX)` (passive `scroll` listener + one `scrollTop` read on attach; shows while `scrollTop > 80`); opacity fades with `transition-opacity duration-500` (`FADE_MS = 500`, kept equal to the class). The non-interactive state (`inert`, `aria-hidden`, `tabIndex={-1}`, `pointer-events-none`) applies at boot and otherwise only **after** a fade-out's `FADE_MS` has elapsed, so a tap mid-fade re-scrolls rather than completing the bar beneath; the boot/unblank view at the top is pixel-identical to pre-F18. Click → `scrollTo({ top: 0, behavior: 'smooth' })`, `'auto'` under `prefers-reduced-motion: reduce`, and nothing else (room, search, day offset untouched). It reads no lock state — screen-blank's root `inert` disables it, and it must keep working under `F20`'s permissive lock (F18, shipped #54); `F19`'s lock-time `scrollTop = 0` (#56, Standing invariant 19) drops it back below the threshold, so the unlock view has no stray button (test-pinned in `App.lockViewReset.test.tsx`). Its `data-testid`s (`scroll-to-top`, `scroll-region-frame`) and the frame's single-ref/single-frame rule are the test contract; smoke's `.bg-gray-800.rounded-full` bar locators must keep using `.first()` / `hasText` since the button also matches them.
18. **Fading overlay scrollbar + full-bleed scroll region**: no native scrollbar shows on the chore list or the Add/Edit form card — both scrollers carry `.scrollbar-none` (`index.css`; also on `NavBar`'s chip row) — and each has one indicator-only `OverlayScrollbar` (`data-testid="overlay-scrollbar"`, `aria-hidden`, `pointer-events-none`, no `role`, **no z-index**, never `bg-gray-800`) rendered in a positioned wrapper **after, never inside**, its scroller: the list's in `F18`'s `scroll-region-frame` between the scroller and `ScrollToTopButton` (reading the single `scrollRegionRef`; still one ref, one frame — Standing invariant 12), the form's in `ChoreForm`'s card-sized `relative w-full max-w-md` wrapper after the card (backdrop-click cancel unchanged). Geometry comes only from `computeThumbGeometry` over a track clamped to `[MIN_THUMB_PX = 24, track]` (list: bottom inset `LIST_THUMB_BOTTOM_INSET_PX = 96`, so at full scroll the thumb's bottom meets the last chore bar's bottom; form: top/bottom `FORM_THUMB_TRACK_INSET_PX = 12`, the `rounded-xl` radius); nothing renders when the scroller does not overflow. Visibility: `opacity-0` on mount (no flash — the boot/unblank view is pixel-identical), shown on every `scroll` event (its own passive listener, beside `F18`'s) and faded `IDLE_FADE_MS = 1000` after the last one (`duration-150` in / `duration-400` out, `FADE_IN_MS`/`FADE_OUT_MS` pinned to those literals; `motion-reduce:transition-none`). Programmatic scrolls (`F18`'s `scrollTo`, `F19`'s lock-time `scrollTop = 0` — Standing invariant 19, a filter shrinking a scrolled list) flash it — accepted, no "programmatic" flag. `ResizeObserver` use stays guarded (jsdom lacks it). It reads no lock state and must keep showing while a locked user scrolls under `F20`'s permissive lock. The outer column stays unpadded and the inset stays on the content rows (Standing invariants 12 + 16) (F22, shipped #57). Its `data-testid`, the thumb-before-button frame order and the exact scroller/card/wrapper classNames are the test contract; `e2e/overlay-scrollbar.spec.ts` pins the last-bar alignment in real Chromium.
19. **Lock-time view reset**: one `useEffect` on `[isLocked, idleExpiries]` in `App.tsx`, directly after the force-close-dialogs effect, returns the view to the canonical boot state when the touch lock **engages** (idle expiry or a manual `lock()` from the indicator) **and on every idle tick while locked** (each `idleExpiries` bump — `F20` keeps the board usable under the lock, so the view can drift again) — `if (!isLocked) return;` then **step 0** `setShowForm(false)` (closes an Add modal opened under the lock and then abandoned — the only dialog reachable while locked), then `scrollRegionRef.current.scrollTop = 0` (null-guarded, **instant, never smooth** — nobody is watching at an idle expiry), `setSelectedRoom('all')`, `setSearchQuery('')`, `setDayOffset(0)`. It runs on engage plus every idle tick while locked: **never on unlock** and **never on blank** (`isBlanked` is not referenced), while a lock that engages *under* a blank still resets (the lock timer keeps running under the blank, so the 06:00 wake shows the reset view). It reuses `F18`'s single `scrollRegionRef` — no new ref, frame, component, hook or state; the scroller's class string is unchanged by it. `setDayOffset(0)` re-sorts only when a simulation was active (via the existing `[simulatedDate]` effect — a day-simulation step, consistent with Standing invariant 15); with `dayOffset === 0` a lock never re-sorts. Step 0 deliberately discards an Add form abandoned under the lock (the same abandonment rule as the engage-time force-close), and closing it lets the existing `showForm` flush effect release any deferred re-pull; the four resets touch view state only, never chore data (not undoable). Its `scrollTop = 0` fires a native `scroll`, so `F22`'s list thumb flashes on lock — accepted, no programmatic flag (Standing invariant 18). The nine tests in `frontend/src/__tests__/App.lockViewReset.test.tsx` are the contract (F19, shipped #56; re-keyed by F20) — including `F20`'s *resets the view again at the next idle tick when it drifted while locked*, *an Add form opened under the lock and left open across the next idle tick is closed, and the four resets run* and *a manual lock from the indicator resets the view*. **Obligation it hands on:** `F15`, when it re-sources the lock from the pi-kiosk shell, must keep an **app-side `isLocked`** (plus the idle tick) feeding this effect (never delete the reset with the overlay) — *the kiosk owns the inactivity timer; the app owns what "locked" means for it*. Any flicker fix: under `F20` the reset runs on an unobscured board (no padlock or backdrop), so the Pi check is whether the instant jump is noticeable after a manual lock (someone is present) or an idle tick; any fix still gates the reset *inside* the lock, never moves it to unlock (see *`F19` follow-ups* (a)).

**Assumptions to revisit at planning time**
1. **Resolved (F4, shipped #38):** `better-sqlite3` bundles SQLite 3.51.3 (≥ 3.35), so `ALTER TABLE … DROP COLUMN` is available and the boot migration uses it — no table-rebuild fallback was needed. Re-verify only if `better-sqlite3` is ever downgraded.
2. Tap-to-complete + the simulation pointer-events guard + the SSE re-pull gate are primary; no new feature may regress them. `F1` (shipped) already coordinates this; `F2`'s implementation resolved the same concern for its own overlay (see item 7 below).
3. **Resolved (F4, shipped #38):** `details` was never rendered, and its removal shipped without a display change; the one user-visible change was the sort (long-term chores no longer pin to the bottom — Standing invariant 11).
4. **Resolved (F6, shipped #43):** its out-of-repo end state (the Pi/LAN rename) is applied and verified live; the deployment docs live in `deploy/pi/README.md` § LAN name and `plans/completed/local-url-alias/research/` (frozen 2026-09-20). The frozen Dockerization plan lives at `plans/completed/docker-raspberry-pi/`. *(The former host-bridge controls `F13`/`F7`/`F8`/`F10` migrated to pi-kiosk 2026-07-15 — their host-side end states are now that repo's concern; `F15`'s external gate — "pi-kiosk Phase 2 parity verified on the Pi" — is likewise verified outside this repo and recorded in `F15`'s own plan docs.)*
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

## Deferred follow-ups from merged features (confirmed, unscheduled — no F-ID yet)

- **Room `<datalist>` on mobile** *(from F3-L, #24; confirmed by user 2026-07-07)*: the
  suggestion dropdown does not appear on mobile even after tapping the `<datalist>` arrow —
  native `<datalist>` mobile support is inconsistent across browsers; likely needs a
  mobile-specific affordance or a custom-listbox fallback for touch. Small fix; assign an
  F-ID via `/new-feature` when scheduled.
- The add/edit/delete **UI-polish list** of 2026-07-08 (toasts, date/room defaults, the
  UTC-vs-local date-math bug) became `F21` and **shipped #46** (2026-09-22) — the `F2-L`
  kept contract that carried it was deleted at the fold-back; its facts live in the
  Baseline and Standing invariant 14. Six non-blocking push-review minors from `F21`
  (toast assertions on the delete/edit smoke tests; a cross-mutation error-clear unit test;
  `Toast` robustness to an unstable `onDismiss`; the `defaultRoom` doc-comment wording; a
  `console.error` for swallowed background re-pull failures in `loadChores`; the accepted
  mount-time date default) were harvested into `plans/PUSH-REVIEW-FINDINGS.md` (section
  F21) by the 2026-09-22 sweep (#48).
- **`F16` follow-ups** *(from #50, 2026-09-22)*: (a) **on-Pi tuning of the sort constants**
  — `SORT_FOLD`, `SORT_BASE_QUOTA`, `SORT_PRESSURE_THRESHOLD` and `SORT_URGENCY_MULTIPLIER`
  in `frontend/src/assets/constants.ts` are first guesses (F16's open risk (a)); tune them
  with real household data via the day simulator and record the final values in that file
  (keep the `SORT_BASE_QUOTA` sum `=== SORT_FOLD` test green). (b) Five non-blocking
  push-review minors (compute `remainingRatio` once, rename the `s` callback in
  `classifyStatus`, a test pinning `statusColors`' `-Infinity` last threshold, a
  `.gitignore` comment for `graphify-out/*`, an optional e2e fold-order assertion) sit in
  `plans/feature/status-bucketed-sort/reviews/push-review-feature-status-bucketed-sort.md`
  until `/compact-plans` harvests them. (c) **Declined by the user — do not re-propose:**
  hardening an Invalid-Date `dateLastCompleted` (which yields a `NaN` orange rank key) in
  `orderChores`.
- **`F17` follow-ups** *(from #52, 2026-09-23)*: (a) **eyeball the strip on the Pi** — its
  `h-5` height, the white-on-`opacity-50` label contrast and the width animation were
  judged only in the browser (F17's open risks (a)/(b)); adjust in
  `components/nav/StatusCountStrip.tsx` if the wall display needs it, keeping Standing
  invariant 16. (b) Four non-blocking push-review minors (make `SEGMENTS` exhaustive over
  `StatusCounts` via `satisfies`; choose `showsZero` by key rather than `index === 0`;
  stable test IDs for each segment's fill and label instead of DOM-structure lookups; a
  shrink-to-zero rerender identity test beside the grow one) sit in
  `plans/feature/status-count-strip/reviews/push-review-feature-status-count-strip.md`
  until `/compact-plans` harvests them.
- **`F18` follow-ups** *(from #54, 2026-09-23)*: (a) **accepted, observe on the Pi** — the
  centred button covers the middle 44 px of whichever bar sits in its band (≈ 160–204 px
  above the scroll region's bottom) while visible — confirm a touch starting on it neither
  completes that bar nor starts its swipe — and a toast covers the button while
  shown; the 500 ms fade was matched to desktop Chromium's smooth-scroll timing, not the
  Pi's. Adjust in `components/common/ScrollToTopButton.tsx` if the wall display needs it,
  keeping Standing invariant 17. (b) Four non-blocking push-review minors (a unit click
  during the fade-out asserting a second `scrollTo`; an optional dev-only warning for a
  null ref in `useScrollPastThreshold`; seeding `isInteractive` from the initial DOM read to
  remove a one-render mount lag; revisiting the lockstep `aria-hidden`/`tabIndex`/`inert`
  toggles only if the spec relaxes) sit in
  `plans/feature/scroll-to-top/reviews/push-review-feature-scroll-to-top.md` until
  `/compact-plans` harvests them. (c) **Rejected — do not re-propose:** a scroll-to-top
  button inside the frosted deck beside Add Task (couples two unrelated actions), tapping
  the date heading (undiscoverable; collides with the day-simulation chevrons), and raising
  the button above the toast (the user chose "toast covers it" on #54).
- **`F19` follow-ups** *(from #56, 2026-09-23)*: (a) **accepted, observe on the Pi** — under
  `F20` the reset runs on an unobscured board (no padlock, no backdrop); confirm on the Pi
  whether the instant jump is noticeable after a manual lock (someone is present) or an idle
  tick; if it is, gate the reset with `CLOSING_SETTLE_MS`-style timing *inside* the lock —
  never move it to unlock; the `NavBar` room-tab strip's
  horizontal `scrollLeft` is **not** reset, so with many rooms the *All* chip could stay
  scrolled off-screen (out of scope — file a follow-up via `/new-feature` if seen); `F22`'s
  thumb flashes on the programmatic `scrollTop = 0` — accepted, no programmatic flag
  (Standing invariant 18; see *`F22` follow-ups* (a)). Keep Standing invariant 19 when
  adjusting. (b) Four non-blocking push-review minors (reuse the `driftView()` /
  `getSearchInput()` / `getScrollRegion()` helpers in the first test; add a
  lock-during-loading test exercising the `scrollRegionRef.current` null guard; add an
  already-locked-mount test — optional until `F20` re-keys the effect; expect a META-PLAN
  Status-ledger conflict with `F22`'s branch and keep both rows' edits — moot now that both
  merged) sit in
  `plans/feature/lock-view-reset/reviews/push-review-feature-lock-view-reset.md` until
  `/compact-plans` harvests them. (c) **Rejected — do not re-propose:** resetting on
  *unlock* (stale state behind the padlock for the whole locked period, and the view would
  jump under the unlocking finger); an app-owned 5-minute idle timer sharing
  `useTouchLock`'s listeners (the user prefers the app to *react to* the lock signal, not
  run a parallel timer); resetting on blank as well (lock covers it in practice).
- **`F22` follow-ups** *(from #57, 2026-09-23)*: (a) **observe on the Pi** (the PR's manual
  checks; headless e2e cannot see scrollbars) — the native gutter is really gone (bars widen
  by the old scrollbar width); the frost reaches both screen edges while tabs, strip, banner,
  search and bars keep their 16 px inset and the `NavBar` divider spans the width; the thumb
  tracks touch momentum, fades ≈ 1 s after the list stops, and ends level with the last bar;
  no dropped frames while scrolling (if there are, add a `requestAnimationFrame` throttle to
  `hooks/useScrollIndicator.ts` — measure first); the thumb's flash on a programmatic scroll
  (scroll-to-top, lock-time reset, a filter shrinking a scrolled list) reads as acceptable,
  not noise (else gate it behind a "programmatic" flag); the form's thumb stays inside the
  card's corners and a tap beside the card still cancels. Adjust in
  `components/common/OverlayScrollbar.tsx` / `hooks/useScrollIndicator.ts` / `App.tsx`,
  keeping Standing invariant 18. (b) Four non-blocking push-review minors (make the test
  assert the className contains `duration-${FADE_IN_MS}` / `duration-${FADE_OUT_MS}` — or
  drop the constants — so the fade constants cannot drift from the literals; named `px-4`
  inset assertions in `ChoreSearchInput.test.tsx` and `DateNavigationBanner.test.tsx`;
  overscroll-clamp cases (`scrollTop < 0`, `scrollTop = scrollHeight`) for
  `computeThumbGeometry`; a discriminated-union return for `useScrollIndicator` only if a
  second consumer appears) sit in
  `plans/feature/overlay-scrollbar/reviews/push-review-feature-overlay-scrollbar.md` until
  `/compact-plans` harvests them. (c) **Rejected — do not re-propose:** a native-scrollbar
  restyle or a kiosk-only Chromium flag instead of the in-app thumb, a draggable thumb,
  a mount flash, making *everything* full-bleed (pill bars against the screen edge) or
  bars full-bleed with header rows inset, and stopping the list thumb above the deck
  frost (the user replaced that 160 px stop with the last-bar alignment on #57); the
  strip's `mx-4` inset was the user's choice over full-bleed.

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

## F2 — Double-tap accidental-touch lock  ·  merged (#28, `3160dfc`)  ·  kept: `F15` must remove this code and pi-kiosk Phase 2 must reproduce it (parity checklist)  ·  **reworked by `F20`** — this section *is* `F20`'s kept contract for `F15`; Phase C folds `F20` here and adds no separate `F20` entry

**Implemented contract (as built after `F20`'s permissive rework — Standing invariant 9):**
`frontend/src/hooks/useTouchLock.ts` — a stateful hook exposing
`{ isLocked, arm, lock, idleExpiries }`; a 5-minute inactivity timer (armed on mount so a
fresh load starts unlocked) re-armed by `document`-level `pointerdown`/`keydown` and kept
running while locked — every expiry locks and bumps `idleExpiries`, then re-schedules itself;
`arm()` unlocks and restarts the countdown; `lock()` locks at once (manual lock) without
bumping the tick. `frontend/src/components/common/TouchLockIndicator.tsx` — the ≥ 44 px
lock/unlock `<button>` at `fixed top-2 left-2` `z-40` (`aria-label` `"Lock screen"`/`"Unlock
screen"`, single tap toggles), raised to `z-[95]` while a padlock shows (`raised`) so a corner
tap unlocks; no longer the old `z-[80]` `pointer-events-none` state icon.
`frontend/src/components/chore/ChoreTimerBar.tsx` — the guard: while `isLocked`, a tap, a
horizontal swipe and the sr-only Edit/Delete buttons call `onGuardedAttempt(point)` instead of
completing/editing/deleting (the bar never moves or dims).
`frontend/src/components/common/TouchLockOverlay.tsx` — a non-blocking `z-[90]` portal
(`pointer-events-none` full-viewport root; only a 120 px padlock hit circle around the tap
catches taps, so the board stays usable while it shows) that
`App.tsx` mounts only on a guarded attempt (`lockAttempt`), seeded with it as the first tap; a
second tap on the circle within `SECOND_TAP_WINDOW_MS = 1500` (`SECOND_TAP_MAX_DISTANCE_PX = 60`
is its radius) unlocks (`CLOSING_SETTLE_MS = 400` handshake, carried by `lockAttempt`); otherwise it fades
and calls `onDismiss`. `App.tsx` wiring: app root `inert={isBlanked}` only; the overlay
renders when `lockAttempt && !isBlanked` — **blank always wins** (`z-[100]` vs `z-[90]`);
open dialogs force-close on lock/blank, and the edit modal and `ConfirmDialog` are also gated
on `!isLocked`; the Add form stays usable while locked. **Scope as resolved (2026-07-08):
local-only / per-browser-tab** — no backend state, no SSE event, no cross-device sync (the
ledger's original "no matter which device" framing was explicitly decided otherwise; a
shell-side lock in pi-kiosk carries the same local-to-the-kiosk semantics forward).

**What `F15` removes and pi-kiosk reproduces.** The inactivity timer, the `isLocked`
state and the lock/unlock indicator move to the pi-kiosk shell (`useTouchLock` and
`TouchLockIndicator` leave the app); the guard and the padlock stay in the app — the
`ChoreTimerBar` `onGuardedAttempt` path, `TouchLockOverlay` and the `!isLocked` dialog gate,
fed by an app-side `isLocked` plus the idle tick from the shell (which also keeps feeding
Standing invariant 19's reset). `NavBar`'s `pl-14` left gutter exists only to clear the
in-app 44 px indicator: when `F15` removes the indicator it reverts the gutter to `px-4` (or
keeps it if the shell's control overlays the same corner) and updates, either way,
`App.test.tsx`'s full-bleed test (the `pl-14`/`pr-4` assertions and the `child !== navBar`
inset-loop exclusion) and Standing invariant 12's `NavBar` clause.

**Known follow-up:** relocation to the pi-kiosk shell (Phase 2), then removal here via
`F15` — see `plans/feature/kiosk-shell-extraction/kiosk-shell-extraction.md`.

## F19 — Lock-time view reset  ·  merged (#56, `fca7118`)  ·  kept: `F15` must keep an app-side `isLocked` feeding it

**Implemented contract (as built, re-keyed by `F20`):** Standing invariant 19 — one
`[isLocked, idleExpiries]` effect in `frontend/src/App.tsx`, after the force-close-dialogs
effect: on the lock *engage* (idle or manual `lock()`) and on every idle tick while locked
(never unlock, never blank; a lock under a blank still resets) it first closes an Add form
left open under the lock (step 0, `setShowForm(false)`), then sets
`scrollRegionRef.current.scrollTop = 0` (null-guarded, instant), `selectedRoom` → `'all'`,
`searchQuery` → `''`, `dayOffset` → `0` (re-sorting only if a simulation was active). Tests:
`frontend/src/__tests__/App.lockViewReset.test.tsx` (9, real `useTouchLock` + fake timers).
Kept here because `F15` still targets it.

**What `F15` must keep.** The governing principle: **the kiosk owns the inactivity timer;
the app owns what "locked" means for it.** A `locked` signal does not mean no interaction
is possible — only that certain actions are guarded. When `F15` removes the `F2`
overlay/timer (or, after `F20`, moves the timer/state/indicator to the shell), it keeps a
minimal app-side `isLocked` fed by the shell (`kiosk/v1` `kiosk-state { locked }` plus the
idle tick, DD-3 — or an interim source until Phase 4; `F15` Open risks (e)/(f)) and re-keys
this effect to it. Deleting the reset along with the overlay would regress Standing
invariant 19. `F19` itself deliberately added no `kiosk/v1` listener (the contract is
Phase 4).

**Delete this entry** once `F15` has shipped and folded its part into
Standing invariant 19.

---

# REMAINING FEATURES (current numbering, incl. `F15`–`F22`)

> Every remaining feature's **Assumed starting state is the Baseline above**. `F1` (#27)
> and `F2` (#28) shipped — their implemented contracts are kept under Completed-Feature
> Contracts (below) because `F15` targets them; `F14` (#34), `F4` (#38) and `F5` (#39) shipped
> and live entirely in the Baseline + Standing invariants 10–12 (no remaining feature builds on
> them); `F6` (#43) shipped and lives in the Baseline's *Deployment* paragraph + Standing
> invariant 13; `F21` (#46) shipped and lives in the Baseline's *Date semantics* paragraph,
> the `App.tsx` / `components/form/` / `Toast.tsx` Key-UI bullets and Standing invariant 14;
> `F16` (#50) shipped and lives in the Baseline's **Sort** paragraph and Standing invariant 15;
> `F17` (#52) shipped and lives in the Baseline's `StatusCountStrip` Key-UI bullet and
> Standing invariant 16; `F18` (#54) shipped and lives in the Baseline's `ScrollToTopButton`
> Key-UI bullet, the `App.tsx` bullet's scroll-region-frame paragraph and Standing
> invariants 12, 14 and 17; `F22` (#57) shipped and lives in the Baseline's `OverlayScrollbar`
> Key-UI bullet, the `App.tsx` bullet's full-bleed paragraph, the `components/form/` and
> `StatusCountStrip` bullets and Standing invariants 12, 14, 16 and 18; `F19` (#56) shipped
> and lives in the `App.tsx` Key-UI bullet's lock-time-view-reset paragraph and Standing
> invariant 19, with its contract also kept under Completed-Feature Contracts because `F15`
> must keep feeding it.
> The **focus feature is `F20` — ungated, runnable now** (see "Shortest path" above); `F15` is the gated kiosk-track head. `F3`/`F7`/`F8`/`F9`/`F10`/`F13`
> are **superseded — migrated to `rehankalu/pi-kiosk`** (2026-07-15, see
> `plans/feature/kiosk-shell-extraction/kiosk-shell-extraction.md`); their sections below
> are retained as banners + history only. `F11`/`F12` remain here, re-scoped; `F15` is new;
`F16`–`F21` were added 2026-09-20 (`F20` reworks the shipped `F2` lock; `F21` promoted the
`F2-L` follow-up list, held the ★ and shipped #46 on 2026-09-22; `F16` then held the ★ and
shipped #50 on 2026-09-22; `F17` then held the ★ and shipped #52 on 2026-09-23; `F18` then
held the ★ and shipped #54 on 2026-09-23; `F19` shipped #56 on 2026-09-23 without holding
the ★ — none of the five has a section below, `F19`'s kept contract aside); `F22` was
added singly later that day, then held the ★ and shipped #57 on 2026-09-23 (no section below
either).

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

## F15 — Adopt kiosk-shell (remove F1/F2 overlays + embeddability guarantee)  ·  kiosk-track head — gated (★ moved to `F21` 2026-09-20, then to `F16` at `F21`'s 2026-09-22 fold-back, then to `F17` at `F16`'s 2026-09-22 fold-back, then to `F18` at `F17`'s 2026-09-23 fold-back, then to `F22` at `F18`'s 2026-09-23 fold-back, then to `F20` at `F22`'s 2026-09-23 fold-back)  ·  Effort M  ·  (added 2026-07-15)

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
  **`F19` shipped first (#56):** its lock-time view reset must *survive* — the app keeps an
  app-side `isLocked` state (no overlay, no timer of its own) fed by the shell, and `F19`'s
  effect is re-keyed to it; see Open risks (e) and the `F19` kept contract. Deleting the
  reset along with the overlay would regress Standing invariant 19.
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
(e) **App-side meaning of "locked" (principle set by `F19`, 2026-09-20; shipped #56 —
Standing invariant 19):** *the kiosk owns
the inactivity timer; the app owns what "locked" means for it.* A `locked` signal — today
`useTouchLock`'s `isLocked`, after this feature the shell's `kiosk/v1` `kiosk-state {
locked }` message (design doc DD-3) — does **not** necessarily mean no interaction is
possible with the app, only that certain actions are guarded by the lock (`F19`'s shipped
view reset is the first such app-side behavior; the blanket `inert` gate is today's
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
the second-tap detection, and the shipped `F19` reset. Contract additions to specify in the design doc
(DD-2/DD-3 amendment) when this feature plans: shell → app `kiosk-state { blanked, locked }`
(already in DD-3) plus an idle-expiry tick while locked (for the re-keyed `F19` reset); app → shell
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

## F20 — Permissive touch lock (rework of shipped `F2`)  ·  ★ FOCUS — runnable now (ungated; first in the chore-list soft order since `F22` shipped #57)  ·  Effort M  ·  (added 2026-09-20)

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
  `idleExpiries` counter or an `onIdle` subscription). **`F19` shipped first (#56)**, keyed
  off `isLocked` alone, so `F20` re-keys its effect: it also re-runs the view reset on
  every tick while locked and on a manual `lock()`, and each tick first closes an Add modal
  left open under the lock (step 0) — Standing invariant 19 and the `F19` kept contract.
  The hook also exposes `lock()` for the indicator control. `INACTIVITY_MS`
  stays 5 min. `isLocked` semantics (engage on expiry, `arm()` unlocks + re-arms) are
  unchanged so `F19`'s shipped engage trigger still works.
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

**Rank rationale.** ★FOCUS since 2026-09-23, when `F22` — the ★ since `F18`'s fold-back —
shipped #57 and the ★ advanced to the next soft-order item (see *Where the rollout
stands*). Ungated; the biggest day-to-day feel change of the batch and the one that
reshapes `F15`/pi-kiosk DD-2 — worth settling before `F15` plans. It sat after `F18` and
`F22` (both shipped) because it is larger and touches the lock suites. It was meant to
precede `F19` so `F19` could consume the idle tick once; `F19` shipped first (#56), so
`F20` now carries the re-key of `F19`'s effect as part of its own scope.

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
- `ChoreTimerBar.tsx`: `isSimulating` guard on `resetTask`, `onSwiping` and `onSwiped`
  (not on `onTouchStartOrOnMouseDown`, which only resets `swipingRef`)
  (the pattern to mirror for `isLocked`, minus the dimming classes).
- `useTouchLock.ts`: activity listeners attached only while `!isLocked` (the line to change).
- `F18` shipped (#54): its button lives in the `scroll-region-frame` outside
  `.overflow-y-auto`, reads no lock state, and must stay usable under the lock (Standing
  invariant 17) — today the app root's lock `inert` disables it, which `F20` lifts.
- `F19` shipped (#56): the `[isLocked]` lock-engage effect sits right after the
  force-close-dialogs effect in `App.tsx` (its comment carries the `F20` note) and keys off
  `isLocked` alone — `F20` adds the idle tick + manual lock + close-Add-modal step 0
  (Standing invariant 19); `App.lockViewReset.test.tsx` (6 tests) drives the real
  `useTouchLock` with fake timers.
- `F22` shipped (#57): the list and form `OverlayScrollbar`s read no lock state and are
  `pointer-events-none` + `aria-hidden` (Standing invariant 18), so lifting the lock's
  `inert` needs nothing from them; once scrolling works under the lock, the list thumb
  shows while a locked user scrolls — as it should.

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
- `F19`'s lock-view-reset effect in `App.tsx` also re-runs on each idle tick while locked
  and on a manual lock, and each tick first closes an Add modal left open under the lock;
  its `F20` code-comment note is resolved (removed or rewritten as-built).
- Tests: guard on tap/swipe while locked (and not while unlocked); blocked-tap-then-second-
  tap unlocks and the *second* tap does not complete the chore; no second tap → overlay
  hidden after 1500 ms and still locked; indicator single-tap locks (immediately) and
  unlocks; search / room / day-sim / Add Task + submit work while locked (App-level);
  scroll container not `inert` while locked; blank still wins over the padlock; idle tick
  increments every 5 min while locked and resets on activity; `F18`'s scroll-to-top button
  works while locked (App-level); view drifted while locked → reset at the next idle tick,
  and an Add form opened under the lock and left open across a second tick → closed (and
  the four resets ran); `F22`'s suites still pass; `F18`'s suites and `F19`'s six
  `App.lockViewReset` tests still pass with the new semantics.
- Standing invariants 9 and 19 rewritten to this contract (and the `F19` kept-contract
  entry trimmed to what `F15` still needs); the `F2` kept-contract section rewritten
  to the as-built shape; README's touch-lock paragraph describes the permissive lock and
  the indicator control.
- e2e: `e2e/smoke.spec.ts` — verify nothing waits on the lock (none expected).

**Open risks / decisions.** (a) **Seeding the first tap from a swipe:** use the gesture's
start point (`initial` from `react-swipeable`'s event data) so a follow-up tap on the same
bar qualifies within 60 px. (b) **Lock engaging with the Add form open:** the existing
force-close-dialogs effect closes it on engage; keep that (5 minutes idle with a half-typed
form is abandonment, and the shipped `F19` effect resets the view at the same moment) — but do **not** close
it on a *manual* lock from the indicator if the form is open (the person is present);
decide at planning, default: manual lock also closes it for simplicity. The same
abandonment rule covers a form opened *under* the lock: every subsequent idle-expiry tick
closes it too (step 0 of the re-keyed `F19` reset — Standing invariant 19), since the transition-keyed effect never re-fires. (c) **Dialogs
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

## Chain integrity (remaining work, current numbering, incl. `F15`–`F22`)

```
CHORE-LIST TRACK (re-opened 2026-09-20; F14 shipped #34, F4 shipped #38, F5 shipped #39, F21 shipped #46, F16 shipped #50, F17 shipped #52, F18 shipped #54, F19 shipped #56, F22 shipped #57 — the 2026-07-08 order F14 → F4 → F5 and the 2026-09-20 "F21 first" then F16 → F17 → F18 → F22 order are honored by history; F19 ran ahead of its soft slot after F20)
  ★ F20 (permissive touch lock, reworks shipped F2) — no prerequisites, runnable now; drops the lock's inert gate; exposes the idle tick; re-keys the shipped F19 reset to it (+ manual lock, + close-Add-modal step 0)

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
  sequencing now. What remains here: the chore-list track holds one ungated item, `F20`
  (`F19`, soft-ordered after it, shipped first as #56, so `F20` re-keys it;
  its earlier soft `F14` → `F4` → `F5` preference of 2026-07-08 was honored — #34, #38,
  #39 — and the 2026-09-20 "`F21` first" preference by #46, then `F16` by #50, `F17` by #52, `F18` by #54 and `F22` by #57), and two **external** gates (`F15` on pi-kiosk Phase 2 parity; `F11`/`F12` on Phase
  4's `kiosk/v1` contract, with `F12` also following `F11`). The infra track completed with
  `F6` (#43).
- **Focus path:** `F20` — ★FOCUS, ungated, the next session (`/run-feature F20`); it is the
  last ungated chore-list item (`F19`, its former soft successor, shipped #56). `F15` is the gated kiosk-track head
  (pi-kiosk Phase 2 parity) and takes the ★ back once the chore-list items are gone;
  `F11`/`F12` follow on Phase 4. The 2026-09-20 capture batch is closed — no deferred
  re-evaluation remains.
- **Cross-feature couplings to honor:**
  - **`daysSince` consumers (the shipped F16 sort, the shipped F17 strip, `ChoreTimerBar`) ↔
    the shipped F21 boundary (Standing invariant 14):** the form now means local midnight in
    / local calendar day out; `choreSort.ts`, `ChoreTimerBar.tsx` and
    `utils/choreStatusCounts.ts` keep the same
    `differenceInDays(startOfDay(today), startOfDay(date))` expression before calling the
    shared `classifyStatus`. No consumer may add a UTC `startOfDay` or any other timezone
    "fix" in-band — it would double-correct. (This is the former `F2-L` follow-up #4; `F16`
    and `F17` both shipped without re-fixing it, and no later consumer may either.)
  - **The shipped F18 button ↔ the shipped F21 `Toast` (bottom real estate, Standing
    invariants 12, 14 + 17):** the toast's frame is fixed against the viewport at
    `bottom-40` (deck + 4 rem overhang), pill centred; `F18`'s button (#54) sits on the
    same bottom-centre `bottom-40` line in the scroll-region frame, with no z-index, so a
    toast (`z-[80]`) covers it while shown — deliberate (the user's call on #54). Both repeat
    the `bottom-40` figure (no shared constant exists; each documents the arithmetic inline)
    and neither lives inside `.overflow-y-auto`.
  - **F20 ↔ the shipped F21 `Toast` (lock):** Add Task is allowed while locked, so its success
    toast shows under the lock (the toast never reads `isLocked`); it paints below the
    padlock (`z-[80]` < `z-[90]`) and below blank; `F20`'s plan adds the "success toast
    for an add made while locked" test `F21` deferred to it.
  - **F11/F12 ↔ the shipped F21 `Toast`:** an undo/redo is a mutation like add/edit/delete —
    whether it raises a toast is `F11`'s call (recommended: `Undone "<name>"` via the same
    component and `showToast`).
  - **The shipped F17 strip ↔ the shipped F16 sort (trigger asymmetry, deliberate —
    Standing invariants 15 + 16):** both classify through the one `classifyStatus`; the
    strip is *live* (recomputed from the visible chore data on every change), the list
    *order* is midnight-only. A completed chore therefore turns green and moves into the
    strip's green segment immediately while staying in place in the list until midnight —
    the intended feel, not a bug. Any future status consumer joins the same classifier.
  - **F11/F12 ↔ the shipped F17 strip (Standing invariant 16):** an undo/redo changes
    `dateLastCompleted`, so the strip's counts move with it live, exactly like a
    completion — no strip change needed.
  - **The shipped F18 button ↔ F5 (Standing invariants 12 + 17):** the button floats in the
    scroll region's *frame* (`scroll-region-frame`, #54), never inside `.overflow-y-auto`
    (that element stays the single scroller and keeps its class — `App.search.test.tsx`
    locates it by it and `F18`'s App test pins it exactly); it sits at `bottom-40`, above
    the deck's footprint **plus** the 4 rem overhang, so it is never under the frost; no
    z-index anywhere — later-in-DOM positioning is enough. Any change to the deck height or
    overhang re-checks the button's `bottom-40` alongside `scroll-pb-*`.
  - **The shipped F18 button ↔ swipe bars (F10-L):** the bottom-centre button covers the
    middle 44 px of whichever bar is in its band while visible (accepted, #54); once its
    fade-out ends it is `pointer-events-none` + `inert`, so touches reach the bars; a tap
    mid-fade lands on the button and only re-scrolls. Any later floating control must
    likewise never fire *and* start a bar swipe (see *`F18` follow-ups* for the Pi check).
  - **The shipped F22 thumb / the shipped F19 reset ↔ the shipped F18 frame + ref (Standing
    invariants 12, 17, 18 + 19):** the one `scroll-region-frame` holds, after the scroller, `F22`'s list thumb
    and then `F18`'s button (the frame's last child); `scrollRegionRef` is the one ref
    (`F18` reads `scrollTop` and calls `scrollTo`, `F22` reads the scroll metrics and
    listens to `scroll`, `F19` writes `scrollTop = 0` on lock since #56) — never two frames, never two refs. Thumb (right
    edge) and button (bottom-centre) cannot overlap. `F19`'s programmatic `scrollTop = 0` fires
    `scroll` in a browser (not in jsdom — tests `fireEvent.scroll`), so the thumb flashes on lock —
    accepted at `F22` (#57), no programmatic flag (see *`F22` follow-ups* for the Pi check).
  - **The shipped F22 full-bleed region ↔ F5 + the shipped F17 strip (Standing invariants
    12, 16 + 18):** the column is unpadded, so the deck backing's `inset-x-0` frost and the
    scroller reach the screen edges while the header rows, the strip (`mx-4`) and
    `ChoreList` carry the inset; deck height, overhang and `scroll-pb-40` are unchanged, and
    `LIST_THUMB_BOTTOM_INSET_PX` joins the re-check list for any change to the deck's height
    or `ChoreList`'s bottom padding. No z-index anywhere — the thumb paints over the frost by
    DOM order.
  - **The shipped F22 thumb ↔ swipe bars (F10-L, Standing invariant 3):** with the native
    gutter gone the bars widen to the full width minus the inset; the thumb over a bar's
    right end is `pointer-events-none`, so it cannot steal a swipe — the on-Pi swipe-left
    check sits under *`F22` follow-ups*.
  - **F20 ↔ the shipped F22 thumbs (Standing invariant 18):** the thumbs are
    `pointer-events-none` + `aria-hidden` and read no lock state, so `F20` changes nothing
    in them; once scrolling works under the lock, the list thumb shows while a locked user
    scrolls — as it should.
  - **F20 ↔ F2 (Standing invariant 9):** `F20` *amends the shipped contract* — same
    hook, overlay and indicator files, same 5-min timer, same 1500 ms / 60 px double-tap
    window, same blank precedence; what changes is *when* the overlay shows (on a blocked
    attempt only), *what* is blocked (complete / edit / delete only), the `inert` gate
    (blank-only afterwards), the indicator (a single-tap lock/unlock control) and the timer
    (runs while locked). Invariant 9 and the `F2` kept-contract section are rewritten to
    `F20`'s as-built shape when it ships.
  - **F20 ↔ the shipped F19 reset (idle tick, Standing invariant 19):** `F20` keeps the
    inactivity timer running while locked and exposes each expiry. The intended soft order
    `F20` → `F19` was reversed — `F19` shipped first (#56) keyed off `isLocked` alone — so
    **`F20` re-keys `F19`'s effect**: the reset re-runs on every tick and on a manual lock
    from the indicator (an engage), and each tick first closes an Add modal left open under
    the lock (step 0). `F20` owns the tests for both (see the `F19` kept contract).
  - **F20 ↔ the shipped F18 button (Standing invariant 17):** scrolling is allowed while
    locked, so `F18`'s button must work under the lock (no `inert`, no guard) — `F20` runs
    second, so the test is `F20`'s.
  - **F20 ↔ F10-L swipe infra (Standing invariant 3):** the lock guard mirrors the
    `isSimulating` early-returns in `ChoreTimerBar`'s swipe callbacks; bars do not move
    while locked, `swipingRef` click-suppression stays, and no dimming classes are added
    for the locked state.
  - **F20 ↔ F5 / F14 / F9-L (allowed surfaces):** Add Task (deck button + form + submit),
    the search input + its clear-✕, and the room tabs all work while locked — none of them
    may read `isLocked`.
  - **F20 ↔ F15 / pi-kiosk (cross-repo):** `F20` retires DD-2's all-input-blocking shell
    overlay. Split after `F15`: shell = timer + lock state + indicator control; app = guard
    + padlock + second-tap detection + the shipped `F19` reset. Messages: `kiosk-state { locked }` +
    an idle tick in, `lock-request { locked }` out — `kiosk/v1`, Phase 4 (`F15` Open risks
    (f)). The parity checklist for the lock half is `F20`'s contract.
  - **F20 ↔ F11/F12:** independent — undo/redo are console actions on chore data; whether
    the shell's console is reachable while locked is a pi-kiosk decision, not this repo's.
  - **The shipped F19 reset ↔ F2 (Standing invariants 9 + 19):** since #56 the reset is
    keyed directly off `useTouchLock`'s `isLocked` *engage* transition (`F20`'s idle tick
    joins it when `F20` re-keys it) — never unlock, never blank. It adds app-side meaning
    to "locked" beyond the `inert` gate; the lock contract itself (timer, double-tap unlock,
    z-order) was untouched by `F19` (it is `F20` that amends it).
  - **The shipped F19 reset ↔ F15 (cross-repo principle, Standing invariant 19):** *the
    kiosk owns the inactivity timer; the app owns what "locked" means for it.* When `F15`
    removes the `F2` overlay/timer, it must keep an app-side `isLocked` state fed by the
    shell (`kiosk/v1` `kiosk-state { locked }` + idle tick, DD-3 — or an interim source
    until Phase 4; `F15` Open risks (e)) and re-key `F19`'s reset to it. A `locked` signal
    does not mean "no interaction possible", only "certain actions are guarded"; pi-kiosk's
    shell must therefore forward the lock state to the app, not merely overlay it.
  - **The shipped F19 reset ↔ the shipped F18 ref + button (Standing invariants 17 + 19):**
    `F19` reuses `F18`'s `scrollRegionRef` (#54) — no second ref; its `scrollTop = 0` also
    hides `F18`'s button, pinned by `App.lockViewReset.test.tsx` (`fireEvent.scroll(region)`
    after the write, and `vi.advanceTimersByTime(FADE_MS)` before asserting
    `inert`/`aria-hidden`).
  - **The shipped F19 reset ↔ the shipped F17 strip (Standing invariant 16):** resetting
    room → All and search → '' widens the visible list (and day → today moves the displayed
    day), so the strip's counts jump to today's whole-board figures on lock — live, as
    designed; `F19` changed nothing in the strip.
  - **The shipped F19 reset ↔ the shipped F16 sort (re-sort rule, Standing invariants 15 +
    19):** the day → today reset re-sorts *only* when a simulation was active (it is a
    day-simulation step, the same path as Return-to-today — test-pinned); a lock with
    `dayOffset === 0` never re-sorts — "unblank/lock never re-sorts" still holds for the
    normal case.
  - **The shipped F19 reset ↔ F11/F12:** independent — the reset touches view state only,
    never chore data, so it is not an undoable action and must not enter the undo cache.
  - **F11/F12 ↔ the shipped F16 sort (Standing invariant 15):** an undo that restores an earlier `dateLastCompleted` is a mutation
    like any other — it does **not** re-sort (sticky order until midnight); the undone
    chore keeps its position and its bar simply re-colours.
  - **F15 ↔ the shipped F16 sort:** independent. "Unblank never re-sorts" is a chores4irl fact that holds
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
  - From **F21** *(shipped #46 — Standing invariant 14)*: local calendar days at the form
    boundary, add-mode defaults, the single bottom `Toast` (success auto-dismisses and is
    click-through; error persists until tapped/✕'d; a later successful mutation retires it),
    no top-of-page error strip, toast state outside the SSE re-pull gate.
  - From **F16** *(shipped #50 — Standing invariant 15)*: list order is a status-bucketed,
    quota-filled ordering that (i) classifies status with the bar's own `classifyStatus`,
    (ii) ranks reds monotonically by urgency-scaled overdue ratio, (iii) shows
    most-recently-completed greens first, (iv) escalates the red quota deterministically
    with neglect, and (v) still changes only on first load, at midnight and on
    day-simulation — never on completion, SSE re-pull or unblank.
  - From **F17** *(shipped #52 — Standing invariant 16)*: a status-count strip sits
    directly after `NavBar` showing done-today / due-soon / overdue for the visible
    (room ∧ search) list on the displayed day, classified by `classifyStatus`, widths ∝
    counts with all segments mounted and animated, bar-colour tokens at the bar's
    `opacity-50`, live from chore data (never `sortedIds`), all-zero → full green `0`.
  - From **F18** *(shipped #54 — Standing invariants 12, 14 + 17)*: a floating
    scroll-to-top control sits bottom-centre in the single `scroll-region-frame` (last
    child, never inside the scroller, no z-index) on the toast's `bottom-40` line (a toast
    covers it); hidden and non-interactive at the top of the list, it fades in past 80 px,
    stays tappable until its 500 ms fade-out ends, and scrolls the one `scrollRegionRef`
    back to the top (instantly under reduced motion); always clear of the F5 deck +
    overhang; the boot view at the top is pixel-identical to pre-F18.
  - From **F22** *(shipped #57 — Standing invariants 12, 14, 16 + 18)*: no native
    scrollbar is visible on the chore list or the Add/Edit form card — each carries
    `scrollbar-none` and an indicator-only overlay thumb (after, never inside, its scroller;
    the list's in the single `scroll-region-frame` before `F18`'s button; `pointer-events-none`,
    `aria-hidden`, no z-index) that appears on `scroll` and fades 1 s after the last scroll
    event, never on mount; the list thumb ends level with the last bar at full scroll; the
    outer column is unpadded, so the scroll container and the F5 deck backing span the full
    width while bars, room tabs, strip (`mx-4`), date banner and search keep a 16 px inset;
    the scroller's class tokens (now incl. `scrollbar-none`) and the deck contract hold.
  - From **F19** *(shipped #56 — Standing invariant 19)*: the touch-lock *engage*
    transition resets the view — list scrolled to the top (instantly, through the one
    `scrollRegionRef`), room → All, search cleared, day → today (re-sorting only if a
    simulation was active); never on unlock, never on blank alone (a lock under a blank
    still resets). Once `F20` re-keys it, also every idle expiry while locked and every
    manual lock, each tick first closing an Add modal left open under the lock. The
    app-side `isLocked` signal this keys off must survive `F15` (re-sourced from the shell,
    not deleted).
  - From **F20**: the lock is permissive — the padlock overlay appears only on a blocked
    complete / edit / delete (bars inert to tap and swipe, never dimmed); scroll, search,
    room tabs, day simulation and Add Task (incl. submit) work while locked; the app root
    is `inert` for blank only; the blocked tap counts as the first of the 1500 ms / 60 px
    double-tap and the second tap unlocks without acting; the padlock is drawn in a small
    hit circle at the tap and everything outside it stays usable while it shows; the top-left indicator is a
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
