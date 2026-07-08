# Push Review: feature/touch-lock

## Review 1
Generated: 2026-07-08 14:00
Comparison: origin/main...HEAD
Verdict: **BLOCKED**

### Results by Reviewer

#### 1. Safety & Security — PASS
No XSS, injection, secrets, destructive ops, or OWASP concerns. Purely client-side, in-memory UI state; no I/O, no crypto, no untrusted-string-into-DOM paths.

#### 2. Correctness — FAIL
- **Major**: `App.tsx`'s `justRelocked` derivation (`const justRelocked = isLocked && !wasLockedRef.current; wasLockedRef.current = isLocked;`) mutates a ref by reading-then-writing it directly in the render body. The app is wrapped in `<StrictMode>` (`frontend/src/main.tsx`), which double-invokes function component render bodies in dev builds. The first invocation mutates `wasLockedRef.current` to `true`; the second invocation (whose output is what actually commits) then reads the already-mutated ref and computes `justRelocked = false`. Net effect: the "just relocked" entrance flash (backdrop + centered padlock) silently never plays in development builds on the real `isLocked` false→true transition. No production impact (React strips double-invocation in prod builds). `App.touchLock.test.tsx` doesn't catch this because RTL's `render()` isn't wrapped in `StrictMode`.
- **Minor**: `TouchLockOverlay.tsx`'s `handleKeyDown` calls `registerTap(0, 0)` on every `Enter`/`Space` keydown without checking `event.repeat`. A single held key (which fires repeated native `keydown` events at the same fixed `(0,0)` coordinates) can satisfy the "close-enough double-tap" unlock condition — undermining the two-distinct-interactions intent on the keyboard-activation path specifically (the primary touch/click path is unaffected).

#### 3. Simplicity & Conciseness — PASS
Two minor duplicate-`useEffect` observations (mergeable `isBlanked`/`isLocked` dialog-close effects in `App.tsx`; two mount-only effects in `TouchLockOverlay.tsx` that could combine) — no functional issue, just avoidable duplication.

#### 4. Test Coverage — FAIL
- **Major**: No test (unit or e2e) proves SSE-driven chore re-pull (`isRepullGated`) keeps flowing while `isLocked: true`. The design explicitly requires lock state to stay out of `isRepullGated`'s conditions; a future regression coupling them would silently stop live chore updates for most of the kiosk's runtime (locked is the default idle state) with no test catching it.
- **Major**: The new e2e test only proves `inert` blocks one of the six gated surfaces (tap-to-complete). Swipe-edit, swipe-delete, "+ Add Task", room-filter, and search have no real-browser proof of being blocked while locked — a regression where any of those escapes the `.App` inert subtree would go undetected.
- **Minor** (×3): `justRelocked`'s App-level derivation is only tested via `TouchLockOverlay`'s isolated prop-driven test, not a real `isLocked` transition at the App level; the Space-bar keyboard-activation path is untested (only Enter is exercised); the `phase === 'opening'` early-return guard is only tested via a repeated keydown, not a repeated click (jsdom bypasses `pointer-events-none`, so the internal guard is the only real jsdom-level protection against a double `onArm()` call via click).

#### 5. Completeness & Cleanup — PASS
No debug artifacts, no TODO/FIXME, no stub code, no orphaned files. Load-bearing comments spot-checked against actual code and found accurate.

#### 6. Consistency & Style — PASS
One minor finding: `useTouchLock.ts` exports `INACTIVITY_MS`, diverging from `useScreenBlank.ts`'s equivalent (module-private) constant — the export is currently unused (the new hook test hardcodes the literal instead of importing it).

#### 7. Integration Risk — PASS
No backend/package changes. `inert={isBlanked || isLocked}` is purely additive to F1's existing `inert={isBlanked}` gate. All six `<App/>` test call sites correctly mock the new hook. Z-index layering confirmed non-conflicting repo-wide.

#### 8. Error Handling & Silent Failures — PASS
No try/catch, no swallowed errors, no unjustified fallbacks in any new code. Pre-existing App.tsx error handling untouched and intact.

