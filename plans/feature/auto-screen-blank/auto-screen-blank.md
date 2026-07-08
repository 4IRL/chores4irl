# F1 — Auto screen-blank 9pm–6am

## Summary
Adds a kiosk power-saving feature: a full-viewport overlay automatically blanks the screen
between 21:00 and 06:00 local (real wall-clock) time, wakes immediately on tap (swallowing
that tap so it never reaches the chore list underneath), and re-blanks after 5 minutes of
inactivity while still inside the window. The app content wrapper is also made `inert` while
blanked, so a keyboard user can't Tab/Enter into hidden controls (Edit/Delete buttons, room
chips, search input, date-nav) either. Any open confirm-dialog or add/edit form is
auto-dismissed the instant blanking begins (`pendingDeleteId`/`editingId`/`showForm` are all
reset), so there is never anything left open in a `createPortal`-rendered layer for a
keyboard user to reach behind the overlay either — only the overlay itself (rendered via
`createPortal` outside the `inert` subtree) remains focusable/clickable/keyboard-operable
until wake. Entirely frontend; no backend/schema change.

## Research Findings
Research was done inline (no subagent fan-out) — this is a narrow, single-layer
(frontend-only) task touching ~4 new/changed files, well below the threshold that
warrants parallel research subagents. Key findings from direct reads:
- `frontend/src/hooks/useMidnightClock.ts` is the precedent to follow: a single
  `setTimeout` armed to the next `date-fns` boundary, re-arming via a `[now]`
  (or equivalent) effect dependency on state change. This feature needs the same
  single-timer-to-next-boundary shape, generalized to two alternating boundaries
  (21:00 and 06:00) instead of one daily midnight.
- `frontend/src/components/common/ConfirmDialog.tsx` is the precedent for a
  full-viewport `createPortal`-based overlay (`fixed inset-0 ... z-50`, backdrop
  click handler, `data-testid`, `role`/`aria-*`). The new overlay reuses this shape
  at a higher z-index (`z-[100]`) so it stacks above `ConfirmDialog`/`ChoreFormModal`
  if a device is idle while one of those is open.
- **Critical cross-cutting finding:** `App.tsx` will call the new hook unconditionally
  on every render. `frontend/src/__tests__/App.test.tsx`, `App.search.test.tsx`, and
  `App.sync.test.tsx` all currently run with **real** (unmocked) system time — they
  only mock `useMidnightClock`, not `Date.now()`/`new Date()` globally. If the new hook
  reads the real clock directly (which it must, per the Baseline's real-wall-clock
  requirement), any of these three suites could non-deterministically render the
  blank overlay and swallow clicks whenever CI happens to run between 21:00–06:00
  local time. All three files must be updated to mock the new hook, mirroring how
  they already mock `useMidnightClock` (`vi.mock('../hooks/useMidnightClock', ...)`).
- `frontend/src/App.tsx:19` (`realToday = useMidnightClock()`) and `dayOffset`/
  `simulatedDate`/`isSimulating` (lines 20–22) confirm the day-simulation state is
  fully separate from real time — the new hook naturally satisfies "must track the
  real clock, not `simulatedDate`" simply by never reading `simulatedDate` at all.
- Test conventions: Vitest + `@testing-library/react`'s `renderHook`/`act` +
  `vi.useFakeTimers({ now })` (see `useMidnightClock.test.ts`) for hook-level timer
  tests; component tests render via `render`/`screen` (see `ConfirmDialog.test.tsx`
  pattern, not read in full but same directory convention). Unit tests run via
  `npm test` (`vitest run`) per-workspace; e2e via root `npm run test:e2e`
  (`playwright test`, config at `playwright.config.ts`, spec at `e2e/smoke.spec.ts`).

## Steps

### 1. Pure boundary-window helpers (Red → Green) — COMPLETE (2026-07-08)
Establish the time-window math as small, directly-testable pure functions before wiring
any React state around them — this is the highest-risk logic (off-by-one boundary bugs)
and is cheapest to verify in isolation.

