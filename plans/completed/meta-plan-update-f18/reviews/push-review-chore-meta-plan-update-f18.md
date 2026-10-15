# Push Review: chore/meta-plan-update-f18

## Review 1
Generated: 2026-09-23
Comparison: origin/main...HEAD
Verdict: **PUSHED WITH MINOR FINDINGS**

### Results by Reviewer

#### 1. Safety & Security: PASS
Docs-only change to one file. No secrets and no destructive operations.

#### 2. Correctness: PASS
Checked against the code on `main`: class strings, test ids, `SCROLL_TO_TOP_THRESHOLD_PX=80`, `FADE_MS=500`, PR numbers and SHAs, and whether the ledger, the Remaining table and the focus agree.
- (minor) The running Vitest total ("366 across 37 files") counts test call sites, not runtime cases, so a pre-existing `it.each` block isn't expanded. The figure is pre-existing and changes no behaviour.
- (minor) "Advanced 2026-09-23 at `F18`'s fold-back (#54)" cites the feature PR, not this fold-back's own PR. Its number isn't known when writing, the same as at F17's fold-back. Correct it at F22's fold-back.

#### 3. Simplicity & Conciseness: PASS
Prunes the F18 section the same way F17's fold-back did.
- (minor) The Key-UI bullet and Standing invariant 17 repeat implementation facts. This follows the doc's existing Key-UI + invariant pairing (compare F17's bullet and invariant 16), so it stays as is.

#### 4. Test Coverage: PASS
The recorded test facts check out: 366/37 frontend, 43/5 backend, and 20 added by F18.
- (minor) F22's cited `ChoreForm.tsx:67` should read `components/form/ChoreForm.tsx:75`. **Fixed.**

#### 5. Completeness & Cleanup: PASS
Every fold-back note in the feature plan was applied.
- (minor) The tally sentence's "both left it" was ambiguous. **Fixed** (the clauses are now parallel).

#### 6. Consistency & Style: PASS
Mirrors `01a9f1c` section by section.
- (minor) In the F20 section, "`F18`'s suites and `F19`'s (if present)" read as if F18 were still conditional. **Fixed.**

#### 7. Integration Risk: PASS
The `/run-feature` ledger grep, the PR column and `/compact-plans` stay consistent. The doc is ready to drive F22 → F20 → F19.

#### 8. Error Handling & Silent Failures: PASS
- (minor) The F18-button ↔ swipe-bars coupling pointed to *F18 follow-ups* for a Pi check that wasn't listed there. **Fixed:** follow-up (a) now asks for that check.

### To-Do: Required Changes

- [ ] **Correct the fold-back self-citation at F22's fold-back.** In `plans/META-PLAN.md`, change "Advanced 2026-09-23 at `F18`'s fold-back (#54)" to this fold-back PR's own number.
- [ ] **Re-verify the running Vitest total as runtime cases.** In `plans/META-PLAN.md`'s Baseline tests bullet, recount with `npx vitest run` under `frontend/` and state which count is meant, call sites or runtime cases.
