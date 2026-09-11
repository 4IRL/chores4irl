---
name: compact-plans
description: Sweep chores4irl's plans/ directory back to a clean state — freeze and relocate merged/abandoned/superseded plan folders into plans/completed or plans/abandoned with an outcome header, harvest their still-open review findings into plans/PUSH-REVIEW-FINDINGS.md, purge regenerable tmp/ scratch and stray empty dirs, trim plans/ledger/ to the two newest files, and prune git branches whose PRs already merged (PR-driven, not ancestry — this repo squash-merges). Never edits app source or plans a feature. Use when asked to clean up plans/, compact/archive finished plans, prune merged branches, or run periodically after a feature merges. Replaces the old plans/COMPACT-PLANS-PROMPT.md template.
argument-hint: (none)
---

# Compact Plans

Reorganize `plans/` back to: live work in `plans/feature/` (and `plans/revision/`, `plans/chore/`), finished work frozen in `plans/completed/` or `plans/abandoned/`, no regenerable scratch. Preserve durable signal (intent, why a decision was made, an interface contract a later feature depends on); discard the ephemeral (step-by-step checklists git already supersedes). **This skill only reorganizes planning documents — never touches application source, and never plans or implements a feature.**

## 1. Branch guard
On `main`/`master`: `gmas`, then `AskUserQuestion` — create `chore/compact-plans-<YYMMDD>` (recommended) or proceed on main. Do not proceed unconfirmed. On a feature branch already: proceed.

## 2. Tracking check
```bash
git ls-files plans | wc -l
find plans -type f | wc -l
```
If `plans/` is largely untracked, raise the **tracking decision** once via `AskUserQuestion` — (a) start committing the archive (usually right — frozen plans are cheap, high-signal, and worth backing up on GitHub) or (b) keep it local-only and gitignore `plans/`. Respect the answer; state it in the summary either way. A single stray tracked file amid an otherwise-untracked folder is likely an accidental `git add` — flag it rather than silently fixing it.

## 3. Classify every plan
For everything under `plans/feature/`, `plans/revision/`, `plans/chore/` (i.e. not already archived), determine true status from the repo — never trust the plan doc's own claims:
- **Merged** — `gh pr list --state merged --json number,title,headRefName,mergeCommit,mergedAt`, cross-checked against the dir/branch name; confirm the relevant code is actually on `main` (spot-check the route/component/field the plan describes).
- **Abandoned** — not on `main`, not in the current backlog (`plans/META-PLAN.md`'s Status ledger / latest `plans/ledger/*_feature_ledger.md`), no active branch.
- **Superseded** — its functionality shipped a different way, or a later backlog item explicitly reverses/replaces it (check `META-PLAN.md`'s SUPERSEDED banners).
- **Live** — in the current backlog or on an active branch/open PR. Leave it and its `tmp/` alone.

## 4. Freeze + relocate finished plans
For each Merged / Abandoned / Superseded plan, prepend a header to its main `.md` (do not rewrite the body):
```markdown
> **STATUS: Merged** `<SHA>` (#<PR>). Frozen — historical record, do not edit.
> **Outcome:** <1-4 lines: what shipped, any deviation + why, any interface contract a later feature depends on. Note if a later item supersedes it.>
```
(`Abandoned — <reason>` / `Superseded by <X>` as appropriate.) The one line that earns its keep is *why* — that's what git alone can't tell a future session.

**Harvest open findings first:** for each dir's `reviews/push-review-*.md`, copy every still-open `- [ ]` item from its "To-Do: Required Changes" into `plans/PUSH-REVIEW-FINDINGS.md` under a per-feature section (theme tag + severity + link back to the source). Skip items already present there. If a finding's blocking dependency has since merged, flag it as now-decidable rather than "future."

Then relocate: `git mv <dir> plans/completed/` (or `plans/abandoned/`) if tracked, plain `mv` if not (per the Step 2 answer). Keep `reviews/` — it's the frozen rationale behind the findings/ledger entries; the folder location now signals status at a glance.

## 5. Purge regenerable scratch
- Delete `tmp/` dirs belonging to plans just frozen in Step 4 (plan-reviewer / push-review dimension files — regenerated every run). Leave `tmp/` for anything still **Live**.
- Delete stray empty `plans/**/.claude/` directories (artifacts of a session launched with cwd inside `plans/`).
- Confirm `.gitignore` contains `plans/**/tmp/`; add it if missing.
- **Ledger retention:** `plans/ledger/` only needs the newest `*_feature_ledger.md` and the one it directly supersedes (carrying the PREDECESSOR banner). Delete any older ones — mechanical and git-reversible, no pause-and-ask needed; just note what was deleted.

## 6. Prune merged branches — PR state, not ancestry
This repo **squash-merges**, so `git branch --merged main` misses merged feature branches (they're not ancestors). Drive the list from PRs instead:
```bash
gh pr list --state merged --json number,title,headRefName,mergeCommit
```
cross-checked against `git branch -a`. A branch whose functionality shipped via a *different* path (squashed elsewhere, or superseded per Step 3) is also a candidate — confirm its work is genuinely on `main` first.

**Pause-and-ask checkpoint:** present the exact branch list (local + remote) before deleting anything — branch deletion is recoverable (reflog / re-push from elsewhere) but a remote delete is outward-facing, same gate as a commit.

For each confirmed branch:
```bash
git branch -d <branch>                                            # -d only — refuses anything not actually merged
gh api -X DELETE repos/4IRL/chores4irl/git/refs/heads/<branch>     # remote; confirm it isn't already gone first
```
Never `-D`. If `-d` refuses, stop and investigate — don't force past it. Never prune: the default branch, any branch with unmerged commits, or a branch backing a **Live** feature / open PR.

If a pruned branch's feature still has a Status-ledger row in `plans/META-PLAN.md`, delete that row too (per its History policy) — this is what stops the next sweep from re-flagging it.

## 7. Preserve, never discard
Before deleting anything outside `tmp/`, confirm it isn't the only record of a design decision, a rejected alternative, an unresolved design question on a still-live plan (fold it into that plan's body first), or an implemented-contract a future feature depends on. When in doubt, freeze-and-archive rather than delete.

## 8. Summary and commit
Report: what was frozen (with SHAs/PRs), moved, deleted (tmp/, stray dirs, old ledger files), and pruned (branches, local + remote). Then `/git-commit` on the working branch.

## Constraints
- Reorganizes planning docs only — never source files, never plans/implements a feature.
- Deletion is irreversible for anything not in git history — peek at any non-standard file before removing it.
- Every branch/remote deletion and the tracking decision go through `AskUserQuestion` — never assume.
