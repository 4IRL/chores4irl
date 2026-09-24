# Push Review: feature/overlay-scrollbar

## Review 1
Generated: 2026-09-23
Comparison: origin/main...HEAD
Verdict: **PUSHED WITH MINOR FINDINGS**

### Results by Reviewer

#### 1. Safety & Security — PASS
This is pure frontend layout and measurement work. It adds no network calls, no `innerHTML`, `dangerouslySetInnerHTML` or `eval`, and every style value is a number the code computes; no user input reaches it. No findings.

#### 2. Correctness — PASS
`computeThumbGeometry` never divides by zero: it returns `null` when the region doesn't overflow or the track is empty. It clamps the thumb height to [`MIN_THUMB_PX`, track] and the scroll ratio to [0, 1]. The hand-checked cases match the tests, and effect cleanup and timer restarts are correct. No findings.

#### 3. Simplicity & Conciseness — PASS
Both the hook and the component have two real call sites (the list and the form), so the top/bottom inset parameters are justified.
- (minor) `FADE_IN_MS`/`FADE_OUT_MS` duplicate the literal `duration-150`/`duration-400` Tailwind classes. Only comments and a test that pins the constants' values keep them in step.

#### 4. Test Coverage — PASS
The hook, the component, and both App and ChoreForm integrations are well covered, and the e2e spec checks real-browser geometry.
- (minor) `ChoreSearchInput`'s and `DateNavigationBanner`'s new `px-4` is covered only by the generic App-level inset loop, with no named unit assertion.
- (minor) The scroll-ratio clamp in `computeThumbGeometry` has no test for `scrollTop < 0` or `scrollTop >` its maximum (overscroll).

#### 5. Completeness & Cleanup — PASS
No debug code, TODOs, commented-out code or stray files, and the comments match the code. No findings.

#### 6. Consistency & Style — PASS
The code closely mirrors the `ScrollToTopButton`/`useScrollPastThreshold` pair.
- (minor) `e2e/overlay-scrollbar.spec.ts:92` has a single-letter local, `const m = await readThumb(false)`.

#### 7. Integration Risk — PASS
No breaking interface, config or dependency changes. F19's (PR #56) `scrollTop = 0` on lock will flash the thumb, which META-PLAN risk (b) already accepts.
- (minor) This branch and PR #56 both edit the same `META-PLAN.md` ledger block and insert a `README.md` paragraph at the same anchor. Whichever merges second hits a trivial keep-both conflict.

#### 8. Error Handling & Silent Failures — PASS
There is no error-handling surface: no try/catch, async code or I/O. The guard branches are legitimate no-ops. No findings.

#### 9. Type Design — PASS
`ThumbGeometry` and `OverlayScrollbarProps` are minimal. The one invariant, that the thumb stays inside its track, is enforced at the only place geometry is built.
- (minor) `{ geometry, isVisible }` allows the state "visible with no geometry". It's harmless because the only consumer returns early when geometry is `null`. A discriminated union would be worth it only if a second consumer appears.
- (minor) This is the same fade-constant/class-literal pairing as Simplicity's finding.

### To-Do: Required Changes

- [ ] **Resolve the fade-constant/class-literal duplication** — `frontend/src/components/common/OverlayScrollbar.tsx`, `frontend/src/__tests__/components/OverlayScrollbar.test.tsx` — either drop the exported `FADE_IN_MS`/`FADE_OUT_MS` (the Tailwind literals `duration-150`/`duration-400` become the only source), or make the test assert that the rendered className contains `` `duration-${FADE_IN_MS}` `` / `` `duration-${FADE_OUT_MS}` `` so drift is caught. Do not template the class string, because Tailwind's scanner needs literals.
- [ ] **Add named inset assertions** — `frontend/src/__tests__/components/ChoreSearchInput.test.tsx`, `frontend/src/__tests__/components/DateNavigationBanner.test.tsx` — assert that each component's root className contains `px-4`, following the `ReturnToTodayButton`/`StatusCountStrip` tests.
- [ ] **Test the overscroll clamp** — `frontend/src/__tests__/hooks/useScrollIndicator.test.ts` — add `computeThumbGeometry` cases for `scrollTop = -50` and `scrollTop = scrollHeight`, asserting `top` stays within [`trackInsetTopPx`, `trackInsetTopPx + track - height`].
- [x] **Rename the single-letter local** _(done 2026-09-23 with the last-bar alignment change: `metrics` / `atEnd`)_ — `e2e/overlay-scrollbar.spec.ts:92` (and the same pattern around :104) — rename `m` to `metrics` (or `atEnd`) to match the nearby `mid`.
- [ ] **Keep both edits when resolving the conflict with PR #56** — `plans/META-PLAN.md` ledger block and `README.md` UI prose — whichever of F22/F19 merges second keeps both ledger-row edits and both README paragraphs. There is no semantic overlap. Noted in the PR description.
- [ ] **(Deferred, conditional) Make the hook's return a discriminated union** — `frontend/src/hooks/useScrollIndicator.ts` — only if a second consumer of `useScrollIndicator` appears, change the return to `{ isVisible: false } | { isVisible: true; geometry: ThumbGeometry }`. No action while `OverlayScrollbar` is the only consumer.
