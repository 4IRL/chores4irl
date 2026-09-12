---
name: compact-plans
description: Sweep chores4irl's plans/ directory back to a clean state — freeze and relocate merged/abandoned/superseded plan folders into plans/completed or plans/abandoned with an outcome header, harvest their still-open review findings into plans/PUSH-REVIEW-FINDINGS.md, purge regenerable tmp/ scratch and stray empty dirs, trim plans/ledger/ to the two newest files, and prune git branches whose PRs already merged (PR-driven, not ancestry — this repo squash-merges). Never edits app source or plans a feature. Use when asked to clean up plans/, compact/archive finished plans, prune merged branches, or run periodically after a feature merges. Replaces the old plans/COMPACT-PLANS-PROMPT.md template.
---

# Compact Plans

Reorganize `plans/` back to: live work in `plans/feature/` (and `plans/revision/`, `plans/chore/`), finished work frozen in `plans/completed/` or `plans/abandoned/`, no regenerable scratch. Preserve durable signal (intent, why a decision was made, an interface contract a later feature depends on); discard the ephemeral (step-by-step checklists git already supersedes). **This skill only reorganizes planning documents — never touches application source, and never plans or implements a feature.**

## Branch Guard

On `main`/`master`: `gmas` (verify with `git status` that the tree is clean and matches `origin/main`; stop and report on any `gmas` conflict/failure), then `AskUserQuestion` — create `chore/compact-plans-<YYMMDD>` (recommended) or proceed on main. Do not proceed unconfirmed. On a feature branch already: `git status` — if dirty, stop and ask how to proceed (do not stash without asking) so unrelated uncommitted changes can't ride into Step 7's `/git-commit`; otherwise proceed.

## 1. Tracking check

```bash
git ls-files plans | wc -l
find plans -type f | wc -l
```
If `plans/` is largely untracked, raise the **tracking decision** once via `AskUserQuestion` — (a) start committing the archive (usually right — frozen plans are cheap, high-signal, and worth backing up on GitHub) or (b) keep it local-only and gitignore `plans/`. Respect the answer; state it in the summary either way. A single stray tracked file amid an otherwise-untracked folder is likely an accidental `git add` — flag it rather than silently fixing it.

## 2. Classify every plan

