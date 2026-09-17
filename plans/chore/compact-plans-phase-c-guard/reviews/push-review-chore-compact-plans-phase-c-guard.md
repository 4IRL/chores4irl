# Push Review: chore/compact-plans-phase-c-guard

## Review 1
Generated: 2026-09-16 21:59
Comparison: origin/main...HEAD (1 commit — `81a2281`, `.claude/skills/compact-plans/SKILL.md` + the 260910 push-review ledger)
Verdict: **BLOCKED**

### Results by Reviewer

#### 1. Safety & Security — PASS
Prose-only change that *removes* a destructive instruction (Status-ledger row deletion) and replaces it with leave-in-place + report. No secrets, injection surfaces, or new unsafeguarded destructive ops; the pre-existing `-D` / remote-delete flows are untouched.

#### 2. Correctness — FAIL
The guard logic itself (Step 5 rule, Step 7 grep re-check, Important Notes, the run-feature resume-table paraphrase, and the claim that `gh pr list --head` resolves after branch deletion) all verified accurate. One major:
- *(major)* `SKILL.md:121` — the new `git diff main -- plans/META-PLAN.md` self-check assumes the sweep's branch was cut from synced `main`, but the Branch Guard (line 12) allows running on a pre-existing feature branch that may carry legitimate committed META-PLAN.md edits (run-feature Phase A step 3 / step 10). There the diff misattributes those edits to the sweep.

#### 3. Simplicity & Conciseness — PASS
Coherent, minimal rule reversal; density matches the surrounding prose. One minor:
- *(minor)* `SKILL.md:129` — the new Important Notes bullet is a three-sentence restatement of Step 5 + Step 7; its three siblings are one-sentence pointers.

#### 4. Test Coverage — PASS
Step 7's checklist was updated in lockstep, so the change is verifiable. Two minors:
- *(minor)* `SKILL.md:121` — the diff check has no crisp command + expected-output form, unlike every sibling Step 7 check.
- *(minor)* `SKILL.md:121` — verification is scoped to branches pruned *this* run; once a branch is gone, a still-pending Phase C is never re-surfaced by later sweeps.

#### 5. Completeness & Cleanup — PASS
Every live reference (compact-plans Steps 5/7/Notes, run-feature Phase C, META-PLAN History policy + Branch/dir cleanup prose, PUSH-REVIEW-FINDINGS) agrees; only frozen `## Review N` sections keep the old wording, as expected. No TODOs or half-applied edits.

#### 6. Consistency & Style — PASS
Terminology matches sibling skills. Four minors:
- *(minor)* `SKILL.md:105` — `chore/meta-plan-update-<f-id>` vs run-feature's load-bearing `<f-id-lowercase>` placeholder.
- *(minor)* `SKILL.md:105` — **Legacy → current ID map**, **Baseline**, **★FOCUS** unbolded; run-feature bolds all three as defined terms.
- *(minor)* `SKILL.md:124` — **Phase C pending** bolded in the report-category list while its siblings are plain; elsewhere in the diff it is quoted.
- *(minor)* review ledger `:374` — resolution note uses a long trailing sentence where every sibling closed item uses a short `*(fixed …)*` tag after the bold title.

#### 7. Integration Risk — FAIL
No deadlock against plan-dir relocation (Phase C never touches `plans/feature/<slug>/`) or branch pruning. One major, one minor:
- *(major)* `~/.claude/skills/new-feature/SKILL.md:129` — the global `/new-feature` skill's Step 3 independently deletes merged Status-ledger rows (as part of its own inline fold-back: Baseline absorption, contract retention, ID-map annotation). This diff's wording ("that is `/run-feature` Phase C's job and its trigger") claims an exclusivity that isn't true and never mentions the second path. Verified by the orchestrator: the claim is accurate; note `/new-feature`'s fold-back does everything Phase C does *except* re-evaluate ★FOCUS and run on a dedicated reviewed branch.
- *(minor)* `SKILL.md:121` — same unscoped-`git diff main` issue as Correctness.

