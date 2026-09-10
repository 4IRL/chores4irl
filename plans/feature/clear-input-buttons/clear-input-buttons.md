# F14 — Clear-✕ affordance on every free-text input

## Summary

Add a single-click "✕" clear affordance to every free-text input that currently has none:
the persistent chore-search bar (`ChoreSearchInput`), and the Add/Edit chore form's Name
and Room fields. The "✕" appears only once the field has content and empties it on click.
`FormField`'s new clear-affordance is an **opt-in** `clearable` prop (default `false`) so
the Details field — which also renders via `FormField` and is slated for removal by `F4` —
never renders a clear button and its layout/behavior stays unchanged (it does pick up a
new, invisible wrapping `<div>` from Step 3's markup change, common to every `FormField`
instance, but that has no visual or behavioral effect). Purely a frontend, presentational
change: no backend/schema/API impact.

## Research Findings

- All three target components are **fully controlled** (`value`/`onChange` from the
  parent) with **no internal state** — `ChoreSearchInput` calls `onChange(value)`,
  `FormField` calls `onChange(name, value)`, and the Room field calls
  `handleFieldChange('room', value)` directly. Clearing is therefore just invoking the
  existing callback with `''`; no new state plumbing is needed in `App.tsx` or
  `ChoreForm.tsx`.
- `FormField` has exactly **one caller** (`ChoreForm.tsx`, 5 call sites: `name`, `details`,
  `dateLastCompleted`, `duration`, `frequency`) and `ChoreSearchInput` has exactly **one
  caller** (`App.tsx:333`) — both fully verified via repo-wide grep. The change is
  entirely contained to the three target files plus one new shared subcomponent; no
  `ChoreFormModal`/`App.tsx` prop-shape changes are needed.
- The Room field in `ChoreForm.tsx` (lines 78–95) is a **hand-rolled** `<input list="room-options">` +
  `<datalist>` block, **not** a `FormField` instance (it needs the datalist, which
  `FormField` doesn't support) — its clear-✕ must be wired directly in `ChoreForm.tsx`,
  not via the `FormField` prop.
- No interactive clear/close icon exists anywhere in the codebase yet. The closest
  precedent for a persistently-visible interactive icon button is
  `DateNavigationBanner.tsx`'s Previous/Next-day buttons: `<button aria-label="...">` +
  `hover:bg-gray-700 rounded-full` + a `lucide-react` icon with `aria-hidden="true"`.
  `lucide-react@^1.8.0` (already a dependency; `X` icon available) matches the icon
  library already used by `DateNavigationBanner.tsx` and `ChoreTimerBar.tsx` in this
  repo, and is the user's standing global convention for icon choices (preferred over
  hand-rolled SVGs).
