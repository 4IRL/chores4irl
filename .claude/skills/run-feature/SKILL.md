---
name: run-feature
description: Run one feature from plans/META-PLAN.md through its full Per-Feature Session Contract for chores4irl — cold-survey, plan, review, implement, commit, verify, and push a PR, then (once merge is confirmed) fold the merge back into META-PLAN.md. Resumable: re-invoking after a merge picks up exactly where the feature left off, driven by the state of its PR. Use when asked to run/implement/work on/continue a specific F-id feature, to check on one already in flight, or to reconcile META-PLAN.md after merging one. Replaces the old plans/NST-META-PLAN-PROMPT.md template.
argument-hint: <F-id>
---

# Run Feature

Execute exactly one feature from `plans/META-PLAN.md`'s "REMAINING FEATURES" section, following its Per-Feature Session Contract end-to-end, then — once the user confirms the PR merged — fold that merge back into `META-PLAN.md`. **Never touch a second feature in one invocation.**

## Resolve the F-id

`$0` is the F-id (bare current numbering, e.g. `F4`; not `-L` legacy or **SUPERSEDED**). Read `plans/META-PLAN.md` and locate its per-feature section under "REMAINING FEATURES". If the F-id doesn't exist there, is `-L`, or is marked **SUPERSEDED**, stop and say why.

From the section, note: the `feature/<slug>` branch name (its "Session loop" line), "Assumed starting state", "Expected end state", and "Open risks / decisions".

## Decide which phase to resume

Before doing anything else, determine where this feature actually stands — **don't assume Phase A just because you were asked to "run" it**:

```bash
gh pr list --head feature/<slug> --state all --json number,state,mergedAt,createdAt
```

Check `gh`'s exit code and that stdout parses as valid JSON **before** consulting the table below. On any command failure (auth/network/rate-limit), stop and report the raw error — do not fall through to Phase A's branch-creation step; a `gh` outage would otherwise look identical to "no PR found" and could duplicate work on an already-in-flight feature.

| PR state | Phase |
|---|---|
| no PR found (branch may not exist yet either) | **Phase A** — implement |
| PR open | **Phase B** — human merge gate |
| PR merged, and `plans/META-PLAN.md`'s Status ledger still has a row for this F-id | **Phase C** — fold the merge into META-PLAN |
| PR merged, no ledger row | nothing to do — report and stop |
| PR closed, not merged | stop and ask the user whether to reopen the PR, restart on a fresh branch, or abandon the F-id |

If `gh pr list --state all` returns more than one PR for this head branch (e.g. a closed-then-reopened history), use the most recent by number/`createdAt`; if it's ambiguous which is authoritative, stop and show the full list to the user rather than guessing.

## Branch Guard

Required only when the table above resolves to Phase A (not needed to resume Phase B or C): require the working tree clean and on `main`, synced (`gmas`). If dirty or elsewhere, stop and ask how to proceed — do not stash without asking. After `gmas`, re-run `git status` and confirm the tree is clean and matches `origin/main`; on a `gmas` conflict/failure, stop and report rather than continuing.

## Phase A — implement

1. **Cold survey.** With no assumption carried from a prior session, verify the repo actually matches the Baseline / this feature's "Assumed starting state" — check the specific grep/route/file facts the section lists, not a skim. **If the repo diverges, stop and report before proceeding**; do not silently reconcile by picking an interpretation.
2. `git checkout feature/<slug> || git checkout -b feature/<slug> main` — the branch may already exist (a resumed feature); fall back to creating it fresh only when it doesn't. Don't suppress the first attempt's error output — if it fails for a reason other than "branch doesn't exist" (e.g. already checked out in another worktree), that message needs to stay visible rather than being masked by the fallback's own error.
3. Set this feature's Status-ledger row in `plans/META-PLAN.md` to `in-progress` (a small standalone edit that rides in the first implementation commit).
4. `/plan-creator` — produce the implementation plan from this feature's Assumed/Expected state; resolve its "Open risks / decisions" during planning. (Expect `/plan-creator`'s own Branch Guard to fire an `AskUserQuestion` offering **Switch to main first** vs **Stay on current branch** — it does so whenever it's not on `main`, and step 2 already checked out `feature/<slug>`. The expected answer is **Stay on current branch** — but still let the user answer it; do not skip or pre-answer the guard, which is `/plan-creator`'s own and can't be suppressed from this skill. If that prompt does *not* appear, you are still on `main` (step 2 failed) — stop and report rather than letting `/plan-creator` auto-create its own branch, which `gh pr list --head feature/<slug>` would never find on resume.)
5. `/plan-reviewer <slug>` — apply its corrections before implementing. Unlike `/plan-creator`, which infers its topic, `/plan-reviewer` and `/run-plan` each locate the plan by fuzzy-matching a required plan-name argument against `plans/**`; the argument is the plan file's name stem — `plans/feature/<slug>/<slug>.md` as step 4 writes it (if `/plan-creator` chose a different filename, pass that stem instead; and since this step leaves `plans/feature/<slug>/reviews/<slug>-review.md` beside the plan, confirm each skill resolved the plan file itself, not its review doc).
6. `/run-plan <slug>` **exactly once**, on this feature's own plan — never nested, never on `META-PLAN.md` itself.
7. `/git-commit` to atomize the work; apply its self-review corrections.
8. **Verify "Expected end state"** — run the relevant Vitest suites + `e2e/smoke.spec.ts`, and check every listed grep/route fact. Reconcile any gap before publishing.
9. `/git-push` — runs the 8-agent review and opens/updates the PR. If it rejects, fix per its findings and re-push; do not fall through to Phase B with an unresolved rejection.
10. Update the Status-ledger row to `in-review` with the now-known PR link, in a small follow-up commit — matching `META-PLAN.md`'s own Ledger update protocol ("in-review + PR link after git-push"). Commit, then `git push` directly to land it on the already-open PR (a plain push, not another full `/git-push` review cycle — that PR was already reviewed in step 9 and this is a trivial one-line follow-up); confirm the push actually succeeded — check `git push`'s own exit status/output, or re-run `git status` and confirm it reports nothing to push; on failure, stop and report rather than falling through to Phase B.

