# Review: F17 — Status-Count Strip Under the Room Tabs

## Review — 2026-09-23

### Summary
The plan is sound. It covers every META-PLAN F17 Design, Expected-end-state and open-risk (a)–(d) item, and it respects Standing invariants 14–15. Reviewers dry-ran the key test mechanics in the repo's frontend:
- `flexGrow` reads back as `'3'` and `flexBasis` as `'0px'`.
- `getByRole('img', { name })` and `title` match.
- The faked-timer click yields a same-day completion.
- `countStatuses` buckets chores as planned.

There were two majors. Both are resolved: a missing `Chore` type import that broke Step 1's tsc gate, and no App test pinning the strip to `simulatedDate`. **Proceed after fixes (applied).**

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | PASS | 0 critical, 0 major, 5 minor |
| 2 | Full-Stack Trace | FAIL | 0 critical, 1 major, 3 minor |
| 3 | Ordering & Cleanup | FAIL | 0 critical, 1 major, 1 minor |
| 4 | Integration & Conventions | PASS | 0 critical, 0 major, 1 minor |
| 5 | Verification & Coverage | PASS | 0 critical, 0 major, 4 minor |
| 6 | Completeness & Risk | FAIL | 0 critical, 1 major, 6 minor |

Deduplicated: **0 critical, 2 major, 12 minor.**

### Findings