#### 9. Type Design — PASS
Two minor documentation-only findings: the `Phase` union doesn't structurally capture that `'idle'` doesn't guarantee `firstTapRef` is null (guarded only by a runtime elapsed-time check, documented only near the mutation site rather than near the type); `isLocked`/`isClosing` are two independent booleans that type-permit but runtime-prevent the meaningless `isLocked && isClosing` combination, relying on an unstated cross-module invariant in `useTouchLock.arm()`. Both fail safe if ever violated — no latent bug, just missing documentation.

### To-Do: Required Changes

- [x] **Fix the `justRelocked` ref mutation to be StrictMode-safe** — `frontend/src/App.tsx` (~line 296) — Move the `wasLockedRef.current = isLocked` write into a `useEffect(() => { wasLockedRef.current = isLocked; }, [isLocked])` instead of mutating it directly in the render body, so React 18/19's dev-mode double-render doesn't corrupt the previous-value tracking before the committed render reads it. Verify the "just relocked" entrance flash still fires correctly in a StrictMode-wrapped dev build (or add/extend a test that would catch the regression) after the change.
- [x] **Ignore key-repeat in the overlay's keyboard-activation path** — `frontend/src/components/common/TouchLockOverlay.tsx` (`handleKeyDown`, ~line 93) — Add `&& !event.repeat` to the Enter/Space condition so a single held key cannot satisfy the double-tap unlock gate via repeated native keydown events.
- [x] **Add a test proving SSE re-pull keeps flowing while locked** — `frontend/src/__tests__/App.touchLock.test.tsx` — Set `mockUseTouchLock` to `{ isLocked: true, arm: mockArm }`, fire a `FakeEventSource` "chores changed" message (mirroring `App.sync.test.tsx`'s existing pattern), and assert `fetchAllChores` is re-invoked / displayed chore data updates despite the lock being engaged — guards against `isRepullGated` ever accidentally gaining a lock-state dependency.
- [x] **Extend e2e coverage to prove more than one gated surface is blocked while locked** — `e2e/smoke.spec.ts` — Add at least a swipe gesture and a "+ Add Task" tap via raw `page.mouse` events during the locked state, asserting no confirm-dialog/form opens and no edit/delete/create request fires, mirroring the existing tap-to-complete blocking assertion.
- [x] **Add App-level test coverage for the `justRelocked` transition** — `frontend/src/__tests__/App.touchLock.test.tsx` — After a mocked `isLocked` false→true transition, assert `screen.getByTestId('touch-lock-backdrop')` appears immediately, and that a second consecutive rerender with `isLocked` still `true` does not show it again.
- [x] **Add a Space-bar keyboard-activation test** — `frontend/src/__tests__/components/TouchLockOverlay.test.tsx` — Duplicate the existing double-Enter qualifying-tap test using `{ key: ' ' }` (and/or a mixed Enter+Space pair).
- [x] **Add a click-during-`opening`-phase regression test** — `frontend/src/__tests__/components/TouchLockOverlay.test.tsx` — After a qualifying second tap (phase now `'opening'`), fire an additional `fireEvent.click` and assert `onArm` is still only called once (jsdom bypasses `pointer-events-none`, so this exercises the internal `phase === 'opening'` guard directly).
- [x] **Merge the duplicate dialog-close effects** — `frontend/src/App.tsx` (~line 132) — Combine the `isBlanked`-keyed and `isLocked`-keyed effects (both doing the same three `setState(null/false)` calls) into one: `useEffect(() => { if (isBlanked || isLocked) { setPendingDeleteId(null); setEditingId(null); setShowForm(false); } }, [isBlanked, isLocked]);`
- [x] **Combine TouchLockOverlay's two mount-only effects** — `frontend/src/components/common/TouchLockOverlay.tsx` (~line 30) — Merge the entrance-timer-scheduling effect and the cleanup-only effect into one `useEffect(..., [])`, returning `clearPendingPhaseTimer` (reusing the existing helper instead of duplicating its logic inline).
- [x] **Drop the unused `INACTIVITY_MS` export or use it** — `frontend/src/hooks/useTouchLock.ts` (line 3) — Either remove `export` to match `useScreenBlank.ts`'s module-private convention, or have `frontend/src/__tests__/hooks/useTouchLock.test.ts` import and use it instead of hardcoding the literal `5 * 60 * 1000`.