- `ChoreSearchInput`'s decorative `Search` icon uses `absolute left-3 top-1/2
  -translate-y-1/2` inside a `relative`-wrapped input, with `pl-9` reserving space on the
  input. The new clear-✕ mirrors this on the right (`right-3` / `pr-14` — widened from a
  symmetric `pr-9` per DD-1 of the plan review, since the button's 44px touch target is
  larger than the decorative search icon it mirrors).
- Existing test coverage: `ChoreSearchInput.test.tsx`, `ChoreForm.test.tsx`,
  `App.search.test.tsx` (the `describe('chore-name search filter (F9)', ...)` block — the
  direct precedent for App-level clear-behavior assertions, already using
  `user.clear(input)` + `renderedNames()`/`waitFor`). `FormField.tsx` has **no** dedicated
  test file today. Vitest 4 + jsdom + React Testing Library + `user-event`; run via
  `npm run test --workspace frontend` (`vitest run`, no watch) — this is the actual
  command exercising this feature's layer (the skill-config's `test_run_cmd`/
  `ui_runner_cmd` point at Playwright only, which is used here for e2e regression, not as
  the primary check).

## Steps

### 1. Shared `ClearButton` component (TDD)

A small reusable presentational component avoids duplicating the icon-button markup
across three call sites and gives the affordance one place to test and adjust styling.

**To-do:**
- [x] **Red.** Create `frontend/src/__tests__/components/ClearButton.test.tsx`. Render
  `<ClearButton label="Clear Search" onClear={vi.fn()} />` and assert: (1) a
  `screen.getByRole('button', { name: 'Clear Search' })` exists; (2) it has
  `type="button"` (`button.type === 'button'`, so a click inside a `<form>` never
  submits); (3) the rendered icon carries lucide's auto-generated class
  (`container.querySelector('svg.lucide-x')`) and `aria-hidden="true"`; (4)
  `user.click(button)` (via `@testing-library/user-event`) calls the `onClear` spy
  exactly once with no arguments; (5) the button's `className` contains `min-w-[44px]`
  and `min-h-[44px]` (a `toContain` assertion on `button.className`, mirroring
  `AddChoreButton.test.tsx`'s existing className-assertion style — jsdom doesn't compute
  real layout, so this is the closest this test suite can get to guarding the touch-target
  size decided in DD-1 of the plan review); (6) rendered with no `anchor` prop, the
  `className` contains `top-1/2` and `-translate-y-1/2` (vertically centered — the default,
  correct for `ChoreSearchInput`, which has no label above it); (7) rendered with
  `anchor="top"`, the `className` contains `top-0` and does **not** contain `top-1/2` or
  `-translate-y-1/2` (per DD-5 of the plan review: `FormField`/Room anchor the button to
  the input's top edge instead of centering it, so the 44px box's ~8px of unavoidable
  overflow — it's taller than the ~36px input — extends only downward into the gap between
  form fields, never upward into the 4px label–input gap). Run `cd frontend && npx vitest
  run src/__tests__/components/ClearButton.test.tsx` and confirm it fails (module doesn't
  exist yet).
- [x] **Green.** Create `frontend/src/components/common/ClearButton.tsx`:
  ```tsx
  import { X } from 'lucide-react';

  type ClearButtonProps = {
      label: string;
      onClear: () => void;
      anchor?: 'center' | 'top';
  };

  export default function ClearButton({ label, onClear, anchor = 'center' }: ClearButtonProps) {
      return (
          <button
              type="button"
              onClick={() => onClear()}
              aria-label={label}
              className={`absolute right-3 min-w-[44px] min-h-[44px] p-1 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center ${anchor === 'top' ? 'top-0' : 'top-1/2 -translate-y-1/2'}`}
          >
              <X className="w-4 h-4" aria-hidden="true" />
          </button>
      );
  }
  ```
  The `min-w-[44px] min-h-[44px]` gives the button a 44×44px minimum tap target (matching
  `DateNavigationBanner.tsx`'s touch-target convention for icon-only buttons — this app
  targets a Pi touchscreen kiosk) while the visible icon stays small (`w-4 h-4`, centered
  via `flex items-center justify-center`); only the invisible hit area grows. Because the
  box is now wider than the visible icon, the three call sites (Steps 2–4) must reserve
  more horizontal space than before — see their updated `pr-*` values. The new `anchor`
  prop (default `'center'`) resolves DD-5: `ChoreSearchInput` (Step 2) uses the default —
  it has no label above it, so vertical centering is safe and visually nicest; `FormField`
  (Step 3) and the Room field (Step 4) pass `anchor="top"`, since their 44px-tall button
  would otherwise overflow evenly above and below their ~36px input, eating into the 4px
  label–input gap above — anchoring to `top-0` instead confines all the overflow (8px:
  44px button − 36px input) to below the input, into the 12px inter-field `gap-3`, leaving
  ~4px of clearance before the next field's label. That clearance is positive (no overlap),
  but thin — documented here as an accepted trade-off of DD-5, not covered by any test,
  since jsdom doesn't compute real layout. Re-run the test
  file and confirm it passes.
- [x] **Refactor.** Confirm the className matches house style
  (`DateNavigationBanner.tsx`'s `hover:bg-gray-700 rounded-full` icon-button pattern;
  `text-gray-400`/`hover:text-white` matching `ChoreSearchInput`'s `Search` icon color;
  `min-w-[44px] min-h-[44px]` matching its touch-target sizing). No logic changes
  expected.

**Verification:** `cd frontend && npx vitest run src/__tests__/components/ClearButton.test.tsx` (frontend unit test — this component has no backend/route surface).

### 2. `ChoreSearchInput` clear-✕

Wire the shared button into the search bar, the simplest of the three call sites (no form, no sibling fields).

**To-do:**
- [x] **Red.** Extend `frontend/src/__tests__/components/ChoreSearchInput.test.tsx` with three
  tests: (1) "does not render a clear button when value is empty" — render with `value=""`,
  assert `screen.queryByRole('button', { name: 'Clear Search' })` is `null`; (2) "renders
  a clear button when non-empty and clears on click" — render with `value="abc"` and an
  `onChange` spy, assert `screen.getByRole('button', { name: 'Clear Search' })` exists,
  `user.click(...)` it, assert the spy was called with `''`; (3) "clicking clear returns
  focus to the search input" — render with `value="abc"`, click the clear button, assert
  `screen.getByPlaceholderText('Search for a chore')` `toHaveFocus()` (per DD-2 of the plan
  review: clicking Clear should return focus to the field so the user can keep typing,
  since the button itself unmounts once the value is cleared). Run `cd frontend && npx
  vitest run src/__tests__/components/ChoreSearchInput.test.tsx` and confirm two of the
  three new assertions fail: tests (2) and (3) genuinely fail because `getByRole('button',
  { name: 'Clear Search' })` finds nothing pre-Green; test (1) ("does not render a clear
  button when value is empty") passes trivially both before and after Green, since the
  current code never renders any clear button regardless of value — it's a forward-looking
  regression guard, not a discriminating red assertion (mirroring Step 3's tests (1)/(2)).
- [x] **Green.** Edit `frontend/src/components/chore/ChoreSearchInput.tsx`: add `import { useRef }
  from 'react';` and `import ClearButton from
  '../common/ClearButton';` (this file currently has no import from `'react'` to extend).
  Add `const inputRef = useRef<HTMLInputElement>(null);` inside
  the component and `ref={inputRef}` on the `<input>`. Change the input's className from
  `"w-full bg-gray-800 text-white placeholder-gray-400 rounded-lg border border-gray-700
  pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-gray-500"` to the same string
  with `pr-3` replaced by `pr-14` (reserves space for `ClearButton`'s wider 44px tap
  target from DD-1 — `right-3` (12px) + `min-w-[44px]` = 56px = `pr-14`, so the invisible
  hit area never overlaps typed text, and reserving it unconditionally avoids a layout
  shift when the button appears/disappears). Immediately after the `<input>` element,
  still inside the existing `<div className="relative">` wrapper, add:
  `{value !== '' && <ClearButton label="Clear Search" onClear={() => { onChange('');
  inputRef.current?.focus(); }} />}`. Re-run the test file and confirm it passes.
