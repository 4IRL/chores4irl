# Review: Lock-time view reset (F19)

## Review — 2026-09-23

### Summary
The core design is correct. It was verified in-repo under Vitest 4.1.4:
- The Red test fails on a reset assertion (not on setup).
- The planned effect turns every planned test green.
- Every mutation probe turns its target test red.
- All 96 existing App tests stay green.
- eslint and tsc are clean.

The majors were all about process and executor cadence, not app code: the red commit under `/run-plan`, `tsc -b` leaving a committable artifact, sibling-unsafe orchestrator Playwright runs, and the ambiguous `README.md`. All are resolved below.

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | FAIL | 0 critical, 1 major, 4 minor |
| 2 | Full-Stack Trace | PASS | 0 critical, 0 major, 4 minor |
| 3 | Ordering & Cleanup | FAIL | 0 critical, 4 major, 4 minor |
| 4 | Integration & Conventions | FAIL | 0 critical, 3 major, 2 minor |
| 5 | Verification & Coverage | FAIL | 0 critical, 2 major, 3 minor |
| 6 | Completeness & Risk | FAIL | 0 critical, 2 major, 7 minor |

Deduplicated: 0 critical, 6 major, 14 minor.

### Findings

#### Major (should fix)
- **[Step 5] `tsc -b --noEmit` writes an un-ignored root `tsconfig.tsbuildinfo` that `git add .` commits; the `vite build` fallback doesn't type-check** _(#1, #3, #4, #5, #6)_
- **[Step 1] The deliberately red commit doesn't survive `/run-plan`'s 'tests green' auto-continue gate** _(#3)_. Precedent: form-polish-date-fix DD-3.
- **[Orchestrator] `/run-plan`'s own `$UI_RUNNER_CMD` (bare `npx playwright test`) can adopt the sibling worktree's dev servers** _(#3, #4, #5, #6)_
- **[Step 3] The mutation-revert gate "`git diff` shows only Step 2's effect" is unsatisfiable after Step 2's per-step commit** _(#3, #5, #6)_
- **[Summary/Research/Step 4] Bare `README.md` is ambiguous: three README.md files exist** _(#4)_
- **[Step 3] No test pins "a lock engaging under a blank still resets"** _(#6)_

#### Minor (nice to fix)
- Research line anchors were off: the re-sort effect is L167–171, and the force-close effect is L152–158 _(#1, #2, #3, #6)_.
- The Step 2 rule "runs only when isLocked changes" left out the mount run _(#1, #2)_.
- The Case A flakiness contingency was a self-correcting note, and Case A is deterministic _(#1)_.
- The beforeEach order was contradictory and implicit; copying `App.touchLock`'s `mockReturnValue` line would disable the real hook _(#1, #6)_.
- The F20 hand-off comment left out the "close Add modal first" obligation _(#2)_.
- The unlock test used a mocked flip, not the spec's double-tap _(#2, #5, #6)_.
- The "deps exactly [isLocked]" fact had no runnable check _(#5, #6)_.
- The README step had no gate _(#5)_.
- The README prose "screen locks behind a padlock" overstated the steady state _(#4)_.
- The mutation probes didn't cover the no-deps and unconditional-sort cases _(#5)_.
- There was no clean-tree pre-flight before the first `git add .` _(#3)_.
- The manual checks had no carrier past the orchestrator _(#3)_.
- The Step 1 test file wasn't linted before commit _(#3)_.
- Open risks (c)/(d) weren't acknowledged _(#6)_.
- The e2e gate ran smoke only, not scroll-to-top.spec.ts _(#4)_. **Resolved:** smoke only is kept. scroll-to-top.spec.ts can't reach the 5-minute lock, and the orchestrator note keeps the full `e2e/` dir out of scope.

### To-Do: Mechanical Fixes (auto-applied)
All of these were applied inline by the orchestrator in one rewrite. Parallel fixers would have raced on the same short file.
- [x] Type-check → `npx tsc --noEmit -p frontend/tsconfig.json` from the repo root, plus a no-tsbuildinfo check. Dry-run by #1/#3/#4: exit 0, no artifact.
- [x] Root-qualified `README.md` everywhere. Research now says `lock` matches only `fake-hwclock`.
- [x] README prose → "the app locks — the top-left padlock closes and taps are ignored until a double-tap unlocks it". Added the gate `grep -c 'Locking also returns the view' README.md` → 1 (0 today).
- [x] Mutation gate → `git diff --quiet -- frontend/src/App.tsx`, exit 0 before and after, with a `git checkout --` restore on resume. Added the no-deps and unconditional-sort probes.
- [x] Explicit 8-point beforeEach order, with a warning against the `mockReturnValue` line.
- [x] Grep gates: `}, \[isLocked\]);` → 2 (1 today) and `isBlanked, isLocked\]` → 1 (1 today). Dry-run confirmed.
- [x] Corrected line anchors. The mount-run rule wording was fixed and the Case A contingency removed.
- [x] Expanded the F20 comment. Added an Open risks (c)/(d) Research bullet.
- [x] Pre-flight clean-tree box, using the canonical stop protocol.
- [x] Manual-checks carrier instruction for the orchestrator's Completion summary.
- [x] eslint on the new test file in both test-writing steps.

### Design Decisions (awaiting user input)

#### DD-1: [Step 1] Intentional red state vs the /run-plan cadence
| # | Option | Trade-off |
|---|---|---|
| 1 | Merge Red+Green into one step | No red commit; precedent from form-polish-date-fix DD-3 |
| 2 | Keep the split plus an executor note | Red commit in history; relies on the orchestrator honoring the note |

**Chosen:** 1. Merged: Step 1 is now Red → Green with an expected-red internal checkpoint, and Steps 3–5 were renumbered to 2–4.

#### DD-2: [Orchestrator] Sibling-safe /run-plan Playwright runs
| # | Option | Trade-off |
|---|---|---|
| 1 | Orchestrator note in the plan | Local to the plan; the session orchestrator honors it |
| 2 | Note plus a skill-config edit | Also changes this worktree's defaults for later features |

**Chosen:** 1. Added an **Orchestrator note** above `## Steps`.

#### DD-3: [Step 3] Test for a lock engaging under a blank
| # | Option | Trade-off |
|---|---|---|
| 1 | Add the test plus a `(!isLocked \|\| isBlanked)` mutation probe | Pins the 06:00-wake guarantee |
| 2 | Rule text only | No regression guard |

**Chosen:** 1. Added it to Step 2.

#### DD-4: [Step 3] Unlock guard via the real double-tap
| # | Option | Trade-off |
|---|---|---|
| 1 | Real double-tap (real hook, fake timers) | Matches the spec; verified viable in-repo |
| 2 | Keep the hand-driven flip | Isolates the edge; deviates from the spec's wording |
| 3 | Both | One extra test |

**Chosen:** 1. The unlock test now locks after 5 minutes idle, drifts, double-taps, and advances `CLOSING_SETTLE_MS`.

---

### Verdict
[ ] Ready to proceed as-is
[x] Proceed after minor fixes
[ ] Requires changes before proceeding

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | #3 checked eslint.config.js `no-unused-vars` (`varsIgnorePattern '^[A-Z_]'`); step-scoped imports specified |
| Type annotations | [x] | #1/#5 ran tsc on the scratch App plus the effect; clean |
| Error handling | [x] | #2: no endpoint; SSE gate and force-close ordering traced |
| Test coverage | [x] | #5: every META-PLAN Expected-end-state test mapped; mutation probes run |
| Breaking changes | [x] | #2/#3: all App suites mock useTouchLock; 96 tests stay green |
| Config consistency | [x] | #4/#5: skill-config runner, playwright.config reuseExistingServer, tsconfig outDir |
| Naming conventions | [x] | #4: `App.<feature>.test.tsx`, hoisted-mock idiom, F-prefixed comments |

## Review — 2026-09-23 (Pass 2)

### Summary
The rewritten plan is sound. Subagent #1 built all six planned tests and the Step 1 effect on scratch copies in-repo. Results:
- The test is red on the unmodified App (`expected 200 to be +0`).
- 6/6 pass with the effect, including under `--sequence.shuffle` with seeds 1–4.
- Each of the 5 mutation probes turns exactly its named test red.
- eslint and `tsc --noEmit -p` are clean.
- The grep gates return 1/1/1/1 before the edit and 1/1/2/1 after.

One major remains: a cross-fix interaction with the Pass 1 mutation-gate fix. It was fixed mechanically.

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | PASS | 0 critical, 0 major, 0 minor |
| 2 | Full-Stack Trace | PASS | 0 critical, 0 major, 0 minor |
| 3 | Ordering & Cleanup | FAIL | 0 critical, 1 major, 3 minor |
| 4 | Integration & Conventions | PASS | 0 critical, 0 major, 2 minor |
| 5 | Verification & Coverage | PASS | 0 critical, 0 major, 1 minor |
| 6 | Completeness & Risk | PASS | 0 critical, 0 major, 2 minor |

### Findings

#### Major (should fix)
- **[Step 2] The mutation-probe pre-check `git checkout --` would wipe an uncommitted Step 1 effect** _(#3)_. This reopens the Pass 1 mutation-gate fix, which assumed Step 1 is always committed; a `/run-plan` 2b stop can leave it uncommitted. The pre-check now first requires `git grep -c 'F19: the lock engaging' HEAD -- frontend/src/App.tsx` → `HEAD:frontend/src/App.tsx:1`, and uses the canonical stop protocol otherwise. Dry-run: today's HEAD gives exit 1 with nothing printed. A committed control string gives `HEAD:frontend/src/App.tsx:1`, exit 0.

#### Minor
- Pre-flight false-stops on a partial Step 1 re-run _(#3, DD)_. **Resolved:** Step 1's own two output paths are allowed on a re-run.
- Intermediate commits weren't type-checked _(#3)_. Added `npx tsc --noEmit -p frontend/tsconfig.json` to Steps 1 and 2.
- Steps 2 and 3 had no stray-file check before their `git add .` _(#3)_. Added `git status --porcelain` boxes.
- The Orchestrator note didn't reach step executors _(#4)_. It is now an "Orchestrator + executor note".
- The Summary said "a line" where Step 3 adds a paragraph _(#4)_. Fixed.
- The double-tap test's `CLOSING_SETTLE_MS` advance wasn't load-bearing _(#5, DD)_. **Resolved:** added an assertion that `touch-lock-overlay` is gone, verified passing in-repo.
- The className gate broke under F22's additive `scrollbar-none` _(#6)_. The gate now has no closing quote and returns 1 on both shapes. Research now records the F22/F19 thumb-flash decision: adopt F22's "accept, no flag".
- The room-tab strip's `scrollLeft` isn't reset _(#6, DD)_. **Resolved:** out of scope, because the META-PLAN rules out component changes. Added a Research note and a Manual-checks bullet.

### Verdict
[ ] Ready to proceed as-is
[x] Proceed after minor fixes
[ ] Requires changes before proceeding

### Missed-Finding Root Causes
| Finding | Root cause | Skill gap? |
|---|---|---|
| Mutation pre-check `git checkout` wipes an uncommitted Step 1 | Fix verification stopped at the happy cadence: Pass 1's fix simulated only the "Step 1 committed" path, not a 2b stop before the commit | Instructions already cover this: Verification locus rule (2) requires walking every halt point, and rule (4) covers executor cadence. It was an execution miss |
| className gate breaks on F22 rebase | Scoped too narrowly: sibling in-flight plans weren't read in Pass 1 | Instructions already cover this (enumerate-all-instances / couplings) |

## Review — 2026-09-23 (Pass 3)

### Summary
Clean pass: 0 critical and 0 major across all six subagents, so the plan is ready for implementation. The final plan text was rebuilt in-repo under Vitest 4.1.4:
- Pre-effect: the 3 reset tests plus the re-sort Case B fail on the expected assertions (4 failed / 2 passed).
- Post-effect: 6/6 pass, including under shuffle seeds 1, 2, 3 and 7.
- All 5 mutation probes bite.
- The Pass 2 overlay-gone assertion fails if the settle advance is removed.

Every Pass 1 and Pass 2 resolution still holds, with no cross-fix regressions.

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | PASS | 0 critical, 0 major, 2 minor |
| 2 | Full-Stack Trace | PASS | 0 critical, 0 major, 0 minor |
| 3 | Ordering & Cleanup | PASS | 0 critical, 0 major, 5 minor |
| 4 | Integration & Conventions | PASS | 0 critical, 0 major, 3 minor |
| 5 | Verification & Coverage | PASS | 0 critical, 0 major, 0 minor |
| 6 | Completeness & Risk | PASS | 0 critical, 0 major, 2 minor |

### Minor fixes applied
- Moved Step 2's "Step 1 committed" HEAD guard into Step 2's **first** box, the fail-early position _(#3)_.
- Gave the red checkpoint a tick-as-N/A form for re-runs where the effect is already present _(#3)_.
- Added the canonical stop protocol to the Step 2/3 stray-file boxes, and added a matching Step 1 closing box _(#1, #3)_.
- Added an orchestrator commit-on-resume bullet _(#3, DD; chose option A)_.
- Added an F20-not-landed precondition to Step 1's pre-flight _(#6, DD; chose to add it)_. The check is `grep -c 'return { isLocked, arm };' frontend/src/hooks/useTouchLock.ts` → 1 today.
- Added a note on the README anchor collision with F22 _(#6)_. A `git merge-file` simulation gives a trivial keep-both conflict.
- Fixed the className-gate wording overclaim _(#1)_.
- Dropped the PR-body carrier claim that has no SKILL.md line _(#4)_.
- Added a manual check for the F22 thumb flash _(#4)_.
- Made the F22 plan path resolvable _(#4)_.

### Verdict
[x] Ready to proceed as-is
[ ] Proceed after minor fixes
[ ] Requires changes before proceeding
