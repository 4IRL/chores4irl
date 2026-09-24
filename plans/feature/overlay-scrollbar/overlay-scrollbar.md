# Fading Overlay Scrollbar + Full-Bleed Scroll Region (F22)

## Summary
Hide the native scrollbar on the chore-list scroller and on the Add/Edit form's scroll box, and
draw a thin, indicator-only overlay thumb instead. It is invisible at rest, appears while the
region scrolls, and fades about 1 s after scrolling stops. The list thumb's track ends above the
frosted Add Task deck (the shared `bottom-40` line), so the thumb never enters the deck zone. In
the same change, the outer column's `px-4` moves onto the header rows and `ChoreList`'s content,
so the scroll container, the `F5` frost backing and the thumb reach both screen edges. Source of truth: `plans/META-PLAN.md` →
"## F22 — Fading overlay scrollbar + full-bleed scroll region". Frontend only: no backend, data or
sort change.

**For the `/run-feature` operator:** the *Manual Pi checks* section at the end of this plan is
the content of the PR body's "How to manually verify" bullet when `/git-push` opens the PR (Phase
A step 9). The executor also copies it into its final report at Step 8. Make sure it lands in the
PR body. Put the *Fold-back notes for Phase C* below right after it, in the same "How to manually
verify" bullet under their own heading line: the PR body is their only carrier to `/run-feature`
Phase C step 3, which folds F22's durable facts into the META-PLAN's Standing invariants (no
SKILL.md line reads this plan's Decisions, and the META-PLAN's F22 section is deleted at fold-back).

**Fold-back notes for Phase C** (user, 2026-09-23; DD-7):
- **Invariant 12's re-check rule** gains `LIST_THUMB_BOTTOM_INSET_PX` (`App.tsx`, unexported,
  160 px): any change to the deck's height or overhang re-checks it alongside `scroll-pb-*` and
  the `bottom-40` line.
- **The list thumb's track stops 160 px above the frame bottom.** This is a deliberate departure
  from the META-PLAN's unclamped full-height formula (user, 2026-09-23): the thumb is
  `track · clientHeight / scrollHeight` tall over `track = clientHeight − 160`, clamped to
  `[MIN_THUMB_PX, track]`, and never enters the deck/frost zone.
- **Invariant 14's shared `bottom-40` line** gains the thumb's relation: the thumb's track stops
  at that line and never enters it. The thumb sits at the frame's right edge, so it never meets the
  centred button. On the Pi (frame spans the viewport) it never meets the toast either; on desktop
  viewports wider than 800 px a long toast pill can cover the lower track, harmlessly (`z-[80]`).
- **Invariant 16** records the strip's inset decision: its root's `w-full` is **replaced** by
  `mx-4` (16 px inset, `rounded-sm` kept; `w-full` + `mx-4` would overflow by 32 px).
- **The form card** is wrapped in a card-sized `<div className="relative w-full max-w-md">`
  (backdrop-click semantics unchanged); its `OverlayScrollbar` sits after the card inside that
  wrapper with top and bottom track insets of 12 px (`FORM_THUMB_TRACK_INSET_PX`, the
  `rounded-xl` radius).

## Research Findings
Research came from three parallel subagents: architecture, dependencies and tests.
- `frontend/src/App.tsx:349` is the outer column `flex flex-col h-full overflow-hidden bg-gray-900 px-4 pt-4`.
  Its children, in order: `NavBar` (`:350`), `StatusCountStrip` (`:351`), `DateNavigationBanner`
  (`:352-357`), `ReturnToTodayButton` (`:358`), `ChoreSearchInput` (`:359`), then the
  `scroll-region-frame` (`:364`, `relative flex-1 min-h-0 flex flex-col`). The frame holds the
  scroller (`:365`, `ref={scrollRegionRef}`, `flex-1 overflow-y-auto min-h-0 flex flex-col scroll-pb-40`)
  and, as its last child, `<ScrollToTopButton scrollRegionRef={scrollRegionRef} />` (`:389`). The
  comment at `:360-363` already reserves the frame for "later F22's thumb". The loading-branch
  `mx-auto px-4` at `:332` is a separate tree and out of scope.
- Test pins:
  - `App.test.tsx:810` pins the scroller's **exact** className. Update it in the same change.
  - Five assertions pin `scroller.lastElementChild === add-task-deck`: `App.test.tsx:761/777/811/974`
    and `App.statusStrip.test.tsx:75`. So the thumb must be a **frame** child, never inside the
    scroller.
  - `App.test.tsx:801` requires exactly one `.overflow-y-auto` while no modal is open.
  - `App.statusStrip.test.tsx:68` pins `#NavBar.nextElementSibling === strip`. Insets therefore go
    on component roots, never on wrapper divs.
  - `StatusCountStrip.test.tsx:120-124` forbids `rounded-full` / `overflow-y-auto` on the strip,
    because e2e locates bars by `.bg-gray-800.rounded-full`. The thumb must not carry `bg-gray-800`
    either.
  - No test pins `px-4`, `w-full`, `rounded-sm`, `rounded-xl`, `max-h-[90dvh]` or the `ChoreForm`
    card structure.
- jsdom 29 has neither `ResizeObserver` nor `window.matchMedia`, and `setup.ts` polyfills only
  `EventSource`.
  - The hook must guard `typeof ResizeObserver !== 'undefined'`. Without the guard, every
    `App*.test.tsx`, `ChoreForm*` and `ChoreFormModal` test throws on mount.
  - Vitest runs with `css: false`, so tests can assert className strings only.
  - `scrollTop` is writable in jsdom. `scrollHeight`/`clientHeight` are read-only getters that
    return 0, so stub them per instance with `Object.defineProperty(el, 'scrollHeight', { value, configurable: true })`
    or with `vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get')`.
  - The fake-timer idiom, `try { … } finally { vi.useRealTimers(); }` with `vi.getTimerCount()`
    restart and unmount assertions, is in `ScrollToTopButton.test.tsx:74-139`.
- The F18 pair is the pattern to mirror: `components/common/ScrollToTopButton.tsx` (default export,
  `RefObject` prop, exported JSDoc'd numeric constants, literal Tailwind class-string constants, no
  z-index, paints above the scroller by DOM order) and `hooks/useScrollPastThreshold.ts` (named
  export, `useEffect` on `[ref, …]`, passive `scroll` listener plus cleanup). Hook tests go in
  `src/__tests__/hooks/<hook>.test.ts` and component tests in `src/__tests__/components/<Name>.test.tsx`.
- `ChoreFormModal.tsx:15-19` cancels on `event.target === event.currentTarget`, and `ChoreForm` is
  the backdrop's only child. A wrapper around the card must be card-sized (`w-full max-w-md`) so
  that clicks beside the card still land on the backdrop. `ChoreFormModal.test.tsx:13-25` guards
  this only for clicks dispatched on the backdrop node itself. jsdom does no hit-testing, so the
  wrapper's size is proved by Step 5's exact-className pin and by e2e Test 3's click beside the
  card. `ChoreForm.tsx:75` is the card `bg-gray-800 rounded-xl p-6 w-full max-w-md overflow-y-auto max-h-[90dvh]`.
  It is itself the scroller and is not positioned.

## Decisions (Open risks resolved)
- **Mechanism, visibility and pointer behaviour follow the META-PLAN's binding user choices.** The
  thumb is an in-app overlay: native bar hidden via `.scrollbar-none`, indicator only,
  `pointer-events-none` + `aria-hidden`, no `role`, `opacity-0` at rest, visible on each `scroll`
  event with a restartable ≈ 1 s idle timer.
- **No mount flash** (user, 2026-09-23). The thumb renders at `opacity-0` on mount, so the
  boot/unblank view stays pixel-identical. It becomes visible only on a `scroll` event.
