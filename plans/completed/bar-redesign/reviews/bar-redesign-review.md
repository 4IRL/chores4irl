# Review: F6 — Reduce chore bar height / spread details across the bar

## Review — 2026-06-26

### Summary
The plan is accurate and well-grounded — all selector/import/type claims trace correctly to
source, the F5→F6 gesture invariants and accessibility obligation are honored, and the
verification is layer-appropriate. One **major** issue: the shortened single-row layout is
under-specified — `flex justify-between` with a `flex-1` name won't truly center the
frequency, and `CompletionInfo`'s 3 lines risk width-overflow on a narrow phone. Plus two
design choices (sr-only focus visibility, e2e redundant-delete-test) should be pinned down.
Proceed after the 3 design decisions are resolved.

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | PASS | 0 critical, 0 major, 2 minor |
| 2 | Full-Stack Trace | PASS | 0 critical, 0 major, 1 minor |
| 3 | Ordering & Cleanup | PASS | 0 critical, 0 major, 2 minor |
| 4 | Integration & Conventions | PASS | 0 critical, 0 major, 2 minor |
| 5 | Verification & Coverage | PASS | 0 critical, 0 major, 2 minor |
| 6 | Completeness & Risk | FAIL | 0 critical, 1 major, 5 minor |

### Findings

