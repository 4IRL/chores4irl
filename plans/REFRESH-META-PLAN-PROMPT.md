# Task: Reconcile META-PLAN.md with the latest backlog + true main-branch state

> Reusable prompt template. Fill in the two `<...>` date placeholders, and one `<...>` critical feature placeholder below, paste
> the body into a fresh Claude Code session, and run. This file is the *instructions*,
> not a backlog — do not plan features from it.

Refresh `plans/META-PLAN.md` so its baseline and ledger match the *actual* current state of `main`, then reconcile it against the newest feature list and reassess effort + dependencies. Do not start implementing any feature — this is a planning-document reconciliation only.

## Inputs
- **Current backlog (source of truth):** `plans/ledger/<LATEST_YYMMDD>_feature_ledger.md`
- **Prior backlog(s) (history only, do not plan from):** `plans/ledger/<OLDER_YYMMDD>_feature_ledger.md`
- **Orchestration manifest to update:** `plans/META-PLAN.md`

## Step 1 — Establish the true baseline (verify, don't trust the ledger)
The META-PLAN ledger may be stale. Reconstruct reality from the repo, not from what the plan claims:
- `git log --oneline main` and `git branch -a` to see what actually merged.
- Read the live source for each "completed" feature and confirm the code is
  present on `main` (e.g. routes in `backend/src/app.ts`, components under
  `frontend/src/`, fields in `types/SharedTypes.d.ts`). A feature is "done" only if its code is on `main` — not because the ledger says in-review/merged.
- Flag any feature branch whose functionality already shipped on `main` as
  **superseded**; recommend deletion (local + remote) and call it out — don't silently queue it.

## Step 2 — Diff the backlogs
Compare the latest list against the prior one(s):
- **Removed** items → features that shipped; move them to Completed in the ledger.
- **Added** items → new features; assign the next F-ID (never renumber existing IDs — the F-numbering is an audit trail).
- **Changed** items → note any spec shifts that alter effort (e.g. "native
  `<datalist>` is acceptable" lowering a form feature from M→S).

## Step 3 — Reassess effort + dependencies against current main
- Re-score each remaining feature on the S=1 / M=2 / L=3 / XL=5 scale, justified by the *current* codebase (not the original estimate).
- Recompute dependencies. State whether a hard critical path still exists or the remaining work is a flat backlog with soft ordering conventions only. Separate frontend-track from infra-track work if they're independent.
- Preserve any recorded "implemented contract" blocks for merged features —
  later features depend on those interfaces.

## Step 4 — Recommend shortest, critical path to most-desired feature
- The primary focus feature is `<insert_critical_feature_name>`. Using the dependencies and assessed effort, recommend the shortest path of sequentially implemented features to arrive at integration of the critical feature.
- Minimize churn (e.g. adding features that will later be superseded) through the critical path.

## Output (update `plans/META-PLAN.md`)
1. **Baseline** section rewritten to describe main as it actually is now.
2. **Summary table** split into Completed (with merge SHAs) + Remaining
   (reassessed effort/deps).
3. **Status ledger** reconciled to git reality.
4. New **per-feature sections** for added features; **superseded** markers for retired branches.
5. Updated **dependency/chain diagram** to critical feature.

Also add a one-line "PREDECESSOR — superseded by `<LATEST>`" banner to the top of any older backlog file so it can't be planned from by mistake.

## Constraints
- Verify the current branch is `main` before reading baseline; never plan from a predecessor list. Per-feature implementation runs in its own dedicated session per the manifest contract — this task only updates planning docs.