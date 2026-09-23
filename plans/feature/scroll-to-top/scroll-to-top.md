# Floating Scroll-to-Top Button (F18)

## Summary
Add a small, icon-only, translucent circular button that floats bottom-right over the chore
list, fades in once the list's scroll container is scrolled past ~80 px, and smoothly scrolls the
container back to the top (instant under `prefers-reduced-motion: reduce`). It costs nothing on the
boot view (hidden + non-interactive at `scrollTop` 0). Once scrolled back up it fades out over
500 ms and stays tappable until the fade ends (DD-8). This feature also introduces the shared
`scrollRegionRef` on the `.overflow-y-auto` element and the positioned frame around it that
`F19` (lock-time reset) and `F22` (overlay scrollbar) will reuse. Source of truth:
`plans/META-PLAN.md` → "## F18 — Floating scroll-to-top button".

## Research Findings
Research was done inline (frontend source + tests, one new read-only e2e spec and a README line;
no backend/data/sort change).
- `frontend/src/App.tsx:347` renders `<div className="flex-1 overflow-y-auto min-h-0 flex flex-col scroll-pb-40">`
  inside the column `<div className="flex flex-col h-full overflow-hidden bg-gray-900 px-4 pt-4">`;
  the F5 deck (`data-testid="add-task-deck"`) is its sticky last child. That container only
  renders in the post-`loading` return branch (the loading branch at ~`App.tsx:318` is a separate
  tree), so any listener must attach when the container actually mounts. No `scrollTo`/`scrollTop`
  exists anywhere in `frontend/src` today. `AddChoreButton`/the deck carry no z-index.
- Tests locate the scroller by class: `App.search.test.tsx:236` and `App.test.tsx:756,774,900`
  (`document.querySelector('.overflow-y-auto')`, then `lastElementChild === deck`) — the container's
  class list and its last child must stay exactly as they are.
- jsdom 29 (probed): `el.scrollTop = 200` is settable and reads back 200; `Element.prototype.scrollTo`
  and `window.matchMedia` are **undefined** — tests must stub both, and production code must guard
  `window.matchMedia` (optional call) so jsdom-based App tests don't throw on click.
- Existing conventions: `components/common/*.tsx` default-export a function component, lucide
  icons with `aria-hidden="true"` (e.g. `ClearButton.tsx`, `Toast.tsx`), 44 px touch minimums
  (`min-h-[44px] min-w-[44px]`), exported named constants with a doc comment
  (`SUCCESS_TOAST_MS`), long explanatory layout comments tying numbers to Standing invariant 12.
  Hooks live in `frontend/src/hooks/useX.ts` (named export) with tests in
  `frontend/src/__tests__/hooks/useX.test.ts` using `renderHook`.
- `Toast` (F21) is a click-through fixed frame at `bottom-40` = deck's ~5 rem footprint + 4 rem
  `-top-16` overhang, the same 10 rem that `scroll-pb-40` declares. Standing invariant 14 says
  F18's button sits beside that frame at the same `bottom-40` clearance (bottom-right vs
  bottom-centre).

## Decisions (Open risks resolved)
- **(a) jsdom has no layout:** tests set `element.scrollTop` directly, dispatch
  `fireEvent.scroll(element)`, stub `Element.prototype.scrollTo` via `vi.fn()` (restored in
  `afterEach`), and stub `window.matchMedia` with `vi.stubGlobal`/assignment per test. The
  fade-out window is driven with fake timers (`Toast.test.tsx`'s `vi.useFakeTimers()` +
  `try { … } finally { vi.useRealTimers(); }` pattern).
- **(b) Swipe interplay:** structurally avoided — the button is rendered *outside* the
  `.overflow-y-auto` element (a sibling inside the new frame), so it is never a descendant of any
  bar's `react-swipeable` handlers; a touch that lands on the visible button targets only the
  button. Once its fade-out has ended it is `pointer-events-none` and `inert`, so touches fall
  through to the bars exactly as today; during the 500 ms fade-out it stays tappable, so a tap on
  the still-visible button re-issues the scroll-to-top instead of completing the bar beneath
  (DD-8). On-Pi confirmation lives in the non-checkbox "Manual Pi checks" section after Step 6.
  Those checks are pre-merge: Step 6's last box copies them into the executor's final report and
  the `/run-feature` orchestrator carries them into the PR description (DD-7). They are not an
  executor gate.
- **(c) Modals:** leave as is — modal overlays (`z-50`, fixed) cover the button; no extra hiding.
- **(d) Lock/blank:** no lock-awareness in the button. Screen-blank's `inert` root disables it
  (desired); after `F20` makes scrolling legal while locked, the button keeps working because it
  is a scroll control, not a mutation. No code or test needed now beyond not adding a lock gate.
