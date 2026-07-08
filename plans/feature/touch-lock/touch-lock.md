# F2 — Double-tap accidental-touch lock

## Summary
Add a local-only (per-browser tab), inactivity-driven interaction lock that protects the
kiosk from accidental touches: after 5 minutes with no interaction, the app locks and a
full-viewport overlay swallows taps until the user performs a "close-enough" double-tap
(two taps within 1.5s and 60px of each other) to re-arm it. A `LockKeyhole`/`LockKeyholeOpen`
icon renders fixed top-left at all times reflecting current state, and the overlay itself
animates a centered padlock that shrinks to the corner on a lone tap, or opens-and-minimizes
to the corner on a qualifying second tap. Scope for this feature is **local-only** — no
backend change, no new SSE event type, no cross-device sync (explicit user decision,
2026-07-08; cross-device sync is an out-of-scope fast-follow, not part of this plan).

## Research Findings
- **F1's screen-blank feature is a near-exact structural precedent.** `useScreenBlank.ts`
  already implements the *same* 5-minute inactivity-timer pattern this feature needs
  (`INACTIVITY_MS = 5 * 60 * 1000`, `armInactivityTimer`/`wake`, document-wide
  `pointerdown`/`keydown` listeners that reset the countdown, attached only while
  "awake"). `App.tsx` pairs `isBlanked` with `inert={isBlanked}` on the root `.App` div
  (lines 255, 265) and conditionally portals `<ScreenBlankOverlay onWake={wake} />` (lines
  259, 306) as an inert-exempt sibling. This lock feature's hook/overlay should mirror that
  shape almost exactly.
- **Every gated interaction surface (tap-to-complete, swipe-edit/delete, Add Task, room
  filter, search) is wired through plain callback props rooted entirely in `App.tsx`**, with
  zero external importers of any handler (`handleCompleteChore` line 206, `handleRequestEdit`
  line 226, `handleRequestDelete` line 192, `AddChoreButton`'s inline `onClick` line 286,
  `NavBar`'s `onSelect={setSelectedRoom}` line 273, `ChoreSearchInput`'s
  `onChange={setSearchQuery}` line 281). This means gating via `inert` on the app root (F1's
  approach) blocks all six surfaces at once with **zero changes** to `ChoreTimerBar.tsx`,
  `ChoreList.tsx`, `NavBar.tsx`, `AddChoreButton.tsx`, or `ChoreSearchInput.tsx` and their
  existing unit tests.
- **`isRepullGated` (`App.tsx` lines 50-53) composes exactly `isMutatingRef.current || showForm
  || editingId !== null || pendingDeleteId !== null`** and does **not** include `isBlanked`
  today — instead a separate effect (lines 121-127) force-closes any open form/dialog when
  blanking begins, letting `isRepullGated` naturally clear. The lock state must follow this
  same precedent: **do not** add lock state into `isRepullGated`; SSE re-pulls keep flowing
  silently while locked, and a symmetrical effect force-closes open dialogs when the lock
  re-engages.
- **lucide-react 1.8.0 is installed** with `LockKeyhole`/`LockKeyholeOpen` confirmed as valid
  named imports (more padlock-shaped than the plainer `Lock`/`Unlock`). **No animation
  library exists** in the dependency tree — all existing animation is Tailwind
  `transition-*`/`duration-*` utility classes plus hand-written `@keyframes` in
  `frontend/src/index.css`, sequenced with `setTimeout` (never `requestAnimationFrame`). The
  padlock's grow/shrink/open/minimize sequence must follow this same convention.
- **F1 vs. F2 precedence (previously an explicit open risk in `plans/META-PLAN.md`, F1 now
  merged):** when the screen is blanked (F1), a single tap wakes it and that tap must not
  also count as this feature's "first tap." Resolution below wires `TouchLockOverlay` to
  render only when `(isLocked || isClosing) && !isBlanked`, at a lower z-index than
  `ScreenBlankOverlay`, so F1's overlay always wins when both are simultaneously true. (The
  `isClosing` disjunct is Design decision #7/DD-1's unlock-animation hand-off, resolved during
  this plan's review — it is not itself a precedence concern with F1, just part of the render
  condition.)
