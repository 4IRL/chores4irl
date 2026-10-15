# Push Review: chore/meta-plan-update-f22

## Review 1
Generated: 2026-09-23
Comparison: origin/main...HEAD
Verdict: **BLOCKED**, overridden by the user (2026-09-24): merge F22's fold-back first, then re-author #58 on top of it.

### Results by Reviewer

#### 1. Safety & Security — PASS
The change is docs-only, with no secrets and no destructive instructions. No findings.

#### 2. Correctness — PASS
The factual claims (class strings, constants, file paths, PR and SHA numbers, test counts, invariant text) match the code at `0277f79`. The ★FOCUS move and the ledger edits follow the META-PLAN's Ledger update protocol and History policy. No findings.

#### 3. Simplicity & Conciseness — PASS
No findings.

#### 4. Test Coverage — PASS
The test counts the doc cites match the suites. No findings.

#### 5. Completeness & Cleanup — PASS
Every Phase C edit is present:
- the F22 ledger row is deleted;
- the ID-map row is annotated;
- invariants 12, 14 and 16 are updated and 18 is added;
- the Baseline header is refreshed;
- ★FOCUS is advanced to F20;
- the F22 section is pruned.

No findings.

#### 6. Consistency & Style — PASS
Matches the F18 fold-back precedent (`da27ff9`). No findings.

#### 7. Integration Risk — FAIL
- (major) **Standing-invariant number collision with PR #58.** PR #58 is F19's fold-back, still open, cut before F22 merged. It adds its own "18. Lock-time view reset", while this PR adds "18. Fading overlay scrollbar + full-bleed scroll region". `git merge-tree fca7118 HEAD origin/chore/meta-plan-update-f19` reports `CONFLICT (content)` in `plans/META-PLAN.md`. A keep-both resolution would leave two different invariant 18s and break every "Standing invariant 18" cross-reference in both PRs.
- (minor) Beyond that line, the two fold-backs rewrite the same prose from the same base, and it conflicts across most of the doc's top half: the rollout narrative, the ★FOCUS text, the track diagram, "Shortest path", the Remaining table and effort tally, and the ID map. #58's "★FOCUS stays F22" becomes stale once F22's fold-back lands.

#### 8. Error Handling & Silent Failures — PASS
No findings.

### To-Do: Required Changes

- [ ] **Serialize the two META-PLAN fold-backs and renumber the invariant that lands second** — `plans/META-PLAN.md` on whichever of `chore/meta-plan-update-f22` (this PR) and `chore/meta-plan-update-f19` (#58) merges second. Rebase it onto the post-merge `main` and re-apply its Phase C edits to the current doc instead of resolving conflicts in place:
  - its new Standing invariant becomes 19, and every "Standing invariant 18" cross-reference in its diff that means it becomes 19;
  - F19's and F22's ledger rows are both deleted;
  - ★FOCUS = F20 (F22 shipped, and F19 shipped #56);
  - the Baseline header names the later merge.
  _(Decision 2026-09-24: this PR merges first and keeps invariant 18. #58 is the one to rebase and re-author, with F19's invariant renumbered to 19.)_
