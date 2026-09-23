# Push Review: chore/meta-plan-update-f17

## Review 1
Generated: 2026-09-23
Comparison: origin/main...HEAD
Verdict: **PUSHED WITH MINOR FINDINGS**

### Results by Reviewer

#### 1. Safety & Security — PASS
Docs-only (`plans/META-PLAN.md`); no code, secrets or destructive operations.

#### 2. Correctness — PASS
Every F17 claim in the fold-back checks out against `origin/main` (`9da2c64`): the `StatusCountStrip` and `countStatuses` behaviour, the `App.tsx` render order, the cited line numbers, and the test counts. No text still treats F17 as pending or as the current focus.

#### 3. Simplicity & Conciseness — PASS
The edits are mechanical (renumbering, status-flip prose, cross-references) and follow the History policy and the F16 fold-back precedent.

#### 4. Test Coverage — PASS
All stated test facts match a live run: backend 43 tests / 5 files, frontend 346 / 35, util 8, component 10, App 6.

#### 5. Completeness & Cleanup — PASS
All of `/run-feature` Phase C step 3's prescribed edits are present:
- F17's ledger row is deleted.
- The Legacy map row carries #52.
- The strip's facts are in the Baseline and Standing invariant 16.
- The Baseline header now reads PR #52 / `9da2c64`.
- ★FOCUS has moved to F18.
- F17's section is deleted, as F16's was.

#### 6. Consistency & Style — PASS
Matches the F16 fold-back (`1556638`) and the document's conventions (★/FOCUS markers, table formats, invariant numbering).

#### 7. Integration Risk — PASS
- *minor* — The sibling F18 worktree (`feature/scroll-to-top`) has an uncommitted `in-progress` edit to the same F18 ledger row that this PR re-bolds and marks ★FOCUS. Whichever merges second will hit a one-line conflict on that row. `.claude/skills/worktree/SKILL.md` already anticipates this and resolves it as keep both changes: F18's status plus the ★FOCUS/bold formatting.

#### 8. Error Handling & Silent Failures — PASS
Nothing applicable (docs only).

### To-Do: Required Changes

- [ ] **(Awareness) Resolve the F18 ledger-row conflict when F18 rebases** — `plans/META-PLAN.md` (Status ledger, F18 row) — After this PR merges, `feature/scroll-to-top` should rebase onto `main`. Keep this PR's `**F18 — scroll-to-top button** ★FOCUS` formatting and apply F18's own Status/PR columns (`in-progress` → `in-review` + PR link).