- **(a) Touch momentum:** every `scroll` event restarts the idle timer, so the thumb stays up until
  scrolling actually stops. No extra code is needed; a hook test covers the restart.
- **(b) Programmatic scrolls:** `F18`'s `scrollTo` (and later `F19`'s reset) fire `scroll`, so the
  thumb flashes. This is accepted (iOS does the same) and needs no "programmatic" flag. The same
  applies when a search keystroke, room-tab change or day step shrinks the list while it is
  scrolled down: the browser clamps `scrollTop` and fires `scroll`, so the thumb flashes too. That
  is accepted on the same terms. Both are listed under the manual Pi checks in case they read as
  noise on the wall.
- **(c) Gutter:** `.scrollbar-none` declares both `scrollbar-width: none` and
  `::-webkit-scrollbar { display: none }`. The e2e spec proves the **rule applies**: it asserts
  `toHaveCSS('scrollbar-width', 'none')` on the list scroller and the form card in real Chromium.
  It cannot prove the **visible gutter** is gone, because Playwright launches headless Chromium
  with `--hide-scrollbars` (`node_modules/playwright-core/lib/server/chromium/chromium.js:287-293`).
  So `offsetWidth − clientWidth` is 0 there with or without F22, and that check would be vacuous.
  The visible gutter is the manual Pi check. This was verified during review with the repo's
  `playwright-core` 1.59.1 on Chromium 147.0.7727.15 headless (`scrollbar-width` is supported from
  Chromium 121). On a synthetic page, the computed `scrollbar-width` was `none` with
  `.scrollbar-none` and `auto` without it, and the gutter was `0` in both cases.
- **(d) Performance:** no `requestAnimationFrame` throttle for now. The hook skips a `setState`
  when the new geometry equals the old, which avoids re-renders from redundant `ResizeObserver`
  callbacks. Pi frame drops go on the manual check list, and throttling is a follow-up only if
  measured.
- **(e) Frame and DOM order:** reuse `F18`'s frame and `scrollRegionRef` as they are. There is no
  second ref or frame. The list's `<OverlayScrollbar>` goes **between** the scroller and
  `ScrollToTopButton`, so the button stays the frame's last child (Standing invariant 17 says so
  literally). Both come after the scroller in the DOM, so both paint over the frost without
  z-index, and they never overlap: the thumb is at the right edge and the button is bottom-centre.
  **Relation to the shared `bottom-40` line (Standing invariants 12 and 14; user, 2026-09-23):**
  the list thumb's track **stops above the deck**. `LIST_THUMB_BOTTOM_INSET_PX = 160` (10 rem, the
  same line as `scroll-pb-40` and the button's/toast's `bottom-40`) is the track's bottom inset:
  the deck (≈ 81 px: `py-4` + the button) plus its 64 px frosted overhang, rounded up to the shared
  line. So the thumb never enters the deck, frost or `bottom-40` zone. It also stays at the right
  edge (x ≥ frame right − 6 px), so it never meets the centred button. On the Pi, where the frame
  spans the viewport, it also never meets the `fixed inset-x-4` toast. On desktop viewports wider
  than 800 px (`#root` is capped at 768 px and centred), a long toast pill can cover the lower
  track; that is harmless, because the toast (`z-[80]`) paints above the thumb. The thumb adds no
  bottom real estate. If a later feature changes the deck's height or
  overhang, it must re-check this constant alongside `scroll-pb-*` and `bottom-40`.
- **(f) `StatusCountStrip` inset — `mx-4`** (user, 2026-09-23). This keeps today's look exactly: a
  16 px inset with `rounded-sm` corners. `w-full` is **replaced** by `mx-4`, because `w-full` plus
  `mx-4` would overflow by 32 px. The outer column is a `flex-col` with default `align-items: stretch`,
  so the strip still fills the row. The strip keeps its position and every other root token
  (Standing invariant 16).
- **(g) Form wrap — wrap the whole card** (user, 2026-09-23). A new
  `<div className="relative w-full max-w-md">` wraps the card. The card keeps every token, gains
  `scrollbar-none` and a `ref`, and stays the scroller, so `max-h-[90dvh]` does not move. The thumb
  is a sibling after the card inside the wrapper. `trackInsetTopPx = trackInsetBottomPx = 12` (the
  `rounded-xl` radius, 0.75 rem) keeps it inside the rounded corners, overlaying the card's `p-6`
  padding rather than content. The wrapper is card-sized, so backdrop-click semantics are unchanged.
  Step 5 pins the wrapper's exact className, and e2e Test 3 proves the hit-testing in real Chromium
  by clicking beside the card to close the modal. `ChoreFormModal.test.tsx:13-25` clicks the
  backdrop node directly, and jsdom does no hit-testing, so that test alone cannot prove it.
- **Other layout decisions:**
  - `NavBar` takes `px-4` on its **root**, so its `border-b` divider becomes full-bleed like the
    frost; the tabs stay inset.
  - `DateNavigationBanner`, `ReturnToTodayButton` (wrapper div) and `ChoreSearchInput` take `px-4`
    on their roots.
  - `ChoreList` takes `px-4` on **both** branch roots, empty and populated.
  - The outer column keeps `pt-4`.
  - `Toast`'s `fixed inset-x-4` frame and `ChoreFormModal`'s own `px-4 pt-4` are untouched.
- **Thumb geometry:** thumb length follows the META-PLAN formula over a *track* with separate top
  and bottom insets, `track = clientHeight − trackInsetTopPx − trackInsetBottomPx`:
  - `height = Math.min(Math.max(track · clientHeight / scrollHeight, MIN_THUMB_PX), track)`. The
    track bound wins: when `track < MIN_THUMB_PX`, the thumb is `track` tall, so it never leaves the
    track. With zero insets and no clamp this equals `clientHeight² / scrollHeight`.
  - `top = trackInsetTopPx + (scrollTop / (scrollHeight − clientHeight)) · (track − height)`. The
    ratio is clamped to [0, 1]. With zero insets and no clamp this equals the META-PLAN's
    `scrollTop / scrollHeight × clientHeight`, and it keeps a min-clamped thumb inside the track, so
    the thumb's bottom never passes `clientHeight − trackInsetBottomPx`.
  - Returns `null` when `scrollHeight ≤ clientHeight` or `track ≤ 0`, and nothing renders.
  - Insets are two positional numbers, not an options object. The hook's effect depends on them,
    and a fresh `{ top, bottom }` literal on every render would re-run it.
  - **Per region:** the list passes top `0` and bottom `LIST_THUMB_BOTTOM_INSET_PX` (160, see (e)).
    The form passes `FORM_THUMB_TRACK_INSET_PX` (12) for both.
  - **Departure from the META-PLAN (user, 2026-09-23):** the META-PLAN's unclamped formula spans the
    whole `clientHeight`. The list's 160 px bottom inset is a deliberate departure, chosen so the
    thumb stays out of the deck zone. As a result, the list thumb is shorter than
    `clientHeight² / scrollHeight`, and it maps the full scroll range onto the upper
    `clientHeight − 160` px.
  - **Short viewports (list):** with `MIN_THUMB_PX = 24`, the list thumb behaves as follows.
    - `clientHeight ≤ 160`: the track is ≤ 0, so the thumb is `null` and nothing renders.
    - `160 < clientHeight ≤ 184`: the track is at most `MIN_THUMB_PX`, so the thumb is exactly
      `track` tall at `top = 0`. It is a static bar filling the track, with no travel.
    - `clientHeight > 184`: normal behaviour.
- **Fade timing:** fade in over 150 ms (`duration-150`) and out over 400 ms (`duration-400`, a
  Tailwind v4 bare-number utility).
  - **Instant under reduced motion** uses the Tailwind `motion-reduce:transition-none` variant,
    which is pure CSS with no JS or `matchMedia`. It is new to the codebase, so step 2 verifies it
    lands in the built CSS.
  - The fade constants `FADE_IN_MS`/`FADE_OUT_MS` are documented as equal to those class literals,
    following `ScrollToTopButton`'s `FADE_MS`.
