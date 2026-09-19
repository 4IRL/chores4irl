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

## Review 3
Generated: 2026-09-16 22:15
Comparison: origin/main...HEAD (3 commits — `81a2281` + Review 1 fixes `7eb874c` + Review 2 fixes `82ff830`)
Verdict: **BLOCKED**

### Results by Reviewer

#### 1. Safety & Security — PASS
`N` validation with a named `STOP:` verified; `headRefName` cross-check correctly routes a mis-linked row; only read-only ops added; no secrets.

#### 2. Correctness — PASS
Enumeration grep tested against the live ledger and synthetic rows (bold ★FOCUS, italic first cell, `—`, multi-ID group) — matches exactly the single-ID linked rows; `gh pr view` fields verified live against #34/#36; `/new-feature` Steps 3/7/8 attribution verified. Two minors:
- *(minor)* `SKILL.md:124` — `mergedAt` requested but never used.
- *(minor)* `SKILL.md:124` — no bucket for a `CLOSED` (unmerged) PR.

#### 3. Simplicity & Conciseness — PASS
Split landed; scan sub-bullet's length is justified by its content and in-family with Step 5's density. One minor: the "verified against the live ledger…" aside documents the author's testing rather than guiding the executor.

#### 4. Test Coverage — FAIL
Pass-2 minors genuinely fixed. One major:
- *(major)* `SKILL.md:124` — the mis-linked-row test compares bare `headRefName` to the raw Branch cell, which the live ledger writes as `` `feature/<slug>` `` (sometimes with a trailing `*(…)*` note); a literal comparison never matches, silently reclassifying every genuine Phase C pending row as "left in place".

#### 5. Completeness & Cleanup — PASS
All five Review 2 To-Do items verified landed exactly as described (including the accuracy of the `/new-feature` claim against that skill); no stale live text; Review 2 section internally consistent.

#### 6. Consistency & Style — PASS
Three minors: sub-bullets lack the bold `**Label** →` lead-in `worktree` uses for nested case-bullets; second `STOP:` drops the `#` and uses `:` instead of the em-dash shape used elsewhere; sub-bullet 3 states no crisp pass/fail line.

#### 7. Integration Risk — PASS
Traced Phase A step 10, `/worktree` provisioning, and the "PR closed, not merged" resume path — none can produce a `headRefName` ≠ Branch-cell row, so no spurious mis-linked report. Two minors: backticks must be stripped before comparing; the check's soundness rests on an unstated cross-skill invariant (step 10's `--head feature/<slug>` filter).

#### 8. Error Handling & Silent Failures — FAIL
Well-handled: branch-independent diff check, restated superseded carve-out, named `STOP:` for `N`, MERGED-wrong-branch distinguished, forward-only scope documented. One critical, one major, two minors:
- *(critical)* `SKILL.md:124` — same backtick issue as Test Coverage: read literally, every correctly-linked merged row is misclassified.
- *(major)* `SKILL.md:124` — `CLOSED` has no bucket and would fall through silently, hiding a dead PR link indefinitely.
- *(minor)* a `—` Branch cell would always compare "different".
- *(minor)* the JSON-parse-failure `STOP:` wording is delegated to Step 5 without a template.

### To-Do: Required Changes

