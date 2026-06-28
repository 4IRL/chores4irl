# Review: F2 — Edit Task functionality

## Review — 2026-06-26

### Summary
**Ready to proceed.** All 6 review subagents returned PASS with **0 critical and 0 major findings** — early-exit on Pass 1. Every load-bearing assertion in the plan was verified against the actual code (signatures, line numbers, prop names, mirror-patterns, the lucide `Pencil` export in v1.8.0, the better-sqlite3 no-op-update semantics, and the date round-trip). The high-value minor findings (frozen-sort regression test, optional-field round-trip, explicit `beforeEach`, Cancel test, non-optional e2e PUT wait, concrete padding remedy, mutual-exclusion modal guard, no-op-save guard test) were folded into the plan before finalizing.

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | PASS | 0 critical, 0 major, 3 minor |
| 2 | Full-Stack Trace | PASS | 0 critical, 0 major, 2 minor |
| 3 | Ordering & Cleanup | PASS | 0 critical, 0 major, 2 minor |
| 4 | Integration & Conventions | PASS | 0 critical, 0 major, 2 minor |
| 5 | Verification & Coverage | PASS | 0 critical, 0 major, 4 minor |
| 6 | Completeness & Risk | PASS | 0 critical, 0 major, 4 minor |

### Findings (all minor; high-value ones applied to the plan)

#### Minor
- **[Step 1] No-op-save regression guard** _(#6)_: better-sqlite3 returns `changes === 1` for an identical-value UPDATE (SQLite counts matched rows), so the `changes === 0 → null` sentinel does **not** false-404 a no-op save. **Applied:** added a "no-op save still returns the row" test to Step 1.
- **[Step 4] Edit-submit optional-field round-trip + urgency pre-population** _(#5)_: the edit-submit test asserted only required fields. **Applied:** Step 4 test 3 now seeds `details`/`urgency`/`longTermTask` and asserts they round-trip; urgency pre-population read via `getByRole('combobox')`.
- **[Step 4] Red surfaces as a module-resolution error** _(#3)_: the `ChoreForm.test.tsx` Red is a `Cannot find module './ChoreForm'` collection error (expected); vitest isolates it to that file and still runs all other suites. **Applied:** clarifying note added.
- **[Step 5] `Chore` already imported in ChoreFormModal** _(#1)_: removed the misleading "import if not already" hint. **Applied.**
- **[Step 6] lucide import-convention wording** _(#6)_: `DateNavigationBanner` imports `ChevronLeft/Right`, not `Pencil`; reworded to "named-import pattern". `Pencil` verified present in v1.8.0. **Applied.**
- **[Step 6] Concrete overlap remedy** _(#1, #6)_: the two-button group at `right-3` can collide with `CompletionInfo` (sm row) and the `OverdueBadge` (`right-20`, mobile). **Applied:** replaced "verify visually" with deterministic fallbacks (`sm:pr-20`; nudge badge `right-*`).
- **[Step 7] Explicit `beforeEach` for the `handleEditChore` describe** _(#1)_: **Applied** — resolves all four sibling mocks so `App` loads.
- **[Step 7] Frozen-sort regression test (Decision 7)** _(#5)_: no test asserted an edit doesn't change list position, despite an exact existing mirror (App.test.tsx ~L364-382). **Applied** as a fourth `handleEditChore` test.
- **[Step 7] Cancel closes the edit modal** _(#5)_: **Applied** — App-level Cancel test (modal closes, `updateChore` not called).
- **[Step 7] Add/edit modal mutual exclusion** _(#2, #4, #6)_: independent state allowed (in theory) both modals to stack. **Applied:** `handleRequestEdit` clears `showForm`, edit render gated on `!showForm`, Add button clears `editingId`.
- **[Step 8] Non-optional PUT `waitForResponse` + assert modal closes** _(#2, #5)_: **Applied** — the e2e now verifies the real round-trip and backdrop dismissal.

### To-Do: Mechanical Fixes (auto-applied)
- [x] Step 1 — add no-op-save regression test
- [x] Step 4 — optional-field round-trip in edit-submit test + urgency pre-population read; Red module-resolution note
- [x] Step 5 — remove redundant `Chore` import hint
- [x] Step 6 — lucide import wording; concrete `sm:pr-20` / OverdueBadge overlap fallback
- [x] Step 7 — explicit `beforeEach`; frozen-sort regression test; Cancel-closes test; modal mutual-exclusion guard
- [x] Step 8 — non-optional PUT `waitForResponse`; assert modal closes

### Verdict
[x] Ready to proceed as-is (minor findings folded in)
[ ] Proceed after minor fixes
[ ] Requires changes before proceeding

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | `AddChoreForm`→`ChoreForm` `git mv` + sole importer (ChoreFormModal) updated in same step; no dangling import; eslint `no-unused-vars` satisfied |
| Type annotations | [x] | `updateChore(id, Omit<Chore,'id'>): ChoreWire\|null`, `ChoreFormProps`, `ChoreFormModalProps`, `onEdit?(id)` all type-checked |
| Error handling (status codes, exceptions, user feedback) | [x] | 400/404/500 envelopes → `handleResponse` throws → App catch rolls back + error banner; 200 (not 201) correct |
| Test coverage (happy/sad/edge) | [x] | backend unit+route, choreApi, ChoreForm, modal, bar, list, App optimistic+rollback+frozen-sort+Cancel, e2e happy path |
| Breaking changes (API, shared state, schema) | [x] | additive PUT route + CORS PUT; no schema change; optional `onEdit` preserves existing renders |
| Config consistency (env, pins, lint) | [x] | lucide-react ^1.8.0 (`Pencil` present); ESM `.js` extensions preserved; sandbox settings untouched (not a new-project init) |
| Naming conventions | [x] | `handleRequestEdit`/`handleCancelEdit`/`handleEditChore` mirror delete handlers; `aria-label="Edit chore"`; lucide named import |
