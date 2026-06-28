# Review: F4 — Require confirmation before deleting a chore

## Review — 2026-06-26

### Summary
Plan is solid and ready to implement. 6 parallel reviewers returned 5 PASS / 1 FAIL.
The single FAIL (ordering) was one **major** finding — a misleading "confirm green"
instruction in Step 2 — now mechanically corrected. All other findings are minor or
"no change required." Zero critical findings. No genuine design decisions required user
input (all `design_decision`-tagged findings were optional refinements with sensible
defaults already chosen in the plan).

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | PASS | 0 critical, 0 major, 2 minor |
| 2 | Full-Stack Trace | PASS | 0 critical, 0 major, 1 minor |
| 3 | Ordering & Cleanup | FAIL | 0 critical, 1 major, 2 minor |
| 4 | Integration & Conventions | PASS | 0 critical, 0 major, 3 minor |
| 5 | Verification & Coverage | PASS | 0 critical, 0 major, 3 minor |
| 6 | Completeness & Risk | PASS | 0 critical, 0 major, 6 minor |

### Findings

#### Major (fixed)
- **[Step 2] `npm test -- App` runs the whole file; two stale tests fail until Step 3** _(Subagent #3)_: vitest's positional arg is a filename filter, so Step 2's "confirm green" run also executes the not-yet-updated `handleDeleteChore` and `frozen sort order` rollback tests, which click Delete without Confirm and therefore fail. **Fix applied:** Step 2 Green reworded to state these two failures are expected and repaired in Step 3, not a regression.

#### Minor (folded into the plan or accepted)
- **[Step 2] New `delete confirmation` block needs `vi.clearAllMocks()`** _(Subagents #1, #3, #6)_: the `handleDeleteChore` block it would copy omits `clearAllMocks`, risking leaked `removeChore` call-count state. **Fix applied:** Step 2 Red now mandates `clearAllMocks()` + re-establishing the `fetchAllChores`/`removeChore` mocks in the new block's `beforeEach`.
- **[Step 1] Escape/focus-trap omitted** _(Subagents #5, #6)_: acceptable — matches `ChoreFormModal`. **Fix applied:** Step 1 now explicitly records this as intentional out-of-scope and keeps `role="dialog"`/`aria-modal="true"`.
- **[Step 4] e2e confirm click in portal** _(Subagent #6)_: dialog is portalled outside the chore-bar locator. **Fix applied:** Step 4 now notes page-level selection + Playwright auto-wait; existing `toHaveCount` assertions stay valid.
- **[Step 2] Double-confirm / concurrently-removed-chore edge cases** _(Subagent #6)_: already handled by `setPendingDeleteId(null)` (unmounts dialog) and `handleDeleteChore`'s `if (!deletedChore) return`. **Fix applied:** Step 2 now documents these guards.
- **[Step 2] Delete-during-simulation** _(Subagents #2, #5, #6)_: preserved — delete has no `isSimulating` guard and the portal escapes the bar's `pointer-events-none`. Documented in Step 2.
- **[Research] `ChoreTimerBar.tsx:51` phrasing** _(Subagent #1)_: cosmetic line-citation nit; no behavioral impact — accepted as-is.
- **[Step 1] `components/common/` is a new dir; `rounded-full` vs `rounded-lg`; keep/drop `aria-modal`** _(Subagent #4, #6)_: all optional design refinements; reviewers said "no change required for PASS." Plan defaults retained.
- **F5/F6 readiness** _(Subagent #6)_: the `(id) => void` `onDelete` contract + App-owned pending state set up F5 (swipe reuses `handleRequestDelete`) and F6 (remove ✕ without touching dialog) cleanly. Confirmed strength, no action.

### Verification Gaps
None blocking. Optional: an App-level test for "confirm during simulation still deletes"
(low priority — delete wiring is day-independent and covered piecewise). e2e is deferred to
CI when local Playwright/dev-server is unavailable; CI (`.github/workflows/ci.yml`) runs
`npm run test:e2e` on every PR, so core browser behavior is verified before merge.

### To-Do: Mechanical Fixes (auto-applied)
- [x] Reword Step 2 Green to flag the two expected stale-test failures (fixed in Step 3) — major.
- [x] Add `vi.clearAllMocks()` + mock re-establishment to the new Step 2 `delete confirmation` `beforeEach`.
- [x] Add Step 1 note: Escape/focus-trap intentionally out of scope; keep `role="dialog"`/`aria-modal`.
- [x] Add Step 4 note: confirm button is page-level/portalled; rely on Playwright auto-wait; existing assertions unchanged.
- [x] Add Step 2 edge-case note: double-confirm guard + concurrently-removed-chore early-return + delete-in-simulation preserved.

### Design Decisions (awaiting user input)
None. All design-tagged findings were optional with defaults already chosen.

---

### Verdict
[x] Ready to proceed as-is (after the applied mechanical fixes)
[ ] Proceed after minor fixes
[ ] Requires changes before proceeding

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | `handleDeleteChore` stays referenced; `useState` already imported; only `ConfirmDialog` import added (used). eslint `no-unused-vars` satisfied. |
| Type annotations | [x] | `ConfirmDialogProps` fully typed; `pendingDeleteId: number \| null`; strict mode honored; no `any`. |
| Error handling | [x] | Optimistic rollback + error banner preserved on confirm path (App.tsx:81-83). |
| Test coverage | [x] | Confirm-deletes, cancel-does-not, opens-without-deleting, backdrop-closes, rollback-after-confirm all covered; two existing tests correctly updated; ChoreList/ChoreTimerBar tests correctly unchanged. |
| Breaking changes | [x] | `(id) => void` `onDelete` contract preserved; no backend/schema/types change. |
| Config consistency | [x] | eslint.config.js rules checked; commands (`npm test`, `npm run lint`, `npm run test:e2e`) verified. |
| Naming conventions | [x] | No icons added (lucide-react preference moot); default exports; `import type`; `@customTypes` alias; data-testid idiom matches existing. |
