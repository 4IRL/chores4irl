# Lock-time view reset (F19)

## Summary
When `F2`'s touch lock engages (`useTouchLock`'s `isLocked` going `false → true` after 5 minutes
of inactivity), the app returns the view to its boot state: the chore list scrolled to the top
(instant), room tab → *All*, search cleared, day simulator → today. The next person at the wall
kiosk then sees the canonical view instead of whatever the last person left. The work is one
lock-only effect in `frontend/src/App.tsx`, App-level fake-timer tests, and a short lock paragraph
in the repo-root `README.md`. It doesn't change the backend, sort, components or styling. Source of
truth: `plans/META-PLAN.md` § "F19 — Lock-time view reset".

## Research Findings
Research was done inline. The change touches one component, one new test file and the root README.
- `frontend/src/App.tsx` already holds every piece the reset needs:
  - State: `dayOffset`/`setDayOffset` (L40), `selectedRoom`/`setSelectedRoom` (L43, default `'all'`) and `searchQuery`/`setSearchQuery` (L44, default `''`).
  - `scrollRegionRef` (L68). It is the single ref on the `.overflow-y-auto` scroller, and its comment already reserves it for F19.
  - The force-close-dialogs effect on `[isBlanked, isLocked]` (L152–158, with its comment from L149).
  - The `justRelocked`/`wasLockedRef` render-body guard (L319–323), which is overlay-only.
  - The re-sort effect on `[simulatedDate]` (L167–171). Outside tests, `orderChores` has exactly two call sites: `reconcileChores`, which runs on fetch, and this effect.
- `useTouchLock` (`frontend/src/hooks/useTouchLock.ts`):
  - `INACTIVITY_MS = 5 * 60 * 1000` is **module-private** (not exported).
  - The timer arms on mount and re-arms only on `document` `pointerdown`/`keydown`, so `fireEvent.click`/`fireEvent.change` do **not** re-arm it. Reviewers verified this in-repo.
  - `arm()` unlocks and re-arms.
  - F20 has **not** shipped: there is no idle-expiry tick, so F19 keys off `isLocked` alone (META-PLAN F19 Open risks (e)).
- Test patterns:
  - `App.touchLock.test.tsx` mocks `useTouchLock` via `vi.hoisted` `mockUseTouchLock` and flips `isLocked` with `rerender`.
  - It unlocks by clicking `touch-lock-overlay` twice with identical `clientX/clientY`. That calls App's `handleArm` → `arm()` + `isClosing` for `CLOSING_SETTLE_MS` (400, exported from `TouchLockOverlay`).
  - `App.screenBlank.realClock.test.tsx` shows `vi.useFakeTimers({ now, shouldAdvanceTime: true })`, which keeps `waitFor` working.
  - jsdom does not block `fireEvent` inside an `inert` subtree.
  - Vitest is 4.1.4. `vi.clearAllMocks()` clears calls but keeps implementations, so a previous test's `mockReturnValue` persists unless `beforeEach` resets it.
- `ScrollToTopButton` (`frontend/src/components/common/ScrollToTopButton.tsx`):
  - It exports `FADE_MS = 500`.
  - Its visibility comes from `scroll` events on the region, so jsdom needs `fireEvent.scroll(region)` after a programmatic `scrollTop` write.
  - Hidden = `opacity-0` at once. `inert`/`aria-hidden="true"` land after `FADE_MS`.
- UI anchors, all verified against the real markup:
  - Room chips are buttons named by room (`getByRole('button', { name: 'Kitchen' })`).
  - Search: `getByPlaceholderText('Search for a chore')`.
  - Day stepping: `getByRole('button', { name: 'Next day' })`.
  - `Return to today` text shows only while simulating.
  - Test ids: `touch-lock-overlay`, `screen-blank-overlay` and `scroll-to-top`.
- README gap: the repo-root `README.md` has **no touch-lock paragraph**. A grep for `padlock`/`inactiv` finds nothing, and `lock` matches only `fake-hwclock`. The META-PLAN's "touch-lock paragraph gains one line" is therefore met by adding a short lock paragraph after the scroll-to-top paragraph in `## How prioritization works`. The F17 strip and F18 button paragraphs already sit there.
- META-PLAN F19 Open risks (c)/(d):
  - The reset changes none of `isRepullGated()`'s inputs (`isMutatingRef`, `showForm`, `editingId`, `pendingDeleteId`), so SSE re-pulls are untouched. A re-pull landing mid-reset only reconciles `sortedIds`.
  - No `kiosk/v1` listener or F15 future-proofing is added.