#### Major (should fix)
- **[Step 1] Test import list omits `import type { Chore }`** _(#3; also #1, #4, #6 as minor)_: the `due()` helper uses `Partial<Chore>`, and `frontend/tsconfig.json` `include: ["src"]` type-checks tests. Step 1's `npx tsc --noEmit` gate therefore fails with TS2304 (dry-run confirmed exit 2), and eslint does not catch it.
- **[Step 3] No App test pins the strip to `simulatedDate`** _(#2, #6; #5 as minor)_: every App case runs at dayOffset 0. Wiring `realToday` or `new Date()` instead of `simulatedDate` would pass every planned test.

#### Minor (nice to fix)
- **[Step 3] "Label unchanged after resolve" assertion is vacuous** _(#1, #2, #5, #6)_: it runs before the reconcile microtask. The resolve needs to be flushed inside `act`.
- **[Step 5] Baseline count is 322 tests / 32 files, not ≈310** _(#1)_.
- **[Research/Step 3] Line citations are off by a few lines** _(#1)_: `reconcileChores` is at :80-90 (`setChoreData` :81), and the fake-timer block is at `App.test.tsx:220-226`.
- **[Research] "No positional selectors" contradicts the cited `.first()`** _(#1, #6)_.
- **[Step 1] "Later hour" wording is wrong** _(#2, #5)_: 08:00 is earlier than noon. There is also no case for a negative `daysSince`.
- **[Step 5] The end-state grep can't show adjacency to `<NavBar`** _(#6)_.
- **[Steps 1/2] The literal grep gates match comments** _(#6)_: the plan's own comment wording could trip them.
- **[Steps 1/2] The expected-empty grep gates exit 1** _(#5)_: this needs saying explicitly.
- **[Step 3] The rollback path is not tested for the strip** _(#2)_: design decision DD-2.
- **[Step 3/Notes] A failed load shows a green `0`** _(#6)_: design decision DD-3.
- **[Steps 2/3/5] /run-plan's orchestrator Playwright runs lack the `CI=1` worktree guard** _(#3)_: design decision DD-4.

### Verification Gaps
- **Step 3**: the day-simulation case was added (DD-1). Run `cd frontend && npx vitest run src/__tests__/App.statusStrip.test.tsx`.

### To-Do: Mechanical Fixes (auto-applied)
Applied inline by the orchestrator, serially, not by parallel fixer subagents: the fixes overlap in the same plan passages.
- [x] Step 1: add `import type { Chore } from '@customTypes/SharedTypes'` (and `addDays`) to the test's import list.
- [x] Step 1: correct the wording to "earlier on the displayed day"; add a negative-`daysSince` (`addDays(TODAY, 1)`) → no-segment case.
- [x] Steps 1/2: add "don't name thresholds / `bg-*-500` in comments" clauses; add "no output, exit 1 = pass; run standalone" to both gates.
- [x] Step 3: wrap the post-resolve flush in `await act(async () => { resolve(...) })` and assert the label is still `'1 done today · …'`.
- [x] Step 3: correct the citation to `App.test.tsx:220-226`. Research: correct it to `reconcileChores` :80-90 / :81.
- [x] Research: make the `.first()` selector wording precise.
- [x] Step 5: set the baseline to 322 tests / 32 files; add a `grep -n -A1 "<NavBar"` adjacency check.
- [x] Whole-document re-run: a stale-reference sweep (`≈310`, `221-227`, `later hour`, `(:85)`, `**no** positional`) returns nothing, and the heading count is unchanged at 6 `###`.

### Design Decisions (awaiting user input)

#### DD-1: [Step 3] App-level day-simulation test
**Context:** No App test distinguishes `simulatedDate` from `realToday`.

| # | Option | Trade-off |
|---|---|---|
| 1 | Add a day-simulation case (Next day → done-today drops to 0) | Cheap; closes the wiring gap |
| 2 | Accept the gap | Lint guards the deps, but a wrong Date goes uncaught |

**Chosen:** Option 1. A "follows the displayed day" case was added to Step 3's Red list.

#### DD-2: [Step 3] Rollback test for the strip
| # | Option | Trade-off |
|---|---|---|
| 1 | Skip | Same derived path; rollback is covered in App.test.tsx |
| 2 | Add a case | One more App test |

**Chosen:** Option 1 (skip). The rationale is recorded in the plan's Notes.

#### DD-3: [Notes] Load failure shows a green `0`
| # | Option | Trade-off |
|---|---|---|
| 1 | Accept and note it | Follows the spec's empty-list rule; the toast explains the state |
| 2 | Hide the strip on load error | Needs a new flag; widens scope |

**Chosen:** Option 1. Recorded in Notes.

#### DD-4: [Notes] Orchestrator Playwright guard
| # | Option | Trade-off |
|---|---|---|
| 1 | Add a Notes bullet steering /run-plan to `env -u PLAYWRIGHT_BASE_URL CI=1 …` | A sibling worktree exists, so the risk is real |
| 2 | Leave as is | Step 5 stays authoritative |

**Chosen:** Option 1. Notes bullet added.

---

### Verdict
[ ] Ready to proceed as-is
[x] Proceed after minor fixes
[ ] Requires changes before proceeding

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | #3 ran tsc/eslint on a scratch copy; no cycles |
| Type annotations | [x] | #1 checked `StatusCounts`, `countStatuses`, and the props types |
| Error handling (status codes, exceptions, user feedback) | [x] | #2 traced rollback and the load failure (DD-2/DD-3) |
| Test coverage (happy path, sad path, edge cases) | [x] | #5 matched the spec test list 5/5, 6/6, 3/3 (+search, +day-sim) |
| Breaking changes (API contracts, shared state, DB schema) | [x] | #6: no backend, schema or sort change; selector traps avoided |
| Config consistency (env vars, requirements pins, lint rules) | [x] | #4: no new packages; Tailwind v4 `min-w-5`/`h-5` valid |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | #4: matches component, util and test conventions (no repo CLAUDE.md) |

## Review — 2026-09-23 (Pass 2)

### Summary
Every Pass-1 resolution was re-verified against source, and one was wrong (reopened below as Critical). The remaining findings are consequences of the Pass-1 edits plus `/run-plan`-cadence gaps. Reviewers simulated Steps 1–3 in the repo with scratch copies of the prescribed files and ran tsc, eslint and vitest: the plan's wiring and test mechanics hold, including the `act()` flush and the "Next day" day-simulation case. All findings are mechanical. **Proceed after fixes (applied).**

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | FAIL | 0 critical, 2 major, 0 minor |
| 2 | Full-Stack Trace | FAIL | 0 critical, 1 major, 1 minor |
| 3 | Ordering & Cleanup | FAIL | 0 critical, 2 major, 3 minor |
| 4 | Integration & Conventions | FAIL | 1 critical, 2 major, 2 minor |
| 5 | Verification & Coverage | FAIL | 1 critical, 0 major, 1 minor |
| 6 | Completeness & Risk | FAIL | 0 critical, 1 major, 4 minor |

Deduplicated: **1 critical, 5 major, 7 minor.**

### Findings

#### Critical (must fix before proceeding)
- **[Step 3] The Pass-1 citation "fix" was wrong** _(#4, #5)_: the fake-timer block is at `App.test.tsx:221-227` (220 is blank). The original citation was correct, and Pass 1 then treated `221-227` as a stale string to sweep away. Reverted. Verified with `sed -n 219,227p`.

#### Major (should fix)
- **[Step 2] The test import list omits `{ describe, it, expect } from 'vitest'`** _(#1, #4)_: `frontend/tsconfig.json` has no vitest-globals types, so tsc reports TS2582/TS2304 (dry-run exit 2). This is the same class of bug as the Pass-1 Step 1 major, which was never checked for in Step 2.
- **[Step 3] "narrows on search: same board" now points at the day-sim board** _(#1, #2, #6)_: this is a side effect of inserting the DD-1 case. Read literally, the test fails (reproduced in the repo).
- **[Notes] Occupied ports send /run-plan into its Test Fix Loop** _(#3)_: Playwright's own error text suggests editing `playwright.config.ts`. The orchestrator note must say this is not a test failure and must pass the rules word for word into the smoke prompt (reproduced by occupying port 5174).
- **[Header] No Phase 0 exemption for the `cd` builtin** _(#3)_: `cd --version` exits 2, which halts `/run-plan` before Step 1. The F16 precedent is `status-bucketed-sort.md:54-55`.
- **[Step 4] A bare `README.md` is ambiguous** _(#4)_: three copies exist (root, `deploy/pi/`, `.github/rulesets/`).

#### Minor (nice to fix)
- **[Step 3] `userEvent.setup()` per test is left unstated** _(#2, #6)_.
- **[Notes] The orchestrator note lists smoke runs "after Steps 2/3" only** _(#3, #4, #6)_: `/run-plan` §2c also smokes after Step 1.
- **[Step 5] The occupied-port stop path has no `UNRESOLVED —` token, no leave-unticked rule, and no resume instruction** _(#3)_.
- **[Step 5] The conditional "Investigate and fix" box has no tick-as-N/A form** _(#3)_.
- **[Steps 1–5] Mixed working directories** _(#4)_: `cd frontend && npx tsc` is followed by root-relative lint and grep. Standardize on `npx tsc --noEmit -p frontend/tsconfig.json` from the repo root.
- **[Steps 1/2] Grep gates don't distinguish exit 2 (file missing = fail)** _(#5)_.
- **[Step 1] Morning-board and room+search util cases are given only by example; there is no clean-tree precondition before Red** _(#6)_.

### To-Do: Mechanical Fixes (auto-applied)
Applied inline by the orchestrator (one scripted pass, with each target string asserted to occur exactly once before replacement).
- [x] Step 3: revert the citation to `App.test.tsx:221-227` (verified). The Pass-1 item that changed it is **wrong and superseded**.
- [x] Step 2: add `{ describe, it, expect } from 'vitest'` to the test import list.
- [x] Step 3: the search case now uses the room-tab board explicitly, with full labels (`'0 done today · 0 due soon · 2 overdue'` → `'… 1 overdue'`) and `await waitFor`. The per-test `const user = userEvent.setup();` is stated.
- [x] Notes: the orchestrator Playwright bullet now covers smoke runs after Steps 1–3 and carries the retry/stop rules word for word. It also says the occupied-port error is **not** a test failure (no 2e Test Fix Loop), that the `reuseExistingServer` hint must be ignored, and how to report with `UNRESOLVED — requires user decision/action:`.
- [x] Header: add `**Prerequisites (Phase 0):** npm/npx, git, grep, env, ss. cd is a shell builtin — skip it`.
- [x] Step 4: specify the repo-root `README.md` (excluding `deploy/pi/` and `.github/rulesets/`), with the grep run from the repo root.
- [x] Step 5: the Playwright box gets the `UNRESOLVED —` token, the leave-unticked rule and the re-run instruction. The final box gets `(tick as — N/A, all checks passed …)`.
- [x] Steps 1/2/3/5 and Research: every typecheck is now `npx tsc --noEmit -p frontend/tsconfig.json` from the repo root, and Step 1's reference names `frontend/tsconfig.json`.
- [x] Steps 1/2: grep gates now say `exit 2 = file missing = fail`.
- [x] Step 1: concrete morning-board and room+search fixtures with full `toEqual` objects, plus a `git status --short frontend/` clean precondition.
- [x] Whole-document re-run: stale strings (`220-226`, `same board`, `Steps 2/3`, `-p tsconfig.json`, `(in \`frontend/\`)`) return nothing. The heading count is still 6 `###`. Phase 0 inline tokens outside run-plan's candidate list come only from inline spans (no fenced blocks), and `cd`/`env`/`ss` are covered by the Prerequisites line.

### Missed-Finding Root Causes
| Finding | Root cause | Skill gap? |
|---|---|---|
| Wrong Pass-1 citation fix | **Fix verification stopped at a reviewer's claim.** The orchestrator applied #1's line numbers without re-reading the file. | Instructions already cover this: fixers must dry-run every observable, and the orchestrator skipped that by applying fixes inline. |
| Step 2 vitest import | **Scoped too narrowly.** The Pass-1 Step 1 import fix was not swept to the sibling Step 2 test. | Possible gap: a fixer that fixes a class-of-bug in one step should grep sibling steps for the same class. |
| "same board" back-reference | **Cross-fix interaction.** The DD-1 insertion changed an adjacent bullet's referent. | Covered by the 5f Post-Application Consistency Sweep (#3 claim propagation), which was not run because the DD was applied inline. |
| Playwright Test Fix Loop, `cd` Phase 0 | **Other.** Pass-1 #3 did not simulate run-plan's 2c/2e and Phase 0 on the DD-4 text, because DD-4 landed after Pass 1. | No: this is exactly what a subsequent pass is for. |

### Verdict
[ ] Ready to proceed as-is
[x] Proceed after minor fixes
[ ] Requires changes before proceeding

## Review — 2026-09-23 (Pass 3)

### Summary
**Clean pass: 0 critical, 0 major.** All six subagents returned PASS. Every Pass-1 and Pass-2 `[x]` resolution was re-verified against source, including the reverted `App.test.tsx:221-227` citation and the Step 2 vitest imports.

Reviewers replayed the prescribed Step 1–3 edits in order on scratch copies of `App.tsx`, the util, the component and the tests. tsc, eslint and vitest all came back green, and the util and App label expectations matched. The grep gates caught deliberately planted violations. The Step 1 clean-tree precondition holds on the real tree. Only minor edge cases remained, and they are applied below. **Plan is ready for implementation.**

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | PASS | 0 critical, 0 major, 1 minor |
| 2 | Full-Stack Trace | PASS | 0 critical, 0 major, 1 minor |
| 3 | Ordering & Cleanup | PASS | 0 critical, 0 major, 4 minor |
| 4 | Integration & Conventions | PASS | 0 critical, 0 major, 0 minor |
| 5 | Verification & Coverage | PASS | 0 critical, 0 major, 0 minor |
| 6 | Completeness & Risk | PASS | 0 critical, 0 major, 2 minor |

### To-Do: Mechanical Fixes (auto-applied)
- [x] Step 3 Green: note that `:338/:339` are pre-edit numbers (≈:342/:343 after the import and useMemo edits), so the insertion should match on text _(#1; verified by in-order simulation)_.
- [x] Step 3 Red: every case awaits the initial load (`waitFor(getByText('Sweep'))`) before its first label assertion, because the strip is absent while `loading` _(#2; verified: `queryByTestId` is null right after render)_.
- [x] Steps 1/2/5: grep gates now say "(repo root)". Run from `frontend/` they exit 2, which would be a false fail _(#3)_.
- [x] Step 5: the final box is ticked only once every other Step 5 box is ticked _(#3)_.
- [x] Step 5: record the new test total inline on the box _(#6)_.

### Design Decisions
#### DD-5: [Step 1] Clean-tree precondition failure and resume _(#3, #6)_
| # | Option | Trade-off |
|---|---|---|
| 1 | Resumable, with an `UNRESOLVED` stop | Run it from the repo root and allow this step's own two files; any other stray file stops with the token and leaves the box unticked. Matches Step 5's form |
| 2 | Drop the precondition | A stray file could be swept into the Step 1 commit |

**Chosen:** Option 1. Applied.

#### DD-6: [Notes] A per-step smoke hits occupied ports before the step is committed _(#3)_
| # | Option | Trade-off |
|---|---|---|
| 1 | Commit the step (2d), then stop | Keeps one commit per step; an occupied port is not a test failure |
| 2 | Let the step fold into the next commit, and document it | Loses commit granularity |

**Chosen:** Option 1. Applied.

### Missed-Finding Root Causes
| Finding | Root cause | Skill gap? |
|---|---|---|
| Step 3 line anchors drift after earlier edits in the same box | **Other:** the whole-sequence simulation (Verification locus rule 2) only ran in Pass 3 | Instructions already cover this (rule 2) |
| Step 3 cases don't await load | **Trusted plan assertion:** "after load" was written once, in the first case only | No gap |
| Grep-gate cwd, precondition resume path, 2c commit ordering | **Scoped too narrowly:** Pass-2 cwd and stop-token fixes were not swept across every gate | Recurs with Pass 2's "class-of-bug not swept to sibling steps" (see Step 7) |

### Verdict
[x] Ready to proceed as-is
[ ] Proceed after minor fixes
[ ] Requires changes before proceeding

### Skill Improvements Applied
| # | Finding | Subagent | Gap type | Change | Status |
|---|---|---|---|---|---|
| 1 | Class-of-bug fixes not swept to sibling steps (Pass 2: Step 2 vitest import; Pass 3: grep-gate cwd, stop tokens) | Fixing subagents (5b) | prompt_gap (recurring ×2) | Added a "Sibling-step sweep" clause to `~/.claude/skills/plan-reviewer/SKILL.md` 5b step 3 | Applied |
