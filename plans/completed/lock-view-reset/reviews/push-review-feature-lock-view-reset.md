# Push Review: feature/lock-view-reset

## Review 1
Generated: 2026-09-23
Comparison: origin/main...HEAD
Verdict: **PUSHED WITH MINOR FINDINGS**

### Results by Reviewer

#### 1. Safety & Security — PASS
The diff is a pure client-side UI state reset. Nothing crosses a trust boundary, nothing is injected into the DOM, and there are no new network, storage or secret touches.

#### 2. Correctness — PASS
The lock-only effect is sound:
- It null-guards the ref.
- None of its setters are in its own deps, so it can't loop.
- The real `isLocked` defaults to false, so there is no spurious mount reset.

#### 3. Simplicity & Conciseness — PASS
The change is small and direct.
- Minor: the first test re-implements the drift sequence inline instead of using the file's `driftView()` / `getSearchInput()` / `getScrollRegion()` helpers.

#### 4. Test Coverage — PASS
Coverage tracks the META-PLAN Expected-end-state checklist item by item.
- Minor: no test engages the lock during the loading render (the `scrollRegionRef.current` null guard).
- Minor: no test mounts with `isLocked` already true. It is a documented no-op; worth adding when F20 re-keys the effect.

#### 5. Completeness & Cleanup — PASS
No debug code, TODOs or stray artifacts. The comments and README match the behavior.

#### 6. Consistency & Style — PASS
The code follows the F-prefixed comment convention, the hoisted-mock idiom from `App.touchLock.test.tsx`, and the prose style of the neighboring README paragraphs.

#### 7. Integration Risk — PASS
The change is frontend-only, with no API, schema or config changes.
- Minor (informational): expect a `plans/META-PLAN.md` ledger-table conflict with the in-flight F22 branch when the two merge.
- Minor (informational): the direct `scrollTop = 0` fires a native scroll event. F22's overlay thumb will flash on lock, which F22 Decision (b) accepts. This is already covered by the plan's manual Pi check.

#### 8. Error Handling & Silent Failures — PASS
There is no error-handling surface. The ref null guard is an intentional, documented no-op for the loading-branch case.

### To-Do: Required Changes

- [ ] **Reuse the drift helpers in the first F19 test** — `frontend/src/__tests__/App.lockViewReset.test.tsx` — In `it('resets scroll, room, search and day when the lock engages after 5 minutes idle')`, replace the inline Kitchen/search/Next-day/scroll sequence and local `searchInput`/`region` lookups with `const region = driftView();`. Follow it with one extra `fireEvent.click` on `Next day` if two simulated days are still wanted, and use `getSearchInput()` in the assertions.
- [ ] **Add a lock-during-loading test** — `frontend/src/__tests__/App.lockViewReset.test.tsx` — Hand-drive `mockUseTouchLock` to `{ isLocked: true }` while `fetchAllChores` is still pending (a never-resolving promise), then resolve it or rerender. Assert that nothing throws and that the view is at the defaults (All, empty search, no "Return to today"). This exercises the `scrollRegionRef.current` null guard in the F19 effect in `frontend/src/App.tsx`.
- [ ] **Add an already-locked-mount test** — `frontend/src/__tests__/App.lockViewReset.test.tsx` — Set `mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm })` before the first render, and assert the app renders in the reset state with no transition needed. Optional until F20 re-keys the effect to its idle tick.
- [ ] **Expect a META-PLAN ledger conflict with F22** — `plans/META-PLAN.md` — When F19 and F22 (`feature/overlay-scrollbar`) merge, reconcile the Status-ledger rows by hand: keep both features' row edits. No code change.
