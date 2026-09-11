---
name: worktree
description: Provision (or tear down) git worktrees to run multiple independent chores4irl features from plans/META-PLAN.md in parallel — proves the chosen F-ids can't merge-conflict via a live-computed touch-set analysis plus git merge-tree, sets up one worktree + npm install per feature, and hands off to /run-feature in each. Never plans or implements a feature itself. Use when asked to parallelize features, work on multiple F-ids at once, set up worktrees, or tear down/clean up existing chores4irl worktrees. Replaces the old plans/WORKTREE-PARALLELIZE-PROMPT.md template.
argument-hint: <F-id> [<F-id>...] | teardown
---

# Worktree

Stand up one git worktree per independent feature so several `/run-feature` sessions can run at the same time without touching each other's working tree — or tear existing ones down. **This skill never plans or implements a feature itself**; each worktree still runs its own feature through `/run-feature`.

If `$ARGUMENTS` is exactly `teardown`, skip to **Teardown mode**. Otherwise treat it as a whitespace-separated list of F-ids — **Provision mode**.

## Branch Guard

Required for Provision mode only — Teardown mode doesn't require a clean `main`. Require `main` clean and synced (`git status`, `git branch --show-current`; `gmas` if behind). A dirty or non-`main` base silently poisons every worktree — stop and fix this first, don't work around it. After `gmas`, re-run `git status` and confirm the tree is clean and matches `origin/main`; on a `gmas` conflict/failure, stop and report rather than continuing.

## Provision mode

### 1. Resolve and filter the F-id set
For each F-id, read its section in `plans/META-PLAN.md`. Drop — with a one-line reason, confirmed via `AskUserQuestion` if it's not obvious from the doc — any that:
- is marked **SUPERSEDED**,
- is gated on external work not yet satisfied (e.g. current `F15`/`F11`/`F12` on pi-kiosk phases),
- **gates** another F-id still in the set (that pair is inherently serial, not parallel).

### 2. Compute touch-sets live — never reuse a cached table
For each surviving F-id, build its file touch-set from that section's "Assumed starting state" / "Expected end state" / "Test-suite deltas", then sharpen with `grep` for the named components/routes/files. **Do not assume any previously-recorded "shared surfaces" table is still accurate** — F-numbering and file layout both drift between runs; always recompute from the current codebase and the current `META-PLAN.md`.

### 3. Pairwise independence matrix
For every pair still in the set:
- **Disjoint file sets → GREEN.**
- **Same file, different region (e.g. different JSX block, different route handler) → YELLOW** — possible, needs explicit acceptance.
- **Same file, same region/symbol → RED** — do not parallelize.

When a pair shares more than one file, its overall verdict is the worst individual verdict across all of its shared files (any RED file makes the pair RED, else any YELLOW file makes it YELLOW).

If either branch in a pair already has commits, sharpen with the empirical check. Rely on `git merge-tree --write-tree`'s own exit status, not its output text (its own man page: "Do NOT attempt to guess... the conflict types from the output; check the exit status"): 0 = clean, 1 = conflict, anything else = the command itself failed.
```bash
git merge-tree --write-tree feature/<a> feature/<b> >/dev/null 2>&1; status=$?
if [ $status -eq 0 ]; then echo "clean"
elif [ $status -eq 1 ]; then echo "CONFLICT <a>/<b>"
else echo "ERROR <a>/<b>: merge-tree failed ($status)"
fi
```
A reported conflict (status 1) downgrades that pair to RED regardless of the static call. Any other non-zero status (bad ref, unpushed branch, permissions) is a tool failure, not a clean result — stop and report it rather than defaulting to "clean"; this check backs the skill's own "auditable, not asserted" safety claim.

Print the full matrix and each feature's touch-set — the independence claim must be auditable, not asserted.

**Pause-and-ask checkpoint — RED/YELLOW pairs:** any **RED** pair → stop, report it, recommend running those two serially (drop one from this batch, or abort). Any **YELLOW** pair → `AskUserQuestion`: accept the risk (proceed, flag it as needing a rebase check at merge time) or drop one of the pair. Only GREEN and accepted-YELLOW features proceed to Step 4.

### 4. Provision worktrees
For each surviving F-id, using its exact `feature/<slug>` name from META-PLAN's "Session loop" line:
```bash
git worktree add ../c4i-wt-<slug> -b feature/<slug> main   # new branch
# or, if the branch already exists (e.g. a resumed feature):
git worktree add ../c4i-wt-<slug> feature/<slug>
```
Then, in each worktree: `npm install` (node_modules is per-worktree, not shared), and confirm it's on the right branch and clean. If either check fails for a worktree (failed `npm install`, wrong branch, dirty tree), stop and report that specific worktree as unusable — don't include it in Step 5's dispatch.

### 5. Dispatch
**Pause-and-ask checkpoint — dispatch mode:**
- **Mode A — hand-off (default).** Print, per worktree, the exact kickoff:
  ```
  cd ../c4i-wt-<slug> && claude
  # then paste:
  /run-feature <F-id>
  ```
- **Mode B — subagent fan-out.** Only if the user explicitly wants this session to drive it: spawn one background subagent per worktree, each instructed to `cd` into its worktree and run `/run-feature <F-id>` end-to-end, then report its PR link. Note the cost (N concurrent plan/implement/push pipelines) before doing this.

### 6. Summary
Report: the pairwise matrix + touch-sets, any excluded F-ids with reasons, the worktree map (F-id → path → branch), and the merge-order reminder:
- Merge the resulting PRs **one at a time** through the normal review + CI gate — implementation is parallel, merging stays serial.
- After each merge, remaining worktree branches should `git fetch && git rebase origin/main` and re-run their suites; re-run the Step 3 `merge-tree` check between any two not-yet-merged branches if either rebased.
- Each feature's PR edits only its own Status-ledger row — if two PRs both touch the ledger, git may flag it at merge; that's a one-line "keep both rows" resolution, not a real conflict.

## Teardown mode

### 1. List existing worktrees
`git worktree list` — every `../c4i-wt-*` entry.

### 2. Check each branch's PR state
For each, check its branch's PR state (`gh pr list --head <branch> --state all`). Candidates to remove: PR merged, or the user names it abandoned. If the `gh` call fails for a branch, record its PR state as `UNKNOWN (gh error)` rather than leaving it blank or omitting the row.

### 3. Confirm the removal list
**Pause-and-ask checkpoint — teardown confirmation:** present the exact list (worktree path, branch, PR state — including any `UNKNOWN (gh error)` rows) via `AskUserQuestion` before removing anything.

### 4. Remove confirmed worktrees and branches
For each confirmed entry:
```bash
git worktree remove ../c4i-wt-<slug>   # refuses if dirty — resolve first, don't force
```
Then, per that entry's Step 2 classification — never run both:
- **Merged** → `git branch -d feature/<slug>` — refuses if it isn't actually merged; if it refuses here, stop and investigate, don't force past it.
- **User-confirmed abandoned (never merged)** → `git branch -D feature/<slug>` — only for an entry the user explicitly confirmed as abandoned in Step 3's `AskUserQuestion`.

### 5. Prune stale admin entries
`git worktree prune` to clean up stale admin entries.

Never `rm -rf` a worktree directory by hand — always go through `git worktree remove` so git's bookkeeping stays consistent.

## Important Notes

- Provision only from a clean, synced `main`.
- Never worktree a RED pair together — say so and stop.
- Worktrees live as siblings of the repo (`../c4i-wt-*`), never nested inside it.
- The merge gate stays human and serial regardless of how much implementation ran in parallel.
