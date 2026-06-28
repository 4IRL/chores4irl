# Push Review: feature/swipe-actions

## Review 1
Generated: 2026-06-26
Comparison: origin/main...HEAD
Verdict: **PUSHED WITH MINOR FINDINGS**

### Results by Reviewer

#### 1. Safety & Security — PASS
No secrets, no unsafe DOM/injection, no destructive ops. `react-swipeable` is a popular zero-dependency library; its addition is the intended feature. Clean.

#### 2. Correctness — PASS
The `swipingRef` lifecycle correctly suppresses the trailing post-swipe click without eating genuine taps (flag set only in `onSwipedLeft`/`onSwipedRight`, cleared at gesture start and on consumption). Spread-before-explicit-props order preserves `onClick`/`className`/`data-testid`. `isSimulating` guards are consistent; swipe-right correctly guards optional `onEdit`. No type errors.

#### 3. Simplicity & Conciseness — PASS
Implementation is minimal; a boolean ref is the right tool (no over-engineering). Two minor notes (helper duplication, harmless dual-reset).

#### 4. Test Coverage — PASS
All 7 specified new behaviors have unit tests; App-level + e2e swipe paths covered. One minor gap (no dedicated test for swipe-right when `onEdit` is omitted).

#### 5. Completeness & Cleanup — PASS
No debug artifacts, no stray `.only`/`.skip`, no leftover throwaway debug spec, no commented-out code. The `TODO(#10)` was intentionally updated (not orphaned).

#### 6. Consistency & Style — PASS
Matches repo conventions closely (function component, className templates, descriptive names, `vi.fn()`/`fireEvent`/testid queries, `^` caret range). Three minor style notes.

#### 7. Integration Risk — PASS
No breaking changes — reuses existing `onDelete`/`onEdit` props, ChoreList/App untouched, ~1.4 KB gzip zero-dep library, React-19 peer, lockfile correctly recorded. One minor forward note for F6 (already captured in the META-PLAN F5 recorded contract).

### To-Do: Optional Minor Improvements (non-blocking; address via `/next-step-taker push-review-feature-swipe-actions` if desired)

- [ ] **Extract the duplicated `swipe()` test helper** — `frontend/src/__tests__/components/ChoreTimerBar.test.tsx`, `frontend/src/__tests__/App.test.tsx` — Move the identical 4-line mouse-swipe helper into a shared module (e.g. `frontend/src/__tests__/helpers/swipe.ts`, mirroring `fixtures/chore.ts`) and import it in both files to avoid future drift.
- [ ] **Add a swipe-right-with-no-`onEdit` unit test** — `frontend/src/__tests__/components/ChoreTimerBar.test.tsx` — Render `ChoreTimerBar` without the optional `onEdit` prop, perform a right swipe, and assert no exception is thrown and `onComplete` is not called (covers the `if (!isSimulating && onEdit)` guard).
- [ ] **Move the new hooks to the top of `ChoreTimerBar`** — `frontend/src/components/chore/ChoreTimerBar.tsx` — Relocate `const swipingRef = useRef(false)` and `const swipeHandlers = useSwipeable(...)` above the existing `useMemo`/`computeBar` derived values, to match the repo's "all hooks first" component pattern (style only; not a rules-of-hooks violation).
- [ ] **Move the e2e `swipeBar` helper to module scope** — `e2e/smoke.spec.ts` — Define `swipeBar` above the `test.describe(...)` block for consistency with the file's structure.
- [ ] **(Optional) Add a brief inline comment on the `swipingRef` dual-reset / spread-order** — `frontend/src/components/chore/ChoreTimerBar.tsx` — Note that `swipingRef` is cleared both at gesture start (touch path, no trailing click) and on consumption (mouse path), and that `{...swipeHandlers}` must stay spread before `onClick`; this also serves as the F6 refactor guard (preserve `touch-pan-y` + spread order).