#### Major (should fix)
- **[Step 1/2/5] Single-row layout under-specified: frequency not truly centered + completion overflow risk** _(Subagent #6, also #1)_: `flex flex-row justify-between` with `flex-1` on the name pushes the `text-center shrink-0` frequency flush against the completion zone (not bar-centered, contradicting META-PLAN "frequency centered"); and `CompletionInfo`'s 3 stacked lines ("Last Completed:" / `toDateString()` / "N days ago") risk width-overflow at 375px on the shortened bar. → **DD-1.**

#### Minor (nice to fix)
- **[Step 4] sr-only buttons lack visible-on-focus styling** _(Subagent #6)_: pure `sr-only` buttons are keyboard-focusable but invisible when focused (WCAG 2.4.7 focus-visible gap). → **DD-2.**
- **[Step 6] "convert or remove" redundant delete test left as "reviewer's call"** _(Subagent #6)_: ambiguous for autonomous run-plan; the existing swipe-left test already covers swipe→confirm→removal. → **DD-3.**
- **[Step 3] App.test `/overdue/i` assertions also rely on the sr-only span** _(Subagent #2)_: ✅ applied — note added to Step 3 (no code change; the assertions still pass).
- **[Step 2/4] Vitest doesn't type-check** _(Subagent #3)_: ✅ applied — added `npm run build --workspace frontend` to Steps 2 & 4 verify gates.
- **[Step 1] Keep OverdueBadge block + ChoreInfo call intact during Step 1** _(Subagent #3)_: ✅ applied — clarifying sub-bullet added; confirms no mid-plan type-error window.
- **[Step 6] No per-step e2e verify** _(Subagent #5)_: ✅ applied — added `npm run test:e2e` to Step 6.
- **[Step 4] sr-only is built-in Tailwind 4 / button DOM order** _(Subagent #4, #6)_: ✅ applied — noted sr-only needs no config; Edit-before-Delete sibling placement documented.
- **[Step 6] Confirm whole-bar-click tests unaffected by cluster removal** _(Subagent #6)_: ✅ applied — note added.
- **[Step 2] FrequencyInfo component vs inline** _(Subagent #4)_: minor; folded into DD-1 (layout).

### Verification Gaps
None material. Per-step `npm run build` (type-check) added to Steps 2 & 4; per-step
`npm run test:e2e` added to Step 6. Final phase (Step 7) runs vitest + lint + build + e2e.

### To-Do: Mechanical Fixes (auto-applied)
- [x] Step 1: add sub-bullet to leave the `OverdueBadge` block + `ChoreInfo(name/room/frequency)` call unchanged during Step 1.
- [x] Step 2: add `npm run build --workspace frontend` to the verify gate (type-check the `ChoreInfoProps` change).
- [x] Step 3: add note that App.test.tsx `/overdue/i` assertions rely on the sr-only span (no change needed).
- [x] Step 4: note sr-only is a built-in Tailwind 4 utility; document Edit-before-Delete sibling placement; add `npm run build` + `npm run lint` to verify gate.
- [x] Step 6: add per-step `npm run test:e2e` verify; note whole-bar-click tests unaffected by cluster removal.

### Design Decisions (awaiting user input)

#### DD-1: [Step 1/2/5] Single-row layout — center the frequency and fit the completion zone
**Context:** META-PLAN F6 requires "name left, frequency centered, last-completed + 'N days ago' far right" on a bar shorter than `h-36 sm:h-24`. The plan's `flex justify-between` + `flex-1` name does **not** geometrically center the frequency, and `CompletionInfo`'s 3 lines risk overflow at 375px. Need a layout that centers the middle zone independent of side widths and a compaction strategy for the completion zone.

| # | Option | Trade-off |
|---|---|---|
| 1 | `grid grid-cols-3 items-center` (name `min-w-0 truncate` left, freq `text-center`, completion `text-right`) + compact CompletionInfo (sr-only the "Last Completed:" label, keep date + "N days ago") | True geometric centering; predictable thirds; minimal overflow. Slightly more markup change to CompletionInfo. **Recommended.** |
| 2 | Flex with **absolutely-centered** frequency (`absolute left-1/2 top-1/2 -translate-x/y`) + compact CompletionInfo | Center is exact and independent of side content; name/completion stay in flex flow. Absolute element can overlap long name/date on very narrow screens. |
| 3 | Keep `flex justify-between` (frequency floats, not strictly centered) + keep 3-line completion | Smallest change; but violates "centered" and keeps the overflow risk — would require softening the META-PLAN wording. |

**Chosen:** Option 1 — `grid grid-cols-3 items-center` (name `min-w-0 truncate` left, freq `text-center` center, completion `text-right` right) + compact CompletionInfo (`sr-only` the "Last Completed:" label, keep date + "N days ago"). Applied to Steps 1, 2, 5.

#### DD-2: [Step 4] Accessible fallback buttons — visible-on-focus or pure sr-only?
**Context:** The accessible fallback for delete/edit is `sr-only` buttons. They satisfy screen-reader + keyboard activation and keep all test selectors stable, but a sighted keyboard user who Tabs to a pure `sr-only` button sees no focus indicator (WCAG 2.4.7).

| # | Option | Trade-off |
|---|---|---|
| 1 | `sr-only focus:not-sr-only` (+ positioning) so each button appears + is outlined on keyboard focus | Best a11y; meets focus-visible. Adds a small focus-state style and a visible element on Tab. **Recommended.** |
| 2 | Pure `sr-only`, document the focus-visible trade-off as accepted | Simplest; screen-reader + click work. Keyboard focus is invisible (partial WCAG gap). |

**Chosen:** Option 1 — `sr-only focus:not-sr-only` (+ `focus:absolute` edge positioning) so each button is revealed + outlined on keyboard focus (WCAG 2.4.7). Applied to Step 4.

#### DD-3: [Step 6] Redundant button-based delete e2e test — convert or remove?
**Context:** The existing `swipe-left opens delete confirmation and removes the chore` test already asserts swipe→confirm→removal. The button-based `deletes a chore and it disappears from the list` test becomes redundant; the plan left "convert vs remove" as the reviewer's call.

| # | Option | Trade-off |
|---|---|---|
| 1 | Remove the button-based test as redundant | Less timing-sensitive swipe surface; removal already covered by the swipe-left test. **Recommended.** |
| 2 | Convert it to swipe-left | Keeps a second explicit named-chore removal assertion, at the cost of another flaky swipe path. |

**Chosen:** Option 2 — Convert the `deletes a chore` test to swipe-left (keep a second explicit named-chore removal assertion). Applied to Step 6.

---

### Verdict
[ ] Ready to proceed as-is
[x] Proceed after design decisions (DD-1..DD-3) are resolved — **DDs resolved & applied; see Pass 2 below**
[ ] Requires changes before proceeding

---

## Review — 2026-06-26 (Pass 2)

### Summary
Re-reviewed the plan after applying Pass-1 mechanical fixes + the three resolved design
decisions (DD-1 `grid grid-cols-3` + compact completion; DD-2 `sr-only focus:not-sr-only`;
DD-3 convert button-delete e2e test to swipe-left). **All 6 subagents PASS (0 critical, 0
major).** The Pass-1 major (layout overflow / off-center frequency) is confirmed genuinely
resolved. Two minor factual corrections surfaced (and were fixed): the per-step verify gates
wrongly claimed `npm run build`/lint catch type errors and dangling PascalCase imports.

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | PASS | 0 critical, 0 major, 1 minor |
| 2 | Full-Stack Trace | PASS | 0 critical, 0 major (info/nits only) |
| 3 | Ordering & Cleanup | PASS | 0 critical, 0 major, 0 minor |
| 4 | Integration & Conventions | PASS | 0 critical, 0 major, 1 minor |
| 5 | Verification & Coverage | PASS | 0 critical, 0 major, 2 minor |
| 6 | Completeness & Risk | PASS | 0 critical, 0 major (1 DD-note, 2 nits) |

### Findings & Resolutions (Pass 2)
- **[Steps 2/4/7] `npm run build` (= `vite build`, esbuild) does NOT type-check** _(Subagents #4, #5)_: ✅ fixed — verify gates now use `npx tsc --noEmit -p frontend/tsconfig.json` (verified: passes cleanly today); `vite build` retained in Step 7 only as the production bundle check.
- **[Steps 3/4/7] eslint `varsIgnorePattern: '^[A-Z_]'` exempts `OverdueBadge`/`Pencil`; tsconfig has no `noUnusedLocals`** _(Subagent #5)_: ✅ fixed — neither lint nor tsc flags a dangling PascalCase import, so the plan now relies on explicit hand-removal + the Step 7 grep as the safety net (wording corrected in Steps 3, 4, 7 + the test-commands list).
- **[Step 4] DD-2 tab-stop count** _(Subagent #6)_: ✅ added a note that tab-stop count per bar is unchanged from today's two visible buttons (only their visual presentation changes); also noted `focus:absolute` anchors to the `relative` root.
- **[Step 7] Two-line completion fit at 375px is a visual judgment** _(Subagent #6)_: ✅ added a manual 375px visual-check bullet to Step 7 (height remains tunable per DD-1).
- **[Step 1] grid-cols-3 geometric centering + `min-w-0` truncate prerequisite** _(Subagent #1)_: confirmed correct — no change needed.
- **Confirmed sound (no change):** all event paths (tap/swipe-left/swipe-right/sr-only buttons w/ stopPropagation), e2e swipe conversions preserve delete-removal + edit→Save→PUT round-trip, `OverdueBadge.tsx` deletion is safe (only own file + ChoreTimerBar + test text reference), sr-only buttons stay in the a11y tree for role/name queries.

### Verdict (Pass 2)
[x] **Ready to proceed** — 0 critical, 0 major across all 6 subagents; minor corrections applied. Plan is implementation-ready.

### Missed-Finding Root Causes
| Finding | Root cause | Skill gap? |
|---|---|---|
| `npm run build`/lint do not catch type errors / PascalCase unused imports | Fix verification stopped at plan text — Pass 1's mechanical fix added `npm run build` as a "type-check" without reading `frontend/package.json` (build = bare `vite build`) or `eslint.config.js` (`varsIgnorePattern`). The Pass-1 ordering subagent *had* noted "build script is plain vite build (no tsc &&)" but the fix-application step did not honor it. | Instructions already cover this ("verify before writing", "read lint/tsconfig when the fix changes a build/lint assumption"); this was an execution miss during mechanical-fix application, not a checklist gap. No skill change proposed. |

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | OverdueBadge + Pencil deletions traced dead; computeBar/isOverdue/useRef stay used |
| Type annotations | [x] | ChoreInfoProps {name}; CompletionInfoProps unchanged; build added to catch tsc errors |
| Error handling (status codes, exceptions, user feedback) | [x] | Frontend-only; ConfirmDialog + edit-modal flows traced intact; PUT round-trip preserved |
| Test coverage (happy path, sad path, edge cases) | [x] | All prescribed queries verified viable against planned markup |
| Breaking changes (API contracts, shared state, DB schema) | [x] | None — no backend/schema change; ChoreInfo prop change has one consumer (ChoreTimerBar) |
| Config consistency (env vars, requirements pins, lint rules) | [x] | sr-only is built-in Tailwind 4; eslint/tsconfig reviewed; no new deps |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | Default exports, type XProps, descriptive names; lucide-react use unchanged elsewhere |
