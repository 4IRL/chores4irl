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

## Review 2
Generated: 2026-09-24
Comparison: origin/main...HEAD (after Review 1 fixes in d9c80f0)
Verdict: **PUSHED WITH MINOR FINDINGS**

### Results by Reviewer

#### 1. Safety & Security — PASS
Every destructive path is guarded while locked, and the Review 1 type coupling removes the guard's fail-open default.

#### 2. Correctness — PASS
The `LockGuardProps` narrowing is sound, `ChoreList`'s rest-spread preserves the coupling, and `guardOr` keeps the same semantics. The smoke test's `pauseAt`/`fastForward` sequence was verified against Playwright's clock source.
- minor — `e2e/smoke.spec.ts:459`: `pauseAt(pageNow + 100)` could throw "Cannot fast-forward to the past" if the round trip exceeds 100 ms under load.

#### 3. Simplicity & Conciseness — PASS
- minor — `TouchLockOverlay.tsx:142`: the centred padlock keeps `transition-all duration-[400ms] scale-100 opacity-100` from the removed entrance phase; these classes now do nothing.

#### 4. Test Coverage — PASS
All 8 Review 1 items are genuinely covered (real-browser opening/dismissing clicks, mutation-checked).

#### 5. Completeness & Cleanup — PASS

#### 6. Consistency & Style — PASS

#### 7. Integration Risk — PASS

#### 8. Error Handling & Silent Failures — PASS

#### 9. Type Design — PASS
- minor — `useTouchLock.ts:5`: `arm` (unlock) and `lock` read as synonyms; consider `unlock`, or a doc comment.
- minor — `TouchLockOverlay.tsx:17`: `TapPoint`/`LockGuardProps` are imported by chore components from a UI leaf module; consider a shared types home.

### To-Do: Required Changes

- [ ] **Widen the smoke clock-pause margin** — `e2e/smoke.spec.ts` (~line 459) — change `pauseAt(pageNow + 100)` to a 250–500 ms margin so a loaded CI machine can't make it throw "Cannot fast-forward to the past". Check that the following `fastForward(1600)` still lands in the intended fade window.
- [ ] **Drop the inert padlock animation classes** — `frontend/src/components/common/TouchLockOverlay.tsx` (~line 142) — remove `transition-all duration-[400ms] scale-100 opacity-100` from the centred-padlock div. Keep the root's `transition-opacity duration-[400ms]` fade.
- [ ] **Clarify `arm` as the unlock action** — `frontend/src/hooks/useTouchLock.ts` — rename the returned `arm` to `unlock` (and every consumer and mock), or add a one-line comment at the return saying `arm` unlocks and restarts the idle countdown.
- [ ] **Move `TapPoint` to a shared types home** — `frontend/src/components/common/TouchLockOverlay.tsx`, `ChoreTimerBar.tsx`, `ChoreList.tsx`, `App.tsx` — define `TapPoint` in a small shared module (e.g. `frontend/src/types/touchLock.ts`, or wherever the repo keeps shared frontend types) and import it from there.

## Review 3
Generated: 2026-09-24
Comparison: origin/feature/permissive-lock...HEAD (commit 2c361fb, non-blocking padlock hit circle)
Verdict: **BLOCKED**

### Results by Reviewer

#### 1. Safety & Security — PASS
The destructive guard lives in `ChoreTimerBar.guardOr()`, independent of the overlay, so no pass-through tap can complete, edit or delete a chore while locked.

#### 2. Correctness — PASS
- minor — `TouchLockOverlay.tsx:37`: on a viewport under 120 px, `clampToViewport` pins the centre to 60 and the circle overflows (undocumented).
- minor — `TouchLockOverlay.tsx:93`: `hitCenter` reads `innerWidth`/`innerHeight` at render time, so a resize while the padlock shows leaves the circle stale.

#### 3. Simplicity & Conciseness — PASS

