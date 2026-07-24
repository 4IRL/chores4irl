# Push-Review Findings Ledger

**Canonical backlog of deferred minor findings** from every feature's `/git-push` review.

META-PLAN's per-feature contract pushes *even when* the 7-reviewer pass returns minor
findings (all PASS, none blocking). Those findings would otherwise stay buried in each
feature's `reviews/push-review-*.md`. This file is the one place they're collected so the
backlog is visible and actionable instead of scattered.

> **⚠ F-numbering note (2026-07-07).** The section headers below (`F2`, `F4`, `F5`, `F6`)
> predate the 2026-07-07 META-PLAN reconcile and use the **old (260630-era) numbering** —
> e.g. this file's bare `F4` means confirm-delete, **not** `plans/META-PLAN.md`'s current
> `F4` (remove Details/Long-term fields). The new `F10-L` entry added in the same reconcile
> uses the reconcile's `-L` (legacy) suffix convention to disambiguate going forward, but the
> four older sections were left as-is (not renamed) since they're stable historical labels
> a reader might already have cited elsewhere. **When in doubt, match by PR number/SHA in the
> section heading, not by the bare F-number.** See `plans/META-PLAN.md`'s "Legacy → current ID
> map" for the authoritative translation.

## How this file works
- **This ledger is canonical for status.** The per-feature `reviews/push-review-*.md`
  files are frozen at review time — their `- [ ]` boxes are *not* maintained; check items
  off **here** only. The source files remain the detailed rationale (linked per group).
- **Convention — after every `/git-push`:** copy that review's "To-Do: Required Changes"
  items into a new section below, tagged by theme + severity, with a link back to the
  source review. The `/compact-plans` sweep also harvests any stragglers when archiving.
- **Severity:** `minor` = worth doing; `opt` = optional/nice-to-have; `design` = needs a
  decision, not just a code change.
- **Theme tags** (for batch-fixing): `[test]` `[style]` `[dx]` `[a11y]` `[security]`
  `[design]`. Knock out one theme across all features in a single `/run-review` pass.
- Consumable by `/run-review push-review-findings` or `/next-step-taker` — same checkbox
  format those skills expect.

## Quick batch view (by theme)
- `[test]`     — ~13 items: assertion hardening, missing-branch coverage, brittle-selector fixes
- `[style]`/`[dx]` — ~13 items: DRY helpers, hook ordering, import-style consistency, clarifying comments, META-PLAN dual-table reminder, SSE mutation-gate/open-refetch tidies, swipe-reveal threshold-calc dedup
- `[a11y]`     — 2 items: `focus-visible:` reveal, focus-ring clipping (bar-redesign)
- `[security]` — 3 items: server-side `urgency` enum validation (edit-task); SSE connection cap + host-specifics redaction (both opt)
- `[design]`   — 2 items: both had a blocking dependency that **has since merged** — now decidable (see ⚠ below)

---

## F2 — edit-task  (`06e0b00`, #15)
Source: `plans/completed/edit-task/reviews/push-review-feature-edit-task.md`

