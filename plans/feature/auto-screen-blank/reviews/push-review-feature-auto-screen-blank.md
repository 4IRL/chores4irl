# Push Review: feature/auto-screen-blank

## Review 1
Generated: 2026-07-08 10:34
Comparison: origin/main...HEAD
Verdict: **BLOCKED**

### Results by Reviewer

#### 1. Safety & Security — PASS
Frontend-only change (new hook, new component, App.tsx wiring, test/e2e updates, one META-PLAN.md doc note). No backend/API/DB/config touched. No dangerouslySetInnerHTML/innerHTML/eval/dynamic script injection. No hardcoded secrets. No destructive operations — the DD-6 auto-dismiss effect only clears local React dialog state, never deletes data. No OWASP Top 10 category applies (no network/auth/persistence surface in this diff).

#### 2. Correctness — PASS
Boundary math (`isWithinBlankWindow`/`nextBoundary`) hand-verified against all edge cases including exact-boundary equality; matches existing tests. The `recompute-on-fire` + `rearmTick` pattern correctly reschedules against a fresh `Date()` on every fire. No race between the window-boundary timer, inactivity timer, and visibilitychange listener. Two minor observations (below), neither a functional defect.

#### 3. Simplicity & Conciseness — PASS
The `rearmTick` counter, the separate `App.screenBlank.realClock.test.tsx` file, and the `inert` + auto-dismiss-effect combination were each individually verified as earning their complexity (the reviewer even deleted `rearmTick` and reran tests to confirm it protects a real edge case). No dead code or unused imports found.

#### 4. Test Coverage — **FAIL**
One major gap: no test (unit or e2e) proves a real pointer click/tap on the underlying app is actually blocked while blanked. The existing "swallows the tap" unit test only clicks the overlay's own DOM element directly; the e2e DD-7 test only checks keyboard Tab-focus reachability. Nothing exercises a real click at the on-screen coordinates of an underlying chore bar to confirm the overlay's real-browser stacking/hit-testing actually intercepts it — this is the feature's core safety property (accidental taps during blank hours can't mutate chore state) and it's currently unverified against a real regression (e.g. wrong z-index, missing `fixed inset-0`, a CSS build issue). Three additional minor coverage gaps noted below.

#### 5. Completeness & Cleanup — PASS
No debug code, no commented-out blocks, no TODO/FIXME/HACK strings. All comments explain non-obvious WHY (portal/inert interaction, fake-timer/jsdom limitations). No stub functions remain in shipped code (plan-doc "stub" references describe completed intermediate TDD steps). META-PLAN.md edit is accurate against the shipped `ScreenBlankOverlay` behavior.

