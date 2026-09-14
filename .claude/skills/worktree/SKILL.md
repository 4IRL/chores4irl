---
name: worktree
description: Provision (or tear down) git worktrees to run multiple independent chores4irl features from plans/META-PLAN.md in parallel — proves the chosen F-IDs can't merge-conflict via a live-computed touch-set analysis plus git merge-tree, sets up one worktree + npm install per feature, and hands off to /run-feature in each. Never plans or implements a feature itself. Use when asked to parallelize features, work on multiple F-IDs at once, set up worktrees, or tear down/clean up existing chores4irl worktrees. Replaces the old plans/WORKTREE-PARALLELIZE-PROMPT.md template.
argument-hint: <F-ID> [<F-ID>...] | teardown
---

# Worktree

Stand up one git worktree per independent feature so several `/run-feature` sessions can run at the same time without touching each other's working tree — or tear existing ones down. **This skill never plans or implements a feature itself**; each worktree still runs its own feature through `/run-feature`.

If `$ARGUMENTS` is exactly `teardown`, skip to **Teardown mode**. Otherwise treat it as a whitespace-separated list of F-IDs — **Provision mode**.

## Branch Guard

Required for Provision mode only — Teardown mode doesn't require a clean `main`. Require `main` clean (`git status`, `git branch --show-current`) and synced (`gmas` if behind; verify with `git status` that the tree is clean and matches `origin/main`; stop and report on any `gmas` conflict/failure). A dirty or non-`main` base silently poisons every worktree — stop and fix this first, don't work around it.

## Provision mode

### 1. Resolve and filter the F-ID set

For each F-ID, read its section in `plans/META-PLAN.md`. Drop — with a one-line reason, confirmed via `AskUserQuestion` if it's not obvious from the doc — any that:
- is marked **SUPERSEDED**,
- is gated on external work not yet satisfied (e.g. current `F15`/`F11`/`F12` on pi-kiosk phases),
- **gates** another F-ID still in the set (that pair is inherently serial, not parallel).

### 2. Compute touch-sets live — never reuse a cached table

For each surviving F-ID, build its file touch-set from that section's "Assumed starting state" / "Expected end state" / "Test-suite deltas", then sharpen with `grep` for the named components/routes/files. **Do not assume any previously-recorded "shared surfaces" table is still accurate** — F-numbering and file layout both drift between runs; always recompute from the current codebase and the current `META-PLAN.md`.

### 3. Pairwise independence matrix

For every pair still in the set:
- **Disjoint file sets → GREEN.**
- **Same file, different region (e.g. different JSX block, different route handler) → YELLOW** — possible, needs explicit acceptance.
- **Same file, same region/symbol → RED** — do not parallelize.

When a pair shares more than one file, its overall verdict is the worst individual verdict across all of its shared files (any RED file makes the pair RED, else any YELLOW file makes it YELLOW).

If either branch in a pair already has commits, sharpen with the empirical check. Rely on `git merge-tree --write-tree`'s own exit status, not its output text (its own man page: "Do NOT attempt to guess... the conflict types from the output; check the exit status"): 0 = clean, 1 = conflict, anything else = the command itself failed.
```bash
git merge-tree --write-tree feature/<a> feature/<b> >/dev/null 2>&1; status=$?
if [[ $status -eq 0 ]]; then echo "clean"
elif [[ $status -eq 1 ]]; then echo "CONFLICT <a>/<b>"
else echo "ERROR <a>/<b>: merge-tree failed ($status)"
fi
```
A reported conflict (status 1) downgrades that pair to RED regardless of the static call. Any other non-zero status (bad ref, unpushed branch, permissions) is a tool failure, not a clean result — stop and report it rather than defaulting to "clean"; this check backs the skill's own "auditable, not asserted" safety claim.

Print the full matrix and each feature's touch-set — the independence claim must be auditable, not asserted.

**Pause-and-ask checkpoint — RED/YELLOW pairs:** any **RED** pair → stop, report it, recommend running those two serially (drop one from this batch, or abort). Any **YELLOW** pair → `AskUserQuestion`: accept the risk (proceed, flag it as needing a rebase check at merge time) or drop one of the pair. Only GREEN and accepted-YELLOW features proceed to Step 4.

