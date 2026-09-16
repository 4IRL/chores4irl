# Review: F2 — Double-tap accidental-touch lock

## Review — 2026-07-08

### Summary
The plan's overall architecture (mirror F1's `useScreenBlank`/`ScreenBlankOverlay`
inert-gating pattern, local-only scope, no backend change) is sound and well-grounded in
actual source reads. However, six subagents surfaced one critical implementation gap the
plan itself flags but never resolves (the unlock/arm exit animation), a second critical gap
in the jsdom testability of `inert` (already discovered and documented by this codebase's
own F1 work as "DD-7," but not carried forward here), and a critical e2e clock-sequencing
bug. Needs changes before proceeding to implementation.

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | FAIL | 0 critical, 3 major, 0 minor |
| 2 | Full-Stack Trace | FAIL | 1 critical, 2 major, 2 minor |
| 3 | Ordering & Cleanup | FAIL | 0 critical, 2 major, 2 minor |
| 4 | Integration & Conventions | PASS | 0 critical, 0 major, 3 minor |
| 5 | Verification & Coverage | FAIL | 1 critical, 2 major, 2 minor |
| 6 | Completeness & Risk | FAIL | 1 critical, 2 major, 4 minor |

### Findings

#### Critical (must fix before proceeding)

- **[Step 3 / Step 4] Unlock (arm) exit animation is never actually implemented** _(Subagents #1, #6)_: Design decision #7 and Step 3's Green to-do both explicitly promise that on a qualifying second tap, the overlay stays mounted through its "opening and minimizing" close animation, deferring the mechanism to Step 4 — but Step 4's Green to-do never implements any hand-off. `arm()` calls `setIsLocked(false)` synchronously, so the very next render simply stops rendering `<TouchLockOverlay>`; the promised open/minimize animation would ship as an instant disappearance. No test in the plan catches this.
- **[Step 4] Step 4's Red to-do (c) prescribes a vitest/jsdom assertion that gated handlers do not fire while `isLocked: true` — this is unimplementable** _(Subagent #2)_: jsdom has zero implementation of `inert`'s behavioral effects (verified via source grep — 0 matches in `node_modules/jsdom/lib/jsdom/living`). `fireEvent.click()` on a gated element will invoke its handler regardless of an ancestor's `inert` attribute. This exact limitation was already discovered and documented by this codebase's own F1 work, named "DD-7" in `e2e/smoke.spec.ts` (lines 29-35, 51-57) — `App.screenBlank.test.tsx` never attempts this class of assertion for exactly this reason. The touch-lock plan's Research Findings cite F1 extensively but never mention DD-7, so Step 4 as written will not pass its own Green criteria without discovering this mid-implementation.
- **[Step 5] `page.clock.install()` called after `page.goto('/')` cannot retroactively fake the mount-time inactivity `setTimeout`** _(Subagents #1, #5)_: `useTouchLock`'s 5-minute inactivity timer is registered via the real, native `setTimeout` during the shared `beforeEach`'s `page.goto('/')`, which runs *before* Step 5's `install()` call. Playwright's fake clock cannot adopt a timer already scheduled against the real implementation, so `fastForward('5:01')` would have no effect on it. The existing DD-7 precedent in this same file (`page.clock.setFixedTime(...)` + `page.reload()`) exists precisely to work around this — Step 5 omits the equivalent `page.reload()` after `install()`.

#### Major (should fix)

- **[Step 4] `.closest('.App')` assertion is ambiguous about its source element and would throw if applied to the portaled overlay** _(Subagent #5)_: `TouchLockOverlay` uses `createPortal(..., document.body)`, so it is not a DOM descendant of `.App`. `.closest()` walks the real DOM tree, so calling it on `screen.getByTestId('touch-lock-overlay')` returns `null`, and `.toHaveAttribute('inert')` on `null` throws rather than failing cleanly. App.screenBlank.test.tsx's working precedent always performs this assertion on a non-portaled element (loading text, chore text) — never on the portaled overlay testid.
- **[Step 4] Only the main render branch's `.App` wrapper is tested; the loading branch's separate `.App` occurrence has no dedicated inert-attribute test** _(Subagent #5)_: `App.tsx` has two structurally separate `.App` divs (loading branch line 255, main branch line 265), both requiring `inert={isBlanked || isLocked}` per Design decision #3. None of Step 4's six Red to-do cases can run against the loading branch (no chores/forms/search exist yet there). F1's precedent (`App.screenBlank.test.tsx` lines 93-102) has a dedicated loading-branch case; Step 4 omits the equivalent.
- **[Step 3 / Step 4] `justRelocked` ref-comparison timing (render body vs. `useEffect`) is described at intent level only** _(Subagents #2, #6)_: Step 4's Green to-do says to "track a ref... so the overlay only passes `justRelocked` on the render where `isLocked` just transitioned"  without specifying whether the ref mutation happens synchronously in the render body or inside a `useEffect` (which runs after commit, and could produce an off-by-one-render lag or miss the transition entirely). This is a load-bearing correctness detail, not a stylistic choice.
- **[Step 3] Step 3 hedges on the `justRelocked` prop name instead of finalizing it** _(Subagent #3)_: Step 3's own Red to-do writes `(or whatever prop name Step 4's wiring settles on — see Green below)` even though Step 3's own Green to-do and Step 4 both converge on `justRelocked`. A producer step should not defer its own public interface to its consumer.
- **[Step 4] Regression-guard to-do and the plan's "all App-level test files" research claim both omit two files that also render `<App />`** _(Subagents #1, #3, #6)_: `App.screenBlank.test.tsx` (vi.hoisted mock style) and `App.screenBlank.realClock.test.tsx` (deliberately unmocked, real-clock) both render `<App />` and will invoke the real, unmocked `useTouchLock` hook once Step 4 lands, but neither is in the regression-guard to-do's file list. Verified this doesn't break any assertion today (neither test advances timers by the full 5-minute window), but the plan's factual claim is wrong and the omission is undocumented.
- **[Step 6] Step 6 never addresses Open risk (b) (cross-device transport) from `plans/META-PLAN.md`'s F2 section** _(Subagent #6)_: Risks (a), (c), (d) are all explicitly resolved by Step 6's to-do; (b) becomes moot given (a)'s local-only resolution but is silently dropped rather than noted as moot, leaving an orphaned open item in the ledger.
- **[Step 5] E2E hit-testing assertion should use raw-coordinate `page.mouse.click()`, not locator `.click()`** _(Subagent #2)_: Playwright's `.click()` performs actionability/interception checks — if the overlay visually covers a chore bar (as intended), `page.getByTestId('chore-bar').click()` will time out rather than cleanly demonstrate the block, tempting an implementer toward `{ force: true }`, which would produce a false-positive test that verifies nothing about real hit-testing/z-index. The existing DD-7 companion test in this same file already established the correct pattern (`page.mouse.click(box.x + ..., box.y + ...)`).

#### Minor (nice to fix)

- **[Step 4] Dangling "— see note below" cross-reference with no corresponding note** _(Subagent #2)_: refers to extracting `swipe()`/`stubBarWidth()` helpers with no resolution given.
- **[Step 3] Double-tap boundary values (exactly 60px / exactly 1500ms) are never asserted** _(Subagent #5)_: the prescribed implementation uses inclusive `<=` comparisons; an accidental `<` would go uncaught.
- **[Step 4] No dedicated test for the `justRelocked`-derivation logic itself** _(Subagent #5)_: Step 3's unit test only covers `TouchLockOverlay` given a directly-supplied prop, not App's derivation of when to supply it.
- **[Step 6] META-PLAN.md update (Step 6) is sequenced before final verification (Step 7), diverging from F1's own precedent of doing the equivalent edit as the last to-do inside "Verify All Tests Pass"** _(Subagent #3)_.
- **[Design decision #6] Double-tap thresholds (1500ms / 60px) are asserted without justification** _(Subagent #6)_: plausible kiosk defaults, but not flagged as an assumption open to on-device revision.
- **[Design decision #3] `inert`'s incidental fix of `ChoreTimerBar`'s pre-existing sr-only Delete/Edit gap is correct but unstated** _(Subagent #6)_.
- **[Design decision #7] Idle-phase transparency (vs. F1's always-opaque overlay) reopens a one-frame dialog-flash race** _(Subagent #6)_: cosmetic; the portaled `ConfirmDialog`/`ChoreFormModal` could flash visible for one frame before the force-close effect clears them, since F2's idle overlay (unlike F1's opaque one) doesn't visually mask it.
- **[Design decision #3] Day-simulation Next/Previous-day nav buttons are a 7th gated surface, correctly blocked by `inert` but never named or tested** _(Subagent #6)_.
- **[Steps 2, 3] Export style ("export default") never explicitly stated for the two new components** _(Subagent #4)_.
- **[Step 7] "or the repo root's equivalent workspace script" parenthetical refers to a script that doesn't exist** _(Subagent #4)_.

### Verification Gaps
- **Step 4**: loading-branch `.App` inert case is missing (see Major finding above).
- **Step 4**: no test for the `justRelocked`-derivation transition logic itself.
- **Step 5**: needs `page.reload()` after `page.clock.install()`, and raw-coordinate `page.mouse.click()` for the hit-testing assertion.

### To-Do: Mechanical Fixes (applied)
- [x] Correct the "all App-level test files" claim and extend the regression-guard to-do to include `App.screenBlank.test.tsx` and `App.screenBlank.realClock.test.tsx` _(dedupes findings from Subagents #1, #3, #6)_
- [x] Add a Step 6 bullet noting Open risk (b) is moot given (a)'s local-only resolution
- [x] Specify that the `.closest('.App')` assertion must target a non-portaled element (`touch-lock-indicator` or chore/loading text), never `touch-lock-overlay`
- [x] Add a loading-branch inert test case to Step 4, mirroring `App.screenBlank.test.tsx` lines 93-102
- [x] Insert `page.reload()` after `page.clock.install()` and before `fastForward()` in Step 5, mirroring the file's own DD-7 pattern
- [x] Specify raw-coordinate `page.mouse.click()` (not locator `.click()`) for Step 5's hit-testing/blocking assertion, mirroring the DD-7 companion test
- [x] Remove the dangling "— see note below" hedge in Step 4; state plainly that `App.touchLock.test.tsx` duplicates its own `swipe()`/`stubBarWidth()` helpers, consistent with existing duplication
- [x] Add boundary-value test cases (exactly 60px, exactly 1500ms) to Step 3's Red to-do
- [x] Finalize `justRelocked` as the prop name in Step 3; remove the hedge parenthetical
- [x] Add a one-line caveat to Design decision #6 marking the 1500ms/60px thresholds as a default assumption open to on-device revision
- [x] Add a one-line note confirming `inert` incidentally also gates `ChoreTimerBar`'s pre-existing ungated sr-only Delete/Edit buttons
- [x] State "export default" explicitly in Steps 2 and 3's Green to-dos for the two new components
- [x] Fix Step 7's inaccurate "repo root's equivalent workspace script" parenthetical

### Design Decisions (awaiting user input)

#### DD-1: [Step 3 / Step 4] How should the unlock (arm) exit animation actually be kept alive through its close animation?
**Context:** `arm()` flips `isLocked` to `false` synchronously, so `App`'s conditional render (`{isLocked && !isBlanked && <TouchLockOverlay .../>}`) unmounts the overlay on the very next render — before its "opening and minimizing" animation can play. The plan promised a hand-off in Step 4 but never built one.

| # | Option | Trade-off |
|---|---|---|
| 1 | App owns a local `isClosing` boolean/timer, set when a qualifying tap arms, cleared by a `setTimeout` matching the animation duration; render the overlay while `isLocked \|\| isClosing` | Keeps App as the single owner of mount lifecycle, consistent with how it already force-closes dialogs; adds one more piece of local state to App.tsx |
| 2 | `TouchLockOverlay` calls an `onAnimationComplete` prop when its own internal close-timeout elapses, and App only stops rendering it then | Keeps animation timing encapsulated inside the overlay component itself; requires a new callback prop and App tracking a small "stillClosing" flag driven by it |
| 3 | Delay the underlying `setIsLocked(false)` itself until after the animation completes, using a separate immediate "unlocking" visual phase for interactive parts | Riskier — changes when the rest of the app actually becomes interactive again relative to the visual state, diverging from the existing precedent of state and visuals changing together |

**Chosen:** Option 1 — App owns a local `isClosing` boolean/timer (`CLOSING_SETTLE_MS = 400`,
exported from `TouchLockOverlay.tsx` so the component's own CSS transition duration and App's
unmount-delay stay numerically in sync). Applied to Design decision #7, Step 3's Red/Green
to-dos, and Step 4's Green to-do.

#### DD-2: [Step 4] Where exactly does the `justRelocked` ref comparison/update happen — render body or `useEffect`?
**Context:** Getting this wrong either introduces an off-by-one-render lag (if done in a `useEffect`) or requires an unusual-for-this-codebase in-render-mutation idiom (if done directly in the render body). This is load-bearing for whether the entrance animation ever actually shows.

| # | Option | Trade-off |
|---|---|---|
| 1 | Mutate the ref directly in the render body, immediately before use (`const justRelocked = isLocked && !wasLockedRef.current; wasLockedRef.current = isLocked;`) | Correct same-render timing; this "usePrevious"-style in-render mutation isn't used elsewhere in this codebase, but is a well-known, safe React idiom |
| 2 | Update the ref inside a `useEffect` keyed on `[isLocked]`, accepting one extra render cycle before the entrance flag is set | More familiar effect-based style, but the animation trigger would lag by one render — likely visible as a brief delay before the entrance animation starts |

**Chosen:** Option 1 — mutate `wasLockedRef.current` directly in the render body,
immediately before the JSX return, computing `justRelocked` right before the mutation.
Applied to Step 4's Green to-do with the exact line ordering spelled out.

#### DD-3: [Design decision #3] Should the day-simulation Next/Previous-day nav buttons get explicit lock-gating test coverage?
**Context:** These buttons are correctly blocked by `inert` today (they're plain children of `.App`), but the plan's Design decision #3 only names six surfaces and Step 4 only tests those six. This is a coverage-only question — the gating mechanism itself needs no code change either way.

| # | Option | Trade-off |
|---|---|---|
| 1 | Add explicit day-nav/"Return to Today" assertions to Step 4's Red to-do | More complete test coverage; a few more lines in an already-large test file |
| 2 | Leave untested, but add a one-line note in Design decision #3 acknowledging `inert`'s blanket coverage extends to every `.App`-nested control generically | Less test-file bloat; relies on the generic mechanism rather than per-surface verification |

**Chosen:** Option 2 — left untested; a note is added to Step 4's Red to-do documenting that
day-nav/"Return to Today" are covered by the same generic `inert` mechanism, not individually
verified.

#### DD-4: [Design decision #7] Should the overlay's transparent "idle" phase get a brief opaque backdrop to mask the one-frame dialog-flash race?
**Context:** F1's `ScreenBlankOverlay` is always opaque, so a portaled dialog being force-closed one frame late is invisible. F2's idle phase is transparent by design, so the same one-frame gap could show a flash of the dialog (still non-interactive, since the overlay swallows clicks either way) before it closes.

| # | Option | Trade-off |
|---|---|---|
| 1 | Accept as a documented, extremely minor cosmetic trade-off — no code change | Simplest; the flash (if it ever renders at all, since it's a single React commit width) is non-interactive and easy to miss in practice |
| 2 | Give the overlay a brief semi-opaque backdrop during its very first paint to mask the same gap F1 gets for free | Fully closes the cosmetic gap; adds a small amount of extra visual-transition complexity to an already animation-heavy component |

**Chosen:** Option 2 — a `data-testid="touch-lock-backdrop"` element renders only during the
`'just-relocked'` phase, fading out together with the centered padlock. Applied to Design
decision #7, and Step 3's Red/Green to-dos.

---

### Note: one additional ordering decision resolved directly (not escalated as a DD)

Subagent #3 (Ordering) flagged Step 6's placement (META-PLAN.md update) before Step 7 (final
verification) as technically a "step ordering" change, which the skill's bright-line rules
always classify as `design_decision`. Given how low-stakes this specific case is (a
documentation-edit ordering choice with an unambiguous, directly-precedented right answer —
F1's own plan, `plans/feature/auto-screen-blank/auto-screen-blank.md`, folds the identical
META-PLAN.md edit as the last to-do inside its own final "Verify All Tests Pass" step), this
was resolved directly by matching that precedent rather than spending a DD slot on it: Step 6
was folded into what is now Step 6 = "Verify All Tests Pass," with the META-PLAN.md edit as
its final to-do. Flagging this here for transparency rather than silently deviating from the
skill's own classification rule.

### Verdict
[ ] Ready to proceed as-is
[ ] Proceed after minor fixes
[x] Requires changes before proceeding

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | No deletions in this plan; no dead-import risk found (Subagent #3) |
| Type annotations | [x] | Hook/component signatures checked against TS conventions (Subagent #1, #4) |
| Error handling (status codes, exceptions, user feedback) | [x] | N/A — no backend/API surface in this plan; UI-only error states not applicable |
| Test coverage (happy path, sad path, edge cases) | [x] | Gaps found and listed above (loading branch, boundary values, justRelocked transition, day-nav) |
| Breaking changes (API contracts, shared state, DB schema) | [x] | None — purely additive frontend feature (Subagent #6) |
| Config consistency (env vars, requirements pins, lint rules) | [x] | No new packages; lucide-react already pinned; no lint-rule conflicts found (Subagent #4) |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | Compliant; no repo-level CLAUDE.md exists, global CLAUDE.md's icon-library rule satisfied (Subagent #4) |

---

## Review — 2026-07-08 (Pass 2)

### Summary
Re-verified every Pass 1 fix and DD resolution against the actual updated plan text. Most
landed correctly, but one Pass 1 critical finding was silently dropped rather than fixed
(jsdom cannot behaviorally enforce `inert`, so Step 4's Red to-do (c) was still asking for an
unimplementable assertion), and the new regression test added for DD-1 (Step 4's case (g))
didn't actually exercise the real code path it was meant to verify. Both are now fixed. Needs
one more verification pass before this is genuinely ready.

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness (re-verify) | FAIL | 1 critical (reopened), 0 major, 1 minor |
| 2 | Full-Stack Trace (re-verify) | FAIL | 1 critical (reopened), 0 major, 0 minor |
| 3 | Ordering & Verification (re-verify) | PASS | 0 critical, 0 major, 0 minor |
| 4 | Completeness (re-verify) | FAIL | 0 critical, 1 major, 1 minor |

### Findings

#### Critical (must fix before proceeding)
- **[Step 4] Pass 1's jsdom/`inert` critical finding was silently dropped, not fixed** _(Subagents #1, #2 — independently confirmed)_: Step 4's Red to-do (c) still instructed duplicating `swipe()`/`stubBarWidth()` to fire gestures directly on gated descendant elements (chore bar, search input, etc.) and assert their handlers don't fire while `isLocked: true`. jsdom has zero behavioral implementation of `inert` (re-confirmed via source grep), so this cannot pass regardless of implementation correctness. Verified against `App.screenBlank.test.tsx`'s actual working precedent (lines 80-91): F1 only ever asserts that clicking the *overlay's own node* doesn't trigger anything — a DOM-tree-separation argument that needs no `inert` enforcement — and defers all real hit-testing/blocking proof to Playwright (documented there as "DD-7"). Neither the Pass 1 mechanical-fixes list nor its Design Decisions addressed this specific finding at all; it fell out of the synthesis. **Root cause:** when compiling Pass 1's six subagent reports into a fix list, this specific full-stack-trace critical finding was not carried into either the mechanical-fixes checklist or a Design Decision — a synthesis gap, not a disagreement with the finding itself.

#### Major (should fix)
- **[Step 4] The new isClosing regression test (case (g), added to verify DD-1) doesn't actually trigger the code path it's meant to prove** _(Subagent #4)_: as originally worded, it only changed `mockUseTouchLock`'s return value and re-rendered — but `isClosing` is `App`'s own local state, settable only by the real `handleArm` firing in response to an actual qualifying double-tap on the rendered overlay, not by anything inside the mocked hook. As literally specified, the test would fail against a *correctly implemented* `App.tsx`, since `isClosing` would never become `true`.

#### Minor (nice to fix)
- **[Step 6] META-PLAN.md's F2 "Expected end state" bullet about cross-device consistency wasn't explicitly targeted for rewrite** _(Subagent #4)_: this bullet directly contradicts the local-only scope decision; Step 6 gave explicit per-risk rewrite instructions for Open risks (a)-(d) but only a generic catch-all for Expected-end-state drift.
- **[Design decision #7] Narrow edge case: a re-lock landing within `CLOSING_SETTLE_MS` (400ms) of a just-armed unlock wouldn't replay the entrance animation** _(Subagent #1)_: `TouchLockOverlay`'s `phase` only initializes from `justRelocked` on mount, and the component doesn't unmount/remount across the `isClosing` bridge. Not realistically reachable given the 5-minute inactivity gate; accepted as a documented edge case, no code change.

### To-Do: Mechanical Fixes (applied)
- [x] Rewrote Step 4's Red to-do (c) to a jsdom-safe overlay-swallow-only assertion (mirroring `App.screenBlank.test.tsx` lines 80-91 exactly), with an explicit instruction never to fire gestures directly on gated descendant elements and expect `inert` to block them in jsdom — that proof is now explicitly deferred to Step 5's e2e suite
- [x] Rewrote Step 4's case (g) to two-step the simulation: fire two real `fireEvent.click` calls on the overlay itself (driving the real `handleArm`/`isClosing` path), *then* update the mock's `isLocked` to `false` and rerender, before asserting the close-timing behavior
- [x] Added an explicit Step 6 bullet instructing the cross-device-consistency "Expected end state" bullet in `plans/META-PLAN.md` be rewritten to state local-only scope
- [x] Added a one-line accepted-edge-case note to Design decision #7 about the narrow `CLOSING_SETTLE_MS`-window re-lock/entrance-animation interaction

### Missed-Finding Root Causes
| Finding | Root cause | Skill gap? |
|---|---|---|
| Pass 1's jsdom/`inert` critical finding silently dropped | Trusted plan assertion / fix verification stopped at plan text — when synthesizing 6 subagents' worth of findings into one To-Do list by hand (this session applied fixes directly rather than via one-fixing-subagent-per-finding, per its own stated reasoning about single-file edit races), one critical finding was missed during manual transcription from the raw subagent JSON into the merged checklist. This is an execution miss in this session's manual synthesis step, not a gap in the subagent's own checklist — the full-stack-trace subagent's prompt already correctly instructed checking DOM-boundary/portal test-query validity. | Instructions already cover this (subagent-prompts.md's "DOM-boundary side effects" checklist item for Subagent 5, and Subagent 2's own checklist, already require exactly this check) — this was a manual-transcription miss in this session, not a prompt gap. No skill file change proposed. |
| Case (g) regression test didn't exercise the real code path | Trusted plan assertion — Pass 1's DD-1 resolution focused on *whether* App should own an `isClosing` timer, but the mechanical write-up of the *verification test* for that decision copied the `mockUseScreenBlank.mockReturnValue(...); rerender(...)` pattern from `App.screenBlank.test.tsx` by analogy without checking whether the state being toggled (`isClosing`) actually lives inside the mocked hook the same way `isBlanked` does. | Instructions already cover this in spirit (the "DD option viability" and "what-to-read is a floor" rules require verifying a prescribed fix against real source before writing it) — this session's own DD-application step should have re-read `App.screenBlank.test.tsx`'s pattern more carefully before reusing it by analogy for different underlying state. No skill file change proposed; this is logged as a lesson for this session's own DD-application care, not a reusable rule to encode. |

### Verdict
[ ] Ready to proceed as-is
[ ] Proceed after minor fixes
[x] Requires changes before proceeding (one more verification pass needed — see Pass 3)

---

## Review — 2026-07-08 (Pass 3 — hard cap)

### Summary
Final review pass (per the skill's 3-pass hard cap). Re-verified all four Pass 2 fixes —
all four confirmed genuinely correct. However, a fresh end-to-end sweep (explicitly
requested for this last pass) surfaced **two new critical bugs** that no prior pass had
found, both independently confirmed by two separately-run subagents: (1) `TouchLockOverlay`'s
full-viewport click-catching container was never described as becoming non-interactive during
the `isClosing` hand-off window DD-1 introduced, so every successful unlock would have a real
~400ms window where the vestigial overlay silently swallows the user's next tap; (2) the
`awaiting-second-tap` shrink-back timeout nulled the same `firstTapRef` its own qualifying
check depends on, which — because `vi.advanceTimersByTime` fires all timers due at or before
the advanced time inclusively — meant Pass 1's own added exact-`SECOND_TAP_WINDOW_MS`-boundary
test could never pass under the Green to-do's own prescribed implementation, independent of
the comparison operator. Two further major findings (a stale render-condition description in
Design decision #5/Research Findings that omitted `isClosing`, and an unspecified fake-timer/
`waitFor` sequencing hazard in case (g)) and two minor findings (a Tailwind-literal/constant
drift risk, unbound placeholder coordinates) rounded out this pass.

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| A | Targeted re-verify (Pass 2 fixes) + fresh sweep | FAIL | 1 critical, 0 major, 1 minor |
| B | Fresh end-to-end completeness sweep | FAIL | 2 critical, 2 major, 1 minor |

*(Two subagents independently surfaced the same core timer-race bug — see below — which is
strong convergent confirmation it's real, not a one-off misreading.)*

### Findings

#### Critical (must fix — applied directly, see To-Do below; **not re-verified by a further pass**, per the 3-pass hard cap)
- **[Step 3] Overlay stays a live, full-viewport click target for the entire `isClosing` window after every unlock** _(Subagent B)_: `TouchLockOverlay`'s outer container was never described as losing pointer-interactivity once `arm()` fires; `App.tsx` deliberately keeps it mounted for `CLOSING_SETTLE_MS` (~400ms) so its close animation can play, but as originally specified it would keep silently swallowing real taps aimed at the app underneath for that entire window on every single unlock — a reproducible contradiction of META-PLAN F2's "while armed, all existing interactions... behave exactly as before this feature."
- **[Step 3] The exact-1500ms boundary test (added in Pass 1) cannot pass under the Green to-do's own implementation, regardless of the comparison operator** _(Subagents A, B — independently confirmed)_: the `awaiting-second-tap` shrink-back timeout was scheduled at the identical `SECOND_TAP_WINDOW_MS` duration and nulled `firstTapRef.current` — `vi.advanceTimersByTime(1500)` fires that timeout (inclusive semantics) before the boundary test's second click can register, wiping the qualifying-tap state out from under it deterministically.

#### Major (should fix — applied directly)
- **[Design decision #5 / Research Findings] Both describe the overlay's render condition as `isLocked && !isBlanked`, omitting `isClosing`** _(Subagent B)_: contradicts Step 4's own (correct) `(isLocked || isClosing) && !isBlanked` wiring that resolves DD-1 — an implementer treating the Design decisions section as authoritative could silently reintroduce Pass 1's original critical bug.
- **[Step 4] Case (g) doesn't specify that `vi.useFakeTimers()` must be activated only after the initial chore-load `waitFor` resolves under real timers** _(Subagent B)_: a known RTL/fake-timer hazard this same codebase already has a working precedent for in `App.test.tsx`; as worded, a naive implementation risks a hung test.

#### Minor (nice to fix — applied directly)
- **[Step 3] `CLOSING_SETTLE_MS`'s value is duplicated as a bare Tailwind literal (`duration-[400ms]`) rather than derived from the constant** _(Subagent B)_: a future change to the constant wouldn't propagate to the CSS class, silently reintroducing the exact drift the constant's export was meant to prevent.
- **[Step 4] Case (g)'s double-click coordinates were described via unbound placeholder identifiers (`{ clientX, clientY }`) instead of concrete literals** _(Subagent A)_: inconsistent with the plan's otherwise scrupulously literal style elsewhere.

### To-Do: Mechanical Fixes (applied directly — no fixing subagent, no further review pass, per hard cap)
- [x] Stopped the shrink-back timeout from nulling `firstTapRef.current`; it now only reverts `phase`, leaving the elapsed-time check in `registerTap` as the sole source of truth for staleness
- [x] Added `pointer-events-none` to the overlay's outer container once `phase === 'opening'`, plus a Step 3 Red to-do assertion for it, so the overlay stops intercepting taps the instant `arm()` fires even though `App.tsx` keeps it mounted a little longer for the close animation
- [x] Updated Design decision #5 and the Research Findings' F1/F2-precedence bullet to read `(isLocked || isClosing) && !isBlanked`, matching Step 4's actual wiring
- [x] Added explicit real-timers-first-then-fake-timers sequencing to case (g), mirroring `App.test.tsx`'s own established pattern
- [x] Added a note flagging `duration-[400ms]` as a manually-synced literal mirror of `CLOSING_SETTLE_MS`
- [x] Replaced case (g)'s placeholder coordinates with concrete literals (`{ clientX: 100, clientY: 100 }` for both clicks)

### Missed-Finding Root Causes
| Finding | Root cause | Skill gap? |
|---|---|---|
| Overlay stays clickable during `isClosing` | Scoped too narrowly — DD-1 (Pass 1) resolved *whether* to keep the overlay mounted through its close animation, but neither the DD's options nor its applied text traced through what "mounted" implies for an element whose entire purpose (in the `'idle'`/`'awaiting-second-tap'` phases) is to intercept clicks. The DD-application step treated "stay mounted" and "stay interactive" as the same thing without checking. | Partial prompt gap: the DD-option-viability rule ("read those files... to correctly succeed") is about verifying an option works, not about auditing side effects of a *chosen* option once applied. No specific skill-file change proposed here since this is fairly specific to overlay/pointer-capture semantics rather than a generalizable checklist item. |
| Exact-boundary test timer race | Trusted plan assertion, twice over — Pass 1 added the boundary test as a mechanical fix without re-deriving its interaction with the *rest* of Step 3's own Green to-do (the shrink-back timeout), and Pass 2's re-verification of Pass-1 fixes only checked whether the boundary case *existed*, not whether it was internally consistent with the surrounding implementation it was testing. | Instructions already cover this in spirit (subagent-prompts.md's "Verify before writing" and "do not trust plan assertions" rules) but neither rule explicitly prompts a reviewer to check a *newly-added* test against *pre-existing* implementation to-do text in the same review pass for shared-timing conflicts. Possible future skill improvement: add a checklist item under Ordering/Verification along the lines of "for any timer-based test added as a fix, check whether any *other* timer scheduled in the same component/hook shares its duration and could fire first" — not applied here since no user approval step ran for this (informational only, single-plan review, not a recurring pattern across many plans yet). |

### Verdict
[ ] Ready to proceed as-is
[x] Proceed after minor fixes (all findings from this pass were mechanical/single-correct-answer and have been applied directly to the plan text; per the skill's 3-pass hard cap, this final batch of fixes was **not** re-verified by a further 6-subagent pass — the implementing session's own Red→Green TDD loop for Steps 3 and 4 is the next real checkpoint that will prove these fixes out)
[ ] Requires changes before proceeding

### Coverage Checklist (Pass 3)
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | No change from Pass 1/2 findings |
| Type annotations | [x] | No change from Pass 1/2 findings |
| Error handling (status codes, exceptions, user feedback) | [x] | N/A — no backend/API surface |
| Test coverage (happy path, sad path, edge cases) | [x] | New gaps found and fixed (boundary-test race, isClosing pointer-capture, fake-timer sequencing) |
| Breaking changes (API contracts, shared state, DB schema) | [x] | None — purely additive frontend feature |
| Config consistency (env vars, requirements pins, lint rules) | [x] | No change from Pass 1/2 findings |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | No change from Pass 1/2 findings |