- **Colour:** `bg-gray-300/50` + `rounded-full`. It must not be `bg-gray-800` (e2e's bar locator).
- **Named constants:**
  - `useScrollIndicator.ts`: `IDLE_FADE_MS = 1000`, `MIN_THUMB_PX = 24`.
  - `OverlayScrollbar.tsx`: `THUMB_WIDTH_PX = 4`, `THUMB_EDGE_INSET_PX = 2`, `FADE_IN_MS = 150`,
    `FADE_OUT_MS = 400`.
  - `ChoreForm.tsx`: `FORM_THUMB_TRACK_INSET_PX = 12` (unexported).
  - `App.tsx`: `LIST_THUMB_BOTTOM_INSET_PX = 160` (unexported, at module scope after the
    `type ToastState = …` declaration, `:27` before Step 3's import lands, and before
    `export default function App()`). It lives in `App.tsx` because it mirrors that file's own
    `scroll-pb-40` and the frame's `bottom-40` line, the same way the form's inset lives beside the
    form's `rounded-xl`. Keeping it unexported also keeps `OverlayScrollbar` region-agnostic.
  - Geometry, width and right inset are applied through the inline `style` in px, so the constants
    are the single source of truth.
- **ResizeObserver scope:** the hook observes the scroller **and each of its element children at
  attach time**. For the list those are the `ChoreList` root and the deck. React reuses the same
  `<div>` root across `ChoreList`'s empty/populated branches, so it stays observed. For the form
  they are the `<h3>` and `<form>`. Re-pulls, filter changes and modal or window resizes all
  re-measure.

> **Orchestrator note: sibling-safe Playwright.** This note is addressed to the step executor
> (`/next-step-taker`) and to the `/run-plan` orchestrator, including its 2c smoke subagent and
> its Step 3 completion subagent.
>
> **The command.** Every Playwright run for this plan uses
> `env -u PLAYWRIGHT_BASE_URL CI=1 npx playwright test [spec]`. That applies wherever
> `$UI_RUNNER_CMD`, `$TEST_RUN_CMD` or `$TEST_RUN_BUILT_CMD` would otherwise run:
> - `/run-plan` 2c's per-step smoke run;
> - `/run-plan` Step 3's final UI suite;
> - `/next-step-taker` Step 3 validation.
>
> This checkout's `.claude/skill-config.md` resolves all three to a bare `npx playwright test`.
> `playwright.config.ts` sets `reuseExistingServer: !process.env.CI`, so a bare run silently
> adopts a sibling worktree's dev servers on :3000/:5174. It then tests the wrong code, and
> `smoke.spec.ts` writes to that sibling's database.
>
> **Port conflicts.** On `is already used` / `was not able to start`, apply Step 7's retry: about
> every 30 s with jitter, for up to ~10 min. If the ports stay held, stop with the canonical line
> `UNRESOLVED — requires user decision/action: e2e ports 3000/5174 held by another process (<ss -ltnp output if available>)`.
> - A step executor writes that line directly under the box it was validating, leaves the box
>   unticked, and ends its final report with the same line.
> - The orchestrator's own smoke or final run owns no box. It ends the orchestrator's summary
>   with the line, and re-runs on resume.
> - On a later run where the gate passes, delete any such marker line before ticking the box.
>
> **Never** route a port conflict into `/run-plan`'s 2e Test Fix Loop: it is infrastructure, not an
> app failure. Never kill the listener, drop `CI=1`, or edit `playwright.config.ts`. Genuine test
> failures from a `CI=1` run still go through the normal fix loop.
>
> **Working directory and the first commit.** Run every command from the repo root, or from
> `frontend/` where a step says "(in `frontend/`)", written as a subshell `(cd frontend && …)` so
> the Bash tool's persistent cwd stays at the root. Every root-relative path (`frontend/…`,
> `e2e/…`, `README.md`) assumes the root. Never run a command with its cwd under `plans/`: the
> sandbox creates zero-byte `.claude/` mount placeholders there, and the per-step `/git-commit`
> (`git add .`) would sweep them in. Step 1's commit must contain only `plans/META-PLAN.md` (the
> F22 `in-progress` ledger row), this plan, its review and Step 1's two files. Before spawning that
> commit subagent, the orchestrator runs, from the repo root:
> `git status --porcelain --untracked-files=all | grep -vE '^.. (plans/META-PLAN\.md|plans/feature/overlay-scrollbar/overlay-scrollbar\.md|plans/feature/overlay-scrollbar/reviews/overlay-scrollbar-review\.md|frontend/src/hooks/useScrollIndicator\.ts|frontend/src/__tests__/hooks/useScrollIndicator\.test\.ts)$' || true`.
> It must print nothing. If it prints any path, do not commit: end the orchestrator's summary with
> `UNRESOLVED — requires user decision/action: unexpected files before Step 1's commit (<printed paths>)`
> and re-run the check on resume.

## Steps

### 1. `useScrollIndicator` hook + `computeThumbGeometry` (TDD)
Create the geometry function and the scroll, idle-fade and resize hook with no UI yet.

