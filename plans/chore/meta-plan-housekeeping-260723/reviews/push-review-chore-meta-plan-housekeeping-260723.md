# Push Review: chore/meta-plan-housekeeping-260723

## Review 1
Generated: 2026-07-24 03:48
Comparison: origin/main...HEAD
Verdict: **BLOCKED**

### Results by Reviewer

#### 1. Safety & Security — PASS
Docs-only diff; no secrets, dangerous commands, injected instructions, or sensitive exposure.

#### 2. Correctness — PASS
No dangling references to deleted sections/tables; F-ID scheme agrees across the Remaining table, Status ledger, Legacy→current map, track diagrams, and per-feature sections; spot-checked deleted contracts (F4-L/F5-L/F6-L/F10-L/F3-L/F9-L/SSE) — operative facts survive in the Baseline, Standing invariants, or Deferred follow-ups.

#### 3. Simplicity & Conciseness — PASS
Compaction substantial and clean. Two minor findings:
- The "git is authority / merged work isn't re-tabulated" policy is restated near-verbatim in three places (rollout intro, Backlog-summary blockquote, Completed-Feature Contracts intro).
- The row-deletion-on-merge rule is stated twice within the Status ledger section (authority note + protocol bullet).

#### 4. Test Coverage — PASS
Docs-only; Test-suite deltas for F14/F4/F5/F15 confirmed intact.

#### 5. Completeness & Cleanup — PASS
No stale phrasing, broken tables/headers, or committed scratch; repo-name propagation across live files thorough.

#### 6. Consistency & Style — PASS
House style matched. One minor finding: an over-length line (~102 chars) in kiosk-shell-extraction.md's opening blockquote from the inserted repo-name-correction clause.

#### 7. Integration Risk — FAIL
- **major** — `plans/COMPACT-PLANS-PROMPT.md` Step 4.1 instructs cross-checking `gh pr list --state merged` against META-PLAN Status-ledger rows "marked `merged` / `(prune)`" — a state the new history policy eliminated (merged rows are now deleted). A session literally following that prompt finds nothing to cross-check. Regression introduced by this diff, not pre-existing.
- minor — `plans/PUSH-REVIEW-FINDINGS.md` L108's "META-PLAN dual-table update" TODO is now moot (no Completed table exists to drift).
- minor — `plans/ledger/260708_feature_ledger.md` still says `rmilarachi/pi-kiosk` (intentionally frozen predecessor; carries a PREDECESSOR banner).

#### 8. Error Handling & Silent Failures — PASS
Verification guards preserved (verified-merge-before-row-deletion, no-resurrect branch notes, contracts/follow-ups carried forward). One minor finding: the History-policy summary sentence omits the "verified" qualifier that the operative Ledger update protocol includes.

### To-Do: Required Changes

- [ ] **Update branch-pruning cross-check to match the history policy** — `plans/COMPACT-PLANS-PROMPT.md` (Step 4.1 and 4.5) — Merged Status-ledger rows are deleted, not status-flagged: drive the merged-branch list from `gh pr list --state merged` + git branch state alone, and drop the "clear/annotate `(prune)` markers in the META-PLAN ledger" instruction (record pruned branches in the run summary instead).
- [ ] **Add the "verified" qualifier to the History-policy summary** — `plans/META-PLAN.md` ("Where the rollout stands" → History policy sentence) — Change "once a feature's PR merges" to "once a feature's PR is verified merged" so the summary matches the Ledger update protocol exactly.
- [ ] **Re-wrap the over-length blockquote line** — `plans/feature/kiosk-shell-extraction/kiosk-shell-extraction.md` (opening blockquote) — Break the repo-name-correction sentence so line width matches the surrounding ~74–90-char wrapping.
- [ ] **Annotate the moot dual-table TODO** — `plans/PUSH-REVIEW-FINDINGS.md` (L108) — Mark the "META-PLAN dual-table update" item superseded-by-policy (2026-07-24): merged features are no longer tabulated, so there is no second table to drift.
- [ ] *(deferred — deliberate)* **Policy-statement redundancy** — `plans/META-PLAN.md` — The three restatements of the history policy are section-local context for cold-start agents; consolidate only if they drift.
- [ ] *(won't-fix)* **`rmilarachi` in 260708 predecessor ledger** — frozen historical file with a PREDECESSOR banner; left untouched by design.

## Review 2
Generated: 2026-07-24 03:55
Comparison: origin/main...HEAD (after fix commits `750d092`, `e96d0b1`)
Verdict: **PUSHED WITH MINOR FINDINGS**

### Results by Reviewer

#### 7. Integration Risk — PASS (re-run; others unchanged from Review 1)
Prior major finding fixed: COMPACT-PLANS-PROMPT.md Steps 4.1/4.5 now operate against the
restructured META-PLAN (git/`gh` as sole merged-work authority; straggler merged rows
deleted). PUSH-REVIEW-FINDINGS dual-table item closed as superseded-by-policy. Its one
remaining minor (Output-checklist `(prune)` wording) was fixed in `e96d0b1` before push.

### To-Do: Required Changes

Review 1's four actionable items were all fixed on-branch (`750d092`, `e96d0b1`). Remaining
open items are the two deliberate deferrals recorded under Review 1 (policy-statement
redundancy; frozen 260708 ledger wording).
