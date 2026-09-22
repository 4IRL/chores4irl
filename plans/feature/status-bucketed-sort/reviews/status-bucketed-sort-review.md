# Review: F16 — Status-bucketed midnight re-sort

## Review — 2026-09-22

### Summary
The algorithm, the `classifyStatus` refactor (behaviour-identical to `computeBar`, incl. NaN → orange and frequency 0 → green), path aliases, type imports (no constants ↔ choreBarMath cycle) and every worked example were verified correct. Needed changes: stale test-count baselines, ordering tests that could pass vacuously, underspecified escalation boards, and a per-step-commit gap where Step 2 changed behaviour without running App tests / tsc / lint. All resolved below.

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | FAIL | 0 critical, 1 major, 6 minor |
| 2 | Full-Stack Trace | PASS | 0 critical, 0 major, 2 minor |
| 3 | Ordering & Cleanup | FAIL | 0 critical, 2 major, 7 minor |
| 4 | Integration & Conventions | PASS | 0 critical, 0 major, 7 minor |
| 5 | Verification & Coverage | FAIL | 0 critical, 2 major, 9 minor |
| 6 | Completeness & Risk | FAIL | 0 critical, 1 major, 8 minor |

### Findings

#### Major (should fix)
- **[Step 5/3] Stale test-count baselines** _(#1, #3, #5)_: backend has 73 tests (not 43), frontend 296 (not 254); a never-ask executor would treat 73≠43 as a regression.
- **[Step 2] Order tests could pass vacuously** _(#5)_: stable sort + input already in expected order passes even if the rank key is ignored.
- **[Step 2] Test 11 (urgency → pressure) board unspecified** _(#6, #1, #5)_: the extra red is only observable with ≥5 reds, ≥2 oranges, ≥2 greens and all other reds below threshold.
- **[Step 2] Behaviour change committed before App tests / tsc / lint run** _(#3)_ → DD-1.

#### Minor (nice to fix)
- `due()` helper self-contradiction (localNoon vs subDays); incomplete test import list; alias vs relative imports; inline `type` import modifier vs repo's `import type` _(#1, #3, #4, #5, #6)_.
- Step 1 Red test missing `STATUS_BAR_COLOR` import _(#1, #3)_.
- constants.ts comments would still name `computeBar` as owning the red check / fallback _(#1)_.
- `tsc` hedge pointed at `vite build` (which doesn't typecheck); tsc absent from final phase _(#3, #4, #5)_.
- README line refs off by ~2; escalation wording off by one frequency _(#1, #3, #4, #6)_.
- Header comment credited first-load sorting to the `simulatedDate` effect (it's `reconcileChores`) _(#2, #6)_.
- Stale "real clock initial sort" comments in App.test.tsx; App.sync re-check unrecorded _(#2, #5, #6)_.
- Test 3 / 9b / 10 / 12 fixtures ambiguous _(#5, #6)_.
- "No copied literal" end state had no command; cwd-sensitive relative-path gates _(#3, #4, #5, #6)_.
- Playwright CI=1 port-conflict stop rule missing _(#5)_.
- Red-first rule vs tests already green on old code _(#6)_.
- Unused `StatusColor.color` → DD-2; `URGENCY_MULTIPLIER` naming → DD-3; extra escalation / all-one-bucket tests → DD-4; NaN / negative hardening → DD-4 (not chosen); README lag → DD-1; `.gitignore` riding in Step 1 commit — already decided by user (carry on branch, commit there); recorded in plan's Branch note.

### To-Do: Mechanical Fixes (auto-applied)
_Applied inline by the orchestrator in one pass (all fixes edit one file; parallel per-finding fixers would race on it)._
- [x] Baselines → frontend 296 / 32 files, backend 73 / 8 files; backend via `npm test --workspace backend` from root
- [x] Non-trivial input-order rule for every ordering test
- [x] Concrete boards for tests 3, 9b, 10, 14 (urgency→pressure), 15 (unset ≡ medium)
- [x] `due()` helper rewritten (`subDays(TODAY, daysSince)`); full import list with aliases + `import type`
- [x] Step 1 Red imports `STATUS_BAR_COLOR`; constants comments retargeted to `classifyStatus`
- [x] tsc hedge removed; tsc added to Step 2 gates and final phase
- [x] README line refs L11–27 / L29–31; escalation wording fixed; README grep anchored at repo root
- [x] Header comment attributes first load to `reconcileChores`, notes subset re-sorts
- [x] App.test stale real-clock comments; App.sync no-order note
- [x] No-copied-literal grep with `|| echo none`; all gates anchored at absolute repo path
- [x] Playwright CI=1 port-conflict stop-and-report rule
- [x] Already-green tests kept, not forced red

### Design Decisions

#### DD-1: [Step 2] Behaviour change vs per-step commit gates / README lag
| # | Option | Trade-off |
|---|---|---|
| 1 | Fold Steps 3+4 into Step 2 with full gates | Every commit green and docs consistent; bigger step |
| 2 | Add gates to Step 2 only | Green commits; docs lag two commits |
| 3 | Keep as-is | Step 2 commit may land red |

**Chosen:** 1 — Steps 3 (App-test comments) and 4 (README) folded into Step 2, which ends with full frontend vitest + tsc + lint. Plan is now 3 steps.

#### DD-2: [Step 1] Unused `StatusColor.color`
| # | Option | Trade-off |
|---|---|---|
| 1 | Drop `color` | One colour source; slightly larger diff |
| 2 | Keep | Dead duplicate data |

**Chosen:** 1 — `StatusColor = { threshold, status }`.

#### DD-3: [Step 1] `URGENCY_MULTIPLIER` naming/type
| # | Option | Trade-off |
|---|---|---|
| 1 | `SORT_URGENCY_MULTIPLIER: Record<NonNullable<Chore['urgency']>, number>` | Consistent; signals sort-only |
| 2 | Keep | Shorter; may be misread as bar-affecting |

**Chosen:** 1.

#### DD-4: [Step 2] Extra edge-case tests
| # | Option | Trade-off |
|---|---|---|
| 1 | Escalation branches (pressure 3, inclusive threshold, clamp) | Pins untested formula branches |
| 2 | All-one-bucket board > FOLD | Pins full donation |
| 3 | NaN / negative hardening | Extra code for invalid data |

**Chosen:** 1 + 2 (tests 11 and 12); NaN hardening not adopted.

---

### Verdict
[ ] Ready to proceed as-is
[x] Proceed after minor fixes
[ ] Requires changes before proceeding

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | #3: constants/choreBarMath/choreSort, test imports |
| Type annotations | [x] | #1: tsc -p . clean at baseline; new types traced |
| Error handling (status codes, exceptions, user feedback) | [x] | #2: no endpoint change; wire shape of urgency/dates traced |
| Test coverage (happy path, sad path, edge cases) | [x] | #5: test files, fixtures, TZ-safety of subDays verified in 3 TZs |
| Breaking changes (API contracts, shared state, DB schema) | [x] | #6: orderChores signature kept; F17 classifier contract provided |
| Config consistency (env vars, requirements pins, lint rules) | [x] | #4: no new packages; eslint no-unused-vars noted |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | #4: SCREAMING_CASE tunables, 4-space, path aliases |

## Review — 2026-09-22 (Pass 2)

### Summary
Clean pass: 0 critical, 0 major. The correctness reviewer implemented Steps 1–2 verbatim in a scratch copy (repo tsconfig/eslint/vitest): tsc exit 0, eslint clean, full vitest green with App order tests unchanged, and every worked example reproduced. Pass 1 resolutions re-verified against source. Only minor wording/specificity fixes remained; applied below. Ready for implementation.

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | PASS | 0 critical, 0 major, 2 minor |
| 2 | Full-Stack Trace | PASS | 0 critical, 0 major, 2 minor |
| 3 | Ordering & Cleanup | PASS | 0 critical, 0 major, 5 minor |
| 4 | Integration & Conventions | PASS | 0 critical, 0 major, 4 minor |
| 5 | Verification & Coverage | PASS | 0 critical, 0 major, 4 minor |
| 6 | Completeness & Risk | PASS | 0 critical, 0 major, 7 minor |

### To-Do: Mechanical Fixes (auto-applied)
- [x] Unused-import rationale corrected (`varsIgnorePattern: '^[A-Z_]'` exempts SCREAMING_CASE)
- [x] Lint gate reads "prints no problems" (eslint exits 0 on warnings) — Steps 1, 2, 3
- [x] Fixture recipe for count-only boards (tests 8–12, 19); test 19 given concrete board → `[1, 2, 4, 3, 5, 6]`
- [x] Test 15 board now rejects unset→high as well as unset→low (6 reds, X/Y, fold 6r/0o/2g)
- [x] Test 11c relabelled (clamp is defensive/unobservable); test 16 uses non-monotonic ids
- [x] App-test comment sweep covers L455 "(most urgent)" and L473 "by urgency"; midnight test notes day2 is the discriminating assertion
- [x] README keeps "no separate tier for infrequent chores" sentence
- [x] urgency grep expects repo-relative `frontend/src/...` paths
- [x] Playwright port-conflict stop uses `UNRESOLVED — requires user decision/action:` + resume note; final box tickable as N/A
- [x] Phase 0 prerequisites line (cd builtin exempt)
- [x] Fold-back note: Phase C also rewrites Baseline **Sort** paragraph and Standing invariant 11's sort clause

### Design Decisions

#### DD-5: [Step 2] `SORT_BASE_QUOTA` sum invariant guarded only by a comment
| # | Option | Trade-off |
|---|---|---|
| 1 | Unit test asserting sum === SORT_FOLD | Bad re-tune fails CI; no runtime cost |
| 2 | Comment only | Relies on re-tuner reading the comment |

**Chosen:** 1 — added as test 20.

(Completeness's "test 15 can't detect unset→high" DD was resolved mechanically by Verification's board fix.)

### Verdict
[x] Ready to proceed as-is
[ ] Proceed after minor fixes
[ ] Requires changes before proceeding

### Missed-Finding Root Causes
| Finding | Root cause | Skill gap? |
|---|---|---|
| eslint `varsIgnorePattern` exempts SCREAMING_CASE | Trusted plan assertion (Pass 1 fix text asserted lint behaviour without dry-running eslint) | Instructions already cover this (Verification locus rule 1) — execution miss |
| Test 15 couldn't detect unset→high | Fix verification stopped at plan text (Pass 1 board checked only against unset→low) | Instructions already cover this — execution miss |
| Invariant 11 stale clause at fold-back | Scoped too narrowly (Pass 1 checked Standing invariants only for numbering) | Instructions already cover this |
| Comments at L455/L473 | Incomplete enumerate-all sweep in Pass 1 | Instructions already cover this |
