# Push Review: feature/bar-redesign

## Review 1
Generated: 2026-06-26
Comparison: origin/main...HEAD
Verdict: **PUSHED WITH MINOR FINDINGS**

### Results by Reviewer

#### 1. Safety & Security — PASS
No XSS, injection, secrets, or unsafe data handling; all user data rendered via standard React JSX interpolation (no `dangerouslySetInnerHTML`).

#### 2. Correctness — PASS
All critical checks pass: `{...swipeHandlers}` spread first; `touch-pan-y` retained; `swipingRef` disambiguates tap vs swipe; `e.stopPropagation()` on both sr-only buttons; `isOverdue` still drives the sr-only span; Edit gated on `onEdit`; grid-cols-3 has exactly three children; Delete always rendered. Two minor polish notes:
- sr-only buttons are inside the `overflow-hidden` bar — when revealed on focus (`focus:absolute`), the focus ring may be clipped by the rounded boundary (keyboard-UX polish; swipe is primary).
- "Last Completed:" label is now sr-only, so sighted users see the raw date with no visible heading — intentional per DD-1, noted as deliberate.

#### 3. Simplicity & Conciseness — PASS
No dead code or over-engineering. Three minor maintenance notes:
- The two sr-only buttons share ~9 identical `focus:*` utilities (differ only in offset/color) — could extract a `FocusRevealButton` or `@apply` class if a third is ever added.
- `ChoreInfo` is now a trivial single-`div` wrapper — could be inlined into `ChoreTimerBar` (only if no future expansion expected).
- The three e2e cleanup `dispatchEvent('click')` call sites lack inline comments (the file-top comment block covers the rationale).

#### 4. Test Coverage — PASS
All key F6 behaviors tested (h-20/not-h-36, room removal, frequency presence, sr-only Overdue cue, delete/edit by role+aria-label, swipe delete/edit in unit + e2e). Three minor hardening gaps:
- `displays the frequency centered` asserts presence but not the `text-center` class.
- The sr-only "Overdue" span's `sr-only` class is not pinned — a regression re-introducing a visible badge would still pass.
- The Delete/Edit buttons' `sr-only` class is not pinned — a regression making them visible again would not be caught.

#### 5. Completeness & Cleanup — PASS
`TODO(#10)` gone; `OverdueBadge.tsx` deleted with no dangling imports; `Pencil`/`lucide-react` import removed; no `console.log`/debug artifacts in `e2e/smoke.spec.ts`; no commented-out old layout code.

#### 6. Consistency & Style — PASS
Component patterns (default exports, `type XProps = {}`, Tailwind style, import ordering) match conventions. Three minor polish items:
- Inline `Every {chore.frequency} days` center column is not a named sub-component, unlike its `ChoreInfo`/`CompletionInfo` peers — could extract `FrequencyInfo` for symmetry.
- `CompletionInfo` inner `<div>` repeats `text-white` already set on the outer div (pre-existing; file is touched by this diff).
- The sr-only reveal uses `focus:` rather than `focus-visible:`, so the button can un-hide on mouse-down focus in some browsers; `focus-visible:` would limit reveal to keyboard navigation (design intent).

#### 7. Integration Risk — PASS
No breaking integration: `ChoreInfo`'s sole caller (`ChoreTimerBar`) was updated for the `{name}`-only props; `OverdueBadge` has no remaining importers; `useRoomFilter` reads the data-model `room` (untouched by the display removal); all `App.test`/`ChoreList.test` aria-label/role selectors survive the sr-only change; e2e selectors updated (swipe for primary flows, `dispatchEvent` for cleanup).

### To-Do: Required Changes (all minor — non-blocking polish for a follow-up)

- [ ] **Pin the `sr-only` class on the action buttons + overdue cue in unit tests** — `frontend/src/__tests__/components/ChoreTimerBar.test.tsx` — add `expect(...).toHaveClass('sr-only')` to the Delete-button, Edit-button, and "Overdue" assertions so a regression that makes them visible again is caught.
- [ ] **Assert the frequency column is centered** — `frontend/src/__tests__/components/ChoreTimerBar.test.tsx` — in `displays the frequency centered`, also assert the `Every N days` element (or its wrapper) has class `text-center`.
- [ ] **Use `focus-visible:` instead of `focus:` for the sr-only reveal** — `frontend/src/components/chore/ChoreTimerBar.tsx` — switch the `focus:not-sr-only focus:...` chains to `focus-visible:` so mouse-down focus does not reveal the buttons (keyboard-only intent).
- [ ] **Avoid focus-ring clipping by `overflow-hidden`** — `frontend/src/components/chore/ChoreTimerBar.tsx` — consider rendering the focus-revealed sr-only buttons outside the `overflow-hidden` clip context (or accept it, since swipe is the primary affordance).
- [ ] **(Optional) Reduce focus-utility duplication** — `frontend/src/components/chore/ChoreTimerBar.tsx` — extract a `FrequencyInfo` component and/or a shared focus-reveal button/`@apply` class for symmetry with `ChoreInfo`/`CompletionInfo` and to halve the duplicated `focus:*` chains.
- [ ] **(Optional) Remove redundant `text-white`** — `frontend/src/components/chore/CompletionInfo.tsx` — drop `text-white` from the inner `<div>` (already inherited from the outer div).
- [ ] **(Optional) Comment the e2e `dispatchEvent('click')` cleanup sites** — `e2e/smoke.spec.ts` — add a brief inline comment at each of the three call sites noting it fires the sr-only button's React `onClick` (force/normal click is occluded).