- **(e) Shared ref + frame:** create exactly one `scrollRegionRef = useRef<HTMLDivElement>(null)`
  in `App.tsx`, attached to the `.overflow-y-auto` element, and exactly one positioned frame
  `<div data-testid="scroll-region-frame" className="relative flex-1 min-h-0 flex flex-col">`
  wrapping it. F19/F22 reuse both (noted in comments). The F19-driven "reset hides the button"
  test belongs to F19 (whichever of F18/F19 runs second — F19 here). **Fold-back notes** (for
  `/run-feature` Phase C): F22's assumed-starting-state line ("no `ResizeObserver` or `scroll` listener
  exists in `frontend/src`") becomes stale — amend it to name `useScrollPastThreshold` and
  `scrollRegionRef` (F19's already says to reuse `scrollRegionRef` if F18 shipped first); F19's "button hidden after reset" test must `fireEvent.scroll(region)` after
  setting `scrollTop = 0`, because jsdom does not dispatch `scroll` on a programmatic `scrollTop` write.
  Since DD-8, "hidden" there means `opacity-0` at once; asserting `inert`/`aria-hidden` also needs
  `vi.advanceTimersByTime(FADE_MS)` under fake timers first (Step 2 case 3).
  Phase C must also: (1) amend Standing invariant 12 to record the shipped frame
  (`data-testid="scroll-region-frame"`, `relative flex-1 min-h-0 flex flex-col`) wrapping the
  unchanged scroller, the single `scrollRegionRef`, and the F18 button as the frame's last child
  (`absolute bottom-40 right-4`, no z-index), and reword Standing invariant 14's F18 clause from
  prospective to shipped; (2) correct every stale `App.tsx:318` outer-column reference (META-PLAN's
  Baseline frontend bullet and F22's Session loop / Assumed starting state). The outer column is
  `App.tsx:337` at the F18 baseline and moves by F18's added lines, so prefer the class-string
  anchor `flex flex-col h-full overflow-hidden bg-gray-900 px-4 pt-4`; (3) amend F22's Open risk
  (e) ("moves `flex-1 min-h-0` up to the wrapper and the scroller becomes `h-full`"), which becomes
  stale: F18's frame `data-testid="scroll-region-frame"` is `relative flex-1 min-h-0 flex flex-col`
  and the scroller keeps its exact tokens as a `flex-1` child (no `h-full`); (4) note in F22's
  section that F18's App.test "scroll-to-top button (F18)" case 1 pins the scroller's exact
  `className`. That pin is kept deliberately, because F18's spec requires the class string to be
  unchanged, so F22 updates the literal when it adds `scrollbar-none`.
- **Visibility source:** the button owns its visibility via a
  `useScrollPastThreshold(ref, thresholdPx)` hook that attaches a passive `scroll` listener to
  `ref.current` in a `useEffect`. Because `ScrollToTopButton` is rendered in the same tree branch
  as the container and after it, `ref.current` is set by the time the effect runs (refs attach in
  commit before effects). The hook also reads `scrollTop` once on attach so a remount mid-scroll is
  correct. Using a hook (not an `onScroll` prop on the container) keeps the container's JSX
  untouched apart from `ref`, and lets F22 add its own listener independently.
- **Toast overlap:** a very long *error* toast pill (`inset-x-4`, full-width, `z-[80]`) can
  overlap the button at the same `bottom-40`; the toast paints above (z-80) and is dismissed by a
  tap. Accepted — no change to the toast frame.
- **Horizontal inset (DD-1):** keep `right-4`. It is 1 rem in from the *frame's* right edge; the
  frame currently sits inside the column's `px-4`, so today the button rests 1 rem inside the bars'
  right edge (2 rem from the screen edge). Once F22 makes the frame full-bleed it lands 1 rem from
  the screen edge, aligned with the bars' re-applied inset — no F22 change needed.
- **Non-interactive = `inert` (DD-2; timing per DD-8):** besides `aria-hidden`/`tabIndex={-1}`/
  `pointer-events-none`, the non-interactive button gets `inert` (React 19 boolean prop, as
  `App.tsx` already uses). All four apply together, `FADE_MS` (500 ms) after the fade-out starts,
  not when `isVisible` flips (DD-8); at boot they apply immediately.
  Probed in Chromium (Playwright 1.59, chromium-1228): adding `inert` to a focused button moves
  `document.activeElement` to `<body>` by the next frame, and `focus()` on an inert button is a
  no-op, so a just-tapped button drops focus once its fade-out has ended and cannot then be
  keyboard-activated. jsdom 29
  does **not** honour `inert` (probed: `fireEvent.click` and `el.click()` on an `inert=""` button
  still call `onClick`, and `focus()` lands), so unit tests assert only the attribute; the
  behaviour is Chromium's.
- **Fade length matched to the scroll (DD-3):** reduced-motion *scroll* stays as spec'd (`'auto'` under
  `reduce`, `'smooth'` otherwise); the opacity fade is kept in both modes (no `motion-reduce:`
  classes) and lengthened to `duration-500`. Measured with the repo's Playwright Chromium on the
  seeded app: `scrollTo({ top: 0, behavior: 'smooth' })` took ≈ 500–516 ms from 803–903 px,
  ≈ 316 ms from 331 px and ≈ 180–194 ms from 100 px — 500 ms is the nearest standard Tailwind
  duration for a long (~1000 px) list scroll _(the Pi's Chromium build/refresh rate was not measured)_.
  The fade-out starts only when the scroll crosses 80 px (≈200 ms into a 451 px scroll, measured),
  so it trails the scroll rather than tracking it. The button stays tappable for that whole
  fade-out (DD-8).
- **Real-browser coverage (DD-6):** a read-only `e2e/scroll-to-top.spec.ts` (Step 5) checks what
  jsdom (`css: false`, no layout, no `inert`) cannot: hidden-at-load opacity + `inert`, fade-in past
  80 px, anchoring while the region scrolls, clearance above the deck's frosted overhang, click →
  back to top, the fade-out window (at its first faded frame the button is still hit-testable and
  not `inert`), and hidden + `inert` after the fade. Touch/swipe interplay remains a manual Pi check.
- **Tappable until the fade ends (DD-8):** `isVisible` (from the hook) drives only the opacity. A
  second state, `isInteractive`, drives `pointer-events-none`, `inert`, `aria-hidden` and
  `tabIndex`. It turns `true` in the effect that runs right after `isVisible` turns `true`, and
  `false` from a `setTimeout(…, FADE_MS)` started when `isVisible` turns `false`; the effect's
  cleanup clears that timer on re-show and on unmount. `FADE_MS = 500` is an exported named
  constant tied to the `duration-500` class. `isInteractive` starts `false`, so the boot view
  (`scrollTop` 0, no fade) is non-interactive immediately. Why: with a single phase, taps during
  the ~500 ms fade-out fell through the still-visible button to the chore bar beneath and completed
  it (measured in Chromium with `elementFromPoint`, pass-2 review). A tap during the fade now just
  calls `scrollTo` top again, which is harmless. The mirror case is accepted: on fade-in the button
  is interactive from the moment `scrollTop` passes 80 px while still nearly transparent, so a tap
  there scrolls to the top instead of reaching a bar (no mutation). The same holds for the last
  ~130 ms of the fade-out: from opacity < 0.05 until `FADE_MS` elapses, an almost-invisible button
  still takes a tap, which only re-scrolls to the top (measured per frame in Chromium: 0 frames
  where the button was painted but not hit-testable). Covered by Step 2 cases 1 and
  3–5, Step 3 case 2 and the Step 5 fade-frame assertion.
- **Unblank while scrolled (accepted):** screen-blank only overlays and sets `inert` on the root.
  It never remounts App or resets the scroller, and F19 resets on lock only. So until F19 ships, a
  list left scrolled past 80 px when the 21:00 blank engages wakes at 06:00 with the button
  visible, matching the scrolled content under it. The spec's "pixel-identical to today" holds for
  boot and for any view at the top, and F19's lock-engage reset (`scrollTop` 0 → hidden) covers the
  kiosk case. No code or test change.
- **Manual Pi checks are pre-merge (DD-7):** no skill surfaces them on its own.
  `.claude/skills/run-feature/SKILL.md`'s Phase B is one two-option question that never reads the
  plan, and `/git-push` composes its PR body from the diff with its own template (`# Summary`,
  `## Problem`, `## Solutions`, `## Verification Steps` with a "How to manually verify (if
  applicable)" bullet). The path is therefore:
  1. Step 6's last box has the executor copy the "Manual Pi checks" bullets verbatim into its final
     report under the heading "Manual checks for the user (pre-merge)". This matches
     next-step-taker's "If the plan specifies manual verification steps, list them for the user".
  2. The `/run-feature` orchestrator ran `/run-plan`, so it holds that report, and it also runs
     `/git-push` in Phase A step 9. It adds the bullets to the PR body as a `## Manual test plan`
     section after `## Verification Steps`. For an already-open PR it uses the `gh pr edit` body
     update that `/git-push` performs. If that report is not available (e.g. a resumed session
     after Step 6 was ticked earlier), copy the bullets verbatim from this plan's "Manual Pi
     checks" section instead.
  3. The user runs them on the Pi, on the feature branch, before answering Phase B. Phase B's "The
     feature works correctly on its branch (you've verified it)" confirmation covers them.

  Item 2 is an instruction to the orchestrator in this plan, not something either skill does
  automatically.
- **Sibling-safe orchestrator Playwright runs (DD-9):** `/run-plan` runs `$UI_RUNNER_CMD` itself:
  the 2c smoke run after UI-affecting Steps 1–3 and 5, and the final suite in its own Step 3. This
  worktree's git-ignored `.claude/skill-config.md` now sets `ui_runner_cmd`, `test_run_cmd` and
  `test_run_built_cmd` to `env -u PLAYWRIGHT_BASE_URL CI=1 npx playwright test`. The orchestrator
  made that change before this plan runs; it is local to the worktree and not part of the PR. Those
  runs therefore can no longer adopt a sibling `c4i-wt-*` worktree's dev servers on :3000/:5174.
  With `CI=1` a busy port fails loudly instead (`… is already used …` or `webServer was not able
  to start`). That is a port conflict, not a code failure, so it is not a Test Fix Loop input:
  retry, and if it persists the orchestrator stops and ends its own summary with an
  `UNRESOLVED — requires user decision/action: … ports occupied` line (it owns no plan box; on
  resume it simply re-runs the suite).
  Likewise, if `scroll-to-top.spec.ts` fails with `getByTestId('scroll-to-top')` "element(s) not
  found" while smoke passes, a sibling's servers were adopted. Re-run in the sibling-safe form and
  do not edit the component.

## Steps

All commands run from the repo root; `frontend`-scoped commands use a `(cd frontend && …)`
subshell so the working directory never moves. **Orchestrator note:** every Playwright run,
including `/run-plan`'s own `$UI_RUNNER_CMD` runs, follows Decisions → DD-9: use the sibling-safe
form, and treat a port-in-use failure as a port conflict, not a Test Fix Loop input.

### 1. `useScrollPastThreshold` hook (TDD)
Create a reusable hook that reports whether a ref'd scroll element is scrolled past a threshold.

**To-do:**
- [x] **Red:** create `frontend/src/__tests__/hooks/useScrollPastThreshold.test.ts`. Build a real
  element (`const scrollElement = document.createElement('div'); document.body.appendChild(scrollElement)`),
  a ref object `{ current: scrollElement }`, and `renderHook(() => useScrollPastThreshold(ref, 80))`. Cases:
  1. returns `false` when `scrollElement.scrollTop === 0`;
  2. after `scrollElement.scrollTop = 81; act(() => { fireEvent.scroll(scrollElement); })` returns `true`;
  3. at exactly `scrollElement.scrollTop = 80` returns `false` (strictly-greater-than semantics);
  4. returning below (`scrollElement.scrollTop = 10` + scroll event) returns `false` again;
  5. reads the initial position on mount: set `scrollElement.scrollTop = 200` *before* `renderHook` → `true`;
  6. `ref.current === null` → returns `false` and does not throw;
  7. unmount removes the listener: spy `scrollElement.removeEventListener` and assert it was called with
     `'scroll'` and the same handler that `addEventListener` received (spy both).
  Run `(cd frontend && npx vitest run src/__tests__/hooks/useScrollPastThreshold.test.ts)` → fails
  (module not found).
- [x] **Green:** create `frontend/src/hooks/useScrollPastThreshold.ts`:
  ```ts
  import { useEffect, useState } from 'react';
  import type { RefObject } from 'react';

  /** True while `ref.current.scrollTop` is strictly greater than `thresholdPx`. The element must be mounted by the time the caller's effects run (render the caller alongside, after, the scroller). */
  export function useScrollPastThreshold(ref: RefObject<HTMLElement | null>, thresholdPx: number): boolean {
      const [isPast, setIsPast] = useState(false);
      useEffect(() => {
          const scrollElement = ref.current;
          if (!scrollElement) return;
          const update = () => setIsPast(scrollElement.scrollTop > thresholdPx);
          update();
          scrollElement.addEventListener('scroll', update, { passive: true });
          return () => scrollElement.removeEventListener('scroll', update);
      }, [ref, thresholdPx]);
      return isPast;
  }
  ```
  Re-run the test file → green. Then, from the repo root, run `npm run lint` and
  `npx tsc --noEmit -p frontend` — both exit 0.
- [x] **Refactor:** keep naming/idiom consistent with `useMidnightClock.ts`; re-run → green; then
  from the repo root `npm run lint` and `npx tsc --noEmit -p frontend` — both exit 0.
  - ✅ Step 1 COMPLETE (2026-09-23): red confirmed (module not found); hook tests green (7 planned cases + 1 review-added threshold-change case = 8/8); `npm run lint` and `npx tsc --noEmit -p frontend` exit 0. Review fix: the null-ref branch now resets `isPast` to `false` (no stale `true`).

### 2. `ScrollToTopButton` component (TDD)
Presentational button that consumes the hook and scrolls the ref'd container to the top.

**To-do:**
- [x] **Red:** create `frontend/src/__tests__/components/ScrollToTopButton.test.tsx`. Harness:
  a test component that renders `<div data-testid="scroller" ref={ref} />` then
  `<ScrollToTopButton scrollRegionRef={ref} />` (`ref = useRef<HTMLDivElement>(null)`), so the
  ref is attached before the button's effect, mirroring App. Import the default export plus the
  named `SCROLL_TO_TOP_THRESHOLD_PX` and `FADE_MS`, and `act` from `@testing-library/react`.
  `beforeEach`: `Element.prototype.scrollTo = vi.fn()`; `afterEach`:
  `delete (Element.prototype as Partial<Element>).scrollTo` (not `as any` —
  `@typescript-eslint/no-explicit-any` is an error in `eslint.config.js`),
  `vi.unstubAllGlobals()`. Fake timers follow `Toast.test.tsx`'s pattern: a case that needs them
  calls `vi.useFakeTimers()` first and wraps the rest of its body in
  `try { … } finally { vi.useRealTimers(); }`, advancing time only inside
  `act(() => { vi.advanceTimersByTime(…); })`. Two local helpers keep the cases short:
  `expectNonInteractive(button)` checks `aria-hidden="true"`, `tabIndex` `-1`,
  `toHaveAttribute('inert')` and a class containing `pointer-events-none`;
  `expectInteractive(button)` checks there is no `aria-hidden` attribute, `tabIndex` `0`,
  `not.toHaveAttribute('inert')` and a class without `pointer-events-none`. Below, "scroll to N"
  means `scroller.scrollTop = N; fireEvent.scroll(scroller)`, and "threshold + 1" means
  `SCROLL_TO_TOP_THRESHOLD_PX + 1`. Cases (query via `screen.getByTestId('scroll-to-top')`, since
  an `aria-hidden` button isn't reachable by role):
  1. (fake timers, no time advanced) mount at `scrollTop` 0: class contains `opacity-0` and
     `expectNonInteractive` holds immediately, because the boot view has no fade and so no
     tappable window; `aria-label="Scroll to top"`; `type="button"`;
  2. scroll to threshold + 1 → class contains `opacity-100`, `expectInteractive` holds, and
     `screen.getByRole('button', { name: 'Scroll to top' })` now resolves;
  3. (fake timers) scroll to threshold + 1, then to 0 → at once the class contains `opacity-0`
     (and not `opacity-100`), but `expectInteractive` still holds (no `inert`, no
     `pointer-events-none`); after `vi.advanceTimersByTime(FADE_MS - 1)` still interactive; after
     one more `vi.advanceTimersByTime(1)` → `expectNonInteractive`;
  4. (fake timers) scroll to threshold + 1, then to 0, then `vi.advanceTimersByTime(FADE_MS - 1)`
     → `expect(vi.getTimerCount()).toBe(1)`; scroll to threshold + 1 again →
     `vi.getTimerCount()` is `0` (the re-show cancelled the pending timer); after
     `vi.advanceTimersByTime(FADE_MS)` the class contains `opacity-100` and `expectInteractive`
     holds;
  5. (fake timers) `const { unmount } = render(…)`; scroll to threshold + 1, then to 0 →
     `vi.getTimerCount()` is `1`; after `unmount()` it is `0`;
  6. click when visible (no `matchMedia` defined — jsdom default) → with `const scrollToMock = vi.mocked(Element.prototype.scrollTo)`:
     `toHaveBeenCalledTimes(1)`, `toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })`, and
     `expect(scrollToMock.mock.contexts[0]).toBe(screen.getByTestId('scroller'))` (the prototype
     stub is shared, so the receiver must be checked); cases 7–8 use the same receiver check;
  7. `vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)', media: query })))`
     → click calls `scrollTo` with `{ top: 0, behavior: 'auto' }`;
  8. `matchMedia` stubbed with `matches: false` → `behavior: 'smooth'`;
  9. class contains `absolute`, `right-4`, `bottom-40`, `rounded-full`, `transition-opacity`,
     `duration-500`, `min-h-[44px]`, `min-w-[44px]`, and no `z-` utility (`not.toMatch(/\bz-/)`).
  The timer counts in cases 4–5 are exact. In the planning dry-run `vi.getTimerCount()` read 1 at
  mount (the no-op hide timer), 0 while visible, 1 while fading, 0 after a re-show and 0 after
  unmount. Mutation probes against the Green file: dropping the effect's `clearTimeout` cleanup
  fails cases 4–5, a 0 ms delay fails cases 3–4, and `inert={!isVisible}` fails case 3.
  No unit case clicks the *non-interactive* button expecting no `scrollTo`: jsdom 29 ignores
  `inert` (probed — `fireEvent.click` on an `inert=""` button still calls `onClick`), so such a
  case would fail against correct code. The attribute is asserted here and its behaviour in
  Chromium (Step 5, plus the Decisions probe).
  Run `(cd frontend && npx vitest run src/__tests__/components/ScrollToTopButton.test.tsx)` → fails.
- [x] **Green:** create `frontend/src/components/common/ScrollToTopButton.tsx` with exactly this
  content (the Step 6 greps count strings in it; `type ScrollToTopButtonProps = {…}` follows the
  `type <Component>Props` convention of `ClearButton.tsx`/`Toast.tsx`):
  ```tsx
  import { useEffect, useState } from 'react';
  import type { RefObject } from 'react';
  import { ArrowUp } from 'lucide-react';
  import { useScrollPastThreshold } from '../../hooks/useScrollPastThreshold';

  /** Scroll distance (px) past which the button shows: one `h-20` chore bar. */
  export const SCROLL_TO_TOP_THRESHOLD_PX = 80;

  /** Opacity fade length in ms; must equal the `duration-500` class on the button. The button stays tappable until a fade-out of this length has ended. */
  export const FADE_MS = 500;

  // bottom-40 (10 rem) = the F5 deck's ~5 rem footprint (py-4 + the 44 px
  // button ≈ 81 px) + its 4 rem -top-16 frosted overhang: the same 10 rem that
  // scroll-pb-40 declares and Toast uses (Standing invariants 12 & 14). right-4
  // is 1 rem in from the frame's right edge; the frame currently sits inside the
  // column's px-4, so today the button rests 1 rem inside the bars' right edge
  // (2 rem from the screen). Once F22 makes the frame full-bleed it lands 1 rem
  // from the screen edge, aligned with the bars' re-applied inset, with no F22
  // change needed. Tailwind needs literal class strings, so this constant is the
  // class string, not a number.
  const OFFSET_CLASSES = 'bottom-40 right-4';

  type ScrollToTopButtonProps = {
      scrollRegionRef: RefObject<HTMLDivElement | null>;
  };

  export default function ScrollToTopButton({ scrollRegionRef }: ScrollToTopButtonProps) {
      const isVisible = useScrollPastThreshold(scrollRegionRef, SCROLL_TO_TOP_THRESHOLD_PX);

      // Two-phase visibility: `isVisible` drives the opacity at once, while the
      // non-interactive state (pointer-events-none, inert, aria-hidden,
      // tabIndex -1) lands only after the FADE_MS fade-out. A tap on the
      // still-visible, fading button therefore hits the button (a harmless
      // second scroll-to-top) instead of falling through to, and completing,
      // the chore bar beneath. Starts false: the boot view (scrollTop 0) has no
      // fade, so it has no tappable window.
      const [isInteractive, setIsInteractive] = useState(false);
      useEffect(() => {
          if (isVisible) {
              setIsInteractive(true);
              return;
          }
          const timer = setTimeout(() => setIsInteractive(false), FADE_MS);
          return () => clearTimeout(timer);
      }, [isVisible]);

      const handleClick = () => {
          const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
          scrollRegionRef.current?.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
      };

      // Positioned against the scroll region's frame, never inside
      // .overflow-y-auto; no z-index (later in DOM than the scroller, so it
      // paints above it). inert once non-interactive drops focus from a
      // just-tapped button and blocks keyboard activation. duration-500 ≈
      // Chromium's smooth-scroll duration for a long list; visibility flips
      // only when the scroll crosses 80 px near its end, so the fade-out trails
      // the scroll by up to ~0.5 s. The fade is kept under reduced motion; only
      // the scroll becomes instant.
      return (
          <button
              type="button"
              data-testid="scroll-to-top"
              aria-label="Scroll to top"
              aria-hidden={isInteractive ? undefined : true}
              tabIndex={isInteractive ? 0 : -1}
              inert={!isInteractive}
              onClick={handleClick}
              className={`absolute ${OFFSET_CLASSES} flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-gray-700/70 text-white shadow-lg transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}${isInteractive ? '' : ' pointer-events-none'}`}
          >
              <ArrowUp className="w-5 h-5" aria-hidden="true" />
          </button>
      );
  }
  ```
  `inert={boolean}` on a `<button>` type-checks on React 19 / `@types/react` 19, and
  `eslint-plugin-react-hooks` is 5.2.0 here, so the `setIsInteractive(true)` call inside the effect
  is not flagged. In the planning dry-run this exact file, with the Step 1 hook and the Step 2
  cases written to temp files in `frontend/src`, passed
  `(cd frontend && npx vitest run src/__tests__/components/ScrollToTopButton.test.tsx)` (9 passed),
  `npm run lint` and `npx tsc --noEmit -p frontend` (both exit 0).
  Re-run the test file → green. Then, from the repo root, run `npm run lint` and
  `npx tsc --noEmit -p frontend` — both exit 0.
- [x] **Refactor:** match `ClearButton.tsx`/`Toast.tsx` style (4-space indent, comment density),
  keeping the strings the Step 6 greps count (`inert={!isInteractive}`,
  `export const FADE_MS = 500;`, `transition-opacity duration-500`) intact; re-run → green; then
  from the repo root `npm run lint` and `npx tsc --noEmit -p frontend` — both exit 0.
  - ✅ Step 2 COMPLETE (2026-09-23): red confirmed (module not found); component created verbatim from the Green block; 9/9 component cases green; full vitest 339/339; `npm run lint` and `npx tsc --noEmit -p frontend` exit 0. Review fix: renamed the test helper `scrollTo` → `scrollScrollerTo` so it isn't confused with the stubbed `Element.prototype.scrollTo`.

### 3. Shared `scrollRegionRef` + positioned frame in `App.tsx` (TDD)
Wire the button into App outside the scroller, inside one new positioned frame.

**To-do:**
- [ ] **Red:** in `frontend/src/__tests__/App.test.tsx`, first add `afterEach` to the line-1 vitest import
  (`import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';` — vitest `globals: true`
  hides the omission at runtime but `tsc --noEmit -p frontend` fails with TS2304). Then add `describe('scroll-to-top button (F18)', …)`
  after the `'Add Task deck (F5)'` block, with `beforeEach` `vi.clearAllMocks()` +
  `vi.mocked(fetchAllChores).mockResolvedValue([makeChore()])`, `Element.prototype.scrollTo = vi.fn()`
  (removed in `afterEach` via `delete (Element.prototype as Partial<Element>).scrollTo`). Cases (wait for `screen.getByText('Sweep')` first):
  1. the button exists, is **not** a descendant of `.overflow-y-auto`
     (`expect(region!.contains(button)).toBe(false)`), and its `parentElement` is the frame
     `screen.getByTestId('scroll-region-frame')` whose class contains `relative`, and that frame
     contains the region (`frame.contains(region)`); the region's `className` is exactly
     `'flex-1 overflow-y-auto min-h-0 flex flex-col scroll-pb-40'` and its `lastElementChild` is
     still the deck; `document.querySelectorAll('.overflow-y-auto')` has length 1;
  2. hidden and non-interactive immediately on load, with no timer, because the boot view has no
     fade window: `aria-hidden="true"`, `inert` attribute present, `tabIndex` `-1`, class contains
     `opacity-0` and `pointer-events-none`;
  3. `region.scrollTop = 200; fireEvent.scroll(region)` → visible (class contains `opacity-100`,
     no `inert` attribute); clicking it calls the
     prototype stub once with `{ top: 0, behavior: 'smooth' }` and
     `vi.mocked(Element.prototype.scrollTo).mock.contexts[0]` is `region`, and leaves filters untouched (the
     `Sweep` bar is still rendered, `(screen.getByLabelText('Search for a chore') as HTMLInputElement).value` is unchanged `''` (the input is `type="text"`, role `textbox`), and the day offset is untouched (`expect(screen.queryByText('Return to today')).toBeNull()`)).
  Run `(cd frontend && npx vitest run src/__tests__/App.test.tsx)` → new cases fail.
- [ ] **Green:** in `frontend/src/App.tsx`:
  - `import ScrollToTopButton from './components/common/ScrollToTopButton';` alongside the other
    `components/common` imports.
  - Declare `const scrollRegionRef = useRef<HTMLDivElement>(null);` near the other refs, with a
    comment: the single ref on the `.overflow-y-auto` scroller, shared by F18 (read/scroll), F19
    (reset on lock) and F22 (overlay thumb) — never add a second ref on that element.
  - Wrap the existing scroller in
    `<div data-testid="scroll-region-frame" className="relative flex-1 min-h-0 flex flex-col">`,
    add `ref={scrollRegionRef}` to the scroller **without changing its className**, and render
    `<ScrollToTopButton scrollRegionRef={scrollRegionRef} />` as the frame's last child (after the
    scroller). Add a brief comment: the frame is the positioned ancestor F18's button (and later
    F22's thumb) anchor against, so they neither scroll away nor become sticky children of the
    deck's region; one frame only.
  Re-run `App.test.tsx` → green. Then, from the repo root, run `npm run lint` and
  `npx tsc --noEmit -p frontend` — both exit 0.
- [ ] Run `(cd frontend && npx vitest run src/__tests__/App.search.test.tsx src/__tests__/App.test.tsx)`
  and confirm the F5 deck tests and the F9 "search input is outside the scroll region" test pass
  unchanged.

### 4. README one-liner
Document the button in the repo-root README's `## How prioritization works` section (META-PLAN's
"UI overview"; README has no heading by that name).

**To-do:**
- [ ] In the repo-root `README.md` (not `deploy/pi/README.md` or `.github/rulesets/README.md`), directly after the paragraph ending "…preview how the bars will look on
  future days." (just above `### Adding and editing chores`), add one sentence: "Once the list is
  scrolled down, a small ↑ button fades in at the bottom right; tapping it scrolls smoothly back
  to the top (instantly when the OS asks for reduced motion) (`frontend/src/components/common/ScrollToTopButton.tsx`)."
- [ ] Verify from the repo root: `grep -n "ScrollToTopButton" ./README.md` returns the new line.

### 5. Real-browser e2e spec `e2e/scroll-to-top.spec.ts`
Cover in Chromium what jsdom (`css: false`, no layout, ignores `inert`) cannot: opacity, `inert`,
anchoring, deck clearance, the fade-out window (DD-8) and the real smooth scroll. The component already exists by this step,
so this is **write spec → run → green**; TDD red for the behaviour was covered by the unit layers
(Steps 1–3). (During planning, this exact spec run before the component existed failed at its
first button assertion with `getByTestId('scroll-to-top')` "element(s) not found", after its
overflow precondition passed.)

Conventions (from `e2e/smoke.spec.ts` + `playwright.config.ts`): `testDir: './e2e'`, chromium
`Desktop Chrome` (1280×720), `retries: CI ? 1 : 0`; with `PLAYWRIGHT_BASE_URL` unset the config
boots the backend (`npm run dev --workspace backend` → `http://localhost:3000`) and frontend
(`npm run dev --workspace frontend` → `http://localhost:5174`), `reuseExistingServer: !CI`. The
backend seeds 10 chores (`backend/src/db.ts` `SEED_DATA`) into the repo-root `data.db` only when
the table is empty; `smoke.spec.ts` mutates rows (completes chores, adds then deletes its own
chores), so this spec must not depend on row order, row count beyond the seed's 10 rows, names
beyond the seed's `Vacuum Bedroom Floor` load marker, or smoke's run order. CI's `npm run test:e2e`
runs both files concurrently in separate workers, and smoke's temporary rows only lengthen the
list, so the overflow/anchoring assertions still hold. It must never tap a chore bar or the deck
(a click that falls through the button once it is non-interactive would complete a chore), so it
leaves data unchanged. Smoke pins the clock to noon before `goto` because `useScreenBlank` reads the wall
clock (21:00–06:00 blanks the app); do the same.

**To-do:**
- [ ] Create `e2e/scroll-to-top.spec.ts`:
  ```ts
  import { test, expect } from '@playwright/test';

  // F18: real-browser checks jsdom can't make (vitest runs with css: false, no layout, and jsdom
  // ignores `inert`). Read-only: never taps a chore bar or the deck, so seed data is unchanged and
  // nothing depends on smoke.spec.ts's mutations, run order, or running concurrently with it (CI
  // runs both files in parallel workers).
  test.describe('Scroll-to-top button (F18)', () => {
      test.beforeEach(async ({ page }) => {
          // Desktop Chrome width, shorter height: the 10-row seed overflows the scroller by ~450 px
          // (measured; ~330 px at the default 720 px height), comfortably past the 80 px threshold.
          await page.setViewportSize({ width: 1280, height: 600 });
          // Same noon pin as smoke.spec.ts — keeps useScreenBlank out of its 21:00–06:00 window.
          await page.clock.setFixedTime(new Date(2025, 0, 15, 12, 0, 0));
          await page.goto('/');
          await page.waitForSelector('text=Vacuum Bedroom Floor', { timeout: 10_000 });
      });

      test('hidden at the top, fades in past 80 px, stays anchored clear of the deck, and scrolls back to the top', async ({ page }) => {
          const region = page.locator('.overflow-y-auto');
          const button = page.getByTestId('scroll-to-top');

          const overflowPx = await region.evaluate(el => el.scrollHeight - el.clientHeight);
          expect(overflowPx).toBeGreaterThan(200);

          // toBeVisible() treats opacity:0 as visible, so assert the computed opacity instead.
          await expect(button).toHaveCSS('opacity', '0');
          await expect(button).toHaveAttribute('inert', '');

          await region.evaluate(el => { el.scrollTop = 150; });
          await expect(button).toHaveCSS('opacity', '1');
          await expect(button).not.toHaveAttribute('inert');
          const anchoredBox = await button.boundingBox();
          if (!anchoredBox) throw new Error('Could not get bounding box for scroll-to-top button');

          // Scrolling further must not move it (anchored to the frame, not inside the scroller).
          await region.evaluate(el => { el.scrollTop = el.scrollHeight; });
          await expect.poll(() => region.evaluate(el => el.scrollTop)).toBeGreaterThan(150);
          expect(await button.boundingBox()).toEqual(anchoredBox);

          // Clear of the deck plus its 4 rem (64 px) frosted -top-16 overhang.
          const deckBox = await page.getByTestId('add-task-deck').boundingBox();
          if (!deckBox) throw new Error('Could not get bounding box for add-task deck');
          expect(anchoredBox.y + anchoredBox.height).toBeLessThanOrEqual(deckBox.y - 64);

          await button.click();
          // Stays tappable while it fades: sample every frame in the page until the opacity first
          // drops below 1; at that frame `inert` (applied FADE_MS = 500 ms after the fade starts) must
          // still be absent and the button's centre must hit-test to the button, not a chore bar.
          const firstFadeFrame = await button.evaluate(el => new Promise<{ inert: boolean; hitsButton: boolean }>(resolve => {
              const sample = () => {
                  if (Number(getComputedStyle(el).opacity) < 1) {
                      const rect = el.getBoundingClientRect();
                      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
                      resolve({ inert: el.hasAttribute('inert'), hitsButton: el.contains(hit) });
                  } else {
                      requestAnimationFrame(sample);
                  }
              };
              sample();
          }));
          expect(firstFadeFrame).toEqual({ inert: false, hitsButton: true });

          await expect.poll(() => region.evaluate(el => el.scrollTop)).toBe(0);
          await expect(button).toHaveCSS('opacity', '0');
          await expect(button).toHaveAttribute('inert', '');
      });
  });
  ```
  Expected geometry at 1280×600 (measured on the seeded app): region overflow 451 px; deck box
  `y` 520, so the overhang top is 456; the frame's bottom is the viewport bottom (600), so
  `bottom-40` puts the 44 px button's bottom edge at 440 ≤ 456. The fade-frame check samples
  every animation frame inside the page and stops at the first frame whose opacity is below 1,
  which comes within a frame or two of the flip. `inert` lands `FADE_MS` (500 ms) later, so the
  check has a ~500 ms margin. In the planning dry-run it passed 10/10
  (`--repeat-each 10 --retries 0`, two workers), and it failed on the single-phase variant
  (`inert`/`aria-hidden`/`tabIndex`/`pointer-events-none` keyed on `isVisible`) with a `toEqual`
  mismatch. Then from the repo root run `npm run lint` and
  `npx tsc --noEmit --strict --module esnext --moduleResolution bundler --target es2022 --skipLibCheck --lib es2022,dom e2e/scroll-to-top.spec.ts`,
  both exit 0. The second command is needed because `e2e/` is outside `-p frontend` and eslint here
  is not type-aware. Dry-run on a temp copy of this spec at that path: exit 0; with an injected
  type error: TS2322, exit 2; with the file missing: exit 2.
- [ ] From the repo root run `env -u PLAYWRIGHT_BASE_URL CI=1 npx playwright test e2e/scroll-to-top.spec.ts`
  (sibling `c4i-wt-*` worktrees may hold ports 3000/5174) → 1 passed. A `1 flaky` result (failed
  once, passed on the CI retry) is a failure to investigate, not a pass. If it fails with the
  port-in-use / `webServer was not able to start` error, retry about every 30 s (jittered) for up
  to ~10 min. If the ports are still occupied after that, leave this box unticked, write directly
  under it `UNRESOLVED — requires user decision/action: e2e ports occupied (<the ss -ltnp line(s)
  for :3000/:5174, if available>)`, end your final report with that same `UNRESOLVED — requires
  user decision/action: …` line (the token /run-plan 2b stops on), and stop — never tick it, kill
  listeners, drop `CI=1`, or edit `playwright.config.ts`. On a later run where the spec passes,
  delete that UNRESOLVED marker line before ticking the box. Any other failure is a real failure:
  fix the code or spec, not the assertion's intent.

### 6. Verify All Tests Pass
Run the full suites and the expected-end-state checks.

**To-do:**
- [ ] `(cd frontend && npx vitest run)` — all suites green.
- [ ] `npx tsc --noEmit -p frontend`,
  `npx tsc --noEmit --strict --module esnext --moduleResolution bundler --target es2022 --skipLibCheck --lib es2022,dom e2e/scroll-to-top.spec.ts`
  and `npm run lint` at the root — each exits 0.
- [ ] `npm run build --workspace frontend` — builds cleanly.
- [ ] Confirm `e2e/smoke.spec.ts` has no selector that counts buttons
  (`grep -nE "locator\('button'\)\.count|getAllByRole\('button'\)|toHaveCount" e2e/smoke.spec.ts`
  prints exactly 5 `toHaveCount` hits — lines 155, 177, 219, 278, 310 — all on
  `.bg-gray-800.rounded-full` chore-bar locators that cannot match the `bg-gray-700/70` button; any
  other hit, or a hit whose locator targets `button`, is a failure). Smoke's `swipeBar` left swipe
  starts at 90% of the bar width with raw `page.mouse`, which is not actionability-checked. At
  1280 px (`#root` max 768 px) that point is about 72 px or more inside the frame's right edge,
  clear of the button's 16–60 px span, and `scrollIntoViewIfNeeded` centres the bar away from the
  `bottom-40` band. So a visible button cannot swallow smoke's swipe. On the 600 px Pi the same 90%
  point falls inside the button's span, which is the accepted overlap in Manual Pi checks. Then run
  the whole e2e suite the way CI does: `.github/workflows/ci.yml` runs `npm run test:e2e`
  (`playwright test` over all of `./e2e`, both files in parallel workers). Because sibling
  `c4i-wt-*` worktrees exist, run it as `env -u PLAYWRIGHT_BASE_URL CI=1 npx playwright test` →
  every test passes (15 passed in the planning dry-run: smoke's 14 plus this feature's 1). Any
  `flaky` or `failed` count is a failure to investigate, not a pass: `CI=1` enables `retries: 1`,
  so a test that failed once and passed on retry prints `N flaky`. If it fails with the
  port-in-use / `webServer was not able to start` error, retry about every 30 s (jittered) for up
  to ~10 min. If the ports are still occupied after that, leave this box unticked, write directly
  under it `UNRESOLVED — requires user decision/action: e2e ports occupied (<the ss -ltnp line(s)
  for :3000/:5174, if available>)`, end your final report with that same `UNRESOLVED — requires
  user decision/action: …` line (the token /run-plan 2b stops on), and stop — never tick it, kill
  listeners, drop `CI=1`, or edit `playwright.config.ts`. On a later run where the suite passes,
  delete that UNRESOLVED marker line before ticking the box.
- [ ] Expected-end-state greps: `grep -rn 'data-testid="scroll-to-top"' frontend/src/components`
  (1 hit); `grep -n 'flex-1 overflow-y-auto min-h-0 flex flex-col scroll-pb-40' frontend/src/App.tsx`
  (1 hit, unchanged); `grep -rn "scrollRegionRef" frontend/src/App.tsx` (at least the declaration, the `ref=` and the prop; a comment naming it adds a line);
  `grep -n "SCROLL_TO_TOP_THRESHOLD_PX\|OFFSET_CLASSES" frontend/src/components/common/ScrollToTopButton.tsx` (4 lines: each constant's declaration and its one use);
  `grep -c "inert={!isInteractive}" frontend/src/components/common/ScrollToTopButton.tsx`,
  `grep -c "export const FADE_MS = 500;" frontend/src/components/common/ScrollToTopButton.tsx` and
  `grep -c "transition-opacity duration-500" frontend/src/components/common/ScrollToTopButton.tsx`
  (each prints `1`); `grep -c "getByTestId('scroll-to-top')" e2e/scroll-to-top.spec.ts` (prints `1`).
  (A `0` count exits 1 — that is a failed gate, not a tolerable miss.)
- [ ] Investigate and fix any failures before marking the plan finished. After any fix, re-run
  every earlier box in this step.
- [ ] Copy the bullets of the "Manual Pi checks" section below verbatim into your final report
  under the heading **Manual checks for the user (pre-merge)**. You cannot perform them. The
  `/run-feature` orchestrator puts them into the PR description as a `## Manual test plan` section
  (Decisions → DD-7). The copy lives only in your report, not in any file.

## Manual Pi checks (pre-merge, reported to the user — not executor checkboxes)
These need a finger on the Pi's touchscreen, so no executor step performs or ticks them. No skill
surfaces them automatically; the path is (Decisions → DD-7): Step 6's last box copies these
bullets into the executor's final report, the `/run-feature` orchestrator adds them to the PR
description as a `## Manual test plan` section, and the user runs them on the Pi, on the feature
branch, before answering Phase B. Phase B's "The feature works correctly on its branch (you've
verified it)" confirmation covers them.
- A tap on the visible button scrolls to the top and does not start a bar swipe (open risk b).
- The button never intercepts bar taps once its fade-out has ended (it is `pointer-events-none` +
  `inert` then). A re-tap during the ~0.5 s fade-out lands on the fading button and just scrolls to
  the top again; it must not complete the bar beneath.
- A left (edit) swipe that starts at a bar's right end inside the button's band (≈ 160–204 px above
  the bottom of the scroll region, `bottom-40` + the 44 px button) while the button is visible: on
  the 600 px-wide Pi this band overlaps bars' right ends — a known, accepted overlap; observe and
  report whether the swipe starts, the tap lands on the button, or neither happens (desktop Chromium
  CDP touch probe at 600×1024: neither — the touch never reaches the bar and a moved touch fires no click).
- A flick-scroll that starts on the visible button still scrolls the list, or report that the
  button is a small scroll dead zone. (Desktop Chromium CDP touch probe at 600×1024: a flick starting
  on the button scrolled the list, 150 → 179 px, with no click.)

## Status
finished: false