### 4. Provision worktrees

Every write into `../c4i-wt-<slug>` in this step — the `git worktree add` below, the two `ln -s` calls, and the in-worktree `npm install` — must run with `dangerouslyDisableSandbox: true` on that specific Bash call: the worktree is a sibling of the repo, outside the project's sandbox `filesystem.allowWrite`, so under the default sandbox each of them fails with `Read-only file system` — a sandbox denial, not one of the per-F-ID causes named after the snippet.

For each surviving F-ID, using its exact `feature/<slug>` name from META-PLAN's "Session loop" line:
```bash
if git rev-parse --verify --quiet refs/heads/feature/<slug> >/dev/null; then   # the branch already exists: a resumed feature — or a -b run below that failed on the path check, which still creates the branch
  git worktree add ../c4i-wt-<slug> feature/<slug>
else
  git worktree add ../c4i-wt-<slug> -b feature/<slug> main   # new branch
fi
```
Check `git worktree add`'s own exit status — it fails when `../c4i-wt-<slug>` already exists and isn't empty (e.g. left behind by an aborted run) or when `feature/<slug>` is already checked out in another worktree. If it fails, stop and report that F-ID as unusable, with git's error — don't include it in Step 5's dispatch, and don't proceed to the `.claude/` symlinks, `npm install`, or the per-worktree checks below for it; never `rm -rf` the leftover or `--force` the add to get past it (git's own error may suggest `add -f`) — a leftover that `git worktree list` still shows is Teardown mode's job.

Then provision the untracked `.claude/` config. A worktree materializes tracked files only, and `.gitignore`'s `.claude/*` keeps `.claude/skill-config.md` and `.claude/settings.json` untracked — so the fresh worktree's `.claude/` holds the tracked `.claude/skills/` and nothing else, and `/run-feature` → `/git-push` would `exit 1` on the missing `repo:` field (and `/plan-creator` silently lose `topic_inference`) only after the whole plan/implement/commit pipeline had already run. Symlink exactly those two files out of the main checkout (symlinks, not copies, so edits in the main checkout stay in sync — and they're write-through, so edit these two files only there, never from inside a worktree); `.claude/` already exists, so no `mkdir -p` is needed, and a failed `ln -s` surfaces at the `test -f` check below:
```bash
main_root="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"   # the main checkout, from any cwd — --show-toplevel would return the worktree if run inside one
ln -s "$main_root/.claude/skill-config.md" ../c4i-wt-<slug>/.claude/skill-config.md
ln -s "$main_root/.claude/settings.json" ../c4i-wt-<slug>/.claude/settings.json   # the project's sandbox scope — its network allowlist is what lets the worktree's own /run-feature session's npm install and gh reach out (Step 5 Mode A)
```
**Never** copy or symlink the whole `.claude/` directory — it holds `c4i-app.pem` and `generate-gh-c4i-token.sh`.

Then, in each worktree: `npm install` (node_modules is per-worktree, not shared), and confirm it's on the right branch, clean, and has its config — `test -f ../c4i-wt-<slug>/.claude/skill-config.md && test -f ../c4i-wt-<slug>/.claude/settings.json` (`-f` follows symlinks, so a dangling link fails it; the symlinks themselves are gitignored and don't dirty the tree). If any of these checks fails for a worktree (failed `npm install`, wrong branch, dirty tree, missing `.claude/skill-config.md` or `.claude/settings.json`), stop and report that specific worktree as unusable — don't include it in Step 5's dispatch.

### 5. Dispatch

**Pause-and-ask checkpoint — dispatch mode:** ask the user whether this session should hand each worktree off for them to drive, or fan out subagents to run them itself, then follow the chosen mode:
- **Mode A — hand-off (default).** Print, per worktree, the exact kickoff:
  ```
  cd ../c4i-wt-<slug> && claude
  # then paste:
  /run-feature <F-ID>
  ```
- **Mode B — subagent fan-out.** Only if the user explicitly wants this session to drive it: spawn one background subagent per worktree, each instructed to `cd` into its worktree and run `/run-feature <F-ID>` end-to-end, then report its PR link. Note the cost (N concurrent plan/implement/push pipelines) before doing this. Their smoke runs will overlap by design — tell each subagent to follow `/run-feature` Phase A step 8's worktree rule (`CI=1`; on `… is already used …`, bounded wait-and-retry, then stop and report) rather than skip or work around it.

### 6. Summary

Report: the pairwise matrix + touch-sets, any excluded F-IDs with reasons, the worktree map (F-ID → path → branch), and the merge-order reminder:
- Merge the resulting PRs **one at a time** through the normal review + CI gate — implementation is parallel, merging stays serial.
- After each merge, remaining worktree branches should `git fetch && git rebase origin/main` and re-run their suites (the smoke spec with `CI=1`, per `/run-feature` Phase A step 8's worktree rule); re-run the Step 3 `merge-tree` check between any two not-yet-merged branches if either rebased.
- Each feature's PR edits only its own Status-ledger row — if two PRs both touch the ledger, git may flag it at merge; that's a one-line "keep both rows" resolution, not a real conflict.

## Teardown mode

### 1. List existing worktrees

`git worktree list` — every `../c4i-wt-*` entry.

### 2. Check each branch's PR state

For each, check its branch's PR state (`gh pr list --head <branch> --state all`) and record the PR number alongside the state (the merged PR's, if the branch has several — Step 4's gate re-verifies that number). Candidates to remove: PR merged, or the user names it abandoned. If the `gh` call fails for a branch, record its PR state as `UNKNOWN (gh error)` rather than leaving it blank or omitting the row.

### 3. Confirm the removal list

**Pause-and-ask checkpoint — teardown confirmation:** present the exact list (worktree path, branch, PR state and number — including any `UNKNOWN (gh error)` rows) via `AskUserQuestion` before removing anything.

### 4. Remove confirmed worktrees and branches

If any confirmed entry is **Merged**, run `git fetch origin` once first so `origin/main` is current (Teardown mode doesn't sync `main`), and check that it succeeded — the Merged gate below trusts `origin/main`, and in this repo `origin` is SSH, which fails with `Permission denied (publickey)` from the Bash tool's non-interactive shell, so an unchecked fetch failure is the expected outcome here and would give every Merged entry whose PR landed since the last good fetch a false "merge commit … is not on origin/main" `SKIP:`:
```bash
git fetch origin || { echo "STOP: git fetch origin failed — origin/main may be stale; fix the fetch (likely no SSH agent in this shell — run it from a terminal, or fetch +refs/heads/main:refs/remotes/origin/main via the HTTPS+token form /git-push Step 1 uses) before removing anything"; }
```
On that `STOP:` the per-entry loop must not start — halt Teardown and report it; nothing below runs until `origin/main` has actually been fetched by one of those routes.

Then, for each confirmed entry in turn, pass the gate matching its Step 2 classification before removing anything — `git branch -D` is the only force-delete in this skill, reachable solely through one of these gates (each already behind Step 3's confirmation):
- **Merged** → re-verify the PR; `<number>` is the PR number Step 2 recorded:
  ```bash
  if ! pr_json=$(gh pr view <number> --json state,mergedAt,mergeCommit,headRefName,headRefOid 2>&1); then   # the call itself failed (auth/rate-limit/network) — a STOP, not a SKIP: an empty read below could not tell that apart from "not merged"
    echo "STOP: gh pr view #<number> failed — $pr_json"   # halt Teardown here; nothing below runs for this or any later confirmed entry
  elif ! pr_match=$(jq -r --arg b 'feature/<slug>' 'select(.state == "MERGED" and .mergedAt != null and .mergeCommit != null and .headRefName == $b) | "\(.mergeCommit.oid) \(.headRefOid)"' <<<"$pr_json" 2>&1); then   # jq missing, or gh's stdout wasn't JSON — a STOP for the same reason; --arg hands the name to jq as data rather than program text, and it stays single-quoted so the shell doesn't expand it either
    echo "STOP: could not parse gh pr view #<number>'s output — $pr_match"
  else
    read -r merged_sha head_oid <<<"$pr_match"   # both empty unless the PR really merged from this branch
    if [[ -z "$merged_sha" ]]; then
      echo "SKIP: no merged PR from feature/<slug> (PR #<number> is not MERGED from it) — leave its worktree and branch in place, report it under Step 6's \"left in place\", and continue to the next confirmed entry"
    elif ! git merge-base --is-ancestor "$merged_sha" origin/main; then
      echo "SKIP: PR #<number>'s merge commit $merged_sha is not on origin/main — leave its worktree and branch in place, report it under Step 6's \"left in place\", and continue to the next confirmed entry"
    elif ! git rev-parse --verify --quiet "refs/heads/feature/<slug>" >/dev/null; then   # checked first because merge-base exits 128 (not 1) on a missing ref, which the tip check below would misreport
      echo "SKIP: no local feature/<slug> to compare against PR #<number>'s head — leave its worktree and branch in place, report it under Step 6's \"left in place\", and continue to the next confirmed entry"
    elif ! git merge-base --is-ancestor "feature/<slug>" "$head_oid"; then
      echo "SKIP: local feature/<slug> tip is beyond PR #<number>'s head $head_oid — leave its worktree and branch in place, report it under Step 6's \"left in place\", and continue to the next confirmed entry"
    else   # the gate passed — the only path to the -D below
      echo "VERIFIED: PR #<number> merged from feature/<slug> — proceed to remove it"
    fi
  fi
  ```
- **User-confirmed abandoned (never merged)** → no PR check; the gate is the user having explicitly named it abandoned in Step 3's `AskUserQuestion`.
- **Neither** (PR open, closed-unmerged, or `UNKNOWN (gh error)`, and not explicitly named abandoned) → no gate matches; leave its worktree and branch in place, report it under Step 6's "left in place", and continue.

Then, once that entry's gate passed, run this removal with `dangerouslyDisableSandbox: true` on that specific Bash call on the *first* attempt — never probe it sandboxed first — because a sandboxed `git worktree remove` fails to delete `../c4i-wt-<slug>` (outside the project's sandbox `filesystem.allowWrite`, so `Read-only file system`) yet still deletes its `.git/worktrees/<id>` admin entry (git continues on error and removes the admin dir anyway), leaving an unregistered directory on disk that `git worktree list` no longer shows, that a flagged retry rejects with "is not a working tree", and that this skill's never-`rm -rf` rule can't recover — unlike Provision Step 4's `add`, which fails cleanly under the sandbox apart from the `-b` branch its `git rev-parse` pre-check already handles. If that has already happened, don't retry it or `rm -rf` it — report it under Step 6's "left in place" as needing the user's manual cleanup (the `SKIP:` branch's "leave its worktree and branch in place" no longer describes the state):
```bash
if git worktree remove ../c4i-wt-<slug>; then   # refuses if dirty (modified or untracked files) or locked
  if ! git branch -D "feature/<slug>"; then   # -D on purpose — see below
    echo "SKIP: local delete failed for feature/<slug> after its worktree was removed — the branch is left behind unless git's error says it was not found; report the branch, its former worktree path, and git's error under Step 6's \"left in place\", and continue to the next confirmed entry"
  fi
else   # never --force it (-f or -f -f), unlock it, stash, or discard/delete its files to make it succeed
  echo "SKIP: git worktree remove refused for ../c4i-wt-<slug> (feature/<slug>) — leave its worktree and branch in place, report the path and git's error under Step 6's \"left in place\", and continue to the next confirmed entry"
fi
```

`git branch -d` is not a merge check here: it judges merged-ness against the branch's configured upstream (`origin/feature/<slug>`, which `/run-feature`'s `/git-push` sets), not `main`, so it would pass an unmerged pushed branch vacuously — and once that upstream is pruned it falls back to HEAD and refuses every squash-merged branch. Its refusal is expected for a squash-merged branch and not diagnostic, which is why the local delete is `-D` on both paths.

### 5. Prune stale admin entries

`git worktree prune` to clean up stale admin entries.

Never `rm -rf` a worktree directory by hand — always go through `git worktree remove` so git's bookkeeping stays consistent.

### 6. Verify end state

Before reporting, re-verify the teardown removed exactly what Step 3 confirmed — nothing less, nothing more — rather than trusting narrative memory of what happened. This matters because Step 4's local delete is `-D` on both paths — nothing behind the PR verification or the user's abandoned confirmation would have refused a wrong deletion:
- Re-run `git worktree list`: no confirmed `../c4i-wt-<slug>` path should remain (and `test -d <path>` should now fail for each confirmed entry, using the absolute path Step 1's listing printed — not a relative `../c4i-wt-*` glob, which silently returns empty from the wrong cwd), and every entry from Step 1's listing that was *not* confirmed in Step 3 (plus the main checkout itself) should still be present. Exception: an entry Step 1 listed as `prunable` disappears at Step 5 whether or not it was confirmed — report it as pruned-stale, not as a mismatch.
- Run `git branch -a`: the local `feature/<slug>` branch of every confirmed entry should be gone, and the branch of every unconfirmed entry should still be listed. A lingering `remotes/origin/feature/<slug>` for any removed entry — merged or abandoned — is expected, not a mismatch: teardown never deletes remote refs (merged ones are `/compact-plans` Step 5's job).

Flag any mismatch before reporting — either case means stop and tell the user; never re-run Step 4 with `git worktree remove --force`, or with its Merged gate skipped, to make the verification pass. A confirmed entry still present means Step 4 didn't actually remove it (its gate SKIPped, its `git worktree remove` refused and SKIPped, or the entry was otherwise skipped) — report it under "left in place" with the reason, not as a clean removal. A confirmed entry whose worktree is gone but whose local `feature/<slug>` is still listed is Step 4's `git branch -D` SKIP (path gone, branch left behind) — report the branch under "left in place" with git's error, likewise not as a clean removal. An unconfirmed entry missing means something outside the list was touched; a deleted local branch is recoverable until gc from the `(was <sha>)` line that `git branch -D` printed, and its reflog is gone once the worktree is pruned. Then report: each removed entry (path → branch → PR state → which gate admitted the `-D` — PR-verified merged or user-confirmed abandoned — with the `(was <sha>)` it printed), and any entries deliberately left in place.

## Important Notes

- Provision only from a clean, synced `main`.
- Never worktree a RED pair together — say so and stop.
- Worktrees live as siblings of the repo (`../c4i-wt-*`), never nested inside it.
- A worktree's `.claude/skill-config.md` and `.claude/settings.json` are the symlinks Step 4 creates, not tracked files — without the first, every worktree-driven `/run-feature` hard-fails at `/git-push`; without the second, the sandbox has no network allowlist for `npm install` and `gh`. Don't drop that step, and never widen it to the whole `.claude/` directory (Step 4 names what that would leak).
- The only Bash calls here that need `dangerouslyDisableSandbox: true` are the ones that write into `../c4i-wt-<slug>` — Provision Step 4's `git worktree add`, its two `ln -s` calls, and its in-worktree `npm install`, plus Teardown Step 4's `git worktree remove` — because the worktree is a sibling of the repo, outside the project's sandbox `filesystem.allowWrite` (`/home/rmila/Code/chores4irl` + `/tmp`); that per-call flag is the form the global `~/.claude/CLAUDE.md` prescribes, not a wider `allowWrite` in `.claude/settings.json`. The `git rev-parse` and `git branch -D` calls inside those snippets touch only the repo (or nothing) and need no flag of their own — they ride along under the flag of the call they share; don't split a snippet to sandbox them separately. Every other command (e.g. `git worktree list`, `git merge-tree`, `gh pr view`, `git fetch origin`, `test -f`, `git worktree prune`) writes only inside the repo or not at all and stays sandboxed. Step 5 Mode A's hand-off (`cd ../c4i-wt-<slug> && claude`) is unaffected — a fresh session's own cwd is allow-written by the harness. Mode B's subagents, by contrast, inherit this session's sandbox (cwd allowlist = the main repo), so every in-worktree write `/run-feature` makes there (the Vitest suites, the smoke spec, …) needs the same per-call flag on each such Bash call — a further reason Mode A is the default.
- The merge gate stays human and serial regardless of how much implementation ran in parallel.
