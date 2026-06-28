# Review: F5 — Swipe behaviors (left = delete, right = edit)

## Review — 2026-06-26

### Summary
The plan is well-grounded: all 6 review subagents independently verified its claims against the
real codebase and the react-swipeable@7.0.2 source, and all returned **PASS**. One **major** finding
(trailing-click suppression mechanism) and several minor findings were applied to the plan. The plan
is **ready to proceed** after these fixes.

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | PASS | 0 critical, 0 major, 1 minor |
| 2 | Full-Stack Trace | PASS | 0 critical, 1 major, 4 minor |
| 3 | Ordering & Cleanup | PASS | 0 critical, 0 major, 2 minor |
| 4 | Integration & Conventions | PASS | 0 critical, 0 major, 0 (all info/alignment) |
| 5 | Verification & Coverage | PASS | 0 critical, 0 major, 1 minor |
| 6 | Completeness & Risk | PASS | 0 critical, 0 major, 5 minor |

### Findings

#### Major (fixed)
- **[Step 3] Trailing-click suppression should not key off `onSwiping`** _(Subagent #2)_: The plan set `swipingRef` in `onSwiping`. Subagent #2 worried that fires on every move and would swallow sub-threshold taps; Subagent #1 read react-swipeable@7.0.2 source (`index.ts:157`, `if (absX < delta && absY < delta && !state.swiping) return state`) and showed `onSwiping` is in fact delta-gated, so the plan likely worked as written. **Resolution (applied):** moved the flag-set into the directional `onSwipedLeft`/`onSwipedRight` callbacks (which fire only past `delta`), and dropped `onSwiping`. This makes a sub-threshold/jittery drag provably never set the flag, removing all ambiguity. Verified the event order (`mouseup`→`onSwiped*`→`click`) sets the flag before `resetTask` reads it.

#### Minor (fixed)
- **[Step 3] Inaccurate description of react-swipeable's returned handler keys** _(Subagent #1)_: v7 returns only `{ ref, onMouseDown }` (touch/move/up listeners attach imperatively via the `ref`), not the full prop list the plan enumerated. The load-bearing conclusion (no `onClick`/`className`/`data-testid` key → spread-first is safe) was already correct. Reworded the parenthetical.
- **[Step 3] Simulation-guard asymmetry undocumented** _(Subagent #2)_: swipe is `isSimulating`-guarded but the interim buttons are not (they fire during simulation via `pointer-events-auto`, as F4/F2 shipped). Added an explicit note that this is intentional/transient and self-resolves in F6; do not guard the buttons (would break an existing test).
- **[Step 4] Edit-modal name assertion value** _(Subagent #2)_: clarified the App-level swipe-right test asserts `input[name="name"]` equals the seeded fixture name (`makeChore().name === 'Sweep'`), not a hardcoded string.
- **[Step 1] Stage the root lockfile** _(Subagent #3)_: npm-workspaces repo has a single root `package-lock.json` (no `frontend/` lockfile); added a note to stage both `frontend/package.json` and the root lockfile on commit.
- **[Step 2] Cheap `touch-pan-y` regression lock** _(Subagent #6)_: added a component-test assertion that the bar carries the `touch-pan-y` class (vertical-scroll affordance is otherwise untestable in jsdom).
- **[Step 2] jsdom swipe-helper robustness** _(Subagent #5)_: added a note on the known levers (target the exact `chore-bar` div, add a 3rd `mouseMove`, confirm `trackMouse`) if `onSwiped*` doesn't fire during implementation.
- **[Step 6] F6 forward obligations** _(Subagent #6)_: recorded that F6 must (i) preserve `touch-pan-y` + the spread order when reflowing the bar, and (ii) add a keyboard/a11y fallback when it removes the buttons (swipe alone is not keyboard-accessible).

#### Considered, intentionally not changed
- **Reveal/animation polish omitted** _(Subagent #6, minor)_: META-PLAN lists it as a cost driver but the F5 "Expected end state" does **not** require any visual reveal; the `✕`/pencil buttons remain as the primary affordance through F5. Omitting it is contract-legal. Subagent #6 recommends a visual cue belongs in F6 (when buttons are removed) — captured via the Step 6 forward note.

### Verification Gaps
None blocking. Vertical-scroll-not-hijacked is not testable in jsdom/headless (acceptable); mitigated by the new `touch-pan-y` class assertion.

### Verdict
[x] Ready to proceed (after the above fixes, all applied)

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | #3: `useRef`/`useSwipeable`/`swipingRef`/`swipeHandlers` all used; `Pencil` stays used (buttons retained); no dead imports. |
| Type annotations | [x] | #1: props/signatures unchanged; swipe reuses `onDelete(id)`/`onEdit?(id)`. |
| Error handling (status codes, exceptions, user feedback) | [x] | #2: swipe reuses existing confirm/edit flows; no new error surface. |
| Test coverage (happy/sad/edge) | [x] | #5/#6: swipe L/R, tap regression, post-swipe-click suppression, simulation-inert, sub-threshold, touch-pan-y class; App-level confirm/edit; e2e (with bounded fallback). |
| Breaking changes | [x] | #1/#6: no API/prop/schema change; ChoreList/App untouched. |
| Config consistency (deps, lint) | [x] | #4: `react-swipeable@^7.0.2` real latest, zero deps, React-19 peer, correct `dependencies` section, `^` matches repo convention; all test/lint/build commands resolve. |
| Naming conventions | [x] | #4: `swipingRef`/`swipeHandlers` descriptive; no single-letter names; relative + `@customTypes` imports per repo style. |
