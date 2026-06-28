> **STATUS: Merged** `e30c2b2` (#14). Frozen — historical record, do not edit.
> **Outcome:** Shipped as planned. Reusable `ConfirmDialog` (`frontend/src/components/common/
> ConfirmDialog.tsx`, portal + backdrop) gates deletion; chore is removed only on explicit
> confirm. **F5 swipe-left reuses this dialog** — preserve it. See git for the actual diff.

# F4 — Require confirmation before deleting a chore

## Summary
When the user triggers a chore deletion (the `✕` button in `ChoreTimerBar`), show a small
confirmation modal; the chore is deleted **only** on explicit confirm, and **Cancel** leaves
it untouched. A reusable `ConfirmDialog` component (portal/backdrop styled to match
`ChoreFormModal`) is introduced, and `App.tsx` routes the existing optimistic-delete-with-rollback
flow through it. No backend or schema change. The `✕` button and its `aria-label="Delete chore"`
remain (removed later in F6).

## Research Findings
- **Delete path today:** `ChoreTimerBar.tsx:51` `✕` button → `onDelete(chore.id)` → `ChoreList` passes `onDelete` straight through (`ChoreList.tsx`) → `App.tsx:131` `onDelete={handleDeleteChore}`. `handleDeleteChore` (`App.tsx:72-85`) does optimistic remove of `choreData` + `sortedIds`, awaits `removeChore(id)`, and rolls **both** back on failure while setting `error`.
- **Modal pattern to reuse:** `ChoreFormModal.tsx` uses `createPortal(..., document.body)` with backdrop `className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 px-4 pt-4"`, `data-testid="chore-modal-backdrop"`, and a `handleBackdropClick` that calls `onCancel` only when `event.target === event.currentTarget`. Inner panel: `bg-gray-800 rounded-xl p-6 w-full max-w-md`.
- **Keeping the `(id) => void` `onDelete` contract** means `ChoreTimerBar` and `ChoreList` need **no change** — only the function `App` passes as `onDelete` changes (from the deleter to a "request delete" that opens the dialog). This minimizes surface for F5/F6.
- **Existing tests that assume immediate delete must change:** `App.test.tsx` `describe('handleDeleteChore')` (clicks Delete, expects immediate optimistic removal) and `describe('frozen sort order') › 'rolling back a failed delete restores the original sort order'` (clicks Delete, expects removal) — both must now click Delete **then Confirm**. `ChoreTimerBar.test.tsx` only asserts `onDelete` fires with the id (mock) — **unchanged**.
- **e2e (`e2e/smoke.spec.ts`)** clicks `[aria-label="Delete chore"]` in two places: the dedicated delete test (line 82) and the add-chore cleanup loop (line 60). Both must add a confirm click after.
- **Commands:** frontend unit = `cd frontend && npm test` (vitest run); e2e = `npm run test:e2e` (playwright); lint = `npm run lint` (eslint). Test stack: Vitest + @testing-library/react + userEvent; fixture `makeChore` at `frontend/src/__tests__/fixtures/chore.ts`.

## Design decisions (resolved from META-PLAN defaults)
- **Pattern:** small modal dialog reusing `ChoreFormModal`'s portal/backdrop styling.
- **State location:** `App.tsx` holds `pendingDeleteId: number | null`. `onDelete` becomes "open the dialog"; the existing `handleDeleteChore` body (optimistic remove + rollback) is preserved verbatim and invoked on confirm.
- **Confirm/Cancel identity:** confirm button text **"Delete"** + `data-testid="confirm-dialog-confirm"`; cancel button text **"Cancel"** + `data-testid="confirm-dialog-cancel"`. Confirm's accessible name "Delete" is distinct from the bar's `aria-label="Delete chore"`, so role-name selectors stay unambiguous. Backdrop `data-testid="confirm-dialog-backdrop"`, `role="dialog"`, `aria-modal="true"`.
- **Message:** `Delete "<chore name>"? This can't be undone.` (chore looked up from `choreData` by `pendingDeleteId`); if the chore isn't found the dialog does not render.

## Steps

### 1. Create the reusable `ConfirmDialog` component (TDD)
Add an accessible portal/backdrop confirmation dialog mirroring `ChoreFormModal`'s styling.

**To-do:**
- [x] **Red:** Create `frontend/src/__tests__/components/ConfirmDialog.test.tsx`. Import `ConfirmDialog` from `../../components/common/ConfirmDialog`. Follow `ChoreFormModal.test.tsx` style (`render`, `screen`, `userEvent.setup()`). Write tests:
  - renders the `message` prop text (e.g. pass `message='Delete "Sweep"? This can't be undone.'` and assert it is in the document);
  - clicking the confirm button (`screen.getByRole('button', { name: 'Delete' })`) calls `onConfirm` once and does **not** call `onCancel`;
  - clicking the cancel button (`screen.getByRole('button', { name: 'Cancel' })`) calls `onCancel` once and not `onConfirm`;
  - clicking the backdrop (`screen.getByTestId('confirm-dialog-backdrop')`) calls `onCancel` once;
  - clicking inside the panel (e.g. the message text or confirm button) does **not** call `onCancel` via the backdrop handler (assert that clicking the confirm button leaves `onCancel` uncalled).
  Run `cd frontend && npm test -- ConfirmDialog` and confirm it fails (module not found).
- [x] **Green:** Create `frontend/src/components/common/ConfirmDialog.tsx`. Props type:
  ```ts
  type ConfirmDialogProps = {
      message: string;
      confirmLabel?: string; // default 'Delete'
      cancelLabel?: string;  // default 'Cancel'
      onConfirm: () => void;
      onCancel: () => void;
  };
  ```
  Render via `createPortal(..., document.body)`. Backdrop `div`: `className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"`, `onClick={handleBackdropClick}`, `data-testid="confirm-dialog-backdrop"`, `role="dialog"`, `aria-modal="true"`. `handleBackdropClick` calls `onCancel()` only when `event.target === event.currentTarget` (copy `ChoreFormModal`'s guard). Inner panel `div`: `className="bg-gray-800 rounded-xl p-6 w-full max-w-sm"` containing a `<p className="text-white text-base mb-6">{message}</p>` and a button row `<div className="flex justify-end gap-3">` with:
  - Cancel button: `type="button"`, `onClick={onCancel}`, `data-testid="confirm-dialog-cancel"`, text `{cancelLabel}` (default `'Cancel'`), styled e.g. `className="px-4 py-2 rounded-full bg-gray-600 hover:bg-gray-500 text-white text-sm"`;
  - Confirm button: `type="button"`, `onClick={onConfirm}`, `data-testid="confirm-dialog-confirm"`, text `{confirmLabel}` (default `'Delete'`), styled e.g. `className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white text-sm"`.
  Run `cd frontend && npm test -- ConfirmDialog`; confirm green.
- [x] **Refactor:** Ensure imports/types match project style (no `React` default import needed; use `React.MouseEvent<HTMLDivElement>` for the handler param as `ChoreFormModal` does). Re-run the file's tests; keep green.
- [x] **Accessibility scope (intentional):** Escape-to-close and focus-trap/initial-focus management are **out of scope** for F4, matching `ChoreFormModal`'s existing behavior (it also closes only on backdrop + explicit cancel). The contract's "accessible buttons" requirement is satisfied by real `<button>` elements with text labels plus `role="dialog"`; keep `aria-modal="true"`. Do not add Escape/focus-trap handling.

### 2. Route `App.tsx` delete through the confirmation (TDD)
`App` opens `ConfirmDialog` on delete-request and only runs the optimistic delete on confirm; cancel is a no-op.

**To-do:**
- [x] **Red:** Add a new `describe('delete confirmation', ...)` block to `frontend/src/__tests__/App.test.tsx`. Its `beforeEach` **must** call `vi.clearAllMocks()` first, then re-establish `vi.mocked(fetchAllChores).mockResolvedValue([makeChore()])` and `vi.mocked(removeChore).mockResolvedValue(undefined)` (mirror the `handleCompleteChore`/`frozen sort order` blocks, **not** the `handleDeleteChore` block at lines 37-42 which omits `clearAllMocks` — without the clear, the call-count assertions on `removeChore` below can leak across tests). Tests:
  - **opens dialog, does not delete yet:** after load, click `screen.getByRole('button', { name: 'Delete chore' })` (the `✕`); assert the dialog appears (`screen.getByTestId('confirm-dialog-backdrop')` present and the message text containing the chore name `Sweep` is shown) and `removeChore` has **not** been called; the chore (`Sweep`) is still in the document.
  - **confirm deletes:** open the dialog as above, then click `screen.getByTestId('confirm-dialog-confirm')`; assert `removeChore` was called with `1` (the `makeChore()` id) and the chore is optimistically removed (`screen.queryByText('Sweep')` is null / `queryByRole('button', { name: 'Delete chore' })` is null), and the dialog is gone (`queryByTestId('confirm-dialog-backdrop')` is null). Use `vi.mocked(removeChore).mockResolvedValue(undefined)`.
  - **cancel does not delete:** open the dialog, click `screen.getByTestId('confirm-dialog-cancel')`; assert `removeChore` was **not** called, the dialog is gone, and `Sweep` is still present.
  Run `cd frontend && npm test -- App` — confirm these new tests fail (dialog not wired yet).
- [x] **Green:** Edit `frontend/src/App.tsx`:
  - Add import: `import ConfirmDialog from './components/common/ConfirmDialog';`.
  - Add state: `const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);`.
  - **Keep `handleDeleteChore(id)` exactly as-is** (the optimistic remove + rollback body at `App.tsx:72-85`) — it becomes the confirm action, preserving rollback.
  - Add handlers:
    ```ts
    function handleRequestDelete(id: number) { setPendingDeleteId(id); }
    function handleCancelDelete() { setPendingDeleteId(null); }
    function handleConfirmDelete() {
        const id = pendingDeleteId;
        setPendingDeleteId(null);
        if (id !== null) void handleDeleteChore(id);
    }
    ```
  - Change the `ChoreList` prop from `onDelete={handleDeleteChore}` to `onDelete={handleRequestDelete}` (line ~131).
  - Compute the pending chore for the message: `const pendingChore = pendingDeleteId !== null ? choreData.find(c => c.id === pendingDeleteId) : undefined;`.
  - Render the dialog after the `ChoreFormModal` line (~137): `{pendingChore && (<ConfirmDialog message={\`Delete "${pendingChore.name}"? This can't be undone.\`} onConfirm={handleConfirmDelete} onCancel={handleCancelDelete} />)}`.
  Run `cd frontend && npm test -- App`; confirm the new `delete confirmation` tests pass. **NOTE:** `npm test -- App` is a *filename* filter — it runs the entire `App.test.tsx` file, so the two pre-existing delete tests (`describe('handleDeleteChore')` and `frozen sort order` → `'rolling back a failed delete...'`) will now **FAIL** because they click Delete without yet clicking Confirm. This is **expected** and is repaired in Step 3 — do **not** treat it as a regression to fix here, and do not record the file as fully green until Step 3 is done. The new `delete confirmation` block, in isolation, must be green.
- [x] **Refactor:** Confirm `useState` is already imported (it is). Verify no unused symbols. Keep the new block green (the two stale tests are addressed in Step 3).
- [x] **Edge cases (already handled by design — verify, no extra code needed):** double-clicking Confirm cannot delete twice because `handleConfirmDelete` calls `setPendingDeleteId(null)` synchronously, unmounting the dialog before a second click; and a `pendingDeleteId` pointing at an already-removed chore is caught by `handleDeleteChore`'s existing `if (!deletedChore) return` (App.tsx:74). Delete remains available during simulation (no `isSimulating` guard on delete; the dialog is portalled past the bar's `pointer-events-none`), preserving pre-F4 behavior.

### 3. Update existing delete-path tests that assumed immediate deletion
Two existing tests click Delete and expect immediate removal/rollback — they must now confirm first.

**To-do:**
- [x] In `App.test.tsx` `describe('handleDeleteChore')` → the `'optimistically removes the chore, rolls back on failure, and sets error'` test: after `await user.click(screen.getByRole('button', { name: 'Delete chore' }))`, add `await user.click(screen.getByTestId('confirm-dialog-confirm'));` **before** the assertion that the chore is optimistically gone. The rest (reject in-flight `removeChore`, assert rollback re-shows `Delete chore`, assert `Delete failed` error) stays. (The `rejectRemove` deferred-promise pattern is unchanged.)
- [x] In `App.test.tsx` `describe('frozen sort order')` → `'rolling back a failed delete restores the original sort order'`: after `await user.click(screen.getAllByRole('button', { name: 'Delete chore' })[0])`, add `await user.click(screen.getByTestId('confirm-dialog-confirm'));` before `await waitFor(() => expect(screen.getAllByTestId('chore-bar')).toHaveLength(1))`. (Only one dialog is open at a time, so `getByTestId` is unambiguous.)
- [x] Run `cd frontend && npm test` (full frontend suite). Confirm **all** frontend unit tests pass (new + updated + untouched, including `ChoreTimerBar.test.tsx` which needs no change since it only asserts the `onDelete` mock fires).

### 4. Update the e2e delete flows to confirm
The Playwright smoke spec deletes via the `✕` in two places; both must click the confirm button after.

**To-do:**
- [x] In `e2e/smoke.spec.ts`, the `'deletes a chore and it disappears from the list'` test: after `await deleteBtn.click();` add `await page.getByTestId('confirm-dialog-confirm').click();` before the `await expect(page.locator('text=E2E Delete Target')).not.toBeVisible(...)` assertion.
- [x] In `e2e/smoke.spec.ts`, the `'adds a new chore via the form'` test's `finally` cleanup loop (lines ~59-63): after `await testChores.first().locator('[aria-label="Delete chore"]').click();` add `await page.getByTestId('confirm-dialog-confirm').click();` so each cleanup deletion is confirmed; keep the `await expect(testChores).toHaveCount(count - 1, ...)` assertion.
- [x] (No other `[aria-label="Delete chore"]` usages exist in e2e — verify with `grep -n "Delete chore" e2e/smoke.spec.ts`.) Verified: only lines 60 (cleanup-loop click), 80 (comment), 82 (deleteBtn locator).
- [x] **Note:** the confirm button is in a portal rendered to `document.body`, **outside** the `.bg-gray-800.rounded-full` chore-bar locator, so `page.getByTestId('confirm-dialog-confirm')` is selected at page level (not scoped to `targetChore`/`testChores`), and the existing `toHaveCount`/`not.toBeVisible` assertions on the chore-bar locator remain valid unchanged. Rely on Playwright's built-in actionability auto-wait for the confirm click (the dialog mounts synchronously on the delete click).
- [x] If a local dev server + browsers are available, run `npm run test:e2e` and confirm the delete + add-chore tests pass. **RAN LOCALLY:** `npx playwright test -g "deletes a chore and it disappears from the list|adds a new chore via the form"` — webServer (backend+frontend) started automatically; **2 passed (5.1s)**. Both delete-path e2e tests pass with the confirm click.

### 5. Verify All Tests Pass
Run the suites and linter to confirm nothing is broken.

**To-do:**
- [x] Run `cd frontend && npm test` and confirm all frontend Vitest tests pass. **82 passed (13 files), 0 failed.**
- [x] Run `npm run lint` (from repo root) and confirm no new lint errors (no unused vars, no `no-explicit-any`). **0 errors, 1 warning (pre-existing `react-hooks/exhaustive-deps` in App.tsx — accepted).**
- [x] Run `npm run test:e2e` if the environment supports it (see Step 4 caveat); otherwise document that e2e is deferred to CI. **Already ran & passed in Step 4 (2 passed); not re-run.**
- [x] Backend is untouched — no backend test run required, but optionally run `npm test --workspace backend` to confirm no incidental breakage. **22 passed (3 files), 0 failed.**
- [x] Investigate and fix any failures before marking the plan finished. **No failures.**

## Status
finished: true
