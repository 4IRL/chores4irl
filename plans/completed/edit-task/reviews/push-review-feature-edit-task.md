# Push Review: feature/edit-task

## Review 1
Generated: 2026-06-26
Comparison: origin/main...HEAD
Verdict: **PUSHED WITH MINOR FINDINGS**

All 7 reviewers returned PASS (0 FAIL). Findings are all minor and non-blocking; recorded
here so a follow-up `/next-step-taker push-review-feature-edit-task` can address them if desired.
Two reviewers speculated that backend tests might fail — these speculations are empirically
disproven by the verified run (backend **30/30 green**, including the exact tests in question).

### Results by Reviewer

#### 1. Safety & Security — PASS
Parameterized better-sqlite3 queries (no string interpolation), validated PUT route, no
`dangerouslySetInnerHTML`, no secrets, CORS `PUT` addition appropriate. Minor: `urgency` not
explicitly enum-validated server-side (pre-existing on POST too; the DB `CHECK` constraint
already rejects bad values → 500).

#### 2. Correctness — PASS
`updateChore` column mapping + `changes===0→null` 404 sentinel correct; PUT status codes
correct; `handleEditChore` optimistic merge preserves id, reconciles, rolls back, leaves
`sortedIds` untouched; `choreToFormState` inverse transforms correct; pencil `stopPropagation`
correct; modal mutual exclusion holds. Minor: lazy `useState` initializer would be stale if
`initialChore` changed while the modal stayed mounted — not reachable in the current flow
(modal unmounts between edits).

#### 3. Simplicity & Conciseness — PASS
Clean, well-scoped; intentional mirroring of precedent. Minor: the `instanceof Date` ternary
in `updateChore` (copied from `addChore`) has a practically-unreachable else-branch.

#### 4. Test Coverage — PASS
All layers covered (backend unit + route, choreApi, ChoreForm, modal, bar, list, App
optimistic/rollback/Cancel/frozen-sort, e2e). Minor: no test for the `instanceof Date` string
passthrough branch; no test for `handleRequestEdit` closing an open Add form.

#### 5. Completeness & Cleanup — PASS
Rename fully contained (zero dangling `AddChoreForm` refs); no debug artifacts; the only TODO
is the intentional `TODO(#10)` for F6. Minor: an optional clarifying comment on the
`toBeUndefined()` assertions.

#### 6. Consistency & Style — PASS
ESM `.js` extensions, `satisfies ApiResponse<...>`, handler-naming parallelism, lucide named
import + `aria-hidden`, Tailwind conventions, vitest/testing-library/supertest patterns all
match. Minor: optional inline comment on the `longTermTask` 0→undefined mapping.

#### 7. Integration Risk — PASS
Rename contained; optional `onEdit` preserves all existing renders; modal prop extension
backward-compatible; PUT route + CORS clean (no conflict with PATCH `:id/complete`); no schema
change / no migration. Minor: edit button clickable during date-simulation — intentional
(Decision 6, mirrors delete); future F5/F6 may gate both.

### To-Do: Required Changes (all minor / optional)

- [ ] **Add server-side `urgency` enum validation** — `backend/src/app.ts` — in both POST and PUT handlers, reject a non-`low|medium|high` `urgency` with 400 instead of relying on the DB `CHECK` → 500. (Defense-in-depth; pre-existing gap, not a regression.)
- [ ] **Extract a shared `toIso(d)` date serializer** — `frontend/src/services/choreApi.ts` — DRY the `instanceof Date ? .toISOString() : d` ternary shared by `addChore` and `updateChore` (or drop the guard since the type is `Date`).
- [ ] **Add an App test for add→edit modal swap** — `frontend/src/__tests__/App.test.tsx` — open the Add form, click a pencil, assert `'Add New Chore'` is gone and `'Edit Chore'` is shown (covers `handleRequestEdit`'s `setShowForm(false)`).
- [ ] **(Optional) Clarify the optional-field mapping** — `backend/src/__tests__/chores.test.ts` — inline comment noting `rowToChore` maps null urgency / `long_term_task=0` → `undefined`, so the `toBeUndefined()` assertions are intentional.
- [ ] **(Future, F5/F6) Decide sim-mode gating for edit** — gate edit during `isSimulating` consistently with whatever F5/F6 decide for delete.
