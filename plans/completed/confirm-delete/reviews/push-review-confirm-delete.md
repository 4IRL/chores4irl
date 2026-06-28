# Push Review: feature/confirm-delete

## Review 1
Generated: 2026-06-26
Comparison: origin/main...HEAD
Verdict: **PUSHED WITH MINOR FINDINGS**

All 7 reviewers returned **PASS** (0 critical, 0 major). The findings below are minor and
do not block the push. One a11y finding was fixed inline before pushing (commit `7ef4aa2`);
the rest are recorded for optional follow-up.

### Results by Reviewer

#### 1. Safety & Security — PASS
No issues. Chore name is rendered as a React JSX text node (auto-escaped); no `dangerouslySetInnerHTML`, no secrets, no new network/backend surface. Backdrop guard `event.target === event.currentTarget` is correct.

#### 2. Correctness — PASS
No logic defects. `handleConfirmDelete` snapshots `pendingDeleteId` before clearing it (safe); the `pendingChore` guard unmounts the dialog on confirm; double-confirm is impossible; concurrent removal is caught by `handleDeleteChore`'s `if (!deletedChore) return`; the `(id) => void` onDelete contract is preserved. **Minor (FIXED inline):** dialog had `role="dialog"`/`aria-modal` but no accessible name → added `aria-labelledby` to the message paragraph (commit `7ef4aa2`).

#### 3. Simplicity & Conciseness — PASS
The three App handlers are individually justified (collapsing them would leak deletion logic into the dialog or lose the clear-before-async ordering). **Minor:** `confirmLabel`/`cancelLabel` optional props have no current callsite — mild premature generality, but defensible for a generically-named reusable `ConfirmDialog` (F5/later features may reuse it). Backdrop duplication from `ChoreFormModal` is a deliberate, acceptable ~8-line copy.

#### 4. Test Coverage — PASS
Core paths covered: ConfirmDialog unit (render, confirm, cancel, backdrop, inside-panel-click); App `delete confirmation` (opens-without-delete, confirm-deletes, cancel-doesn't); rollback-after-confirm via the two updated existing tests; e2e updated to confirm. **Minor:** backdrop unit test omits `expect(onConfirm).not.toHaveBeenCalled()`; no App-level backdrop-dismiss integration test (covered at unit level).

#### 5. Completeness & Cleanup — PASS
No debug artifacts, commented code, new TODOs, stubs, or placeholders. Pre-existing `TODO(#10)` in ChoreTimerBar untouched (intentional, for F5/F6).

#### 6. Consistency & Style — PASS
Strongly aligned with `ChoreFormModal`: same portal, default export, backdrop handler, Tailwind palette; `confirm-dialog-*` testids match the `chore-bar`/`chore-modal-backdrop` namespace; tests follow describe/it + userEvent + getByRole/getByTestId + makeChore. `components/common/` is an acceptable peer to chore/form/nav. **Minor:** `React.MouseEvent` used without an explicit React import — pre-existing pattern replicated from `ChoreFormModal`, not newly introduced.

#### 7. Integration Risk — PASS
No breaking changes. `(id) => void` onDelete contract unchanged (ChoreList/ChoreTimerBar need no edits); `aria-label="Delete chore"` retained; the ConfirmDialog and ChoreFormModal portals are mutually exclusive at render time; simulation pointer-events guard intact; sets up F5 (swipe reuses `handleRequestDelete`) and F6 (remove ✕ without touching the dialog) cleanly.

### To-Do: Optional Follow-Up Changes (non-blocking minors)

- [ ] **Add negative assertion to ConfirmDialog backdrop test** — `frontend/src/__tests__/components/ConfirmDialog.test.tsx` — in the backdrop-click test, add `expect(onConfirm).not.toHaveBeenCalled()` after the existing `onCancel` assertion.
- [ ] **(Optional) Add App-level backdrop-dismiss test** — `frontend/src/__tests__/App.test.tsx` — click ✕, click `confirm-dialog-backdrop`, assert dialog gone and `removeChore` not called. Low priority (unit-covered).
- [ ] **(Optional) Reconsider `confirmLabel`/`cancelLabel` props** — `frontend/src/components/common/ConfirmDialog.tsx` — keep for reusability or inline the strings until a second callsite needs them. Defer to F5 when the dialog gets a second consumer.
- [ ] **(Optional) Align `React.MouseEvent` import style** — `frontend/src/components/common/ConfirmDialog.tsx` and `frontend/src/components/form/ChoreFormModal.tsx` — switch both to `import type { MouseEvent } from 'react'` for consistency (pre-existing pattern; handle together).
