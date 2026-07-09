# Review: F1 — Auto screen-blank 9pm–6am

## Review — 2026-07-08

### Summary
Plan is well-grounded in the actual codebase (date-fns API, `useMidnightClock`/`ConfirmDialog` precedents, z-index stacking, App.tsx insertion points all verified accurate) and correctly sequenced with no forward references or dead-import issues. Three of six subagents FAILed on real gaps: a keyboard-input bypass of the "nothing underneath is reachable while blanked" guarantee, two missing test cases (loading-branch overlay, keydown inactivity-reset), a dismissed e2e clock-flakiness risk that had a cheap standard fix available, and several completeness gaps against the parent META-PLAN.md F1 spec (missing simulatedDate-independence test, four of five named invariants relying on implicit coverage, the single-tap-wake decision not durably recorded for F2). All 6 mechanical fixes have been auto-applied to the plan. 5 design decisions remain, requiring your input before proceeding.

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | PASS | 0 critical, 0 major, 1 minor |
| 2 | Full-Stack Trace | FAIL | 0 critical, 1 major, 1 minor |
| 3 | Ordering & Cleanup | PASS | 0 critical, 0 major, 1 minor |
| 4 | Integration & Conventions | PASS | 0 critical, 0 major, 1 minor |
| 5 | Verification & Coverage | FAIL | 0 critical, 2 major, 1 minor |
| 6 | Completeness & Risk | FAIL | 0 critical, 3 major, 2 minor |

### Findings

