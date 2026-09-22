# Push Review: chore/compact-plans-before-f16

## Review 1
Generated: 2026-09-22 08:13
Comparison: origin/main (`2f9e688`)...HEAD (`c8297f8`) — 1 commit, 5 files, plans-only: the `/compact-plans` sweep after F21 (#46) and the F16–F22 capture batch (#45) — freeze + relocate two dirs into `plans/completed/`, harvest their open findings, prune three merged branches
Verdict: **BLOCKED**

### Results by Reviewer

#### 1. Safety & Security — PASS
Documentation-only: markdown edits plus three `git mv` renames into `plans/completed/`. No code, secrets, config or system-boundary changes; nothing in scope.

#### 2. Correctness — PASS
Every citation re-verified against the repo rather than the prose: `85cf985`/#46, `4cf24b4`/#45, `2f9e688`/#47 and `fb6bb9b` all confirmed via `gh pr view` + `git show`. The F21 freeze-header Outcome was checked line-by-line against `git show 85cf985` — the "two `ChoreForm.tsx` lines", the `defaultRoom` prop, the bottom-centre `Toast` (`bottom-40`/`z-[80]`/`flex justify-center`) and the "F18 bottom-right vs Toast bottom-centre" contract all match the shipped code and META-PLAN's Standing invariant 14. Both harvest sections were checked bullet-by-bullet against their source reviews; every path and line number (`Toast.tsx:11`, `ChoreForm.tsx:45`, `ChoreForm.tsx:19`, `App.tsx:101-106`) re-verified against current file contents. The "Review 1's eight boxes all landed in `fb6bb9b`" claim was verified item-by-item against `git show fb6bb9b -- plans/META-PLAN.md`. Batch-view counts independently recounted.
- minor — `plans/META-PLAN.md:353` *(not touched by this diff)* — the rename makes two existing passages stale; expected to self-correct at the next Phase C fold-back, per the documented rule that `/compact-plans` never edits `META-PLAN.md`.

#### 3. Simplicity & Conciseness — PASS
Harvest entries are self-contained condensed paraphrases, not transcripts, and match the density of sibling sections. No dead content, over-hedging or needless indirection.
- minor — `plans/completed/form-polish-date-fix/form-polish-date-fix.md:2` — the freeze Outcome runs 7 wrapped lines against the skill's "1–4 lines". Not an outlier (multi-device-sync is also 7; touch-lock 12, swipe-direction-swap 14), but the diff's *own* new harvest entry applies that same ≤ 4-line yardstick to local-url-alias — so it should hold itself to it.

#### 4. Test Coverage — PASS
No application source changed, so no direct test obligation. Both harvested `[test]` items were verified genuinely still open on `main`: `e2e/smoke.spec.ts:161-178` / `:180+` carry no `getByTestId('toast')` assertions (only the add-chore test at `:138-147` does), and `App.test.tsx:927` covers only the same-mutation retry case, not the cross-mutation one. Neither harvest entry is stale.

#### 5. Completeness & Cleanup — PASS
All Step 7 end-state checks re-run independently against the filesystem and passing: freeze headers present, no `tmp/` under `plans/completed`, no empty `plans/**/.claude/`, `plans/ledger/` holds exactly the newest + its PREDECESSOR, `.gitignore` carries `plans/**/tmp/`, nothing merged left live. Harvest reconciliation clean (6/6 for form-polish-date-fix; 9 raw boxes → 1 harvested + 8 explained by the append-only convention, spot-verified). `meta-plan-additions-260920` lacking a top-level plan `.md` matches the precedent of every other reviews-only completed dir. `plans/feature/kiosk-shell-extraction/` correctly left **Live** (9 active META-PLAN references, F15's cross-repo gate).
- minor — `plans/completed/form-polish-date-fix/form-polish-date-fix.md:2` — same Outcome-length overage as Simplicity flagged.
- minor — `plans/META-PLAN.md:352-362` — same expected staleness as Correctness flagged.

#### 6. Consistency & Style — PASS
Freeze-header line 1, harvest heading shape, `Source:` line, blockquote note, item shape, `---` separators, theme-tag and severity vocabulary, the `[x]` *(accepted, no change)* pattern, dates, F-ID forms and commit-message style all match precedent. Batch-view arithmetic matches the items added.
- minor — `plans/completed/form-polish-date-fix/form-polish-date-fix.md:2` — the Outcome is hard-wrapped across 7 blockquote lines, whereas all three named precedents (translucent-add-deck, remove-details-longterm, local-url-alias) write it as a single unwrapped line.

#### 7. Integration Risk — PASS
Repo-wide grep for both old paths found no surviving broken reference in `plans/ledger/*.md`, `plans/PUSH-REVIEW-FINDINGS.md` or `.claude/skills/**/SKILL.md`. No Status-ledger row was deleted or altered (this diff does not touch `META-PLAN.md`), and no merged-PR F-ID has a surviving row — no "Phase C pending". The Step 7 `[#N](` scan assumption is intact. Nothing depends on the three pruned branch names resolving locally (`gh pr list --head` matches the PR's recorded head-ref).
- minor — `plans/META-PLAN.md:353` and `:613` — two prose passages still cite the pre-move `plans/feature/form-polish-date-fix/` path and describe the freeze/harvest as pending.

#### 8. Error Handling & Silent Failures — FAIL
Both high-stakes verification questions came back clean: all eight of Review 1's meta-plan-additions boxes genuinely landed on `main` (checked at HEAD *and* at `4cf24b4`), and `form-polish-date-fix-review.md`'s lone `[ ]` is genuinely a rejected wrong-citation finding — so no real open finding was silently dropped. The `[x]` *(accepted, no change)* item is an honest classification matching five existing precedents, and folding Type Design findings into `[dx]`/`[style]` is consistent with the file's legend. All six entries are actionable.
- major — `plans/PUSH-REVIEW-FINDINGS.md:263` — the harvest tags the `Toast`/`onDismiss` item `opt`, but the source review rates it `*(minor)*` (reviewer 9, `push-review-feature-form-polish-date-fix.md:40`) and its To-Do heading (`:47`) carries no "(Optional)" qualifier. Silent severity downgrade with no rationale recorded.
- major — `plans/PUSH-REVIEW-FINDINGS.md:264` — same downgrade on the `defaultRoom` doc-comment item: source rates it `*(minor)*` (`:41`), To-Do heading (`:48`) carries no "(Optional)". The file's own precedent (e.g. the edit-task section) only tags `opt` when the source heading says "(Optional)" — as this sweep correctly did for the `loadChores` item, whose source heading reads *(pre-existing, optional)*.

### To-Do: Required Changes

- [ ] **Restore the two downgraded severities to `minor`** — `plans/PUSH-REVIEW-FINDINGS.md` § "F21 (current numbering) — form-polish-date-fix" — change the `Toast`/`onDismiss` entry and the `defaultRoom` doc-comment entry from `` `[dx]` opt `` / `` `[style]` opt `` to `` `[dx]` minor `` / `` `[style]` minor ``, matching reviewer 9's `*(minor)*` ratings in the source review. Leave the `loadChores` entry as `opt` (its source heading does say "optional").
- [ ] **Trim the F21 freeze-header Outcome to ≤ 4 rendered lines** — `plans/completed/form-polish-date-fix/form-polish-date-fix.md:2` — drop the facts already carried by META-PLAN's Standing invariant 14 (the `Toast` internals, the F18 bottom-right contract) and keep: what shipped, the local-midnight wire change, the mount-time-default acceptance, the harvest pointer and the #47 fold-back. The diff's own harvest entry applies this yardstick to local-url-alias, so it must hold here too.
- [ ] **(Optional) Unwrap the freeze-header Outcome to a single line** — same file/line — all three named precedents write the Outcome as one unwrapped blockquote line rather than hard-wrapping at ~110 cols. Pick one form; if trimming to ≤ 4 lines above, one line is the natural result.
- [ ] **(Out of scope here — next Phase C)** **Refresh the two stale `META-PLAN.md` passages** — `plans/META-PLAN.md:352-362` and `:613` — the "Branch/dir cleanup" paragraph still calls F21's freeze/harvest outstanding and cites `plans/feature/form-polish-date-fix/`, and the F21 narrative bullet points at the pre-move review path. `/compact-plans` never edits `META-PLAN.md` by contract, so this belongs to `/run-feature F16` Phase C or the next `/new-feature` run — recorded here so it is not lost.

## Review 2
Generated: 2026-09-22 08:24
Comparison: origin/main (`2f9e688`)...HEAD (`d23a2eb` + the two minors below) — Review 1's two required items plus both optionals landed in `d23a2eb`; per the append-only convention adopted in #42, Review 1's boxes stay `[ ]` and this line is the record. The deferred META-PLAN item stays open on purpose (out of scope for this skill).
Verdict: **PUSHED WITH MINOR FINDINGS**

### Results by Reviewer

#### 1. Safety & Security — PASS
Delta is prose-only; no code, secrets or destructive operations. Grep for credential patterns found only the review text's own "no secrets in scope" note.

#### 2. Correctness — PASS
Both fixes verified landed with no new factual error. Standing invariant 14 (`plans/META-PLAN.md:496`) genuinely carries the bottom-centre-`Toast` and F18-bottom-right facts the trimmed Outcome now defers to it — the trim relocated, it did not delete. All four PR/SHA citations re-checked. Batch-view counts recounted: `[test]` 23, `[style]`/`[dx]` 47, and all 81 open items reconcile (23 + 47 + 11 a11y/security/design) — the severity-only change correctly left tag counts untouched.
- minor — `plans/chore/compact-plans-before-f16/reviews/push-review-chore-compact-plans-before-f16.md:31` — Review 1's Consistency bullet said the pre-fix Outcome was "6 blockquote lines"; it was 7, as Simplicity and Completeness both wrote — **fixed before push**.
- minor — `plans/completed/form-polish-date-fix/form-polish-date-fix.md:2` — the closing clause said "Six **minor** findings harvested" although the six are 4 `minor` + 1 `opt` + 1 accepted-no-change — **fixed before push** ("Six push-review findings harvested").

#### 3. Simplicity & Conciseness — PASS
Harvest sections confirmed condensed paraphrases (a 50-line source review compressed to ~11 lines), no restatement of what META-PLAN or the freeze header already carries, and the new review file is proportionate — it follows the repo's standard 8-reviewer shape rather than ceremony invented for a small diff.
- minor — `plans/completed/form-polish-date-fix/form-polish-date-fix.md:2` — now one unwrapped line of 620 chars, rendering to 6 lines at 110 cols rather than the literal ≤ 4. It matches its nearest sibling `local-url-alias` exactly (630 chars, also 6) and beats `translucent-add-deck` (8) and `remove-details-longterm` (8), and it kept the load-bearing "why" (the local-midnight rationale, the mount-time-default acceptance). Accepted as in line with real precedent.

#### 4. Test Coverage — PASS
No test or source file changed in the diff. Both `[test]` harvest entries confirmed byte-identical between `c8297f8` and HEAD, and both re-verified still genuinely open: `e2e/smoke.spec.ts`'s delete (`:161-178`) and edit (`:180+`) tests carry no toast assertions (only the add test at `:141-142`), and `App.test.tsx:927` covers only the same-mutation retry, not the cross-mutation case.

#### 5. Completeness & Cleanup — PASS
Every Step 7 end-state check re-run and passing. Harvest reconciliation unchanged by the severity fix (6/6 and 1-of-9-with-8-explained). This sweep's own `plans/chore/compact-plans-before-f16/tmp/` confirmed covered by `.gitignore:48` (`git check-ignore`), its `reviews/` file correctly tracked, and leaving the sweep's own dir live under `plans/chore/` is correct — it cannot freeze itself before its own PR merges.
- minor — `plans/META-PLAN.md:353` / `:613` — the deferred staleness, unchanged and out of scope by contract.

#### 6. Consistency & Style — PASS
The Outcome is now a single unwrapped blockquote line (620 chars), matching all three named precedents (translucent-add-deck 800, remove-details-longterm 804, local-url-alias 630 — each one physical line). Both restored severities verified against the source review's `*(minor)*` ratings, with `loadChores` correctly still `opt`. Harvest form, freeze-header form, the new review file's structure and the `[refactor]` commit tag all match precedent.

#### 7. Integration Risk — PASS
Old-path survivors confirmed to be exactly the same two `plans/META-PLAN.md` lines Review 1 found — nothing new; `plans/chore/meta-plan-additions-260920` has zero surviving references anywhere. `git diff origin/main...HEAD -- plans/META-PLAN.md` is empty, so no Status-ledger row was touched. The Step 7 `[#N](` grep is hardcoded to `plans/META-PLAN.md`, so nothing added elsewhere can produce a false match. `/worktree` and `/new-feature` reference neither moved path nor any pruned branch name; `git worktree list` shows no worktree on them.
- note — this sweep's own dir will be harvested by a *future* `/compact-plans` run once this branch's PR merges, picking up the one deliberately-open META-PLAN item below. By design.

#### 8. Error Handling & Silent Failures — PASS
Both Review 1 majors confirmed resolved exactly as prescribed, with no collateral severity change. Re-audit found nothing else silently dropped: the "eight boxes landed in `fb6bb9b`" claim re-confirmed, the lone plan-reviewer `[ ]` re-confirmed as a rejected citation, all six harvest entries faithful in severity and theme, the `[x]` accepted-no-change entry independently corroborated by the plan's own Decisions section (`form-polish-date-fix.md:166`), and the Outcome trim verified a relocation rather than a loss.

### To-Do: Required Changes

- [x] **Correct "6 blockquote lines" to "7"** — `plans/chore/compact-plans-before-f16/reviews/push-review-chore-compact-plans-before-f16.md:31` — done before push.
- [x] **Drop the severity claim from the Outcome's closing clause** — `plans/completed/form-polish-date-fix/form-polish-date-fix.md:2` — done before push ("Six push-review findings harvested").
- [ ] **(Out of scope here — next Phase C)** **Refresh the two stale `META-PLAN.md` passages** — `plans/META-PLAN.md:352-362` and `:613` — carried forward from Review 1; `/compact-plans` never edits `META-PLAN.md` by contract, so this belongs to `/run-feature F16` Phase C or the next `/new-feature` run.