**To-do:**
- [x] Write `frontend/src/__tests__/hooks/useScreenBlank.test.ts` (new file). First add
  tests for two exported pure functions, `isWithinBlankWindow(date: Date): boolean` and
  `nextBoundary(date: Date): Date`, both to be exported (named exports, alongside the
  default-less named hook export, matching `useMidnightClock.ts`'s named-export style)
  from a new `frontend/src/hooks/useScreenBlank.ts`. Cover:
  - `isWithinBlankWindow` returns `true` for `20:59`→`false`, `21:00`→`true`,
    `23:59`→`true`, `00:00`→`true`, `05:59`→`true`, `06:00`→`false`, `12:00`→`false`
    (use `new Date(2025, 0, 15, H, M, 0)` fixtures).
  - `nextBoundary(2025-01-15 12:00)` → `2025-01-15 21:00` (next blank-start).
  - `nextBoundary(2025-01-15 23:30)` → `2025-01-16 06:00` (next wake, crossing midnight).
  - `nextBoundary(2025-01-15 02:00)` → `2025-01-15 06:00` (already inside window, before
    today's wake boundary).
  - `nextBoundary(2025-01-15 21:00:00.000)` exactly on the blank boundary → next boundary
    is tomorrow `06:00` (the instant blank starts, the *next* transition is the wake).
  - `nextBoundary(2025-01-15 06:00:00.000)` exactly on the wake boundary → next boundary
    is today `21:00`.
  - Run `cd frontend && npm test -- useScreenBlank` and confirm these fail (file/exports
    don't exist yet).
- [x] Create `frontend/src/hooks/useScreenBlank.ts` and implement just enough to pass:
  ```ts
  import { set, addDays, isBefore } from 'date-fns';

  export const BLANK_START_HOUR = 21;
  export const BLANK_END_HOUR = 6;

  export function isWithinBlankWindow(date: Date): boolean {
      const hour = date.getHours();
      return hour >= BLANK_START_HOUR || hour < BLANK_END_HOUR;
  }

  export function nextBoundary(date: Date): Date {
      const todayEnd = set(date, { hours: BLANK_END_HOUR, minutes: 0, seconds: 0, milliseconds: 0 });
      const todayStart = set(date, { hours: BLANK_START_HOUR, minutes: 0, seconds: 0, milliseconds: 0 });
      if (isBefore(date, todayEnd)) return todayEnd;
      if (isBefore(date, todayStart)) return todayStart;
      return addDays(todayEnd, 1);
  }
  ```
  Run the test file again and confirm these specific tests now pass.

### 2. `useScreenBlank` stateful hook — window scheduling (Red → Green) — COMPLETE (2026-07-08)
Add the React state/effect layer that re-arms a `setTimeout` to `nextBoundary` and flips
an `inWindow` boolean, following `useMidnightClock`'s re-arming pattern exactly.

**To-do:**
- [x] In `useScreenBlank.test.ts`, add `describe('useScreenBlank')` tests using
  `renderHook`/`act` from `@testing-library/react` and `vi.useFakeTimers({ now })`
  (mirror `useMidnightClock.test.ts`'s exact style, including `afterEach(() =>
  vi.useRealTimers())`):
  - Initializes `isBlanked: true` when `now` is `23:30` (inside window, no wake yet).
  - Initializes `isBlanked: false` when `now` is `12:00` (outside window).
  - Given `now = 20:59:59`, advancing timers by 1000ms (crossing 21:00) flips
    `isBlanked` to `true`.
  - Given `now = 05:59:59` and already `isBlanked: true`, advancing timers by 1000ms
    (crossing 06:00) flips `isBlanked` to `false`.
  - Unmounting clears the pending timer (`vi.spyOn(globalThis, 'clearTimeout')`,
    mirroring `useMidnightClock.test.ts`'s unmount test).
  - Run `cd frontend && npm test -- useScreenBlank` and confirm the new `isBlanked`-only
    (no wake/inactivity yet) assertions fail.
- [x] Extend `frontend/src/hooks/useScreenBlank.ts`: add
  `export function useScreenBlank(): { isBlanked: boolean; wake: () => void }`. Internal
  `inWindow` state (`useState<boolean>(() => isWithinBlankWindow(new Date()))`) with a
  `useEffect` that computes `nextBoundary(new Date())`, arms a `setTimeout` for the
  remaining ms, and on fire **recomputes** `inWindow` via
  `setInWindow(isWithinBlankWindow(new Date()))` — **not** a blind toggle
  (`setInWindow(v => !v)`) — mirroring `useMidnightClock.ts`'s own `setNow(new Date())`
  recompute-on-fire pattern exactly, so a late-firing timer (backgrounded tab, device
  sleep) self-corrects to the true window state from the real clock rather than going
  stale by one boundary. The effect depends on `[inWindow]` so it re-arms after every
  flip (same shape as `useMidnightClock`'s `[now]`-dependent effect). For now,
  return `{ isBlanked: inWindow, wake: () => {} }` (wake is a stub until step 3). Run
  tests again — the step-2 assertions should now pass (wake/inactivity tests from step 3
  don't exist yet).

### 3. Tap-to-wake and 5-minute inactivity re-blank (Red → Green) — COMPLETE (2026-07-08)
Layer the manual wake + auto-re-blank behavior on top of the window state from step 2.

**To-do:**
- [x] In `useScreenBlank.test.ts`, add tests:
  - While `inWindow` (e.g. `now = 23:00`), calling the returned `wake()` (via
    `act(() => result.current.wake())`) flips `isBlanked` to `false` immediately.
  - After `wake()`, advancing fake timers by `5 * 60 * 1000` ms with no intervening
    activity flips `isBlanked` back to `true`.
  - After `wake()`, dispatching a `pointerdown` event on `document`
    (`document.dispatchEvent(new Event('pointerdown'))`) at the 4-minute mark, then
    advancing timers by another 4 minutes (total 8 minutes since `wake()`, but only 4
    since the last activity), leaves `isBlanked` still `false` (timer was reset).
  - After `wake()`, dispatching a `keydown` event on `document`
    (`document.dispatchEvent(new Event('keydown'))`) at the 4-minute mark, then
    advancing timers by another 4 minutes (total 8 minutes since `wake()`, but only 4
    since the last activity), leaves `isBlanked` still `false` (timer was reset via
    keydown activity too).
  - Outside the window (`now = 12:00`), `isBlanked` stays `false` regardless of whether
    `wake()` is called or 5+ minutes elapse with no activity (window gate short-circuits).
  - When `inWindow` flips from `true` to `false` (window naturally ends at 06:00) while
    manually awake, the hook doesn't leave a dangling inactivity timer — unmount after
    this transition and confirm `clearTimeout` was called for the inactivity timer too.
  - `visibilitychange` resync (mirroring `useChoreEvents.ts`'s
    `document.addEventListener('visibilitychange', ...)` re-fire-on-visible precedent):
    set `now` inside the window (e.g. `23:00`) via `vi.useFakeTimers({ now })`, then use
    `vi.setSystemTime(...)` to jump the clock forward past the `06:00` wake boundary
    *without* calling `vi.advanceTimersByTime` (so the boundary's pending `setTimeout`
    is guaranteed to still be pending, simulating a backgrounded-tab timer throttle).
    Stub `document.visibilityState` to `'visible'`
    (`Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })`)
    and dispatch `document.dispatchEvent(new Event('visibilitychange'))`. Assert
    `isBlanked` immediately reflects the new, correct (post-boundary) window state
    rather than waiting for the still-pending stale timer to eventually fire.
  - Run `cd frontend && npm test -- useScreenBlank` and confirm these fail (no `wake`/
    inactivity behavior implemented yet).
- [x] Extend `useScreenBlank.ts`: add `awake` state (`useState<boolean>(false)`) and an
  `inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)`. Add
  `armInactivityTimer` (clears any existing ref timer, sets a new 5-minute
  `setTimeout(() => setAwake(false), 5 * 60 * 1000)`) and `wake` (`setAwake(true)` then
  `armInactivityTimer()`), both via `useCallback`. Add a `useEffect` keyed on
  `[inWindow]` that, when `inWindow` becomes `false`, resets `awake` to `false` and
  clears the inactivity timer (nothing to re-blank once outside the window). Add a
  second `useEffect` keyed on `[inWindow, awake]` that, only while `inWindow && awake`,
  attaches `document` listeners for `'pointerdown'` and `'keydown'` calling
  `armInactivityTimer()`, cleaning up both listeners on effect teardown. Add a cleanup
  effect that clears the inactivity timer ref on unmount. Add a third `useEffect`
  (mount-only, `[]` deps) that adds a `document.addEventListener('visibilitychange', ...)`
  listener mirroring `useChoreEvents.ts`'s exact pattern (`if (document.visibilityState
  === 'visible') { ... }`): on becoming visible, immediately
  `setInWindow(isWithinBlankWindow(new Date()))` — self-healing any staleness in
  `inWindow` from a backgrounded tab/sleeping device by recomputing from the real clock
  rather than waiting for the (possibly still-pending, throttled) boundary timer.
  Remove the listener on cleanup. Compute
  `const isBlanked = inWindow && !awake;` and return `{ isBlanked, wake }`. Run tests
  again and confirm all `useScreenBlank.test.ts` cases pass.

### 4. `ScreenBlankOverlay` component (Red → Green) — COMPLETE (2026-07-08)
The visual full-viewport blank layer, structurally modeled on `ConfirmDialog.tsx`.

**To-do:**
- [x] Write `frontend/src/__tests__/components/ScreenBlankOverlay.test.tsx` (new file,
  same directory as `ConfirmDialog.test.tsx`). Cover:
  - Renders a full-viewport element with `data-testid="screen-blank-overlay"`,
    `role="button"`, and an `aria-label` (e.g. `"Tap to wake screen"`).
  - Clicking it calls the `onWake` prop exactly once.
  - Pressing `Enter` or `Space` while the overlay is focused calls `onWake` exactly
    once (via `fireEvent.keyDown(screen.getByTestId('screen-blank-overlay'), { key:
    'Enter' })` and, in a second case, `{ key: ' ' }`) — this keeps the overlay itself
    keyboard-operable now that the app content behind it is made `inert` (see Step 5),
    since `inert` removes everything else from the tab order/click surface.
  - Run `cd frontend && npm test -- ScreenBlankOverlay` and confirm it fails (component
    doesn't exist).
- [x] Create `frontend/src/components/common/ScreenBlankOverlay.tsx`:
  ```tsx
  import { createPortal } from 'react-dom';

  type ScreenBlankOverlayProps = {
      onWake: () => void;
  };

  export default function ScreenBlankOverlay({ onWake }: ScreenBlankOverlayProps) {
      return createPortal(
          <div
              className="fixed inset-0 bg-black z-[100]"
              onClick={onWake}
              onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onWake();
                  }
              }}
              tabIndex={0}
              data-testid="screen-blank-overlay"
              role="button"
              aria-label="Tap to wake screen"
          />,
          document.body,
      );
  }
  ```
  Run the test again and confirm it passes.

### 5. Wire into `App.tsx` and fix cross-cutting App-level test flakiness — COMPLETE (2026-07-08)
Integrate the hook + overlay into the app shell, and update the three existing
App-level test files so they don't inherit real-clock nondeterminism (see Research
Findings) — this must land in the same step as the `App.tsx` change, not deferred.
The `App.tsx` edit below and the three existing-test-file mock updates must be
committed together as a single unit — do not stop or commit between them.

**To-do:**
- [x] Write `frontend/src/__tests__/App.screenBlank.test.tsx` (new file, mirroring the
  `App.search.test.tsx`/`App.sync.test.tsx` naming/mocking convention: mock
  `../services/choreApi`, mock `../hooks/useMidnightClock` to a fixed noon `Date`, stub
  `EventSource` via `FakeEventSource`). Additionally mock `../hooks/useScreenBlank` with
  `vi.hoisted` so each test controls `isBlanked`/`wake` directly, e.g.
  `const mockWake = vi.hoisted(() => vi.fn()); const mockUseScreenBlank = vi.hoisted(() => vi.fn(() => ({ isBlanked: false, wake: mockWake })));`
  then `vi.mock('../hooks/useScreenBlank', () => ({ useScreenBlank: mockUseScreenBlank }))`.
  Cover:
  - When the mock returns `{ isBlanked: false, wake }`, `screen.queryByTestId('screen-blank-overlay')` is absent and a seeded chore bar renders/behaves normally (tap-to-complete still fires).
  - When the mock returns `{ isBlanked: true, wake: mockWake }`, the overlay renders and
    covers the chore list; `screen.getByText(<seeded chore name>)` may still be in the
    DOM but is not reachable — assert instead that `screen.getByTestId('screen-blank-overlay')` is present.
  - Clicking the overlay (`screen.getByTestId('screen-blank-overlay')`) calls `mockWake`
    exactly once, **and** does not call `completeChore` (import and assert
    `expect(completeChore).not.toHaveBeenCalled()`) — this is the "swallowed tap" contract:
    the overlay must intercept the tap rather than letting it fall through to the chore
    bar underneath.
  - Loading-branch overlay render: mock `fetchAllChores` to return a promise that never
    resolves (`vi.mocked(fetchAllChores).mockReturnValue(new Promise(() => {}))`) and mock
    `useScreenBlank` to return `{ isBlanked: true, wake: mockWake }`, then render `<App
    />` and assert `screen.getByText('Loading chores...')` and
    `screen.getByTestId('screen-blank-overlay')` are both present simultaneously — this
    covers the overlay render inside the `if (loading)` early-return branch, which none
    of the other cases (all implicitly waiting for chores to finish loading) exercise.
  - `inert` on the app content wrapper: when the mock returns `{ isBlanked: true, wake:
    mockWake }`, assert the outer `.App` wrapper is `inert` via
    `expect(screen.getByText(<seeded chore name>).closest('.App')).toHaveAttribute('inert')`
    (jest-dom's `toHaveAttribute(name)` with no second argument asserts presence only,
    which is the correct form for a boolean DOM attribute like `inert` — confirmed against
    this codebase's existing `toHaveAttribute('list', 'room-options')` two-arg usage in
    `ChoreFormModal.test.tsx`/`ChoreForm.test.tsx`, which is the value-checking form; here
    we only need presence). Also assert the wrapper does **not** have the `inert`
    attribute when the mock returns `{ isBlanked: false, ... }`.
  - Auto-dismiss open dialogs/forms on blank (DD-6): with the mock initially returning
    `{ isBlanked: false, wake: mockWake }`, seed one chore, open the delete-confirm
    dialog by clicking `screen.getByRole('button', { name: 'Delete chore' })` (mirroring
    `App.test.tsx`'s `'delete confirmation'` describe block) and assert
    `screen.getByTestId('confirm-dialog-backdrop')` is present. Then flip the mock to
    `{ isBlanked: true, wake: mockWake }` via
    `mockUseScreenBlank.mockReturnValue({ isBlanked: true, wake: mockWake })` followed by
    `rerender(<App />)` (mirroring `App.test.tsx`'s `'midnight re-sort recalculates
    sortedIds when day advances'` test, which already uses this exact
    mock-return-value-then-`rerender` shape to simulate a hook's return value changing
    between renders) and assert `screen.queryByTestId('confirm-dialog-backdrop')` is now
    `null` — proving the `[isBlanked]` effect in `App.tsx` (see the wiring bullet below)
    reset `pendingDeleteId`. Repeat the same open → flip → assert-gone shape for the edit
    form: open it via `screen.getByRole('button', { name: 'Edit chore' })` (mirroring
    `App.test.tsx`'s `handleEditChore` describe block), assert `screen.getByText('Edit
    Chore')` is present beforehand, flip the mock to `isBlanked: true` and `rerender`,
    then assert `screen.queryByText('Edit Chore')` is `null`.
  - Four more cases, all with the mock returning `{ isBlanked: false, wake: mockWake }`,
    proving the four other invariants named in META-PLAN.md F1's Expected end state
    (swipe, SSE re-pull, search filter, room filter) still work specifically alongside
    the new hook wiring, each modeled on the exact precedent cited (read before writing):
    - Swipe: model on `App.test.tsx`'s `swipe gestures` describe block — reuse its
      `swipe(bar, fromX, toX)` helper (`fireEvent.mouseDown`/`mouseMove`×2/`mouseUp` at
      given `clientX`) and its `stubBarWidth` helper (stubs `getBoundingClientRect` since
      jsdom reports 0 for layout). `App.test.tsx` does not export `swipe`/`stubBarWidth`
      (both are unexported local functions), so duplicate both helper functions locally
      at the top of `App.screenBlank.test.tsx` with the same implementation, rather than
      importing them. Seed one chore, `swipe(bar, 350, 100)` (left) and assert
      `screen.findByText('Edit Chore')` appears — mirrors `'swiping a bar left opens the
      pre-populated edit modal'` exactly.
    - SSE re-pull: model on `App.sync.test.tsx`'s first test,
      `'renders a chore added on another device when a "changed" signal arrives — no
      reload'` — seed one chore, change the `fetchAllChores` mock to return a second
      chore, call `lastSource().emit('message')` (from `./fixtures/fakeEventSource`,
      already stubbed via `FakeEventSource` per this file's existing to-do), and
      `await waitFor` the new chore to appear.
    - Search filter: model on `App.search.test.tsx`'s
      `'filters visible chores by case-insensitive substring on name'` test — seed
      chores with distinct names, type a substring into
      `screen.getByPlaceholderText('Search for a chore')`, and assert only the matching
      chore remains visible.
    - Room filter: model on how `App.search.test.tsx`'s
      `'ANDs the substring filter with the room filter'` test selects a room, i.e.
      `await user.click(screen.getByRole('button', { name: '<Room>' }))` (the `RoomTab`
      button rendered by `NavBar`) — seed chores in two different rooms, click one
      room's tab, and assert only that room's chore(s) remain visible.
  - Run `cd frontend && npm test -- App.screenBlank` and confirm it fails (no wiring in
    `App.tsx` yet).
- [x] Edit `frontend/src/App.tsx`: add
  `import { useScreenBlank } from './hooks/useScreenBlank';` and
  `import ScreenBlankOverlay from './components/common/ScreenBlankOverlay';` near the
  other hook/component imports (after the `useChoreEvents` import). Call
  `const { isBlanked, wake } = useScreenBlank();` alongside the other top-of-component
  hooks (near `realToday`/`dayOffset`, before the `loading` early return, so it runs
  unconditionally on every render regardless of the loading branch). In the `if
  (loading)` branch's returned JSX, add `inert={isBlanked}` as a prop on the outer
  `<div className="App">` (React 19 supports `inert` as a plain boolean DOM prop — no
  import needed), and add `{isBlanked && <ScreenBlankOverlay onWake={wake} />}`
  as a sibling inside that same div. In the main returned JSX, add `inert={isBlanked}`
  as a prop on the outer `<div className="App h-full flex flex-col overflow-hidden">`,
  and add `{isBlanked && <ScreenBlankOverlay onWake={wake} />}` as the last child, after
  the existing `{pendingChore && <ConfirmDialog .../>}` block. Note: `inert` on this
  wrapper does **not** disable `ScreenBlankOverlay` itself, even though the overlay's
  JSX is nested inside the same `<div>` in the component tree — `ScreenBlankOverlay`
  renders via `createPortal(..., document.body)`, so its actual DOM node is a sibling of
  the `.App` div, outside the subtree `inert` applies to, and remains
  focusable/clickable/keyboard-operable while everything genuinely inside `.App`
  becomes inert. Also add a `useEffect` keyed on `[isBlanked]` (DD-6, placed alongside
  the other top-of-component hooks, near the `useScreenBlank()` call) that, when
  `isBlanked` becomes `true`, calls `setPendingDeleteId(null)`, `setEditingId(null)`, and
  `setShowForm(false)` — closing any open confirm-dialog or add/edit form so nothing is
  left keyboard-reachable (or silently completable) behind the blank overlay. This makes
  the `inert` fix on `.App` sufficient on its own: `ConfirmDialog` and `ChoreFormModal`
  both render via `createPortal(..., document.body)` exactly like `ScreenBlankOverlay`
  does, so they sit outside the `inert` subtree and would otherwise stay fully
  keyboard-operable if left open into the blank window — but once this effect fires,
  there is nothing left open in either portal to protect, so no separate per-dialog
  `inert` prop is needed. Run `cd frontend && npm test -- App.screenBlank` and confirm it
  now passes.
- [x] Write `frontend/src/__tests__/App.screenBlank.realClock.test.tsx` (new file,
  separate from `App.screenBlank.test.tsx`). This is a distinct file, not an added case
  in `App.screenBlank.test.tsx`, because that file's `vi.mock('../hooks/useScreenBlank',
  ...)` is hoisted to module scope and applies to every test in it — there is no clean
  per-test way to get the REAL `useScreenBlank` in a file that also statically mocks it
  for its other cases. This file proves META-PLAN.md's F1 "App-level test that the
  overlay uses real time and ignores `simulatedDate`" requirement, which is currently
  only provable by code inspection. Mock `../services/choreApi` and stub `EventSource`
  via `FakeEventSource` exactly as `App.screenBlank.test.tsx` does, and mock
  `../hooks/useMidnightClock` to a fixed noon `Date` (same pattern as the other App-level
  test files) — but do **not** mock `../hooks/useScreenBlank` at all, so `App.tsx` calls
  the real hook. In the test itself: call
  `vi.useFakeTimers({ now: new Date(2025, 0, 15, 23, 0, 0) })` (23:00, inside the
  21:00–06:00 blank window) before rendering, so the real `useScreenBlank` computes
  `isBlanked: true` from that fixed real clock on mount. Note this is independent of the
  `useMidnightClock` mock: that mock returns a fixed `Date` object directly (it never
  reads `Date.now()`/real timers itself), so `vi.useFakeTimers` here only needs to
  control the real `Date`/`setTimeout` that `useScreenBlank` reads — it doesn't
  interact with or need to account for the `useMidnightClock` mock at all. Render
  `<App />`, `await waitFor` for a seeded chore to load, then confirm
  `screen.getByTestId('screen-blank-overlay')` is present. Add an inline comment in the
  test noting: "This project has no global `jest`, so Testing Library's waitFor falls
  back to its real-timer/MutationObserver path rather than needing vi's fake interval
  to fire — safe to combine with vi.useFakeTimers here." — this documents why pairing
  `vi.useFakeTimers` with `await waitFor` here is safe even though it diverges from
  `App.test.tsx`'s precedent of only wrapping `vi.useFakeTimers`/`vi.useRealTimers`
  around a single synchronous assertion. Then click
  `screen.getByRole('button', { name: 'Next day' })` (the exact button/label
  `DateNavigationBanner`/`App.test.tsx`'s "date navigation" describe block already uses
  to advance `dayOffset`) one or more times using
  `fireEvent.click(screen.getByRole('button', { name: 'Next day' }))` — not
  `user.click`/`userEvent` — matching exactly how `App.test.tsx`'s
  `'calls completeChore with the chore id and current day'` test clicks under
  `vi.useFakeTimers` via `fireEvent.click`, since `user-event`'s internal
  setTimeout-based delay logic can misbehave under fake timers. Assert
  `screen.getByTestId('screen-blank-overlay')` is **still** present — proving the
  overlay is driven only by the real clock via the unmocked hook and is completely
  unaffected by `dayOffset`/`simulatedDate` changes. Call `vi.useRealTimers()` in an
  `afterEach` (or a `finally`), mirroring how `App.test.tsx`'s
  `'calls completeChore with the chore id and current day'` test already pairs
  `vi.useFakeTimers`/`vi.useRealTimers` around a single assertion. Run
  `cd frontend && npm test -- App.screenBlank.realClock` and confirm it passes.
  **Implementation deviation:** pairing plain `vi.useFakeTimers` with `await waitFor`
  deadlocked (waitFor's internal polling interval is itself faked and never advances),
  so `shouldAdvanceTime: true` was added to the `vi.useFakeTimers` call instead of the
  originally-planned "no global jest" inline comment — this keeps the faked clock
  ticking in step with real elapsed time so `waitFor`'s interval still fires. Verified
  passing; no flake risk (the only pending timer, `nextBoundary`'s ~7h-out boundary
  `setTimeout`, cannot fire from the sub-second real time the test actually consumes).
- [x] Update `frontend/src/__tests__/App.test.tsx`: add, next to the existing
  `vi.mock('../hooks/useMidnightClock', ...)` block, a
  `vi.mock('../hooks/useScreenBlank', () => ({ useScreenBlank: () => ({ isBlanked: false, wake: () => {} }) }));`
  so this suite's real-time-independent swipe/gesture tests can't be spuriously broken
  by the overlay engaging at real-clock night hours.
- [x] Update `frontend/src/__tests__/App.search.test.tsx`: add the identical
  `vi.mock('../hooks/useScreenBlank', ...)` stub next to its existing
  `useMidnightClock` mock, for the same reason.
- [x] Update `frontend/src/__tests__/App.sync.test.tsx`: add the identical
  `vi.mock('../hooks/useScreenBlank', ...)` stub next to its existing
  `useMidnightClock` mock, for the same reason.
- [x] Run `cd frontend && npm test` (full Vitest suite) and confirm every suite
  (existing + new) passes — this specifically re-verifies `App.test.tsx`,
  `App.search.test.tsx`, and `App.sync.test.tsx` are no longer subject to real-clock
  flakiness.

### 6. Verify All Tests Pass

Run the full test suites to confirm nothing is broken.

**To-do:**
- [ ] Run `cd frontend && npm test` and confirm all Vitest unit/component/integration
  tests pass (backend is untouched by this feature; no backend test run needed).
- [ ] Update `e2e/smoke.spec.ts`'s existing `test.beforeEach` (currently just
  `page.goto('/')` + `waitForSelector`) to pin the browser clock to a fixed daytime
  instant *before* `page.goto('/')`, using Playwright's built-in Clock API (available in
  the pinned `@playwright/test@^1.59.1`):
  `await page.clock.setFixedTime(new Date(2025, 0, 15, 12, 0, 0));` — this fixes
  `Date`/`Date.now()` for the page to noon on 2025-01-15, outside the 21:00–06:00 blank
  window, without pausing `setTimeout`/`setInterval` (so the existing timer-bar and
  countdown behavior exercised elsewhere in the spec is unaffected). This removes the
  real-wall-clock nondeterminism the new unconditional `useScreenBlank()` call in
  `App.tsx` would otherwise introduce into the smoke suite.
- [ ] Add a new, separate Playwright test in `e2e/smoke.spec.ts` (DD-7) — this is a
  distinct test case with its own fixed time, not a change to the `test.beforeEach`
  noon pin added above (that pin stays at noon, outside the blank window, for every
  *other* test in the file; this new test needs a fixed time *inside* the 21:00–06:00
  window instead, so it overrides the pin for itself only). In the test body, override
  the shared `beforeEach`'s noon pin by calling
  `await page.clock.setFixedTime(new Date(2025, 0, 15, 23, 0, 0));` (23:00, inside the
  blank window) again, then `await page.reload();` (re-navigating so the app re-mounts
  and the real `useScreenBlank` re-evaluates `isWithinBlankWindow` against the new fixed
  time — the `beforeEach`'s original `page.goto('/')` already ran with the noon pin
  before this test body executes, so a reload is required to re-mount against the new
  time). Then: confirm the overlay rendered —
  `await expect(page.getByTestId('screen-blank-overlay')).toBeVisible();` — grounding
  this in Step 4's `ScreenBlankOverlay.tsx` DOM shape (a single
  `fixed inset-0 ... tabIndex={0} data-testid="screen-blank-overlay"` div portaled to
  `document.body`, with `.App` made `inert` per Step 5 and — per DD-6's auto-dismiss
  effect — nothing left open in any other portal to compete for focus). Press `Tab`
  repeatedly (e.g. 5 times via a small loop calling `await page.keyboard.press('Tab');`)
  and after each press assert
  `await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))`
  is either `null` or `'screen-blank-overlay'` — never any other testid (an Edit/Delete
  button, the search input, a room chip, a date-nav button) — proving `inert` on `.App`
  genuinely removes every real-content control from the tab order in a real browser and
  leaves only the portaled overlay reachable (the first `Tab` press is expected to land
  focus on the overlay itself, since it's the only tabbable element left in the
  document). Add an inline comment noting this test
  specifically exercises real-browser `inert` behavior, which jsdom (used by the Vitest
  suite in Step 5) does not implement, per DD-7.
- [ ] Run `npm run test:e2e` (root `playwright test`, `e2e/smoke.spec.ts`) and confirm it
  passes deterministically — beyond the clock pin above and the new DD-7 keyboard test,
  this feature adds no other new e2e coverage (the overlay's time-window behavior is
  covered by the Vitest fake-timer suite in step 2/3, the App-level integration by step
  5's mocked-hook test, and real-clock/`dayOffset`-independence by step 5's
  `App.screenBlank.realClock.test.tsx`; only the real-browser `inert` behavioral
  guarantee needed the new e2e test, per DD-7). Confirm the existing smoke spec's
  tap-to-complete/add-task flows aren't affected by the new unconditional
  `useScreenBlank()` call in `App.tsx` now that the clock is pinned to daytime.
- [ ] Investigate and fix any failures before marking the plan finished.
- [ ] Note as a known follow-up in the PR description: confirming no host-level
  DPMS/idle-blank fights this overlay requires the physical Pi and is out of scope for
  this frontend-only session.
- [ ] Edit `plans/META-PLAN.md`'s F2 section (the "Double-tap accidental-touch lock"
  feature, currently around lines 596-663) to add a note under its Open risks /
  decisions part (c): "F1 (merged) ships a single unmodified tap/click
  (`ScreenBlankOverlay`'s `onClick`) as its wake gesture, consuming that tap; F2's
  double-tap-lock planning must decide precedence between this single-tap wake and its
  own double-tap-to-unlock gesture when both features are active simultaneously."
  Commit this META-PLAN.md edit in the same PR as F1's implementation, per META-PLAN's
  own Cross-session persistence rule.

## Status
finished: false