- [ ] `[security]` minor — Server-side `urgency` enum validation — `backend/src/app.ts` — reject non-`low|medium|high` `urgency` with 400 in both POST and PUT instead of relying on the DB `CHECK` → 500. Pre-existing gap, not a regression.
- [ ] `[dx]` minor — Extract a shared `toIso(d)` date serializer — `frontend/src/services/choreApi.ts` — DRY the `instanceof Date ? .toISOString() : d` ternary shared by `addChore`/`updateChore` (or drop the guard, since the type is `Date`).
- [ ] `[test]` minor — App test for add→edit modal swap — `frontend/src/__tests__/App.test.tsx` — open Add form, click a pencil, assert `'Add New Chore'` gone and `'Edit Chore'` shown (covers `handleRequestEdit`'s `setShowForm(false)`).
- [ ] `[style]` opt — Clarify the optional-field mapping — `backend/src/__tests__/chores.test.ts` — inline comment noting `rowToChore` maps null urgency / `long_term_task=0` → `undefined`, so the `toBeUndefined()` assertions are intentional.
- [ ] `[design]` ⚠ — Decide sim-mode gating for edit — was deferred to "whatever F5/F6 decide for delete." **F5 (`0d05453`) and F6 (`3a30a42`) are now merged** — resolve consistently with their delete behavior, then close. NOTE: F1 will remove `urgency`/`details`/`longTermTask`, which moots the `urgency`-validation item above — sequence accordingly.

## F4 — confirm-delete  (`e30c2b2`, #14)
Source: `plans/completed/confirm-delete/reviews/push-review-confirm-delete.md`

- [ ] `[test]` minor — Add negative assertion to backdrop test — `frontend/src/__tests__/components/ConfirmDialog.test.tsx` — in the backdrop-click test add `expect(onConfirm).not.toHaveBeenCalled()` after the `onCancel` assertion.
- [ ] `[test]` opt — App-level backdrop-dismiss test — `frontend/src/__tests__/App.test.tsx` — click ✕, click `confirm-dialog-backdrop`, assert dialog gone and `removeChore` not called. Low priority (unit-covered).
- [ ] `[design]` ⚠ — Reconsider `confirmLabel`/`cancelLabel` props — `frontend/src/components/common/ConfirmDialog.tsx` — was deferred until "a second consumer." **F5 swipe-to-delete is now that consumer** — decide keep-for-reuse vs. inline, then close.
- [ ] `[style]` opt — Align `React.MouseEvent` import style — `ConfirmDialog.tsx` + `frontend/src/components/form/ChoreFormModal.tsx` — switch both to `import type { MouseEvent } from 'react'`.

## F5 — swipe-actions  (`0d05453`, #17)
Source: `plans/completed/swipe-actions/reviews/push-review-feature-swipe-actions.md`

- [ ] `[dx]` minor — Extract the duplicated `swipe()` test helper — `frontend/src/__tests__/components/ChoreTimerBar.test.tsx`, `App.test.tsx` — move the identical 4-line mouse-swipe helper into `frontend/src/__tests__/helpers/swipe.ts` (mirroring `fixtures/chore.ts`) and import in both.
- [ ] `[test]` minor — swipe-right-with-no-`onEdit` unit test — `frontend/src/__tests__/components/ChoreTimerBar.test.tsx` — render without optional `onEdit`, right-swipe, assert no throw and `onComplete` not called (covers the `if (!isSimulating && onEdit)` guard).
- [ ] `[style]` minor — Move new hooks to the top of `ChoreTimerBar` — `frontend/src/components/chore/ChoreTimerBar.tsx` — relocate `swipingRef`/`swipeHandlers` above the `useMemo`/`computeBar` derived values to match the "all hooks first" pattern.
- [ ] `[style]` minor — Move the e2e `swipeBar` helper to module scope — `e2e/smoke.spec.ts` — define it above `test.describe(...)`.
- [ ] `[style]` opt — Inline comment on `swipingRef` dual-reset / spread-order — `frontend/src/components/chore/ChoreTimerBar.tsx` — note `swipingRef` clears at gesture start (touch) and on consume (mouse), and `{...swipeHandlers}` must stay spread before `onClick` (also the F6 refactor guard).

## F6 — bar-redesign  (`3a30a42`, #18)
Source: `plans/completed/bar-redesign/reviews/push-review-feature-bar-redesign.md`

- [ ] `[test]` minor — Pin the `sr-only` class in unit tests — `frontend/src/__tests__/components/ChoreTimerBar.test.tsx` — add `toHaveClass('sr-only')` to the Delete/Edit/"Overdue" assertions so a regression that makes them visible is caught.
- [ ] `[test]` minor — Assert the frequency column is centered — `frontend/src/__tests__/components/ChoreTimerBar.test.tsx` — in `displays the frequency centered`, also assert the `Every N days` element (or wrapper) has `text-center`.
- [ ] `[a11y]` minor — Use `focus-visible:` instead of `focus:` for the sr-only reveal — `frontend/src/components/chore/ChoreTimerBar.tsx` — so mouse-down focus does not reveal the buttons (keyboard-only intent).
- [ ] `[a11y]` minor — Avoid focus-ring clipping by `overflow-hidden` — `frontend/src/components/chore/ChoreTimerBar.tsx` — render the focus-revealed sr-only buttons outside the clip context (or accept, since swipe is primary).
- [ ] `[dx]` opt — Reduce focus-utility duplication — `frontend/src/components/chore/ChoreTimerBar.tsx` — extract a `FrequencyInfo` component and/or shared focus-reveal `@apply` class for symmetry with `ChoreInfo`/`CompletionInfo`.
- [ ] `[style]` opt — Remove redundant `text-white` — `frontend/src/components/chore/CompletionInfo.tsx` — drop from the inner `<div>` (inherited from outer).
- [ ] `[style]` opt — Comment the e2e `dispatchEvent('click')` cleanup sites — `e2e/smoke.spec.ts` — brief inline note at each of the three sites that it fires the sr-only button's React `onClick` (force click is occluded).

## F10-L — swipe-direction-swap  (`4b6028f`, #23)
Source: `plans/completed/swipe-direction-swap/reviews/push-review-feature-swipe-direction-swap.md`

- [ ] `[dx]` minor — Deduplicate the confirm-threshold distance calc — `frontend/src/components/chore/ChoreTimerBar.tsx` — extract `barWidthPx() * CONFIRM_THRESHOLD` into a single helper used by both the render-time `revealDistance` and `pastThreshold()`, optionally capturing the width once per swipe (e.g. on swipe start) to avoid a layout read on every `onSwiping` re-render.
- [ ] `[test]` minor — Assert icon proportional fade at a non-boundary value — `frontend/src/__tests__/components/ChoreTimerBar.test.tsx` — in the "fades ... proportionally" test, also assert the trash icon's containing `<span>` has opacity ≈ 0.5 at the half-threshold swipe.

## reconfig/viewport  (portrait viewport, #9 `ece4fe6`)
Source: `plans/completed/reconfig-viewport/viewport/reviews/push-review-reconfig-viewport.md`
> Pre-F2 infra work; not part of the F-series but its findings are still open.

- [ ] `[dx]` minor — Dedupe `ChoreFormModal` backdrop-click test setup via `beforeEach` — `frontend/src/__tests__/components/ChoreFormModal.test.tsx` — extract `userEvent.setup()`, the `onCancel` `vi.fn()`, and `render(...)` into a `beforeEach` exposing `user`/`onCancel`.
- [ ] `[test]` minor — Switch e2e modal-visible assertions to `data-testid='chore-modal-backdrop'` — `e2e/smoke.spec.ts:45,70` — replace the `.fixed.inset-0` selector with the testid in both tests.
- [ ] `[test]` minor — Loosen `ChoreList` empty-state copy assertion — `frontend/src/__tests__/components/ChoreList.test.tsx` — change exact-string match to `/no chores yet/i` so copy tweaks don't break it.
- [ ] `[test]` minor — Add explicit load-state wait before overlay viewport assertions — `e2e/smoke.spec.ts:98` — add `await page.waitForLoadState('domcontentloaded')` at the top of the portrait-enforcement test.

## (non-F) Multi-device sync via SSE  (`42040cc`, #21)
Source: `plans/completed/multi-device-sync/reviews/push-review-claude-mobile-pi-device-sync-is0teg.md`
> Push verdict was PASS (6/7) with one Test-Coverage major **fixed in-session**; the items below are the accepted, non-blocking deferrals.

- [ ] `[security]` opt — Connection cap on `GET /api/events` — `backend/src/app.ts` — if exposure ever grows beyond the LAN, reject past N concurrent SSE clients (e.g. `listenerCount >= 20 → 503`).
- [ ] `[dx]` opt — Reference-counted mutation gate — `frontend/src/App.tsx` — replace boolean `isMutatingRef` with a counter if concurrent mutations ever become reachable in the UI.
- [ ] `[dx]` opt — Skip the initial `open` re-fetch — `frontend/src/hooks/useChoreEvents.ts` — guard the `open` handler to fire only on reconnects, avoiding one redundant idempotent fetch per mount.
- [ ] `[style]` opt — Exact-match nginx location — `nginx.conf` — use `location = /api/events` to scope SSE settings to exactly that path (no `/api/events/*` sub-path catch).

## (chore) plans-housekeeping  (`b823ad4`, #20)
Source: `plans/completed/plans-housekeeping/reviews/push-review-chore-plans-housekeeping.md`
> The two doc-hygiene findings (freeze headers on older completed plans; correct progress-bar-decay's status) were **resolved in this `/compact-plans` sweep** — see Resolved/archived. The two below remain open.

- [x] `[dx]` minor — ~~Make the META-PLAN dual-table update explicit~~ — **superseded by policy 2026-07-24**: merged features are no longer tabulated in META-PLAN at all (git is the authority; merged Status-ledger rows are deleted), so there is no Completed table to drift against the Status ledger.
- [ ] `[security]` opt — Redact host specifics in historical deploy plans — `plans/completed/docker-raspberry-pi/docker-raspberry-pi.md` et al. — replace `192.168.1.214` / `rmilarachi` with placeholders **only if this repo ever goes public**. Non-blocking for a private repo.

---

## Resolved / archived
Findings whose feature reviews reached 0-open at push time (kept for provenance, no action):
- **date-navigation-simulation** (`c36d867`, #12) — both review rounds fully resolved (8/8 done).
- **reconfig-ClaudeCode** push review — 20/20 done.
- **plans-housekeeping** (`b823ad4`, #20) — two doc-hygiene findings resolved in the 2026-06-30 `/compact-plans` sweep: (1) freeze headers added to the six older completed plans that lacked them; (2) `progress-bar-decay.md` corrected to **Merged `e929b75` (#7)** with an F6-consolidation note (the prior "never merged" claim was contradicted by git).
