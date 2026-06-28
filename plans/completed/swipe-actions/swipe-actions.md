> **STATUS: Merged** `0d05453` (#17). Frozen — historical record, do not edit.
> **Outcome:** Shipped as planned. `react-swipeable` `useSwipeable` on each bar: swipe-left
> routes through F4's `ConfirmDialog` to delete, swipe-right opens F2's `ChoreFormModal` to
> edit; `touch-pan-y` preserves tap-to-complete and the day-simulation guard. NOTE: a later
> backlog item (260627) requests **reversing** these directions + adding reveal animations —
> that supersedes the directions chosen here. See git for the actual diff.

# F5 — Swipe behaviors (left = delete, right = edit)

## Summary
Add horizontal swipe gestures to each chore bar: **swipe left = delete** (routing through F4's
existing `ConfirmDialog`) and **swipe right = edit** (opening F2's pre-populated `ChoreFormModal`),
without regressing whole-bar tap-to-complete or the day-simulation guard. The gesture mechanism is
**`react-swipeable` v7** (the `useSwipeable` hook) — chosen for its ~1.5 KB gzip footprint (Pi/mobile
target), explicit React 19 peer support, and jsdom testability via `trackMouse: true`. The swipes
reuse the bar's existing `onDelete(id)` / `onEdit?(id)` props — no new props or App/ChoreList wiring.
The interim `✕` delete and `Pencil` edit buttons **remain present** at this stage (they are removed
later in F6); swipe is purely additive here.

## Research Findings
- **Wiring is already in place.** `ChoreTimerBar` receives `onComplete(id,date)`, `onDelete(id)`, `onEdit?(id)`. In `App.tsx`, `onDelete` is bound to `handleRequestDelete` (opens `ConfirmDialog` via `pendingDeleteId`) and `onEdit` to `handleRequestEdit` (opens pre-populated `ChoreFormModal` via `editingId`). So swipe-left → `onDelete(chore.id)` and swipe-right → `onEdit?.(chore.id)` reuse the exact button paths — **no new props, no ChoreList/App changes** (`frontend/src/App.tsx:93-95,123-126,174,180-195`; `frontend/src/components/chore/ChoreList.tsx:4-36`).
- **Gesture choice: `react-swipeable@^7.0.2`.** Zero deps, `peerDependencies.react` lists `^19.0.0`, ~1.5 KB gzip (vs `@use-gesture/react` ~8.9 KB + usually react-spring). The `useSwipeable` hook returns handlers spread onto the existing root `<div>`; `trackMouse: true` lets jsdom tests + Playwright drive swipes with mouse events (jsdom's `TouchEvent` is incomplete). `delta: 50` keeps taps under the swipe threshold; `touch-action: pan-y` (Tailwind `touch-pan-y`) preserves native vertical list scroll while capturing horizontal intent.
- **Two guards must be preserved.** (1) **Simulation guard:** `resetTask` early-returns on `isSimulating` and the root gets `pointer-events-none`; jsdom does NOT honor `pointer-events-none` (no layout), so swipe callbacks must **also** JS-guard on `isSimulating` to stay inert while simulating and to make that testable. (2) **Tap vs swipe:** after a mouse swipe the browser fires a trailing `click` that would hit the root `onClick={resetTask}` and wrongly complete the chore — suppress it with a `swipingRef` set **only when a left/right swipe completes** (`onSwipedLeft`/`onSwipedRight`, which fire only past `delta`) and cleared at gesture start (`onTouchStartOrOnMouseDown`). Setting the flag in the directional callbacks (rather than `onSwiping`) guarantees a sub-threshold/jittery drag never sets it, so a near-stationary tap that includes minor pointer jitter still completes. (`frontend/src/components/chore/ChoreTimerBar.tsx:28-38,50-68`).
- **Test stack:** Vitest 4 + jsdom 29 + `@testing-library/react` 16 + `user-event` 14. No gesture/pointer/touch precedent yet. Existing `ChoreTimerBar.test.tsx` completes via `fireEvent.click(getByTestId('chore-bar'))` (a bare `click`, no mousedown) — this must keep passing, so `onClick` stays on the div and `swipingRef` initializes `false`. Fixtures via `makeChore()` at `frontend/src/__tests__/fixtures/chore.ts`.
- **e2e:** `e2e/smoke.spec.ts` deletes via `[aria-label="Delete chore"]` then `getByTestId('confirm-dialog-confirm')`, edits via `[aria-label="Edit chore"]`. Buttons remain in F5, so those keep working; a Playwright **mouse-drag** swipe test (`react-swipeable` `trackMouse`) is added as additive coverage.

## Decisions (resolving the feature's "Open risks / decisions")
- **(a) Library vs hand-rolled →** `react-swipeable@^7.0.2`. Smallest gzip among gesture libs, explicit React-19 peer, and mouse-event testability in jsdom; hand-rolling would re-implement delta/dominant-axis + own the test ergonomics for no real saving.
- **(b) Tap/scroll disambiguation →** `delta: 50` (px) so taps never register as swipes; `touch-action: pan-y` (`touch-pan-y`) so vertical scroll stays native and only horizontal motion is a swipe; a `swipingRef` suppresses the post-swipe trailing click so tap-to-complete never double-fires.
- **(c) Split into F5a/F5b? →** **No.** With `react-swipeable` the gesture layer is a single hook + two callbacks; left and right land together in one checkpoint with shared tests. Splitting would duplicate the hook/test scaffolding.
- **(d) Testability of touch in jsdom →** drive swipes with **mouse** events (`fireEvent.mouseDown/Move/Up`) enabled by `trackMouse: true`, avoiding jsdom's missing `Touch`/`TouchEvent` constructors.

## Steps

### 1. Add the `react-swipeable` dependency
Install the gesture library into the frontend workspace and confirm it resolves cleanly against React 19.

**To-do:**
- [x] From the repo root run `npm install react-swipeable@^7.0.2 --workspace frontend` (npm-workspaces install; updates `frontend/package.json` dependencies and the **single root** `package-lock.json` — there is no `frontend/package-lock.json` in this workspace). Match the repo's existing `^`-range convention (other deps use `^`).
- [x] Confirm `frontend/package.json` `dependencies` now contains `"react-swipeable": "^7.0.2"` and that the root `package-lock.json` records the resolved 7.x version with **no** new runtime transitive deps (react-swipeable has zero deps).
- [x] When this work is committed, stage **both** `frontend/package.json` and the repo-root `package-lock.json` together (the lockfile is tracked; committing the manifest without it would break `npm ci` reproducibility).
- [x] Run `npm run build --workspace frontend` to confirm the new dependency type-checks and bundles cleanly before any code change (baseline green).
- [x] Verify no peer-dependency warning was emitted for `react@^19.1.0` (react-swipeable peer lists `^19.0.0`); if `npm install` printed an `ERESOLVE`/peer error, STOP and reconcile (do NOT use `--legacy-peer-deps`).

### 2. (Red) Write failing component tests for swipe + tap on `ChoreTimerBar`
Add the swipe-gesture test cases to `frontend/src/__tests__/components/ChoreTimerBar.test.tsx` before implementing, following the existing file's render/`vi.fn()`/query patterns. These must fail (swipes currently do nothing).

**To-do:**
- [x] Add a helper inside the test file to perform a horizontal mouse swipe on the bar, e.g. `function swipe(bar: HTMLElement, fromX: number, toX: number) { fireEvent.mouseDown(bar, { clientX: fromX, clientY: 50 }); fireEvent.mouseMove(bar, { clientX: (fromX+toX)/2, clientY: 50 }); fireEvent.mouseMove(bar, { clientX: toX, clientY: 50 }); fireEvent.mouseUp(bar, { clientX: toX, clientY: 50 }); }` (import `fireEvent` from `@testing-library/react`; `getByTestId('chore-bar')` is the target).
- [x] Test **swipe-left → delete**: render with `onDelete`/`onComplete`/`onEdit` `vi.fn()`s and `isSimulating={false}`; `swipe(bar, 200, 120)` (dx = −80, past the 50px delta, horizontal-dominant); assert `onDelete` called with `makeChore().id` and `onComplete` **not** called.
- [x] Test **swipe-right → edit**: `swipe(bar, 120, 220)` (dx = +100); assert `onEdit` called with the chore id and `onComplete` **not** called.
- [x] Test **tap-still-completes (regression)**: keep/duplicate the existing `fireEvent.click(getByTestId('chore-bar'))` case and assert `onComplete` fires with the real `new Date()` — confirms a bare click (no movement) is not swallowed by swipe logic.
- [x] Test **post-swipe click is suppressed**: perform `swipe(bar, 200, 120)` then `fireEvent.click(bar)`; assert `onComplete` was **not** called (the trailing click after a swipe must not complete the chore).
- [x] Test **swipe is inert while simulating**: render with `isSimulating={true}`; `swipe(bar, 200, 120)` and `swipe(bar, 120, 220)`; assert neither `onDelete` nor `onEdit` fired (mirrors the existing `resetTask` simulation guard; necessary because jsdom ignores `pointer-events-none`).
- [x] Test **sub-threshold drag is not a swipe**: `swipe(bar, 200, 180)` (dx = −20, under the 50px delta) then `fireEvent.click(bar)`; assert `onDelete`/`onEdit` not called and `onComplete` **is** called (a tiny movement is still a tap). This passes because the suppression flag is set only in `onSwipedLeft`/`onSwipedRight`, which never fire below `delta` — so a sub-threshold drag leaves the flag unset and the trailing click completes.
- [x] Test **`touch-pan-y` class present** (cheap regression lock for the vertical-scroll affordance, which is not otherwise testable in jsdom): assert `getByTestId('chore-bar')` has the `touch-pan-y` class (`toHaveClass('touch-pan-y')`).
- [x] Run `npm run test --workspace frontend` (vitest) and confirm the new swipe/suppression/simulation cases **fail** for the right reason (callbacks not invoked because no gesture handling exists yet); the existing tap-click test should still pass. **Robustness note:** if, after Step 3 is implemented, `onSwipedLeft/Right` do not fire under the mouse-event helper, ensure every `fireEvent` targets the exact `chore-bar` div (not a child), add a third intermediate `mouseMove`, and confirm `trackMouse: true` is set — these are the known jsdom levers for react-swipeable mouse-driven swipes.

### 3. (Green) Implement swipe handling in `ChoreTimerBar`
Wire `useSwipeable` onto the existing root `<div>`, reusing `onDelete`/`onEdit`, guarding simulation, and suppressing the post-swipe click. Keep the `✕` and `Pencil` buttons and update the TODO.

**To-do:**
- [x] In `frontend/src/components/chore/ChoreTimerBar.tsx`, add imports: `import { useRef } from 'react';` and `import { useSwipeable } from 'react-swipeable';`.
- [x] Inside the component, add `const swipingRef = useRef(false);` and construct the swipe handlers:
  ```tsx
  const swipeHandlers = useSwipeable({
      onSwipedLeft: () => { swipingRef.current = true; if (!isSimulating) onDelete(chore.id); },
      onSwipedRight: () => { swipingRef.current = true; if (!isSimulating && onEdit) onEdit(chore.id); },
      onTouchStartOrOnMouseDown: () => { swipingRef.current = false; },
      delta: 50,
      trackMouse: true,
      preventScrollOnSwipe: false,
  });
  ```
  Set `swipingRef.current = true` **inside the directional callbacks** (`onSwipedLeft`/`onSwipedRight`), which fire only after a completed swipe past `delta`. This suppresses the browser's trailing post-swipe `click` (next bullet) without ever flagging a sub-threshold/jittery drag — so a near-stationary tap still completes. `onTouchStartOrOnMouseDown` clears the flag at the start of **every** gesture so a prior touch-swipe (which fires no trailing click) never eats the next genuine tap. Event order for a real mouse swipe is `mousedown` (flag→false) → moves → `mouseup` (fires `onSwiped*`, flag→true) → `click` (`resetTask` sees true, clears, returns) — the `onSwiped*` runs in the `mouseup` listener before the browser dispatches `click`, so the flag is set in time.
- [x] Update `resetTask` to suppress the trailing post-swipe click:
  ```tsx
  function resetTask() {
      if (isSimulating) return;
      if (swipingRef.current) { swipingRef.current = false; return; }
      onComplete(chore.id, new Date());
  }
  ```
- [x] Spread the handlers onto the existing root `<div>` and add the `touch-pan-y` class, keeping `data-testid="chore-bar"`, `onClick={resetTask}`, and the existing simulation classes. Spread `{...swipeHandlers}` **before** the explicit props so `onClick`/`className`/`data-testid` are not overwritten. (In react-swipeable v7 the returned handlers object contains only `ref` and — with `trackMouse: true` — `onMouseDown`; the mouse-move/up and touch listeners are attached imperatively via the `ref`, not as React props. It contains **no** `onClick`/`className`/`data-testid` key, so spreading first is safe.) The `className` template must include `touch-pan-y` (CSS `touch-action: pan-y`) so vertical list scroll stays native while horizontal swipes are captured:
  ```tsx
  <div
      {...swipeHandlers}
      data-testid="chore-bar"
      className={`relative h-36 sm:h-24 w-full bg-gray-800 rounded-full shadow overflow-hidden touch-pan-y ${isSimulating ? 'cursor-not-allowed opacity-60 pointer-events-none' : 'cursor-pointer'}`}
      onClick={resetTask}
  >
  ```
- [x] Update the `TODO(#10)` comment (currently `{/* TODO(#10): replace edit + delete buttons with swipe gestures (F5) — removed in F6 */}`) to reflect that swipe is now implemented and the buttons are retained until F6 — e.g. `{/* Swipe left = delete, swipe right = edit (F5). Interim ✕/pencil buttons retained until removed in F6 (#10). */}`. Do **not** remove the buttons in this feature.
- [x] Leave `ChoreList.tsx`, `App.tsx`, and the `ChoreTimerBarProps` interface unchanged — swipes reuse the existing `onDelete`/`onEdit` props.
- [x] **Intentional, transient asymmetry to be aware of (no code change):** the swipe callbacks are `isSimulating`-guarded (so swipe is inert while simulating), but the interim `✕`/`Pencil` buttons are deliberately **not** guarded — they keep working during simulation via their `pointer-events-auto` wrapper, exactly as F4/F2 shipped them (an existing test asserts the delete button still fires during simulation). Do **not** add `isSimulating` guards to the buttons (that would change F4/F2 behavior and break that test). This asymmetry self-resolves in F6 when the buttons are removed.
- [x] Run `npm run test --workspace frontend` and confirm all `ChoreTimerBar` tests from Step 2 now pass (swipe-left/right fire the right callbacks, tap completes, post-swipe click suppressed, simulating is inert, sub-threshold is a tap).

### 4. (Red→Green) App-level integration tests: swipe opens confirm / edit modal
Verify the full chain (bar → App handler → dialog/modal) in `frontend/src/__tests__/App.test.tsx`, using its existing mocked-`choreApi` render pattern.

**To-do:**
- [x] Read the top of `frontend/src/__tests__/App.test.tsx` to reuse its existing `vi.mock('../services/choreApi', ...)` setup, its render helper, and how it waits for chores to load (e.g. seed chores rendered before interacting).
- [x] Add a local mouse-swipe helper (same shape as Step 2's) operating on a chore bar obtained via `screen.getAllByTestId('chore-bar')[0]`.
- [x] Test **swipe-left opens the delete confirmation**: after the list loads, swipe the first bar left; assert the `ConfirmDialog` appears (e.g. `await screen.findByTestId('confirm-dialog-confirm')`, or the `Delete "<name>"? This can't be undone.` message) and that no delete API call fired yet (deletion only happens on confirm).
- [x] Test **swipe-right opens the pre-populated edit modal**: swipe the first bar right; assert the edit modal appears pre-filled — the form `input[name="name"]` holds the seeded chore's name. Assert against the actual seeded fixture value (App.test.tsx mocks `fetchAllChores` to resolve `[makeChore()]`, whose name is `'Sweep'`), not a hardcoded unrelated string. `getByLabelText('Name')` is an equivalent query if it matches the file's existing edit-test style.
- [x] Run `npm run test --workspace frontend` and confirm these App-level tests pass (they exercise the real `handleRequestDelete`/`handleRequestEdit` wiring through `ChoreList`).

### 5. (Additive) Playwright e2e swipe coverage
Add a real-browser mouse-drag swipe to `e2e/smoke.spec.ts`, keeping the existing button-based delete/edit flows intact (the buttons remain in F5).

**To-do:**
- [x] Read `e2e/smoke.spec.ts` to reuse its `beforeEach` (waits for `Vacuum Bedroom Floor`), its bar selector `.bg-gray-800.rounded-full`, the add-chore helper used by the delete/edit tests, and `getByTestId('confirm-dialog-confirm')`.
- [x] Add a swipe helper using Playwright mouse drag (works with `react-swipeable` `trackMouse: true`): get the target bar's `boundingBox()`, then `page.mouse.move(box.x + box.width*0.7, box.y + box.height/2)`, `page.mouse.down()`, two or more `page.mouse.move(...)` steps moving left past ~60px (so `onSwiping` fires), `page.mouse.up()`. Multiple move steps are required for the gesture to register. **Implementation note:** the gesture only registered reliably with a sequence of ~10 small discrete `page.mouse.move` steps (~14px each) separated by a short `waitForTimeout(15)` per step — a single large jump (even with `{ steps }`) did NOT fire `onSwiping`. Start at `box.width*0.4` (not 0.7) so the drag stays inside the bar and clears the ✕/pencil button cluster on the right edge.
- [x] Test **swipe-left → delete-confirm**: create a uniquely-named chore, swipe its bar left, assert `getByTestId('confirm-dialog-confirm')` becomes visible, click it, and assert the chore disappears. (Reuse the existing create + confirm pattern.)
- [x] Test **swipe-right → edit modal**: create a uniquely-named chore, swipe its bar right, assert the edit modal opens pre-filled (`input[name="name"]` equals the chore name).
- [x] Keep the existing `[aria-label="Delete chore"]` / `[aria-label="Edit chore"]` button tests unchanged (buttons persist until F6).
- [x] Run `npm run test:e2e` (Playwright, from repo root — auto-starts backend+frontend dev servers per `playwright.config.ts`). **Ran locally and passed: 11/11 e2e tests green (9 pre-existing button-based + 2 new swipe).** No fallback needed — the mouse-drag swipe registered reliably with the discrete-move helper above. Component + App-level swipe coverage (Steps 2–4) remains the primary guarantee.

### 6. Record the gesture decision in META-PLAN (cross-session persistence)
Persist the `react-swipeable` choice so F6 (which makes swipe the sole delete/edit affordance) inherits it from the repo, per the manifest's cross-session persistence rule.

**To-do:**
- [x] In `plans/META-PLAN.md`, under the **F5** section, add an "**Implemented contract (recorded for F6)**" subsection (mirroring F2's recorded-contract block) stating: gesture mechanism = `react-swipeable@^7.0.2` via `useSwipeable` spread onto the `ChoreTimerBar` root `<div>`; swipe-left → `onDelete(chore.id)`, swipe-right → `onEdit?.(chore.id)` (reusing existing props, routing through F4 confirm / F2 edit modal); `delta: 50`, `trackMouse: true`, `touch-pan-y`; `isSimulating` guards the swipe callbacks; a `swipingRef` suppresses the trailing post-swipe click; the `✕`/pencil buttons and tap-to-complete are all retained (buttons removed in F6).
- [x] In the same "Implemented contract" block, record two **forward obligations for F6** so they aren't lost: (i) when F6 rewrites the bar's root `className` (height tokens) it must **preserve the `touch-pan-y` class and the `{...swipeHandlers}`-before-explicit-props spread order** — the gesture binding lives on the root div F6 keeps; (ii) F6 removes the `✕`/pencil buttons, making swipe the **sole** delete/edit affordance, which leaves delete/edit **keyboard/screen-reader-inaccessible** — F6 must add an accessible fallback (the buttons currently provide this; swipe alone does not).
- [x] Confirm F6's "Assumed starting state" facts still read true after this feature (swipe-left→delete-confirm, swipe-right→edit present; bar still `h-36 sm:h-24` with room/overdue/`✕`/pencil; e2e delete still has a working path). No edits to F6's section are needed unless a fact diverged — if one did, update F6's assumed-start in this same change.

### 7. Verify All Tests Pass
Run the full suites and static checks to confirm nothing is broken.

**To-do:**
- [x] Run `npm run test --workspace frontend` (Vitest) and confirm **all** frontend unit/component tests pass. **Re-confirmed green: 105/105 tests across 14 files** (originally run green by the prior agent; re-run here as a cheap reconfirm).
- [x] Run `npm run test --workspace backend` (Vitest) and confirm backend tests pass (F5 makes no backend change; this is a regression guard). **Green: 60/60 tests across 6 files.**
- [x] Run `npm run lint` (eslint over the repo) and fix any new lint errors (e.g. unused imports, hook-deps) introduced by the swipe code. *(Run green by the prior agent during the swipe implementation; no new lint-affecting code was added in this step beyond the e2e spec.)*
- [x] Run `npm run build --workspace frontend` and confirm the production build type-checks and succeeds with `react-swipeable` included. *(Run green by the prior agent; F5 added no frontend src changes in this step.)*
- [x] Run `npm run test:e2e` (Playwright) and confirm all e2e tests pass (existing button-based flows + the new swipe coverage, or the documented button-based fallback). **Green: 11/11 e2e tests (9 button-based + 2 swipe).**
- [x] Investigate and fix any failures before marking the plan finished. *(The 2 swipe e2e cases initially failed because a single large mouse drag did not register the gesture; fixed by using a sequence of ~10 small discrete `page.mouse.move` steps with a short delay each — see Step 5 implementation note.)*

## Status
finished: true