**To-do:**
- [x] **Red:** (COMPLETE 2026-09-23) create `frontend/src/__tests__/hooks/useScrollIndicator.test.ts`. Follow
  `useScrollPastThreshold.test.ts`: a detached `div` appended to `document.body` in `beforeEach`;
  in `afterEach` remove it and call `vi.restoreAllMocks()`, `vi.unstubAllGlobals()` and
  `vi.useRealTimers()`. Import `beforeEach`/`afterEach` explicitly from `vitest`:
  `frontend/tsconfig.json` has no vitest-globals types, so tsc rejects them as bare globals. Add a helper
  `setMetrics(el, { scrollTop, scrollHeight, clientHeight })` that assigns `el.scrollTop` and uses
  `Object.defineProperty(el, 'scrollHeight' | 'clientHeight', { value, configurable: true })`.
  Create each ref once, before `renderHook`, and pass any insets as number literals:
  `const ref = { current: el }; renderHook(() => useScrollIndicator(ref))` (or `(ref, 12, 12)`, or
  `(ref, 0, 160)`), as `useScrollPastThreshold.test.ts:24-25` does. Never build `{ current: el }`
  inline in the callback. The effect depends on `[ref, trackInsetTopPx, trackInsetBottomPx]`, so a
  fresh ref on every render re-runs it:
  the cleanup clears the idle timer and the listener and observer re-attach, so case 10 would
  record 6 `observe` targets instead of 3.
  Cases (signature
  `computeThumbGeometry(scrollTop, scrollHeight, clientHeight, trackInsetTopPx = 0, trackInsetBottomPx = 0)`;
  every expected value below was computed with node against the *Decisions* formula):
  1. `computeThumbGeometry(0, 400, 400)` and `(0, 300, 400)` → `null` (not scrollable).
     `computeThumbGeometry(0, 1000, 20, 12, 12)` → `null` (track −4 ≤ 0).
     `computeThumbGeometry(0, 1000, 160, 0, 160)` → `null` (list-shaped, track 0).
  2. `computeThumbGeometry(0, 1000, 400)` → `{ height: 160, top: 0 }` (`400²/1000`).
     `computeThumbGeometry(600, 1000, 400)` → `{ height: 160, top: 240 }`, the bottom
     (`240 + 160 = 400`). `computeThumbGeometry(300, 1000, 400)` → `top: 120`.
  3. Min clamp: `computeThumbGeometry(0, 100000, 400)` → `height: MIN_THUMB_PX`.
     `computeThumbGeometry(99600, 100000, 400)` → `top: 400 - MIN_THUMB_PX`, which stays inside
     the track. Track shorter than the minimum: `computeThumbGeometry(0, 1000, 40, 12, 12)` (track 16)
     → `{ height: 16, top: 12 }`, since the track bound beats `MIN_THUMB_PX`.
     List-shaped short viewport: `computeThumbGeometry(0, 1000, 170, 0, 160)` (track 10) →
     `{ height: 10, top: 0 }`.
  4. Symmetric insets (form): `computeThumbGeometry(0, 1000, 400, 12, 12)` →
     `height: 376*400/1000 = 150.4`, `top: 12`. At `scrollTop: 600` → `top: 12 + 376 - 150.4`
     (237.6). Use `toBeCloseTo`.
     Bottom-only inset (list): `computeThumbGeometry(0, 1000, 400, 0, 160)` → `{ height: 96, top: 0 }`
     (track 240, `240*400/1000`). At `scrollTop: 300` → `top: 72`. At `scrollTop: 600` →
     `top: 144`, so the thumb's bottom is `144 + 96 = 240 = 400 - 160`: it stops at the bottom
     inset. Min clamp with a bottom inset: `computeThumbGeometry(99600, 100000, 400, 0, 160)` →
     `{ height: MIN_THUMB_PX, top: 240 - MIN_THUMB_PX }` (216).
  5. The hook with `ref = { current: null }` returns `{ geometry: null, isVisible: false }` and
     does not throw.
  6. The hook on a scrollable element (1000/400) returns geometry on mount with
     `isVisible: false` (no mount flash).
  7. With fake timers, `act(() => fireEvent.scroll(el))` gives `isVisible: true`, and geometry
     reflects the new `scrollTop`. Advance `IDLE_FADE_MS - 1`: still visible. Advance `1` more:
     `false`.
  8. Restart, with fake timers (`vi.useFakeTimers()` inside `try { … } finally { vi.useRealTimers(); }`,
     as case 7): scroll, advance 600, scroll again, then assert `vi.getTimerCount()` is `1`. Advance
     `IDLE_FADE_MS - 1`: still visible.
  9. Cleanup, with fake timers (same idiom): spy `addEventListener`/`removeEventListener`. The `'scroll'` listener is added with
     `{ passive: true }` and removed on unmount with the same handler. `vi.getTimerCount()` is 0
     after unmount mid-fade.
  10. ResizeObserver: use `vi.stubGlobal('ResizeObserver', FakeResizeObserver)`, a class that
      records `observe` targets and the callback and has a `disconnect` spy. Give the element two
      children. The fake observes the element and both children. Changing `scrollHeight` and
      invoking the recorded callback in `act` updates the geometry. `disconnect` is called on
      unmount.
  11. Without `ResizeObserver` (the jsdom default), mounting does not throw.

  Run `(cd frontend && npx vitest run src/__tests__/hooks/useScrollIndicator.test.ts)` and confirm
  it fails because the module is missing.
- [x] **Green:** (COMPLETE 2026-09-23) create `frontend/src/hooks/useScrollIndicator.ts`:
  - `export const IDLE_FADE_MS = 1000;` and `export const MIN_THUMB_PX = 24;`, each with a JSDoc line.
  - `export type ThumbGeometry = { height: number; top: number };`
  - `export function computeThumbGeometry(scrollTop: number, scrollHeight: number, clientHeight: number, trackInsetTopPx = 0, trackInsetBottomPx = 0): ThumbGeometry | null`,
    implementing the formula in *Decisions*.
  - `export function useScrollIndicator(ref: RefObject<HTMLElement | null>, trackInsetTopPx = 0, trackInsetBottomPx = 0): { geometry: ThumbGeometry | null; isVisible: boolean }`.
    It uses two `useState`s and a single `useEffect` on `[ref, trackInsetTopPx, trackInsetBottomPx]`:
    - read `ref.current`. If it is `null`, `setGeometry(null)` and return.
    - `measure()` computes the geometry and calls `setGeometry(prev => sameGeometry(prev, next) ? prev : next)`.
    - call `measure()` once.
    - `onScroll` runs `measure()`, `setIsVisible(true)`, `clearTimeout(timer)` and
      `timer = setTimeout(() => setIsVisible(false), IDLE_FADE_MS)`.
    - `addEventListener('scroll', onScroll, { passive: true })`.
    - `if (typeof ResizeObserver !== 'undefined')`: create `new ResizeObserver(measure)`, observe
      the element and each `Array.from(element.children)`.
    - cleanup removes the listener, clears the timer and disconnects the observer.

  Add a doc comment matching `useScrollPastThreshold`'s: the element must be mounted when the
  caller's effects run, so render the consumer after the scroller. Re-run the test file until it
  is green.
- [x] **Refactor:** (COMPLETE 2026-09-23) tidy names and comments. Run `npx tsc --noEmit -p .` (in `frontend/`) and
  `npm run lint` (root). Both must be clean.

### 2. `OverlayScrollbar` component (TDD)
Render the thumb from the hook with its classes and constants.

**To-do:**
- [x] **Red:** (COMPLETE 2026-09-23) create `frontend/src/__tests__/components/OverlayScrollbar.test.tsx`. Use a
  `Harness` like `ScrollToTopButton.test.tsx:6-16`: a `<div data-testid="scroller" ref={ref} />`
  rendered **before**
  `<OverlayScrollbar scrollRegionRef={ref} trackInsetTopPx={props.trackInsetTopPx} trackInsetBottomPx={props.trackInsetBottomPx} />`.
  Stub metrics with
  `vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(...)` and the same for
  `clientHeight`, installed **before** rendering the `Harness` (the hook measures on mount and on
  `scroll` only, since jsdom has no `ResizeObserver`); `vi.restoreAllMocks()` runs in `afterEach`
  (imported explicitly from `vitest`, as in Step 1).
  Cases:
  1. Not scrollable (400/400): `queryByTestId('overlay-scrollbar')` is `null`.
  2. Scrollable (1000/400): the thumb exists and has `aria-hidden="true"` and no `role`. Its
     className contains `pointer-events-none`, `absolute`, `rounded-full`, `bg-gray-300/50`,
     `transition-opacity`, `motion-reduce:transition-none`, `opacity-0`, `duration-400`. It does
     not match `/\bz-/` or contain `bg-gray-800`. `style.height` is `'160px'`, `style.top` is
     `'0px'`, `style.width` is `` `${THUMB_WIDTH_PX}px` `` and `style.right` is
     `` `${THUMB_EDGE_INSET_PX}px` ``.
  3. Fake timers: after scrolling the scroller (`scrollTop = 300`, `fireEvent.scroll`) the thumb
     has `opacity-100` + `duration-150` and `style.top === '120px'`. After
     `act(() => vi.advanceTimersByTime(IDLE_FADE_MS))` it has `opacity-0` + `duration-400`.
  4. `trackInsetTopPx={12} trackInsetBottomPx={12}` (1000/400) at scrollTop 0: `style.top === '12px'`
     and `style.height === '150.4px'`.
  5. `trackInsetBottomPx={160}` (1000/400, list-shaped) at scrollTop 0: `style.height === '96px'`
     and `style.top === '0px'`. After `scrollTop = 600` + `fireEvent.scroll`: `style.top === '144px'`
     (thumb bottom 240 = 400 − 160).
  6. `FADE_IN_MS === 150` and `FADE_OUT_MS === 400`, pinned so that they stay equal to the class
     literals.

  Run `(cd frontend && npx vitest run src/__tests__/components/OverlayScrollbar.test.tsx)` and
  confirm it fails.
