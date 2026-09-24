# Push Review: feature/permissive-lock

## Review 1
Generated: 2026-09-24
Comparison: origin/main...HEAD
Verdict: **BLOCKED**

### Results by Reviewer

#### 1. Safety & Security — PASS
Every destructive path (tap, left/right swipe, sr-only Edit/Delete) is gated on `isLocked`, and the edit modal / `ConfirmDialog` are also JSX-gated on `!isLocked`. No XSS, injection or secret issues.
- minor — `ChoreTimerBar.tsx:28`: `isLocked` defaults to `false`, so the guard fails open if a future caller omits it.

#### 2. Correctness — PASS
Traced the lock/guard/overlay/timer state machine. No defects beyond the edge cases the plan already accepts (e.g. DD-4).

#### 3. Simplicity & Conciseness — PASS
- minor — `ChoreTimerBar.tsx:100/163/177`: the `if (isLocked) { onGuardedAttempt?.(point); return; }` guard is duplicated three times.
- minor — `TouchLockOverlay.tsx:18`: `FirstTap` re-declares `TapPoint`'s x/y.

#### 4. Test Coverage — FAIL
- **major** — `e2e/smoke.spec.ts:~489`: no real-browser click lands during the ~400 ms `'opening'` window (DD-21). The overlay must swallow a rapid third tap, and with the root no longer inert it is the only defense.
- minor — `e2e/smoke.spec.ts:~463`: the `'dismissing'` pass-through (DD-2) is only checked by className in jsdom.
- minor — `App.tsx:379`: the two "Accepted interactions" have no tests. (1) A raised-indicator tap during the opening window re-locks. (2) A keyboard attempt with the Add form open lets the corner unlock.
- minor — `ChoreTimerBar.test.tsx`: the locked vertical-drag test has no trailing-click check.

#### 5. Completeness & Cleanup — PASS
No debug code, stale references or TODOs. The README and META-PLAN claims match the code.

#### 6. Consistency & Style — PASS
- minor — `TouchLockOverlay.test.tsx:8`: typed describe-level `let onArm/onDismiss` differs from the suite's inline `const onX = vi.fn()`.

#### 7. Integration Risk — PASS
All consumers were updated. The z-ladder is consistent, and the META-PLAN contract matches the code.

#### 8. Error Handling & Silent Failures — PASS
- minor — `ChoreTimerBar.tsx`: the optional `onGuardedAttempt?.()` means a locked bar with no handler would silently drop attempts (no padlock and no warning).

#### 9. Type Design — PASS
- minor — `ChoreTimerBarProps`/`ChoreListProps`: `isLocked?` and `onGuardedAttempt?` are independently optional, so `isLocked: true` without a handler is representable. Couple them.
- minor — `FirstTap` should be `TapPoint & { at: number }`.

### To-Do: Required Changes

- [x] **Add a real-browser rapid-third-tap check during `'opening'`** — `e2e/smoke.spec.ts` — right after the qualifying unlock click and before `fastForward(500)`, add `page.mouse.click` at the same bar coordinates. Assert that no PATCH `/complete` fires and that the overlay is still attached (it caught the click). Keep the later post-unlock PATCH assertion.
- [x] **Add a real-browser pass-through check during `'dismissing'`** — `e2e/smoke.spec.ts` — after a blocked attempt, `fastForward` just past 1500 ms (fade started, `onDismiss` not yet fired). Click the search input with a real `page.mouse.click` and assert it received focus. Then fast-forward past `CLOSING_SETTLE_MS` and assert the overlay is gone.
- [x] **Type-couple `isLocked` and `onGuardedAttempt`** — `frontend/src/components/chore/ChoreTimerBar.tsx`, `frontend/src/components/chore/ChoreList.tsx` — use a union, e.g. `({ isLocked?: false; onGuardedAttempt?: (point: TapPoint) => void } | { isLocked: true; onGuardedAttempt: (point: TapPoint) => void })`. `isLocked: true` without a handler becomes a compile error, and the existing unlocked test renders stay valid. Then call `onGuardedAttempt` without `?.` inside the locked branches, where TS can narrow it.
- [x] **Extract the repeated lock-guard branch** — `frontend/src/components/chore/ChoreTimerBar.tsx` — add a small local helper (e.g. `guardOr(point, action)`) used by `resetTask` and both sr-only buttons.
- [x] **Derive `FirstTap` from `TapPoint`** — `frontend/src/components/common/TouchLockOverlay.tsx` — `type FirstTap = TapPoint & { at: number };`.
- [x] **Test the two accepted interactions** — `frontend/src/__tests__/App.touchLock.test.tsx` (or `App.lockViewReset.test.tsx` with the real hook).
  - (1) Raise an attempt, unlock via the overlay, then immediately click the still-raised indicator inside `CLOSING_SETTLE_MS`: it re-locks (`lock` is called).
  - (2) Open the Add form, raise an attempt via the sr-only Edit button, then click the raised indicator: it unlocks (`arm` is called) and the overlay is gone.
- [x] **Pin the trailing-click swallow after a locked vertical drag** — `frontend/src/__tests__/components/ChoreTimerBar.test.tsx` — add `fireEvent.click(bar)` after the vertical-drag `mouseUp`, and assert that `onComplete`/`onGuardedAttempt` are not called.
- [x] **Match the suite's mock style in the overlay tests** — `frontend/src/__tests__/components/TouchLockOverlay.test.tsx` — replace the describe-level typed `let onArm/onDismiss` with inline `const onArm = vi.fn(); const onDismiss = vi.fn();` (per test or inside the render helper).