- [x] **Refactor.** None expected.

**Verification:** `cd frontend && npx vitest run src/__tests__/components/ChoreSearchInput.test.tsx`.

### 3. `FormField`'s opt-in `clearable` prop

Add the prop `FormField` needs for the Name field, defaulted off so the other four call sites (`details`, `dateLastCompleted`, `duration`, `frequency`) are unaffected without each needing a change.

**To-do:**
- [ ] **Red.** Create `frontend/src/__tests__/components/FormField.test.tsx` (new file;
  none exists today). Tests: (1) "no clear button when `clearable` is omitted" — render
  `<FormField name="name" label="Name" value="abc" onChange={vi.fn()} />` (no `clearable`
  prop), assert `screen.queryByRole('button', { name: 'Clear Name' })` is `null`; (2) "no
  clear button when `clearable` is true but value is empty" — same with `clearable value=""`,
  assert still `null`; (3) "clear button renders and clears when `clearable` and non-empty" —
  render `<FormField name="name" label="Name" value="abc" onChange={onChange} clearable />`,
  assert `screen.getByRole('button', { name: 'Clear Name' })` exists, `user.click(...)` it,
  assert `onChange` was called with `('name', '')`; also assert `button.className` contains
  `top-0` and does **not** contain `top-1/2` (per DD-5 of the plan review: this is the one
  integration point the whole fix depends on — `FormField` must actually pass
  `anchor="top"` through to `ClearButton`, not just declare it in prose; without this
  assertion, a future edit that silently drops `anchor="top"` would fall back to
  `ClearButton`'s default centered anchoring and reintroduce the label-overlap collision
  DD-5 fixed, with no test anywhere catching it); (4) "clicking clear returns focus to
  the field" — render `<FormField name="name" label="Name" value="abc" onChange={vi.fn()}
  clearable />`, click the clear button, assert `screen.getByLabelText('Name')`
  `toHaveFocus()` (per DD-2 of the plan review). Run `cd frontend && npx vitest run
  src/__tests__/components/FormField.test.tsx` and confirm it fails: tests (1) and (2)
  pass trivially even before Green (no clear button ever renders in the current code,
  regardless of props — they're forward-looking regression guards, not discriminating red
  assertions), but tests (3) and (4) genuinely fail because `getByRole('button', { name:
  'Clear Name' })` finds nothing, since `clearable` is a no-op prop pre-Green. (This
  repo's `vitest run`/`vite build` pipeline transforms `.tsx` via esbuild and does not
  type-check, so passing the not-yet-declared `clearable` prop produces no TypeScript
  error here — the runtime `getByRole` assertions are the only red signal, and they're
  sufficient.)
- [ ] **Green.** Edit `frontend/src/components/form/FormField.tsx`: add `clearable?:
  boolean;` to `FormFieldProps` and `clearable = false` to the destructured parameters.
  Add `import { useRef } from 'react';` and `import ClearButton from
  '../common/ClearButton';`. Add `const inputRef = useRef<HTMLInputElement>(null);` inside
  the component and `ref={inputRef}` on the `<input>`. Wrap the existing `<input>` in a
  `<div className="relative">` (the input's own className changes from `"bg-gray-700
  text-white rounded px-3 py-2 text-sm"` to `` `bg-gray-700 text-white rounded px-3 py-2 text-sm w-full ${clearable ? 'pr-14' : ''}` `` —
  `w-full` is required because the input is no longer a direct flex child of the
  `flex flex-col gap-1` wrapper, so it no longer auto-stretches via `align-items: stretch`;
  `pr-14` (56px = `right-3`'s 12px + `ClearButton`'s `min-w-[44px]` from DD-1) is applied
  whenever `clearable` so the reserved space doesn't shift layout as the button
  appears/disappears and never overlaps typed text). After the `<input>`, still inside the
  new `relative` div, add: `{clearable && value !== '' && <ClearButton label={`Clear
  ${label}`} onClear={() => { onChange(name, ''); inputRef.current?.focus(); }}
  anchor="top" />}` (per DD-5: anchors the button to the input's top edge rather than
  centering it, so its 44px height overflows only downward, not into the 4px label–input
  gap above). Re-run the test file and confirm it passes; also run
  `cd frontend && npx vitest run src/__tests__/components/ChoreForm.test.tsx` to confirm
  the pre-existing Details/dateLastCompleted/duration/frequency assertions (which use
  `getByLabelText`, unaffected by the new wrapper div) still pass unchanged.