- [x] **Normalize the Branch cell before comparing to `headRefName`** — `.claude/skills/compact-plans/SKILL.md` Step 7 scan sub-bullet — strip backticks and any trailing `*(…)*` annotation (`sed -E 's/`//g; s/ *\*\(.*\)\*//; s/^ *//; s/ *$//'`), state why (the live ledger writes `` `feature/<slug>` ``), and treat a `—` Branch cell as "nothing to cross-check" → Phase C pending on MERGED.
- [x] **Add a `CLOSED` outcome** — same sub-bullet — report under "left in place" as a stale PR link, pointing at `/run-feature`'s "PR closed, not merged" decision; extend the report line's "left in place" parenthetical to name it.
- [x] **Drop `mergedAt` from the scan's `--json`** — same sub-bullet — only `state` and `headRefName` are consulted.
- [x] **Match the file's `STOP:` shape and cover parse failure** — same sub-bullet — `STOP: gh pr view #<N> for <F-ID> failed — <raw output>`, covering call *or* parse failure.
- [x] **Add bold case labels and a pass line** — Step 7 sub-bullets — `**Uncommitted diff** →`, `**Pruned-branch rows** →`, `**Whole-ledger scan** →` (matching `worktree`'s nested-bullet form); the scan "passes when every hit below lands in a named report bucket".
- [x] **State the cross-skill invariant the branch check relies on** — same sub-bullet — one sentence: sound because `/run-feature` Phase A step 10 only records a PR found via `gh pr list --head feature/<slug>`; revisit if that changes.
- [x] **Trim the "verified against the live ledger…" aside** — same sub-bullet — keep only the mechanism ("excluded by construction").

## Review 4
Generated: 2026-09-16 22:22
Comparison: origin/main...HEAD (4 commits — `81a2281` + Review 1 fixes `7eb874c` + Review 2 fixes `82ff830` + Review 3 fixes `604f38f`)
Verdict: **BLOCKED**

### Results by Reviewer

#### 1. Safety & Security — PASS
Rewording introduced no new interpolation or destructive op; the `N` gate still precedes `gh pr view "$N"`.

#### 2. Correctness — PASS
The documented `sed` verified against the three real cell shapes; the four `state` outcomes confirmed exhaustive via GraphQL enum introspection; step-10 invariant verified. Two minors: OPEN's "no entry" not restated in the report line; `N` extraction described in prose rather than a command.

#### 3. Simplicity & Conciseness — PASS
Every addition maps 1:1 to a Review 3 item; nothing restated.

#### 4. Test Coverage — PASS
The pass-3 major re-verified fixed with the byte-exact `sed`. Two minors: no inline input→output example beside the `sed`; the scan currently matches zero live rows (all PR cells are `—`), so its first real hit should be watched end-to-end.

#### 5. Completeness & Cleanup — PASS
All seven Review 3 To-Do items verified landed exactly as described; no stale live text.

#### 6. Consistency & Style — PASS
All five pass-3 minors verified. One minor: `'<N>'` single-quoted in the hardening `STOP:` while Step 5's `<branch>` twin is unquoted.

#### 7. Integration Risk — PASS
CLOSED wording matches `run-feature`'s resume-table row; no skill leaves a CLOSED-PR row as a normal state. One minor: the `—` Branch-cell carve-out is unreachable under the current row-writing contract — say so.

#### 8. Error Handling & Silent Failures — FAIL
The `sed` normalization and CLOSED bucket verified. One critical, one minor:
- *(critical)* `SKILL.md:124` — `[^|·]*` in the enumeration grep excludes a row whose first cell contains `·` *anywhere*, not just the multi-ID join — a title like "F30 — feature with · in title" would be silently skipped by the scan.
- *(minor)* `SKILL.md:124` — the grep runs over the whole file; it is safe only because `[#N](` syntax is unique to the Status ledger's PR column today — document that.

### To-Do: Required Changes

- [x] **Anchor the multi-ID exclusion to the actual join shape** — `.claude/skills/compact-plans/SKILL.md` Step 7 scan sub-bullet — replace `[^|·]*` with a two-stage pipeline: `grep -nE '^\| \*{0,2}F[0-9]+ .*\[#[0-9]+\]\(' plans/META-PLAN.md | grep -vE '^[0-9]+:\| \*{0,2}F[0-9]+ · '` (verified against bold ★FOCUS, italic-first-cell, `·`-in-title, multi-ID group, and `—` rows).
- [x] **Document the whole-file scope assumption** — same sub-bullet — one sentence: safe only because `[#N](` link syntax appears solely in the Status ledger's PR column today.
- [x] **Give `N` extraction as a command and add inline `sed` examples** — same sub-bullet — `N=$(grep -oE '\[#[0-9]+\]\(' <<<"$row" | grep -oE '[0-9]+')`; three input→output pairs beside the `sed`.
- [x] **Unquote `<N>` in the hardening `STOP:`** — same sub-bullet — match Step 5's `<branch>` form.
- [x] **Mark the `—` carve-out as defensive and OPEN as deliberately omitted** — same sub-bullet — two short parentheticals.
- [x] **Watch the scan's first live hit** *(note, no edit)* — the ledger currently has no linked rows, so the full grep → extraction → `sed` → `gh pr view` → bucket pipeline has been verified only on synthetic rows; confirm it once on the first real sweep after a feature merges.

## Review 5
Generated: 2026-09-16 22:28
Comparison: origin/main...HEAD (5 commits — `81a2281` + Review 1 fixes `7eb874c` + Review 2 fixes `82ff830` + Review 3 fixes `604f38f` + Review 4 fixes `b6fde16`)
Verdict: **BLOCKED**

### Results by Reviewer

#### 1. Safety & Security — PASS
`N` gate still precedes `gh pr view`; the here-string extraction can't be abused by a typo'd row. One minor: a row with two `[#N](` links yields a two-line `$N` — the anchored regex rejects it, but the STOP wording says "not numeric".

#### 2. Correctness — PASS
Ran the two-stage pipeline against all five synthetic shapes (correct), the `N=` extraction (correct), the three `sed` examples (true). One minor: Branch-cell extraction still prose-only while `N` has a command.

#### 3. Simplicity & Conciseness — PASS
All five additions functional; in-family density.

#### 4. Test Coverage — PASS
Pipeline re-run against the five shapes; the `·`-in-title row now correctly retained. One minor (no fix needed): the exclusion anchors on the first join only — sufficient under the ledger's convention.

#### 5. Completeness & Cleanup — PASS
All six Review 4 items verified byte-exact. Two minors: OPEN's "deliberately no entry" not echoed in the report line; the OPEN note is an appositive rather than a parenthetical.

#### 6. Consistency & Style — FAIL
Arrow-example notation consistent with the file's idiom. One major, one minor:
- *(major)* `SKILL.md:124` — `N=$(… <<<"$row" …)` consumes `$row`, which nothing assigns; every other shown command in the file assigns its variables inline before use.
- *(minor)* review file — Review 4's `Comparison:` line collapsed the commit chain instead of the `+`-chained form Reviews 2–3 use.

#### 7. Integration Risk — PASS
The "`[#N](` appears solely in the Status ledger" claim verified across the current file and its git history (an older Completed table once used that shape — exactly why the caveat is worth keeping). No other contract affected.

#### 8. Error Handling & Silent Failures — PASS
Two-link and empty-`N` cases traced: both land in the STOP (empty is structurally unreachable). Three minors: STOP wording for the two-link case; note that empty `N` can't occur; state the one-link-per-row contract.

### To-Do: Required Changes

- [x] **Assign `row`, `fid`, and `branch` before use** — `.claude/skills/compact-plans/SKILL.md` Step 7 scan sub-bullet — `row=$(sed -n "${lineno}p" plans/META-PLAN.md)` from the grep's `-n` prefix, `fid=$(grep -oE 'F[0-9]+' <<<"$row" | head -1)`, `branch=$(awk -F'|' '{print $4}' <<<"$row" | sed -E …)`; refer to `$branch`/`$fid` in the outcome clauses (verified end-to-end on a real-shaped row).
- [x] **Reword the numeric-gate STOP to cover the two-link case** — same sub-bullet — "is not exactly one numeric value", with a parenthetical explaining the two-line rejection and the one-link-per-row contract.
- [x] **Echo OPEN's deliberate omission in the report line** — Step 7 report line — "OPEN-linked rows are deliberately unreported".
- [x] **Restore the `+`-chained Comparison line in Review 4** — this file — match Reviews 2–3.

## Review 6
Generated: 2026-09-16 22:33
Comparison: origin/main...HEAD (6 commits — `81a2281` + Review 1 fixes `7eb874c` + Review 2 fixes `82ff830` + Review 3 fixes `604f38f` + Review 4 fixes `b6fde16` + Review 5 fixes `da212b7`)
Verdict: **PUSHED WITH MINOR FINDINGS**

### Results by Reviewer

#### 1. Safety & Security — PASS
`lineno` is only ever the integer from the enumeration grep's `-n` prefix; the `N` gate still precedes `gh pr view`; nothing regressed.

#### 2. Correctness — PASS
Full per-row pipeline run against a real-shaped row: `fid=F4`, `N=40`, `branch=feature/remove-details-longterm`; `awk -F'|'` column 4 is Branch; `head -1` yields the row's own F-ID. One minor: the `(<F-ID>/<N> below are $fid/$N)` note sits after the first STOP that uses those placeholders.

#### 3. Simplicity & Conciseness — PASS
Two minors: same placement note; the `<placeholder>` vs `$variable` dual notation mirrors Step 5's existing convention (no change needed).

#### 4. Test Coverage — PASS
Pipeline run against the five shapes plus a two-link row — all correct. Two minors: outcome comparison is prose rather than a `jq`/`read -r` extraction like Step 5's; `lineno` is the one remaining prose-only step.

#### 5. Completeness & Cleanup — PASS
All four Review 5 items verified byte-exact; Review 4 Comparison line fixed; no stale live text.

#### 6. Consistency & Style — PASS
Assign-before-use form matches Step 5. One minor: same placement note as Correctness.

#### 7. Integration Risk — PASS
`fid=`/`branch=` verified against every row shape `/new-feature` Step 8 and `/run-feature` steps 3/10 write (7 live rows, NF=6 each). One minor (no action): the `awk` split assumes no literal `|` in a cell — same caveat class as the `[#N](` scope note.

#### 8. Error Handling & Silent Failures — PASS
`sed -n "${lineno}p"` can't pick a wrong line under the documented sequencing; `fid`/`branch` can't be empty for a genuinely matched row. Three minors: `lineno=` one-liner; `N` extraction scans the whole row rather than the PR column; `$fid`'s non-empty guarantee is unstated.

### To-Do: Required Changes

- [ ] **Move the `(<F-ID>/<N> … are $fid/$N)` mapping note before its first use** — `.claude/skills/compact-plans/SKILL.md` Step 7 scan sub-bullet — place it right after the `row=`/`fid=`/`N=`/`branch=` assignments so it precedes the numeric-gate STOP, or reword "below" to "here and below".
- [ ] **Add a `lineno=` one-liner** — same sub-bullet — `lineno=$(cut -d: -f1 <<<"$hit")` alongside the other assignments, so no step is prose-only.
- [ ] **Extract `N` from the PR column rather than the whole row** — same sub-bullet — `N=$(awk -F'|' '{print $5}' <<<"$row" | grep -oE '\[#[0-9]+\]\(' | grep -oE '[0-9]+')`, so a `[#N](` link in prose elsewhere on the row can't trip the two-link STOP; or add a one-clause scoping caveat.
- [ ] **Turn the outcome comparison into a `jq` extraction** — same sub-bullet — `read -r state head_ref <<<"$(jq -r '"\(.state) \(.headRefName)"' <<<"$pr_json")"` then `[[ "$state" == MERGED && "$head_ref" == "$branch" ]]` etc., mirroring Step 5's pattern.
- [ ] **State `$fid`'s non-empty guarantee** — same sub-bullet — one clause: guaranteed by the enumeration grep's `^\| \*{0,2}F[0-9]+` anchor, so no separate guard is needed.
