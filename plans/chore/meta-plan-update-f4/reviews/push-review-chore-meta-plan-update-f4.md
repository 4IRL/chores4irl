# Push Review: chore/meta-plan-update-f4

## Review 1
Generated: 2026-09-19 08:36
Comparison: origin/main (d728989)...HEAD (19b852e), 1 commit, 1 file (`plans/META-PLAN.md`)
Verdict: **BLOCKED**

### Results by Reviewer

#### 1. Safety & Security — PASS
Docs-only diff; no secrets, credentials or private hostnames; the crash-loud migration and Pi runbook it references describe already-shipped behaviour with snapshot-first safeguards.

#### 2. Correctness — FAIL (2 major)
Every repo fact checked out (SharedTypes, db.ts mechanics + SQLite 3.51.3, chores.ts, choreSort.ts, grep allow-list, 43/252 test counts, no-diff claim for ClearButton/FormField/ChoreSearchInput, PR history, numbering, tally, ID map) except:
- **major** `plans/META-PLAN.md:103,278` — "the form's fields are exactly Name/Room/Last Completed/Duration/Frequency" omits the pre-existing Urgency `<select>` still rendered in `ChoreForm.tsx:107-111`.
- **major** `plans/META-PLAN.md:211` — F5 ledger row still `pending` / `—` while the new Shortest-path prose (line 123) says PR #39 is open on that branch.

#### 3. Simplicity & Conciseness — PASS (1 minor)
- minor `plans/META-PLAN.md:790` — the "F14 ↔ F4 / F4 ↔ F3-L — retired" coupling bullet was reworded to past tense instead of deleted; Standing invariants 6 and 10 already carry the fact.

#### 4. Test Coverage — PASS
Re-ran both Vitest suites (backend 5 files / 43, frontend 29 files / 252) and confirmed the 7 `db-migration.test.ts` cases, stale-key tests, `ChoreForm` absence test, stale-flag sort test and the F14 clear-✕ tests all exist as claimed.

#### 5. Completeness & Cleanup — FAIL (1 major)
All prescribed Phase C edits are present and fact-checked; one contradiction introduced:
- **major** `plans/META-PLAN.md:123` — same F5 prose-vs-ledger contradiction as Correctness; suggests keeping the prose generic rather than hand-editing F5's row (run-feature's "never hand-edit another feature's row" rule).

#### 6. Consistency & Style — FAIL (1 major, 3 minor)
Matches the F14 fold-back precedent (1b2f8a4) in every structural pattern; findings:
- **major** `plans/META-PLAN.md:211` — the F5 row/prose contradiction (third reviewer to flag it).
- minor `:130` — "Details / Long-term are gone" matches neither the formal `*Details* / *Long-term task*` nor the shorthand `Details/Long-term` rendering.
- minor `:301,303` — "Resolved (`F4`, #38):" diverges from the "(F#, shipped #N)" provenance shape used in the Standing invariants.
- minor `:111` — F5's Depends-on cell "— *(F4 and F14 already merged)*" vs. the "none blocking *(…)*" lead-in F4's cell used.

#### 7. Integration Risk — PASS (1 minor)
All skill grep/parse patterns (run-feature, worktree, compact-plans, new-feature) still match; the #39 conflict is real but confined to the single ledger hunk, and #39 touches no other line this diff touches.
- minor `plans/feature/remove-details-longterm/{pr-description,remove-details-longterm,reviews/remove-details-longterm-review}.md` — cite `META-PLAN.md:255` / `:843`, now stale locators; content landed correctly. No action — frozen records awaiting `/compact-plans`.

#### 8. Error Handling & Silent Failures — PASS (1 minor)
Crash-loud chain (db.ts → server.ts `listen`, HEALTHCHECK, `on-failure:5`, README logs guidance), SQLite version, stale-key silent-drop and rollback asymmetry all verified against code/docs.
- minor `plans/META-PLAN.md:263,298` — the stale-key silent-drop is stated as a bare fact; note it was a deliberate, reviewed tradeoff (a 400 would break not-yet-reloaded kiosk clients) so a future session doesn't "fix" it.

### To-Do: Required Changes

- [x] **Add the Urgency `<select>` to both "exactly" field lists** — `plans/META-PLAN.md` chore-list-track bullet (~line 103) and the Key UI `components/form/` bullet (~line 278) — list Name (`FormField`, `clearable`), Room (datalist input), Last Completed / Duration / Frequency (`FormField`), and Urgency (raw `<select id="urgency">`, not `FormField`) so "exactly" is true against `frontend/src/components/form/ChoreForm.tsx`
- [x] **Reconcile the F5 Shortest-path prose with F5's unchanged ledger row** — `plans/META-PLAN.md` "Shortest path to the focus feature (`F5`)" (~line 123) — do not hand-edit F5's row (run-feature Phase C rule); instead state explicitly that PR #39 carries its own ledger-row flip to `in-review`, so the row on `main` reads `pending` until #39 merges and `gh` is the authority per the ledger's own note
- [x] **Note the stale-key silent-drop as a deliberate tradeoff** — `plans/META-PLAN.md` Domain-model bullet (~line 263) and Standing invariant 11 (~line 298) — add a short parenthetical: rejecting with 400 would break kiosk clients still running the old form until reloaded; accepted in F4's push review
- [x] **Delete the retired "F14 ↔ F4 / F4 ↔ F3-L" coupling bullet** — `plans/META-PLAN.md` Chain integrity → "Cross-feature couplings to honor" (~line 790) — Standing invariants 6 and 10 already record it
- [x] **Normalise the three style nits** — `plans/META-PLAN.md` ~line 130 (`*Details* / *Long-term task* are gone`), ~lines 301/303 (`**Resolved (F4, shipped #38):**`), ~line 111 (`none blocking *(F4 and F14 already merged)*`)
