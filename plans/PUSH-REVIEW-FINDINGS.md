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
> map" for the authoritative translation. Sections added by the 2026-09-16 sweep (`F1`
> auto-screen-blank, `F2` touch-lock, `F14` clear-input-buttons) use the **current**
> numbering and say so in their headings — so this file's `F2 — edit-task` (#15) and
> `F2 (current numbering) — touch-lock` (#28) are different features; the PR number is the
> tiebreaker.

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
- `[test]`     — 23 items: assertion hardening, missing-branch coverage, brittle-selector fixes, `rearmTick` self-heal (auto-screen-blank), `!event.repeat` guard (touch-lock), post-submit clear-✕ reset (clear-input-buttons), `BEGIN IMMEDIATE` two-connection migration test (remove-details-longterm), deck-class assertions (translucent-add-deck), three accepted-risk `set-hostname.sh` matrix cases (local-url-alias), delete/edit smoke-test toast assertions + cross-mutation error-clear case (form-polish-date-fix)
- `[style]`/`[dx]` — 47 items: DRY helpers, hook ordering, import-style consistency, clarifying comments, SSE mutation-gate/open-refetch tidies, swipe-reveal threshold-calc dedup, native `<button>`/`z-50` (auto-screen-blank), repeat-key `preventDefault` + plan-step comment cleanup (touch-lock), `clearable` type-safety (clear-input-buttons), META-PLAN policy-restatement consolidation (deferred), migration count-alias + tagged log line (remove-details-longterm), `/compact-plans` Step 7 scan doc nits (phase-c-guard), ledger/paragraph tidies deferred to `/new-feature` (meta-plan-update-f5), `set-hostname.sh` naming/message/guard-shape nits + `*.sh` gitignore anchor (local-url-alias), three `/compact-plans` Step 5/7 snippet nits (compact-plans-260919), F15 gate bullet + invariant-13 trim (meta-plan-update-f6), F6 freeze-Outcome trim (meta-plan-additions-260920), `Toast` `onDismiss` ref + `defaultRoom` doc reword + silent `loadChores` re-pull failure (form-polish-date-fix)
- `[a11y]`     — 3 items: `focus-visible:` reveal, focus-ring clipping (bar-redesign); aria-label sentence-casing (clear-input-buttons)
- `[security]` — 5 items: server-side `urgency` enum validation (edit-task); SSE connection cap + host-specifics redaction (docker-raspberry-pi and local-url-alias) + predecessor-ledger username (all opt / only-if-public)
- `[design]`   — 3 items: both had a blocking dependency that **has since merged** — now decidable (see ⚠ below); plus the F5 `relative`-wrapper removal, which needs a Pi kiosk re-verification first

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

## F1 (current numbering) — auto-screen-blank  (`a633a2a`, #27)
Source: `plans/completed/auto-screen-blank/reviews/push-review-feature-auto-screen-blank.md`
> Harvested by the 2026-09-16 `/compact-plans` sweep. Review 1's 7 required/low-risk items landed in `652a5e8` (verified on `main`: the three test files + the unconditional `rearmTick` bump and rationale comment in `useScreenBlank.ts`) and were checked off in the source; only the two cosmetic optionals Review 2 explicitly left as-is remain, plus Review 2's one prose-only note.

- [ ] `[style]` opt — Native `<button>` instead of `div[role="button"]` — `frontend/src/components/common/ScreenBlankOverlay.tsx` — every other interactive control (`ConfirmDialog` actions, `AddChoreButton`) is a real `<button>`; a `<button className="fixed inset-0 ...">` covers the same target and drops the manual Enter/Space `onKeyDown` handling.
- [ ] `[style]` opt — Use `z-50` instead of the one-off `z-[100]` — `frontend/src/components/common/ScreenBlankOverlay.tsx` — `ConfirmDialog`/`ChoreFormModal` both use `z-50`, already the highest value elsewhere; keep `z-[100]` only if a concrete stacking conflict requires it.
- [ ] `[test]` opt — Self-heal test for the unconditional `rearmTick` bump — `frontend/src/__tests__/hooks/useScreenBlank.test.ts` — hide the tab across an *even* number of 21:00/06:00 boundaries (so `inWindow` lands back on its original value) and assert the boundary timer is still rescheduled on `visibilitychange`. Review 2's only leftover note; mirrors the original "optional" framing.

---

## F2 (current numbering) — touch-lock  (`3160dfc`, #28)
Source: `plans/completed/touch-lock/reviews/push-review-feature-touch-lock.md` (Review 2 "Optional Follow-ups")
> Harvested by the 2026-09-16 `/compact-plans` sweep. Review 1's required items all landed in `d5fe530`; the four below are Review 2's non-blocking follow-ups.

- [ ] `[style]` opt — Suppress default browser behavior on repeated Enter/Space too — `frontend/src/components/common/TouchLockOverlay.tsx` (`handleKeyDown`) — move `event.preventDefault()` outside the `!event.repeat` check (or add an unconditional second call) so held-key default behavior stays suppressed; cosmetic — the overlay is a full-viewport fixed layer with nothing scrollable behind it.
- [ ] `[test]` minor — Regression test for the `!event.repeat` guard — `frontend/src/__tests__/components/TouchLockOverlay.test.tsx` — fire two `keyDown(overlay, { key: 'Enter', repeat: true })` events and assert `onArm` is never called, plus a companion case showing a genuine non-repeat second Enter still qualifies.
- [x] `[dx]` opt — ~~Update `touch-lock.md`'s Step 4/DD-2 text to match the shipped fix~~ — **resolved by the freeze header** the 2026-09-16 sweep prepended to `plans/completed/touch-lock/touch-lock.md`, whose Outcome line records the `d5fe530` deviation (`wasLockedRef.current` updated in a separate `useEffect` keyed on `[isLocked]`, not in the render body). The plan body is frozen and deliberately left as written.
- [ ] `[style]` minor — Remove internal plan-step references from source comments — `frontend/src/components/common/TouchLockOverlay.tsx` (three comments mentioning "App.tsx (Step 4)") — reword to describe the relationship directly (e.g. "Imported by App.tsx so its own isClosing unmount-delay timer stays numerically in sync…"); no other file uses the plan-step comment convention.

---

## F14 (current numbering) — clear-input-buttons  (`3533b67`, #34)
Source: `plans/completed/clear-input-buttons/reviews/push-review-feature-clear-input-buttons.md`
> Harvested by the 2026-09-16 `/compact-plans` sweep. Review 1's one major finding was fixed inline before push; these three are its non-blocking minors.

- [ ] `[a11y]` minor — Normalize aria-label casing — `frontend/src/components/common/ClearButton.tsx` and its 3 call sites — change `"Clear Search"`/`"Clear Name"`/`"Clear Room"` to sentence case (`"Clear search"`/`"Clear name"`/`"Clear room"`) to match every other aria-label in the repo, and update the matching test query strings.
- [ ] `[test]` minor — Post-submit-reset visibility test — `frontend/src/__tests__/components/ChoreForm.test.tsx` — after a successful add-mode submit, assert `queryByRole('button', { name: 'Clear Name' })` and `'Clear Room'` are both `null`, confirming the clear-✕ buttons disappear with the rest of the form reset.
- [ ] `[dx]` opt — Tighten `clearable`'s type-safety — `frontend/src/components/form/FormField.tsx` — either normalize the emptiness check to `String(value) !== ''`, or (if `clearable` is ever expected on number/date fields) restrict it via a discriminated union so `clearable` + non-text `type` is unrepresentable. Not needed while only the always-string Name field uses `clearable`.

---

## (chore) meta-plan-housekeeping-260723  (`37f79ed`, #31 + `ed93e24`, #33)
Source: `plans/completed/meta-plan-housekeeping-260723/reviews/push-review-chore-meta-plan-housekeeping-260723.md`
> Harvested by the 2026-09-16 `/compact-plans` sweep. Review 1's four required items landed on-branch (`750d092`/`e96d0b1`) and its stale To-Do was marked superseded by `/compact-plans` Step 5 on 2026-09-16; the two below are Review 2's deliberately-deferred items, carried here so the deferral is visible rather than buried.

- [ ] `[dx]` opt *(deferred — deliberate)* — Policy-statement redundancy — `plans/META-PLAN.md` — the three restatements of the history policy are section-local context for cold-start agents; consolidate only if they drift.
- [ ] `[security]` opt *(won't-fix)* — `rmilarachi` in the 260708 predecessor ledger — `plans/ledger/260708_feature_ledger.md` — frozen historical file carrying a PREDECESSOR banner; left untouched by design (same reasoning as the plans-housekeeping host-specifics item above — only revisit if the repo ever goes public).

---

## F4 (current numbering) — remove-details-longterm  (`d728989`, #38)
Source: `plans/completed/remove-details-longterm/reviews/push-review-feature-remove-details-longterm.md`
> Harvested by the 2026-09-19 `/compact-plans` sweep. Review 1 was 9/9 PASS (Type Design reviewer included) with no blocking findings; these four are its non-blocking minors/optionals.

- [ ] `[style]` minor — Rename the count alias in the migration test helper — `backend/src/__tests__/db-migration.test.ts` (`rowCount`) — use `SELECT COUNT(*) AS count FROM chores` / `{ count: number }` to match `backend/src/db.ts`'s existing convention for the same query.
- [ ] `[dx]` minor — Add a greppable log line before the migration rethrows — `backend/src/db.ts` (`dropLegacyChoreColumns` body or its module-load call) — wrap in `try { … } catch (err) { console.error('[db] F4 legacy-column migration failed:', err); throw err; }` so crash-loud behaviour is unchanged but the log carries an explicit tag.
- [ ] `[test]` opt — Add a two-connection `BEGIN IMMEDIATE` test — `backend/src/__tests__/db-migration.test.ts` — open two better-sqlite3 connections on one legacy temp file, call `dropLegacyChoreColumns` on both without closing the first, assert the second either serialises to a 7-column no-op or throws `SQLITE_BUSY` as the comment documents.
- [ ] `[style]` opt *(taste)* — Inline the two guarded ALTER statements — `backend/src/db.ts` — replace the `LEGACY_CHORE_COLUMNS` loop with two straight-line `if (present.has('details')) …` / `if (present.has('long_term_task')) …` statements.

---

## F5 (current numbering) — translucent-add-deck  (`a1705b3`, #39)
Source: `plans/completed/translucent-add-deck/reviews/push-review-feature-translucent-add-deck.md`
> Harvested by the 2026-09-19 `/compact-plans` sweep. Two review rounds, both all-PASS; six non-blocking items, one already resolved (see its `[x]` below).

- [ ] `[test]` opt — Remove the redundant `not.toContain('bg-blue-500/')` assertion — `frontend/src/__tests__/components/AddChoreButton.test.tsx:11` — the `toMatch(/(^|\s)bg-blue-500(\s|$)/)` on line 10 already rejects the alpha-suffixed form; drop line 11 and its comment, or keep it only if the exact-token guard is wanted for readability.
- [ ] `[test]` minor — Assert the scroll region is a flex column in the deck tests — `frontend/src/__tests__/App.test.tsx`, both tests in `describe('Add Task deck (F5)')` — add `expect((scrollRegion as HTMLElement).className).toContain('flex')` and `.toContain('flex-col')` next to the existing `scroll-pb-24` assertion, so `mt-auto`'s precondition is guarded.
- [x] `[dx]` — Confirm F4 and F5 ledger rows after merge — `plans/META-PLAN.md` Status ledger — **resolved 2026-09-19**: both rows were removed by their Phase C fold-backs (#40, #41); verified by this sweep's Step 7 ledger scan.
- [ ] `[test]` minor — Assert the backing's full extent — `frontend/src/__tests__/App.test.tsx` ('Add Task deck (F5)' first test) — add `expect(backing.className).toContain('inset-x-0')` and `.toContain('bottom-0')` beside the `-top-16` assertion so a dropped edge fails a test.
- [ ] `[test]` minor — Tie the overhang/mask/scroll-padding numbers together — `frontend/src/__tests__/App.test.tsx` — derive the three from one constant in the test (e.g. `const OVERHANG_REM = 4` → `-top-${OVERHANG_REM*4}`, `black_${OVERHANG_REM}rem`, and assert `scroll-pb-N` with `N*4 >= 81/4 + OVERHANG_REM*4`), or add one comment-linked assertion block, so editing one without the others fails.
- [ ] `[design]` opt *(needs Pi verification)* — Evaluate removing the `relative` button wrapper — `frontend/src/App.tsx` deck markup — only if `isolate` on the deck plus `-z-10` on the backing is re-verified on the Pi kiosk to still blur the list beneath (isolation may change the backdrop root); otherwise keep the wrapper.

---

## (chore) compact-plans-phase-c-guard  (`e488e28`, #37)
Source: `plans/completed/compact-plans-phase-c-guard/reviews/push-review-chore-compact-plans-phase-c-guard.md`
> Harvested by the 2026-09-19 `/compact-plans` sweep. Six review rounds; Reviews 1–5's items all landed on-branch. These five are Review 6's deferred doc nits on the `/compact-plans` skill's Step 7 whole-ledger scan. Note: the 2026-09-19 sweep separately reworked Step 5's per-branch gate (remote-only path) — these items are in Step 7 and remain open.

- [ ] `[dx]` minor — Move the `(<F-ID>/<N> … are $fid/$N)` mapping note before its first use — `.claude/skills/compact-plans/SKILL.md` Step 7 scan sub-bullet — place it right after the `row=`/`fid=`/`N=`/`branch=` assignments so it precedes the numeric-gate STOP, or reword "below" to "here and below".
- [ ] `[dx]` minor — Add a `lineno=` one-liner — same sub-bullet — `lineno=$(cut -d: -f1 <<<"$hit")` alongside the other assignments, so no step is prose-only.
- [ ] `[dx]` minor — Extract `N` from the PR column rather than the whole row — same sub-bullet — `N=$(awk -F'|' '{print $5}' <<<"$row" | grep -oE '\[#[0-9]+\]\(' | grep -oE '[0-9]+')`, so a `[#N](` link in prose elsewhere on the row can't trip the two-link STOP; or add a one-clause scoping caveat.
- [ ] `[dx]` minor — Turn the outcome comparison into a `jq` extraction — same sub-bullet — `read -r state head_ref <<<"$(jq -r '"\(.state) \(.headRefName)"' <<<"$pr_json")"` then `[[ "$state" == MERGED && "$head_ref" == "$branch" ]]` etc., mirroring Step 5's pattern.
- [ ] `[dx]` minor — State `$fid`'s non-empty guarantee — same sub-bullet — one clause: guaranteed by the enumeration grep's `^\| \*{0,2}F[0-9]+` anchor, so no separate guard is needed.

---

## (chore) meta-plan-update-f14  (`1b2f8a4`, #36)
Source: `plans/completed/meta-plan-update-f14/reviews/push-review-chore-meta-plan-update-f14.md`
> Harvested by the 2026-09-19 `/compact-plans` sweep. Reviews 1–2's required items all landed on-branch; the one deferred minor is carried here for visibility only (moot — see its `[x]` below).

- [x] `[dx]` opt *(moot)* — Reword F4's "incl. its tests" — `plans/META-PLAN.md` (F4 › Expected end state) — F4 merged (#38) and its META-PLAN section was removed by the #40 fold-back, so the sentence this targeted no longer exists; nothing to do.

---

## (chore) meta-plan-update-f5  (`f63d03f`, #41)
Source: `plans/completed/meta-plan-update-f5/reviews/push-review-chore-meta-plan-update-f5.md`
> Harvested by the 2026-09-19 `/compact-plans` sweep. Review 1 was all-PASS; both items are optional and explicitly deferred to other skills. (The first item's "deleted by the next `/compact-plans` sweep" premise is wrong — this sweep never edits `META-PLAN.md`; the paragraph is only rewritten by `/run-feature` Phase C or `/new-feature`.)

- [ ] `[dx]` opt — Shorten the "Branch/dir cleanup" enumeration — `plans/META-PLAN.md` "Branch/dir cleanup" paragraph — do it in the next Phase C / `/new-feature` rewrite of that paragraph, not by hand.
- [ ] `[dx]` opt — Tick F5 in the feature ledger — `plans/ledger/260715_feature_ledger.md` — mark `F5` as shipped (#39) if/when `/new-feature` next rewrites the ledger; do not hand-edit outside that skill. (Same applies to `F4`, #38.)

---

## F6 (current numbering) — local-url-alias  (`1c63e0a`, #43)
Source: `plans/completed/local-url-alias/reviews/push-review-feature-local-url-alias.md`
> Harvested by the 2026-09-20 `/compact-plans` sweep. Eight review rounds (1–4 on the PR body; 5–8 delta-only on the Chromium profile-lock cleanup added after the live rename broke the kiosk). Every required item landed on-branch and is `[x]` in the source; the thirteen below are the rounds' explicit `(Optional …)` deferrals, all on `deploy/pi/set-hostname.sh` or its docs. Two are moot (see their `[x]`).

- [ ] `[security]` opt *(only-if-public)* — Redact the LAN IP/MAC in the F6 planning docs — `plans/completed/local-url-alias/**` (plan, research, reviews) — `192.168.1.214` + the Wi-Fi MAC are committed in cleartext; RFC1918 + LAN-only, so only if the repo is or becomes public (same decision as the docker-raspberry-pi item under "(chore) plans-housekeeping"; the deploy docs already use `<pi-ip>`-style placeholders).
- [ ] `[dx]` opt *(follow-up F-ID)* — Anchor the `*.sh` gitignore rule — `.gitignore:55` — so future `deploy/pi/*.sh` scripts don't need `git add -f`; deferred as out of scope for #43 — a candidate for `/new-feature`.
- [ ] `[dx]` opt — Rename `rc` → `grep_status` and `need_meh` → `need_manage_etc_hosts` — `deploy/pi/set-hostname.sh:79-92` — cosmetic.
- [ ] `[dx]` opt — Harmonise stderr handling on the two `[4/4]` verify reads — `deploy/pi/set-hostname.sh:169-170` — add `2>/dev/null` to the hosts grep or drop it from the hostname cat.
- [ ] `[dx]` opt — Reword "no $HOSTNAME_FILE" → "could not read $HOSTNAME_FILE" — `deploy/pi/set-hostname.sh:169`.
- [ ] `[dx]` opt — Broaden the findmnt guard message — `deploy/pi/set-hostname.sh:74` — "could not confirm /boot/firmware is mounted read-write".
- [ ] `[style]` opt — Unify guard-and-exit shape — `deploy/pi/set-hostname.sh:59-87` — one style throughout.
- [ ] `[dx]` opt — Header note that the invoker/`SUDO_USER` must be the kiosk user — `deploy/pi/set-hostname.sh` header comment — relevant only if the Pi gains a second account.
- [ ] `[test]` opt *(accepted risk)* — Exercise the `hostnamectl` fallback in the dry-run matrix — `deploy/pi/set-hostname.sh:384-390` — an `APPLY_LIVE=1` case with `hostnamectl` shadowed on `PATH`.
- [ ] `[test]` opt *(accepted risk)* — Matrix case for the avahi-inactive branch — `deploy/pi/set-hostname.sh:429`.
- [ ] `[test]` opt *(accepted risk)* — Fixture the `readlink`-failure warn branch — `deploy/pi/set-hostname.sh` Chromium lock block — TOCTOU-only path.
- [x] `[dx]` opt *(moot)* — Tighten the decision record (drop the repeated timestamp; mark the phone check resolved 2026-09-20; use case letters M–V in the fixture summary) — `plans/completed/local-url-alias/research/lan-name-resolution.md` — the plan dir was frozen by this sweep ("historical record, do not edit"); nothing to do.
- [x] `[dx]` opt *(moot)* — Qualify the README redeploy sentence "once this branch is merged" — `README.md` / `deploy/pi/README.md` — the phrase is absent on `main` at #43; resolved on-branch or by the merge itself.

---

## (chore) compact-plans-260919  (`f007927`, #42)
Source: `plans/completed/compact-plans-260919/reviews/push-review-chore-compact-plans-260919.md`
> Harvested by the 2026-09-20 `/compact-plans` sweep. Three review rounds. This review adopted the append-only convention (Review 2's own item: earlier rounds' boxes stay `[ ]`, landing is recorded in the next round's `Comparison:` line) — so its 15 `[ ]` boxes under Reviews 1–2 all landed (`a2efff4`, `2287815`, per Review 2/3's Comparison lines; spot-checked against the current `SKILL.md`) and are **not** open. The three below are Review 3's deferred nits on the `/compact-plans` skill, all still present in `SKILL.md` as of this sweep.

- [ ] `[dx]` minor — Capture the DELETE call's output in its STOP — `.claude/skills/compact-plans/SKILL.md` Step 5 per-branch snippet — `elif ! delete_out=$(gh api -X DELETE "repos/4IRL/chores4irl/git/refs/heads/<branch>" 2>&1); then echo "STOP: remote delete failed for <branch> — $delete_out"`, for symmetry with the existence-check and stale-ref STOPs.
- [ ] `[style]` opt — Trail the two stale-ref scoping comments — same file, Step 5 stale-ref snippet — move each leading `# for every branch …` line to trail its `if ! out=$(…); then` line, matching the file's trailing-comment convention (or leave as-is if line length argues for it).
- [ ] `[dx]` opt — Drop "or was out of scope" — same file, Step 7 stale-ref bullet — the cleanup scope now covers every category that reaches "pruned"; keep only if future narrowing is anticipated.

---

## (chore) meta-plan-update-f6  (`a045b11`, #44)
Source: `plans/completed/meta-plan-update-f6/reviews/push-review-chore-meta-plan-update-f6.md`
> Harvested by the 2026-09-20 `/compact-plans` sweep. Review 1 was all-PASS; the four required items landed before push; both items below are optional META-PLAN tidies — do them in the next `/run-feature` Phase C or `/new-feature` rewrite of those paragraphs, not by hand (same rule as the meta-plan-update-f5 items).

- [ ] `[dx]` opt — Add an explicit Phase-2-parity gate bullet to F15's *Assumed starting state* — `plans/META-PLAN.md` F15 section — the bullets check only pi-kiosk Phase 1; the Phase 2 parity gate is stated only in Dependencies / Open risks / the focus-path text.
- [ ] `[style]` opt — Trim Standing invariant 13's redeploy sentence to a cross-reference — `plans/META-PLAN.md` — it restates the Baseline *Deployment / LAN name* paragraph.

---

## (chore) meta-plan-additions-260920  (`4cf24b4`, #45)
Source: `plans/completed/meta-plan-additions-260920/reviews/push-review-features-meta-plan-additions-260920.md`
> Harvested by the 2026-09-22 `/compact-plans` sweep. Two review rounds. This review used the append-only convention (earlier rounds' boxes stay `[ ]`; landing is recorded in the next round's `Comparison:` line) — so Review 1's **eight** `[ ]` boxes all landed in `fb6bb9b` (per Review 2's Comparison line, re-verified: the F19/F20 step-0 amendment, the ledger trim, the F6 Outcome cut, the Branch/dir-cleanup rewrite, the `isSimulating` reword, the unset-`urgency` test case and both optionals are present on `main`) and are **not** open. The one below is Review 2's remaining optional. This dir holds no plan `.md` of its own — it is the `/new-feature` batch's review record only (same shape as the `meta-plan-update-*` dirs), so it carries no freeze header.

- [ ] `[style]` opt — Trim the F6 freeze-header Outcome further — `plans/completed/local-url-alias/local-url-alias.md:2` — Review 2 measured it at ~6 lines against the skill's ≤ 4; e.g. fold "no app code changed" into the lead sentence and drop "push-review rounds 5–8". **Now decidable** — the target file is frozen under `plans/completed/`, so this is a deliberate edit-a-frozen-header decision, not a blocked one.

---

## F21 (current numbering) — form-polish-date-fix  (`85cf985`, #46)
Source: `plans/completed/form-polish-date-fix/reviews/push-review-feature-form-polish-date-fix.md`
> Harvested by the 2026-09-22 `/compact-plans` sweep. One review round, all nine reviewers PASS, verdict **PUSHED WITH MINOR FINDINGS** — every item below was deferred at push time, none blocking. The dir's plan-reviewer file (`form-polish-date-fix-review.md`) has one `[ ]` box that records a *rejected* finding (the `App.search.test.tsx:236` line-number claim was wrong; citation kept), so there is nothing to harvest from it.

- [ ] `[test]` minor — Add success-toast assertions to the delete and edit smoke tests — `e2e/smoke.spec.ts` (`'deletes a chore and it disappears from the list'`, `'edits a chore via swipe-left'`) — after each mutation assert `page.getByTestId('toast')` has text `Deleted "<name>"` / `Saved "<name>"` and `data-tone="success"`, mirroring the add-chore test's two assertions (web-first, so they see the 2.5 s pill). Only the add path asserts tone/text today.
- [ ] `[test]` minor — Add a cross-mutation error-clear test — `frontend/src/__tests__/App.test.tsx` (`describe('feedback toast (F21)')`) — reject `addChore` once so a red toast stands, then resolve `completeChore` and tap the bar; assert `queryByTestId('toast')` is null. Pins the "any successful mutation retires a standing error" claim in the `handleCompleteChore` comment and the plan's Decisions (today only the same-chore retry-after-failure case is covered).
- [ ] `[dx]` minor — Make `Toast` robust to an unstable `onDismiss` — `frontend/src/components/common/Toast.tsx:11` — hold the latest `onDismiss` in a ref updated each render and have the auto-dismiss timer call `onDismissRef.current()`, so the effect depends on `tone` only. Alternatively leave as-is and record the accepted comment-only invariant — `App` already passes a `useCallback([])` value, so the JSDoc is the whole guarantee.
- [ ] `[style]` minor — Reword the `defaultRoom` doc comment to match its gate — `frontend/src/components/form/ChoreForm.tsx:45` — "Add mode only: pre-fills Room (the active room tab). Ignored in edit mode." → "Used only when `initialChore` is absent (the add form): pre-fills Room with the active room tab." The real branch is on `initialChore` presence, not `mode`.
- [ ] `[dx]` opt *(pre-existing, unchanged by #46)* — Surface background re-pull failures in `loadChores` — `frontend/src/App.tsx:101-106` — add a `console.error(err)` outside the `if (initial)` gate (or raise the same error toast for non-initial failures) so a failed SSE re-pull leaves a trace instead of being swallowed.
- [x] `[design]` *(accepted, no change)* — Midnight rollover keeps the mount-time default date — `frontend/src/components/form/ChoreForm.tsx:19` — `initialAddState()` computes today once at mount / post-submit reset, so a modal held open across local midnight keeps the previous day (still editable). Documented in the plan's Decisions ("Default date is captured at mount"); revisit only if the kiosk's blank-window closing the form stops holding.

---

## Resolved / archived
Findings whose feature reviews reached 0-open at push time (kept for provenance, no action):
- **date-navigation-simulation** (`c36d867`, #12) — both review rounds fully resolved (8/8 done).
- **reconfig-ClaudeCode** push review — 20/20 done.
- **meta-plan-update-f4** (`89a9675`, #40) — push review reached 0-open at push time; archived by the 2026-09-19 sweep with nothing to harvest.
- **meta-plan-workflow-improvements-260910** (`9d3e7a4`, #35) — push review reached 0-open at push time; archived by the 2026-09-19 sweep with nothing to harvest.
- **plans-housekeeping** (`b823ad4`, #20) — two doc-hygiene findings resolved in the 2026-06-30 `/compact-plans` sweep: (1) freeze headers added to the six older completed plans that lacked them; (2) `progress-bar-decay.md` corrected to **Merged `e929b75` (#7)** with an F6-consolidation note (the prior "never merged" claim was contradicted by git).