For everything under `plans/feature/`, `plans/revision/`, `plans/chore/` (i.e. not already archived), determine true status from the repo — never trust the plan doc's own claims:
- **Merged** — `gh pr list --state merged --json number,title,headRefName,mergeCommit,mergedAt`, cross-checked against the dir/branch name; confirm the relevant code is actually on `main` (spot-check the route/component/field the plan describes). Check `gh`'s exit code and that stdout parses as valid JSON before classifying from the result; on any failure (auth/network/rate-limit), stop and report the raw error rather than treating an empty result as "nothing merged".
- **Abandoned** — not on `main`, not in the current backlog (`plans/META-PLAN.md`'s Status ledger / latest `plans/ledger/*_feature_ledger.md`), no active branch.
- **Superseded** — its functionality shipped a different way, or a later backlog item explicitly reverses/replaces it (check `META-PLAN.md`'s SUPERSEDED banners).
- **Live** — in the current backlog or on an active branch/open PR. Leave it and its `tmp/` alone.

## 3. Freeze + relocate finished plans

For each Merged / Abandoned / Superseded plan, prepend a header to its main `.md` (do not rewrite the body):
```markdown
> **STATUS: Merged** `<SHA>` (#<PR>). Frozen — historical record, do not edit.
> **Outcome:** <1-4 lines: what shipped, any deviation + why, any interface contract a later feature depends on. Note if a later item supersedes it.>
```
(`Abandoned — <reason>` / `Superseded by <X>` as appropriate.) The one line that earns its keep is *why* — that's what git alone can't tell a future session.

**Harvest open findings first:** for each dir's `reviews/push-review-*.md`, copy every still-open `- [ ]` item from its "To-Do: Required Changes" into `plans/PUSH-REVIEW-FINDINGS.md` under a per-feature section (theme tag + severity + link back to the source). Skip items already present there. If a finding's blocking dependency has since merged, flag it as now-decidable rather than "future." Then reconcile: count the still-open `- [ ]` items in the source review(s) against the entries just added (plus any legitimately skipped as already-present). A mismatch blocks the relocation below — re-harvest or resolve it before moving on.

Then relocate: `git mv <dir> plans/completed/` (or `plans/abandoned/`) if tracked, plain `mv` if not (per the Step 1 answer). If the `git mv`/`mv` fails (destination already exists, permissions, etc.), stop and report the dir name, destination, and error immediately rather than relying on Step 7's end-of-run live-dir check to surface it, then move on to the next plan rather than aborting the whole sweep. Keep `reviews/` — it's the frozen rationale behind the findings/ledger entries; the folder location now signals status at a glance.

## 4. Purge regenerable scratch

- Delete `tmp/` dirs belonging to plans just frozen in Step 3 (plan-reviewer / push-review dimension files — regenerated every run). Leave `tmp/` for anything still **Live**.
- Delete stray empty `plans/**/.claude/` directories (artifacts of a session launched with cwd inside `plans/`) — verify emptiness first (`find plans -type d -name .claude -empty`); a non-empty match falls through to Step 6's preserve-or-archive judgment instead of being silently removed.
- Confirm `.gitignore` contains `plans/**/tmp/`; add it if missing.
- **Ledger retention:** `plans/ledger/` only needs the newest `*_feature_ledger.md` and the one it directly supersedes (carrying the PREDECESSOR banner). Delete any older ones — mechanical and git-reversible, no pause-and-ask needed; just note what was deleted.

## 5. Prune merged branches — PR state, not ancestry

This repo **squash-merges**, so `git branch --merged main` misses merged feature branches (they're not ancestors). Drive the list from PRs instead:
```bash
gh pr list --state merged --json number,title,headRefName,mergeCommit
```
cross-checked against `git branch -a`. Check `gh`'s exit code and that stdout parses as valid JSON before building the candidate list; on any failure (auth/network/rate-limit), stop and report the raw error rather than treating an empty result as "nothing to prune". A branch whose functionality shipped via a *different* path (squashed elsewhere, or superseded per Step 2) is also a candidate — confirm its work is genuinely on `main` first. No PR merged from it, so the per-branch gate below will refuse it — delete it only outside that snippet, after the on-`main` spot-check and its own explicit confirmation.

**Pause-and-ask checkpoint — branch deletion:** present the exact branch list (local + remote) before deleting anything — branch deletion is recoverable (reflog / re-push from elsewhere) but a remote delete is outward-facing, same gate as a commit.

For each confirmed branch, re-verify its PR immediately before deleting — that verification plus the checkpoint above is the gate, not the local delete's exit status. `<number>` / `<branch>` are copied verbatim from the `gh pr list` result's `number` / `headRefName`. Run `git fetch origin` once first so `origin/main` is current (the Branch Guard only syncs `main` when the sweep starts there), then per branch:
```bash
read -r merged_sha head_oid < <(gh pr view <number> --json state,mergedAt,mergeCommit,headRefName,headRefOid --jq 'select(.state == "MERGED" and .mergedAt != null and .mergeCommit != null and .headRefName == "<branch>") | "\(.mergeCommit.oid) \(.headRefOid)"')   # both empty unless the PR really merged from this branch
if [[ -n "$merged_sha" ]] && git merge-base --is-ancestor "$merged_sha" origin/main && git merge-base --is-ancestor "<branch>" "$head_oid"; then   # the gate: PR merged from this branch, its merge commit is on main, and the local tip has nothing beyond what the PR merged
  if git branch -D "<branch>"; then   # -D on purpose — -d judges against the branch's upstream, not main, so its verdict is not diagnostic; recoverable from the "(was <sha>)" line / reflog until gc
    if remote_tip=$(gh api "repos/4IRL/chores4irl/git/ref/heads/<branch>" --jq .object.sha 2>&1); then   # singular /ref/ = exact match; plural /refs/ prefix-matches
      if [[ "$remote_tip" != "$head_oid" ]]; then
        echo "SKIP: remote <branch> tip $remote_tip is not PR #<number>'s head — pushed to after the merge; leave the remote ref, investigate, then continue to the next branch"
      elif ! gh api -X DELETE "repos/4IRL/chores4irl/git/refs/heads/<branch>"; then   # only reached if the local delete succeeded and the remote ref was confirmed present at the PR's head
        echo "STOP: remote delete failed for <branch> — report and do not continue to the next branch"
      fi
    elif [[ "$remote_tip" == *"HTTP 404"* ]]; then
      echo "remote ref for <branch> already gone — skipping DELETE (benign no-op)"
    else   # 403/5xx/rate-limit/network — not a 404, so not evidence the ref is gone
      echo "STOP: existence check failed for <branch> — $remote_tip"
    fi
  else
    echo "SKIP: local delete failed for <branch> — no remote action; investigate, then continue to the next branch"
  fi
else
  echo "SKIP: could not verify <branch> (PR #<number> not merged from it, gh error, merge commit not on origin/main, or local tip beyond the PR head) — no local or remote action; continue to the next branch"
fi
```
`git branch -d` is not a merge check here: it judges merged-ness against the branch's configured upstream (`origin/<branch>`, which `/git-push` sets), not `main`, so it passes any pushed branch vacuously — and once that upstream is pruned it falls back to HEAD and refuses every squash-merged branch. Its refusal is expected for a squash-merged branch and not diagnostic, which is why the local delete is `-D`: reachable only after the PR/merge-commit/tip verification and the human confirmation. `SKIP:` leaves that branch alone (no further local or remote action) and the sweep continues with the next confirmed branch; `STOP:` halts the sweep and reports. The existence pre-check stays rather than folding into the DELETE because GitHub answers a DELETE on an already-gone ref with `HTTP 422: Reference does not exist`, not 404, which would blur the DELETE's stop rule. Never prune: the default branch, any branch whose PR has not merged or whose tip holds commits beyond what its PR merged, or a branch backing a **Live** feature / open PR.

If a pruned branch's feature still has a Status-ledger row in `plans/META-PLAN.md`, delete that row too (per its History policy) — this is what stops the next sweep from re-flagging it.

## 6. Preserve, never discard

Before deleting anything outside `tmp/`, confirm it isn't the only record of a design decision, a rejected alternative, an unresolved design question on a still-live plan (fold it into that plan's body first), or an implemented-contract a future feature depends on. When in doubt, freeze-and-archive rather than delete.

## 7. Verify end state, then summary, commit, and push

Before reporting, re-verify the sweep actually succeeded rather than trusting narrative memory of what happened:
- Re-run Step 1's tracking counts (`git ls-files plans | wc -l` / `find plans -type f | wc -l`) and confirm they reflect the relocations/deletions just made.
- Confirm Step 3's freeze header actually landed, across `plans/completed/` and `plans/abandoned/`: `find plans/completed plans/abandoned -mindepth 2 -maxdepth 2 -name '*.md' 2>/dev/null | xargs -r grep -L '^> \*\*STATUS:'` should return nothing (the `find`/`xargs -r` form tolerates either directory not existing yet, unlike a bare glob).
- Confirm Step 4's `tmp/` purge actually happened for the plans frozen this run: `find plans/completed plans/abandoned -type d -name tmp 2>/dev/null` should return nothing — a match means the purge was skipped for that dir, so delete it now (recursive on purpose: a frozen plan may nest a subfolder, and `plans/**/tmp/` keeps a leftover out of `git status`, so this `find` is the only place it surfaces).
- Confirm Step 4's ledger retention left the right files: `find plans/ledger -maxdepth 1 -name '*_feature_ledger.md' 2>/dev/null | sort` should list only the newest ledger (last line) and the one it directly supersedes — nothing older. One file is fine only if it carries no PREDECESSOR banner (a lone survivor whose banner names a now-missing newer file means Step 4 deleted the newest ledger — restore it from git). Zero matches is itself a flag: Step 4 always keeps the newest ledger, so `plans/ledger/` should never be empty (same tolerant-`find` rationale as the freeze-header check above, so a missing `plans/ledger/` surfaces here as zero matches rather than an error).
- Confirm Step 4's `.gitignore` entry landed: `grep -q 'plans/\*\*/tmp/' .gitignore` should succeed.
- Re-run Step 5's `gh pr list --state merged --json number,title,headRefName,mergeCommit` + `git branch -a` cross-check and confirm every branch confirmed for pruning is actually gone (local and remote), and no **Live** / open-PR branch was touched.
- Confirm no plan dir was left live under `plans/feature|revision|chore` that Step 2 classified as Merged/Abandoned/Superseded.

Flag any mismatch before reporting. Then report: what was frozen (with SHAs/PRs), moved, deleted (tmp/, stray dirs, old ledger files), and pruned (branches, local + remote). Then `/git-commit` on the working branch, followed by `/git-push` — runs the 8-agent review and opens/updates the PR before anything from this sweep is pushed, matching `/run-feature`'s own review-and-push gate (which `/worktree` also relies on via its hand-off to `/run-feature`). If it rejects, fix per its findings and re-push; a plans-only sweep is still exactly the kind of change that gate exists for.

## Important Notes

- Reorganizes planning docs only — never source files, never plans/implements a feature.
- Deletion is irreversible for anything not in git history — peek at any non-standard file before removing it.
- Every branch/remote deletion and the tracking decision go through `AskUserQuestion` — never assume. Step 5's local delete is `-D`, so the PR/merge-commit/tip verification plus that confirmation is the only gate — there is no `-d` refusal behind it.
