# F21 — Add/edit form polish + UTC-vs-local date-math fix

## Summary

Fix the user-reported bug where a chore added through the form is immediately shown as
"1 day ago": `ChoreForm.tsx` parses the `<input type="date">`'s `yyyy-mm-dd` string with
`new Date(str)` (UTC midnight) and pre-fills the edit form with
`toISOString().slice(0, 10)` (the UTC calendar date), while every consumer
(`choreSort.ts`, `ChoreTimerBar.tsx`, `CompletionInfo.tsx`) does *local* day math. The fix
is confined to the form boundary: two `date-fns` helpers (`parseFormDate` /
`formatFormDate`) replace both lines. In the same session the form gains its confirmed
polish — Last Completed defaults to today and Room defaults to the active room tab in add
mode — and a new bottom-centre `Toast` replaces the red top-of-page error strip in
`App.tsx`, adding green success feedback on resolved add/edit/delete. No backend, data,
sort or route change. Source: `plans/META-PLAN.md` § F21.

## Research Findings

- **The bug is exactly two lines** — `frontend/src/components/form/ChoreForm.tsx:58`
  (`new Date(formData.dateLastCompleted)`) and `:28`
  (`chore.dateLastCompleted.toISOString().slice(0, 10)`). Every other link is already
  local or instant-safe: `choreSort.ts:5` and `ChoreTimerBar.tsx:26` use
  `differenceInDays(startOfDay(day), startOfDay(chore.dateLastCompleted))`,
  `CompletionInfo.tsx:10` renders `date.toDateString()` (local), `choreApi.ts` serialises
  with `toISOString()` (L29/43/54) and hydrates with `new Date(iso)` (L6), and the backend
  (`backend/src/app.ts` POST L49-61 / PUT L63-82, `chores.ts` L39-41/66-68) truthiness-checks
  the field and stores/echoes the string verbatim into a `TEXT` column. `date-fns` ^4.1.0 is
  already a frontend dependency; `parse`/`format` are not yet imported anywhere.
