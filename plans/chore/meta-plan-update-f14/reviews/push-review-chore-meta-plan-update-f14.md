# Push Review: chore/meta-plan-update-f14

## Review 1
Generated: 2026-09-16 11:10
Comparison: origin/main...HEAD (`90f034e`)
Verdict: **BLOCKED**

### Results by Reviewer

#### 1. Safety & Security — PASS
Docs-only META-PLAN.md update; no secrets, credentials, private hostnames, or unguarded destructive instructions. F4's DROP COLUMN reference is described as idempotent and pragma-guarded.

#### 2. Correctness — PASS
All component code claims (ClearButton, FormField, ChoreForm, ChoreSearchInput), test paths, PR/SHA facts (#34 `3533b67`, #35 `9d3e7a4`), plans/completed + PUSH-REVIEW-FINDINGS content, and invariant numbering 1–10 verified against the repo.
- minor — Backlog "Remaining" table Order column skips "2" (★, 1, 3, 4, 5) after F14's row was removed.

#### 3. Simplicity & Conciseness — PASS
Repetition stays within the file's existing convention.
- minor — Same Order-column gap.
- minor — Baseline "Tests" bullet lists all five F14 test filenames plus a point-in-time "252 tests / 29 files" count — over-specified vs. the adjacent F9-L/F10-L clauses.
- minor — F4 "Assumed starting state" bullet states the do-not-touch instruction twice back to back.

#### 4. Test Coverage — PASS
No test code touched; all five named test files exist and cover the claimed cases; `npx vitest run` reproduced 29 files / 252 tests passing.

#### 5. Completeness & Cleanup — PASS
No stale F14-as-pending/focus references anywhere; PR/SHA facts verified; tmp/ is gitignored.

#### 6. Consistency & Style — FAIL
- major — Order column skips "2"; the F2 fold-back (PR #30) renumbered this table contiguously.
- major — Standing invariant 10 places its "(F14, shipped #34)" citation after the bold title, before the colon; invariants 8/9 put the citation at the end of the description.
- minor — "opt-in `clearable` prop" is bolded in two places and plain in two others.

#### 7. Integration Risk — PASS
New F4 ledger row still matches `/run-feature`'s `^\| \*{0,2}<F-ID> ` grep with Status in column 2; all skill-consumed headings intact; F4 section keeps Session loop / Assumed / Expected / Open risks.

#### 8. Error Handling & Silent Failures — PASS
- minor — Rewritten "Branch/dir cleanup" paragraph dropped the explicit warning that hand-deleting a merged feature's ledger row (outside `/run-feature`) skips the Phase C fold-back.
- minor — Same Order-column gap.

### To-Do: Required Changes

- [x] **Renumber the Backlog "Remaining" table's Order column** — `plans/META-PLAN.md` (Remaining table, F15/F11/F12 rows) — change F15 → 2, F11 → 3, F12 → 4 so the column reads ★, 1, 2, 3, 4 with no gap.
- [x] **Move Standing invariant 10's citation to the end** — `plans/META-PLAN.md` (Standing invariants, item 10) — remove "(F14, shipped #34)" from after the bold title and append it before the final period, matching invariants 8/9's structure.
- [x] **Normalize the "opt-in `clearable` prop" rendering** — `plans/META-PLAN.md` (Chore-list track bullet, invariant 10, F4 Dependencies, chain-integrity F14 ↔ F4 bullet) — use plain (non-bold) text in all four places.
- [x] **Trim the Baseline "Tests" bullet's F14 clause** — `plans/META-PLAN.md` (Baseline › Tests) — replace the five-file list and the "252 tests / 29 files at #34" count with a topic-level description matching the F9-L/F10-L clauses.
- [x] **Collapse the duplicated do-not-touch sentence in F4's Assumed starting state** — `plans/META-PLAN.md` (F4 › Assumed starting state, ChoreForm bullet) — keep a single "do not disturb" clause that names ClearButton.tsx / ChoreSearchInput.tsx / FormField's `clearable` branch once.
- [x] **Restore the hand-delete warning in "Branch/dir cleanup"** — `plans/META-PLAN.md` (Status ledger › Branch/dir cleanup) — add a clause that a merged feature's ledger row must not be deleted by hand outside `/run-feature <F-ID>`, since that would skip the Phase C fold-back.
