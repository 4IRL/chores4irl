# Repository rulesets (branch protection as-code)

These JSON files define GitHub **repository rulesets** that protect branches.
They are the *real* enforcement for the rules below — a CI workflow runs **after**
a push and cannot prevent one, so push/merge/review restrictions must live here.

## `main-protection.json`

Targets the default branch (`main`) and enforces:

| Rule | Effect |
|---|---|
| `pull_request` (`required_approving_review_count: 1`) | No direct pushes to `main`; changes must land via a PR with at least one approving review. |
| `non_fast_forward` | Blocks force-pushes, so git history on `main` cannot be rewritten. |
| `deletion` | Blocks deleting the `main` branch. |
| `required_status_checks` (`Backend Tests`, `Frontend Unit Tests`, `E2E Smoke Tests`) | These CI jobs must pass before a PR can merge. |
| `bypass_actors` → `OrganizationAdmin` (`bypass_mode: always`) | Only **org owners** may bypass the review requirement and merge directly. |

`dismiss_stale_reviews_on_push: true` means a new commit pushed to a PR
dismisses earlier approvals, so the approved diff is always the merged diff.

## Applying

```bash
# Requires gh authenticated with admin on the repo, plus jq.
./apply.sh                 # defaults to 4IRL/chores4irl
./apply.sh OWNER/REPO      # any repo
```

The script is idempotent: it updates the ruleset in place if one with the same
name already exists, otherwise creates it.

## Notes

- `ci.yml` contains a `guard-direct-push` job as **defense-in-depth** — it fails
  loudly if a commit ever lands on `main` without an associated PR. It is a
  backstop only; this ruleset is the authoritative control.
- `strict_required_status_checks_policy` is `false`, so PRs don't have to be
  rebased onto the latest `main` before merging. Set it to `true` to require
  branches be up to date first (catches semantic conflicts, at the cost of more
  rebase churn).
- The required status check names must exactly match the job `name:` values in
  `ci.yml`. If you rename a job, update the `context` here too.