#### 4. Test Coverage — FAIL
- **major** — `App.touchLock.test.tsx` claims "the smoke proves the pass-through in Chromium" for the room tab, search and next-day. The smoke test only clicks a room tab and scrolls during the awaiting window; the search input and Next day are never tapped in Chromium while the circle shows.
- minor — the DD-22 real-browser corner-tap test seeds mid-list. It never covers the case where `raised` matters: a keyboard (0,0) seed whose circle clamps into the corner.
- minor — clamping is only checked in jsdom (acceptable: pure arithmetic).

#### 5. Completeness & Cleanup — PASS
- minor — the same inaccurate coverage claim in the `App.touchLock.test.tsx` comment.

#### 6. Consistency & Style — PASS
- minor — `TouchLockOverlay.tsx:168`: `ring-emerald-400/70` adds a new green family; the app uses `green-*`.

#### 7. Integration Risk — PASS

#### 8. Error Handling & Silent Failures — PASS

### To-Do: Required Changes

- [x] **Prove search and Next day work in Chromium while the padlock shows** — `e2e/smoke.spec.ts` (F20 test, awaiting window) — with real `page.mouse.click`s outside the circle:
  - Focus and type into the search input: the list filters. Clear it.
  - Click Next day: `Return to today` appears. Click Return to today.
  - Assert the padlock/hit area is still attached before the second tap.
  - Make the `App.touchLock.test.tsx` comment's coverage claim accurate.
- [x] **Cover the corner overlap case where `raised` matters** — `e2e/smoke.spec.ts` or `App.touchLock.test.tsx` — raise a keyboard-seeded attempt: focus a bar's sr-only Delete/Edit pill and press Enter, so the seed is (0,0) and the circle clamps into the top-left. Then click the corner (the indicator centre) and assert it unlocks via the indicator (open icon, overlay gone, `arm` called) rather than hitting the circle.
- [x] **Re-render the circle on viewport resize** — `frontend/src/components/common/TouchLockOverlay.tsx` — while mounted, track `innerWidth`/`innerHeight` in state via a `resize` listener (cleaned up on unmount) so `hitCenter` re-clamps. Add a jsdom test that changes the size, dispatches `resize`, and asserts the circle moved.
- [x] **Document the sub-120 px viewport caveat** — `frontend/src/components/common/TouchLockOverlay.tsx` — one line in the `clampToViewport` comment.
- [x] **Use the app's existing green for the opening ring** — `frontend/src/components/common/TouchLockOverlay.tsx` — `ring-emerald-400/70` → `ring-green-400/70`, and update any test asserting the class.

## Review 4
Generated: 2026-09-24
Comparison: 2118969~1...2118969 (Review 3 fixes)
Verdict: **PUSHED WITH MINOR FINDINGS**

### Results by Reviewer
All eight reviewers PASS: Safety & Security, Correctness, Simplicity, Test Coverage, Completeness, Consistency, Integration Risk, Error Handling. Every Review 3 item was verified as genuinely resolved. The Chromium search and Next-day checks pre-assert that each click lands outside the circle. The keyboard-corner test uses a real `elementFromPoint` hit-test. The resize listener is cleaned up. No `emerald` is left.
- minor (Test Coverage) — no explicit test that the `resize` listener is removed on unmount (verified by inspection).
- minor (Completeness) — the plan's "Amendment 2026-09-24" and Manual checks don't mention the resize/rotation re-clamp.

### To-Do: Required Changes

- [ ] **Pin the resize-listener cleanup** — `frontend/src/__tests__/components/TouchLockOverlay.test.tsx` — spy on `window.removeEventListener` and assert that the `resize` listener is removed on unmount.
- [ ] **Document the resize re-clamp** — `plans/feature/permissive-lock/permissive-lock.md` — add one line to the Amendment (the circle re-clamps on viewport resize/rotation) and a Manual check (rotate the kiosk while the padlock shows: the circle stays on-screen).