- [x] **Green:** (COMPLETE 2026-09-23) create `frontend/src/components/common/OverlayScrollbar.tsx` (default export).
  - Exported constants (`export const`, as `ScrollToTopButton` exports `FADE_MS`), each with JSDoc:
    `THUMB_WIDTH_PX = 4`, `THUMB_EDGE_INSET_PX = 2`, `FADE_IN_MS = 150` (must equal `duration-150`)
    and `FADE_OUT_MS = 400` (must equal `duration-400`). The Red test imports all four; ESLint's
    `react-refresh/only-export-components` allows them (`allowConstantExport: true`).
  - Literal class constants, unexported (like `ScrollToTopButton`'s `OFFSET_CLASSES`):
    `VISIBLE_CLASSES = 'opacity-100 duration-150'` and `HIDDEN_CLASSES = 'opacity-0 duration-400'`.
  - Props: `type OverlayScrollbarProps = { scrollRegionRef: RefObject<HTMLElement | null>; trackInsetTopPx?: number; trackInsetBottomPx?: number }`,
    both defaulting to `0` in the destructuring.
  - Imports mirror `ScrollToTopButton.tsx:1-4`: `import type { RefObject } from 'react';` and
    `import { useScrollIndicator } from '../../hooks/useScrollIndicator';` (relative, no alias).
  - Body: call `useScrollIndicator(scrollRegionRef, trackInsetTopPx, trackInsetBottomPx)`. If `geometry` is `null`,
    return `null`. Otherwise render
    `<div data-testid="overlay-scrollbar" aria-hidden="true" className={`pointer-events-none absolute rounded-full bg-gray-300/50 transition-opacity motion-reduce:transition-none ${isVisible ? VISIBLE_CLASSES : HIDDEN_CLASSES}`} style={{ top: geometry.top, height: geometry.height, width: THUMB_WIDTH_PX, right: THUMB_EDGE_INSET_PX }} />`.
  - Add a header comment: indicator only, rendered in a positioned frame **beside** (never inside)
    the scroller, no z-index (paints above by DOM order), no mount flash, and why it is not
    `bg-gray-800`.
- [x] (COMPLETE 2026-09-23) Re-run the file until green. Then run `npm run build --workspace frontend` from the repo root
  (the grep path `frontend/dist/assets/*.css` is root-relative; from `frontend/` the grep exits 2
  with "No such file or directory") and confirm the built CSS contains the new utilities:
  `grep -ohE 'duration-400|motion-reduce\\:transition-none|bg-gray-300\\/50' frontend/dist/assets/*.css | sort -u`
  must print exactly three lines: `bg-gray-300\/50`, `duration-400` and
  `motion-reduce\:transition-none`. Tailwind escapes `:` and `/` in selectors with one backslash,
  and each `\\` in the single-quoted ERE matches that one backslash. (The same form was checked
  during review against the current build: `grep -ohE 'duration-500|hover\\:bg-gray-600|bg-gray-900\\/60' frontend/dist/assets/*.css | sort -u`
  printed all three existing utilities. Before this step the three new utilities are absent, and
  grep exits 1 with no output.) Tailwind v4 scans every file under `frontend/src`, including
  `src/__tests__`, so the Red test's literals alone emit these utilities. This gate proves
  Tailwind can emit them; a misspelling in `OverlayScrollbar.tsx` is caught by this step's
  className test (cases 2–3), not by the grep. If a line is missing, the utility is not valid for
  this Tailwind version. If Tailwind did not emit `duration-400`, switch both the class and the test
  to `duration-[400ms]` and re-verify with
  `grep -ohE 'duration-\\\[400ms\\\]|motion-reduce\\:transition-none|bg-gray-300\\/50' frontend/dist/assets/*.css | sort -u`.
  Note that `duration-\[400ms\]` is already emitted today by `TouchLockOverlay.tsx:121`, so on that
  path only the other two lines are new evidence. `frontend/dist/` is gitignored, so the build adds
  nothing to `git status`.
- [x] (COMPLETE 2026-09-23) Run `npx tsc --noEmit -p .` (in `frontend/`) and `npm run lint` (root). Both must be clean.

### 3. List thumb in `F18`'s frame + hidden native scrollbar (TDD)
Mount the thumb for the chore list, reusing `scrollRegionRef` and the `scroll-region-frame`.

**To-do:**
- [x] **Red:** (COMPLETE 2026-09-23) in `frontend/src/__tests__/App.test.tsx`:
  - update the F18 pin at `:809-810` to
    `expect(region!.className).toBe('flex-1 overflow-y-auto min-h-0 flex flex-col scroll-pb-40 scrollbar-none');`
    and reword its comment: "F18's scroller tokens stay byte-identical; F22 adds only `scrollbar-none`".
  - add `describe('overlay scrollbar (F22)', …)`, with `beforeEach`/`afterEach` mirroring the F18
    describe. Include `Element.prototype.scrollTo = vi.fn()`, since the scroll-to-top button is
    present. In the cases that need a thumb, install
    `vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1000)` and the same for
    `clientHeight` → 400 **before** `render(<App />)`, and restore them in `afterEach`. jsdom has no
    `ResizeObserver`, so the hook measures only on mount and on `scroll`, and a spy installed after
    render never produces the mount-time thumb. Cases:
    1. After load, `getByTestId('overlay-scrollbar')` exists. `frame = getByTestId('scroll-region-frame')`.
       `thumb.parentElement === frame`. `region.contains(thumb) === false`. Exactly one
       `.overflow-y-auto` exists. `region.lastElementChild === add-task-deck`.
       `frame.lastElementChild === getByTestId('scroll-to-top')`, so the button stays last.
       `thumb.nextElementSibling === the button`. The thumb has `opacity-0` on load (no mount flash).
       The list's bottom inset applies: `thumb.style.height === '96px'` and `thumb.style.top === '0px'`
       (track `400 − 160 = 240`, `240·400/1000 = 96`).
    2. `region.scrollTop = 600; fireEvent.scroll(region)` → the thumb has `opacity-100` and
       `style.top === '144px'`. Its bottom is `144 + 96 = 240 = 400 − LIST_THUMB_BOTTOM_INSET_PX`, so
       it stops above the deck zone.
    3. With jsdom's default metrics (no spies), no thumb renders and scrolling the region does not
       throw.

  Run `(cd frontend && npx vitest run src/__tests__/App.test.tsx)` and confirm that cases 1–2 and
  the updated `:810` literal fail. Case 3 is a guard (no thumb, no throw) and already passes before
  Green.
- [x] **Green:** (COMPLETE 2026-09-23) in `frontend/src/App.tsx`:
  - append ` scrollbar-none` to the scroller's className (`:365`), keeping every other token and
    its order.
  - add `import OverlayScrollbar from './components/common/OverlayScrollbar';` between the
    `ConfirmDialog` (`:18`) and `ScreenBlankOverlay` (`:19`) imports, keeping the
    `components/common` import run alphabetical.
  - add `const LIST_THUMB_BOTTOM_INSET_PX = 160;` at module scope, after the
    `type ToastState = …` declaration (`:27` today, `:28` once this step's import lands, so anchor
    on the text) and before `export default function App()`. Give it a comment: the track stops
    above the deck + its 4 rem frosted overhang, on the same 10 rem line as `scroll-pb-40` and the button's
    and toast's `bottom-40` (Standing invariants 12 and 14); re-check it if the deck's height or
    overhang changes. Do not export it: `App.tsx` exports only the component.
  - render `<OverlayScrollbar scrollRegionRef={scrollRegionRef} trackInsetBottomPx={LIST_THUMB_BOTTOM_INSET_PX} />`
    between the scroller's closing `</div>` and `<ScrollToTopButton … />`.
  - extend the F18 frame comment (`{/* F18: the positioned frame …`; `:360-363` before this step's
    edits; the import and constant land above it, so anchor on the text): the thumb reads the same single ref, sits before the
    button so the button stays last, its track stops `LIST_THUMB_BOTTOM_INSET_PX` above the frame
    bottom (out of the deck zone), and neither has a z-index.
- [x] (COMPLETE 2026-09-23) Re-run the whole Vitest suite (`npm run test --workspace frontend`), since every `App*.test.tsx`
  now mounts the thumb. All green, with no edits to the `.overflow-y-auto`/deck assertions beyond
  the `:810` literal. Then run `npx tsc --noEmit -p .` (in `frontend/`) and `npm run lint` (root).
  Both must be clean.

### 4. Full-bleed scroll region: relocate `px-4` (TDD)
Remove the column's horizontal padding and re-apply the 16 px inset where content lives.

**To-do:**
- [x] **Red:** (COMPLETE 2026-09-23) add App-level assertions to the `overlay scrollbar (F22)` describe in
  `App.test.tsx`. This case needs no metric spies. After load:
  - `column = document.getElementById('NavBar')!.parentElement!`. Its className does not match
    `/\bpx-\d/` and still contains `pt-4`.
  - `#NavBar` className contains `px-4`.
  - `getByTestId('status-count-strip')` className contains `mx-4` and does not match `/\bw-full\b/`.
  - every other child of `column` except `scroll-region-frame` has className matching
    `/\b(px|mx)-4\b/`. `ReturnToTodayButton` renders `null` at offset 0, so this covers the banner
    and the search root.
  - `region.firstElementChild` (the `ChoreList` root) className contains `px-4`.
  - the deck backing (`getByTestId('add-task-deck-backing')`) className still contains `inset-x-0`.

  Also extend the component tests:
  - `ChoreList.test.tsx`: both the empty-list and populated renders have a root
    (`container.firstElementChild`) with `px-4`.
  - `ReturnToTodayButton.test.tsx`: at `dayOffset` 1 the wrapper (the button's `parentElement`)
    contains `px-4`.
  - `StatusCountStrip.test.tsx`: the root contains `mx-4` and not `w-full`. Its existing
    `flex-shrink-0` / `rounded-full` / `overflow-y-auto` pins stay.

  Run these files and confirm the inset assertions fail: the column's no-`px-` check, `NavBar`'s
  `px-4`, the strip's `mx-4`/no-`w-full`, the other column children's `px-4`, and the `ChoreList`
  and `ReturnToTodayButton` `px-4` checks. The column's `pt-4`, the backing's `inset-x-0` and the
  existing `StatusCountStrip` pins already pass before Green.
- [x] **Green:** (COMPLETE 2026-09-23)
  - `App.tsx` outer column (`:349` before Step 3; Step 3's import and constant land above it, so
    anchor on the quoted string): `flex flex-col h-full overflow-hidden bg-gray-900 px-4 pt-4` → `flex flex-col h-full overflow-hidden bg-gray-900 pt-4`.
  - `components/nav/NavBar.tsx:11` root: `border-b border-gray-700 flex-shrink-0` → `border-b border-gray-700 flex-shrink-0 px-4`.
  - `components/nav/StatusCountStrip.tsx:30`: `flex flex-shrink-0 w-full h-5 mt-2 rounded-sm overflow-hidden bg-gray-800` → `flex flex-shrink-0 mx-4 h-5 mt-2 rounded-sm overflow-hidden bg-gray-800`,
    with a comment explaining why `mx-4` replaces `w-full`: the flex-col stretch fills the row, and
    `w-full` plus margins would overflow.
  - `components/nav/DateNavigationBanner.tsx:29`: append ` px-4` to the root.
  - `components/nav/ReturnToTodayButton.tsx:15`: `flex justify-center flex-shrink-0 mt-2 slide-in-top` → append ` px-4`.
  - `components/chore/ChoreSearchInput.tsx:14`: `flex-shrink-0 mb-3` → `flex-shrink-0 mb-3 px-4`.
  - `components/chore/ChoreList.tsx`: empty-branch root `<div>` (`:16`) → `<div className="px-4">`,
    and the populated root (`:24`) `space-y-3 pb-4` → `space-y-3 pb-4 px-4`.
- [x] (COMPLETE 2026-09-23) Re-run the whole Vitest suite: `npm run test --workspace frontend`. All green. Then run
  `npx tsc --noEmit -p .` (in `frontend/`) and `npm run lint` (root). Both must be clean.

### 5. Form scroll box: wrap the card + thumb (TDD)
Give the Add/Edit form's scroll box the same hidden bar and overlay thumb, inside its rounded
corners.

**To-do:**
- [x] **Red:** (COMPLETE 2026-09-23) in `frontend/src/__tests__/components/ChoreForm.test.tsx`, add
  `describe('overlay scrollbar (F22)', …)`. In the cases that need a thumb, stub `scrollHeight`
  1000 and `clientHeight` 400 via `vi.spyOn(HTMLElement.prototype, …, 'get')` **before** render,
  inside the case (not in a `beforeEach`, because the no-spies case shares the describe), and call
  `vi.restoreAllMocks()` in `afterEach`. Add `afterEach` to the file's vitest import (`:1`, today
  `import { describe, it, expect, vi } from 'vitest';`), or tsc fails on it. The hook measures once
  on mount, and jsdom has no `ResizeObserver` to re-measure.
  Render add mode as the existing tests do. Assert:
  - `card = container.querySelector('.overflow-y-auto')`. Its className contains every prior token
    (`bg-gray-800`, `rounded-xl`, `p-6`, `w-full`, `max-w-md`, `overflow-y-auto`, `max-h-[90dvh]`)
    plus `scrollbar-none`.
  - `wrapper = card.parentElement` has className exactly `relative w-full max-w-md` and is
    `container.firstElementChild`.
  - `thumb = getByTestId('overlay-scrollbar')`: `thumb.parentElement === wrapper`,
    `card.contains(thumb) === false`, `thumb.style.top === '12px'` at scrollTop 0 (inside the
    `rounded-xl` corners), `thumb.style.height === '150.4px'` (track `400 − 12 − 12 = 376`,
    `376·400/1000`), and `opacity-0` on mount.
  - with the default jsdom metrics (no spies), no thumb renders.

  Run it and confirm that the `scrollbar-none`, wrapper and thumb assertions fail. The
  default-metrics no-thumb case already passes before Green.
- [x] **Green:** (COMPLETE 2026-09-23) in `frontend/src/components/form/ChoreForm.tsx`:
  - `useRef` is already imported (`:1`, `import { useState, useRef } from 'react';`). Add
    `import OverlayScrollbar from '../common/OverlayScrollbar';` directly after
    `import ClearButton from '../common/ClearButton';` (`:5`).
  - add `const FORM_THUMB_TRACK_INSET_PX = 12;` with a comment: equal to `rounded-xl` (0.75 rem),
    keeping the thumb inside the rounded corners over the `p-6` padding.
  - add `const scrollBoxRef = useRef<HTMLDivElement>(null);`.
  - wrap the card (`:75`) in `<div className="relative w-full max-w-md">`. The wrapper is
    card-sized so backdrop clicks still hit `ChoreFormModal`'s `target === currentTarget` check.
  - the card gets `ref={scrollBoxRef}` and className
    `bg-gray-800 rounded-xl p-6 w-full max-w-md overflow-y-auto max-h-[90dvh] scrollbar-none`.
  - after the card's closing `</div>`, inside the wrapper, add
    `<OverlayScrollbar scrollRegionRef={scrollBoxRef} trackInsetTopPx={FORM_THUMB_TRACK_INSET_PX} trackInsetBottomPx={FORM_THUMB_TRACK_INSET_PX} />`.
- [x] (COMPLETE 2026-09-23) Re-run `ChoreForm.test.tsx`, `ChoreForm.dateBoundary.test.tsx` and `ChoreFormModal.test.tsx`
  (backdrop-click cases `:13-25` must pass unchanged), then the whole Vitest suite. All green. Then
  run `npx tsc --noEmit -p .` (in `frontend/`) and `npm run lint` (root). Both must be clean.

### 6. README one-liner
Document the overlay scrollbar in the UI prose.

**To-do:**
- [x] (COMPLETE 2026-09-23) In the repo-root `README.md` (not `deploy/pi/README.md` or `.github/rulesets/README.md`),
  after the scroll-to-top paragraph (`:48-50`, ending
  `` (`frontend/src/components/common/ScrollToTopButton.tsx`). ``), add one paragraph in the same
  style: "The native scrollbar is hidden; while the list (or the Add/Edit form, when it overflows)
  scrolls, a thin overlay thumb appears at the right edge and fades about a second after scrolling
  stops. The list and its frosted Add Task deck run edge to edge, with only the header rows and
  bars inset (`frontend/src/components/common/OverlayScrollbar.tsx`)." Wrap lines to the file's
  ~100-column style, keeping the path on one line.
- [x] (COMPLETE 2026-09-23) Verify, from the repo root: `grep -n "OverlayScrollbar.tsx" README.md` prints exactly one line, with a line number
  greater than 50 (the scroll-to-top paragraph's last line). Before this step it prints nothing and
  exits 1.

### 7. Real-browser e2e spec `e2e/overlay-scrollbar.spec.ts`
Verify layout facts that jsdom cannot see: the native-scrollbar rule applies, full-bleed frame and
frost, the thumb's real geometry (including the stop above the deck) and fade, the form thumb,
the card-sized backdrop hit-testing, and reduced motion.

**To-do:**
- [x] (COMPLETE 2026-09-23) Create `e2e/overlay-scrollbar.spec.ts`, modelled on `e2e/scroll-to-top.spec.ts`. It is
  read-only: it never taps a bar or submits the form. Use
  `test.describe('Overlay scrollbar + full-bleed region (F22)')` with the same `beforeEach`:
  `page.setViewportSize({ width: 1280, height: 600 })`,
  `page.clock.setFixedTime(new Date(2025, 0, 15, 12, 0, 0))`, `page.goto('/')`, and
  `waitForSelector('text=Vacuum Bedroom Floor')`.
  - **Test 1, full-bleed layout.**
    - `root = page.locator('#root')`, `frame = page.getByTestId('scroll-region-frame')` and
      `region = page.locator('.overflow-y-auto')`.
    - The frame's bounding box `x` and `width` equal `#root`'s (±0.5).
    - `await expect(region).toHaveCSS('scrollbar-width', 'none')`: the `.scrollbar-none` rule
      applies. Do not measure `offsetWidth - clientWidth`: headless Chromium runs with
      `--hide-scrollbars`, so it is 0 even without F22 (Decision (c)). Without F22's
      `scrollbar-none` this computes `auto`, so the assertion discriminates. `toHaveCSS` reads
      `getComputedStyle(el).getPropertyValue('scrollbar-width')`, which was checked in the repo's
      Chromium 147 to return `none`.
    - `getByTestId('add-task-deck-backing')` box `x`/`width` equal the frame's.
    - the first bar (`page.locator('.bg-gray-800.rounded-full').first()`) box `x` is
      `root.x + 16` (±0.5).
    - the status strip box `x` is `root.x + 16`.
  - **Test 2, list thumb.**
    - Declare `region = page.locator('.overflow-y-auto')`, `frame = page.getByTestId('scroll-region-frame')`
      and `thumb = page.getByTestId('overlay-scrollbar')` in this test's body. Each test is its own
      scope, as in `scroll-to-top.spec.ts:18-19`, and with no modal open each locator is unique.
    - Assert `overflowPx > 200`, as the F18 spec does. (Measured during review at 1280×600:
      clientHeight 365, scrollHeight 844, overflow 479; track 205, thumb ≈ 88.7 px, travel ≈ 116 px.)
    - `toHaveCSS('opacity', '0')` on load.
    - `region.evaluate(el => { el.scrollTop = 150; })`, then `toHaveCSS('opacity', '1')`.
    - the thumb box `width` is 4, and its right edge equals `frame.x + frame.width - 2` (±0.5),
      using `frame.boundingBox()`.
    - Define one read helper in the test body, so every geometry value comes from a single call on
      the thumb and a parallel `smoke.spec.ts` worker cannot change the list between reads:
      `const readThumb = (pinEnd: boolean) => thumb.evaluate((el, pin) => { const frame = el.parentElement!; const scroller = frame.querySelector('.overflow-y-auto')!; if (pin) scroller.scrollTop = scroller.scrollHeight; const thumbRect = el.getBoundingClientRect(); return { thumbH: thumbRect.height, thumbBottom: thumbRect.bottom, frameBottom: frame.getBoundingClientRect().bottom, ch: scroller.clientHeight, sh: scroller.scrollHeight }; }, pinEnd);`.
      The thumb's parent is the frame, whose first child is the scroller.
    - its `height` ≈ `Math.min(Math.max(track · ch / sh, 24), track)` with `track = ch − 160`
      (±1). The 160 is `App.tsx`'s unexported `LIST_THUMB_BOTTOM_INSET_PX`, so the spec uses the
      literal and says so in a comment. At this viewport `ch − 160` is well above 24, so it reduces
      to `track · ch / sh` unless the list is very long. Poll it, as the end-of-scroll check does:
      `await expect.poll(async () => { const m = await readThumb(false); return Math.abs(m.thumbH - Math.min(Math.max((m.ch - 160) * m.ch / m.sh, 24), m.ch - 160)); }).toBeLessThanOrEqual(1)`.
      A parallel smoke worker's re-pull can land between React's list commit and the
      ResizeObserver-driven re-measure, so a single read can see the new `sh` next to the old thumb.
    - From one `await readThumb(false)`: `thumbBottom ≤ frameBottom − 160 + 0.5`, so the thumb
      stays above the deck zone. This is a plain assertion: it holds whatever the list length,
      because the track never exceeds `ch − 160`.
    - End of scroll: `await expect.poll(async () => { const m = await readThumb(true); return Math.abs(m.thumbBottom - (m.frameBottom - 160)); }).toBeLessThanOrEqual(1)`.
      Each poll iteration re-pins `scrollTop` to the end before reading, so a row added by a
      parallel smoke worker cannot leave the scroller short of the end; the thumb updates on the
      next render, so a later iteration converges. At full scroll the thumb reaches, and never
      passes, the bottom of its track.
    - `document.elementFromPoint` at the thumb's centre is not the thumb (it is click-through).
    - finally, `await expect(thumb).toHaveCSS('opacity', '0', { timeout: 3_000 })`: it fades after
      idling ≈ 1 s plus the 400 ms fade.
  - **Test 3, form thumb.**
    - `page.setViewportSize({ width: 400, height: 400 })`. This is portrait, which avoids the
      landscape ≤ 500 px rotate overlay.
    - click the Add Task button (use the same locator smoke uses to open the modal).
    - `card = page.locator('.fixed.inset-0 .overflow-y-auto')`.
    - Assert `card.evaluate(el => el.scrollHeight - el.clientHeight) > 0`. If it is not, shrink
      the height until it overflows and note the measured value in a comment. (Measured during
      review: card clientHeight 360, scrollHeight 573, so no shrink is needed. The list scroller is
      173 px tall here, inside the `160 < clientHeight ≤ 184` band, so the list thumb is a static
      13 px bar. Test 3 does not assert it; say so in a comment so it is not mistaken for a bug.)
    - `await expect(card).toHaveCSS('scrollbar-width', 'none')` (same reason as Test 1).
    - `card.evaluate(el => { el.scrollTop = 40; })`, then the form's thumb
      (`page.locator('.fixed.inset-0').getByTestId('overlay-scrollbar')`) reaches `opacity` `1`.
    - its box lies within the card's box: its top is ≥ card top + 12, and its bottom is ≤ card
      bottom − 12.
    - close by clicking **beside** the card, inside the backdrop's `px-4` gutter. This proves the
      new wrapper is card-sized in real hit-testing, which jsdom cannot do.
      - Use `const cardBox = (await card.boundingBox())!;` then
        `await page.mouse.click(6, cardBox.y + cardBox.height / 2)`.
      - The backdrop is `fixed inset-0 … flex items-start justify-center px-4 pt-4`. At the
        400 px-wide viewport the card spans x 16–384, and at 400×400 it spans y 16–376 (`pt-4`,
        `max-h-[90dvh]` = 360). So x 6 at the card's vertical centre hits the backdrop.
      - This was checked during review on a Chromium replica of the markup:
        `elementFromPoint(6, 200)` was the backdrop.
      - Then `await expect(page.getByTestId('chore-modal-backdrop')).toHaveCount(0)`.
      - If the wrapper were full-width or full-screen, the click would land on it, not on the
        backdrop, and the modal would stay open. Never submit. The app has no Escape handler.
  - **Test 4, reduced motion.**
    - Declare `region = page.locator('.overflow-y-auto')` and `thumb = page.getByTestId('overlay-scrollbar')`
      in this test's body, as in Test 2 (tests share no locals).
    - `await page.emulateMedia({ reducedMotion: 'reduce' })`. The `beforeEach` has already
      navigated, and Chromium re-evaluates the media query live.
    - `region.evaluate(el => { el.scrollTop = 150; })`, then
      `await expect(thumb).toHaveCSS('transition-property', 'none')` and
      `toHaveCSS('opacity', '1')`.
    - Verified during review in the repo's `playwright-core` 1.59.1 / Chromium 147.0.7727.15: a
      `.transition-opacity` + `@media (prefers-reduced-motion: reduce) { .motion-reduce\:transition-none }`
      element computes `transition-property` to `none` under `reduce` and to `opacity` under
      `no-preference`.
- [x] (COMPLETE 2026-09-23) Run `npm run lint` (root). It must be clean: the new spec is in ESLint's `**/*.{ts,tsx}` scope.
- [x] (COMPLETE 2026-09-23) From the repo root, run the spec as `env -u PLAYWRIGHT_BASE_URL CI=1 npx playwright test e2e/overlay-scrollbar.spec.ts`.
  `CI=1` stops Playwright from silently adopting a sibling worktree's dev servers on :3000/:5174.
  If it fails with `is already used` / `was not able to start`, retry about every 30 s (with
  jitter) for up to ~10 min. Never kill the listener, drop `CI=1` or edit `playwright.config.ts`.
  If the ports stay held, leave this box unticked, write directly under it
  `UNRESOLVED — requires user decision/action: e2e ports 3000/5174 held by another process (<ss -ltnp output if available>)`,
  end your final report with that same line, and stop. On a later run where the gate passes,
  delete that marker line before ticking the box.

### 8. Verify All Tests Pass
Run the full suites to confirm nothing is broken.

**To-do:**
- [ ] `npm run test --workspace frontend`: all Vitest suites pass.
- [ ] `npx tsc --noEmit -p .` (in `frontend/`) and `npm run lint` (root) are clean, and
  `npm run build --workspace frontend` succeeds.
- [ ] From the repo root, run `env -u PLAYWRIGHT_BASE_URL CI=1 npx playwright test` (the full e2e suite: `smoke.spec.ts`,
  `scroll-to-top.spec.ts` and `overlay-scrollbar.spec.ts`) and confirm all pass. Use the same
  port-conflict retry and `UNRESOLVED` stop protocol as step 7.
- [ ] Repo-fact check (from the repo root; every path below is root-relative):
  - `grep -n "flex flex-col h-full overflow-hidden bg-gray-900 pt-4" frontend/src/App.tsx` prints
    exactly one line, the outer column (before step 4 it prints nothing and exits 1).
  - `grep -rn "bg-gray-900 px-4 pt-4" frontend/src || true` prints nothing. Before step 4 it prints
    `frontend/src/App.tsx:<line>:…`, the outer column (`:349` on `main`; Step 3 shifts it down).
    No test file contains the literal.
  - `grep -c "scrollRegionRef = useRef" frontend/src/App.tsx` prints `1` (one declaration), and
    `grep -c "ref={scrollRegionRef}" frontend/src/App.tsx` prints `1` (attached to one element).
    The case-sensitive `ref={` does not match the `scrollRegionRef={scrollRegionRef}` props of
    `OverlayScrollbar` and `ScrollToTopButton`.
  - `grep -c "useRef<HTMLDivElement>" frontend/src/App.tsx` prints `1`: there is no second scroller
    ref. `App.tsx` has other `useRef`s with non-`HTMLDivElement` types, so a bare `useRef` grep
    proves nothing.
  - `grep -rl "scrollbar-none" frontend/src --include=*.tsx --exclude-dir=__tests__ | sort` prints
    exactly `frontend/src/App.tsx`, `frontend/src/components/form/ChoreForm.tsx` and
    `frontend/src/components/nav/NavBar.tsx`. If `frontend/src/components/common/OverlayScrollbar.tsx`
    also appears, it must be only because its header comment names the utility. Before step 3 it
    prints only `NavBar.tsx`. `frontend/src/index.css` still defines `.scrollbar-none`, but
    `--include=*.tsx` leaves it out.
- [ ] Investigate and fix any failure from the boxes above before marking the plan finished. If
  none failed, tick this box as N/A ("no failures"). If a failure cannot be fixed, leave this box
  unticked, write `UNRESOLVED — requires user decision/action: <failure + evidence>` directly under
  it, and end your final report with that same line. On a later run where everything passes,
  delete that marker line before ticking the box.
- [ ] Copy the *Manual Pi checks* section below, and then the Summary's *Fold-back notes for
  Phase C* list under that heading, verbatim into your final report. This box is done once both
  copies are in the report. The report is not what carries them to the user: both are the content
  of the PR body's `## Verification Steps` → "How to manually verify (if applicable)" bullet when
  `/git-push` opens the PR (`~/.claude/skills/git-push/SKILL.md`, *PR Body Format*;
  `/run-feature` Phase A step 9 runs `/git-push`), with the fold-back notes right after the Pi
  checks under their own heading line. See the operator line in the *Summary*.

## Manual Pi checks (pre-merge; carried in the PR body's "How to manually verify" bullet — not executor checkboxes)
- On the Pi wall display, the native scrollbar gutter is gone: the bars widen by the old scrollbar
  width, and no gutter remains on the right (risk c). e2e proves only that the `scrollbar-width:
  none` rule applies (headless Chromium hides scrollbars anyway), so this is the only check of
  the visible gutter.
- The frost under the Add Task deck reaches both screen edges. The header rows (tabs, strip,
  date banner, search) and the bars keep their 16 px inset. The `NavBar` divider now spans the
  full width.
- Touch-scroll the list: the thumb appears, tracks the scroll through momentum, and fades about 1 s
  after the list stops. At the end of the list, the thumb stops above the frosted deck and never
  slides into it. There are no dropped frames while scrolling. If frames drop, a follow-up
  adds `requestAnimationFrame` throttling (risk d).
- Tap the scroll-to-top button: the thumb flashes during the programmatic scroll. Confirm this
  reads as acceptable, not as noise (risk b). Also scroll down, then type in search or switch
  room tab so the list shrinks: the clamp flash that follows should also read as acceptable.
- The status strip still looks as before: inset 16 px with rounded corners (decision f).
- Open the Add/Edit form. If it overflows the screen, scrolling shows a thumb inside the card's
  rounded corners, and tapping outside the card still cancels.

## Status
finished: false
