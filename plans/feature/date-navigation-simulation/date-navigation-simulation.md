# Date Navigation Simulation

## Summary
Enlarge and center the date banner in the chore chart header, and add controls that let the user step the displayed date forward in time to preview how each chore's timer bar will look on future days. A chevron-right arrow advances one day with a slide transition; a chevron-left arrow (shown only when the user has stepped away from today) walks back toward today but never earlier; a counter-clockwise reset icon jumps back to today. While the simulated date is not today, chore bars render using the simulated date for their due-date math and chore clicks are disabled (the delete button remains active). No backend changes.

## Research Findings
- **Date already flows through props.** `useMidnightClock()` returns `day` in `App.tsx:13`, which is passed to `ChoreList` (`App.tsx:120`) → `ChoreTimerBar` (`ChoreList.tsx:25`). `ChoreTimerBar` computes `daysSince = differenceInDays(startOfDay(day), startOfDay(chore.dateLastCompleted))` at `ChoreTimerBar.tsx:18-21` and feeds it to `computeBar()` in `utils/choreBarMath.ts:11-37`. `orderChores(chores, day)` in `utils/choreSort.ts:16` already takes `today` as a parameter. **This means the entire display chain is already parameterized — we can drive it with a "simulated day" by changing what `day` holds.**
- **Only one escape hatch reads the real clock in the UI layer:** `ChoreTimerBar.tsx:26` (`onComplete(chore.id, new Date())`). Because we disable clicks when simulating, this line does not need to change — but we must ensure the click handler cannot fire in simulation mode.
- **No global state, context, or icon library exists.** State lives in `App.tsx` via `useState`; `main.tsx:1-18` wraps only in `StrictMode`. Icons today are Unicode glyphs (`+`, `✕`) — this feature will be the first use of a proper icon library. Animations are Tailwind CSS transitions (`ProgressBar.tsx:10` uses `transition-all duration-300 ease-in-out`); no Framer Motion.
- **Testing stack is established.** Vitest + React Testing Library for unit tests (`frontend/vitest.config.ts`, `src/__tests__/setup.ts`). `vi.useFakeTimers({ now })` is the canonical date-mocking pattern (`src/__tests__/hooks/useMidnightClock.test.ts`). `vi.hoisted()` + `vi.mock()` is the convention for mocking `useMidnightClock` in `App.test.tsx:17-24`. Playwright covers E2E smoke (`e2e/smoke.spec.ts`).
- **Midnight rollover matters.** If we stored `simulatedDate` directly as a `Date`, it would drift relative to `realToday` after midnight. Storing a numeric `dayOffset` (days from real today) and deriving `simulatedDate = addDays(realToday, dayOffset)` keeps the simulation honest across midnight rollover for free.

## Steps

### 1. Install `lucide-react` and verify the three icons render
Add `lucide-react` as a dependency; it supplies `ChevronLeft`, `ChevronRight`, and `RotateCcw` — the last matches the "counter-clockwise open-circle flat-top arrow pointing left" spec exactly. Tree-shakable, zero transitive deps, peer-depends on React 16–19 (chores4irl is on 19.1.0).

