> **STATUS: Merged** `3a30a42` (#18). Frozen — historical record, do not edit.
> **Outcome:** Shipped as planned. `ChoreTimerBar` is now a single-row `grid grid-cols-3`
> (`h-20 sm:h-16`): chore name left, frequency centered, "last completed / X days ago" right.
> Standalone `✕` delete and `Overdue` badge removed (obsoleted by swipe + the bar-fill decay
> model in `choreBarMath.ts`); edit/delete kept as `sr-only` buttons for a11y. Step-by-step
> task list below is retained only for the "why" — see git for the actual diff.

# F6 — Reduce chore bar height / spread details across the bar

## Summary

Redesign `ChoreTimerBar` to be **shorter** by spreading its content **across the bar's
width** in a single horizontal row instead of left-stacking: chore **name on the left**,
**frequency centered**, and **last-completed date + "N days ago" on the far right**.
**Remove** the room display, the visible Overdue badge, and the visible `✕` delete /
pencil edit buttons from the bar — swipe-left (delete) and swipe-right (edit) from F5 are
now the primary affordances. Because swipe alone is keyboard/screen-reader-inaccessible
(an explicit F5→F6 forward obligation), the visible buttons are replaced by
**screen-reader-only (`sr-only`) accessible buttons** that preserve the `Delete chore` /
`Edit chore` affordances for assistive tech and keyboard users, and a **`sr-only`
"Overdue" cue** replaces the visible badge so color is not the sole overdue signal.
This is the **goal of the critical path** (F4→F2→F5→F6) and is frontend-only — **no
backend, API, or schema change.**

## Research Findings

Research was done **inline** (frontend-only, single-layer, ~6 component files + their
tests + one e2e spec — below the threshold for parallel subagents). Key discoveries that
shaped this plan:

- **Gesture binding lives on the bar's root `<div>` (F5).** `ChoreTimerBar.tsx:46-51`
  spreads `{...swipeHandlers}` **before** `data-testid="chore-bar"`, `className` (which
  contains `touch-pan-y` + `h-36 sm:h-24` + simulation classes) and `onClick={resetTask}`.
  The redesign **must keep `{...swipeHandlers}` first and retain `touch-pan-y`** — the swipe
  unit + e2e tests and tap-vs-swipe disambiguation depend on it. `swipingRef` /
  `resetTask` / the swipe handlers are unchanged by F6.
- **The `aria-label` selectors are load-bearing across the whole suite.** `Delete chore`
  and `Edit chore` are queried by role/aria-label in `ChoreTimerBar.test.tsx` (8 tests),
  `ChoreList.test.tsx` (4 assertions), `App.test.tsx` (~15 delete/edit-flow assertions),
  and `e2e/smoke.spec.ts` (cleanup loops + the button-based delete/edit tests). Keeping the
  buttons as `sr-only` (rather than deleting them outright) preserves accessibility **and**
  keeps these selectors stable — far less churn and a strictly better a11y outcome than
  removing them and rewriting every flow to swipe-only. **This is the central design
  decision** (see Step 4 + Design Decisions).
- **`OverdueBadge` has exactly two importers:** `ChoreTimerBar.tsx:10,57` (import + render)
  and `ChoreTimerBar.test.tsx` (transitively, via the rendered bar — it asserts the visible
  text "Overdue"). No other file imports it (`grep -rln OverdueBadge frontend/src`), so the
  file can be deleted once the render + import are removed. The 3 overdue tests assert
  `getByText('Overdue')` / `queryByText('Overdue')`; an `sr-only` "Overdue" span keeps those
  semantics (text present iff overdue) while removing the visible badge.
- **Room is displayed only in `ChoreInfo` (`{room} · Every {frequency} days`).** No test
  asserts room *text in the bar*; `chore.room` is still used elsewhere (`useRoomFilter`,
  fixtures) and is untouched. Removing the room display from the bar breaks no test.
- **e2e is self-contained and already swipes.** `playwright.config.ts` auto-starts both dev
  servers (`webServer`). `e2e/smoke.spec.ts` already has a working `swipeBar()` helper and
  passing swipe-left-delete / swipe-right-edit tests, so the real delete/edit UX is already
  exercised via swipe; the button-based tests become redundant or convert to swipe, and
  cleanup loops can `click({ force: true })` the `sr-only` delete button.

**Test commands** (from `frontend/package.json` / root `package.json`):
- Frontend unit (Vitest): `npm run test --workspace frontend`
- **Type-check (authoritative): `npx tsc --noEmit -p frontend/tsconfig.json`** — both
  `vite build` and Vitest transpile via esbuild and do **not** type-check, so `tsc --noEmit`
  is the only command that catches type errors.
- Lint: `npm run lint` (eslint; note `no-unused-vars` `varsIgnorePattern: '^[A-Z_]'` exempts
  PascalCase, so it will **not** flag a dangling `OverdueBadge`/`Pencil` import — use grep).
- Frontend build: `npm run build --workspace frontend` (`vite build`)
- e2e (Playwright, auto-starts servers): `npm run test:e2e`

## Design Decisions (RESOLVED — see reviews/bar-redesign-review.md)

1. **Accessible fallback for delete/edit = `sr-only focus:not-sr-only` buttons** *(RESOLVED,
   review DD-2).* The *visible* `✕`/pencil buttons are removed (satisfying the visual
   redesign + shorter bar); accessible buttons remain as `sr-only` **that reveal on keyboard
   focus** (`focus:not-sr-only`, meeting WCAG 2.4.7), providing keyboard + screen-reader
   access (satisfying the F5→F6 forward obligation that "swipe alone is not accessible").
   This reconciles the META-PLAN clauses ("buttons removed" vs "must add accessible
   fallback") and keeps the suite's `aria-label` selectors stable. *Alternative rejected:*
   delete the buttons entirely + keyboard handlers on the bar div — more churn, worse a11y
   semantics (a `div` is not a button), rewrites ~20 selector-based tests for no benefit.
2. **Overdue accessibility cue = `sr-only` "Overdue" span** *(RESOLVED — default).* Visible
   badge gone; bar fill/color is the visual signal; an `sr-only` "Overdue" span (rendered
   only when `isOverdue`) ensures color is **not** the sole signal and keeps the existing
   `getByText('Overdue')` test semantics.
3. **Layout = `grid grid-cols-3` (name left / frequency center / completion right), height
   `h-20 sm:h-16`, compact two-line completion** *(RESOLVED, review DD-1).* A 3-column grid
   **geometrically centers** the middle (frequency) column regardless of side-content width
   (flex `justify-between` would not). The completion column is compacted (the
   "Last Completed:" label becomes `sr-only`, leaving date + "N days ago") to avoid
   width-overflow at 375px. Height is shorter than `h-36 sm:h-24`; tunable if the two-line
   completion clips.
4. **e2e strategy** *(RESOLVED, review DD-3).* Keep the two existing swipe tests as primary
   delete/edit UX coverage; **convert** the button-based `deletes a chore` test to swipe-left
   (a second explicit named-chore removal assertion); convert `edits via the pencil button`
   to swipe-right **while preserving its full edit→Save→PUT round-trip assertion**; cleanup
   loops `click({ force: true })` the `sr-only` `[aria-label="Delete chore"]` button (force
   bypasses the `sr-only` visibility check). Documented in the spec header.

## Steps

> Ordering rationale: the layout reflow (1) lands the new structure and the `touch-pan-y`/
> swipe-handler invariant first; sub-component edits (2, 3, 5) then trim room/overdue/
> completion; the affordance swap (4) is isolated so the `aria-label` contract is changed in
> one place; e2e (6) and full verification (7) run last. Each step keeps the unit suite
> green before moving on.

### 1. Reflow `ChoreTimerBar` into a shorter, full-width single-row layout

Restructure the bar's root + content container while **preserving the F5 gesture
invariants** (swipe handlers first, `touch-pan-y` retained, `data-testid`/`onClick` intact).

**To-do:**
- [x] In `frontend/src/components/chore/ChoreTimerBar.tsx`, change the root `<div>`
  `className` height tokens from `h-36 sm:h-24` to **`h-20 sm:h-16`**, keeping every other
  class **and the exact order** intact: `relative h-20 sm:h-16 w-full bg-gray-800
  rounded-full shadow overflow-hidden touch-pan-y ${isSimulating ? 'cursor-not-allowed
  opacity-60 pointer-events-none' : 'cursor-pointer'}`. **Do not** reorder the props:
  `{...swipeHandlers}` must remain the **first** prop, before `data-testid="chore-bar"`,
  `className`, and `onClick={resetTask}`.
- [x] Replace the content container `<div className="absolute inset-0 px-4 pr-20 flex
  flex-col justify-center gap-1 sm:flex-row sm:items-center sm:justify-between sm:pr-4">`
  with a **3-column grid** spanning the full width (no `pr-20` reservation, since the visible
  button cluster is removed in Step 4) — **DD-1: a `grid grid-cols-3` geometrically centers
  the middle column regardless of side content** (flex `justify-between` would not):
  `<div className="absolute inset-0 px-4 grid grid-cols-3 items-center gap-2">`.
  The three columns, in order, are: the name zone (`ChoreInfo`, `text-left` — Step 2), the
  centered frequency zone (`text-center` — Step 2), and the completion zone (`CompletionInfo`,
  `text-right` — Step 5).
- [x] Keep `ProgressBar`, `computeBar`, `daysSince`, `swipingRef`, `swipeHandlers`,
  `resetTask`, and the `useSwipeable` config (`delta: 50`, `trackMouse: true`,
  `preventScrollOnSwipe: false`) **unchanged**.
- [x] **Leave the existing `{isOverdue && (<div ...><OverdueBadge /></div>)}` block and the
  current `<ChoreInfo name={chore.name} room={chore.room} frequency={chore.frequency} />`
  call unchanged inside the rewritten container during Step 1** — they are trimmed in
  Steps 3 and 2 respectively. (This keeps the unit suite + types green after Step 1:
  `ChoreInfoProps` is untouched until Step 2, so there is no mid-plan type-error window.)
- [x] Update `frontend/src/__tests__/components/ChoreTimerBar.test.tsx`:
  - [x] Keep the existing `applies the touch-pan-y class to the chore bar` test (must still
    pass — the invariant).
  - [x] Add a test `is shorter than the old fixed height` asserting
    `screen.getByTestId('chore-bar')` `toHaveClass('h-20')` and **not** `toHaveClass('h-36')`.
  - [x] Confirm the existing swipe tests (`swiped left`/`swiped right`/`suppresses trailing
    click`/`sub-threshold drag`/`does not fire while simulating`) and the tap-to-complete
    test still pass after the reflow (they query `chore-bar` by test id — unaffected).
- [x] **Verify (frontend unit):** `npm run test --workspace frontend` — `ChoreTimerBar`
  suite green.

### 2. Remove room display; render name (left) + frequency (centered)

`ChoreInfo` stops rendering room and becomes the name zone; frequency moves to its own
centered zone.

**To-do:**
- [x] In `frontend/src/components/chore/ChoreInfo.tsx`, change `ChoreInfoProps` from
  `{ name: string; room: string; frequency: number }` to **`{ name: string }`** and render
  only the name as the **left grid column**:
  `<div className="font-medium text-white truncate min-w-0 text-left">{name}</div>`
  (`min-w-0` is required so `truncate` works inside the grid column). Remove the
  room/frequency sub-`<div>` entirely. (Drop the old `flex-1` — sizing now comes from the
  grid column, not flex.)
- [x] In `ChoreTimerBar.tsx`, update the `<ChoreInfo .../>` usage to pass **only**
  `name={chore.name}` (drop `room` and `frequency` props).
- [x] Add the **centered frequency** element as the **middle grid column** in the
  `ChoreTimerBar` content grid, between the name and completion zones:
  `<div className="text-xs text-white text-opacity-80 text-center">Every {chore.frequency} days</div>`.
  (Inline rather than a new component — single small element, consistent with the existing
  inline style; a `FrequencyInfo` component is acceptable if review prefers it. With
  `grid-cols-3` the middle column is geometrically centered, so `text-center` centers the
  text within that centered column — no `shrink-0`/absolute positioning needed.)
- [x] Update `ChoreTimerBar.test.tsx`:
  - [x] Add a test `does not display the room on the bar`: render with
    `makeChore({ room: 'Kitchen' })` and assert `screen.queryByText('Kitchen')` is null and
    `screen.queryByText(/Kitchen ·/)` is null.
  - [x] Add a test `displays the frequency centered` asserting
    `screen.getByText('Every 7 days')` (use `makeChore({ frequency: 7 })`) is in the document.
  - [x] Confirm no existing test references `ChoreInfo`'s removed `room`/`frequency` props
    (none do; `ChoreInfo` has no dedicated test file).
- [x] **Verify (frontend unit + types):** `npm run test --workspace frontend` —
  `ChoreTimerBar` suite green; **then `npx tsc --noEmit -p frontend/tsconfig.json`** to catch
  any type error from the `ChoreInfoProps` change. (Both Vitest *and* `npm run build` =
  `vite build` transpile via esbuild and do **not** type-check; `tsc --noEmit` is the only
  thing that catches the `room`/`frequency` removal type error. It passes cleanly today.)

### 3. Remove the visible Overdue badge; add an `sr-only` overdue cue; delete `OverdueBadge`

The visible badge is removed and the component file deleted; a screen-reader-only cue keeps
overdue conveyed by more than color alone.

**To-do:**
- [x] In `ChoreTimerBar.tsx`, remove `import OverdueBadge from './OverdueBadge';` (line 10)
  and remove the conditional badge render block
  (`{isOverdue && (<div className="absolute top-2 right-20 sm:static sm:order-2"><OverdueBadge /></div>)}`).
- [x] In its place, add a screen-reader-only overdue cue inside the bar (e.g. immediately
  after the content row, still within the root `<div>`):
  `{isOverdue && <span className="sr-only">Overdue</span>}`. Keep `isOverdue` sourced from
  `computeBar(...)` (the bar fill color via `barColor` remains the visual signal).
- [x] **Note (no change needed):** `frontend/src/__tests__/App.test.tsx` (~lines 660/667,
  the "bar math recomputes against the simulated date" test) also asserts
  `queryByText(/overdue/i)` / `getByText(/overdue/i)`. These continue to pass against the
  `sr-only` span (RTL reads `textContent` regardless of visual hiding; `sr-only` is
  clip-based, **not** `display:none`/`aria-hidden`), and ChoreInfo dropping room/frequency
  means exactly one "Overdue" text node exists — no `getByText` ambiguity.
- [x] **Dead-import / dead-file cleanup:** delete `frontend/src/components/chore/OverdueBadge.tsx`
  (no remaining importers after the line above is removed — verify with
  `grep -rn "OverdueBadge" frontend/src` returning **only** test-name strings, then none after
  test updates). `isOverdue` is still consumed (the `sr-only` cue), so the `computeBar`
  import/destructure stays.
- [x] Update the 3 overdue tests in `ChoreTimerBar.test.tsx` (currently named
  `renders the OverdueBadge ...` / `does not render the OverdueBadge ...`):
  - [x] Rename to reflect the cue (e.g. `exposes an sr-only "Overdue" cue when overdue`,
    `has no overdue cue when not overdue`, `has no overdue cue at the exact-due-date boundary`).
  - [x] Keep the assertions `expect(screen.getByText('Overdue'))...` /
    `expect(screen.queryByText('Overdue')).not....` — they pass against the `sr-only` span.
- [x] **Verify (frontend unit + dead-import grep):** `npm run test --workspace frontend`;
  then `grep -rn "OverdueBadge" frontend/src` — must return **nothing**. (Note: neither
  `tsc` — no `noUnusedLocals` in tsconfig — nor eslint — `no-unused-vars` has
  `varsIgnorePattern: '^[A-Z_]'`, which exempts the PascalCase `OverdueBadge` — will flag a
  *dangling* `OverdueBadge` import. The explicit grep is the safety net, so the import MUST
  be removed by hand in this step alongside the render + file deletion.)

### 4. Replace the visible `✕`/pencil buttons with `sr-only` accessible buttons; resolve `TODO(#10)`

Remove the visible button cluster and the `lucide-react` `Pencil` icon; keep the
`Delete chore` / `Edit chore` affordances as `sr-only` buttons for keyboard/AT access.

**To-do:**
- [x] In `ChoreTimerBar.tsx`, remove the entire visible button-cluster `<div>`
  (`<div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-auto">...</div>`)
  containing the pencil and `✕` buttons, **and** remove the `import { Pencil } from 'lucide-react';`
  (line 4) — `Pencil` has no other use (dead-import protocol).
- [x] Add two `sr-only` buttons (keeping the exact `aria-label` strings and
  `e.stopPropagation()` so a bar tap is never also a delete/edit). `sr-only` is a **built-in
  Tailwind 4 core utility** (the project uses `tailwindcss ^4` via `@import "tailwindcss"`
  in `frontend/src/index.css`; no config needed — JIT emits it on use). Place the buttons as
  **direct children of the root `<div>`, as siblings of the content row** (after it), **not**
  nested inside any `aria-hidden`/`pointer-events-none` wrapper, so they stay in the
  accessibility tree and remain clickable. Keep **Edit before Delete** in DOM/source order
  (matches the prior visual order and any index-based `getAllByRole` assumptions; within a
  single bar there is one Edit + one Delete so index-based cross-bar tests in App.test are
  unaffected). Edit button is gated on `onEdit` (as today):
  **DD-2: use `sr-only focus:not-sr-only` so each button becomes visible + outlined when a
  keyboard user Tabs to it** (meets WCAG 2.4.7 focus-visible; mouse/screen-reader paths
  unchanged). The `focus:*` utilities pin the revealed button to the right edge (where the
  old cluster sat):
  ```tsx
  {onEdit && (
      <button
          type="button"
          className="sr-only focus:not-sr-only focus:absolute focus:right-12 focus:top-1/2 focus:-translate-y-1/2 focus:z-10 focus:px-3 focus:py-1 focus:bg-indigo-600 focus:text-white focus:text-sm focus:rounded-full"
          onClick={e => { e.stopPropagation(); onEdit(chore.id); }}
          aria-label="Edit chore"
      >
          Edit chore
      </button>
  )}
  <button
      type="button"
      className="sr-only focus:not-sr-only focus:absolute focus:right-3 focus:top-1/2 focus:-translate-y-1/2 focus:z-10 focus:px-3 focus:py-1 focus:bg-red-600 focus:text-white focus:text-sm focus:rounded-full"
      onClick={e => { e.stopPropagation(); onDelete(chore.id); }}
      aria-label="Delete chore"
  >
      Delete chore
  </button>
  ```
  (`focus:not-sr-only` is a built-in Tailwind 4 utility that reverses `sr-only` on focus; the
  `focus:absolute` + edge offsets keep the revealed buttons from disturbing the grid layout
  — `focus:absolute` anchors to the **root `relative` div**, which Step 1 preserves. Edit is
  offset further from the edge — `right-12` — so it does not overlap the Delete button when
  both are reachable.) **Tab-stop count per bar is unchanged from today** — the current
  visible cluster is also two real `<button>`s, so this is not a new keyboard-navigation
  cost, only a change in their visual presentation.
  These are **not** `isSimulating`-guarded (matching F4/F2 behavior: the buttons stay
  functional during simulation — see the existing `still calls onDelete ... in simulation
  mode` test).
- [x] Remove/replace the `TODO(#10)` comment
  (`{/* Swipe left = delete, swipe right = edit (F5). Interim ✕/pencil buttons retained until removed in F6 (#10). */}`)
  with a brief note that swipe is the primary affordance and the `sr-only` buttons are the
  keyboard/AT fallback. `grep -n "TODO(#10)" frontend/src` must return nothing afterward.
- [x] Confirm the unit suites still pass **unchanged** (the `aria-label` contract is
  preserved):
  - [x] `ChoreTimerBar.test.tsx`: the 6 delete/edit-button tests (lines 17-114) +
    `still calls onDelete ... in simulation mode` (line 154) query by
    `getByRole('button', { name: 'Delete chore' / 'Edit chore' })` — still resolve to the
    `sr-only` buttons.
  - [x] `ChoreList.test.tsx`: the 4 `Delete chore`/`Edit chore` assertions — unchanged.
  - [x] `App.test.tsx`: the ~15 delete/edit-flow assertions (lines 95-168, 250-340, 460) —
    unchanged.
- [x] **Verify (frontend unit + types + dead-import grep):** `npm run test --workspace
  frontend` (full run — `App`, `ChoreList`, `ChoreTimerBar` all green);
  `npx tsc --noEmit -p frontend/tsconfig.json` (type-check — confirms the removed button-
  cluster JSX left no type error); then `grep -n "Pencil\|lucide-react" frontend/src/components/chore/ChoreTimerBar.tsx`
  must return **nothing**. (As with `OverdueBadge`, the PascalCase `Pencil` import is exempt
  from eslint's `no-unused-vars` `varsIgnorePattern: '^[A-Z_]'` and is not flagged by `tsc`
  either, so it must be removed by hand in this step; the grep is the safety net.)

### 5. Compact `CompletionInfo` for the right zone

Keep last-completed date + "N days ago" but make it compact and right-aligned for the new
single-row layout.

**To-do:**
- [x] In `frontend/src/components/chore/CompletionInfo.tsx`, keep `CompletionInfoProps`
  `{ date: Date; daysSince: number }`. Tighten + **compact** the markup for the right grid
  column (DD-1: shorten to avoid width-overflow on a 375px phone). Wrap in
  `<div className="text-white text-right text-xs min-w-0">`. **Make the "Last Completed:"
  label `sr-only`** (`<span className="sr-only">Last Completed: </span>`) — it remains
  announced to screen readers but no longer consumes a visible line — then render
  `{date.toDateString()}` and the
  `{daysSince} {daysSince === 1 ? 'day' : 'days'} ago` line (the existing `day`/`days`
  pluralization is relied on by `ChoreTimerBar.test`'s `1 day ago` assertion — **preserve
  it**). The visible right column is thus two lines (date + "N days ago"), fitting the
  shorter bar.
- [x] Confirm `ChoreTimerBar.test.tsx`'s `updates displayed date ... ('1 day ago')` test
  (line 116) still passes (the "N days ago" text must remain).
- [x] **Verify (frontend unit):** `npm run test --workspace frontend` — `ChoreTimerBar`
  suite green.

### 6. Update `e2e/smoke.spec.ts` for the new affordances

Make swipe the primary delete/edit coverage; convert redundant button tests; keep cleanup
working against the `sr-only` delete button.

**To-do:**
- [x] Add a short comment at the top of the `describe` block documenting the chosen e2e
  strategy: "F6 removed the visible ✕/pencil buttons; delete/edit are exercised via swipe
  (primary UX). Cleanup force-clicks the sr-only `[aria-label="Delete chore"]` button."
- [x] **DD-3: Convert** the `deletes a chore and it disappears from the list` test
  (lines 68-86) to swipe-left (keep it as a second explicit named-chore removal assertion):
  after seeding `E2E Delete Target`, replace the `[aria-label="Delete chore"]` click with
  `await swipeBar(page, targetChore, 'left');` then `page.getByTestId('confirm-dialog-confirm').click()`
  and assert the chore disappears.
- [x] Convert the `edits a chore via the pencil button` test (lines 88-131) to
  `edits a chore via swipe-right`: replace `bar.locator('[aria-label="Edit chore"]').click()`
  with `await swipeBar(page, bar, 'right');`, then **keep** the remaining assertions intact —
  modal pre-filled (`input[name="name"]` has value `E2E Edit Target`), edit to `E2E Edited`,
  click Save, **await the PUT response** (`r.request().method() === 'PUT'`), assert
  `E2E Edited` visible and the modal closed. This preserves the only full edit→Save→PUT
  round-trip e2e assertion.
- [x] In every cleanup loop that clicks `[aria-label="Delete chore"]` (the `adds a new chore`
  test ~line 60, the `edits` test ~line 125, the `swipe-right` test ~line 209), bypass the
  `sr-only` visibility check. **DEVIATION (verified):** `.click({ force: true })` does NOT
  fire the handler — the `sr-only` button is clipped to a 1px box so even a forced click
  lands on overlaying grid/progress siblings (confirmed via a throwaway probe:
  force-click → dialog never opens; `dispatchEvent('click')` → dialog opens). Used
  **`.dispatchEvent('click')`** instead, which invokes the React `onClick` directly
  regardless of geometry/visibility. Kept the `[aria-label="Delete chore"]` selector and the
  subsequent `confirm-dialog-confirm` click. Header comment updated to describe the
  `dispatchEvent` mechanism.
- [x] Leave the existing `swipe-left ...` and `swipe-right ...` tests (lines 161-215) as-is
  (their `swipeBar` start at `box.width * 0.4` still works; the right-edge cluster they
  avoided is gone, but the helper is unaffected). Optionally simplify the helper's
  "avoids the ✕/pencil cluster" comment. (Simplified the comment.)
- [x] Confirm no remaining e2e reference to a *visible* `✕`/pencil affordance assumes
  visibility: `grep -n "aria-label=\"Edit chore\"" e2e/smoke.spec.ts` should return nothing
  after the edit test is converted; `[aria-label="Delete chore"]` remains **only** inside
  cleanup calls (now `dispatchEvent('click')`) and the header comment.
- [x] **Confirm whole-bar-click tests are unaffected** by the removed right-edge button
  cluster (the `pr-20`/`pr-4` padding reservation is gone): the `shows error and rolls back
  on simulated backend failure` (line ~217) and `navigates forward and back in time` (line
  ~241) tests click `.bg-gray-800.rounded-full` directly (not the buttons) — no change
  needed; verified they still pass.
- [x] **Verify (e2e):** `npm run test:e2e` — all 11 tests pass (run twice for stability;
  zero E2E debris left in the DB afterward). Playwright auto-starts the dev servers.

### 7. Verify All Tests Pass

Run the full suites to confirm nothing is broken.

**To-do:**
- [x] Run `npm run test --workspace frontend` (Vitest) and confirm **all** frontend unit
  tests pass (`App`, `ChoreList`, `ChoreTimerBar`, `ProgressBar`, services, hooks, utils).
- [x] Run `npx tsc --noEmit -p frontend/tsconfig.json` and confirm **no type errors** (this
  is the authoritative type-check — `vite build` and Vitest both use esbuild and skip it).
- [x] Run `npm run lint` and confirm no lint errors. **Note:** eslint's `no-unused-vars`
  uses `varsIgnorePattern: '^[A-Z_]'`, so a dangling PascalCase import (`OverdueBadge`,
  `Pencil`) is **not** flagged by lint — rely on the explicit grep checks below, not lint,
  to confirm those imports are gone.
- [x] Run `npm run build --workspace frontend` and confirm the production build succeeds
  (`vite build` — bundling/transform only; type-safety is covered by the `tsc --noEmit` above).
- [x] Run `npm run test:e2e` (Playwright auto-starts the dev servers) and confirm all e2e
  tests pass, including the converted swipe-based delete/edit tests and the `force`-clicked
  cleanup loops.
- [ ] **Manual visual check (reflow):** `npm run dev` and view the app at a 375px-wide
  viewport — confirm the 3-column bar (name left / frequency center / completion right) does
  **not** clip and the two-line completion column fits the shorter height; if it clips, bump
  the height token (`h-20 sm:h-16` → e.g. `h-24 sm:h-20`) per DD-1's tunable-height note.
- [x] Investigate and fix any failures before marking the plan finished.
- [x] **Repo-checkable end-state facts (META-PLAN F6):**
  - [x] `grep -n "h-36\|h-24" frontend/src/components/chore/ChoreTimerBar.tsx` → none (bar is shorter).
  - [x] `grep -rn "OverdueBadge" frontend/src` → none; `OverdueBadge.tsx` deleted.
  - [x] `grep -n "Pencil\|lucide-react" frontend/src/components/chore/ChoreTimerBar.tsx` → none.
  - [x] `grep -n "TODO(#10)" frontend/src` → none.
  - [x] Room no longer rendered in the bar; `aria-label="Delete chore"` / `aria-label="Edit chore"`
    still present (as `sr-only` buttons); swipe-left=delete-confirm and swipe-right=edit still work.

## Status
finished: true
