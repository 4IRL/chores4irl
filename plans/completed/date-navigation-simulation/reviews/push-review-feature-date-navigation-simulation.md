# Push Review: feature/date-navigation-simulation

## Review 1
Generated: 2026-04-21 17:47
Comparison: main...HEAD
Verdict: **PUSHED WITH MINOR FINDINGS**

### Results by Reviewer

#### 1. Safety & Security — PASS
No security issues; purely client-side UI state, no new API endpoints, no user-supplied content rendered as HTML, handler-level simulation guard correctly prevents PATCH calls during simulation.

#### 2. Correctness — PASS
Production logic is correct. One minor latent animation-direction bug: clicking `ReturnToTodayButton` sets `dayOffset` to 0 directly, bypassing `DateNavigationBanner`'s onClick handlers — so `slideClass` retains whatever was last set (e.g. `slide-in-right` from the preceding Next click), and today's date animates in from the right rather than the left.

#### 3. Simplicity & Conciseness — PASS
Diff is lean and well-scoped. Minor items: redundant `slideClass` state (key-based remount already retriggers CSS), an unnecessary thunk wrapper, commented-out test blocks with TODOs.

#### 4. Test Coverage — PASS
All significant user-facing behaviors covered. Gap: three `isUrgent` tests in `ProgressBar.test.tsx` were commented out with TODOs promising `OverdueBadge`-visibility replacements, but no replacement tests were written. `OverdueBadge`'s show/hide is currently only asserted indirectly.

#### 5. Completeness & Cleanup — PASS
No debug artifacts, no stubs in prod paths. Only cleanup items are the commented-out test blocks (test-file only, no prod impact).

#### 6. Consistency & Style — PASS
New components follow existing patterns closely. Minor drift: `lucide-react` pinned exact (`1.8.0`) while every other dependency uses `^`; commented-out test-block pattern has no other precedent in the project; thunk-wrapped handlers in new components vs. direct prop references in sibling components.

#### 7. Integration Risk — PASS
All call sites for changed shared APIs (`ChoreList`, `ChoreTimerBar`, `ProgressBar`, `BarMathResult`) are fully updated. No broken callers, no missing migrations. `lucide-react@1.8.0` has zero transitive deps and compatible peer range.

### To-Do: Required Changes

- [x] **Reset slide direction when returning to today** — `frontend/src/components/nav/DateNavigationBanner.tsx`, `frontend/src/App.tsx` — After clicking the `ReturnToTodayButton` pill, the date heading animates in from the right (using the stale `slideClass` from the last Next click) instead of from the left. Fix: accept an optional `onReset` prop in `DateNavigationBanner` (or expose an imperative ref) and set `slideClass` to `'slide-in-left'` before delegating to the parent, matching the existing pattern used by `onPrev`. Rewire `App.tsx` so `ReturnToTodayButton` invokes the banner's reset handler rather than `setDayOffset` directly.

- [x] **Simplify or remove redundant `slideClass` state** — `frontend/src/components/nav/DateNavigationBanner.tsx` — The `key={simulatedDate.toDateString()}` already re-mounts the `<h1>` on every date change, retriggering the CSS animation regardless of whether `slideClass` was updated. The state is functionally redundant. Either derive the animation class inline from a passed-in `direction` prop, or remove the state and use CSS-only animation keyed on mount. Once the bug above is fixed, revisit whether state is still needed.

