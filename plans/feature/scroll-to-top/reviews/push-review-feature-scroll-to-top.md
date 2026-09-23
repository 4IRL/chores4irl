# Push Review: feature/scroll-to-top

## Review 1
Generated: 2026-09-23
Comparison: origin/main...HEAD
Verdict: **PUSHED WITH MINOR FINDINGS**

### Results by Reviewer

#### 1. Safety & Security — PASS
Purely client-side presentational button; no XSS sinks, secrets, or destructive ops.

#### 2. Correctness — PASS
No logic bugs in the threshold hook, the two-phase fade/interactive timers (re-show cancels pending timer, unmount cleanup), reduced-motion handling, or App wiring.
- (minor) One-render lag on mount when the region is already past the threshold: `isVisible` starts false and is corrected by the hook's effect, so `isInteractive` settles one render later (`ScrollToTopButton.tsx:38`). Not reachable today — the button mounts with the list at `scrollTop` 0.

#### 3. Simplicity & Conciseness — PASS
Lean diff; no dead code or premature generalization.
- (minor) `aria-hidden`, `tabIndex` and `inert` are toggled in lockstep from `isInteractive` (`ScrollToTopButton.tsx:65`); `inert` alone covers them in evergreen Chromium. Kept deliberately (META-PLAN spec requires `aria-hidden` + `tabIndex={-1}`; jsdom ignores `inert`, so the unit tests rely on the explicit attributes).

#### 4. Test Coverage — PASS
Hook (8 cases), component (9), App (3) and a real-browser e2e spec.
- (minor) The "tap during the fade-out re-scrolls" guarantee is asserted structurally and via e2e hit-testing, not by a unit click during the fade (`ScrollToTopButton.test.tsx`).

#### 5. Completeness & Cleanup — PASS
No debug code, TODOs, commented-out blocks or stray files.

#### 6. Consistency & Style — PASS
Matches `Toast.tsx`/`ClearButton.tsx` conventions (props type, `type="button"`, 44 px targets, lucide icon, named constants).

#### 7. Integration Risk — PASS
Additive-only; scroller class string, child order and F5 deck unchanged; coexists with F17's StatusCountStrip after the origin/main merge.

#### 8. Error Handling & Silent Failures — PASS
`window.matchMedia?.(…).matches ?? false` is an intentional, tested default.
- (minor) `useScrollPastThreshold` silently returns when `ref.current` is null and won't re-run if the ref populates later (documented invariant; `useScrollPastThreshold.ts:9`).

### To-Do: Required Changes

- [ ] **Add a unit case for a click during the fade-out** — `frontend/src/__tests__/components/ScrollToTopButton.test.tsx` — scroll to threshold+1, back to 0 (fading, still interactive), `fireEvent.click` the button, assert the `scrollTo` stub is called again with `{ top: 0, behavior: 'smooth' }`.
- [ ] **Decide whether to warn on a null ref in `useScrollPastThreshold`** — `frontend/src/hooks/useScrollPastThreshold.ts` — optional dev-only `console.warn` in the null branch so a future invariant violation is visible; not needed for current callers.
- [ ] **Consider seeding `isInteractive` from the initial DOM read** — `frontend/src/components/common/ScrollToTopButton.tsx` — removes the one-render mount lag if a future caller mounts the button while already scrolled.
- [ ] **Revisit the lockstep `aria-hidden`/`tabIndex`/`inert` toggles** — `frontend/src/components/common/ScrollToTopButton.tsx` — only if the spec's explicit `aria-hidden` + `tabIndex={-1}` requirement is relaxed; otherwise keep as is.