Fall through to Phase B once the PR is open.

## Phase B — human merge gate

Do not assume the feature shipped or merged just because a PR exists.

**Pause-and-ask checkpoint — merge confirmation:** confirm both conditions with the user before folding anything into `META-PLAN.md`:
```
AskUserQuestion, multiSelect:
"Confirm before I fold this into META-PLAN.md:"
  [ ] The feature works correctly on its branch (you've verified it)
  [ ] Its PR is merged into main
```
- Both confirmed → continue to Phase C now, in this same invocation.
- Either unconfirmed → end the session. Tell the user to re-run `/run-feature <F-id>` once both are true — it will detect the merged PR via `gh` and resume directly at Phase C.

## Phase C — fold the merge into META-PLAN.md

1. `git checkout main && gmas`. Verify the sync the same way as Branch Guard's post-`gmas` check above.
2. `git checkout chore/meta-plan-update-<f-id-lowercase> || git checkout -b chore/meta-plan-update-<f-id-lowercase> main` — same checkout-or-create fallback and error-visibility caveat as Phase A step 2 (here the branch pre-exists when a prior Phase C attempt was interrupted before its own PR merged, then resumed). If the branch already existed, rebase/merge it onto this freshly-synced `main` now, before step 3 edits `plans/META-PLAN.md` — other features' Phase C merges may have landed since it was created, and re-editing a stale copy could reintroduce or clobber their ledger/Baseline updates. If that rebase/merge reports a conflict, stop, run `git rebase --abort` (or `git merge --abort`), and report the conflicting branch/commit and files to the user rather than resolving it automatically — the user decides how to reconcile the two features' ledger/Baseline edits before step 3 proceeds. Confirm the abort actually landed (`git status` shows no rebase/merge in progress) before reporting; if the abort itself fails, report that raw error instead.
3. Edit `plans/META-PLAN.md` per its own **Ledger update protocol** and **History policy**:
   - Delete this feature's Status-ledger row (never mark it `merged` — a verified-merged row is deleted, not kept).
   - Annotate its row in the **Legacy → current ID map** as shipped (PR number), if applicable.
   - If a *remaining* feature still targets this one's implemented contract, add/update it under "COMPLETED-FEATURE CONTRACTS STILL IN FORCE"; otherwise fold the durable facts into **Baseline** / **Standing invariants** instead.
   - Refresh the **Baseline** header (`main` at PR #N, `<SHA>`) and any baseline facts this feature changed.
   - If this feature was **★FOCUS**, re-evaluate "Shortest path to the focus feature": if the next step is unambiguous (its track's next item, zero new prerequisites), advance ★FOCUS and say so; if it's genuinely ambiguous, ask via `AskUserQuestion` rather than guessing.
4. **Verify the step 3 edits landed** — re-read `plans/META-PLAN.md` (`git diff main -- plans/META-PLAN.md` is the quickest cross-check and also covers a resumed branch) and confirm every prescribed edit is actually present: this feature's Status-ledger row is gone; its **Legacy → current ID map** row, if the map has one for this F-id, carries the PR number; its contract or durable facts landed under "COMPLETED-FEATURE CONTRACTS STILL IN FORCE" or in **Baseline** / **Standing invariants**, and any baseline facts it changed were updated there (the header refresh alone satisfies neither); the **Baseline** header names this feature's merge PR/SHA (or a later merge's, if another Phase C already advanced it), not the pre-merge value; and, if this feature was **★FOCUS**, no `FOCUS` reference still names this F-id (`grep -in focus plans/META-PLAN.md`). Reconcile any gap before committing.
5. `/git-commit`.
6. `/git-push` — this is a small docs-only PR; the 8-agent review still runs, that's fine.
7. End the session. Do not start another feature.

## Important Notes

- One feature per invocation, always. Never chain into a second F-id even if Phase C finishes quickly.
- Never self-mark a PR merged — Phase B's confirmation (or `gh`'s own `mergedAt`) is the only source of truth.
- Phase A/C never hand-edit a Status-ledger row for a *different* feature.