#### Major (should fix)
- **[Step 4/5] Overlay only blocks pointer/touch taps, not keyboard-driven activation of hidden controls** _(Subagent #2, corroborated by #4's minor)_: Pointer/touch tap-swallowing is verified correct (CSS stacking + DOM hit-testing genuinely prevents `ChoreTimerBar` from receiving a click). But nothing makes the app content `inert`/unreachable while blanked, so a keyboard (Tab + Enter/Space) can still activate `sr-only focus:not-sr-only` Edit/Delete buttons, room chips, search input, etc. underneath the overlay — contradicting the plan's "nothing underneath is reachable until wake" claim. See **DD-1**.
- **[Step 6] E2E clock-flakiness risk dismissed instead of using available mitigation** _(Subagent #5)_ — **FIXED (mechanical)**: Step 6 previously accepted a full-suite nightly e2e outage risk (`App.tsx` will unconditionally call `useScreenBlank()`, so every e2e test run between 21:00–06:00 local time would fail). Fixed by adding a to-do to pin `e2e/smoke.spec.ts`'s `test.beforeEach` via Playwright's built-in Clock API (`page.clock.setFixedTime(...)`), confirmed available in the pinned `@playwright/test@^1.59.1`.
- **[Step 5] Loading-branch overlay render never tested** _(Subagent #5)_ — **FIXED (mechanical)**: Step 5's `App.tsx` edit adds the overlay to both the `loading` branch and the main return, but no test exercised the loading-branch path. Fixed by adding a bullet to `App.screenBlank.test.tsx`'s to-do covering it.
- **[Step 5] Missing App-level test that the overlay ignores `simulatedDate`** _(Subagent #6)_: META-PLAN.md's F1 "Test-suite deltas" explicitly requires this exact test; the plan's current approach (mocking `useScreenBlank` entirely) makes it structurally impossible to prove this property at the App level. See **DD-2**.
- **[Step 5] Four of five named invariants (swipe, SSE re-pull gate, search filter, room filter) have no explicit named test coverage** _(Subagent #6)_: Only tap-to-complete is explicitly asserted in the new test file; the other four rely on implicit "run full suite" inheritance rather than a named assertion per invariant, per META-PLAN's Expected end state. See **DD-3**.
- **[Open risk, not in a numbered step] Single-tap-wake decision for F2 not recorded anywhere durable** _(Subagent #6)_ — **FIXED (mechanical)**: META-PLAN's own Cross-session persistence rule requires this. Fixed by adding a to-do (end of Step 6) to edit META-PLAN.md's F2 section recording the single-tap wake gesture decision, in the same PR.

#### Minor (nice to fix)
- **[Step 2] Ambiguous boundary-fire semantics: toggle vs. recompute** _(Subagent #1)_: `useMidnightClock.ts`'s precedent recomputes from the real clock on fire (`setNow(new Date())`); the plan's wording ("sets `inWindow` on fire") doesn't specify whether to recompute or blindly toggle. Only diverges under timer drift (backgrounded tab/device sleep). See **DD-4**.
- **[Step 4] `role="button"` on the overlay has no `tabIndex`/`onKeyDown`** _(Subagent #2)_ — **folded into DD-1**: whichever option is chosen for DD-1 should also make the overlay itself keyboard-operable (Enter/Space triggers `onWake`).
- **[Step 5] Step 5's atomicity relied on implicit harness behavior** _(Subagent #3)_ — **FIXED (mechanical)**: Added an explicit sentence requiring the `App.tsx` edit and all three existing-test-file mock updates to be committed as a single unit.
- **[Step 3] Inactivity-timer reset only tested via `pointerdown`, not `keydown`** _(Subagent #5)_ — **FIXED (mechanical)**: Added a mirrored keydown-reset test bullet to Step 3.
- **[Open risk, not in a numbered step] Physical Pi DPMS verification (Open risk (d)) never mentioned** _(Subagent #6)_ — **FIXED (mechanical)**: Added a deferral note to Step 6.
- **[Step 2/3] `document.visibilitychange` not considered for re-syncing stale timer state** _(Subagent #6)_: Mirrors a pre-existing, non-regressive gap already in `useMidnightClock.ts`. See **DD-5**.

### Verification Gaps
None remaining — both verification gaps found (loading-branch overlay, keydown reset test) were mechanically fixed above.

### To-Do: Mechanical Fixes (auto-applied)
- [x] Step 5: state explicitly that the `App.tsx` edit and all three existing-test mock updates must be committed as one atomic unit _(applied)_
- [x] Step 6: replace the dismissed e2e clock-flakiness risk with a to-do to pin `e2e/smoke.spec.ts` via Playwright's `page.clock.setFixedTime(...)` _(applied)_
- [x] Step 5: add a test case for the loading-branch overlay render (`fetchAllChores` pending + `isBlanked: true`) _(applied)_
- [x] Step 3: add a `keydown`-based inactivity-timer-reset test mirroring the `pointerdown` one _(applied)_
- [x] Step 6 (end): add a to-do to record the single-tap-wake decision in META-PLAN.md's F2 section, same PR _(applied)_
- [x] Step 6: add a brief deferral note for the physical-Pi DPMS verification (Open risk (d)) _(applied)_

### Design Decisions (awaiting user input)

#### DD-1: [Step 4/5] Keyboard bypass of the blanked overlay
**Context:** The overlay fully blocks pointer/touch taps (verified via CSS stacking + DOM hit-testing), but nothing prevents a keyboard user from Tab-ing to and activating hidden controls (Edit/Delete buttons, room chips, search input, Add Task, date-nav buttons) while blanked, since none of them are disabled and the overlay itself has no `tabIndex`/`onKeyDown`. This contradicts the plan's stated "nothing underneath is reachable until wake" guarantee.

| # | Option | Trade-off |
|---|---|---|
| 1 | `inert={isBlanked}` on the App wrapper div | One-line, robust fix (React 19 supports `inert` as a plain boolean DOM prop); makes all descendants unfocusable/unclickable while blanked, no per-component changes. Also give the overlay `tabIndex={0}` + `onKeyDown` (Enter/Space → `onWake`) so it remains keyboard-wakeable. |
| 2 | Focus trap on the overlay + `aria-hidden` on siblings | More conventional a11y pattern (`tabIndex={0}`, `autoFocus`/focus-on-mount, `onKeyDown` for Enter/Space) but needs pairing with `aria-hidden="true"` on the sibling content to fully block Shift+Tab/screen-reader virtual cursor reaching hidden controls — more moving parts than option 1. |
| 3 | Explicitly scope out (accept as a known kiosk-only limitation) | Cheapest — no code change. Document that this is a touch-only wall-mounted Pi display with no attached keyboard, so keyboard-bypass is an accepted, documented risk (mirroring the plan's existing e2e-gap-documentation pattern before it was fixed). Leaves a real gap if a keyboard/remote/assistive-tech device is ever attached. |

**Chosen:** Option 1 — `inert={isBlanked}` on the App wrapper. Applied to Step 5's `App.tsx` to-do (both the `loading` branch's `<div className="App">` and the main return's outer `<div>`), with a note that `ScreenBlankOverlay`'s `createPortal` render keeps it outside the `inert` subtree so it stays operable. Step 4's overlay now has `tabIndex={0}` + `onKeyDown` (Enter/Space → `onWake`), with a matching test bullet in `ScreenBlankOverlay.test.tsx`. Step 5's `App.screenBlank.test.tsx` to-do gained an `inert`-presence/absence assertion via `toHaveAttribute('inert')`.

#### DD-2: [Step 5] Missing App-level test that the overlay ignores `simulatedDate`
**Context:** META-PLAN.md's F1 "Test-suite deltas" explicitly requires an "App-level test that the overlay uses real time and ignores `simulatedDate`." The plan's current `App.screenBlank.test.tsx` approach mocks `useScreenBlank` entirely (hardcoding `isBlanked`/`wake` per test), which makes it structurally impossible for that file to exercise the real hook's independence from `simulatedDate`/`dayOffset` — the property is currently proven only by code inspection (the hook never reads `simulatedDate`), not by an explicit test.

| # | Option | Trade-off |
|---|---|---|
| 1 | Add a dedicated test using the real (unmocked) `useScreenBlank`, with `vi.useFakeTimers` fixing the real clock inside the blank window, that drives `dayOffset` via the existing day-navigation UI (`ReturnToTodayButton`/`DateNavigationBanner`) and asserts overlay presence is unaffected | Directly proves the spec's exact claim end-to-end; more test-writing effort, needs careful fake-timer setup to avoid interfering with `useMidnightClock`'s also-mocked clock in the same test file. |
| 2 | Pair a hook-level type/API test (documents `useScreenBlank` takes no simulatedDate-shaped parameter) with an App-level test holding the mocked `isBlanked` constant across `dayOffset` changes | Cheaper to write; makes the claim explicit at both layers but doesn't invoke the real hook at the App level, so it's a weaker proof than option 1. |

**Chosen:** Option 1 — real hook + fake timers + `dayOffset` test. Applied as a new to-do in Step 5 for a dedicated new file, `App.screenBlank.realClock.test.tsx` (kept separate from `App.screenBlank.test.tsx` because that file's module-scoped `vi.mock('../hooks/useScreenBlank', ...)` can't be selectively unmocked per-test). The new test fixes the real clock at 23:00 via `vi.useFakeTimers`, renders `<App />` with the real (unmocked) `useScreenBlank`, confirms the overlay is present, advances `dayOffset` via the `Next day` button, and asserts the overlay is still present — proving `dayOffset`/`simulatedDate` independence end-to-end.

#### DD-3: [Step 5] Four of five named invariants lack explicit test coverage
**Context:** META-PLAN.md's F1 Expected end state requires "tap-to-complete, swipe gestures, SSE re-pull gate, search filter, room filter all continue to function." The plan's new test file explicitly asserts only tap-to-complete; the other four currently rely on the pre-existing `App.test.tsx`/`App.sync.test.tsx`/`App.search.test.tsx` suites still passing (which they will, since those files just get a static `useScreenBlank` mock) — but no step in *this* plan explicitly names/verifies each invariant itself.

| # | Option | Trade-off |
|---|---|---|
| 1 | Extend `App.screenBlank.test.tsx` with four additional cases (all `isBlanked: false`) directly exercising swipe, SSE re-pull, search filter, and room filter | Most rigorous — proves each invariant survives specifically alongside the new hook wiring, in the new file; more test code. |
| 2 | Add a to-do naming the exact pre-existing test names in `App.test.tsx`/`App.sync.test.tsx`/`App.search.test.tsx` that already cover swipe/SSE/search/room, documenting reliance rather than duplicating | Cheaper — just documents which existing tests are relied upon; doesn't add new assertions specific to the screen-blank feature's interaction with each invariant. |

**Chosen:** Option 1 — add 4 explicit test cases. Applied to Step 5's `App.screenBlank.test.tsx` to-do (all with `isBlanked: false`): swipe (modeled on `App.test.tsx`'s `swipe()`/`stubBarWidth()` helpers), SSE re-pull (modeled on `App.sync.test.tsx`'s first test), search filter (modeled on `App.search.test.tsx`'s substring-filter test), and room filter (modeled on `App.search.test.tsx`'s room-tab-click pattern). Each cites its exact source test/helper.

#### DD-4: [Step 2] Boundary-fire semantics: toggle vs. recompute
**Context:** `useMidnightClock.ts`'s precedent recomputes from the real clock when its timer fires (`setNow(new Date())`) rather than blindly toggling state. The plan's Step 2 wording ("sets `inWindow` on fire") doesn't specify which. Both pass the plan's own fake-timer tests (which fire exactly on schedule); they only diverge if the real setTimeout fires late (backgrounded tab, device sleep/wake) — a real risk for an always-on kiosk display.

| # | Option | Trade-off |
|---|---|---|
| 1 | Recompute on fire: `setInWindow(isWithinBlankWindow(new Date()))`, mirroring `useMidnightClock.ts` exactly | Self-corrects if the timer fires late; matches the codebase's existing precedent literally; negligible extra code. |
| 2 | Blind toggle on fire: `setInWindow(v => !v)` | Marginally simpler; correct under the plan's own fake-timer test assumptions, but can leave `isBlanked` stale by one boundary if the real timer fires very late (kiosk left running overnight through a backgrounding event). |

**Chosen:** Option 1 — recompute from real clock. Applied to Step 2's implementation to-do: on timer fire, `setInWindow(isWithinBlankWindow(new Date()))` rather than a blind toggle, explicitly citing `useMidnightClock.ts`'s `setNow(new Date())` precedent.

#### DD-5: [Step 2/3] `document.visibilitychange` not considered for stale-timer resync
**Context:** `useChoreEvents.ts` already re-fires on `visibilitychange → visible`, showing the codebase has a precedent for correcting stale state after tab backgrounding (where JS timers throttle/pause). `useScreenBlank`'s window-boundary and inactivity timers can go stale the same way if the tab/device is backgrounded for a long stretch. This mirrors a pre-existing, non-regressive gap already in `useMidnightClock.ts` (not a new problem introduced by this plan).

| # | Option | Trade-off |
|---|---|---|
| 1 | Add a `visibilitychange` effect that immediately recomputes `inWindow` from `isWithinBlankWindow(new Date())` when the tab becomes visible again | Self-heals stale state proactively; matches the `useChoreEvents.ts` precedent; adds a small amount of new code/tests beyond what `useMidnightClock.ts` itself does today. |
| 2 | Note in the plan as an accepted, pre-existing limitation inherited from the `useMidnightClock` pattern, out of scope for this session | No new code; consistent with "don't over-engineer beyond what `useMidnightClock` already does," but the gap is arguably more consequential here (missing a boundary means an unblanked kiosk overnight, vs. `useMidnightClock`'s gap only affecting a day-of-week label). |

**Chosen:** Option 1 — add `visibilitychange` resync. Applied to Step 3: a new mount-only `useEffect` listens for `visibilitychange`, recomputing `inWindow` via `isWithinBlankWindow(new Date())` when the tab becomes visible, mirroring `useChoreEvents.ts`'s precedent. Added a corresponding test bullet using `vi.setSystemTime` (without `vi.advanceTimersByTime`) to simulate a stale pending boundary timer, then dispatching a stubbed `visibilitychange` event and asserting immediate resync.

---

### Verdict
[ ] Ready to proceed as-is
[ ] Proceed after minor fixes
[x] Requires changes before proceeding (design decisions above)

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | Ordering subagent confirmed no deletions/dead imports; `date-fns` `set`/`addDays`/`isBefore` all verified as real exports at the pinned version. |
| Type annotations | [x] | Correctness subagent verified `useState<boolean>`/`useRef<ReturnType<typeof setTimeout> \| null>` type-check against `tsconfig.json` strictness. |
| Error handling (status codes, exceptions, user feedback) | [ ] | N/A — no backend/HTTP layer in this feature. |
| Test coverage (happy path, sad path, edge cases) | [x] | Verification + Completeness subagents found and (partly) fixed gaps (loading branch, keydown, simulatedDate-independence, 4 invariants — see DDs above for the unresolved portion). |
| Breaking changes (API contracts, shared state, DB schema) | [x] | No backend/schema touched; Completeness subagent confirmed no other consumer relies on `App.tsx`'s hook-call order/JSX shape being disturbed. |
| Config consistency (env vars, requirements pins, lint rules) | [x] | Integration subagent confirmed `date-fns` already pinned at a compatible version, no new dependency needed, CI runs `npm test` matching the plan's verification commands. |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | Integration subagent confirmed named-export hook / default-export component conventions followed; only the `role="button"` a11y note (folded into DD-1). |

---

## Review — 2026-07-08 (Pass 2)

### Summary
Re-reviewed the plan after all 5 Pass-1 design decisions were applied. Four subagents independently re-verified each DD's resolution against the real, pinned dependency sources (React 19's `inert` prop, `jsdom@29.0.2`, `@testing-library/jest-dom@6.9.1`, Vitest's fake-timer semantics, Playwright's Clock API) and confirmed DD-2 through DD-5 genuinely close the gaps they targeted, with only minor wording/documentation nits. However, DD-1 (the `inert`-based keyboard-bypass fix) surfaced two new major findings that were missed in Pass 1 because they only become visible once the *implementation* of DD-1 is scrutinized in detail: (1) `inert` on the `.App` wrapper doesn't reach `ConfirmDialog`/`ChoreFormModal`, which portal to `document.body` exactly like `ScreenBlankOverlay` does — so an open dialog/form left idle into the blank window stays keyboard-reachable; (2) the pinned test stack (`jsdom@29.0.2`) implements zero behavioral semantics for `inert` (confirmed by downloading and grepping the actual package sources), so the plan's only test for the keyboard-block guarantee (`toHaveAttribute('inert')`) proves the attribute is applied, not that it actually blocks anything — an unavoidable jsdom limitation, not a plan defect, but one the plan should acknowledge or route around. All 4 mechanical fixes from this pass are applied. 2 new design decisions need your input.

### Subagent Results (Pass 2)

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | PASS | 0 critical, 0 major, 1 minor |
| 2 | Full-Stack Trace | FAIL | 0 critical, 1 major, 1 minor |
| 3 | Ordering & Cleanup | PASS | 0 critical, 0 major, 1 minor |
| 4 | Integration & Conventions | PASS | 0 critical, 0 major, 0 minor |
| 5 | Verification & Coverage | PASS | 0 critical, 0 major, 2 minor |
| 6 | Completeness & Risk | FAIL | 0 critical, 2 major, 1 minor |

### Missed-Finding Root Causes

| Finding | Root cause | Skill gap? |
|---|---|---|
| `inert` doesn't cover portaled `ConfirmDialog`/`ChoreFormModal` | **Scoped too narrowly**: Pass 1's Full-Stack-Trace subagent verified the tap-swallowing/z-index/portal-coexistence properties for the *overlay itself* but wasn't prompted to check whether Pass 1's own DD options (once chosen) would interact with the *other* existing portal-based components in the tree; the gap only became checkable once DD-1's concrete fix (`inert` on `.App`) existed to trace against. | Instructions already cover this in principle ("what-to-read is a floor, not a ceiling" / "enumerate-all-instances sweep"), but neither explicitly prompts a reviewer to re-scan for *other pre-existing portals* whenever a DD's fix is scoped to a single DOM ancestor. Worth a future addition to the DD-viability check: "if a chosen `design_decision` option scopes a fix to a single DOM subtree/ancestor, enumerate every other component in the codebase that portals or otherwise escapes that subtree, and confirm the fix's guarantee still holds for each." |
| jsdom cannot verify `inert`'s behavioral effect | **Incomplete file reads (of transitive test-infra, not source code)**: Pass 1's subagents verified `inert` was a real React/DOM feature but did not download and inspect the actual pinned `jsdom`/`jest-dom` package sources to confirm the *test environment* enforces it — an easy trap since the attribute existing in React/the DOM spec doesn't imply jsdom implements its behavior. | `prompt_gap` — subagent-prompts.md's Pydantic/Tailwind-specific "specifics" sections show the pattern (flag known library gotchas), but there's no equivalent "jsdom/happy-dom implementation gaps" checklist item for reviewers of any React/Vitest plan that introduces a DOM feature whose *behavior* (not just attribute reflection) is being tested. |

### Findings (Pass 2)

#### Major (should fix)
- **[Step 5] `inert={isBlanked}` on `.App` doesn't cover `ConfirmDialog`/`ChoreFormModal`** _(Subagents #2 and #6, independently corroborating)_: Both dialogs use the identical `createPortal(..., document.body)` pattern as `ScreenBlankOverlay` — so they're DOM siblings of `.App`, not descendants, and remain fully keyboard-operable if left open when the screen blanks (5-min inactivity or the 21:00 boundary can fire while a delete-confirm or edit form is open, since their open/closed state is independent of the blank hook). See **DD-6**.
- **[Step 5] The only test for the keyboard-block guarantee proves attribute presence, not actual behavior — jsdom implements zero `inert` semantics** _(Subagent #6, corroborated by #1's minor)_: Confirmed by downloading and grepping the actual pinned `jsdom@29.0.2` and `@testing-library/jest-dom@6.9.1` sources — `inert` has no hookup into jsdom's focus/hit-test/event-dispatch model. The plan's `toHaveAttribute('inert')` assertions are correct and necessary but cannot prove the behavioral guarantee; only a real browser (e.g. Playwright/Chromium) can. See **DD-7**.

#### Minor (nice to fix, all fixed mechanically)
- **[Step 5] Swipe-invariant bullet's "reuse" wording could be misread as a cross-file import** _(Subagents #3 and #5, duplicate finding)_ — **FIXED (mechanical)**: `swipe`/`stubBarWidth` in `App.test.tsx` are unexported locals; reworded to say "duplicate locally," not import.
- **[Step 4] `onKeyDown` doesn't call `event.preventDefault()` for Space** _(Subagent #2)_ — **FIXED (mechanical)**: Added `event.preventDefault()` before `onWake()` in the Enter/Space branch, per standard custom-`role="button"` keyboard-widget practice.
- **[Step 5] `vi.useFakeTimers` + `await waitFor` combination diverges from the codebase's cautious convention (though verified safe)** _(Subagent #5)_ — **FIXED (mechanical)**: Added an inline-comment instruction explaining why the combination doesn't hang in this repo (no global `jest`, so `waitFor` uses its real-timer/MutationObserver fallback).
- **[Step 5] realClock test doesn't specify `fireEvent.click` vs `user.click`** _(Subagent #6)_ — **FIXED (mechanical)**: Specified `fireEvent.click` explicitly, matching the cited `App.test.tsx` precedent (avoids `user-event`'s internal timer-based delays misbehaving under `vi.useFakeTimers`).
- **[Step 5] `inert`'s behavioral guarantee is provable only via browser conformance, not this plan's Vitest suite** _(Subagent #1)_ — folded into **DD-7** below (same root cause as Subagent #6's major finding, different severity assessment; treated as the more urgent major framing).

### Design Decisions (awaiting user input)

#### DD-6: [Step 5] `inert` fix doesn't cover portaled `ConfirmDialog`/`ChoreFormModal`
**Context:** `ConfirmDialog.tsx` and `ChoreFormModal.tsx` both render via `createPortal(..., document.body)`, identical to `ScreenBlankOverlay`. `inert={isBlanked}` on `.App`'s outer div has zero effect on them, since `inert` is a real-DOM-tree ancestor/descendant property, not a JSX-nesting one. If a user opens a delete-confirm dialog or an edit form and then goes idle for 5+ minutes (or the 21:00 boundary hits) while it's still open, the screen blanks but the dialog/form remains fully keyboard-Tab-reachable and activatable behind the black overlay — a keyboard user could blind-confirm a delete or submit an edit. Pointer/touch users remain correctly blocked (the overlay's `z-[100]` visually and hit-test-wise covers the dialogs' `z-50`), so this leaves a pointer-vs-keyboard asymmetry standing exactly where DD-1 set out to remove one.

| # | Option | Trade-off |
|---|---|---|
| 1 | Also make `ConfirmDialog`/`ChoreFormModal` `inert` when blanked, via a prop threaded from `App.tsx` | Closes the gap directly and symmetrically with the main-content fix; requires adding an `isBlanked`(or similarly-named) prop to both components and their portal root divs, plus test coverage for "dialog open + blanked" in each. |
| 2 | Auto-dismiss/cancel any open dialog or form when `isBlanked` transitions to `true` | Arguably better UX regardless of input method (a blind confirm/edit while the screen is black is undesirable for pointer users too, not just keyboard); requires `App.tsx` to reset `pendingDeleteId`/`editingId`/`showForm` on the `isBlanked` transition, and discards any in-progress edit silently. |
| 3 | Explicitly scope out and document as an accepted, known exception | Cheapest — no code change; document that an open dialog/form left unattended into the blank window is a known limitation, out of scope for this session (mirrors how DD-1 itself considered and rejected an equivalent "accept as limitation" option for the main-content case — so this would be a narrower, more defensible carve-out than that one). |

**Chosen:** Option 2 — auto-dismiss open dialogs/forms on blank. Applied to Step 5's
`App.tsx` wiring bullet: a new `useEffect` keyed on `[isBlanked]` calls
`setPendingDeleteId(null)`, `setEditingId(null)`, and `setShowForm(false)` when
`isBlanked` becomes `true`. This makes the `inert` fix on `.App` sufficient on its own —
`ConfirmDialog`/`ChoreFormModal` both portal to `document.body` exactly like
`ScreenBlankOverlay`, so nothing else needs a per-dialog `inert` prop once there's
nothing left open in either portal to protect. Step 5's `App.screenBlank.test.tsx`
to-do gained a matching test case: open the delete-confirm dialog (via the "Delete
chore" button) and separately the edit form (via the "Edit chore" button), flip the
mocked `isBlanked` to `true` via `mockUseScreenBlank.mockReturnValue(...)` + `rerender`,
and assert each is gone.

#### DD-7: [Step 5] `inert`'s behavioral guarantee is unverifiable in the pinned test stack (jsdom implements no `inert` semantics)
**Context:** Confirmed by downloading and grepping the actual pinned `jsdom@29.0.2` and `@testing-library/jest-dom@6.9.1` package sources: `inert` has zero implementation in jsdom's focus/hit-test/event-dispatch model (it's treated like any unrecognized attribute — reflected, but not enforced). This means the plan's only test for the keyboard-block guarantee (`toHaveAttribute('inert')` presence/absence) can never prove the attribute actually blocks anything — a test asserting "clicking a hidden button while blanked does nothing" would pass in jsdom regardless of whether `inert` is even applied, giving false confidence. The behavioral guarantee is real in production (React 19 + real browsers implement `inert` correctly), but it rests entirely on browser-spec conformance, unverified by this codebase's unit-test suite.

| # | Option | Trade-off |
|---|---|---|
| 1 | Add a real-browser Playwright e2e test (in `e2e/smoke.spec.ts`, reusing the clock-pin technique Step 6 already introduces) that drives real keyboard `Tab` navigation while the overlay is engaged, and asserts a hidden control never receives focus/activation | Proves the guarantee in the one layer of the test stack that actually implements `inert` (Chromium); adds meaningful new e2e coverage; more effort, and e2e tests are slower/more brittle than unit tests. |
| 2 | Explicitly document in the plan that the `inert`-presence assertion is the practical limit of what the Vitest/jsdom stack can verify, and that the actual behavioral guarantee rests on browser-spec conformance, not a passing unit test | No new test code; honest about the limitation; leaves the actual keyboard-block behavior unverified by any automated test in this repo, relying entirely on manual/production trust. |

**Chosen:** Option 1 — real-browser Playwright e2e keyboard test. Applied to Step 6: a
new to-do, placed right after the existing noon clock-pin to-do (a separate test case,
not a change to the shared `beforeEach`'s pin), overrides the pin with a fixed 23:00
instant inside the blank window, reloads the page so the real `useScreenBlank` re-mounts
against it, confirms `screen-blank-overlay` is visible, then presses `Tab` repeatedly and
asserts `document.activeElement`'s testid is never anything other than `null` or
`'screen-blank-overlay'`. This is the only automated proof of `inert`'s actual
behavioral guarantee anywhere in the suite, since jsdom (used by the Vitest tests added
in Step 5) implements no `inert` semantics at all.

---

## Review — 2026-07-08 (Pass 3 — final)

### Summary
Final, hard-capped review pass. Two subagents independently re-verified DD-6 and DD-7's applied resolutions against the real code (not trusting the review file's own summaries) and did a fresh, holistic end-to-end read of the entire current plan text, cross-checking it one more time against META-PLAN.md's full F1 spec. **Both came back clean: 0 critical, 0 major findings.** DD-6 (auto-dismiss) was confirmed to close the keyboard-reachability gap completely — `ConfirmDialog`/`ChoreFormModal` are the only other `createPortal`-based components in the frontend, and resetting `pendingDeleteId`/`editingId`/`showForm` empties both of them before the blank window is reached, with no side effect on the SSE re-pull gate (the auto-dismiss actually self-heals `isRepullGated()` via the pre-existing effect at `App.tsx` lines 112-114). DD-7's Playwright e2e test was confirmed to use only real, non-fabricated Playwright Clock/keyboard APIs, and the Tab-loop assertion is provably correct given `inert` + DD-6 leave the overlay as the only tabbable node in the real DOM. One trivial cosmetic wording suggestion was found and applied directly (noting the first `Tab` press lands on the overlay itself). Per the review loop's hard cap, this ends the review — the plan is ready for implementation.

### Subagent Results (Pass 3)

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| DD-6/DD-7 verification (Full-Stack-Trace + Completeness lens) | PASS | 0 critical, 0 major, 0 minor |
| Full plan re-sweep (holistic correctness + completeness) | PASS | 0 critical, 0 major, 1 minor |

### Findings (Pass 3)

#### Minor (fixed directly)
- **[Step 6] DD-7's Tab-loop test could note the overlay is the first Tab stop** — **FIXED (applied directly)**: added a clarifying parenthetical to the e2e to-do noting the first `Tab` press is expected to focus the overlay itself, since it's the only tabbable element left in the document once `.App` is `inert` and DD-6's auto-dismiss has cleared any open dialog/form.

### Resolve During Implementation
None — Pass 3 found 0 critical and 0 major findings (the review loop's early-exit condition), so nothing remains deferred.

### Final Verdict
[x] Ready to proceed as-is
[ ] Proceed after minor fixes
[ ] Requires changes before proceeding

**All 3 review passes complete. 12 findings total across the review (6 in Pass 1, 5 in Pass 2, 1 in Pass 3) — all fixed (10 mechanically, 1 directly) or resolved via 7 user design decisions (DD-1 through DD-7). The plan is verified solid and ready for `/run-plan`.**

