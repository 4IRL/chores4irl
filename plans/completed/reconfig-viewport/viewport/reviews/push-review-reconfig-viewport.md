# Push Review: reconfig/viewport

## Review 1
Generated: 2026-04-19
Comparison: origin/main...HEAD
Verdict: **PUSHED WITH MINOR FINDINGS**

### Results by Reviewer

#### 1. Safety & Security — PASS
No security issues found; diff contains only UI layout, CSS, and test refactoring with no user-controlled data rendered unsafely, no secrets, and no destructive operations.

#### 2. Correctness — PASS
No off-by-one errors, type mismatches, null-handling gaps, broken control flow, or incorrect API usage. One minor absolute-position overlap risk between OverdueBadge and delete button on mobile.

#### 3. Simplicity & Conciseness — PASS
All changes appropriately scoped. ChoreFormModal is a justified extraction, the rotate overlay is pure CSS with no unnecessary JS layer, and test refactors reduce complexity rather than add it.

#### 4. Test Coverage — PASS
All modified tests correctly track the refactored modal/form structure. New ChoreFormModal, empty-state rendering, and rotate-overlay lack dedicated test coverage — minor gaps only.

#### 5. Completeness & Cleanup — PASS
Diff is clean — no debug code, no stubs, no temp files. One minor TODO comment introduced in ChoreTimerBar for swipe-to-delete.

#### 6. Consistency & Style — PASS
Naming conventions (PascalCase components, camelCase props/handlers), no single-letter variables, no window globals, import ordering matches surrounding files. ChoreFormModal follows the same structural pattern as AddChoreForm.

#### 7. Integration Risk — PASS
No breaking changes to public APIs, shared interfaces, database schemas, or cross-module contracts. All changes are UI layout and internal component restructuring.

### To-Do: Required Changes