- [x] **Replace commented-out `isUrgent` tests with `OverdueBadge` visibility tests** — `frontend/src/__tests__/components/ProgressBar.test.tsx:611-633`, `frontend/src/__tests__/components/ChoreTimerBar.barMath.test.ts:348` — Three tests in `ProgressBar.test.tsx` and one in `ChoreTimerBar.barMath.test.ts` are commented out with TODOs. Delete the stale commented blocks and add new tests in `ChoreTimerBar.test.tsx` asserting `OverdueBadge` renders when `isOverdue === true` and does not render when `isOverdue === false`. (Alternatively convert the stubs to `it.todo(...)` if replacements aren't ready yet.)

- [x] **Remove unnecessary thunk wrappers for click handlers** — `frontend/src/components/nav/ReturnToTodayButton.tsx:18`, `frontend/src/components/nav/DateNavigationBanner.tsx` — Replace `onClick={() => onReset()}` with `onClick={onReset}` and equivalent for `onPrev` / `onNext` where no argument transformation is needed. Matches the direct-prop-reference style used by sibling components like `RoomTab`.

- [x] **Decide caret-pin vs. exact-pin for `lucide-react`** — `frontend/package.json:15` — Every other dependency uses a caret range; `lucide-react` is pinned to `1.8.0` exact. Either change to `^1.8.0` for consistency, or leave exact and add a brief comment explaining why (minor-version drift risk, plan requirement, etc.).

## Review 2
Generated: 2026-04-22 19:07
Comparison: origin/feature/date-navigation-simulation...HEAD
Verdict: **PUSHED WITH MINOR FINDINGS**

### Results by Reviewer

#### 1. Safety & Security — PASS
No security vulnerabilities; diff contains only React refactoring, dependency caret-pinning, and test additions with no user input, secrets, or unsafe operations.

#### 2. Correctness — PASS
Ref-based slide-direction derivation is correct for all normal paths (initial render, forward nav, backward nav including Return-to-today); Strict Mode double-effect is harmless; OverdueBadge test dates are arithmetically correct. One minor edge-case note: if the component ever unmounts and remounts with a non-zero `dayOffset`, `useRef(dayOffset)` initializes prev to the current value so the first post-remount render would show no animation. Not a concern under current app structure where the banner is always mounted.

#### 3. Simplicity & Conciseness — PASS
Refactor cleanly achieves its stated goals: `slideClass` state eliminated, thunk wrappers removed, unused `screen` import cleaned up. The `useRef` prev-value pattern is the correct idiomatic React solution and fixes a real bug.

#### 4. Test Coverage — PASS
All new behavior is tested. Three minor gaps:
- The "slide-in-left after Return-to-today" direction is not asserted by any test (Playwright covers the navigation but not the className; vitest covers slide-in-right after Next but not slide-in-left after reset).
- `ChoreTimerBar.barMath.test.ts:49` (daysSince === frequency boundary) does not assert `isOverdue === false` — the most likely place a future refactor could accidentally flip `>` to `>=`.
- The new OverdueBadge component tests do not cover the exact-due-date boundary (chore due today, daysSince === frequency).

#### 5. Completeness & Cleanup — PASS
All commented `isUrgent` blocks removed, TODO + commented line removed from barMath tests, unused `screen` import dropped, no new debug artifacts, TODOs, or placeholder values.

#### 6. Consistency & Style — PASS
`lucide-react` caret-pinned to `^1.8.0` matching all other deps; onClick handlers use direct prop refs (`onPrev`/`onNext`/`onReset`) consistent with the `RoomTab` pattern; 4-space indentation, camelCase naming, and import ordering all follow existing conventions.

#### 7. Integration Risk — PASS
All call sites compatible with the refactored components; no breaking API, schema, or cross-module changes. Minor note on lucide-react semver: `^1.8.0` on a `1.x.y` package allows minor-range upgrades; icons used (ChevronLeft, ChevronRight, RotateCcw) are long-stable exports, acceptable.

### To-Do: Required Changes

- [x] **Add a slide-in-left assertion after Return-to-today** — `frontend/src/__tests__/components/DateNavigationBanner.test.tsx` — Following the pattern of the existing slide-in-right test at lines 85-105, add a harness-style test that advances the banner to `dayOffset=2`, then simulates the dayOffset dropping back to 0 (as Return-to-today does), and asserts the heading className contains `slide-in-left`. This guards against regression of the originally-buggy stale-direction behavior that Review 1 flagged.

- [x] **Assert `isOverdue === false` at the daysSince === frequency boundary** — `frontend/src/__tests__/components/ChoreTimerBar.barMath.test.ts:49` — The existing `daysSince === frequency` test asserts `barWidth=0` and red color but not `isOverdue`. Add `expect(result.isOverdue).toBe(false);` so the boundary (`daysSince > frequency`) is protected against accidental flip to `>=`.

- [x] **Add an exact-due-date OverdueBadge component test** — `frontend/src/__tests__/components/ChoreTimerBar.test.tsx` — Add a third OverdueBadge test with `dateLastCompleted` exactly `frequency` days before `day` (e.g., frequency=7, dateLastCompleted=new Date(2025, 0, 8, 12, 0, 0) with day=new Date(2025, 0, 15)) and assert `queryByText('Overdue')` is null. Complements the boundary coverage in the math suite.

## Review 3
Generated: 2026-04-22 20:20
Comparison: origin/feature/date-navigation-simulation...HEAD
Verdict: **PUSHED WITH MINOR FINDINGS**

### Results by Reviewer

#### 1. Safety & Security — PASS
Test-only diff; no secret exposure, no unsafe operations, no security concerns.

#### 2. Correctness — PASS
All three new tests arithmetically correct; harness click sequences produce expected offset transitions; no Strict Mode hazard in the useRef pattern under Vitest/RTL default (non-Strict-Mode) environment.

#### 3. Simplicity & Conciseness — PASS
Two minor observations, both flagged "no change needed" by the reviewer: (a) the slide-in-left Harness is structurally similar to the slide-in-right Harness but differs enough (reset button + three clicks) that extraction would add indirection without meaningful benefit; (b) the three OverdueBadge tests are candidates for `it.each` consolidation but the one-per-case style keeps each boundary's intent explicit. Both align with the project's "three similar lines is better than a premature abstraction" guideline.

#### 4. Test Coverage — PASS
All three tests close their target gaps with accurate assertions. Two minor observations: (a) the slide-in-left harness uses an external reset button rather than the real `ReturnToTodayButton` component — this is acceptable because `ReturnToTodayButton` is a separate component (not rendered inside `DateNavigationBanner`) and its click wiring is already covered by `ReturnToTodayButton.test.tsx`. (b) The exact-due-date OverdueBadge test does not assert `barWidth = 0` at the component level — however the math-level test at `ChoreTimerBar.barMath.test.ts:48-53` already covers `barWidth = 0` for `computeBar(10, 10)`, so the visual boundary is covered at that layer.

#### 5. Completeness & Cleanup — PASS
No debug code, no `.only`/`.skip`/`.todo` markers, no commented-out blocks, no new TODOs, no stubs.

#### 6. Consistency & Style — PASS
All three new tests match surrounding patterns exactly: Harness shape, `makeChore` usage, `queryBy*`/`getBy*` usage, 4-space indentation, test-name format.

#### 7. Integration Risk — PASS
Test-only diff touching three test files; no production code, config, or shared infrastructure changed.

### To-Do: Required Changes

_None — reviewer observations are either "no change needed" confirmations (Simplicity reviewer's explicit notes) or already covered by existing tests at adjacent layers (Test Coverage reviewer's `ReturnToTodayButton.test.tsx` and `ChoreTimerBar.barMath.test.ts:48` already cover the concerns raised). Pushing with no actionable follow-ups._
