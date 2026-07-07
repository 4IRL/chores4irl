# Push Review: feature/swipe-direction-swap

## Review 1
Generated: 2026-07-02 14:45
Comparison: origin/feature/swipe-direction-swap...HEAD
Verdict: **PUSHED WITH MINOR FINDINGS**

### Results by Reviewer

#### 1. Safety & Security — PASS
Diff only adjusts swipe-reveal opacity math (inline numeric style values) and matching tests; no unsanitized input, secrets, or destructive operations.

#### 2. Correctness — PASS
Reveal-progress math (clamped `|offset| / (width * CONFIRM_THRESHOLD)`, zero-guarded when width is 0) and the fill→icons→bar DOM reordering are internally consistent; the bar is a `relative` sibling painted last, so it still fully occludes both reveal layers at rest.

#### 3. Simplicity & Conciseness — PASS (1 minor)
- `barWidthPx()` (a `getBoundingClientRect()` read) is called directly in the render body to compute `revealDistance`, so it runs on every render (including each `onSwiping` re-render). Same `width * CONFIRM_THRESHOLD` calc is duplicated in `pastThreshold()`.

#### 4. Test Coverage — PASS (1 minor)
- The new proportional-fade test only asserts the background layer's opacity at 0.5 progress. The icon `<span>` now uses the same `revealProgress` inline style but its intermediate-value fade is never directly asserted (existing tests only check icon opacity at full progress).

#### 5. Completeness & Cleanup — PASS
No debug code, commented-out blocks, TODO/FIXME markers, stubs, or stray fixtures.

#### 6. Consistency & Style — PASS (1 minor)
- `revealDistance`/`revealProgress` read `getBoundingClientRect()` directly in the render body rather than via `useMemo` (as `daysSince` does). Minor perf/style inconsistency, not a correctness bug.

#### 7. Integration Risk — PASS
Fully internal to `ChoreTimerBar.tsx`; no props/exports/signatures changed. Sole consumer `ChoreList.tsx` unaffected; no other file (incl. e2e) references the removed `-z-10` class or reveal-layer DOM order.

### To-Do: Required Changes

- [ ] **Deduplicate the confirm-threshold distance calc** — `frontend/src/components/chore/ChoreTimerBar.tsx` — Extract `barWidthPx() * CONFIRM_THRESHOLD` into a single helper used by both the render-time `revealDistance` and `pastThreshold()`, optionally capturing the width once per swipe (e.g. on swipe start) to avoid a layout read on every `onSwiping` re-render.
- [ ] **Assert icon proportional fade at a non-boundary value** — `frontend/src/__tests__/components/ChoreTimerBar.test.tsx` — In the new "fades ... proportionally" test, also assert the trash icon's containing `<span>` has opacity ≈ 0.5 at the half-threshold swipe, e.g. `expect(Number((trash?.closest('span') as HTMLElement).style.opacity)).toBeCloseTo(0.5, 5)`, so the icon opacity can't silently decouple from the background.
