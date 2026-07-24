# Task: Compact the plans/ archive — keep intent + outcome, drop the rot

> Reusable prompt template. Paste the body below into a fresh Claude Code session
> and run periodically (e.g. after every 1-2 features merge). This file is the
> *instructions*, not a backlog — do not plan features from it.

Sweep `plans/` and bring it back to a clean state: live work in `plans/feature/`,
finished work frozen in `plans/completed/` (or `plans/abandoned/`), and no
regenerable scratch lying around. Preserve the *durable* signal — feature intent,
why decisions were made, implemented interface contracts, and why anything was
dropped. Discard the *ephemeral* — step-by-step checklists go stale and git
already records what actually changed.

## Guiding principle
A plan is only "stale" when it **claims to be current but isn't**. The fix is
labeling, not deletion: freeze finished plans with an outcome header and move them
out of the live folder. Never edit a finished plan to keep it accurate — git +
`META-PLAN.md` carry current truth; the archive carries history.

## Step 0 — Check tracking reality first
Run `git ls-files plans | wc -l` vs `find plans -type f | wc -l`. If `plans/` is
mostly untracked (it has been before), most operations are plain-filesystem, not
`git mv` — and flag the tracking gap to the user (see "Tracking decision" below).
A single stray tracked file amid an untracked folder is usually an accidental
`git add` — call it out.

## Step 1 — Classify every plan against git reality
For each feature/plan dir, determine true status from the repo, not the doc:
- **Merged** → code is on `main`. Find the merge SHA (`git log --oneline -i
  --grep="<feature>"`).
- **Abandoned** → not on main, no longer in the current backlog
  (`plans/ledger/<LATEST>_feature_ledger.md`), no active branch.
- **Superseded** → its functionality shipped via a different path, OR a newer
  backlog item reverses/replaces its decisions.
- **Live** → still in the current backlog or on an active branch. Leave it,
  including its `tmp/` scratch — it's not stale yet.

## Step 2 — Freeze + relocate finished plans
For each Merged / Abandoned / Superseded plan:
1. Prepend a freeze header to the plan's main `.md` (do NOT rewrite the body):
   ```markdown
   > **STATUS: Merged** `<SHA>` (#<PR>). Frozen — historical record, do not edit.
   > **Outcome:** <1-4 lines: what shipped, any deviation from plan + why, and any
   > interface contract later features depend on. Note if a later item supersedes it.>
   ```
   Use `STATUS: Abandoned — <reason>` or `STATUS: Superseded by <X>` as appropriate.
   The single most valuable line is *why* it was dropped/changed — that's what git
   can't tell a future session.
2. **Harvest open findings into the central ledger** — before/while archiving,
   open the dir's `reviews/push-review-*.md`, copy every still-open `- [ ]` item
   from its "To-Do: Required Changes" into `plans/PUSH-REVIEW-FINDINGS.md` under a
   per-feature section (theme tag + severity + link back to the source). This keeps
   the deferred-findings backlog visible instead of buried per-folder. Skip items
   already in the ledger. If a finding's blocking dependency has since merged, flag
   it as now-decidable rather than "future."
3. Move the whole dir into `plans/completed/` (or `plans/abandoned/`) with `git mv`
   if tracked, plain `mv` if not. Keep `reviews/` (it's the frozen rationale behind
   the ledger entries); the folder location now signals status at a glance.

## Step 3 — Purge regenerable scratch
- Delete `tmp/` dirs belonging to finished plans (plan-reviewer / push-review
  dimension files: correctness.md, completeness.md, etc. — regenerated every run).
- Leave `tmp/` for **live** plans untouched.
- Ensure `.gitignore` contains `plans/**/tmp/` so scratch can never be committed.

## Step 4 — Prune merged feature branches
The archive isn't the only thing that accumulates rot — **merged branches linger too**.
After a feature's plan is frozen and relocated, its branch is dead weight.
1. **Find merged branches by PR state, not ancestry.** This repo **squash-merges**, so a
   merged branch is *not* an ancestor of `main` — `git branch --merged main` will miss it
   (it typically shows only `main`). Drive the list from PRs instead:
   `gh pr list --state merged --json number,title,headRefName,mergeCommit`, cross-checked
   against `git branch -a`. (Per META-PLAN's history policy, 2026-07-24, the Status ledger
   holds only *unmerged* work — merged rows are deleted, so there are no `merged`/`(prune)`
   ledger rows to cross-check; git/`gh` are the sole authority on what merged.)
2. **Prune only truly-merged branches** — local and remote:
   `git branch -d <branch>` (use `-d`, never `-D`, so git refuses to drop anything not
   actually merged/captured) and `git push origin --delete <branch>`. A branch whose
   functionality shipped via a *different* path (squashed into another PR, or **superseded**)
   is also safe to prune — confirm its work is genuinely on `main` first.
3. **Never prune:** the default branch; any branch with **unmerged commits**; a branch for a
   **live** backlog feature or an open PR. When `-d` refuses, stop and investigate rather than
   forcing `-D`.
4. **Confirm before deleting** (especially remote deletes) — list the exact branches you intend
   to prune and get the user's go-ahead, same gate as committing. Branch deletion is recoverable
   (reflog locally, re-push from a teammate's copy remotely) but treat remote deletes as
   outward-facing.
5. Record the pruned branches in the run summary. If any pruned branch's feature still has a
   Status-ledger row (i.e. it merged but the row wasn't yet deleted), delete that row per
   META-PLAN's history policy — that is what prevents the next sweep from re-flagging it.

## Step 5 — Preserve, never discard
Before deleting anything non-`tmp/`, confirm it isn't the only record of:
- a design decision or rejected alternative,
- an unresolved design question on a live plan (fold it into the plan body first),
- an "implemented contract" a future feature depends on.
When in doubt, freeze-and-archive rather than delete.

## Output
- `plans/feature/` contains only live work + the current backlog list(s).
- `plans/completed/` (and/or `plans/abandoned/`) holds frozen, headered records.
- All deferred minor findings harvested into `plans/PUSH-REVIEW-FINDINGS.md`.
- No `tmp/` scratch for finished plans; `plans/**/tmp/` is gitignored.
- No lingering merged branches (local or remote); any Status-ledger row for a pruned
  branch's feature deleted per META-PLAN's history policy.
- A short summary to the user: what was frozen (with SHAs), moved, deleted, and pruned.

## Tracking decision (raise once, then respect the answer)
If `plans/` is currently untracked, ask the user whether to (a) start committing
the archive so the history is shared/backed-up on GitHub, or (b) keep it local-only
and gitignore `plans/`. Frozen, compacted plans are cheap and high-signal, so (a)
is usually right — but it's the user's call. Don't commit `plans/` without an
explicit yes.

## Constraints
- Do not implement or re-plan features — this task only reorganizes planning docs.
- Deletion is irreversible: peek at any non-standard file before removing it.
- Confirm the working branch with the user before committing anything.