**To-do:**
- [x] From `frontend/`, run `npm install lucide-react@1.8.0 --save-exact`. Confirm `frontend/package.json` now has `"lucide-react": "1.8.0"` in `dependencies` (exact pin, no caret). Confirm `frontend/package-lock.json` records the install.
- [x] Run `npm show lucide-react@1.8.0 peerDependencies` and confirm the peer range includes React 19 (it does: `^16.5.1 || ^17.0.0 || ^18.0.0 || ^19.0.0`). No transitive deps to pin.
- [x] Verify the three icon names resolve: from `frontend/`, run `npx tsc --noEmit -p tsconfig.json` after adding `import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';` as a throwaway import at the top of `src/main.tsx`, then remove it. (Sanity check that these exact names exist in 1.8.0 — they have been stable since lucide's earliest releases.)
- [x] No new test files. The icons are consumed by `DateNavigationBanner` in Step 3, which has its own tests.

**Verification:** `npm test --workspace frontend` still passes, and `npm run build --workspace frontend` completes without TypeScript errors.

**Completed 2026-04-21:** `lucide-react@1.8.0` installed (exact pin). Peer range confirmed includes React 19. `npx tsc --noEmit` passed with the three icon imports; throwaway import reverted. `npm test` — 52/52 pass. `npm run build` — clean.

### 2. Write tests for `DateNavigationBanner` component (Red)
Write the full unit test file for the new banner before the component exists. Tests drive the component's prop contract.

**To-do:**
- [x] Create `frontend/src/__tests__/components/DateNavigationBanner.test.tsx`. Import `render`, `screen` from `@testing-library/react`, `userEvent` from `@testing-library/user-event`, `describe`/`it`/`expect`/`vi` from `vitest`, and the yet-to-be-created `DateNavigationBanner` from `../../components/nav/DateNavigationBanner`.
- [x] Test: `renders the provided day as a large centered heading`. Pass `simulatedDate={new Date(2025, 0, 15)}`, `dayOffset={0}`. Assert `screen.getByRole('heading', { level: 1 })` has text matching `Wed Jan 15 2025` (native `Date.toDateString()` format). Assert the heading element's `className` contains `text-center` and a font-size class `>= text-2xl`.
- [x] Test: `shows forward arrow and hides back arrow and reset when dayOffset === 0`. Assert `screen.getByRole('button', { name: 'Next day' })` exists. Assert `screen.queryByRole('button', { name: 'Previous day' })` is `null`. Assert `screen.queryByRole('button', { name: 'Reset to today' })` is `null`.
- [x] Test: `shows back arrow and reset when dayOffset > 0`. Pass `dayOffset={2}`. Assert all three buttons (`Next day`, `Previous day`, `Reset to today`) are present.
- [x] Test: `clicking next invokes onNext`. Use `const onNext = vi.fn()`. `await userEvent.click(screen.getByRole('button', { name: 'Next day' }))`. Assert `onNext` called once with no args.
- [x] Test: `clicking previous invokes onPrev`. Same pattern with `onPrev` prop; set `dayOffset={1}` to make it visible.
- [x] Test: `clicking reset invokes onReset`. Same pattern with `onReset` prop; set `dayOffset={3}` to make it visible.
- [x] Test: `previous button is omitted when dayOffset === 0 even if onPrev is provided` (floor guarantee — no way to navigate before today).
- [x] Run `npm test --workspace frontend -- DateNavigationBanner.test.tsx`. Confirm every test fails with a module-not-found error. This is the Red state.

**Verification:** `npm test --workspace frontend -- DateNavigationBanner.test.tsx` — all tests fail with "Cannot find module" or equivalent.

**Completed 2026-04-21:** Created `frontend/src/__tests__/components/DateNavigationBanner.test.tsx` with 8 tests covering the banner's prop contract (heading rendering, conditional button visibility for `dayOffset === 0` vs `dayOffset > 0`, click delegation for `onNext`/`onPrev`/`onReset`, and the floor guarantee that Previous is hidden at offset 0). Red verified: vitest reports `Failed to resolve import "../../components/nav/DateNavigationBanner"` — a module resolution error, not a logic error. Test suite count: 1 failed suite, 0 tests executed (expected for a resolution-time failure).

### 3. Implement `DateNavigationBanner` component (Green)
Minimum code to make the Step 2 tests pass.

**To-do:**
- [x] Create `frontend/src/components/nav/DateNavigationBanner.tsx` exporting default `DateNavigationBanner({ simulatedDate, dayOffset, onPrev, onNext, onReset })`.
- [x] Props type:
  ```typescript
  type DateNavigationBannerProps = {
      simulatedDate: Date;
      dayOffset: number;
      onPrev: () => void;
      onNext: () => void;
      onReset: () => void;
  };
  ```
- [x] Import icons: `import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';`.
- [x] JSX structure:
  ```tsx
  <div className="flex items-center justify-center gap-3 my-3 flex-shrink-0 text-white relative">
      {dayOffset > 0 && (
          <button
              type="button"
              onClick={onReset}
              aria-label="Reset to today"
              className="absolute left-0 p-2 rounded-full hover:bg-gray-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
              <RotateCcw className="w-6 h-6" aria-hidden="true" />
          </button>
      )}
      {dayOffset > 0 && (
          <button
              type="button"
              onClick={onPrev}
              aria-label="Previous day"
              className="p-2 rounded-full hover:bg-gray-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
              <ChevronLeft className="w-6 h-6" aria-hidden="true" />
          </button>
      )}
      <h1 className="text-center text-2xl sm:text-3xl font-semibold tracking-wide">
          {simulatedDate.toDateString()}
      </h1>
      <button
          type="button"
          onClick={onNext}
          aria-label="Next day"
          className="p-2 rounded-full hover:bg-gray-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
      >
          <ChevronRight className="w-6 h-6" aria-hidden="true" />
      </button>
  </div>
  ```
- [x] Reset button is absolutely positioned to the left so the chevrons bracket the centered date symmetrically (keeps the date visually centered regardless of reset visibility). Chevrons retain the 44px touch target established in `RoomTab`/`AddChoreButton` per the project's viewport refactor.
- [x] Run `npm test --workspace frontend -- DateNavigationBanner.test.tsx`. All tests pass (Green).

**Verification:** `npm test --workspace frontend -- DateNavigationBanner.test.tsx` — all tests pass.

**Completed 2026-04-21:** Created `frontend/src/components/nav/DateNavigationBanner.tsx` with the prop contract, inline `DateNavigationBannerProps` type, and `lucide-react` icon imports (`ChevronLeft`, `ChevronRight`, `RotateCcw`). JSX matches the plan template with one adjustment: button `onClick` handlers are wrapped as `() => onPrev()` / `onNext()` / `onReset()` thunks to satisfy the Step 2 `toHaveBeenCalledWith()` assertions (raw references would leak a React SyntheticEvent arg). Step 4 already expected wrapped handlers, so this is forward-compatible. Reset button absolutely positioned left; all three icon buttons keep 44px min touch targets. Results: `DateNavigationBanner.test.tsx` 7/7 pass (Green), full frontend suite 59/59 pass, `npx tsc --noEmit` clean, `vite build` clean (206.40 kB).

### 4. Add slide transition for date change
Animate the date text sliding left while the next/previous date slides in from the right/left, respectively.

**To-do:**
- [x] Add keyframes to `frontend/src/index.css`. Append after the existing `rotate-hint` keyframes:
  ```css
  @keyframes slide-in-from-right {
      from { transform: translateX(100%); opacity: 0; }
      to   { transform: translateX(0);     opacity: 1; }
  }
  @keyframes slide-in-from-left {
      from { transform: translateX(-100%); opacity: 0; }
      to   { transform: translateX(0);      opacity: 1; }
  }
  .slide-in-right { animation: slide-in-from-right 250ms ease-out; }
  .slide-in-left  { animation: slide-in-from-left  250ms ease-out; }
  ```
- [x] In `DateNavigationBanner.tsx`, track direction of last navigation. Add state `const [slideClass, setSlideClass] = useState<string>('')`. Wrap the `<h1>` in an overflow-clipping container so slide-in doesn't horizontally scroll the page:
  ```tsx
  <div className="overflow-hidden min-w-0 flex-1 max-w-xs sm:max-w-sm">
      <h1 key={simulatedDate.toDateString()} className={`text-center text-2xl sm:text-3xl font-semibold tracking-wide ${slideClass}`}>
          {simulatedDate.toDateString()}
      </h1>
  </div>
  ```
  The `key={simulatedDate.toDateString()}` forces React to re-mount the `<h1>` on date change, which re-triggers the CSS animation.
- [x] Update click handlers inside the component to set the slide direction before delegating: `onClick={() => { setSlideClass('slide-in-right'); onNext(); }}` for Next, `slide-in-left` for Previous and Reset.
- [x] Add test: `applies slide-in-right class after clicking Next`. Use `await userEvent.click(screen.getByRole('button', { name: 'Next day' }))`, then re-render by updating `simulatedDate` prop (use `rerender` from `render()` result) and assert the heading has `className` matching `/slide-in-right/`.
- [x] Run `npm test --workspace frontend -- DateNavigationBanner.test.tsx`. All tests including the new animation test pass.

**Verification:** `npm test --workspace frontend -- DateNavigationBanner.test.tsx` — all tests pass.

**Completed 2026-04-21:** Added `slide-in-from-right` / `slide-in-from-left` keyframes and `.slide-in-right` / `.slide-in-left` 250ms ease-out animation classes to `frontend/src/index.css` (appended after `rotate-hint`). In `DateNavigationBanner.tsx`: added `useState<string>('')` for `slideClass`, wrapped the `<h1>` in an `overflow-hidden min-w-0 flex-1 max-w-xs sm:max-w-sm` clip container, applied `key={simulatedDate.toDateString()}` to force re-mount for animation retrigger, and updated the three onClick thunks to set the direction class (`slide-in-right` for Next; `slide-in-left` for Previous and Reset) before delegating to the callback. Preserved the Step 3 thunk form to keep the zero-args `toHaveBeenCalledWith()` assertions satisfied. Added a new test `applies slide-in-right class to the heading after clicking Next` that drives the component through a stateful `Harness` (so the `key` actually changes on click and the animation class survives re-mount). Results: `DateNavigationBanner.test.tsx` 8/8 pass; full frontend suite 60/60 pass; `vite build` clean (206.40 kB unchanged). Inline 3-perspective review: all PASS — no fix pass needed.

### 5. Write tests for App-level simulation state (Red)
Extend `App.test.tsx` to cover the new behavior before touching `App.tsx`.

**To-do:**
- [ ] Open `frontend/src/__tests__/App.test.tsx`. `mockUseMidnightClock` already exists at `App.test.tsx:17-24`, returning `new Date(2025, 0, 15, 12, 0, 0)` — reuse it.
- [ ] Add a new `describe('date navigation', () => { ... })` block.
- [ ] Test: `on initial load, banner shows today's date and only the Next button`. Render `<App />`, `await waitFor(...)` for chores, assert `screen.getByRole('heading', { level: 1 })` text is `Wed Jan 15 2025`. Assert `screen.getByRole('button', { name: 'Next day' })` exists; `queryByRole` for `Previous day` and `Reset to today` return `null`.
- [ ] Test: `clicking Next advances the date by one day and reveals Previous and Reset buttons`. Render, click Next, assert heading now reads `Thu Jan 16 2025`. Assert all three navigation buttons are visible.
- [ ] Test: `chore bars become non-clickable when simulating a future date`. Before render, `vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep' })])`. Render, click Next, then click the chore bar (`screen.getByTestId('chore-bar')`). Assert `completeChore` from the mocked service was NOT called. Assert the chore-bar element has `className` matching `/cursor-not-allowed/` and `/pointer-events-none/`.
- [ ] Test: `Reset returns to today and re-enables chore clicks`. Click Next twice (heading shows `Fri Jan 17 2025`), click Reset, assert heading reads `Wed Jan 15 2025`, assert Reset and Previous are gone, then click the chore bar and assert `completeChore` was called once.
- [ ] Test: `Previous after Next returns to today but never goes earlier`. Click Next (heading = Jan 16), click Previous (heading = Jan 15). Assert Previous button is no longer in the DOM.
- [ ] Test: `bar math recomputes against the simulated date`. Render with a chore whose `dateLastCompleted = new Date(2025, 0, 14)` and `frequency = 7`. Initially `daysSince = 1`, not overdue. Click Next 10 times. Assert the `OverdueBadge` is now rendered (`screen.getByText(/overdue/i)` or equivalent — check `OverdueBadge.tsx` for the actual text).
- [ ] Run `npm test --workspace frontend -- App.test.tsx`. All new tests fail (behaviors not implemented).

**Verification:** `npm test --workspace frontend -- App.test.tsx` — new `date navigation` tests fail; existing tests still pass.

### 6. Wire simulation state into `App.tsx` (Green)
Add `dayOffset` state, derive `simulatedDate`, render the banner, thread `isSimulating` through the chore chain.

**To-do:**
- [ ] Open `frontend/src/App.tsx`. After `const day = useMidnightClock();` (line 13), rename `day` to `realToday` across the file:
  - `const realToday = useMidnightClock();` (was line 13)
  - Update references in `App.tsx:27`, `App.tsx:38`, `App.tsx:40` (dependency array), `App.tsx:117`, `App.tsx:120`.
- [ ] Add two new lines directly under `realToday`:
  ```typescript
  const [dayOffset, setDayOffset] = useState<number>(0);
  const simulatedDate = useMemo(() => addDays(realToday, dayOffset), [realToday, dayOffset]);
  const isSimulating = dayOffset > 0;
  ```
- [ ] Add `import { addDays } from 'date-fns';` at the top of `App.tsx`.
- [ ] Replace every downstream use of the old `day` variable with `simulatedDate`:
  - `App.tsx:27` — `orderChores(chores, simulatedDate)` in the fetch handler.
  - `App.tsx:38` — `orderChores(choreDataRef.current, simulatedDate)` inside the sort effect.
  - `App.tsx:40` — change dependency array from `[day]` to `[simulatedDate]`.
  - `App.tsx:120` — pass `day={simulatedDate}` to `<ChoreList>`.
- [ ] Delete the old date-text `<div>` (`App.tsx:116-118`). Replace with the banner:
  ```tsx
  <DateNavigationBanner
      simulatedDate={simulatedDate}
      dayOffset={dayOffset}
      onPrev={() => setDayOffset(o => Math.max(0, o - 1))}
      onNext={() => setDayOffset(o => o + 1)}
      onReset={() => setDayOffset(0)}
  />
  ```
- [ ] Import `DateNavigationBanner` at the top: `import DateNavigationBanner from './components/nav/DateNavigationBanner';`.
- [ ] Pass `isSimulating` to `ChoreList`: update the `<ChoreList>` JSX to include `isSimulating={isSimulating}`.
- [ ] In `handleCompleteChore(id, date)` at `App.tsx:81`, add a guard at the top: `if (isSimulating) return;`. This is a belt-and-suspenders check; the UI will already have disabled the click, but the guard prevents the callback from mutating state if anything calls it directly.
- [ ] Run `npm test --workspace frontend -- App.test.tsx`. Expect most tests to pass; the `non-clickable` and `cursor-not-allowed` tests still fail (those require ChoreList/ChoreTimerBar changes in Step 7).

**Verification:** `npm test --workspace frontend -- App.test.tsx` — most tests pass; the chore-unclickable assertions still fail.

### 7. Disable chore clicks during simulation
Thread `isSimulating` down to `ChoreTimerBar` and conditionally suppress the click handler.

**To-do:**
- [ ] Open `frontend/src/components/chore/ChoreList.tsx`. Add `isSimulating: boolean` to its props type. Thread it through to each `<ChoreTimerBar>` render.
- [ ] Update `ChoreListProps` and the `ChoreList` destructure; pass `isSimulating={isSimulating}` in the map over chores.
- [ ] Open `frontend/src/components/chore/ChoreTimerBar.tsx`. Add `isSimulating: boolean` to `ChoreTimerBarProps` at `ChoreTimerBar.tsx:10-15`, and destructure it at line 17.
- [ ] At `ChoreTimerBar.tsx:25-27`, gate `resetTask`:
  ```typescript
  function resetTask() {
      if (isSimulating) return;
      onComplete(chore.id, new Date());
  }
  ```
- [ ] At `ChoreTimerBar.tsx:30-34`, make the outer `<div>` visually and functionally non-interactive when simulating. Replace the className with a template literal:
  ```tsx
  className={`relative h-36 sm:h-24 w-full bg-gray-800 rounded-full shadow overflow-hidden ${isSimulating ? 'cursor-not-allowed opacity-60 pointer-events-none' : 'cursor-pointer'}`}
  ```
  **Critical:** the delete button must remain clickable. `pointer-events-none` on the parent disables the delete button too. Instead, re-enable clicks on the delete button specifically: at `ChoreTimerBar.tsx:48-54`, add `pointer-events-auto` to the delete button's className. This keeps delete usable during simulation (useful — you might want to clean up chores while previewing).
  - Actually, reconsider: does the user want delete enabled during simulation? The task says "chores are unclickable" referring to the bar itself (which marks complete). Delete is separate. Leaving delete active is the more useful behavior. Confirm by inspection of `ChoreTimerBar.tsx:48-54`.
- [ ] Update `frontend/src/__tests__/components/ChoreTimerBar.test.tsx` — check existing test file signature expectations. If any existing tests render `<ChoreTimerBar>` without `isSimulating`, add `isSimulating={false}` to those calls to keep TypeScript happy. Read the file first with `Read` before editing.
- [ ] Add a new test to `ChoreTimerBar.test.tsx`: `does not call onComplete when clicked in simulation mode`. Render with `isSimulating={true}`, click the bar via `userEvent.click(screen.getByTestId('chore-bar'))`, assert `onComplete` was NOT called.
- [ ] Add a companion test: `still calls onDelete when delete button is clicked in simulation mode`. Render with `isSimulating={true}`, click the delete button, assert `onDelete` called with the chore id.
- [ ] Similarly update `frontend/src/__tests__/components/ChoreList.test.tsx` — pass `isSimulating={false}` to all `<ChoreList>` renders. Read first to identify every call site.
- [ ] Run `npm test --workspace frontend`. All tests should pass.

**Verification:** `npm test --workspace frontend` — all frontend unit tests pass.

### 8. Add Playwright smoke coverage for date navigation
Extend the E2E suite with one test that exercises the full navigation flow in a real browser. Tailwind classes and slide transitions are only truly verified in a real DOM.

**To-do:**
- [ ] Open `e2e/smoke.spec.ts`. Inside the existing `test.describe('Chores App Smoke Tests', ...)` block, add a new test block:
  ```typescript
  test('navigates forward and back in time and resets to today', async ({ page }) => {
      const nextBtn = page.getByRole('button', { name: 'Next day' });
      await expect(nextBtn).toBeVisible();
      await expect(page.getByRole('button', { name: 'Previous day' })).not.toBeVisible();
      await expect(page.getByRole('button', { name: 'Reset to today' })).not.toBeVisible();

      await nextBtn.click();
      await expect(page.getByRole('button', { name: 'Previous day' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Reset to today' })).toBeVisible();

      const firstChoreBar = page.locator('.bg-gray-800.rounded-full').first();
      await firstChoreBar.click({ trial: false });
      // During simulation, clicking the bar must not fire a PATCH /complete
      // Wait briefly and assert no error banner appears (optimistic update would also trigger if a click fired)
      await page.waitForTimeout(250);
      await expect(page.locator('.bg-red-700')).not.toBeVisible();

      await page.getByRole('button', { name: 'Reset to today' }).click();
      await expect(page.getByRole('button', { name: 'Previous day' })).not.toBeVisible();
      await expect(page.getByRole('button', { name: 'Reset to today' })).not.toBeVisible();
  });
  ```
- [ ] The test relies on `aria-label` attributes defined in Step 3. Confirm those labels match exactly.
- [ ] Note: the existing `marks a chore complete` test at `e2e/smoke.spec.ts` uses `.locator('.bg-gray-800.rounded-full').first().click()` — confirm this still works once `pointer-events-none` is added (it will, because in non-simulation mode the bar is clickable).
- [ ] Run `npm run test:e2e` and confirm the new test and all existing tests pass.

**Verification:** `npm run test:e2e` — all E2E tests pass.

### 9. Manual browser smoke test
UI behavior, especially the slide animation, cannot be fully validated by automated tests.

**To-do:**
- [ ] Run `npm run dev` from the repo root to start backend + frontend together.
- [ ] In the browser at `http://localhost:5174`, confirm on load: date banner is large, centered, and shows today. Only the right chevron is visible.
- [ ] Click the right chevron — date slides left, tomorrow slides in from the right, left chevron and reset icon appear.
- [ ] Click the right chevron multiple times — confirm each chore bar's fill/overdue state updates to match future days (e.g., a chore with frequency=7 and completed today should show as overdue after 8 advances).
- [ ] Click the chore bar — confirm nothing happens (no completion).
- [ ] Click the delete button on a chore while simulating — confirm the chore disappears (delete still works).
- [ ] Click the left chevron — date slides right, previous day slides in from the left.
- [ ] Click the reset icon — date jumps back to today, chevron-left and reset disappear, chores become clickable again.
- [ ] Click a chore bar now — confirm it completes (bar resets, backend PATCH fires).
- [ ] Verify on mobile width (375px) that the banner remains centered and buttons retain their 44px touch target.

**Verification:** Manual — all listed interactions behave as described. If any regression is observed, fix before moving on.

### 10. Verify all test suites pass
Final gate before marking the plan finished.

**To-do:**
- [ ] Run `npm test --workspace frontend` and confirm all frontend unit tests pass.
- [ ] Run `npm test --workspace backend` and confirm all backend tests pass (none should be affected, but run as a safety check).
- [ ] Run `npm run test:e2e` and confirm all Playwright tests pass.
- [ ] Investigate and fix any failures before marking the plan finished.

## Status
finished: false
