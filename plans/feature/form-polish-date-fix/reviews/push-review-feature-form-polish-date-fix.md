# Push Review: feature/form-polish-date-fix

## Review 1
Generated: 2026-09-22 02:26
Comparison: origin/main (4cf24b4)...HEAD (cbb015d) — 8 commits, 16 files
Verdict: **PUSHED WITH MINOR FINDINGS**

### Results by Reviewer

#### 1. Safety & Security — PASS
No XSS/injection/secrets/destructive-op issues: the Toast renders chore names as plain JSX text (auto-escaped; no `dangerouslySetInnerHTML`/`innerHTML`/`eval` in `frontend/src`), the date-fns helpers operate on a controlled `<input type="date">` value with a fixed pattern, and the diff touches only frontend/e2e/docs.

#### 2. Correctness — PASS
date-fns v4 `parse`/`format` verified empirically to zero unspecified time fields (local-midnight semantics hold); the `key={toast.id}` remount + timer cleanup + `setToast(prev => …)` error-clearing are race-free and match their tests; `stopPropagation` correctly prevents the ✕ from double-firing `onDismiss`.
- *(minor)* `frontend/src/components/form/ChoreForm.tsx:19` — `initialAddState()` computes today once at mount / post-submit reset; a modal held open across local midnight keeps the previous day (editable). Already an accepted decision in the plan ("Default date is captured at mount").

#### 3. Simplicity & Conciseness — PASS
Lean throughout: `formDate.ts`, `Toast`, and the App toast-state wiring are minimal and justified by the plan's decisions; e2e changes replace brittle `.bg-red-700` locators with one `ERROR_TOAST` constant; no dead code or unused imports.

#### 4. Test Coverage — PASS
New/changed tests (formDate, Toast ×7, TZ-pinned date-boundary suite, add-mode defaults, 11-test feedback-toast describe, re-scoped Playwright assertions) assert real behaviour rather than internals.
- *(minor)* `e2e/smoke.spec.ts` — only the add-chore e2e test asserts the toast's text/tone; the delete and edit smoke tests only had their locators re-scoped.
- *(minor)* `frontend/src/App.tsx:249` — the complete-success clear of a standing error toast is tested only for the same-chore retry-after-failure case, not for an error raised by an unrelated add/update/delete.

#### 5. Completeness & Cleanup — PASS
No debug code, stale/inaccurate comments, incomplete implementations or stray files; the `F21:` comments and the README section accurately describe shipped behaviour.

#### 6. Consistency & Style — PASS
Naming, import ordering, icon sizing, constants and test-fixture conventions all match siblings; no violations.

#### 7. Integration Risk — PASS
The `dateLastCompleted` wire change (local-midnight instant), the optional `defaultRoom` prop and the error-state→Toast refactor are backward compatible with backend/DB storage (verbatim `TEXT`, no midnight assumption) and downstream local-time math; `isRepullGated` and the `.overflow-y-auto` container string are unchanged; no other readers/callers.

#### 8. Error Handling & Silent Failures — PASS
All four mutation handlers catch, roll back optimistic state, and toast the real `err.message` (or an actionable fallback); error-toast persistence and replacement semantics are deliberate and tested.
- *(minor, pre-existing — unchanged by this diff)* `frontend/src/App.tsx:101` — `loadChores`'s catch surfaces a failure only when `initial` is true; background SSE re-pull failures are silently swallowed.

#### 9. Type Design — PASS
`ToastState`'s tone union avoids boolean-flag illegal states; `toastIdRef` is a sound monotonic identity source for the key-driven remount.
- *(minor)* `frontend/src/components/common/Toast.tsx:11` — `onDismiss`'s referential-stability invariant lives only in a JSDoc comment; an unstable callback would re-arm the 2.5 s timer on every parent render.
- *(minor)* `frontend/src/components/form/ChoreForm.tsx:45` — the `defaultRoom` doc says "Add mode only … Ignored in edit mode" but the real gate branches on `initialChore` presence, not `mode`.

### To-Do: Required Changes

- [ ] **Add success-toast assertions to the delete and edit smoke tests** — `e2e/smoke.spec.ts` (`'deletes a chore and it disappears from the list'`, `'edits a chore via swipe-left'`) — after each mutation, assert `page.getByTestId('toast')` has text `Deleted "<name>"` / `Saved "<name>"` and `data-tone="success"`, mirroring the add-chore test's two assertions (web-first, so they see the 2.5 s pill).
- [ ] **Add a cross-mutation error-clear test** — `frontend/src/__tests__/App.test.tsx` (`describe('feedback toast (F21)')`) — reject `addChore` once so a red toast stands, then resolve `completeChore` and tap the bar; assert `queryByTestId('toast')` is null. Pins the "any successful mutation retires a standing error" claim in the `handleCompleteChore` comment and the plan's Decisions.
- [ ] **Make `Toast` robust to an unstable `onDismiss`** — `frontend/src/components/common/Toast.tsx` — hold the latest `onDismiss` in a ref updated each render and have the auto-dismiss timer call `onDismissRef.current()`, so the effect depends on `tone` only; keep (or drop) the JSDoc accordingly. Alternatively leave as-is and record the accepted comment-only invariant — App already passes a `useCallback([])` value.
- [ ] **Reword the `defaultRoom` doc comment to match its gate** — `frontend/src/components/form/ChoreForm.tsx:45` — change "Add mode only: pre-fills Room (the active room tab). Ignored in edit mode." to "Used only when `initialChore` is absent (the add form): pre-fills Room with the active room tab."
- [ ] **Surface background re-pull failures in `loadChores`** *(pre-existing, optional)* — `frontend/src/App.tsx:101-106` — add a `console.error(err)` outside the `if (initial)` gate (or raise the same error toast for non-initial failures) so a failed SSE re-pull leaves a trace instead of being swallowed.
- [ ] **(Accepted, no change)** Midnight rollover keeps the mount-time default date — documented in the plan's Decisions ("Default date is captured at mount"); revisit only if the kiosk's blank-window closing the form stops holding.
