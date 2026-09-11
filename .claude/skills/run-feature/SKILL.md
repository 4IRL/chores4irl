---
name: run-feature
description: Run one feature from plans/META-PLAN.md through its full Per-Feature Session Contract for chores4irl — cold-survey, plan, review, implement, commit, verify, and push a PR, then (once merge is confirmed) fold the merge back into META-PLAN.md. Resumable: re-invoking after a merge picks up exactly where the feature left off, driven by the state of its PR. Use when asked to run/implement/work on/continue a specific F-id feature, to check on one already in flight, or to reconcile META-PLAN.md after merging one. Replaces the old plans/NST-META-PLAN-PROMPT.md template.
argument-hint: <F-id>
---

# Run Feature

Execute exactly one feature from `plans/META-PLAN.md`'s "REMAINING FEATURES" section, following its Per-Feature Session Contract end-to-end, then — once the user confirms the PR merged — fold that merge back into `META-PLAN.md`. **Never touch a second feature in one invocation.**

## Resolve the F-id

`$0` is the F-id (bare current numbering, e.g. `F4`; not `-L` legacy or SUPERSEDED). Read `plans/META-PLAN.md` and locate its per-feature section under "REMAINING FEATURES". If the F-id doesn't exist there, is `-L`, or is marked SUPERSEDED, stop and say why.

From the section, note: the `feature/<slug>` branch name (its "Session loop" line), "Assumed starting state", "Expected end state", and "Open risks / decisions".

## Decide which phase to resume

Before doing anything else, determine where this feature actually stands — **don't assume Phase A just because you were asked to "run" it**:

```bash
gh pr list --head feature/<slug> --state all --json number,state,mergedAt
```

| PR state | Phase |
|---|---|
| no PR found (branch may not exist yet either) | **Phase A** — implement |
| PR open | **Phase B** — human merge gate |
| PR merged, and `plans/META-PLAN.md`'s Status ledger still has a row for this F-id | **Phase C** — fold the merge into META-PLAN |
| PR merged, no ledger row | nothing to do — report and stop |

## Phase A — implement

1. **Branch guard.** Require the working tree clean and on `main`, synced (`gmas`). If dirty or elsewhere, stop and ask how to proceed — do not stash without asking.
2. **Cold survey.** With no assumption carried from a prior session, verify the repo actually matches the Baseline / this feature's "Assumed starting state" — check the specific grep/route/file facts the section lists, not a skim. **If the repo diverges, stop and report before proceeding**; do not silently reconcile by picking an interpretation.
3. `git checkout -b feature/<slug> main`.
4. Set this feature's Status-ledger row in `plans/META-PLAN.md` to `in-progress` (a small standalone edit that rides in the first implementation commit).
5. `/plan-creator` — produce the implementation plan from this feature's Assumed/Expected state; resolve its "Open risks / decisions" during planning.
6. `/plan-reviewer` — apply its corrections before implementing.
7. `/run-plan` **exactly once**, on this feature's own plan — never nested, never on `META-PLAN.md` itself.
8. `/git-commit` to atomize the work; apply its self-review corrections.
9. **Verify "Expected end state"** — run the relevant Vitest suites + `e2e/smoke.spec.ts`, and check every listed grep/route fact. Reconcile any gap before publishing.
10. Update the Status-ledger row to `in-review` with the PR link (once known), commit.
11. `/git-push` — runs the 8-agent review and opens/updates the PR. If it rejects, fix per its findings and re-push; do not fall through to Phase B with an unresolved rejection.

Fall through to Phase B once the PR is open.

## Phase B — human merge gate

Do not assume the feature shipped or merged just because a PR exists.

**Pause-and-ask checkpoint (mandatory, two-part):**
```
AskUserQuestion, multiSelect:
"Confirm before I fold this into META-PLAN.md:"
  [ ] The feature works correctly on its branch (you've verified it)
  [ ] Its PR is merged into main
```
- Both confirmed → continue to Phase C now, in this same invocation.
- Either unconfirmed → end the session. Tell the user to re-run `/run-feature <F-id>` once both are true — it will detect the merged PR via `gh` and resume directly at Phase C.

## Phase C — fold the merge into META-PLAN.md

1. `git checkout main && gmas`.
2. `git checkout -b chore/meta-plan-update-<f-id-lowercase>`.
3. Edit `plans/META-PLAN.md` per its own **Ledger update protocol** and **History policy**:
   - Delete this feature's Status-ledger row (never mark it `merged` — a verified-merged row is deleted, not kept).
   - Annotate its row in the **Legacy → current ID map** as shipped (PR number), if applicable.
   - If a *remaining* feature still targets this one's implemented contract, add/update it under "COMPLETED-FEATURE CONTRACTS STILL IN FORCE"; otherwise fold the durable facts into **Baseline** / **Standing invariants** instead.
   - Refresh the **Baseline** header (`main` at PR #N, `<SHA>`) and any baseline facts this feature changed.
   - If this feature was **★FOCUS**, re-evaluate "Shortest path to the focus feature": if the next step is unambiguous (its track's next item, zero new prerequisites), advance ★FOCUS and say so; if it's genuinely ambiguous, ask via `AskUserQuestion` rather than guessing.
4. `/git-commit`.
5. `/git-push` — this is a small docs-only PR; the 8-agent review still runs, that's fine.
6. End the session. Do not start another feature.

## Constraints

- One feature per invocation, always. Never chain into a second F-id even if Phase C finishes quickly.
- Never self-mark a PR merged — Phase B's confirmation (or `gh`'s own `mergedAt`) is the only source of truth.
- Phase A/C never hand-edit a Status-ledger row for a *different* feature.