- **`e2e/smoke.spec.ts`'s shared `beforeEach` pins the wall clock to noon** and runs every
  existing flow (Add Task, swipe, tap-to-complete) with **no unlock step**. This fixes the
  default-state design decision: the lock **must default to armed/unlocked on mount** (a
  fresh page load counts as the "last interaction"), locking only after 5 real/simulated
  minutes of subsequent inactivity — otherwise every existing e2e test would need a new
  unlock step. **Five** App-level test files render `<App />`: `App.test.tsx`,
  `App.sync.test.tsx`, and `App.search.test.tsx` mock `../hooks/useScreenBlank` inline to a
  fixed `{ isBlanked: false, wake: () => {} }`; `App.screenBlank.test.tsx` mocks it via
  `vi.hoisted`; `App.screenBlank.realClock.test.tsx` deliberately leaves it unmocked to
  exercise the real hook. A new `useTouchLock` mock (defaulting to `{ isLocked: false, arm:
  () => {} }`, matching each file's existing mock style) must be added to **all five** files
  once `App.tsx` calls `useTouchLock()` unconditionally — see Step 4's regression-guard to-do.
- **`inert`'s blanket, DOM-subtree-wide gating also incidentally closes a pre-existing gap in
  `ChoreTimerBar.tsx`**: its sr-only keyboard/AT-fallback Edit/Delete buttons (lines 134-151)
  bypass the `isSimulating` check that gates the main tap/swipe paths. Since `inert` disables
  focus/pointer/keyboard interaction on the entire `.App` subtree regardless of any
  component-local logic, this lock feature closes that same gap for free — verified against
  `ChoreTimerBar.tsx` during planning, no code change needed there.

## Design decisions (resolved during this planning session)

1. **Scope: local-only.** Confirmed by the user (2026-07-08) ahead of this plan. No backend
   endpoint, no new SSE event type, no persisted/cross-device lock state. Purely
   `frontend/src/hooks/useTouchLock.ts` + two new components, wired into `App.tsx`.
2. **Default state: armed (unlocked) on mount.** The inactivity timer starts immediately on
   mount as if the page load itself were the "last interaction." This keeps every existing
   test/e2e flow working unmodified and matches the ledger's framing ("re-engages 5 minutes
   after the last interaction").
3. **Gating mechanism: `inert` on the app root**, exactly like F1 — `inert={isBlanked ||
   isLocked}` on both `.App` wrapper occurrences (loading branch line 255, main branch line
   265). No per-component `disabled`/`locked` props threaded into `ChoreTimerBar`, `NavBar`,
   `AddChoreButton`, or `ChoreSearchInput`.
4. **`isRepullGated` is unchanged** — lock state is not added to its dependency list. A new
   effect (parallel to the existing `isBlanked`-driven one at lines 121-127) force-closes any
   open add/edit/delete UI when the lock re-engages, so `isRepullGated` naturally clears the
   same way it already does for screen-blank.
5. **F1/F2 precedence:** `TouchLockOverlay` renders only when `(isLocked || isClosing) &&
   !isBlanked` (screen-blank always wins when both are true; `isClosing` is DD-1's unlock-
   animation hand-off state, see Step 4); its portal uses a lower z-index (`z-[90]`) than
   `ScreenBlankOverlay`'s `z-[100]`. The always-visible corner
   `TouchLockIndicator` renders regardless of `isBlanked` but sits at `z-[80]` — beneath the
   opaque `ScreenBlankOverlay`, so it is naturally hidden behind it while blanked without
   needing its own conditional.
6. **Double-tap thresholds:** a qualifying second tap must land within
   `SECOND_TAP_WINDOW_MS = 1500` ms **and** `SECOND_TAP_MAX_DISTANCE_PX = 60` px of the first
   tap's `(clientX, clientY)`. Keyboard activation (Enter/Space, for accessibility, mirroring
   `ScreenBlankOverlay`'s pattern) has no meaningful "position," so any second Enter/Space
   within the timing window counts as qualifying regardless of "distance." **These exact
   values (1500ms / 60px) are a reasonable default assumption made during planning, not a
   validated UX spec** — they are plausible for kiosk touch targets but should be revisited
   after on-device testing if double-tap-to-unlock feels too strict or too loose in practice.
7. **Animation implementation:** CSS-only (Tailwind transition/duration utility classes +
   inline computed transform/opacity values), sequenced with `setTimeout`, mirroring
   `useScreenBlank`/`ChoreTimerBar`'s existing conventions. No animation library is added.
   `TouchLockOverlay` owns a local `phase` state machine:
   - `'just-relocked'` (mounted because `isLocked` just became `true`): briefly renders a
     centered, closed padlock (using `LockKeyhole`) that shrinks/translates toward the
     corner over ~600ms, then settles to `'idle'`. To mask the same one-React-commit gap that
     F1's always-opaque `ScreenBlankOverlay` avoids for free (the new `isLocked`-driven
     dialog-close effect in `App.tsx` runs one commit after `isLocked` flips, so a portaled
     `ConfirmDialog`/`ChoreFormModal` could otherwise flash visible for that one commit), this
     phase also renders a brief semi-opaque backdrop (e.g. `bg-black/40`, fading out via the
     same `transition-all duration-300` as the padlock) behind the centered padlock during
     this entrance — resolved design decision, see Step 3's Green to-do.
   - `'idle'`: invisible (fully transparent, no backdrop) tap-catching layer only (still fully
     covers the viewport and blocks taps via `inert` on the app root beneath it), corner
     indicator shows closed.
   - `'awaiting-second-tap'` (after a qualifying first tap): renders a centered closed
     padlock; if no qualifying second tap arrives within `SECOND_TAP_WINDOW_MS`, reverts to
     `'idle'` (shrinks back to corner, still locked).
   - On a qualifying second tap: briefly render a centered **open** padlock
     (`LockKeyholeOpen`) shrinking toward the corner, call the `arm()` callback immediately.
     **Resolved:** `App.tsx` (Step 4), not `TouchLockOverlay` itself, is responsible for
     keeping the overlay mounted through this `'opening'` phase's visual — `App` tracks its
     own `isClosing` state (independent of `isLocked`) and renders `TouchLockOverlay` while
     `isLocked || isClosing`, so the overlay component itself does not need to defer or delay
     calling `onArm()`. **Accepted edge case:** because `TouchLockOverlay`'s internal `phase`
     only initializes from `justRelocked` on mount (and the component stays mounted across the
     `isClosing` bridge rather than unmounting/remounting), a fresh re-lock that happens to
     land within the ~400ms `CLOSING_SETTLE_MS` window of a just-armed unlock would not replay
     the `'just-relocked'` entrance animation on that particular occurrence. Given the 5-minute
     inactivity window this re-lock is gated behind, this is not realistically reachable in
     practice; no code change is made for it.