#### 8. Error Handling & Silent Failures — FAIL
Core fix well done: the destructive instruction is fully replaced; the superseded-group exception is preserved and distinguished; the Step 5 → Step 7 double-check is solid; every report path names the F-ID and the exact `/run-feature <F-ID>` command. One critical, two minors:
- *(critical)* `SKILL.md:121` — the same `git diff main` check, from the other direction: local `main` is not synced on the resume-on-feature-branch path (Step 5's own text at line 62 says so; its `git fetch` updates only `origin/main`). A stale `main` lacking the row makes a wrongful deletion invisible — the check passes vacuously on exactly the bug it exists to catch.
- *(minor)* `SKILL.md:121` — the mis-mapped / superseded-group carve-out ("leave it and say so") has no named bucket in Step 7's report line; "Phase C pending" is the wrong bucket, "left in place" is scoped to branch candidates.
- *(minor)* `SKILL.md:121` — a row absent because a *pre-fix* sweep deleted it (no fold-back ever ran) reads as "Phase C already ran". Reasonable forward-only scope, but undocumented.

### To-Do: Required Changes

- [x] **Replace the `git diff main` check with an uncommitted-diff check** — `.claude/skills/compact-plans/SKILL.md` Step 7 (line 121) — the sweep only ever *reads* `plans/META-PLAN.md` (Steps 2/5/7) and the Branch Guard requires a clean tree at start, so at Step 7 (before `/git-commit`) the file must have no uncommitted change at all. Replace "`git diff main -- plans/META-PLAN.md` must show no Status-ledger row removed by this sweep" with the crisp sibling form: `git diff HEAD --quiet -- plans/META-PLAN.md` should succeed (exit 0); any diff means the sweep edited a file it never should — stop, `git checkout -- plans/META-PLAN.md` is *not* automatic, report the diff. This is branch-independent (fixes Correctness major, Error Handling critical, Integration Risk minor, Test Coverage minor 1).
- [x] **Stop claiming the row is `/run-feature`'s exclusive trigger; name `/new-feature` Step 3 as the other fold-back path** — `.claude/skills/compact-plans/SKILL.md` Step 5 closing paragraph (line 105) + Important Notes (line 129) — reword to: the row is `/run-feature`'s Phase C *resume trigger*, and deleting it belongs only to a fold-back that also annotates the ID map and refreshes the Baseline — `/run-feature` Phase C, or `/new-feature` Step 3 which performs the same fold-back inline. The sweep does neither. (Follow-up outside this repo, for the user: `/new-feature` Step 3 does not re-evaluate ★FOCUS the way Phase C step 3 does — consider aligning it or having it defer to `/run-feature <F-ID>`.)
- [x] **Trim the Important Notes bullet to one cross-referencing sentence** — `.claude/skills/compact-plans/SKILL.md` line 129 — e.g. "Never deletes a `plans/META-PLAN.md` Status-ledger row (see Step 5 and Step 7's "Phase C pending" check) — that fold-back belongs to `/run-feature` Phase C or `/new-feature` Step 3, never to this sweep." Drop the cadence sentence (it lives in Step 5).
- [x] **Add a persistent whole-ledger Phase C scan to Step 7** — `.claude/skills/compact-plans/SKILL.md` Step 7 (line 121) — after the per-pruned-branch grep, also scan every remaining Status-ledger row whose PR column carries a `[#N](…)` link: `gh pr view <N> --json state,mergedAt` (exit code + JSON checked as in Step 5) reporting `MERGED` means that F-ID is Phase C pending too, regardless of whether its branch was touched this run — so a missed fold-back keeps surfacing on every sweep, not just the one that pruned its branch.
- [x] **Give the mis-mapped / superseded-group grep hit a named report bucket** — `.claude/skills/compact-plans/SKILL.md` Step 7 report line (line 124) — extend "left in place" to "(any Step 5 candidate not pruned …, plus any Step 7 grep hit that was a superseded-group row rather than a Phase C trigger, with the F-ID it was matched from)".
- [x] **Fix four style nits** — `.claude/skills/compact-plans/SKILL.md` lines 105, 124; review ledger `plans/chore/meta-plan-workflow-improvements-260910/reviews/push-review-…260910.md:374` — write `chore/meta-plan-update-<f-id-lowercase>`; bold **Legacy → current ID map**, **Baseline**, **★FOCUS**; un-bold and quote "Phase C pending" in the report list; shorten the ledger resolution to a `*(fixed 2026-09-16, option (a) — see `chore/compact-plans-phase-c-guard`)*` tag after the bold title.
- [x] **Document the forward-only scope** — `.claude/skills/compact-plans/SKILL.md` Step 7 (line 121) — one clause: a row already deleted by a pre-fix sweep without a fold-back is not detected by this check (the persistent scan above covers it only if the PR link survived somewhere); F14 was the only such case and its Phase C landed as PR #36, so no backfill audit is needed.

## Review 2
Generated: 2026-09-16 22:09
Comparison: origin/main...HEAD (2 commits — `81a2281` + Review 1 fixes `7eb874c`)
Verdict: **BLOCKED**

### Results by Reviewer

#### 1. Safety & Security — FAIL
Core change, `git diff HEAD --quiet` guard, and doc edits clean. One major, introduced by Review 1's whole-ledger scan:
- *(major)* `SKILL.md:121` — `<N>` for `gh pr view <N>` is scraped from a hand-editable `[#N](…)` link in META-PLAN.md with no validation, unlike the file's own `[[ '<branch>' =~ … ]]` hardening at line 82.

#### 2. Correctness — PASS
"Sweep only reads META-PLAN.md" verified across every step; `git diff HEAD --quiet` exit semantics verified empirically (0 clean, 1 staged or unstaged); ledger PR column confirmed to use the `[#N](…)` form; OPEN/MERGED/`—` handling sound. One minor:
- *(minor)* `SKILL.md:105,129` — "`/new-feature` Step 3 … performs the same fold-back inline" over-attributes: in `/new-feature` the fold-back spans Steps 3/7/8 and its ★FOCUS re-evaluation is a separate step with different scope.

#### 3. Simplicity & Conciseness — PASS → FAIL
Important Notes trim landed. One major:
- *(major)* `SKILL.md:121` — the Step 7 bullet now holds four checks and three commands in one ~8-sentence paragraph; every sibling bullet is one check. The whole-ledger scan — the most load-bearing addition — is buried mid-paragraph.

#### 4. Test Coverage — PASS
Both pass-1 asks applied. Two minors:
- *(minor)* `SKILL.md:121` — the scan has no crisp enumeration command for the row/PR pairs.
- *(minor)* `SKILL.md:121` — the superseded-group carve-out is worded only for the per-branch grep, not the scan.

#### 5. Completeness & Cleanup — PASS
All seven Review 1 To-Do items verified landed exactly as described; no stale live text. One minor: same `/new-feature` ★FOCUS over-attribution as Correctness.

#### 6. Consistency & Style — PASS
All four style nits verified; review-file shape matches 17 sibling files. One minor:
- *(minor)* `SKILL.md:124` — "Phase C pending" quoted while sibling bucket "left in place" is not.

#### 7. Integration Risk — PASS
`git diff HEAD --quiet` correct on every Branch-Guard-admitted branch; scan produces no false positive for in-review-with-merged-PR, resumed Phase C branch, or worktree teardown states (re-running `/run-feature` there is an idempotent resume). One minor: same `/new-feature` phrasing.

#### 8. Error Handling & Silent Failures — PASS
Pass-1 critical closed; `STOP:` usage consistent with Step 5. Four minors, all on the scan: no crisp extraction command; no PR-number ↔ F-ID/branch cross-check (a typo'd number silently misattributes); the `STOP:` template doesn't name the row/F-ID/PR; superseded-group carve-out not restated for the scan.

### To-Do: Required Changes

- [x] **Split the Step 7 Status-ledger bullet into a lead-in plus three sub-bullets** — `.claude/skills/compact-plans/SKILL.md` Step 7 — one sub-bullet each for the `git diff HEAD --quiet` check, the per-pruned-branch grep (both outcomes), and the whole-ledger scan (with the forward-only caveat attached), restoring one-check-per-bullet.
- [x] **Validate `N` before `gh pr view`** — `.claude/skills/compact-plans/SKILL.md` Step 7 scan sub-bullet — require `[[ "$N" =~ ^[0-9]+$ ]]`, mirroring Step 5's `<branch>` hardening, with a `STOP:` that names the F-ID and the offending value.
- [x] **Give the scan a crisp enumeration command and an F-ID ↔ PR cross-check** — same sub-bullet — `grep -nE '^\| \*{0,2}F[0-9]+ [^|·]*\|.*\[#[0-9]+\]\(' plans/META-PLAN.md` (the `[^|·]*` excludes the multi-ID superseded group by construction — verified against the live ledger and synthetic rows; the first draft without it matched `F3 · F7`); request `headRefName` from `gh pr view` and treat MERGED-with-different-branch as a mis-linked row reported under "left in place", not "Phase C pending"; `STOP:` messages name `<N>` and `<F-ID>`.
- [x] **Fix the `/new-feature` attribution** — `.claude/skills/compact-plans/SKILL.md` Step 5 (line 105) + Important Notes — "a full `/new-feature` run, whose Steps 3/7/8 perform the same fold-back inline (its ★FOCUS re-evaluation is scoped to the newly-added feature, not to what the just-shipped one unblocks)"; Important Notes says "a full `/new-feature` run".
- [x] **Quote "left in place" in the report line to match "Phase C pending"** — `.claude/skills/compact-plans/SKILL.md` Step 7 report line — and extend its parenthetical to name the mis-linked-row case.