- [x] **Widen OverdueBadge mobile offset to prevent delete-button overlap** — `frontend/src/components/chore/ChoreTimerBar.tsx:360` — The OverdueBadge is positioned at `right-16` (64px) on mobile while the delete button sits at `right-3` (12px). That leaves ~52px of clearance, which may clip when the badge grows. Change the badge offset to `right-20` (or compute it relative to the delete button's rendered width) so the two absolutely-positioned elements cannot overlap.
- [x] **Add ChoreFormModal backdrop-click unit test** — `frontend/src/components/form/ChoreFormModal.tsx` — Create `frontend/src/components/form/__tests__/ChoreFormModal.test.tsx` that renders the modal, clicks the backdrop div and asserts `onCancel` is called, then clicks a child element inside the modal and asserts `onCancel` is NOT called. This verifies the `handleBackdropClick` target-equality guard.
- [x] **Add empty-state test for ChoreList** — `frontend/src/components/chore/ChoreList.tsx:325` — Add a test case (in ChoreList tests or the App tests) that renders with an empty chores array and asserts the "No chores yet — tap + Add Task to get started." empty-state message is displayed.
- [x] **Add e2e test for portrait-enforcement overlay** — `frontend/index.html:48`, `e2e/smoke.spec.ts` — Add a Playwright test that sets viewport to landscape (e.g. 812x375 with height < 500px) and asserts `#rotate-overlay` is visible, then sets it back to portrait and asserts the overlay is hidden.
- [x] **Resolve swipe-to-delete TODO in ChoreTimerBar** — `frontend/src/components/chore/ChoreTimerBar.tsx:374` — Either convert the inline `TODO: replace with swipe-to-delete — touch target intentionally below 44px until then` comment into a tracked GitHub issue (and reference the issue number in the comment), or remove the comment if the current below-44px touch target is the accepted final state.
- [x] **Clean up ChoreTimerBar inline JSX comment** — `frontend/src/components/chore/ChoreTimerBar.tsx:356` — Move the inline block comment above the JSX block (or delete it, since the adjacent TODO comment is self-explanatory) so the file matches the rest of the codebase, which avoids inline JSX comments.

## Review 2
Generated: 2026-04-19 08:34
Comparison: origin/reconfig/viewport...HEAD (commit 65377fb)
Verdict: **PUSHED WITH MINOR FINDINGS**

### Results by Reviewer

#### 1. Safety & Security — PASS
No security vulnerabilities found. All changes are UI layout tweaks, test additions, and a `data-testid` attribute with no user-controlled content or system boundary exposure.

#### 2. Correctness — PASS
All logic is correct. The `handleBackdropClick` target-equality guard works correctly, the `right-20` OverdueBadge offset provides clear separation from the delete button, and the CSS media query conditions match the e2e viewport dimensions. One minor structural fragility flagged in the e2e overlay test (relies on shared `beforeEach` navigation).

#### 3. Simplicity & Conciseness — PASS
All five changes are appropriately scoped and concise. No over-engineering, dead code, or premature abstractions. Minor duplication between the two `it` blocks in `ChoreFormModal.test.tsx` could be dedup'd via `beforeEach`.

#### 4. Test Coverage — PASS
All production changes are adequately covered. Empty-state test uses exact-string copy which is brittle to rewording. Single-item list scenario is not explicitly tested (implicitly covered by the 3-chore count assertion). The OverdueBadge offset change has no automated visual regression guard (expected — layout tweaks aren't unit-testable).

#### 5. Completeness & Cleanup — PASS
No completeness or cleanup issues found. No debug code, placeholders, stubs, or newly-introduced TODOs. The `TODO(#10):` edit upgrades an existing TODO to reference a tracked issue.

#### 6. Consistency & Style — PASS
All naming conventions, import ordering, and codebase patterns are consistent. `data-testid` kebab-case naming matches `chore-bar`. The two existing e2e tests that assert modal visibility still use `.fixed.inset-0` CSS class selector rather than the new `data-testid='chore-modal-backdrop'` that was added for test targeting.

#### 7. Integration Risk — PASS
No integration risk. All changes are frontend-only, additive, and backwards-compatible. No backend, DB, migration, config, or dependency changes. Public component props/signatures unchanged.

### To-Do: Required Changes

- [ ] **Dedupe ChoreFormModal backdrop-click test setup via `beforeEach`** — `frontend/src/__tests__/components/ChoreFormModal.test.tsx` — Extract the repeated `userEvent.setup()`, `vi.fn()` onCancel creation, and `render(<ChoreFormModal ...>)` into a `beforeEach` block that exposes `user` and `onCancel` to each `it`. Keeps the intent of each test clearer and removes 4 lines of boilerplate.
- [ ] **Switch e2e modal-visible assertions to `data-testid='chore-modal-backdrop'`** — `e2e/smoke.spec.ts:45,70` — The `'adds a new chore via the form'` and `'deletes a chore and it disappears from the list'` tests assert `page.locator('.fixed.inset-0')` is visible after clicking "+ Add Task". Replace the `.fixed.inset-0` selector with `page.locator('[data-testid="chore-modal-backdrop"]')` in both places so the e2e tests use the testid added for this purpose.
- [ ] **Loosen ChoreList empty-state copy assertion** — `frontend/src/__tests__/components/ChoreList.test.tsx` — The new empty-state test uses `screen.getByText('No chores yet — tap + Add Task to get started.')` which is brittle against minor copy tweaks. Change to `screen.getByText(/no chores yet/i)` so trivial rewording does not break the test.
- [ ] **Add explicit load-state wait before overlay viewport assertions** — `e2e/smoke.spec.ts:98` — The new `'portrait-enforcement overlay toggles with viewport orientation'` test currently depends on the shared `beforeEach` for page load. Add `await page.waitForLoadState('domcontentloaded');` at the top of the test body so the test remains correct if the `beforeEach` is ever changed or the test is reordered/isolated.