- **Test-infra facts that shape the TDD steps** (verified empirically by the research
  pass): (1) `vitest` (4.1.4, forks pool, per-file isolation, `frontend/vitest.config.ts`
  sets no `env`) runs in the host zone (America/New_York locally, UTC in CI) — nothing pins
  `TZ`; Node (≥ 13 — verified locally on 22 and 24; CI's Node 20 is in range) honours *dynamic* `process.env.TZ` assignment, so a `describe.each` over a
  behind-UTC and an ahead-of-UTC zone with `beforeAll`/`afterAll` toggling `process.env.TZ`
  runs both zones in one `npm test` invocation with no CI change. (2) The pre-fix code fails
  the submit `getDate` facet only behind UTC (its `getHours` facet in every non-UTC zone),
  and the pre-fill assertion for an *evening* instant only behind UTC / for a *morning*
  instant only ahead of UTC, so both zones are genuinely needed. (3) With user-event 14.6.1 + jsdom
  29, `user.type` into an already-populated `<input type="date">` leaves it **empty**;
  `user.clear` first (or `fireEvent.change`) works — four existing add-mode call sites
  (`ChoreForm.test.tsx:127,143`, `App.test.tsx:381,443`) need `user.clear`. (4) The
  existing edit test `ChoreForm.test.tsx:23/35` asserts a UTC-midnight fixture renders as
  `'2025-03-31'`, which flips to `'2025-03-30'` under local formatting in New York — it must
  move to `localNoon('2025-03-31')` (`__tests__/fixtures/chore.ts:13-16`). (5) Clock
  pinning convention: `vi.useFakeTimers({ now })` + `fireEvent` (never `userEvent` under
  fake timers, or `shouldAdvanceTime: true` when `waitFor` must run), `vi.useRealTimers()`
  in `finally`.
- **Error-strip consumers**: `error` state at `App.tsx:42` has five real setters
  (`loadChores` L91 initial-only, add L185, delete L204, complete L238, edit L265) and one
  reader — the strip at L319-324 (`mb-4 p-3 bg-red-700 … Dismiss`, above `NavBar`, inside
  the `.App` root so it is covered by `inert`). No Vitest test references `Dismiss`,
  `bg-red-700`, `role="alert"` or `role="status"`; six `App.test.tsx` tests assert the error
  *message text* via `getByText` (they survive a toast that renders the message verbatim).
  `e2e/smoke.spec.ts` uses `.bg-red-700` eight times — one positive visibility assertion
  (L315, forced PATCH 500 → `'Forced error'`) and six negatives (L86, 108, 122, 363, 512,
  543) — these must migrate to the toast's selector.
- **Success points**: add resolves at `App.tsx:180` (non-optimistic; modal closes at L183 on
  success only), edit at L261 (optimistic apply + modal close at L257-258 must *not* toast),
  delete at L200 (optimistic removal at L196-197 must *not* toast). Every own write also
  rings the SSE doorbell whose re-pull is gated by `isRepullGated()` (L61-64:
  `isMutatingRef || showForm || editingId !== null || pendingDeleteId !== null`) — the toast
  is not user input and must not join that gate (`App.sync.test.tsx:134-160` pins the gate).
- **Layout/stacking facts**: z-ladder is `#rotate-overlay` 9999 (CSS) > `ScreenBlankOverlay`
  `z-[100]` > `TouchLockOverlay` `z-[90]` > `TouchLockIndicator` `z-[80]` (fixed top-left,
  inline in `.App`, `pointer-events-none`) > `ChoreFormModal`/`ConfirmDialog` `z-50`
  (portaled to `document.body`). The F5 deck is `sticky bottom-0 mt-auto … py-4` (~80 px) as
  the **last child** of the scroll region `flex-1 overflow-y-auto min-h-0 flex flex-col
  scroll-pb-40`, with a `-top-16` (4 rem) masked backing; `scroll-pb-40` (10 rem) is the
  documented "deck + overhang" clearance — so a fixed toast at `bottom-40` clears it.
  `App.test.tsx:729-750` and `App.search.test.tsx:236` locate the scroll region with
  `document.querySelector('.overflow-y-auto')` and require its `lastElementChild` to be the
  deck; no TS constant for the footprint exists (F18, which would share one, has not landed).
  F20 (permissive lock) has not landed either (no branch; `App.tsx:316` still
  `inert={isBlanked || isLocked}`), so META-PLAN's soft "success toast while locked" test is
  N/A — the toast is covered by the root's `inert` exactly like the strip (decision (d)).
- **Other facts**: `ChoreFormModal.tsx:5-11,26` mirrors `ChoreFormProps` and forwards every
  prop — `defaultRoom` must be added to both. `selectedRoom` (`App.tsx:37`, default `'all'`)
  is a free-text room name; the Room input is a plain text `<input list="room-options">`
  with a `ClearButton` rendered when `formData.room !== ''`, so a default room shows the
  clear-✕ on mount (expected). `ChoreForm` never receives `simulatedDate`; "today" for the
  default must be the real clock (`new Date()`), consistent with tap-to-complete being
  blocked while simulating (`App.tsx:226`). The root `README.md` documents none of: "N days ago", the
  form's fields/defaults, or the error banner — the prioritisation section (L11-31) before
  `### Data model` (L33) and the Timezone bullet (L131) are the anchors. Research was done by
  four parallel subagents (architecture, dependencies, tests, request-chain); the schema
  subagent was skipped because the request-chain pass already covered the `Chore` type and
  backend storage and no schema changes.

## Decisions (resolving META-PLAN § F21 "Open risks / decisions")

- **(a) TZ in Vitest** — a dedicated file
  `frontend/src/__tests__/components/ChoreForm.dateBoundary.test.tsx` wraps its cases in
  `describe.each([['America/New_York'], ['Asia/Tokyo']])`, sets `process.env.TZ` in
  `beforeAll` and restores the prior value in `afterAll`. No `frontend/vitest.config.ts` or
  `.github/workflows/ci.yml` change. (`.github/workflows/ci.yml` `test-frontend`: Node 20, no
  `env:`, plain `npm test --workspace frontend`.) Step 1 (the merged Red → Green step, see
  DD-3 in the review) verifies each assertion fails on the pre-fix code in the zone the
  corrected pattern predicts — its internal pre-fix checkpoint — before the helper is written.
- **(b) Empty string** — the field stays `required`; `parseFormDate('')` returns
  `Invalid Date` and is never reached through the browser. No second validation layer.
  (jsdom enforces `required` on submit too, so no Vitest test can reach `parseFormDate('')`
  through the form — the helper unit test in Step 1 covers it.)
- **(c) Existing data** — **no migration.** Rows written by the old form
  (`…T00:00:00.000Z`) keep reading one day early in a behind-UTC zone until their next
  bar-tap completion overwrites them with an exact instant; after the fix the edit form
  shows the same day the bar shows, so re-saving does not drift further. One README line
  states this; the manual correction path (open → bump the date one day → Save) needs no
  code. Rationale: a server-side shift cannot know the creating browser's zone, the repo's
  only migration precedent is schema-only and crash-loud at boot, and META-PLAN scopes F21
  as "no backend, data, sort or route change".
- **(d) Toast vs. the modal** — `Toast` is rendered **inline inside the `.App` root**
  (not portaled): a `position: fixed` full-width frame (`inset-x-4 bottom-40 z-[80] flex
  justify-center`) holding the centred pill, placed after the main column and before the
  modals — both divs are the component's own markup. `.App` creates no stacking context, so
  the frame's `z-[80]` competes at root level with the body-portaled `z-50` modals: it
  paints **above** an open form (a failed add's error toast is visible over the modal) and
  **below** lock (`z-[90]`) / blank (`z-[100]`), and it is covered by the root's `inert`
  exactly like today's strip. The frame is `pointer-events-none`. The success pill is
  click-through (inherits the frame's `pointer-events-none`; no pointer-events class and
  no `onClick` of its own, see Step 4) so the 2.5 s green pill never blocks the form's
  Save/Cancel; the error pill is interactive (`pointer-events-auto cursor-pointer`) — a tap
  anywhere on it (or its ✕) dismisses it, so on a short viewport (a phone on the LAN, where
  `bottom-40` lands on the modal's Save/Cancel row) it may cover the form's button row but
  a single tap clears it and never falls through to the modal backdrop beneath (DD-12).
  Click-through is pinned by Toast test (vi) (class presence only) and, after DD-12,
  applies to the success pill alone; no real-browser hit-test assertion (DD-14). Width
  (DD-13): the frame is viewport-relative (like `TouchLockIndicator`); `body` is
  `display:flex; justify-content:center` and `#root` is `max-width: 768px`, so the pill
  centres on the app column at any width; a message longer than the frame is truncated
  with an ellipsis rather than wrapping or overflowing (`min-w-0 truncate` on the message
  span, `min-w-0` on the pill; no width cap — real messages — `Failed to add chore`, API
  error strings — are short). It is rendered only in the main (non-loading) return, like
  the strip; an initial-load failure flips `loading` to `false` before the strip/toast is
  needed.
- **(e) Delete toast timing** — raised after `await removeChore(id)` resolves; the
  optimistic removal at L196-197 is untouched.
- **(f)** Double screen-reader announcement (modal close + toast) is accepted.
- **(g) Simulated day** — the add-mode default is the **real** today (`new Date()` in
  `ChoreForm`), never `simulatedDate`. Stated in the README line.
- **Toast copy** — `Added "<name>"` / `Saved "<name>"` / `Deleted "<name>"` (straight
  quotes, matching `ConfirmDialog`'s `Delete "<name>"?`). `getByText` matches full strings,
  so these never collide with a bare chore-name query; no toast button is named
  `Save`/`Cancel`/`Delete chore`/`Edit chore`.
- **Tap-to-complete and a standing error** — no green toast on tap-to-complete (scope is
  the three form-driven mutations), but complete-success clears a standing error toast
  (META-PLAN Design 4: "the next successful mutation replaces it") — whichever mutation
  raised the error (a failed add's red pill is cleared by a later successful bar tap too;
  the clause is about the error tone, not its source); a success toast is left alone. The
  replacement is order-agnostic — any successful mutation that *settles* after an error
  retires it, even one that was started earlier (two taps inside one network round-trip);
  the failed write is still rolled back on screen, and this is inherent to the single-slot
  toast (the three success toasts replace a standing error the same way). Pinned by Step 5
  tests (viii) and (xi).
- **Timer restart on replacement** — App keys the toast (`key={toast.id}`, a counter) so a
  second identical success within 2.5 s remounts `Toast` and restarts its timer; the
  effect cleanup clears the timer on unmount/replacement. Pinned at App level by Step 5
  test (ix).
- **Failed add leaves a defaulted (not blank) form** — `ChoreForm` already resets its own
  state synchronously on submit (L63); after this change the reset re-applies today +
  `defaultRoom`. Moving the reset behind a success signal is out of F21's scope.
- **`bg-red-700` stays on the error toast** — it is the palette's error colour anyway;
  smoke assertions still migrate to `[data-testid="toast"][data-tone="error"]` so they are
  not coupled to a colour token.
- **Default date is captured at mount** — the add form's Last Completed default is computed
  when the modal opens (`useState` initialiser) and is not refreshed by `useMidnightClock`;
  a form held open across local midnight keeps the previous day, visibly and editably.
  Accepted: the kiosk blanks 21:00–06:00 and blanking closes the form (`App.tsx:133-139`);
  a 23:59 add is fine (`parseFormDate` yields local midnight of the typed day, `daysSince`
  is 0).
- **Phase C fold-back notes** — META-PLAN lists the "0 days ago under a
  behind-UTC TZ" assertion under `ChoreTimerBar.test.tsx` and the TZ-pinned form tests under
  `ChoreForm.test.tsx`; both live in the dedicated `ChoreForm.dateBoundary.test.tsx` (Case D
  renders `ChoreTimerBar` from the form's real payload, under both zones) so `TZ` toggling
  is confined to one file — Design item 1 allows "a dedicated test file". META-PLAN's
  `TOAST_MS` is `SUCCESS_TOAST_MS` (only the success tone has a timer). Phase C fold-back
  rewrites the § F21 bullets accordingly, together with: Design 4's "a ✕ / tap-to-dismiss"
  → both, for the error tone (the success pill is click-through) (decision (d)); "Added «name»" → straight-quoted
  `Added "name"` (Toast copy); "the next successful mutation replaces it" now includes a
  successful tap-to-complete, which raises no toast of its own; and Open risk (a)'s "set
  before the first Date use / vitest.config env" mechanism → runtime `process.env.TZ`
  toggling in one file (decision (a)).

## Steps

_Gate convention: every `! grep -q …` gate below passes with exit 0 and prints nothing; the un-negated `grep -n`/`grep -c` forms exit 1 on their expected 'no match' result, so judge those by output, not exit status. Line numbers cited in to-dos are pre-edit references — anchor each edit on the quoted text, which is unique in its file._

_Before Step 1's first edit, confirm `! git status --porcelain | grep -qE '_p2_|_p2r_|_dd_'` exits 0 — review-pass scratch files (`_p2_*`, `_p2r_*`, `_dd_*`) would otherwise be swept into the first per-step commit by `/git-commit`'s `git add .` and run inside the Vitest gates; delete any that remain (they are review artefacts, not plan work)._

### 1. Red → Green — TZ-pinned date-boundary tests + `parseFormDate` / `formatFormDate` — COMPLETE (2026-09-21)

Add the regression tests for both directions of the bug under both TZ hemispheres, prove
they fail before touching the form (an internal checkpoint — this step ends green), then
introduce the two helpers and swap the two bug lines so every case passes in both zones.
One step, one commit: the `/run-plan` executor validates "tests green" and commits after
every step, so the red state must not be a step boundary (review DD-3).

**To-do:**
- [x] Create `frontend/src/__tests__/components/ChoreForm.dateBoundary.test.tsx`. Top of
      file: `import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'`,
      `render`/`screen` from `@testing-library/react`, `userEvent` from
      `@testing-library/user-event`, `ChoreForm` from `'../../components/form/ChoreForm'`,
      `ChoreTimerBar` from `'../../components/chore/ChoreTimerBar'`, `makeChore` from
      `'../fixtures/chore'`, and `type { Chore } from '@customTypes/SharedTypes'`. Wrap all
      cases in `describe.each([['America/New_York'], ['Asia/Tokyo']])('ChoreForm date
      boundary under TZ=%s (F21)', (tz) => { … })` with
      `let previousTz: string | undefined; beforeAll(() => { previousTz = process.env.TZ;
      process.env.TZ = tz; }); afterAll(() => { if (previousTz === undefined) delete
      process.env.TZ; else process.env.TZ = previousTz; });` and a one-line comment that
      Node re-reads `process.env.TZ` on the next `Date` call (runtime `TZ` re-read since
      Node 13; verified locally on 22 and 24; CI runs Node 20 with no `TZ` env) and the forks pool
      isolates the assignment per file. Build every `Date` fixture **inside** the `it`
      body — the `describe.each` callback runs at collection time, before `beforeAll` has
      set `TZ`, so a describe-scope `const evening = new Date(…)` would be built in the
      host zone.
- [x] Case A (submit path): render `<ChoreForm onSubmit={onSubmit} onCancel={vi.fn()} />`;
      `const user = userEvent.setup()`; fill Name `'Sweep'`, Room `'Kitchen'`, then
      `await user.clear(screen.getByLabelText('Last Completed'))` + `await user.type(…,
      '2025-03-31')` (clear-first is mandatory once Step 2 pre-fills the date), Duration
      `'10'`, Frequency `'7'`; click `getByRole('button', { name: 'Save' })`; take
      `const payload = onSubmit.mock.calls[0][0] as Omit<Chore, 'id'>` and assert
      `payload.dateLastCompleted.getFullYear() === 2025`, `.getMonth() === 2`,
      `.getDate() === 31`, `.getHours() === 0`, `.getMinutes() === 0` (local midnight of the
      typed day).
- [x] Case B (pre-fill path): render `<ChoreForm mode="edit" initialChore={makeChore({
      dateLastCompleted: new Date(2025, 2, 31, 21, 30, 0) })} onSubmit={vi.fn()}
      onCancel={vi.fn()} />` (a local *evening* instant, the shape a bar tap stores) and
      assert `screen.getByLabelText('Last Completed')` `toHaveValue('2025-03-31')`.
- [x] Case B2 (pre-fill for a morning instant): as Case B but with
      `makeChore({ dateLastCompleted: new Date(2025, 2, 31, 3, 0, 0) })` (a local *morning*
      instant — already the previous UTC day anywhere ahead of UTC) and assert
      `toHaveValue('2025-03-31')` (pre-fix: `'2025-03-30'` in Tokyo, passes in New York).
- [x] Case C (round-trip): same evening-instant edit render; `const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'Save Changes' }))` without
      touching the date; assert the emitted `payload.dateLastCompleted` has
      `getFullYear/getMonth/getDate === 2025/2/31` **and** `.getHours() === 0`,
      `.getMinutes() === 0` (the calendar day is preserved and the time-of-day collapses to
      local midnight, which is the intended contract — without the hour assertions the two
      pre-fix bugs cancel and C never fails).
- [x] Case D (`ChoreTimerBar` integration): build the chore from Case A's payload shape —
      `makeChore({ dateLastCompleted: new Date(2025, 2, 31) })` is *not* enough because it
      bypasses the form; instead render the form as in Case A with typed date
      `'2025-03-31'`, capture `payload`, then `render(<ChoreTimerBar chore={{ id: 1,
      ...payload }} day={new Date(2025, 2, 31, 12, 0, 0)} isSimulating={false}
      onComplete={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} />)` (the exact
      `ChoreTimerBarProps` at `frontend/src/components/chore/ChoreTimerBar.tsx:11-18`:
      `chore`, `day`, `isSimulating`, `onComplete`, `onDelete`, `onEdit?`) and assert `screen.getByText('0 days ago')` is in the document.
- [x] **Pre-fix checkpoint.** Run `npm test --workspace frontend -- src/__tests__/components/ChoreForm.dateBoundary.test.tsx`
      and confirm the **expected pre-fix failure pattern** (reproduced in-repo against the
      unfixed form on 2026-09-21: 7 failed / 3 passed): under `America/New_York` Cases A
      (`getDate()` is 30, `getHours()` 20), B (input reads `2025-04-01` — the 21:30 local
      instant is already Apr 1 in UTC), C (`getHours()` is 20) and D (`'1 day ago'`) fail
      while B2 passes; under `Asia/Tokyo` Cases A (`getHours()` is 9 — UTC midnight is
      09:00 JST), B2 (`'2025-03-30'`) and C (`getHours()` is 9) fail while B and D pass.
      If any case listed as failing in a zone passes there, the test is not exercising the
      bug — fix the test (not the form) before continuing. Likewise, if a case listed as
      passing in a zone fails there, the fixture was almost certainly built outside the
      `it` body (host zone) or the zone string is wrong — also fix the test, never the
      form. The pattern must be exactly 7 failed / 3 passed before you continue. This
      checkpoint is expected red; do not commit or stop here — continue to the helper
      to-dos below. In the step's final report, record this run as 'pre-fix pattern
      reproduced (7 failed / 3 passed)' under what was done, not under validation
      results — the step's validation is the green run in the last to-do.
- [x] Create `frontend/src/utils/formDate.ts`:
      `import { format, parse } from 'date-fns';`
      `const FORM_DATE_PATTERN = 'yyyy-MM-dd';`
      `/** Local midnight of the calendar day an <input type="date"> holds ('yyyy-MM-dd'). Never new Date(str): ECMAScript parses the date-only form as UTC midnight, which is the previous local day anywhere behind UTC. */`
      `export function parseFormDate(value: string): Date { return parse(value, FORM_DATE_PATTERN, new Date()); }`
      `/** Local calendar date of an instant, in the form an <input type="date"> accepts. Never toISOString().slice(0, 10): that is the UTC date, a day off for evening instants. */`
      `export function formatFormDate(date: Date): string { return format(date, FORM_DATE_PATTERN); }`
      (named exports, camelCase file, matching `choreSort.ts`/`choreBarMath.ts`).
- [x] Add `frontend/src/__tests__/utils/formDate.test.ts` with a
      `describe('formDate helpers (F21)', …)` (import via `'@utils/formDate'`
      like `'@utils/choreBarMath'`): `parseFormDate('2025-03-31')` equals
      `new Date(2025, 2, 31)`; `formatFormDate(new Date(2025, 2, 31, 23, 59))` is
      `'2025-03-31'`; `formatFormDate(parseFormDate('2025-03-31'))` round-trips;
      `Number.isNaN(parseFormDate('').getTime())` is `true` (documents decision (b)). These
      hold in any zone; no TZ pinning here.
- [x] In `frontend/src/components/form/ChoreForm.tsx`: add
      `import { formatFormDate, parseFormDate } from '@utils/formDate';` (alias, as
      `ChoreTimerBar.tsx` imports `@utils/choreBarMath`); change L28 to
      `dateLastCompleted: formatFormDate(chore.dateLastCompleted),` and L58 to
      `dateLastCompleted: parseFormDate(formData.dateLastCompleted),`. Confirm with
      `! grep -qE "new Date\(formData|toISOString\(\)\.slice" frontend/src/components/form/ChoreForm.tsx`
      (exit 0 = clean; the un-negated form exits 1 on its pass state).
- [x] Update the now-TZ-sensitive fixtures in
      `frontend/src/__tests__/components/ChoreForm.test.tsx`: L23 and L53
      `dateLastCompleted: new Date('2025-03-31T00:00:00.000Z')` →
      `dateLastCompleted: localNoon('2025-03-31')` (add `localNoon` to the existing
      `'../fixtures/chore'` import). Tighten L71 from `toBeInstanceOf(Date)` to also assert
      `payload.dateLastCompleted.getFullYear() === 2025`, `.getMonth() === 2`,
      `.getDate() === 31`.
- [x] Run `npm test --workspace frontend -- src/__tests__/components/ChoreForm.dateBoundary.test.tsx src/__tests__/utils/formDate.test.ts src/__tests__/components/ChoreForm.test.tsx`
      — all green under both zones. Then `npm test --workspace frontend` — the full suite
      must still be green (254 + new).

### 2. Red → Green — add-mode defaults (Last Completed = today, Room = `defaultRoom`) — COMPLETE (2026-09-21)

Make `initialFormState` a function of today + `defaultRoom`, thread the prop through the
modal, and repair the four `user.type`-on-a-prefilled-date call sites.

**To-do:**
- [x] **Red.** Change `frontend/src/__tests__/components/ChoreForm.test.tsx:2` to
      `import { render, screen, fireEvent } from '@testing-library/react';` (case (v)
      below uses `fireEvent`). Then in `frontend/src/__tests__/components/ChoreForm.test.tsx` add a
      `describe('ChoreForm add-mode defaults (F21)')` with: (i) `'Last Completed defaults
      to today's local date in add mode'` — `vi.useFakeTimers({ now: new Date(2025, 0, 15,
      14, 0, 0) })` **before** `render(<ChoreForm onSubmit={vi.fn()} onCancel={vi.fn()} />)`,
      assert `getByLabelText('Last Completed')` `toHaveValue('2025-01-15')`, `vi.useRealTimers()`
      in `finally` (no user interaction, so fake timers are safe); (ii) `'Room defaults to
      defaultRoom in add mode and shows the clear-✕ immediately'` — render with
      `defaultRoom="Kitchen"`, assert Room `toHaveValue('Kitchen')` and
      `getByRole('button', { name: 'Clear Room' })` is present; (iii) `'Room stays empty
      when defaultRoom is omitted or empty'` — render without the prop and with
      `defaultRoom=""`, assert Room `toHaveValue('')` and `queryByRole('button', { name:
      'Clear Room' })` is `null`; (iv) `'edit mode ignores defaultRoom'` — `mode="edit"
      initialChore={makeChore({ room: 'Garage' })} defaultRoom="Kitchen"`, assert Room
      `toHaveValue('Garage')`; (v) `'post-submit reset in add mode re-applies today and
      defaultRoom'` — fake timers pinned as in (i), render with `defaultRoom="Kitchen"`,
      fill Name/Duration/Frequency via `fireEvent.change` (fake timers ⇒ no `userEvent`)
      — Room and Last Completed are already filled by the defaults; jsdom runs
      `reportValidity()` before dispatching `submit`, so if any of the five `required`
      inputs is blank `onSubmit` is never called (verified),
      `fireEvent.click(getByRole('button', { name: 'Save' }))`, then assert Name `''`,
      Room `'Kitchen'`, Last Completed `'2025-01-15'`. Run the file; (i), (ii), (v) must
      fail (the date is `''`, `defaultRoom` is an unknown prop).
- [x] **Red (modal).** In `frontend/src/__tests__/components/ChoreFormModal.test.tsx` add
      `'forwards defaultRoom into the Room input'` mirroring the existing rooms-prop test:
      render `<ChoreFormModal defaultRoom="Garage" onSubmit={vi.fn()} onCancel={vi.fn()} />`,
      assert `getByLabelText('Room')` `toHaveValue('Garage')`. Fails until the prop exists.
- [x] **Green.** In `ChoreForm.tsx`: replace the `initialFormState` constant (L15-22) with
      `function initialAddState(defaultRoom: string): FormState { return { name: '', room:
      defaultRoom, dateLastCompleted: formatFormDate(new Date()), duration: '', frequency:
      '', urgency: '' }; }` with a `// F21: …` comment that today is the *real* clock, not the
      simulated day (decision (g)); add `defaultRoom?: string;` to `ChoreFormProps` with a
      `/** Add mode only: pre-fills Room (the active room tab). Ignored in edit mode. */`
      doc comment; destructure `defaultRoom = ''`; change the `useState` initialiser (L44-46)
      to `initialChore ? choreToFormState(initialChore) : initialAddState(defaultRoom)`;
      change L63 to `if (mode === 'add') setFormData(initialAddState(defaultRoom));`.
      Confirm `! grep -q initialFormState frontend/src/components/form/ChoreForm.tsx`
      (exit 0 = clean). The `<datalist>`, its `ClearButton` (`"Clear Room"`) and the `pr-14`
      reservation are untouched (Standing invariant 10); Last Completed stays `required`
      and not `clearable`.
- [x] **Green (modal).** In `frontend/src/components/form/ChoreFormModal.tsx` add
      `defaultRoom?: string;` to `ChoreFormModalProps` (L5-11), destructure it, and forward
      `defaultRoom={defaultRoom}` on the `<ChoreForm …/>` line (L26).
- [x] **Repair prefilled-date typing.** Prepend `await user.clear(screen.getByLabelText('Last
      Completed'));` immediately before each existing `user.type(screen.getByLabelText('Last
      Completed'), …)` at the two `user.type(screen.getByLabelText('Last Completed'),
      '2025-03-31')` sites in `ChoreForm.test.tsx` (:127/:143 before Step 1's edits) and the
      two `user.type(screen.getByLabelText('Last Completed'), …)` sites in `App.test.tsx`
      (inside `openAndFillForm`, L381, and at L443 — pre-edit numbers). (Verified: `type` into a prefilled date input
      yields `''`; `clear` then `type` yields the typed value.)
- [x] Run `npm test --workspace frontend -- src/__tests__/components/ChoreForm.test.tsx src/__tests__/components/ChoreFormModal.test.tsx src/__tests__/components/ChoreForm.dateBoundary.test.tsx src/__tests__/App.test.tsx`
      — green.

### 3. Red → Green — wire `defaultRoom` from the active room tab in `App.tsx` — COMPLETE (2026-09-21)

Pass the selected room into the *add* modal only.

**To-do:**
- [x] **Red.** In `frontend/src/__tests__/App.test.tsx` add, inside the existing
      `handleAddChore` describe (near L376): `'pre-fills Room with the active room tab (F21)'`
      — after the initial `waitFor(getByText('Sweep'))`, `await user.click(screen.getByRole(
      'button', { name: 'Kitchen' }))` (the room tab, as `App.search.test.tsx:95` does),
      click `'+ Add Task'`, assert `getByLabelText('Room')` `toHaveValue('Kitchen')`; and
      `'leaves Room empty under the All tab (F21)'` — click `'+ Add Task'` directly, assert
      Room `toHaveValue('')`. The first fails until wired.
- [x] **Green.** In `frontend/src/App.tsx` L359 change the add modal to
      `<ChoreFormModal rooms={uniqueRooms} defaultRoom={selectedRoom === 'all' ? '' :
      selectedRoom} onSubmit={handleAddChore} onCancel={() => setShowForm(false)} />`. The
      edit modal (L360-368) does not receive `defaultRoom`.
- [x] Run `npm test --workspace frontend -- src/__tests__/App.test.tsx` — green.

### 4. Red → Green — `Toast` component — COMPLETE (2026-09-21)

Build the single toast surface as a unit before touching `App.tsx`.

**To-do:**
- [x] **Red.** Create `frontend/src/__tests__/components/Toast.test.tsx` with
      `import { describe, it, expect, vi } from 'vitest';`,
      `import { render, screen, fireEvent, act } from '@testing-library/react';` (as
      `App.touchLock.test.tsx:2` does — RTL re-exports React's `act`) and
      `import Toast, { SUCCESS_TOAST_MS } from '../../components/common/Toast';`. Wrap
      the seven cases in `describe('Toast (F21)', …)`. Tests:
      (i) `'renders the message with role="status" and aria-live="polite"'` — render
      `<Toast tone="success" message={'Added "Mop"'} onDismiss={vi.fn()} />` (a braced
      string — JSX attribute literals take no `\"` escapes, so `message="Added \"Mop\""`
      is a parse error; use the same form wherever a success message is rendered); assert
      `getByRole('status')` has text `Added "Mop"`, attribute `aria-live="polite"`,
      `data-testid="toast"`, `data-tone="success"`; (ii) `'success tone is green and has
      no dismiss control'` — className contains `bg-green-600`, `queryByRole('button', {
      name: 'Dismiss' })` is `null`; (iii) `'success auto-dismisses after
      SUCCESS_TOAST_MS'` — `vi.useFakeTimers()` before render, `act(() =>
      vi.advanceTimersByTime(SUCCESS_TOAST_MS - 1))` → `onDismiss` not called,
      `act(() => vi.advanceTimersByTime(1))` → called once, `vi.useRealTimers()` in
      `finally`; (iv) `'error tone is red, never auto-dismisses, and dismisses on the ✕ or a tap on
      the pill'` — `tone="error"`, className contains `bg-red-700`, `data-tone="error"`,
      advance `SUCCESS_TOAST_MS * 2` under fake timers → `onDismiss` not called; then
      `fireEvent.click(getByRole('button', { name: 'Dismiss' }))` → called once (the ✕'s
      `stopPropagation()` keeps the click from also reaching the pill's handler); then
      `fireEvent.click(screen.getByRole('status'))` → called a second time (total 2);
      (v) `'clears the pending success timer on unmount'` — fake timers, render success,
      `unmount()`, advance past `SUCCESS_TOAST_MS`, `onDismiss` not called; (vi) `'sits in
      a click-through fixed frame at bottom-centre above the deck clearance and under the
      lock/blank layers'` — render `tone="success"`; `const frame = screen.getByRole('status').parentElement;
      expect(frame).not.toBeNull();` then `frame!.className` (non-null assertion, as
      `App.test.tsx:726` does — `parentElement` is `HTMLElement | null` under `strict`)
      contains each of `fixed`, `inset-x-4`, `bottom-40`, `z-[80]`, `flex`,
      `justify-center`, `pointer-events-none`; the success pill's (`getByRole('status')`)
      className contains `max-w-full`, `min-w-0` and `rounded-full` and contains **none**
      of `overflow-y-auto`, `pointer-events-auto`, `cursor-pointer`; the message span
      (`const span = screen.getByRole('status').querySelector('span');
      expect(span).not.toBeNull();` then `span!.className`) contains `truncate` and
      `min-w-0`; then `unmount()` (from the `render` result — one `role="status"` per
      render, or `getByRole` throws on two matches) and re-render with `tone="error"`: the
      error pill's className contains `pointer-events-auto` and `cursor-pointer`, and the
      dismiss button's className contains `pointer-events-auto`; (vii) `'a success pill
      body click does nothing'` — render `tone="success"` with `onDismiss={vi.fn()}`,
      `fireEvent.click(screen.getByRole('status'))`, `onDismiss` not called. All seven
      fail (module missing).
- [x] **Green.** Create `frontend/src/components/common/Toast.tsx`:
      - `import { useEffect } from 'react'; import { X } from 'lucide-react';`
      - `/** How long a success toast stays before dismissing itself. Error toasts never auto-dismiss — a kiosk failure must be seen. */ export const SUCCESS_TOAST_MS = 2500;`
      - `type ToastProps = { tone: 'success' | 'error'; message: string; /** Must be referentially stable (App wraps it in useCallback): it is an effect dependency, and a new identity re-arms the success timer. */ onDismiss: () => void; };`
      - `export default function Toast({ tone, message, onDismiss }: ToastProps)`:
        `useEffect(() => { if (tone !== 'success') return; const timer = setTimeout(onDismiss,
        SUCCESS_TOAST_MS); return () => clearTimeout(timer); }, [tone, onDismiss]);`
      - Return a full-width click-through frame wrapping the pill:
        `<div className="pointer-events-none fixed inset-x-4 bottom-40 z-[80] flex justify-center">`
        `<div role="status" aria-live="polite" data-testid="toast" data-tone={tone}
        onClick={tone === 'error' ? onDismiss : undefined}
        className={\`max-w-full min-w-0 flex items-center gap-3 rounded-full px-5 py-3
        text-sm text-white shadow-lg ${tone === 'success' ? 'bg-green-600' : 'bg-red-700'}
        ${tone === 'error' ? 'pointer-events-auto cursor-pointer' : ''}\`}>`
        containing `<span className="min-w-0 truncate">{message}</span>` and, only when
        `tone === 'error'`,
        `<button type="button" onClick={event => { event.stopPropagation(); onDismiss(); }}
        aria-label="Dismiss" className="pointer-events-auto
        -mr-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full
        hover:bg-red-800"><X className="w-4 h-4" aria-hidden="true" /></button>`, then
        `</div></div>`. The `role="status"` / `data-testid="toast"` / `data-tone` /
        colour token all sit on the **pill**, never on the frame. The *success* pill
        inherits `pointer-events: none` from the frame (no pointer-events class, no
        `onClick`); the *error* pill (and the ✕) is `pointer-events-auto` — a tap anywhere
        on the error pill dismisses it, and the ✕'s `stopPropagation()` keeps a ✕ click
        from also firing the pill's handler (test (iv) counts exactly one call per ✕
        click). `min-w-0` on both the pill (a flex item of the frame) and the span (a flex
        item of the pill) is what lets `truncate` bind — a flex item's automatic minimum is
        its min-content width, so without it neither shrinks below the message and no
        ellipsis appears. No `left-1/2`, `-translate-x-1/2` or `max-w-[calc(…)]`
        anywhere: a `left: 50%` auto-width box is shrink-to-fit capped at the remaining
        50 vw before any `max-w` binds, so a long error would be cut at half the viewport;
        the frame's `inset-x-4` + `justify-center` centres the pill and `max-w-full` caps
        it at viewport − 2 rem. (Every utility named here — including `truncate`,
        `min-w-0`, `cursor-pointer` and `pointer-events-auto` — compiles under the repo's
        Tailwind 4.1.18, verified with `@tailwindcss/node` `compile().build([...])` from
        `frontend/`; this exact component and tests (i)–(vii) ran 7/7 green in-repo on
        2026-09-21 with `tsc --noEmit` and `eslint` clean.)
      - A `// F21: …` block comment above the `return` describing the frame + pill: the
        frame is a full-width (`inset-x-4`), click-through (`pointer-events-none`) fixed
        strip that centres the pill (`flex justify-center`); the success pill inherits the
        click-through so the 2.5 s green pill never swallows a Save/Cancel tap, while the
        error pill and its ✕ are `pointer-events-auto` — a tap anywhere on the error pill
        dismisses it instead of falling through to whatever is beneath (a modal backdrop
        would otherwise cancel the form); long messages truncate with an ellipsis at the
        frame's width (`min-w-0` on pill and span — flex items otherwise refuse to shrink
        below their content);
        `bottom-40` (10 rem) = the deck's ~5 rem footprint + its 4 rem `-top-16` frosted
        overhang, the same number `scroll-pb-40` declares on the scroll region (Standing
        invariant 12); `z-[80]` keeps it above the `z-50` modals but under
        `TouchLockOverlay` `z-[90]` and `ScreenBlankOverlay` `z-[100]`; positioned against
        the viewport, never inside `.overflow-y-auto`.
- [x] Run `npm test --workspace frontend -- src/__tests__/components/Toast.test.tsx` —
      green. Run `npm run lint` — the `react-refresh/only-export-components` rule accepts
      the constant export (`allowConstantExport`, same as `TouchLockOverlay`).

### 5. Red → Green — replace the error strip with the toast; success toasts on resolved mutations; toast-proof the smoke spec — COMPLETE (2026-09-22)

Swap `error` state for a single `toast` state in `App.tsx`; raise success toasts only
after the awaited request resolves. The e2e edits land here too (not in Step 6): `/run-plan`
runs the Playwright smoke suite after every UI-affecting step, and the success toast would
otherwise turn four `text=<name>` assertions into strict-mode violations (review DD-2).

**To-do:**
- [x] **Red.** In `frontend/src/__tests__/App.test.tsx`, first hoist `openAndFillForm`
      (L376-384 pre-edit; by now one line longer with Step 2's `user.clear`) to module
      scope immediately after `stubBarWidth` (ends L46), body unchanged, and remove it from
      the `handleAddChore` describe (its two callers at L392/L404 pre-edit keep working —
      the helper only reads `screen`/`userEvent`, nothing from the describe's scope). Then add a `describe('feedback toast (F21)')` with its own
      `beforeEach(() => { vi.clearAllMocks(); vi.mocked(fetchAllChores).mockResolvedValue([makeChore()]);
      vi.mocked(addChore).mockResolvedValue(makeChore({ id: 2, name: 'Mop' }));
      vi.mocked(updateChore).mockResolvedValue(makeChore({ id: 1, name: 'Sweep Edited' }));
      vi.mocked(removeChore).mockResolvedValue(undefined);
      vi.mocked(completeChore).mockResolvedValue(makeChore()); })` so each test starts from
      resolving mocks and (ii)/(iii)/(iv)/(vii)/(viii)/(ix) override only the one they hold
      pending or reject. Every case below is a standalone `it` — where a case says "after
      (i)" or "after (iv)'s rejection" it repeats that test's driving steps (render `<App />`,
      `openAndFillForm(user)`, click Save, `waitFor` the toast;
      `mockRejectedValueOnce(new Error('Add failed'))` first for the (iv)-derived ones)
      before its own assertions; no DOM or mock state carries between `it`s. Tests: (i)
      `'shows a green success toast after addChore resolves'` — mock
      `addChore` to resolve `makeChore({ id: 2, name: 'Mop' })`, run `openAndFillForm(user)` and
      `await user.click(screen.getByRole('button', { name: 'Save' }))`, then `await
      waitFor(() => expect(screen.getByTestId('toast')).toHaveTextContent('Added "Mop"'))`
      and `toHaveAttribute('data-tone', 'success')`; (ii) `'shows a success toast after updateChore resolves, not on the optimistic apply'` — use a
      pending-promise `updateChore`: `let resolveUpdate!: (chore: Chore) => void;
      vi.mocked(updateChore).mockReturnValue(new Promise<Chore>(resolve => { resolveUpdate
      = resolve; }));` (the resolve twin of the `let rejectEdit!` reject pattern at
      L297-299; `App.sync.test.tsx:105-108` holds the same resolve-capture via
      `mockImplementation`), drive
      the edit flow as the `'optimistically updates the chore and reconciles on success'`
      test does (L277-294 pre-edit: click `Edit chore`, `user.clear`/`user.type` Name, click
      `Save Changes`), after `Save Changes` assert
      `screen.queryByTestId('toast')` is `null` while pending, then `resolveUpdate(
      makeChore({ name: 'Sweep Edited' }))` and `waitFor` the toast text `Saved "Sweep
      Edited"`; (iii) `'shows a success toast after removeChore resolves, not on the
      optimistic removal'` — pending `removeChore` (`let resolveRemove!: () => void;
      vi.mocked(removeChore).mockReturnValue(new Promise<void>(resolve => { resolveRemove
      = resolve; }));`), `await user.click(screen.getByRole('button', { name: 'Delete chore' }))`
      then `await user.click(screen.getByTestId('confirm-dialog-confirm'))` (the L113-120
      idiom), assert no toast while
      pending and `'Sweep'` already gone, resolve, `waitFor` toast `Deleted "Sweep"`;
      (iv) `'a failed mutation shows a red toast with the message and no success toast'`
      — `vi.mocked(addChore).mockRejectedValueOnce(new Error('Add failed'))` (Once —
      consumed by this test's Save, so it does not leak; note that `vi.clearAllMocks()` in
      the `beforeEach` clears call history only and does NOT drop an unconsumed Once queue,
      so every test that queues a Once must consume it), open/fill/Save as in (i), assert the toast has
      `data-tone="error"` and text `Add failed`; (v) `'the error toast replaces the old
      strip'` — after (iv)'s rejection, `document.querySelector('.bg-red-700')` is the
      toast (`toHaveAttribute('data-testid', 'toast')`) and `screen.queryByText('Dismiss')`
      is `null` (the strip's underlined text button is gone; the toast's control is an
      icon button with `aria-label`); (vi) `'the toast is not inside the scroll region and
      the deck is still its last child'` — after (i), `const region =
      document.querySelector('.overflow-y-auto')`; assert `region` does not contain
      `getByTestId('toast')` and `region!.lastElementChild` is `getByTestId('add-task-
      deck')`; (vii) `'a newer toast replaces the current one'` — reject `addChore` (error
      toast), then `vi.mocked(addChore).mockResolvedValue(makeChore({ id: 2, name: 'Mop' }))`,
      run `openAndFillForm(user)` again (the failed add left the modal open — App closes it
      only on success — with the form reset to add-mode defaults, so the `+ Add Task` click
      is a no-op and Step 2's `user.clear` on the date field replaces the prefilled
      default) and click `Save` → `waitFor` that `screen.getAllByTestId('toast')` has
      length 1 and that element has `data-tone="success"`; (viii) `'a successful complete
      clears a standing error toast without raising a success toast'` —
      `vi.mocked(completeChore).mockRejectedValueOnce(new Error('Complete failed'))`, render,
      `await waitFor(() => screen.getByText('Sweep'))`, `fireEvent.click(screen.getByTestId('chore-bar'))`
      (the bar's `onClick={resetTask}` lives on the `data-testid="chore-bar"` div at
      `ChoreTimerBar.tsx:119-123`; the existing complete tests at L203-219 click the bar
      via `getByText('Sweep')` — either target reaches it, and with one chore the testid is
      unique), `await waitFor(() => expect(screen.getByTestId('toast')).toHaveAttribute('data-tone', 'error'))`,
      then (the mock now resolves via `beforeEach`) click the bar again and
      `await waitFor(() => expect(screen.queryByTestId('toast')).toBeNull())`; (ix) `'an
      identical success message remounts the toast (F21 key restart)'` —
      `vi.mocked(addChore).mockResolvedValueOnce(makeChore({ id: 2, name: 'Mop' })).mockResolvedValueOnce(makeChore({ id: 3, name: 'Mop' }))`;
      `openAndFillForm(user)` + Save; `await waitFor(() => expect(screen.getByTestId('toast')).toHaveTextContent('Added "Mop"'))`;
      `const first = screen.getByTestId('toast')`; `openAndFillForm(user)` + Save again (the
      modal closed on success, so `+ Add Task` reopens it); `await waitFor(() => { const now
      = screen.getByTestId('toast'); expect(now).not.toBe(first); expect(now).toHaveTextContent('Added "Mop"'); })`
      (real timers on purpose — `userEvent` cannot run under fake timers; the re-fill takes
      far less than `SUCCESS_TOAST_MS`, and if it ever did not, `not.toBe(first)` still holds
      because the first toast self-dismissed, so the test degrades to a weaker pin rather
      than flaking);
      (x) `'the error toast is removed by its Dismiss button'` — after (iv)'s rejection and
      its error-toast `waitFor`, `await user.click(screen.getByRole('button', { name: 'Dismiss' }))`
      then `expect(screen.queryByTestId('toast')).toBeNull()` (the ✕'s `stopPropagation()`
      means one `setToast(null)`, not two — the pill-body tap path is pinned at unit level
      by Toast test (iv)); (xi) `'completing a chore
      raises no toast'` — `completeChore` resolving (from `beforeEach`), render, wait for
      `'Sweep'`, `fireEvent.click(screen.getByTestId('chore-bar'))`, `await waitFor(() =>
      expect(completeChore).toHaveBeenCalled())`, `expect(screen.queryByTestId('toast')).toBeNull()`.
      All fail (no toast rendered by App) except (xi), a negative pin that also passes
      pre-change — keep it; it guards the scope rule once the toast exists.
- [x] **Green — state.** In `frontend/src/App.tsx`: `import Toast from
      './components/common/Toast';` (between the `ScreenBlankOverlay` and
      `TouchLockIndicator` imports at L17-18, keeping the `./components/common/*` group
      alphabetical); add `type ToastState = { id: number; tone:
      'success' | 'error'; message: string };` above `App`; replace L42 `const [error,
      setError] = useState<string | null>(null);` with `const [toast, setToast] =
      useState<ToastState | null>(null);` plus `const toastIdRef = useRef<number>(0);` and, after
      the ref block, `// F21: one toast at a time — a new one replaces the current. The id keys
      the element so an identical message remounts it and restarts its timer.`
      `const showToast = useCallback((tone: ToastState['tone'], message: string) => {
      toastIdRef.current += 1; setToast({ id: toastIdRef.current, tone, message }); }, []);`
      `const dismissToast = useCallback(() => setToast(null), []);`. Toast state is **not**
      added to `isRepullGated` (L61-64) — leave that line untouched.
- [x] **Green — error paths.** Replace every `setError(<expr>)` with `showToast('error',
      <expr>)`, keeping each message expression exactly: `loadChores` L91 (`'Failed to load
      chores'` fallback), **and change `loadChores`'s dependency array (L95) from
      `[reconcileChores]` to `[reconcileChores, showToast]`** — `showToast` is a `useCallback`
      value, not a state setter, so `react-hooks/exhaustive-deps` (warn level via
      `reactHooks.configs.recommended` in `eslint.config.js`) flags it otherwise; it is
      `useCallback(…, [])` so `loadChores`'s identity is unchanged. The other four setters live
      in plain `async function`s and need no deps change. `showToast`/`dismissToast` are
      declared before `loadChores` (L83), so the reference resolves; `handleAddChore` L185, `handleDeleteChore` L204,
      `handleCompleteChore` L238, `handleEditChore` L265. Confirm `! grep -qE "setError|error &&"
      frontend/src/App.tsx` (exit 0 = clean).
- [x] **Green — success paths.** Insert after `const created = await addChore(newChore);`
      (L180): `showToast('success', \`Added "${created.name}"\`);`; after `await
      removeChore(id);` (L200): `showToast('success', \`Deleted "${deletedChore.name}"\`);`;
      after `const updated = await updateChore(id, edited);` (L261): `showToast('success',
      \`Saved "${updated.name}"\`);`. No success toast on `handleCompleteChore` (scope is the
      three form-driven mutations), but after `const updated = await completeChore(id, date);`
      (L234) insert `setToast(prev => (prev?.tone === 'error' ? null : prev));` with the
      comment `// F21: no success toast for a bar tap (scope is the three form-driven
      mutations), but a successful retry must retire a standing failure — META-PLAN: the
      next successful mutation replaces it.` (a standing *success* toast is left alone).
      No toast at the optimistic writes L196-197 / L257-258.
- [x] **Green — JSX.** Delete the strip block L319-324 (`{error && (<div className="mb-4 p-3
      bg-red-700 …">…Dismiss…</div>)}`). Insert `{toast && <Toast key={toast.id}
      tone={toast.tone} message={toast.message} onDismiss={dismissToast} />}` inside the
      `.App` root of the **main** return, immediately after the closing `</div>` of the
      `flex flex-col h-full overflow-hidden bg-gray-900 px-4 pt-4` column (before the
      `{showForm && …}` modal line), with a `{/* F21: … */}` comment: inline (not portaled) so the root's
      `inert` covers it while blanked/locked, like the strip it replaces; `fixed`, so DOM
      position is layout-neutral. The scroll region's class string `flex-1 overflow-y-auto
      min-h-0 flex flex-col scroll-pb-40` is unchanged — verify with `grep -c "flex-1
      overflow-y-auto min-h-0 flex flex-col scroll-pb-40" frontend/src/App.tsx` → `1`.
- [x] **e2e — error-strip selectors.** In `e2e/smoke.spec.ts` add near the top (after
      imports) `const ERROR_TOAST = '[data-testid="toast"][data-tone="error"]';`. Replace
      `page.locator('.bg-red-700')` with `page.locator(ERROR_TOAST)` at every
      `page.locator('.bg-red-700')` occurrence used with `not.toBeVisible()` (L86, 108, 122,
      363, 512, 543 before the const is inserted) and at L315 change to `await
      expect(page.locator(ERROR_TOAST)).toBeVisible({ timeout: 5_000 }); await
      expect(page.locator(ERROR_TOAST)).toContainText('Forced error');` and rewrite the L314
      comment so it no longer contains the token `bg-red-700` (e.g. `// App shows the error
      in the red toast with the error message`) — it would otherwise be the last match.
      Confirm `! grep -q "bg-red-700" e2e/smoke.spec.ts` (exit 0 = no match).
- [x] **e2e — toast-proof the `text=<name>` assertions.** The success toasts contain the
      chore name and Playwright's legacy `text=` engine is a case-insensitive substring
      match, so the strict `expect(page.locator('text=<name>'))` assertions would resolve to
      two elements (bar + toast) and throw a non-retriable strict-mode violation. Re-scope
      them to the bar (the file's own idiom at L140/164/184; the toast is
      `bg-green-600`/`bg-red-700`, never `bg-gray-800`) — pre-edit line numbers from
      `grep -n "text=" e2e/smoke.spec.ts` on 2026-09-21: `'adds a new chore via the form'`
      (L137) → `const addedBar = page.locator('.bg-gray-800.rounded-full', { hasText: 'E2E
      Test Chore' }).first(); await expect(addedBar).toBeVisible({ timeout: 5_000 });`
      followed by `await expect(page.getByTestId('toast')).toHaveText('Added "E2E Test
      Chore"'); await expect(page.getByTestId('toast')).toHaveAttribute('data-tone',
      'success');` (web-first assertions poll from ~0 ms, so they see it before the 2.5 s
      dismiss; `data-testid="toast"` is unique — Step 4 puts it on the pill only);
      `'edits a chore via swipe-left'` (L199) → `await
      expect(page.locator('.bg-gray-800.rounded-full', { hasText: 'E2E Edited'
      }).first()).toBeVisible({ timeout: 5_000 });`; the two delete negatives (L167
      `text=E2E Delete Target`, L268 `` text=${name} ``) → `await
      expect(page.locator('.bg-gray-800.rounded-full', { hasText: … })).toHaveCount(0, {
      timeout: 5_000 });`. The non-strict `waitForSelector('text=…')` calls stay, as do the
      two non-mutation `expect(page.locator('text=…'))` lines at L98 (seed-load) and L107
      (an error message) — no toast can share their text. Gate:
      `! grep -qE 'expect\(page\.locator\((.text=E2E|.text=\$\{name)' e2e/smoke.spec.ts`
      (exit 0; scoped to the four names because the file-wide form would still match
      L98/L107 — dry-run: exits 1 on the pre-edit file, 0 on a scratch copy with the four
      lines rewritten).
- [x] Run `npm test --workspace frontend -- src/__tests__/App.test.tsx src/__tests__/App.sync.test.tsx src/__tests__/App.search.test.tsx src/__tests__/App.touchLock.test.tsx src/__tests__/App.screenBlank.test.tsx src/__tests__/App.screenBlank.realClock.test.tsx`
      — green, including the six pre-existing error-text assertions (`'Network error'`,
      `'Delete failed'` ×2, `'Complete failed'`, `'Edit failed'`, `'Add failed'`) and the
      F5 deck describe unchanged. Then `npx tsc -p frontend/tsconfig.json --noEmit` and
      `npm run lint` — `npm run lint` must print **0 problems** (the branch baseline has 0
      warnings; the bare `eslint .` script does not fail on warnings, so read the output); the
      removed `error` state must leave no unused binding. Then run the smoke spec: if `git
      worktree list` shows any `c4i-wt-*` worktree, run it as `env -u PLAYWRIGHT_BASE_URL
      CI=1 npx playwright test e2e/smoke.spec.ts`; otherwise `npx playwright test
      e2e/smoke.spec.ts` (no `c4i-wt-*` worktree exists at plan time — `git worktree list`
      2026-09-21 shows only the main checkout — so the plain form applies unless one is
      created mid-run). If it fails with `… is already used …` / `was not able to start`,
      stop and report the occupied ports (`ss -ltnp` names the listener). Never kill the
      listener, free the port, drop `CI=1`, skip the run, or edit `playwright.config.ts`;
      `/run-plan` treats this as a test failure it cannot auto-fix and stops for the user,
      who re-runs `/run-plan form-polish-date-fix` once the ports are free. All tests green.

### 6. e2e smoke spec: pin the add-form date

Make the off-by-one visible to e2e (the strip-selector migration and the `text=` re-scoping
already landed in Step 5).

**To-do:**
- [ ] In `'adds a new chore via the form'` (L124-146 pre-edit), after the
      `await expect(addedBar).toBeVisible(…)` line Step 5 introduced, add
      `await expect(addedBar).toContainText('Thu Jan 01 2026');` (the bar renders `date.toDateString()`; pre-fix
      in a behind-UTC browser this read `Wed Dec 31 2025`. The browser runs in the host
      zone — `page.clock.setFixedTime` pins the instant, not the zone — so this line is red
      pre-fix only locally; CI's UTC runner is green either way and the TZ-pinned Vitest
      file in Step 1 is the real regression guard). Playwright's `fill()` replaces
      the prefilled default, so the existing five `fill` lines need no change; the
      `beforeEach` `page.clock.setFixedTime(new Date(2025, 0, 15, 12, 0, 0))` means the
      add form's default date is `2025-01-15` in e2e, which `fill` overwrites.
- [ ] Run the smoke spec exactly as Step 5's final to-do does (worktree-conditional `env -u
      PLAYWRIGHT_BASE_URL CI=1` prefix; on `… is already used …` / `was not able to start`
      stop and report the occupied ports (`ss -ltnp` names the listener). Never kill the
      listener, free the port, drop `CI=1`, skip the run, or edit `playwright.config.ts`;
      `/run-plan` treats this as a test failure it cannot auto-fix and stops for the user,
      who re-runs `/run-plan form-polish-date-fix` once the ports are free). All tests green.

### 7. README

Document the form's date semantics, defaults, and the feedback toast — one line each,
without changing the "N days ago" wording.

**To-do:**
- [ ] In the root `README.md` (not `deploy/pi/README.md`), after the paragraph ending "…preview how the bars will look on future
      days." (L31) and before `### Data model` (L33), insert a `### Adding and editing
      chores` H3 with three bullets in the file's `- **Bold lead-in** — explanation` style:
      - `**Dates are local calendar days** — the form's Last Completed field is parsed and
        shown as the browser's local date (\`frontend/src/utils/formDate.ts\`), so a chore
        added today reads "0 days ago" in any timezone. Chores created before this fix were
        stored as UTC midnight and can read one day early in zones behind UTC until their
        next tap-to-complete; re-saving them from the edit form does not drift further.`
      - `**Add-form defaults** — Last Completed starts as today (the real date, even while
        previewing a future day) and Room starts as the active room tab (blank under
        *All*); both stay editable.`
      - `**Feedback toast** — add/save/delete confirmations appear as a green pill at the
        bottom of the screen for ~2.5 s; failures show a red pill that stays until it is
        dismissed with a tap (or its ✕) or a later add/save/delete/tap-to-complete succeeds
        (\`frontend/src/components/common/Toast.tsx\`).`
- [ ] Append to the `- **Timezone** —` bullet under `### First-boot Pi setup` (L131,
      pre-edit; verified 2026-09-21 from the repo root with `sed -n '131p' README.md`): after "Chore
      urgency/completion dates depend on this" insert " (the add/edit form stores the
      browser's local calendar day — see § Adding and editing chores above)", keeping the
      rest of the sentence.
- [ ] From the repo root, confirm `grep -n "days ago" README.md` (root README) shows no change to any pre-existing wording
      (the phrase did not exist before; only the new bullet introduces it).

### 8. Verify All Tests Pass

Run the full suites to confirm nothing is broken, then check the META-PLAN "Expected end
state" facts.

**To-do:**
- [ ] Run `npm test --workspace frontend` and confirm all Vitest tests pass (was 29 files /
      254 tests; now more).
- [ ] Run `npm test --workspace backend` and confirm the backend suite is unchanged and green.
- [ ] Run `npx playwright test` (with the `env -u PLAYWRIGHT_BASE_URL CI=1` prefix when a
      `c4i-wt-*` worktree exists; on `… is already used …` / `was not able to start` stop
      and report the occupied ports (`ss -ltnp` names the listener). Never kill the
      listener, free the port, drop `CI=1`, skip the run, or edit `playwright.config.ts`;
      `/run-plan` treats this as a test failure it cannot auto-fix and stops for the user,
      who re-runs `/run-plan form-polish-date-fix` once the ports are free — as in Step 5)
      and confirm all UI/functional tests pass.
- [ ] Run `npm run lint` and `npx tsc -p frontend/tsconfig.json --noEmit` — both clean.
- [ ] Check the repo-checkable end-state facts from META-PLAN § F21: `! grep -qE "new Date\(formData|toISOString\(\)\.slice" frontend/src/components/form/ChoreForm.tsx`
      → exit 0; `! grep -q "bg-red-700" frontend/src/App.tsx` → exit 0; `test -f
      frontend/src/components/common/Toast.tsx`; `grep -c "flex-1 overflow-y-auto min-h-0
      flex flex-col scroll-pb-40" frontend/src/App.tsx` → `1`; `grep -n -A1 "const isRepullGated"
      frontend/src/App.tsx` shows the gate body still reads only
      `isMutatingRef.current || showForm || editingId !== null || pendingDeleteId !== null`.
- [ ] Investigate and fix any failures before marking the plan finished.

## Status
finished: false