- [ ] **Refactor.** None expected. **Decision:** `FormField`
  does **not** internally gate `clearable` on `type === 'text'` — it trusts callers, since
  only the Name call site will ever pass `clearable={true}` (see Step 4) and no
  `clearable` + non-text usage is planned. Add a one-line comment above the `clearable`
  prop in `FormFieldProps` noting it's intended for text-like fields only, so a future
  caller adding `clearable` to a number/date field notices the constraint.

**Verification:** `cd frontend && npx vitest run src/__tests__/components/FormField.test.tsx src/__tests__/components/ChoreForm.test.tsx`.

### 4. Wire Name + Room clear-✕ in `ChoreForm`, guard Details

Turn on `clearable` for the Name field, hand-wire the Room field (not a `FormField`
instance), and add a regression test proving Details never gets a clear button.

**To-do:**
- [x] **Red.** Extend `frontend/src/__tests__/components/ChoreForm.test.tsx` with five
  tests: (1) "Name field shows a clear-✕ once typed and clears only Name on click" —
  render `ChoreForm` (add mode is sufficient), `user.type(screen.getByLabelText('Name'),
  'Sweep')`, also type something into Room (e.g. `user.type(screen.getByLabelText('Room'),
  'Kitchen')`) so cross-field isolation is checkable, assert
  `screen.getByRole('button', { name: 'Clear Name' })` exists, that its `className`
  contains `top-0` and does **not** contain `top-1/2` (per DD-5: confirms `FormField`
  actually threads `anchor="top"` through to `ClearButton` for the Name field — the same
  rationale as Step 3's test (3), re-checked here at the `ChoreForm` integration layer),
  click it, assert `screen.getByLabelText('Name')` now has value `''` while
  `screen.getByLabelText('Room')` still has value `'Kitchen'`, and that the
  `onSubmit`/`onCancel` spies passed to `ChoreForm` were **not** called (proves the click
  didn't submit or close the form); (2) "Room field shows a clear-✕ once typed and clears
  only Room on click" — mirror image, typing into Room and Name, asserting
  `getByRole('button', { name: 'Clear Room' })`'s `className` also contains `top-0` and
  not `top-1/2` (confirms the hand-wired Room `<ClearButton>` in `ChoreForm.tsx` itself
  passes `anchor="top"`, independently of `FormField`'s own wiring), clicking it, asserting
  Room empties and Name is untouched, `onSubmit`/`onCancel` not called; (3)
  "Details field never renders a clear-✕" — `user.type(screen.getByLabelText('Details'),
  'some notes')`, assert `screen.queryByRole('button', { name: 'Clear Details' })` is
  `null` regardless of content; (4) "clear-✕ is present immediately on mount in edit mode,
  with no typing" — render `ChoreForm` with `mode="edit"` and an `initialChore` (via the
  `makeChore` fixture) whose `name`/`room` are non-empty, and assert
  `screen.getByRole('button', { name: 'Clear Name' })` and `screen.getByRole('button', {
  name: 'Clear Room' })` both exist without calling `user.type` first — the button's
  visibility is a derived render (`clearable && value !== ''`), identical on first mount
  and on every re-render, so a pre-populated edit-mode field must show it immediately;
  (5) "clicking clear returns focus to the Room field" — type into Room, click
  `getByRole('button', { name: 'Clear Room' })`, assert `screen.getByLabelText('Room')`
  `toHaveFocus()` (per DD-2 of the plan review; Name's own refocus behavior is already
  covered by Step 3's `FormField.test.tsx`, since `ChoreForm` just passes `clearable`
  through — no separate Name-refocus test is needed here). Run `cd frontend && npx vitest
  run src/__tests__/components/ChoreForm.test.tsx` and confirm four of the five new tests
  genuinely fail: tests (1), (2), (4), and (5) each assert a clear button that does not
  exist pre-Green (`getByRole('button', { name: ... })` finds nothing); test (3) ("Details
  field never renders a clear-✕") passes trivially both before and after Green, since
  Details is never touched by this plan — it's a forward-looking regression guard, not a
  discriminating red assertion (mirroring Step 3's tests (1)/(2)).
- [x] **Green.** Edit `frontend/src/components/form/ChoreForm.tsx`: extend the existing
  `import { useState } from 'react';` to `import { useState, useRef } from 'react';` and
  add `import ClearButton from '../common/ClearButton';`. On the Name
  `FormField` call (currently line 76), add the `clearable` prop: `<FormField name="name"
  label="Name" value={formData.name} onChange={handleFieldChange} required autoFocus
  clearable />`. Leave the `details` (line 77), `dateLastCompleted`/`duration`/`frequency`
  (lines 96–98) `FormField` calls **unchanged** — do not add `clearable` to any of them.
  In the Room block (lines 78–95): add `const roomInputRef = useRef<HTMLInputElement>(null);`
  inside the component and `ref={roomInputRef}` on the Room `<input>`; wrap the `<input>`
  in a new `<div className="relative">` nested inside the existing `<div className="flex
  flex-col gap-1">` (so the `<label>` stays a sibling of the new wrapper, not a child of
  it); change the input's className from `"bg-gray-700 text-white rounded px-3 py-2
  text-sm"` to `"bg-gray-700 text-white rounded px-3 py-2 text-sm w-full pr-14"` (`pr-14` =
  56px = `right-3`'s 12px + `ClearButton`'s `min-w-[44px]` from DD-1; Room's clear-✕ is
  unconditional on this field, unlike the opt-in `FormField` prop, so the padding
  reservation is unconditional too). The `<ClearButton>` itself **must** be placed inside
  the new `relative` div, as a sibling of the `<input>` — same rule as Steps 2 and 3 —
  because its `absolute right-3` positioning resolves against the nearest positioned
  ancestor; placing it outside that div (e.g. as a sibling of the div rather than inside
  it) would position it against a non-positioned ancestor and visually misplace it, with
  no test in this plan able to catch that (jsdom doesn't compute layout). The `<datalist>`
  has no such constraint — it renders no visible box, so it may stay inside the `relative`
  div or move out as a sibling of it, whichever keeps the diff smallest. Add, inside the
  `relative` div after the `<input>`:
  `{formData.room !== '' && <ClearButton label="Clear Room" onClear={() => {
  handleFieldChange('room', ''); roomInputRef.current?.focus(); }} anchor="top" />}` (per
  DD-5: same top-anchoring as `FormField`'s Name field, since Room shares the identical
  `flex flex-col gap-1` label-spacing pattern). Re-run the test
  file and confirm all tests (existing + new) pass.
- [x] **Refactor.** None expected.

**Verification:** `cd frontend && npx vitest run src/__tests__/components/ChoreForm.test.tsx`.

### 5. App-level integration check for the search-bar clear-✕

Confirm, at the `App.tsx` integration level, that clicking the new button (not just
manually clearing the input) restores the room-filtered list — mirroring the existing
`F9` search-filter suite's manual-clear test. `App.tsx` itself needs **no** code changes
(`ChoreSearchInput` is already fully wired via `value={searchQuery}
onChange={setSearchQuery}`); this step is a regression/integration test only.

**To-do:**
- [ ] Add a test inside `frontend/src/__tests__/App.search.test.tsx`'s `describe('chore-name
  search filter (F9)', ...)` block (immediately alongside the existing "clearing the query
  restores the room-filtered list" test, which uses `user.clear(input)`): type a query into
  `screen.getByPlaceholderText('Search for a chore')`, `await waitFor(...)` for the filtered
  list (reuse the file's existing `renderedNames()` helper), then click
  `screen.getByRole('button', { name: 'Clear Search' })` instead of calling `user.clear`,
  and assert the search input is now empty (`toHaveValue('')`) and the room-filtered
  (unsearched) list is restored, same as the existing manual-clear test's assertion. Run
  `cd frontend && npx vitest run src/__tests__/App.search.test.tsx` and confirm it passes
  (Steps 1–2 already implemented the underlying button; this step's value is the
  App-level regression guard, not new production code).

**Verification:** `cd frontend && npx vitest run src/__tests__/App.search.test.tsx`.

### 6. Verify All Tests Pass

Run the full test suites to confirm nothing is broken.

**To-do:**
- [ ] Run `cd frontend && npm test` (full Vitest suite, `vitest run`) and confirm every
  test passes, including all files touched/added above.
- [ ] Run `npx playwright test` from the repo root (`e2e/smoke.spec.ts`) and confirm it
  still passes — F14 doesn't change the Add Task flow's structure, but the Name field now
  conditionally renders an extra button once typed; confirm this doesn't interfere with
  the smoke test's existing `+ Add Task` flow or the seeded `Vacuum Bedroom Floor` chore.
- [ ] Investigate and fix any failures before marking the plan finished.

## Progress Tracking

- [x] **Step 1: Shared `ClearButton` component (TDD)** - COMPLETE (2026-09-10)
  - ✅ Red: `frontend/src/__tests__/components/ClearButton.test.tsx` created, confirmed failing (module not found)
  - ✅ Green: `frontend/src/components/common/ClearButton.tsx` created, all 7 tests pass
  - ✅ Refactor: className confirmed matching house style (`DateNavigationBanner.tsx` icon-button pattern, `ChoreSearchInput`'s icon color) — no changes needed
  - ✅ Subagent review pipeline: Correctness & Codebase Fit PASS, Quality & Completeness PASS; Security & Edge Cases raised 1 minor finding (empty `label` would strip `aria-label`) — fixed with a documenting JSDoc comment on the `label` prop, re-validated (7/7 tests pass)
- [x] **Step 2: `ChoreSearchInput` clear-✕** - COMPLETE (2026-09-10)
  - ✅ Red: `frontend/src/__tests__/components/ChoreSearchInput.test.tsx` extended with 3 tests, confirmed 2/3 failing pre-Green (empty-value test passed trivially as a forward-looking guard)
  - ✅ Green: `frontend/src/components/chore/ChoreSearchInput.tsx` wired with `useRef`, `ClearButton` (default `anchor="center"`), `pr-3`→`pr-14`; all 7 tests pass
  - ✅ Refactor: implementation matches plan's spec exactly — no changes needed
  - ✅ Subagent review pipeline: Correctness & Codebase Fit PASS, Security & Edge Cases PASS, Quality & Completeness PASS — no findings, no fixes needed
  - ✅ Full frontend suite re-verified: 242/242 tests passing (28 files)
- [x] **Step 3: `FormField`'s opt-in `clearable` prop** - COMPLETE (2026-09-10)
  - ✅ Red: `frontend/src/__tests__/components/FormField.test.tsx` created (new file, 4 tests), confirmed 2/4 failing pre-Green (the two omitted/empty-value tests passed trivially as forward-looking guards, matching plan expectation)
  - ✅ Green: `frontend/src/components/form/FormField.tsx` edited — added `clearable?: boolean` (default `false`) with a documenting comment scoping it to text-like fields, wrapped `<input>` in `<div className="relative">` with `w-full` added to the input, wired `ClearButton` with `anchor="top"`; all 4 new tests pass plus pre-existing `ChoreForm.test.tsx` assertions unaffected (11/11 across both files)
  - ✅ Refactor: className/pattern confirmed matching house style; the plan's required documenting comment on the `clearable` prop was added as part of Green (no separate change needed)
  - ✅ Subagent review pipeline: Security & Edge Cases PASS, Quality & Completeness PASS (verified via vitest/tsc/eslint); Correctness & Codebase Fit raised 1 major finding claiming `clearable` is unused/dead since no `FormField` call site passes it yet — determined to be a false positive from the subagent lacking the plan's phase boundaries: wiring `clearable` onto the Name field is explicitly Step 4's scope (own Red/Green/Refactor cycle, not yet run), so no fix was applied
  - ✅ Full frontend suite re-verified: 246/246 tests passing (29 files)
- [x] **Step 4: Wire Name + Room clear-✕ in `ChoreForm`, guard Details** - COMPLETE (2026-09-10)
  - ✅ Red: `frontend/src/__tests__/components/ChoreForm.test.tsx` extended with 5 tests, confirmed 4/5 failing pre-Green (Details-never-clears test passed trivially as a forward-looking guard)
  - ✅ Green: `frontend/src/components/form/ChoreForm.tsx` edited — Name `FormField` call gained `clearable`; Room's hand-rolled `<input>` wrapped in a new `relative` div with `useRef`, `pr-14`, and a hand-wired `ClearButton` (`anchor="top"`); `details`/`dateLastCompleted`/`duration`/`frequency` left unchanged; all 12 tests pass
  - ✅ Refactor: implementation matches plan's spec exactly — no changes needed
  - ✅ Subagent review pipeline: Correctness & Codebase Fit PASS, Security & Edge Cases PASS, Quality & Completeness PASS — no findings, no fixes needed
  - ✅ Full frontend suite re-verified: 251/251 tests passing (29 files)
- [x] **Step 5: App-level integration check for the search-bar clear-✕** - COMPLETE (2026-09-10)
  - ✅ Added `'clicking the clear-✕ button restores the room-filtered list'` test to `frontend/src/__tests__/App.search.test.tsx`'s F9 `describe` block, alongside the existing manual-clear test — types a query, waits for the filtered list via `renderedNames()`, clicks `getByRole('button', { name: 'Clear Search' })` (instead of `user.clear`), asserts the input is empty (`toHaveValue('')`) and the room-filtered list is restored
  - ✅ No `App.tsx` production code changes needed (already fully wired via `value={searchQuery} onChange={setSearchQuery}`) — test-only step, matching the plan
  - ✅ `cd frontend && npx vitest run src/__tests__/App.search.test.tsx` — 10/10 tests pass (9 pre-existing + 1 new)
  - ✅ Subagent review pipeline: Correctness & Codebase Fit PASS, Security & Edge Cases PASS, Quality & Completeness PASS — no findings, no fixes needed
- [ ] Step 6: Verify All Tests Pass

## Status
finished: false