#### 6. Consistency & Style — PASS
No naming/casing/window-global violations. Import ordering matches surrounding conventions. `useScreenBlank.ts` mirrors `useChoreEvents.ts`'s multi-effect/listener style (appropriate given its scope); `ScreenBlankOverlay.tsx` mirrors `ConfirmDialog.tsx`'s portal structure. Three minor stylistic deviations noted below (native `<button>` vs `div[role=button]`, `z-[100]` vs the codebase's existing `z-50` ceiling, missing WHY-comment on the scheduling effect).

#### 7. Integration Risk — PASS
No backend/dependency changes. `App.tsx`'s only consumer is `main.tsx`. Traced the new `[isBlanked]` auto-dismiss effect against the existing SSE re-pull gate (`isRepullGated`/`flushPendingRefresh`) — clearing `pendingDeleteId`/`editingId`/`showForm` correctly flushes any deferred re-pull via the pre-existing gate-release effect, and since the app is already covered by the opaque overlay, a re-pull firing during blank causes no visible clobbering. No infinite-loop risk (effect deps are `[isBlanked]` only). One minor UX note below (in-flight add-form submission).

#### 8. Error Handling & Silent Failures — PASS
Confirmed premise: zero try/catch, zero `.catch()`, zero async/Promise usage in the new production code — pure timer/event/DOM logic. All `setTimeout`/`addEventListener` calls are symmetrically paired with cleanup. Nothing to swallow. Pre-existing try/catch blocks in `App.tsx`'s chore handlers are untouched and out of scope.

### To-Do: Required Changes

- [ ] **Add a real-browser pointer-click regression test proving the overlay blocks taps on underlying UI** — `e2e/smoke.spec.ts` — While the screen-blank overlay is visible (reuse the existing 23:00 clock-pin + reload from the DD-7 test), issue a real click at the on-screen coordinates of an underlying chore bar (e.g. via the chore bar's bounding box, or `page.mouse.click(x, y)`) and assert: (a) the click does not trigger a chore-completion network call / state change, and (b) the overlay is still visible afterward. This proves the overlay's real-browser stacking/z-index/hit-testing genuinely intercepts pointer input, which is the feature's core safety property and is currently unverified by any test (the existing "swallows the tap" unit test only clicks the overlay's own element; the e2e DD-7 test only covers keyboard Tab-focus).
- [ ] **Add a negative-path keyboard test for `ScreenBlankOverlay`** — `frontend/src/__tests__/components/ScreenBlankOverlay.test.tsx` — Add a test firing `keyDown` with a key other than Enter/Space (e.g. `'a'`) and asserting `onWake` was NOT called, to catch a regression that loosens the key-filter check.
- [ ] **Add a chained multi-boundary-crossing test** — `frontend/src/__tests__/hooks/useScreenBlank.test.ts` — Add a test that advances fake timers through two full day/night cycles (e.g. 20:59:59 → 21:00 → +9h → 06:00 → +15h → 21:00 again) within one hook lifetime, asserting `isBlanked` flips correctly at each crossing, to prove the `rearmTick`-keyed reschedule effect keeps re-arming across repeated cycles, not just the first transition.
- [ ] **Add the reverse-direction `visibilitychange` resync test** — `frontend/src/__tests__/hooks/useScreenBlank.test.ts` — The existing resync test only covers "blanked → hidden while clock advances past 06:00 → visible un-blanks." Add the mirrored case: "outside window → hidden while clock advances past 21:00 → visible re-blanks," since that half of the resync path is currently unverified.
- [ ] **Add a successive-activity / listener-cleanup test for the inactivity timer** — `frontend/src/__tests__/hooks/useScreenBlank.test.ts` — Add a test with 2-3 successive `pointerdown`/`keydown` activity events spaced under 5 minutes apart, confirming `isBlanked` never flips true until inactivity actually exceeds 5 minutes since the *last* event (not the first). Optionally spy on `removeEventListener` to confirm the document listeners are detached once `awake` flips back to `false`.
- [ ] **(Optional) Bump `rearmTick` unconditionally in the `visibilitychange` handler** — `frontend/src/hooks/useScreenBlank.ts:34` — Currently the handler only calls `setInWindow(...)`. If a tab is hidden long enough to cross an even number of window boundaries, `inWindow` can land back on its original value, React bails the identical `setState`, and the boundary-timer's stale `nextBoundary()` reference isn't rescheduled until it next fires (self-heals then, so not a permanent bug, but worth closing for correctness symmetry with the timer-fire path).
- [ ] **(Optional) Document the `rearmTick`/boolean-vs-Date rationale** — `frontend/src/hooks/useScreenBlank.ts` and/or `plans/feature/auto-screen-blank/auto-screen-blank.md` — `rearmTick` exists because recomputing into a 2-valued boolean (unlike `useMidnightClock`'s always-distinct `Date`) doesn't guarantee React re-runs the effect on an unchanged value. This reasoning is sound but undocumented anywhere in code or the plan; a short comment (mirroring `useChoreEvents.ts`'s documentation style) or plan note would make it discoverable.
- [ ] **(Optional) Consider a native `<button>` instead of `div[role="button"]`** — `frontend/src/components/common/ScreenBlankOverlay.tsx:6` — Every other interactive control in the codebase (`ConfirmDialog`'s actions, `AddChoreButton`) uses a real `<button>`. A `<button className="fixed inset-0 ...">` would cover the same full-screen click target while getting keyboard activation/focus semantics for free, removing the need for the manual `onKeyDown` Enter/Space handling.
- [ ] **(Optional) Use `z-50` instead of the one-off `z-[100]`** — `frontend/src/components/common/ScreenBlankOverlay.tsx:10` — `ConfirmDialog`/`ChoreFormModal` both use `z-50`, already the highest stacking value elsewhere in the codebase; `z-50` would suffice here too unless there's a concrete conflict requiring going higher.

## Review 2
Generated: 2026-07-08 10:40
Comparison: origin/main...HEAD (8 commits)
Verdict: **PUSHED**

### Summary
Commit `652a5e8` fixed the 5 required Test Coverage items from Review 1 (real-browser pointer-click regression test in `e2e/smoke.spec.ts`, negative-path keyboard test, chained multi-boundary-crossing test, reverse-direction `visibilitychange` resync test, successive-activity test) plus the two low-risk optional items (unconditional `rearmTick` bump on `visibilitychange`, rationale comment). The two purely-stylistic optional items (native `<button>`, `z-50` vs `z-[100]`) were intentionally left as-is — cosmetic preference, not required for correctness.

Two fresh subagents re-verified: one confirmed all 5 required Test Coverage fixes genuinely close the gaps (read the actual test assertions, not just commit messages — e.g. confirmed the e2e test clicks real on-screen coordinates of a chore bar via its bounding box and asserts both "no completion PATCH fired" and "overlay itself disappeared" as positive proof the click was routed to the overlay). The other re-verified the remaining 7 dimensions are still clean after the fix commit (the one production change — an unconditional `rearmTick` bump — was traced for infinite-loop/render-storm risk and confirmed safe: the listener only fires on genuine browser visibility transitions, one bump per event, no cascade).

**All 8 reviewers now PASS** (1 trivial optional minor note on Test Coverage: no dedicated test for the "hidden across an even number of boundaries" self-heal scenario for the just-added unconditional rearm — this mirrors the original finding's own "optional" framing and does not block push). Pushed following this review.
