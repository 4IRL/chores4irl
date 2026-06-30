# Task: Parallelize independent META-PLAN features across git worktrees

> Reusable prompt template. Set `FEATURES` below to the F-IDs you want to run
> concurrently, paste the body into a fresh Claude Code session, and run. This
> file is the *dispatcher's instructions* — it sets up isolated worktrees and
> verifies the chosen features cannot merge-conflict. It does **not** itself plan
> or implement a feature; each feature still runs its own **Per-Feature Session
> Contract** (see `META-PLAN.md`) inside its own worktree.

```
FEATURES = <comma-separated F-IDs, e.g. F10, F7, F8>
```

Read `plans/META-PLAN.md`. For the F-IDs in `FEATURES`, prove they are **mutually
independent** (their feature branches cannot textually merge-conflict), then stand
up one **git worktree per feature** so each can run its full session contract in
parallel without touching the others' working tree. **Do not implement any feature
in this session** — this session validates independence and provisions worktrees.

## Why worktrees (and the model this preserves)

The existing model is **one fresh session per feature**, each ending at a pushed PR,
with a **human merge gate** (main is branch-protected). Worktrees don't change that
contract — they let several of those sessions run **at the same time** on the **same
clone** without stepping on each other:

- Each worktree is a separate working directory backed by the shared `.git`. A
  `feature/*` branch can be checked out in **only one** worktree at a time, so the
  branches stay isolated by construction.
- The merge gate stays serial: features are *implemented* concurrently but *merged*
  one PR at a time (see **Step 5 — merge order**). Parallelism buys implementation
  wall-clock, not a way around branch protection.

## Step 0 — Resolve the feature set and reject the obviously-coupled

1. Confirm the current branch is `main` and the tree is clean (`git status`,
   `git branch --show-current`). Worktrees branch from `main`; provisioning from a
   dirty/elsewhere checkout is the most common foot-gun.
2. Expand each F-ID to its `{branch, plan dir, declared file surface}` from the
   feature's section in `META-PLAN.md` (its "Assumed starting state" + "Expected
   end state" name the files it reads/writes; the **Chain integrity** and
   **cross-feature couplings** sections name the known shared surfaces).
3. Drop, with a one-line reason, any F-ID that is **already disqualified** by the
   plan's recorded dependencies — e.g. a feature that *gates* another in the set
   (F11 gates F12–F17), or a soft-ordered pair that both edit one file (F3 & F1
   both edit `ChoreForm`). These are **serial, not parallel** — tell the user and
   exclude them rather than worktree them together.

## Step 1 — Prove pairwise independence (the merge-conflict check)

For every **pair** of features still in the set, decide GREEN / YELLOW / RED:

**A. Predicted file-surface disjointness (static, before any code is written).**
Build each feature's touch-set from its META-PLAN section, then sharpen it against
live code — don't trust the doc blindly:
- `grep`/read to confirm which exact files each feature must edit (the component,
  its test, shared types, backend route, `db.ts`, e2e spec, deploy docs).
- Intersect the touch-sets pairwise:
  - **Disjoint files ⇒ GREEN.** Safe to parallelize; branches cannot conflict.
  - **Same file, demonstrably different regions ⇒ YELLOW.** Possible (e.g. two
    features edit `App.tsx` but one the footer JSX and one the filter pipeline),
    but it needs the empirical check in **B** before/at merge and a rebase plan.
  - **Same file, same region / shared symbol ⇒ RED.** Do **not** parallelize;
    serialize them and say so.

  Known shared surfaces in this repo (verify, then use as priors):
  | Surface | Features that touch it |
  |---|---|
  | `frontend/src/App.tsx` (filter pipeline / footer / panel mount) | F9, F7, F11, + SSE baseline |
  | `frontend/src/components/form/ChoreForm.tsx` | F3, F1 |
  | `frontend/src/components/chore/ChoreTimerBar.tsx` | F10 (only) |
  | `frontend/src/components/nav/NavBar.tsx` | F11 |
  | `backend/src/app.ts` (new endpoints) | F1, F17, F12, F13, F14 |
  | `backend/src/db.ts` / schema+seed | F1 |
  | `e2e/smoke.spec.ts` | F1, F10, (any flow-changing feature) |
  | deploy docs in each feature's own `plans/feature/<slug>/` dir (frozen Dockerization plan at `plans/completed/docker-raspberry-pi/`) | F8, F17, F12, F13, F14 |

  Fully-disjoint examples worth parallelizing: **{F10, F8}**, **{F10, F7}**,
  **{F9, F10}**, **{F8, anything frontend}**. Classic RED: **{F3, F1}** (both
  `ChoreForm`). Classic YELLOW: **{F9, F7}** (both `App.tsx`, different regions).

**B. Empirical merge check (objective; run whenever branches already have commits).**
The static check predicts; this *proves*. Once two branches each carry commits
(i.e. at merge time, or if you re-run this prompt mid-flight), trial-merge them
without touching the working tree:
```
# conflicts between two feature branches, no checkout, no commit:
git merge-tree --write-tree feature/<a> feature/<b> | grep -q "^CONFLICT" \
  && echo "CONFLICT between <a> and <b>" || echo "clean"
```
Any reported conflict downgrades the pair to RED regardless of what the static
analysis said. (`git merge-tree --write-tree` is the modern, side-effect-free form;
on older git, fall back to a throwaway `git merge --no-commit --no-ff` in a scratch
worktree and abort.)

**Verdict.** Only **GREEN** (and **YELLOW** the user explicitly accepts) features
proceed to worktrees. Print the pairwise matrix and the touch-set per feature so the
independence claim is auditable, not asserted. If any requested pair is RED, **stop
and report it** — recommend running those serially per the normal one-session model.