- META-PLAN F22/F19 ↔ F18 coupling: F19's programmatic `scrollTop = 0` makes F22's overlay thumb flash on lock in a real browser. F22's plan (`plans/feature/overlay-scrollbar/overlay-scrollbar.md` on branch `feature/overlay-scrollbar`, in flight in the sibling worktree `/home/rmila/Code/c4i-wt-overlay-scrollbar`; Decision (b)) already accepts that with no programmatic flag. F19 adopts the same decision whichever feature ships second, and adds no flag or F22-specific code.
- The room-tab strip (`NavBar`'s `overflow-x-auto scrollbar-none` row) keeps its own horizontal `scrollLeft`, which the reset leaves alone. With enough rooms the *All* chip could stay scrolled off-screen. That is out of scope: the META-PLAN Design allows no component change. It is left as a manual check.
- Type-check uses `npx tsc --noEmit -p frontend/tsconfig.json` from the repo root, which is the repo precedent. `tsc -b` writes an un-ignored root `tsconfig.tsbuildinfo` that the per-step `git add .` would commit, and `vite build` does not type-check.

## Steps

**Orchestrator + executor note (/run-plan, /next-step-taker):** skill-config's `ui_runner_cmd`/`test_run_cmd`/`test_run_built_cmd` resolve to bare `npx playwright test`. That form is not sibling-safe here: `git worktree list` shows other `c4i-wt-*` worktrees, and `playwright.config.ts` has `reuseExistingServer: !process.env.CI`.
- For every §2c smoke run, the Completion UI suite, and any Playwright run a step executor makes, run `env -u PLAYWRIGHT_BASE_URL CI=1 npx playwright test e2e/smoke.spec.ts` from the repo root in place of `$UI_RUNNER_CMD`. `integration_runner_cmd` is empty, so skip that suite.
- A `… is already used …` / `Process from config.webServer was not able to start` failure is a port conflict, not Test Fix Loop input. Retry about every 30 s with jitter for up to ~10 min. If it persists, end the orchestrator summary with `UNRESOLVED — requires user decision/action: Playwright ports 3000/5174 occupied (<ss -ltnp output if available>)` and re-run the suite on resume.
- Never kill the listener, drop `CI=1`, or edit `playwright.config.ts`.
- On resume after any stop: if every box of the last-worked step is ticked but `git status --porcelain` shows its changes uncommitted, first re-run the pending 2c smoke (sibling-safe form), then spawn the 2d commit subagent. Do this before spawning the next step's executor.

### 1. Red → Green — the lock-engage reset, test first
Write the App-level test that drives the **real** `useTouchLock` with fake timers and watch it fail. Then add the minimum lock-only effect in `App.tsx` that makes it pass. The work is one step and one commit, so no commit is ever red.

**To-do:**
- [x] Pre-flight check: `git status --porcelain` must list only `M plans/META-PLAN.md` and paths under `plans/feature/lock-view-reset/`. If those are already committed and nothing else is listed, the check also passes. If anything else is listed (e.g. `frontend/src/__tests__/_*` scratch files or `tsconfig.tsbuildinfo`), leave this box unticked, write directly under it `UNRESOLVED — requires user decision/action: unexpected files in working tree (<list>)`, end your final report with that same line, and stop. On a later run where the gate passes, delete that marker line before ticking the box. On a re-run of a partially executed Step 1, ` M frontend/src/App.tsx` and `?? frontend/src/__tests__/App.lockViewReset.test.tsx` are also allowed. Keep them and continue from them; do not recreate them. Also confirm `grep -c 'return { isLocked, arm };' frontend/src/hooks/useTouchLock.ts` prints `1`. If it prints `0` (exit 1), F20 has landed: stop the same way with `UNRESOLVED — requires user decision/action: useTouchLock's return shape changed (F20 landed?); re-key F19 to the idle tick per META-PLAN F19 Open risks (e)`.
- [x] Create `frontend/src/__tests__/App.lockViewReset.test.tsx`. Copy these pieces from `App.touchLock.test.tsx` (L1–65):
  - The imports: `describe, it, expect, vi, beforeEach, afterEach` from `vitest`; `render, screen, waitFor, fireEvent, act` from `@testing-library/react`; `App`; the five `choreApi` functions; `makeChore`; `FakeEventSource`.
  - The `vi.mock('../services/choreApi', …)` block.
  - The stable hoisted `mockDay = new Date(2025, 0, 15, 12, 0, 0)` with `vi.mock('../hooks/useMidnightClock', …)`.
  - Hoisted `mockWake`/`mockUseScreenBlank` with `vi.mock('../hooks/useScreenBlank', …)`.
  - `afterEach(() => { vi.unstubAllGlobals(); })`.
  Import only what this step's test uses. Step 2 adds `mockArm`, `rerender` usage, `CLOSING_SETTLE_MS` and `FADE_MS`. Unused lower-case names fail `@typescript-eslint/no-unused-vars`.
- [x] Mock `useTouchLock` and `choreSort` so they **delegate to the real modules by default** but can be overridden per test:
  ```ts
  const mockUseTouchLock = vi.hoisted(() => vi.fn());
  vi.mock('../hooks/useTouchLock', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../hooks/useTouchLock')>();
      mockUseTouchLock.mockImplementation(actual.useTouchLock);
      return { useTouchLock: mockUseTouchLock };
  });
  const mockOrderChores = vi.hoisted(() => vi.fn());
  vi.mock('../utils/choreSort', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../utils/choreSort')>();
      mockOrderChores.mockImplementation(actual.orderChores);
      return { ...actual, orderChores: mockOrderChores };
  });
  ```
  The async `beforeEach` runs in exactly this order:
  1. `vi.clearAllMocks()`.
  2. `const actualTouchLock = await vi.importActual<typeof import('../hooks/useTouchLock')>('../hooks/useTouchLock')` and `const actualSort = await vi.importActual<typeof import('../utils/choreSort')>('../utils/choreSort')`.
  3. `mockUseTouchLock.mockImplementation(actualTouchLock.useTouchLock)`.
  4. `mockOrderChores.mockImplementation(actualSort.orderChores)`.
  5. `mockUseScreenBlank.mockReturnValue({ isBlanked: false, wake: mockWake })`.
  6. `FakeEventSource.instances = []` and `vi.stubGlobal('EventSource', FakeEventSource as unknown as typeof EventSource)`.
  7. The resolved `addChore`/`completeChore`/`removeChore`/`updateChore` mocks, as in `App.touchLock`.
  8. `vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' }), makeChore({ id: 2, name: 'Dust', room: 'Bathroom' })])`.

  Do **not** copy `App.touchLock`'s `mockUseTouchLock.mockReturnValue({ isLocked: false, … })` line, because it would disable the real hook. Step 5 matters because it undoes a previous test's `isBlanked: true`.
- [x] Define a file-local `const IDLE_MS = 5 * 60 * 1000;` with a comment saying it mirrors `useTouchLock`'s module-private `INACTIVITY_MS`. Do **not** export `INACTIVITY_MS`; the hook stays untouched.
- [x] Write test `describe('lock-time view reset (F19)')` → `it('resets scroll, room, search and day when the lock engages after 5 minutes idle')`:
  1. `vi.useFakeTimers({ now: new Date(2025, 0, 15, 12, 0, 0), shouldAdvanceTime: true })`, and wrap the body in `try { … } finally { vi.useRealTimers(); }`.
  2. `render(<App />)`, then `await waitFor(...)` until `Sweep` shows.
  3. Put the view in a drifted state, using **`fireEvent` only** (`userEvent` dispatches `pointerdown`, which would re-arm the lock timer):
     - `fireEvent.click` the `Kitchen` room button.
     - `fireEvent.change(searchInput, { target: { value: 'sw' } })`.
     - `fireEvent.click` `Next day` twice.
     - Set `region.scrollTop = 200` and then `fireEvent.scroll(region)`, where `region = document.querySelector('.overflow-y-auto') as HTMLElement`.
     - Assert the drift took: `Dust` is absent, `Return to today` is present, the search input value is `'sw'`, and `region.scrollTop === 200`.
  4. `act(() => { vi.advanceTimersByTime(IDLE_MS); })`. Then assert:
     - `screen.getByTestId('touch-lock-overlay')` is present (the lock engaged).
     - `region.scrollTop === 0`.
     - The search input value is `''`.
     - `Dust` is present again.
     - `screen.queryByText('Return to today')` is null.
- [x] **Internal checkpoint (expected red; do not commit, stop, or report a failure here):** run `cd frontend && npx vitest run src/__tests__/App.lockViewReset.test.tsx` from the repo root and confirm it fails on a reset assertion (`expected 200 to be +0` or similar), not on setup. If it fails on setup (lock not engaging, mocks mis-wired), fix the test scaffolding until only reset assertions fail. Never weaken an assertion. On a re-run where `git diff -- frontend/src/App.tsx` already shows the F19 effect, tick this box as N/A ("re-run, effect already present; red was confirmed on the first run"). Do not revert the effect to reproduce red.
- [x] In `frontend/src/App.tsx`, add a new `useEffect` directly **after** the force-close-dialogs effect (the one whose deps are `[isBlanked, isLocked]`):
  ```tsx
  // F19: the lock engaging returns the view to the boot state — top of the
  // list, every room, no search, today — so the next person at the kiosk
  // meets the canonical view. Lock-only (never on blank or unlock); the
  // scroll is instant because the app is inert behind the padlock.
  // F20 note: once useTouchLock exposes an idle-expiry tick, re-key this to
  // also re-run on each tick while locked and on a manual lock, first closing
  // an Add modal left open under the lock (META-PLAN F19 "Amended by F20").
  useEffect(() => {
      if (!isLocked) return;
      if (scrollRegionRef.current) scrollRegionRef.current.scrollTop = 0;
      setSelectedRoom('all');
      setSearchQuery('');
      setDayOffset(0);
  }, [isLocked]);
  ```
  Rules for this effect:
  - Do **not** reference `isBlanked` in its deps or body. A lock engaging under a blank must still reset, so the 06:00 wake shows the reset view.
  - Do **not** touch `justRelocked`/`wasLockedRef`.
  - The effect body runs on mount and whenever `isLocked` changes. It returns early whenever `isLocked` is false, which covers the unlocked mount and the `true → false` unlock edge. A mount while already locked runs it once, and that is a no-op because every value is already at its default.
  - Do not add a second ref, and do not change the scroller's class string.
  - `scrollRegionRef.current` is null while the loading branch renders. The `if` guard makes a lock during loading reset only the state.
- [x] Run `cd frontend && npx vitest run src/__tests__/App.lockViewReset.test.tsx` and confirm it now **passes**. This green run is the step's validation result.
- [x] Run `cd frontend && npx vitest run src/__tests__/App.touchLock.test.tsx src/__tests__/App.test.tsx` and confirm the existing lock and F18 suites stay green.
- [x] Run `npx eslint frontend/src/App.tsx frontend/src/__tests__/App.lockViewReset.test.tsx` from the repo root and fix any finding. `react-hooks/exhaustive-deps` should be clean, because the setters and the ref are stable. Then run `npx tsc --noEmit -p frontend/tsconfig.json` from the repo root. It must exit 0; non-build mode writes no tsbuildinfo.
- [x] Confirm `git status --porcelain` lists only `M plans/META-PLAN.md` and paths under `plans/feature/lock-view-reset/` (if not yet committed), plus ` M frontend/src/App.tsx` and `?? frontend/src/__tests__/App.lockViewReset.test.tsx`. If anything else is listed (other than a `_*` scratch file you created, which you delete), do not delete or revert it. Leave this box unticked, write directly under it `UNRESOLVED — requires user decision/action: unexpected files in working tree (<list>)`, end your final report with that same line, and stop. On a later run where the gate passes, delete that marker line before ticking the box.

### 2. Guard tests — real unlock, not on blank, lock-under-blank, conditional re-sort, F18 button hides
Pin the negative contract and the interactions with shipped features. Each test goes in the same `describe`.

**To-do:**
- [x] Pre-flight: confirm Step 1's effect is committed: `git grep -c 'F19: the lock engaging' HEAD -- frontend/src/App.tsx` must print `HEAD:frontend/src/App.tsx:1` (exit 0). If it prints nothing (exit 1), Step 1 was never committed. Do **not** run `git checkout`. Leave this box unticked, write directly under it `UNRESOLVED — requires user decision/action: Step 1's F19 effect is uncommitted; commit Step 1 before running the mutation probes`, end your final report with that same line, and stop. On a later run where the gate passes, delete that marker line before ticking the box.
- [x] Add hoisted `const mockArm = vi.hoisted(() => vi.fn());` for the hand-driven tests below, and import `CLOSING_SETTLE_MS` from `../components/common/TouchLockOverlay` and `FADE_MS` from `../components/common/ScrollToTopButton`.
- [x] `it('does not reset when the lock is released by a double-tap')`. Use the **real** hook (the file default) under `vi.useFakeTimers({ now: new Date(2025, 0, 15, 12, 0, 0), shouldAdvanceTime: true })` with `try/finally` → `vi.useRealTimers()`.
  1. Render and wait for `Sweep`, then `act(() => { vi.advanceTimersByTime(IDLE_MS); })`. Assert `touch-lock-overlay` is present.
  2. Drift while locked with `fireEvent`: click `Kitchen` and change the search to `'sw'`. jsdom does not enforce `inert`.
  3. Double-tap to unlock: `const overlay = screen.getByTestId('touch-lock-overlay'); fireEvent.click(overlay, { clientX: 100, clientY: 100 }); fireEvent.click(overlay, { clientX: 100, clientY: 100 });`.
  4. `act(() => { vi.advanceTimersByTime(CLOSING_SETTLE_MS); })`.
  5. Assert that `screen.getByPlaceholderText('Search for a chore').closest('.App')` has no `inert` attribute (unlocked), `screen.queryByTestId('touch-lock-overlay')` is null (the unlock hand-off completed), the search still reads `'sw'`, and `Dust` is still absent.
  Do not advance another `IDLE_MS`, because `arm()` re-armed the timer.
- [x] `it('does not reset when the screen blanks without the lock engaging')`. Hand-drive the hook: `mockUseTouchLock.mockReturnValue({ isLocked: false, arm: mockArm })` for the whole test.
  1. Render and wait for `Sweep`.
  2. Drift the view: click `Kitchen`, set the search to `'sw'`, click `Next day`, then set `region.scrollTop = 200` + `fireEvent.scroll(region)`.
  3. Set `mockUseScreenBlank.mockReturnValue({ isBlanked: true, wake: mockWake })` and `rerender(<App />)`.
  4. Assert `screen-blank-overlay` is present, `region.scrollTop === 200`, the search is still `'sw'`, and `Return to today` is still present.
- [x] `it('resets when the lock engages while the screen is blanked')`. Hand-drive the hook, starting at `isLocked: false`.
  1. Render, wait for `Sweep`, and drift as in the blank test.
  2. Set `mockUseScreenBlank.mockReturnValue({ isBlanked: true, wake: mockWake })` and rerender.
  3. Set `mockUseTouchLock.mockReturnValue({ isLocked: true, arm: mockArm })` and rerender.
  4. Assert `screen-blank-overlay` is present, `touch-lock-overlay` is absent (blank wins, F1 precedence), `region.scrollTop === 0`, the search is `''`, `Dust` is present, and `Return to today` is absent.
- [x] `it('re-sorts on lock only when a day simulation was active')`. Hand-drive the hook, starting at `isLocked: false`.
  - Case A:
    1. Render and wait for `Sweep`.
    2. Leave `dayOffset` at 0 and call `mockOrderChores.mockClear()`.
    3. Flip to `isLocked: true` and rerender.
    4. `expect(mockOrderChores).not.toHaveBeenCalled()`.
  - Case A is deterministic. `orderChores`'s only non-test call sites are `reconcileChores` (on fetch) and the `[simulatedDate]` effect, and neither runs on a lock rerender with `dayOffset` 0.
  - Case B, in the same test:
    1. Flip to `isLocked: false` and rerender.
    2. Click `Next day` twice, then `mockOrderChores.mockClear()`.
    3. Flip to `isLocked: true` and rerender.
    4. Assert `mockOrderChores` was called and `mockOrderChores.mock.calls[0][1]` `toEqual(mockDay)`. That is the real today.
- [x] `it('hides the scroll-to-top button once the lock resets the scroll')`. Hand-drive the hook, starting at `isLocked: false`.
  1. After the initial load (under real timers), call `vi.useFakeTimers({ shouldAdvanceTime: true })` with `try/finally` → `vi.useRealTimers()`.
  2. Set `region.scrollTop = 200` + `fireEvent.scroll(region)`, then assert `screen.getByTestId('scroll-to-top').className` contains `opacity-100`.
  3. Flip to `isLocked: true` and rerender. Assert `region.scrollTop === 0`.
  4. `fireEvent.scroll(region)`, because jsdom doesn't dispatch `scroll` on a programmatic write. Assert the className contains `opacity-0`.
  5. `act(() => { vi.advanceTimersByTime(FADE_MS); })`. Assert the button `toHaveAttribute('inert')` and has `aria-hidden="true"`.
- [x] Run `cd frontend && npx vitest run src/__tests__/App.lockViewReset.test.tsx` and confirm all six tests pass.
- [x] Prove the guards bite.
  - Run `git diff --quiet -- frontend/src/App.tsx`. If it exits 1, a previous run left a mutation behind: run `git checkout -- frontend/src/App.tsx` to restore the committed version before continuing.
  - Then apply each mutation below to the Step 1 effect, one at a time. Run the file after each and confirm the named test goes red, then restore with `git checkout -- frontend/src/App.tsx`.
    - Deps `[isLocked, isBlanked]` with `if (!isLocked && !isBlanked) return;` → the blank test goes red.
    - `if (!isLocked || isBlanked) return;` → the lock-under-blank test goes red.
    - Remove the `if (!isLocked) return;` line → the double-tap unlock test goes red.
    - Drop the deps array entirely → the double-tap unlock test goes red.
    - Add `setSortedIds(orderChores(choreDataRef.current, simulatedDate).map(c => c.id));` to the body → the re-sort test's Case A goes red.
  - After the last restore, `git diff --quiet -- frontend/src/App.tsx` must exit 0. Record the outcomes in this bullet.
  - **Outcomes (2026-09-23):** pre-probe `git diff --quiet` exited 0. Each probe turned exactly one test red (1 failed | 5 passed):
    - `[isLocked, isBlanked]` + `!isLocked && !isBlanked` → red: "does not reset when the screen blanks without the lock engaging".
    - `!isLocked || isBlanked` → red: "resets when the lock engages while the screen is blanked".
    - `if (!isLocked) return;` removed → red: "does not reset when the lock is released by a double-tap".
    - deps array dropped → red: "does not reset when the lock is released by a double-tap".
    - `setSortedIds(orderChores(...))` added → red: "re-sorts on lock only when a day simulation was active" (Case A).
    - Restored with `git checkout -- frontend/src/App.tsx` after each; the final `git diff --quiet -- frontend/src/App.tsx` exited 0.
- [x] Run `npx eslint frontend/src/__tests__/App.lockViewReset.test.tsx` from the repo root and fix any finding. Then run `npx tsc --noEmit -p frontend/tsconfig.json` from the repo root; it must exit 0.
- [x] Confirm `git status --porcelain` lists only `frontend/src/__tests__/App.lockViewReset.test.tsx` and the plan file (if not yet committed). Delete any `_*` scratch file you created. If anything else is listed (other than a `_*` scratch file you created, which you delete), do not delete or revert it. Leave this box unticked, write directly under it `UNRESOLVED — requires user decision/action: unexpected files in working tree (<list>)`, end your final report with that same line, and stop. On a later run where the gate passes, delete that marker line before ticking the box.

### 3. README — document the lock and the reset
Add the lock paragraph that the root README lacks today, including the F19 line.

**To-do:**
- [x] In the repo-root `README.md` (not `deploy/pi/README.md` or `.github/rulesets/README.md`) § `## How prioritization works`, add a paragraph right after the scroll-to-top paragraph (the one ending `…(\`frontend/src/components/common/ScrollToTopButton.tsx\`).`) and before `### Adding and editing chores`:
  > After 5 minutes without a touch the app locks — the top-left padlock closes and taps are
  > ignored until a double-tap unlocks it (`frontend/src/hooks/useTouchLock.ts`).
  > Locking also returns the view to the top of the list, the *All* tab, an empty search and today.

  Keep the README's ~95-column hard wrap, and keep the phrase `Locking also returns the view` on a single line. F22's in-flight plan (sibling worktree `c4i-wt-overlay-scrollbar`) adds its overlay-scrollbar paragraph at the same anchor. If it has merged first, put this paragraph directly after F22's; on a rebase conflict, keep both paragraphs with F22's first. The `grep -c` gate below still returns `1`.
- [x] Confirm `grep -c 'Locking also returns the view' README.md` from the repo root → `1`.
- [x] Confirm `git status --porcelain` lists only `README.md` and the plan file (if not yet committed). If anything else is listed (other than a `_*` scratch file you created, which you delete), do not delete or revert it. Leave this box unticked, write directly under it `UNRESOLVED — requires user decision/action: unexpected files in working tree (<list>)`, end your final report with that same line, and stop. On a later run where the gate passes, delete that marker line before ticking the box.

### 4. Verify All Tests Pass

Run the full suites and confirm the META-PLAN's F19 "Expected end state".

**To-do:**
- [x] Run `cd frontend && npx vitest run` and confirm the whole Vitest suite passes.
- [x] Run `npm run lint` and `npx tsc --noEmit -p frontend/tsconfig.json` from the repo root. Both must be clean. Use non-build mode: `tsc -b` writes an un-ignored root `tsconfig.tsbuildinfo`. Then confirm `git status --porcelain` lists no `tsconfig.tsbuildinfo`, and delete it if one appeared.
- [x] Confirm the grep facts from the repo root:
  - `grep -c 'ref={scrollRegionRef}' frontend/src/App.tsx` → `1`.
  - `grep -c 'ref={scrollRegionRef} className="flex-1 overflow-y-auto min-h-0 flex flex-col scroll-pb-40' frontend/src/App.tsx` → `1`. The pattern has no closing quote because F22 may append `scrollbar-none` if it merges first. The gate catches a changed or removed token. F19 must also not append one, since Step 1 forbids any class-string change.
  - `grep -c '}, \[isLocked\]);' frontend/src/App.tsx` → `2` (the existing `wasLockedRef` effect plus the new F19 effect).
  - `grep -c 'isBlanked, isLocked\]' frontend/src/App.tsx` → `1` (the force-close effect only).
- [x] Run the Playwright smoke spec as `env -u PLAYWRIGHT_BASE_URL CI=1 npx playwright test e2e/smoke.spec.ts` from the repo root. This repo has sibling `c4i-wt-*` worktrees, so the sibling-safe form is required.
  - If it fails with `… is already used …` or `Process from config.webServer was not able to start`, retry about every 30 s with jitter for up to ~10 min.
  - If it still fails, leave this box unticked, write directly under it `UNRESOLVED — requires user decision/action: Playwright ports 3000/5174 occupied (<ss -ltnp output if available>)`, end your final report with that same line, and stop. On a later run where the gate passes, delete that marker line before ticking the box.
  - Never kill the listener, drop `CI=1`, or edit `playwright.config.ts`.
- [x] Copy the `## Manual checks (human, on the Pi)` section below verbatim into your final report. **Orchestrator (/run-plan): include that section verbatim in your Completion summary**, so the user sees it. When `/git-push` then fills its PR body's "How to manually verify" bullet, use this section for it.
- [x] Investigate and fix any failures before marking the plan finished.
  - **Outcomes (2026-09-23):** Vitest 38/38 files, 372/372 tests passed; `npm run lint` exit 0; `tsc --noEmit` exit 0; `git status --porcelain` clean (no `tsconfig.tsbuildinfo`); greps 1/1/2/1 as expected; Playwright smoke 14/14 passed (sandboxed, no port conflict). No failures to fix.

## Manual checks (human, on the Pi)
- Leave the kiosk scrolled down, on a room tab, with a search typed and the day stepped forward. Wait 5 minutes. When the padlock engages, the view behind it should be at the top, on *All*, with an empty search and today's date.
- If the room tabs overflow the screen width, confirm whether the *All* chip is visible after the lock reset. The tab strip's horizontal scroll is not reset; if the chip is hidden, file a follow-up.
- Confirm the jump behind the `bg-black/40` backdrop is unobtrusive and doesn't read as a flicker (META-PLAN F19 Open risks (b)). If it does, gate the reset behind `CLOSING_SETTLE_MS`-style timing *inside* the lock. Never move it to unlock. If F22 (overlay scrollbar) has already shipped, also confirm its thumb's brief flash at the lock reset looks acceptable. F19 adds no programmatic flag (F22 plan Decision (b)).

## Status
finished: true