8. **Corner indicator (`TouchLockIndicator`):** always mounted (independent of `isLocked`),
   fixed top-left, decorative (`aria-hidden="true"`, `pointer-events-none` — mirrors
   `ChoreSearchInput`'s decorative `Search` icon convention), swaps between `LockKeyhole`
   (locked) and `LockKeyholeOpen` (armed) based on the `isLocked` prop it receives from
   `App.tsx`.

## Steps

### 1. `useTouchLock` hook — inactivity timer + arm/relock state

Build the hook that owns the boolean lock state and the 5-minute inactivity countdown,
directly mirroring `useScreenBlank.ts`'s timer/activity-listener pattern but without any
wall-clock boundary logic (this feature has no time-of-day window — it is purely
activity-driven, always active).

**To-do:**
- [x] Red: create `frontend/src/__tests__/hooks/useTouchLock.test.ts` mirroring
  `frontend/src/__tests__/hooks/useScreenBlank.test.ts`'s structure (`renderHook` from
  `@testing-library/react`, `vi.useFakeTimers()`/`vi.advanceTimersByTime()` wrapped in
  `act()`, `afterEach(() => vi.useRealTimers())`). Assert: (a) `result.current.isLocked` is
  `false` immediately after mount (default-armed decision #2 above); (b) after advancing
  timers by `5 * 60 * 1000` ms with zero activity, `isLocked` becomes `true`; (c) dispatching
  `document.dispatchEvent(new Event('pointerdown'))` (or `'keydown'`) partway through the
  5-minute window resets the countdown (advancing the remaining original time does not lock,
  only a full fresh 5 minutes of silence after the last event does); (d) calling
  `result.current.arm()` while locked flips `isLocked` back to `false` and restarts the
  5-minute countdown from that point; (e) unmount clears the pending timer (`vi.spyOn(globalThis,
  'clearTimeout')` + `unmount()` assertion, matching `useScreenBlank.test.ts`'s cleanup test).
  Run `cd frontend && npx vitest run src/__tests__/hooks/useTouchLock.test.ts` and confirm it
  fails (module doesn't exist yet).
- [x] Green: create `frontend/src/hooks/useTouchLock.ts` exporting `INACTIVITY_MS = 5 * 60 *
  1000` and `useTouchLock(): { isLocked: boolean; arm: () => void }`. Internal shape: `const
  [isLocked, setIsLocked] = useState(false)`; an `inactivityTimerRef` holding the pending
  `setTimeout`; an `armInactivityTimer` callback (clears any existing timer, sets a fresh
  `setTimeout(() => setIsLocked(true), INACTIVITY_MS)`); call `armInactivityTimer()` once on
  mount via `useEffect(() => { armInactivityTimer(); return cleanup-clearTimeout; }, [])`; a
  document-wide activity-listener effect that attaches `pointerdown`/`keydown` listeners
  **only while `!isLocked`**, each calling `armInactivityTimer()` (mirrors
  `useScreenBlank.ts`'s `if (!inWindow || !awake) return;` guard, adapted to
  `if (isLocked) return;`); an `arm` callback that does `setIsLocked(false)` then
  `armInactivityTimer()`. Re-run the test file and confirm all cases pass.
- [x] Refactor: confirm naming/structure consistency with `useScreenBlank.ts` (constant
  naming, cleanup-effect ordering, comment style if any non-obvious invariant needs one — e.g.
  why the mount-time effect must run exactly once). Re-run
  `npx vitest run src/__tests__/hooks/useTouchLock.test.ts` to confirm still green.

### 2. `TouchLockIndicator` — always-visible corner icon

Presentational component: fixed top-left icon reflecting current lock state.

**To-do:**
- [x] Red: create `frontend/src/__tests__/components/TouchLockIndicator.test.tsx` mirroring
  `ScreenBlankOverlay.test.tsx`'s isolated-render style (`render`/`screen` from
  `@testing-library/react`, no App/providers). Assert: rendering
  `<TouchLockIndicator isLocked={true} />` shows a `data-testid="touch-lock-indicator"`
  element containing the closed-padlock icon (assert via a nested
  `data-testid="touch-lock-icon-closed"` or by checking the icon's accessible name/class —
  pick whichever the component implementation exposes, see Green below); rendering with
  `isLocked={false}` shows the open-padlock variant instead; the indicator element has
  `aria-hidden="true"` and a class implying `pointer-events-none` (assert via
  `toHaveClass('pointer-events-none')` or equivalent). Run `npx vitest run
  src/__tests__/components/TouchLockIndicator.test.tsx`, confirm it fails (component doesn't
  exist).
- [x] Green: create `frontend/src/components/common/TouchLockIndicator.tsx`, exported as
  `export default function TouchLockIndicator(...)` (matching every existing file under
  `components/common/`/`components/chore/`, all of which use a default export with no
  named-export exceptions) — a plain (non-portal — this one lives inside the normal render
  tree, not `document.body`) `<div className="fixed top-2 left-2 z-[80] pointer-events-none"
  aria-hidden="true" data-testid="touch-lock-indicator">` rendering `<LockKeyhole
  data-testid="touch-lock-icon-closed" .../>` when `isLocked` else `<LockKeyholeOpen
  data-testid="touch-lock-icon-open" .../>` from `lucide-react`. Re-run the test file, confirm
  green.
- [x] Refactor: match sizing/color conventions used elsewhere for small persistent icons
  (check `ChoreSearchInput.tsx`'s `Search` icon classes — `w-4 h-4 text-gray-400` — and pick a
  visually-appropriate top-left size/color, e.g. `w-5 h-5 text-gray-300`). Re-run tests,
  confirm still green.

### 3. `TouchLockOverlay` — tap-catching overlay + double-tap detection + animation phases

The interactive piece: only rendered while locked (and only while not screen-blanked, wired
in Step 4), it swallows taps, detects a qualifying "close-enough" double-tap, and drives the
`phase` state machine described in Design decision #7.

**To-do:**
- [ ] Red: create `frontend/src/__tests__/components/TouchLockOverlay.test.tsx` mirroring
  `ScreenBlankOverlay.test.tsx` (render in isolation with `onArm={vi.fn()}`, plus
  `vi.useFakeTimers()` for the timing-window assertions). Assert: (a) the overlay renders a
  `data-testid="touch-lock-overlay"` full-viewport element with `role="button"`; (b) a single
  click (via `fireEvent.click(overlay, { clientX: 100, clientY: 100 })`) does **not** call
  `onArm`, and a `data-testid="touch-lock-padlock-centered"` element becomes visible showing
  the closed-icon variant; (c) advancing fake timers past `SECOND_TAP_WINDOW_MS` (1500ms)
  with no further click makes the centered padlock element disappear/revert (assert via
  `queryByTestId('touch-lock-padlock-centered')` becoming null or gaining a "hidden" class —
  pick one and assert consistently) and `onArm` still not called; (d) a second click at
  `{ clientX: 110, clientY: 105 }` (within 60px) fired within 1500ms of the first **does**
  call `onArm` exactly once, the centered element briefly shows the open-icon variant before
  the test's fake-timer window elapses, and the overlay's own outer element (the
  `data-testid="touch-lock-overlay"` container) gains a `pointer-events-none` class at this
  point (`toHaveClass('pointer-events-none')`) — proving it stops intercepting taps once
  `arm()` has fired, even though `App.tsx` (Step 4) keeps it mounted a while longer for the
  close animation; (e) a second click at `{ clientX: 300,
  clientY: 300 }` (more than 60px away) within the time window is treated as a **new** first
  tap instead — `onArm` is not called, and a third click within 60px/1500ms of *that* second
  click now qualifies; (f) keyboard activation: `fireEvent.keyDown(overlay, { key: 'Enter' })`
  twice within the timing window (no coordinates involved) calls `onArm`; (g) boundary values:
  a second click at exactly `SECOND_TAP_MAX_DISTANCE_PX` (60px) away (choose coordinates so
  `Math.hypot(dx, dy) === 60` exactly, e.g. first tap at `{100,100}`, second at `{136,148}` —
  `hypot(36,48) = 60`) still qualifies as `onArm`-triggering; a second click fired at exactly
  `SECOND_TAP_WINDOW_MS` (1500ms) after the first, via `vi.advanceTimersByTime(1500)`
  immediately before firing the click, still qualifies (both boundaries use inclusive `<=` per
  the Green to-do below — these tests catch an accidental `<` instead). Also add a `phase:
  'just-relocked'` case: rendering `<TouchLockOverlay onArm={vi.fn()} justRelocked />` — this
  is the finalized prop name, used identically in this component's own Green to-do and in
  Step 4's App.tsx wiring — shows the centered closed-padlock immediately on mount without
  requiring a tap, **with a semi-opaque backdrop element also present** (assert via a
  `data-testid="touch-lock-backdrop"` element, resolved Design decision #7/DD-4), then both
  disappear after ~600ms via fake-timer advancement. Also assert (h): after a qualifying
  second tap (per case (d) above), the component keeps rendering (does not unmount itself) —
  `onArm` being called is the only signal it emits; this component does **not** own any
  unmount/settle timing itself (that responsibility belongs to `App.tsx`, per Step 4 — see
  resolved Design decision #7). Run `npx vitest run
  src/__tests__/components/TouchLockOverlay.test.tsx`, confirm failure.
- [ ] Green: create `frontend/src/components/common/TouchLockOverlay.tsx`, exported as
  `export default function TouchLockOverlay(...)` (matching the project's 100%-consistent
  default-export convention for `components/common/`), also exporting the named constants
  `SECOND_TAP_WINDOW_MS = 1500`, `SECOND_TAP_MAX_DISTANCE_PX = 60`, and
  `CLOSING_SETTLE_MS = 400` (the last one imported by `App.tsx` in Step 4 so the component's
  own CSS transition duration for the `'opening'` phase and App's `isClosing` unmount-delay
  timer stay numerically in sync). Props: `{ onArm: () => void; justRelocked?: boolean }`.
  Use `createPortal` to `document.body` (mirroring `ScreenBlankOverlay.tsx`), `fixed inset-0
  z-[90]`, `role="button"`, `tabIndex={0}`, `aria-label="Tap twice to unlock"`,
  `data-testid="touch-lock-overlay"`. Internal state: `phase: 'just-relocked' | 'idle' |
  'awaiting-second-tap' | 'opening'` (initialize to `justRelocked ? 'just-relocked' :
  'idle'`); a `firstTapRef` holding `{ x: number; y: number; at: number } | null`; a
  `phaseTimerRef` for the shrink-back/settle timeouts. Implement `registerTap(x: number, y:
  number)`: if `firstTapRef.current` exists and `Date.now() - firstTapRef.current.at <=
  SECOND_TAP_WINDOW_MS` and `Math.hypot(x - firstTapRef.current.x, y -
  firstTapRef.current.y) <= SECOND_TAP_MAX_DISTANCE_PX`, clear `firstTapRef`, set `phase =
  'opening'` (renders the open padlock, transitioning via `transition-all duration-[400ms]`
  to match `CLOSING_SETTLE_MS` — **note this Tailwind class is a literal mirror of the
  constant, not derived from it**; if `CLOSING_SETTLE_MS` is ever changed, this class must be
  updated by hand in the same edit, or switched to an inline
  `style={{ transitionDuration: \`${CLOSING_SETTLE_MS}ms\` }}` if drift risk becomes a real
  concern), and call `onArm()` — **this component does not schedule any
  unmount or further phase change of its own after this**; `App.tsx` (Step 4) owns keeping it
  mounted long enough for the `'opening'` phase's shrink transition to finish, via its own
  `isClosing` state. Otherwise: set `firstTapRef.current = { x, y, at:
  Date.now() }`, `phase = 'awaiting-second-tap'`, and schedule a `setTimeout(() => {
  setPhase('idle'); }, SECOND_TAP_WINDOW_MS)` (clearing any prior pending shrink-timer first).
  **This shrink-back timeout must only revert the visual `phase` — it must NOT also null
  `firstTapRef.current`.** `firstTapRef` has a single source of truth for staleness: the
  `Date.now() - firstTapRef.current.at <= SECOND_TAP_WINDOW_MS` check inside `registerTap`
  itself. If the shrink-back timeout also nulled `firstTapRef.current`, it would fire (since
  fake-timer advances run every timer due at or before the advanced time, i.e. inclusively) in
  the exact same tick as a tap arriving at precisely `SECOND_TAP_WINDOW_MS` later, wiping the
  ref before `registerTap` can evaluate it — silently defeating the inclusive `<=` comparison
  regardless of whether it's implemented correctly, and directly contradicting to-do (g)'s own
  exact-boundary test below. A tap arriving after `firstTapRef` naturally becomes stale is
  already correctly treated as a new first tap by the elapsed-time check alone, so nulling it
  from a second, independent timer is both unnecessary and actively harmful here. `onClick`
  calls `registerTap(event.clientX, event.clientY)`. `onKeyDown` for `'Enter'`/`' '` calls
  `registerTap(0, 0)` (keyboard has no position; using a fixed `(0,0)` for both taps means two
  keyboard activations are always "close enough" to each other, satisfying Design decision
  #6). If `justRelocked`, an effect on mount schedules `setTimeout(() => setPhase('idle'),
  600)` to transition out of the entrance animation. Render the centered padlock
  (`data-testid="touch-lock-padlock-centered"`, `LockKeyhole` for
  `'just-relocked'`/`'awaiting-second-tap'` phases, `LockKeyholeOpen` for `'opening'`) only
  when `phase !== 'idle'`, using Tailwind `transition-all duration-300` plus a `scale-100
  opacity-100`/`scale-0 opacity-0` toggle keyed off the phase (origin top-left, roughly
  translating toward the corner — exact translate values are a visual-polish detail, not
  test-asserted). Additionally, only during `phase === 'just-relocked'`, render a
  `data-testid="touch-lock-backdrop"` element (e.g. `fixed inset-0 bg-black/40
  transition-opacity duration-300`) that fades out together with the centered padlock as the
  phase settles to `'idle'` (resolved Design decision #7/DD-4 — masks the one-commit gap
  before `App.tsx`'s `isLocked`-driven dialog-close effect runs). **Once `phase === 'opening'`,
  add `pointer-events-none` to the overlay's outer `fixed inset-0` container** (the same
  element carrying `data-testid="touch-lock-overlay"`/`role="button"`) so that during the
  `CLOSING_SETTLE_MS` window `App.tsx` (Step 4) keeps this component mounted for, it stops
  intercepting real taps aimed at the app underneath — without this, every successful unlock
  would have a ~400ms window where the (by-then-vestigial) overlay silently swallows the
  user's very next tap instead of letting it reach the chore bar/search input/etc. beneath it,
  contradicting `META-PLAN.md`'s F2 "while armed, all existing interactions ... behave exactly
  as before this feature." The centered padlock's own shrink/fade visual is unaffected by
  `pointer-events-none` (it's purely a CSS property, not a visibility change). Clear all
  pending timers on unmount. Re-run the test file, confirm all cases pass.
- [ ] Refactor: extract the shrink/settle timeout scheduling into one small local helper if
  the click/keydown paths duplicate too much of the same clear-then-schedule logic. Re-run
  `npx vitest run src/__tests__/components/TouchLockOverlay.test.tsx`, confirm still green.

### 4. Wire into `App.tsx` + coordinate with F1's `useScreenBlank`

**To-do:**
- [ ] Red: create `frontend/src/__tests__/App.touchLock.test.tsx` mirroring
  `App.screenBlank.test.tsx`'s structure exactly: `vi.mock('../hooks/useTouchLock', () => ({
  useTouchLock: mockUseTouchLock }))` with `mockUseTouchLock = vi.hoisted(() => vi.fn(() => ({
  isLocked: false, arm: mockArm })))`, plus the same `choreApi`/`useMidnightClock`/`FakeEventSource`
  mock scaffolding already used by that file. Also mock `../hooks/useScreenBlank` to its
  default `{ isBlanked: false, wake: () => {} }` (needed since `App.tsx` always calls both
  hooks). **Important — `TouchLockOverlay` is portaled to `document.body` (via
  `createPortal`, same as `ScreenBlankOverlay`), so it is never a DOM descendant of `.App`.**
  Any `.closest('.App')` assertion in this file must be performed on a non-portaled element
  — `screen.getByTestId('touch-lock-indicator')` (confirmed non-portal per Step 2) or on
  chore/loading text exactly as `App.screenBlank.test.tsx` already does — **never** on
  `screen.getByTestId('touch-lock-overlay')`, which would return `null` from `.closest()` and
  throw on `.toHaveAttribute(...)`. Assert: (a) `queryByTestId('touch-lock-overlay')` is
  absent and `touch-lock-indicator` shows the open-icon variant when `isLocked: false`; (b)
  setting `mockUseTouchLock` to return `isLocked: true` and re-rendering shows the overlay,
  `touch-lock-indicator` shows the closed-icon variant, and
  `screen.getByTestId('touch-lock-indicator').closest('.App')` has the `inert` attribute; (b2)
  mirroring `App.screenBlank.test.tsx` lines 93-102, a **loading-branch** case: mock
  `fetchAllChores` to return a never-resolving promise, set `mockUseTouchLock` to `isLocked:
  true`, and assert `screen.getByText('Loading chores...').closest('.App')` also has the
  `inert` attribute (this exercises the *other* `.App` occurrence at `App.tsx` line 255, which
  the main-branch case in (b) does not reach); (c) **jsdom-safe overlay-swallow check only**
  (jsdom has zero behavioral implementation of `inert` — confirmed via source, zero matches in
  `node_modules/jsdom/lib/jsdom/living` — so no assertion here may fire a gesture directly on
  a gated *descendant* of `.App` and expect it to be silently blocked; that class of proof is
  **out of scope for this file** and deferred entirely to Step 5's real-browser Playwright
  test): with `isLocked: true`, click `screen.getByTestId('touch-lock-overlay')` itself
  (mirroring `App.screenBlank.test.tsx`'s lines 80-91 "clicking the overlay calls wake and
  swallows the tap" pattern exactly) and assert `completeChore`/`addChore`/`updateChore`/
  `removeChore` were **not** called as a side effect of that one click — this is jsdom-safe
  because the click is dispatched to the overlay's own portaled DOM node, which is never an
  ancestor or descendant of the chore bar/search input/etc., so it proves the overlay doesn't
  accidentally trigger anything on its own, but it does **not** prove `inert` blocks a click
  fired directly on an underlying element — do **not** add a to-do that fires `swipe()`/
  `stubBarWidth()`-style events directly on the chore bar, search input, room tabs, or Add
  Task button while `isLocked: true` and asserts their handlers don't run; that assertion
  cannot pass in jsdom regardless of implementation correctness, and Step 5's e2e suite is
  the only place this feature's actual gating is proven; (d) all of the six gated gestures
  (tap-to-complete, swipe-edit, swipe-delete, add-task, room-filter, search) **do** fire
  normally when `isLocked: false` — duplicate this file's own local copies of
  `App.test.tsx`'s `swipe()`/`stubBarWidth()` helpers (matching the existing precedent of
  independent per-file duplication in `App.test.tsx` and `App.screenBlank.test.tsx` — no
  shared/extracted helper module exists to import from) to drive these gestures, a direct
  mirror of `App.screenBlank.test.tsx`'s final "still function normally when isBlanked is
  false" tests; (e) opening the add-chore form or the delete-confirm dialog,
  then re-rendering with `isLocked: true`, causes the open form/dialog to auto-close (mirrors
  the DD-6 auto-dismiss pattern in `App.screenBlank.test.tsx`); (f) when **both** `isBlanked:
  true` (mock `useScreenBlank`) and `isLocked: true` are simultaneously set, only
  `screen-blank-overlay` renders — `touch-lock-overlay` must be absent (precedence decision
  #5); (g) **the isClosing hand-off requires actually triggering the real, unmocked
  `handleArm`** — a mock-value change alone cannot exercise it, since `isClosing` is `App`'s
  own local state, not part of `useTouchLock`'s mocked return value. **Timer sequencing**:
  render `<App />` and `await waitFor(...)` for the initial chore load to resolve **under real
  timers first** (mirroring `App.test.tsx`'s own established pattern of loading under real
  timers before switching to fake ones — RTL's `waitFor` polls via its own timer mechanism and
  will hang if fake timers are already active and never manually advanced), then set
  `mockUseTouchLock` to return `isLocked: true` and re-render, **then** call
  `vi.useFakeTimers()` for the remainder of this case (restoring real timers afterward, e.g.
  via `try`/`finally` or `afterEach`). With `isLocked: true` now in effect, fire two real
  `fireEvent.click(screen.getByTestId('touch-lock-overlay'), { clientX: 100, clientY: 100 })`
  calls (identical coordinates both times, well within `SECOND_TAP_MAX_DISTANCE_PX`) within
  `SECOND_TAP_WINDOW_MS` of each other — this drives the real `TouchLockOverlay`/`registerTap`
  logic under test, which calls the real
  (App-level) `handleArm`, which calls the mocked `arm` **and** sets `App`'s own `isClosing`
  to `true`. Assert `touch-lock-overlay` is still present immediately after the second click
  (proving `isClosing` is bridging the gap even though `mockUseTouchLock` still returns
  `isLocked: true` at this point — the overlay's own internal `phase` has moved to
  `'opening'`). Then update `mockUseTouchLock` to return `isLocked: false` and `rerender(<App
  />)` (representing what the real hook would do once `arm()` fires), and confirm
  `touch-lock-overlay` is **still** present (now held up purely by `isClosing`, since
  `isLocked` is `false`). Finally, advance past `CLOSING_SETTLE_MS` (400ms) via
  `vi.advanceTimersByTime`, and confirm the overlay is now gone. This proves App's own
  `isClosing` hand-off (resolved Design decision #7) actually keeps the overlay mounted
  through its close animation instead of vanishing instantly. Note: day-simulation
  Next/Previous-day/"Return to Today" buttons are also
  correctly gated by `inert` (same blanket mechanism as the six named surfaces) but are
  **intentionally not given dedicated assertions here** — resolved design choice, documented
  rather than tested, since the coverage is generic to anything rendered inside `.App` and
  not specific to this feature. Run `cd frontend && npx vitest run
  src/__tests__/App.touchLock.test.tsx`, confirm it fails (no wiring yet).
- [ ] Green — edit `frontend/src/App.tsx`: import `useTouchLock` from
  `'./hooks/useTouchLock'`, `TouchLockIndicator` and `TouchLockOverlay` (also importing its
  exported `CLOSING_SETTLE_MS` constant) from `'./components/common/TouchLockIndicator'` /
  `'./components/common/TouchLockOverlay'`. Add `const { isLocked, arm } = useTouchLock();`
  alongside the existing `const { isBlanked, wake } = useScreenBlank();` (line 22). Add local
  state `const [isClosing, setIsClosing] = useState(false);` and a `closingTimerRef`. Wrap the
  `arm` callback passed to the overlay so that on invocation it also kicks off the close
  hand-off: `const handleArm = () => { arm(); setIsClosing(true); if
  (closingTimerRef.current) clearTimeout(closingTimerRef.current); closingTimerRef.current =
  setTimeout(() => setIsClosing(false), CLOSING_SETTLE_MS); };` (add a cleanup
  `useEffect(() => () => { if (closingTimerRef.current) clearTimeout(closingTimerRef.current);
  }, [])` to clear this on unmount). Change both `.App` wrapper `inert` props (lines 255, 265)
  from `inert={isBlanked}` to `inert={isBlanked || isLocked}` (note: `isClosing` is
  deliberately **not** included here — once `arm()` fires, the app should already be
  interactive again; `isClosing` only keeps the overlay's own visual mounted, not the `inert`
  gate). Render `<TouchLockIndicator isLocked={isLocked} />` unconditionally near the top of
  both render branches (it manages its own `z-[80]` stacking so it doesn't need conditional
  logic — Design decision #5). Render the overlay conditionally:
  `{(isLocked || isClosing) && !isBlanked && <TouchLockOverlay onArm={handleArm} />}` next to
  the existing `{isBlanked && <ScreenBlankOverlay onWake={wake} />}` lines (259, 306) — this
  is the resolved Design decision #7 hand-off: the overlay stays mounted through its own
  `'opening'`-phase close animation because `isClosing` keeps the render condition true for
  `CLOSING_SETTLE_MS` after `isLocked` already flipped to `false`. Add a `justRelocked`
  hand-off so the entrance animation isn't cut short: **resolved** — mutate a
  `const wasLockedRef = useRef(isLocked)` directly in the render body (not inside a
  `useEffect`, to avoid an off-by-one-render lag): compute
  `const justRelocked = isLocked && !wasLockedRef.current;` immediately before the JSX return,
  then `wasLockedRef.current = isLocked;` right after computing `justRelocked` (both in the
  render body, in that order, so the flag reflects the transition on the same render it
  occurs). Pass `justRelocked={justRelocked}` to `<TouchLockOverlay>`. Add a new
  `useEffect(() => { if (isLocked) { setShowForm(false); setEditingId(null);
  setPendingDeleteId(null); } }, [isLocked]);` immediately following the existing
  `isBlanked`-driven dialog-closing effect (lines 121-127), matching its structure. Re-run
  `npx vitest run src/__tests__/App.touchLock.test.tsx`, confirm all cases pass.
- [ ] Green (regression guard) — this to-do must be applied together with the "Green — edit
  App.tsx" to-do above, as a single unit, since it exists specifically to contain that
  to-do's blast radius: once `App.tsx` calls `useTouchLock()` unconditionally, **all five**
  test files that render `<App />` need a mock, or they'll invoke the real hook. Edit
  `frontend/src/__tests__/App.test.tsx`, `App.sync.test.tsx`, and `App.search.test.tsx`: add a
  `vi.mock('../hooks/useTouchLock', () => ({ useTouchLock: () => ({ isLocked: false, arm: ()
  => {} }) }))` to each file's existing mock block (same inline style already used for
  `useScreenBlank` in these three files). Also edit `App.screenBlank.test.tsx`: add a
  `useTouchLock` mock using the same `vi.hoisted` style already used there for
  `useScreenBlank`, defaulting to `{ isLocked: false, arm: () => {} }`. Also edit
  `App.screenBlank.realClock.test.tsx`: add the same inline-style mock as the first three
  files (this file deliberately leaves `useScreenBlank` unmocked, but `useTouchLock` is a
  separate hook under separate test — mocking it here doesn't compromise this file's
  real-clock intent for screen-blank). Run `cd frontend && npx vitest run` (full suite) and
  confirm no regressions across all five files or elsewhere.
- [ ] Refactor: double check `TouchLockIndicator`'s `z-[80]` truly sits beneath
  `ScreenBlankOverlay`'s `z-[100]` (visual confirmation is out of scope for this automated
  step, but re-read both files together to confirm the class values are as specified). Re-run
  the full `npx vitest run` suite, confirm still green.

### 5. Playwright e2e coverage

**To-do:**
- [ ] Add a new `test.describe('F2: touch lock')` block to `e2e/smoke.spec.ts` (or a sibling
  spec file if the existing file's `beforeEach` structure makes a shared block awkward —
  match whatever the F1 screen-blank e2e tests did, since research found F1 added its
  dedicated tests directly into `smoke.spec.ts` at lines 36-94 using `page.clock.setFixedTime`
  + `page.reload()` to opt into the blanked window without disturbing the shared
  noon-pinned `beforeEach`). **Clock sequencing is critical here**: `useTouchLock`'s 5-minute
  inactivity timer is a real `setTimeout` registered at mount time (during the shared
  `beforeEach`'s `page.goto('/')`), which runs *before* any `page.clock.install()` call in the
  test body — Playwright's fake clock cannot retroactively adopt a timer already scheduled
  against the real implementation, so calling `install()` followed directly by
  `fastForward('5:01')` would have no effect on that already-pending timer. Mirror the DD-7
  pattern this file already uses (`setFixedTime` + `page.reload()`): call
  `await page.clock.install()`, then `await page.reload()` so `useTouchLock`'s timer is
  (re-)registered *under* the now-installed fake clock, **then** call
  `await page.clock.fastForward('5:01')` (or the equivalent virtual-time-advance method for
  this Playwright version) to deterministically trigger the inactivity lock without a real
  5-minute wait. Assert `page.getByTestId('touch-lock-overlay')` becomes visible. To prove the
  overlay actually blocks a real pointer tap (not just that it's present), mirror the existing
  DD-7 companion test's technique exactly: get the target chore bar's `boundingBox()` and call
  `page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)` at its center — **do not**
  use locator `.click()` here, since Playwright's actionability check would detect the overlay
  intercepting the click and time out (or tempt a `{ force: true }` workaround that would
  produce a false-positive test verifying nothing about real hit-testing/z-index). Assert the
  chore's completion state is unchanged after this click. Then perform two `page.mouse.click`
  calls at the same coordinates in quick succession to simulate the qualifying double-tap, and
  assert the overlay disappears and a subsequent tap-to-complete/swipe/add-task action now
  succeeds.
- [ ] Confirm the existing (unmodified) `beforeEach`/tests in `smoke.spec.ts` still pass
  unmodified — they never advance the clock by 5 minutes of idle time within a single test,
  so the lock should never engage during those flows given decision #2 (armed on load).
  Run `npm run test:e2e` from the repo root and confirm the full suite (existing + new)
  passes.

### 6. Verify All Tests Pass

Run the full test suites to confirm nothing is broken:

**To-do:**
- [ ] Run `cd frontend && npx vitest run` and confirm all frontend unit tests pass
  (including the new `useTouchLock.test.ts`, `TouchLockIndicator.test.tsx`,
  `TouchLockOverlay.test.tsx`, `App.touchLock.test.tsx`, and the five updated existing
  App-level test files).
- [ ] Run `cd backend && npm test` (equivalently, `npm test --workspace backend` from the
  repo root) and confirm backend tests are unaffected (this feature makes no backend changes,
  but the full suite must still be green).
- [ ] Run `npm run test:e2e` from the repo root and confirm all Playwright tests pass,
  including the new touch-lock e2e coverage from Step 5.
- [ ] Investigate and fix any failures before marking this plan finished.
- [ ] Edit `plans/META-PLAN.md`'s F2 section (mirroring F1's own precedent of doing this
  edit as the last to-do in its final "Verify All Tests Pass" step, per
  `plans/feature/auto-screen-blank/auto-screen-blank.md`): replace Open risk (a) with a note
  that the local-only-vs-cross-device scope was resolved to **local-only** (user decision,
  2026-07-08); replace Open risk (b) (cross-device transport) with a note that it is **moot**
  given (a)'s local-only resolution — no transport needed since there is no cross-device
  state to sync; replace Open risk (c) with the resolved precedence (`TouchLockOverlay`
  renders only when `isLocked && !isBlanked`, lower z-index than `ScreenBlankOverlay`);
  replace Open risk (d) with the resolved CSS-only/no-library animation approach. **Explicitly
  rewrite the "Expected end state" bullet that currently reads "The armed/locked state is
  consistent across all connected devices per the goal..."** — this directly contradicts the
  local-only scope resolved by Design decision #1; replace it with a statement that this
  feature is local-only/per-browser, with cross-device sync as an explicit out-of-scope
  fast-follow, not delivered by this plan. Update any other "Expected end state" bullets that
  similarly drifted from what was actually implemented. Commit this META-PLAN.md edit in the
  same PR as this feature's implementation, per META-PLAN's cross-session persistence rule —
  do not defer it to a separate PR.

## Progress Tracking

- [x] **Step 1: `useTouchLock` hook — inactivity timer + arm/relock state** - COMPLETE (2026-07-08)
  - ✅ Red: `frontend/src/__tests__/hooks/useTouchLock.test.ts` created, confirmed failing (module didn't exist)
  - ✅ Green: `frontend/src/hooks/useTouchLock.ts` created, all 6 tests pass
  - ✅ Refactor: naming/structure confirmed consistent with `useScreenBlank.ts`; full frontend suite (23 files, 194 tests), `tsc --noEmit`, `eslint`, and `vite build` all clean
- [x] **Step 2: `TouchLockIndicator` — always-visible corner icon** - COMPLETE (2026-07-08)
  - ✅ Red: `frontend/src/__tests__/components/TouchLockIndicator.test.tsx` created, confirmed failing (module didn't exist)
  - ✅ Green: `frontend/src/components/common/TouchLockIndicator.tsx` created, all 3 tests pass
  - ✅ Refactor: sizing/color (`w-5 h-5 text-gray-300`) matches `ChoreSearchInput.tsx`'s icon convention; full frontend suite (24 files, 197 tests), `tsc --noEmit`, `eslint`, and `vite build` all clean
- [x] **Step 3: `TouchLockOverlay` — tap-catching overlay + double-tap detection + animation phases** - COMPLETE (2026-07-08)
  - ✅ Red: `frontend/src/__tests__/components/TouchLockOverlay.test.tsx` created, confirmed failing (module didn't exist)
  - ✅ Green: `frontend/src/components/common/TouchLockOverlay.tsx` created, all 10 tests pass; exports `SECOND_TAP_WINDOW_MS`, `SECOND_TAP_MAX_DISTANCE_PX`, `CLOSING_SETTLE_MS`
  - ✅ Refactor: extracted `clearPendingPhaseTimer()` helper to de-duplicate the clear-then-schedule pattern
  - ✅ Subagent review found a real bug: once `phase === 'opening'`, `pointer-events-none` blocked pointer input but not keyboard, so a stray Enter/Space during the `CLOSING_SETTLE_MS` grace window could regress `phase` and re-invoke `onArm()`. Fixed with an early-return guard in `registerTap` when `phase === 'opening'`, plus a regression test (11 tests total)
  - ✅ Full frontend suite (25 files, 208 tests), `tsc --noEmit`, `eslint`, and `vite build` all clean
- [ ] Step 4: Wire into `App.tsx` + coordinate with F1's `useScreenBlank`
- [ ] Step 5: Playwright e2e coverage
- [ ] Step 6: Verify All Tests Pass

## Status
finished: false