## Step 2 — Provision one worktree per surviving feature

Place worktrees as **siblings of the repo** (never nested inside it — nesting
confuses git and the npm workspace globs):
```
git worktree add ../c4i-wt-<slug> -b feature/<slug> main   # new branch
# or, if the feature branch already exists:
git worktree add ../c4i-wt-<slug> feature/<slug>
```
Use the exact `feature/<slug>` from the feature's "Session loop" line in META-PLAN
(e.g. F10 → `feature/swipe-direction-swap`). Then, **per worktree**, prepare it so
its tests can run in isolation:
- `npm install` inside the worktree root — node_modules is **not** shared across
  worktrees (it lives in each working dir), so each needs its own install.
- Confirm the worktree is on the right branch and clean (`git -C ../c4i-wt-<slug>
  status`, `git -C ../c4i-wt-<slug> branch --show-current`).

Record the mapping (feature → worktree path → branch) in your summary so the user
and any later session can find and clean them up.

## Step 3 — Dispatch the feature sessions (pick one mode)

**Mode A — Hand-off (default; matches the one-session-per-feature contract).**
Do **not** implement here. For each worktree, emit a ready-to-paste **kickoff
prompt** the user runs in a *separate* Claude Code session opened in that worktree
directory. Use the explicit kickoff from META-PLAN's "How to run a session":
```
cd ../c4i-wt-<slug> && claude
# then paste:
Read META-PLAN.md. Run feature <F-id> and only that feature. Follow its
Per-Feature Session Contract: cold-survey and verify the repo matches the
Baseline / that feature's "Assumed starting state" (STOP and report if it
diverges), set its Status ledger row to in-progress, then create-plan →
review-plan → run-plan (once) → git-commit → verify "Expected end state" →
update the ledger row to in-review with the PR link → git-push. End the session
after the PR is pushed. Do not start any other feature.
```
Each such session is independent and isolated — true parallelism with zero shared
mutable state beyond the (append-only-per-row) Status ledger.

**Mode B — Single-session fan-out (optional; one driver, background subagents).**
If the user wants this session to drive them, spawn **one background subagent per
worktree**, each instructed to `cd` into its worktree and run that feature's full
Per-Feature Session Contract (create-plan → review-plan → run-plan → git-commit →
git-push) end-to-end, then report its PR link. Note the cost: N concurrent
heavyweight plan/implement/push pipelines, and each opens its own PR. Collect and
summarize the PR links when they finish. The merge gate (Step 5) is still the user's.

## Step 4 — Ledger writes don't collide

The **Status ledger** in META-PLAN lives in the repo, so concurrent sessions each
edit it on their *own* branch. Because each feature edits **only its own row**, the
per-row edits never textually conflict and each rides in its own PR. Do **not** let
a session rewrite another feature's row. If two PRs both touch the ledger and git
flags it at merge, it's a one-line, mechanical resolution (keep both rows) — note
this in the hand-off so it isn't mistaken for a real conflict.

## Step 5 — Merge order and post-merge rebase (the serial tail)

Implementation is parallel; **merging is serial**. Tell the user:
1. Merge the green PRs **one at a time** through the normal gate (review + CI).
2. After each merge, the **remaining** worktree branches should
   `git fetch && git rebase origin/main` and re-run their suites. For truly disjoint
   (GREEN) features this is a no-op rebase that re-greens CI cheaply; for accepted
   YELLOW pairs it's where any same-file divergence surfaces — resolve it there, not
   at PR-open time.
3. Re-run the **Step 1B** `git merge-tree` check between any two not-yet-merged
   branches if either rebased, to confirm they're still clean against each other.

## Step 6 — Teardown

When a feature's PR is merged (or abandoned), retire its worktree so stale trees
don't accumulate:
```
git worktree remove ../c4i-wt-<slug>          # refuses if dirty; resolve first
git worktree prune                            # clean up stale admin entries
git branch -d feature/<slug>                  # after merge; -D if abandoned
```
List leftover worktrees any time with `git worktree list`. Never `rm -rf` a worktree
dir by hand — use `git worktree remove` so git's bookkeeping stays consistent.

## Output (this dispatcher session)

1. The **pairwise independence matrix** (GREEN/YELLOW/RED) with each feature's
   verified file touch-set — the auditable basis for "these won't conflict."
2. Any F-IDs **excluded** (gated/coupled/RED) with the reason, and the recommendation
   to run them serially.
3. The **worktree map**: feature → worktree path → branch, plus confirmation each is
   clean, on the right branch, and `npm install`-ed.
4. Either the per-feature **kickoff prompts** (Mode A) or the spawned subagents'
   **PR links** (Mode B).
5. The **merge-order + teardown** reminder (Steps 5–6).

## Constraints

- **Do not implement or plan a feature in this session.** Provision + validate only;
  implementation happens under each feature's own Per-Feature Session Contract.
- **Never worktree a RED pair together.** Same-file/same-symbol features are serial
  by definition — say so and stop, don't "try it and see."
- **Provision from a clean `main`.** Verify branch + clean tree before `git worktree
  add`; a dirty base silently poisons every worktree.
- **One branch, one worktree.** Git enforces this; don't fight it by detaching HEAD.
- **Worktrees live outside the repo tree** (`../c4i-wt-*`), each with its own
  `npm install`; node_modules is not shared.
- **The merge gate stays human + serial.** Parallel implementation never implies
  parallel merge — main is branch-protected for a reason.
- Pi/LAN-touching features (F8, F17, F12–F14) still verify **unsandboxed** inside
  their own session; that constraint is unchanged by worktrees.
