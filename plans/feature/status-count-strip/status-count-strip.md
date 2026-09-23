# F17 — Status-Count Strip Under the Room Tabs

## Summary
Add a thin, always-visible segmented strip directly under `NavBar` that tallies the **visible**
list (`searchFilteredChores` — room ∧ search) for the **displayed** day (`simulatedDate`):
green = done today, orange = due soon, red = overdue. Segment widths are proportional to the
counts, a zero segment collapses, and an all-zero board renders a full green bar with a centred
`0`. It is live (derived from `choreData` on every render), reuses F16's `classifyStatus` and
the shared `STATUS_BAR_COLOR` tokens (Standing invariant 15), and changes no backend, form,
sort or schema. Spec: `plans/META-PLAN.md` → "## F17".

## Research Findings
- **Status pipeline.** `classifyStatus(daysSince, frequency): ChoreStatus`
  (`frontend/src/utils/choreBarMath.ts:16`) is the one classifier; `STATUS_BAR_COLOR`
  (`frontend/src/assets/constants.ts:9-13`) maps `red`/`orange`/`green` → bare `bg-*-500`
  tokens (no opacity baked in; `ProgressBar.tsx:9` adds `opacity-50` itself). There is **no
  exported `daysSince` helper**: the expression `differenceInDays(startOfDay(day),
  startOfDay(chore.dateLastCompleted))` (date-fns) is written in `ChoreTimerBar.tsx:25-28` and
  in the module-private `daysSinceCompleted` in `choreSort.ts:23-25`. `dateLastCompleted` is
  always a `Date` in the frontend (`choreApi.ts:6`). No `isSameDay` helper exists anywhere.
- **Wiring point.** `App.tsx:337-348`: the `flex flex-col h-full overflow-hidden bg-gray-900
  px-4 pt-4` column renders `NavBar` (:338) → `DateNavigationBanner` (:339-344) →
  `ReturnToTodayButton` (:345) → `ChoreSearchInput` (:346) → `.flex-1.overflow-y-auto` scroll
  region (:347). `searchFilteredChores` (`App.tsx:177-181`) derives from `choreData` via
  `useRoomFilter`, so it is fresh after the optimistic `setChoreData` in `handleCompleteChore`
  (:243) and after the SSE `reconcileChores` (:80-90, `setChoreData` at :81) — independent of
  `sortedIds`.
- **Selector traps (must avoid on the strip).** `document.querySelector('.overflow-y-auto')`
  (first match) in `App.test.tsx:756,774,900` and `App.search.test.tsx:236`; the e2e chore-bar
  selector `.bg-gray-800.rounded-full` `.first()` (`e2e/smoke.spec.ts:78` etc.); `.fixed.inset-0`
  (modal check); `data-testid="chore-bar"`; any `<button>` (tests index
  `getAllByRole('button', …)`). `smoke.spec.ts` has no `nth`/index selectors; its only
  positional call is `.first()` scoped to `.bg-gray-800.rounded-full`, a class pair the strip
  never carries, so the new element shifts nothing.
- **Conventions.** Components: `export default function X({…}: XProps)` with a local
  `type XProps`; nav roots are `flex-shrink-0`; kebab-case `data-testid`s; class strings via
  template literals (no clsx); dynamic sizing via inline `style`. Utils: named exports with
  explicit return types, `@utils` / `@assets` / `@customTypes` aliases, `import type` for types.
  Tests live under `frontend/src/__tests__/{utils,components}/`; fixtures `makeChore` /
  `localNoon` (`__tests__/fixtures/chore.ts`) and `FakeEventSource` / `lastFakeSource`
  (`__tests__/fixtures/fakeEventSource.ts`). App tests mock `services/choreApi` and
  `hooks/useMidnightClock` (one stable hoisted `Date`, 2025-01-15 12:00).
- **Commands.** Frontend: `npm test --workspace frontend` (Vitest 4, jsdom, `css:false` →
  assert class names / inline styles, not computed layout). Backend: `npm test --workspace
  backend` (43 tests). Lint: `npm run lint`. Typecheck: `npx tsc --noEmit -p frontend/tsconfig.json`
  (repo root; clean at baseline). E2E: `npm run test:e2e`.

### Decisions (resolving META-PLAN F17 "Open risks / decisions")
- **(a) Tiny segments →** each rendered segment is a flex item with inline
  `style={{ flexGrow: count, flexBasis: 0 }}` plus Tailwind `min-w-5` (20 px — fits a bold
  2-digit `text-xs` label). Flexbox honours the min-width and distributes the remaining width
  among the other segments in proportion to their counts, so the total still reads as
  proportional and no digit overflows. Tests assert `style.flexGrow === String(count)`.
- **(b) Opacity →** the strip renders at **full opacity** (no opacity utility) for white-text
  contrast, using the **same bare hue tokens** from `STATUS_BAR_COLOR`. Final visual check on
  the Pi is a post-merge follow-up (the sandbox cannot reach the Pi), not a plan gate.
- **(c) Form boundary →** no change; F21 (#46) already makes a form-added "today" chore
  count as done today.
- **(d) Classifier →** import `classifyStatus`; no second classifier, no `0.375` or
  `daysSince > frequency` literal. The `daysSince` expression is written locally in the new
  util (the same way `choreSort.ts` already does, with the same "same expression ChoreTimerBar
  uses" comment) — F17 extracts nothing and does not touch F16's files.
- **Bucketing precedence →** `daysSince === 0` ⇒ `doneToday` (checked first); else
  `classifyStatus` `'red'` ⇒ `overdue`, `'orange'` ⇒ `dueSoon`, `'green'` ⇒ no segment.
  (With `daysSince === 0`, `classifyStatus` always returns green, so there is no double count.)
  A negative `daysSince` (completed after the displayed day) is green-not-today → no segment.
- **Height / spacing →** `h-5` (20 px, inside the spec's 16–20 px), `mt-2` below the NavBar
  border; `DateNavigationBanner`'s own `my-3` spaces it from below. Corners `rounded-sm
  overflow-hidden` (deliberately **not** `rounded-full` + `bg-gray-800`, the e2e chore-bar pair).
- **Accessibility →** the strip root carries `role="img"`, `aria-label` and `title` with the
  full label — always all three counts, e.g. `"3 done today · 2 due soon · 5 overdue"` (zeros
  included); `role="img"` makes the digit children presentational, so the label is announced once.
- **Component API →** presentational: `StatusCountStrip({ counts }: { counts: StatusCounts })`;
  `App.tsx` computes `counts` with `useMemo(() => countStatuses(searchFilteredChores,
  simulatedDate), [searchFilteredChores, simulatedDate])`.

**Prerequisites (Phase 0):** npm/npx, git, grep, env, ss. `cd` is a shell builtin — skip it
(`cd --version` exits 2).

## Steps

### 1. Pure counting util `countStatuses` (TDD)
Create `frontend/src/utils/choreStatusCounts.ts`, test-first.

**To-do:**
- [x] **Red:** — COMPLETE (2026-09-23): precondition clean; 8 cases written, failed (module not found). Precondition — from the repo root, `git status --short frontend/` prints nothing,
  except on a resumed run this step's own two files (`frontend/src/__tests__/utils/choreStatusCounts.test.ts`,
  `frontend/src/utils/choreStatusCounts.ts`) — then continue from the first unmet sub-item. If
  anything else prints, begin the report with `UNRESOLVED — requires user decision/action: stray
  files under frontend/:` plus the list and leave this box unticked; never delete, stash or move
  them. Create
  `frontend/src/__tests__/utils/choreStatusCounts.test.ts` (Vitest; imports
  `{ describe, it, expect } from 'vitest'`, `import type { Chore } from '@customTypes/SharedTypes'`
  (the `due` helper's `Partial<Chore>` — `frontend/tsconfig.json` `include: ["src"]` type-checks tests),
  `{ addDays, subDays } from 'date-fns'`,
  `{ countStatuses } from '@utils/choreStatusCounts'`, `{ makeChore, localNoon } from
  '../fixtures/chore'`). Use `const TODAY = localNoon('2025-03-01')` and a local helper
  `due(id: number, daysSince: number, frequency: number, extra: Partial<Chore> = {})` →
  `makeChore({ id, frequency, dateLastCompleted: subDays(TODAY, daysSince), ...extra })`
  (the `choreSort.test.ts` pattern — exact `daysSince` in every timezone). Cases, each asserting
  the whole object with `toEqual({ doneToday, dueSoon, overdue })`:
  - **mixed board:** `due(1,0,7)` done today, `due(2,5,7)` orange (ratio 2/7 ≤ 0.375),
    `due(3,7,7)` orange (ratio 0 — due today, not overdue), `due(4,9,7)` red, `due(5,20,7)` red,
    `due(6,1,7)` green-not-today → `{ doneToday: 1, dueSoon: 2, overdue: 2 }`;
  - **morning board:** `[due(1,5,7), due(2,9,7), due(3,1,7)]` (no `daysSince` 0) →
    `{ doneToday: 0, dueSoon: 1, overdue: 1 }`;
  - **all green, none today:** `[due(1,1,7), due(2,2,30)]` → `{ doneToday: 0, dueSoon: 0,
    overdue: 0 }`;
  - **empty list** `[]` → `{ 0, 0, 0 }`;
  - **re-completed green counts as done today:** a chore completed earlier on the displayed day
    (`dateLastCompleted: new Date(2025, 2, 1, 8, 0)`, 08:00 before the noon `TODAY`) →
    `doneToday: 1`; and the same chore completed yesterday → no segment;
  - **completion after the displayed day:** `dateLastCompleted: addDays(TODAY, 1)` (negative
    `daysSince`) → no segment;
  - **status comes from `classifyStatus`:** `frequency: 0` with `daysSince: 3` → no segment
    (matches `classifyStatus(3, 0) === 'green'`);
  - **room + search narrowing is the caller's:** board `[due(1,0,7,{ room: 'Kitchen', name:
    'Sweep' }), due(2,9,7,{ room: 'Kitchen', name: 'Mop' }), due(3,9,7,{ room: 'Bathroom', name:
    'Scrub' })]`; the Kitchen filter → `{ doneToday: 1, dueSoon: 0, overdue: 1 }`; Kitchen ∧ name
    includes `'mop'` → `{ doneToday: 0, dueSoon: 0, overdue: 1 }` — documents that the util counts
    exactly what it is given.
  Run `cd frontend && npx vitest run src/__tests__/utils/choreStatusCounts.test.ts` → fails
  (module not found).
- [x] **Green:** — COMPLETE (2026-09-23): 8/8 pass. Create `frontend/src/utils/choreStatusCounts.ts`:
  - file-top comment: F17 status-count strip tally; counts via `classifyStatus` (Standing
    invariant 15) so strip, bar and sort never disagree (do not name the thresholds in
    comments — the Refactor/verify grep matches comments too);
  - `import { differenceInDays, startOfDay } from 'date-fns';`
    `import type { Chore } from '@customTypes/SharedTypes';`
    `import { classifyStatus } from '@utils/choreBarMath';`
  - `export type StatusCounts = { doneToday: number; dueSoon: number; overdue: number };`
  - `export function countStatuses(chores: Chore[], day: Date): StatusCounts` — loop once;
    `const daysSince = differenceInDays(startOfDay(day), startOfDay(chore.dateLastCompleted));`
    (comment: "Same expression ChoreTimerBar and choreSort use, so strip, bar and sort agree");
    `if (daysSince === 0) doneToday++; else { const status = classifyStatus(daysSince,
    chore.frequency); if (status === 'red') overdue++; else if (status === 'orange') dueSoon++; }`.
  Re-run the test file → all pass.
- [x] **Refactor/verify:** — COMPLETE (2026-09-23): tsc clean, lint clean, grep exit 1. `npx tsc --noEmit -p frontend/tsconfig.json` (repo root) clean; `npm run
  lint` (repo root) clean; `grep -n "0.375\|> frequency\|> chore.frequency"
  frontend/src/utils/choreStatusCounts.ts` (repo root) returns nothing (no output, exit 1 = pass; exit 2 = file missing = fail; run it
  standalone, not chained with `&&`).

### 2. Presentational `StatusCountStrip` component (TDD)
Create `frontend/src/components/nav/StatusCountStrip.tsx`, test-first.

**To-do:**
- [x] **Red:** — COMPLETE (2026-09-23): 8 cases written (7 plan cases; accessible-label split in two), failed (module not found). create `frontend/src/__tests__/components/StatusCountStrip.test.tsx`
  (`{ describe, it, expect } from 'vitest'` (`frontend/tsconfig.json` type-checks tests and has no
  vitest-globals types); `render, screen` from `@testing-library/react`; `StatusCountStrip from
  '../../components/nav/StatusCountStrip'`; `{ STATUS_BAR_COLOR } from '@assets/constants'`).
  Test IDs: root `status-count-strip`; segments `status-count-done-today`,
  `status-count-due-soon`, `status-count-overdue`. Cases:
  - **proportional widths:** `counts={{ doneToday: 3, dueSoon: 2, overdue: 5 }}` → each
    segment's `style.flexGrow` is `'3'` / `'2'` / `'5'` and `style.flexBasis` is `'0px'` or `'0'`
    (assert with `toMatch(/^0(px)?$/)`), text content `'3'` / `'2'` / `'5'`, rendered in order
    done-today → due-soon → overdue (`strip.children` order);
  - **zero segment absent:** `{ 0, 4, 1 }` → `queryByTestId('status-count-done-today')` is null,
    the other two present;
  - **all zero:** `{ 0, 0, 0 }` → exactly one child, `status-count-done-today`, text `'0'`,
    `style.flexGrow === '1'`, class contains `STATUS_BAR_COLOR.green`; the other two absent;
  - **labels bold/white:** every rendered segment's `className` contains `font-bold` and
    `text-white` and `min-w-5`;
  - **accessible label:** `screen.getByRole('img', { name: '3 done today · 2 due soon · 5
    overdue' })` exists and its `title` equals the same string; all-zero gives `'0 done today ·
    0 due soon · 0 overdue'`;
  - **colour tokens equal the bar's:** done-today class contains `STATUS_BAR_COLOR.green`,
    due-soon `STATUS_BAR_COLOR.orange`, overdue `STATUS_BAR_COLOR.red`; no segment class
    contains `opacity-`;
  - **layout/selector safety:** root class contains `flex-shrink-0`, does not contain
    `overflow-y-auto`, `rounded-full` or `bg-gray-800`; `queryAllByRole('button')` is empty.
  Run `cd frontend && npx vitest run src/__tests__/components/StatusCountStrip.test.tsx` → fails.
- [x] **Green:** — COMPLETE (2026-09-23): 8/8 pass. create `frontend/src/components/nav/StatusCountStrip.tsx`:
  - `import { STATUS_BAR_COLOR } from '@assets/constants';`
    `import type { ChoreStatus } from '@assets/constants';`
    `import type { StatusCounts } from '@utils/choreStatusCounts';`
  - `type StatusCountStripProps = { counts: StatusCounts };`
  - module const `SEGMENTS: { key: keyof StatusCounts; testId: string; status: ChoreStatus }[]`
    = `[{ key: 'doneToday', testId: 'status-count-done-today', status: 'green' }, { key:
    'dueSoon', testId: 'status-count-due-soon', status: 'orange' }, { key: 'overdue', testId:
    'status-count-overdue', status: 'red' }]` (colours are **looked up** in `STATUS_BAR_COLOR`,
    never literals);
  - `export default function StatusCountStrip({ counts }: StatusCountStripProps)`:
    `const label = \`${counts.doneToday} done today · ${counts.dueSoon} due soon ·
    ${counts.overdue} overdue\`;` `const total = counts.doneToday + counts.dueSoon +
    counts.overdue;` `const shown = total === 0 ? [{ ...SEGMENTS[0], count: 0, grow: 1 }] :
    SEGMENTS.filter(s => counts[s.key] > 0).map(s => ({ ...s, count: counts[s.key], grow:
    counts[s.key] }));`
  - root: `<div data-testid="status-count-strip" role="img" aria-label={label} title={label}
    className="flex flex-shrink-0 w-full h-5 mt-2 rounded-sm overflow-hidden">`;
    each segment: `<div key={s.key} data-testid={s.testId} className={\`${STATUS_BAR_COLOR[s.status]}
    min-w-5 flex items-center justify-center text-xs font-bold text-white leading-none\`}
    style={{ flexGrow: s.grow, flexBasis: 0 }}>{s.count}</div>`;
  - brief comment explaining the `min-w-5` + `flexGrow` choice (decision (a)) and full opacity
    (decision (b)) (refer to the tokens as `STATUS_BAR_COLOR`, never spell `bg-*-500` class
    names — the Refactor/verify grep matches comments).
  Re-run the test file → all pass.
- [x] **Refactor/verify:** — COMPLETE (2026-09-23): tsc clean, lint clean, grep exit 1. `npx tsc --noEmit -p frontend/tsconfig.json` (repo root) and `npm run
  lint` clean; `grep -nE "bg-(red|orange|green)-500" frontend/src/components/nav/StatusCountStrip.tsx`
  (repo root) returns nothing (tokens come only from `STATUS_BAR_COLOR`; no output, exit 1 = pass; exit 2 = file missing = fail; run it
  standalone, not chained with `&&`).

### 3. Wire the strip into `App.tsx` + App-level tests (TDD)
Render the strip immediately after `NavBar`, fed from `searchFilteredChores` + `simulatedDate`.

**To-do:**
- [x] **Red:** — COMPLETE (2026-09-23): 6 cases written, all failed (no `status-count-strip`). create `frontend/src/__tests__/App.statusStrip.test.tsx` by cloning the header
  of `App.sync.test.tsx` (the `choreApi` `vi.mock`, the hoisted stable `mockDay = new Date(2025,
  0, 15, 12, 0, 0)` `useMidnightClock` mock, the inert `useScreenBlank` / `useTouchLock` mocks,
  and the `beforeEach` `FakeEventSource.instances = []` + `vi.stubGlobal('EventSource',
  FakeEventSource …)` / `afterEach` `vi.unstubAllGlobals()`; import `fireEvent` too; cases that use `user.*` begin with `const user = userEvent.setup();`, the
  App.sync.test.tsx pattern). Helper
  `stripLabel = () => screen.getByTestId('status-count-strip').getAttribute('aria-label')`.
  Every case renders `<App />` and first runs `await waitFor(() =>
  expect(screen.getByText('Sweep')).toBeInTheDocument())` (the App.sync.test.tsx pattern; the strip
  is absent while `loading`) before its first label assertion.
  Board chores: `makeChore({ id, name, room, frequency: 7, dateLastCompleted })` with
  `dateLastCompleted: new Date(2025, 0, 1, 12, 0)` for overdue (daysSince 14 > 7). Cases:
  - **position:** after load, `document.getElementById('NavBar')!.nextElementSibling` is
    `getByTestId('status-count-strip')`; the strip precedes `getByRole('heading', { level: 1 })`
    (`strip.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING` truthy); the
    strip is **not** inside `document.querySelector('.overflow-y-auto')`; and
    `document.querySelector('.overflow-y-auto')` is still the scroll region whose
    `lastElementChild` is `getByTestId('add-task-deck')`;
  - **live after optimistic complete:** one overdue `Sweep` → label `'0 done today · 0 due soon ·
    1 overdue'`; hold `completeChore` pending (`let resolve!: (c: Chore) => void;
    vi.mocked(completeChore).mockReturnValue(new Promise(r => { resolve = r; }))`); pin the click
    time as `App.test.tsx:221-227` does (`vi.useFakeTimers({ now: new Date(2025, 0, 15, 14, 0,
    0) })`, `fireEvent.click(screen.getByText('Sweep'))`, `finally vi.useRealTimers()`); then
    `await waitFor(() => expect(stripLabel()).toBe('1 done today · 0 due soon · 0 overdue'))`
    **before** resolving; finally `await act(async () => { resolve(makeChore({ id: 1, name:
    'Sweep', room: 'Kitchen', frequency: 7, dateLastCompleted: new Date(2025, 0, 15, 14, 0) }));
    })` (import `act` from `@testing-library/react`) and then assert the label is still
    `'1 done today · 0 due soon · 0 overdue'` (server reconcile keeps it);
  - **live after SSE re-pull:** initial overdue `Sweep`; `vi.mocked(fetchAllChores)
    .mockResolvedValue([…Sweep with dateLastCompleted: new Date(2025, 0, 15, 9, 0)])`;
    `lastSource().emit('message')`; `await waitFor` label `'1 done today · 0 due soon · 0 overdue'`;
  - **narrows on room tab:** overdue `Sweep` (Kitchen) + overdue `Scrub` (Bathroom) → label `'0 done
    today · 0 due soon · 2 overdue'`; `await user.click(screen.getByRole('button', { name:
    'Kitchen' }))` → `await waitFor` label `'0 done
    today · 0 due soon · 1 overdue'`;
  - **follows the displayed day (simulatedDate):** board `Sweep` (Kitchen, frequency 7,
    `dateLastCompleted: new Date(2025, 0, 15, 9, 0)`) → label `'1 done today · 0 due soon · 0
    overdue'`; `await user.click(screen.getByRole('button', { name: 'Next day' }))`
    (`DateNavigationBanner.tsx:50`) → `await waitFor` label `'0 done today · 0 due soon · 0
    overdue'` (daysSince 1, ratio 6/7 → green-not-today). Fails if the strip is fed `realToday`
    / `new Date()` instead of `simulatedDate`;
  - **narrows on search:** the room-tab case's board (overdue `Sweep`/Kitchen + overdue
    `Scrub`/Bathroom, room tab left on All); `await user.type(screen.getByPlaceholderText('Search
    for a chore'), 'Scr')` → `await waitFor` label `'0 done today · 0 due soon · 1 overdue'`.
  Run `cd frontend && npx vitest run src/__tests__/App.statusStrip.test.tsx` → fails (no strip).
- [x] **Green:** — COMPLETE (2026-09-23): 6/6 pass. in `frontend/src/App.tsx`:
  - add `import StatusCountStrip from './components/nav/StatusCountStrip';` after the `NavBar`
    import (`App.tsx:9`) and `import { countStatuses } from './utils/choreStatusCounts';` next to
    the existing relative `./utils/choreSort` import (`App.tsx:8`);
  - after the `searchFilteredChores` `useMemo` (`App.tsx:177-181`) add
    `const statusCounts = useMemo(() => countStatuses(searchFilteredChores, simulatedDate),
    [searchFilteredChores, simulatedDate]);` with a one-line comment (live from `choreData`,
    never from `sortedIds` — F17);
  - insert `<StatusCountStrip counts={statusCounts} />` between `<NavBar … />` (:338) and
    `<DateNavigationBanner` (:339) — pre-edit line numbers (≈:342/:343 after the import and
    `useMemo` edits above), so match on the text. Touch nothing else (re-sort triggers unchanged — Standing
    invariant 15).
  Re-run the new file → all pass.
- [x] **Regression:** — COMPLETE (2026-09-23): 344 tests / 35 files pass (+6 new); tsc clean; lint clean. run `npm test --workspace frontend` — all existing suites (notably
  `App.test.tsx`, `App.search.test.tsx`, `App.sync.test.tsx`) stay green; total count rises by
  the new tests only. `npx tsc --noEmit -p frontend/tsconfig.json` (repo root) and `npm run lint`
  clean.

### 4. README one-liner
Describe the strip in the UI overview prose.

**To-do:**
- [x] — COMPLETE (2026-09-23): paragraph added at `README.md:44-46`; grep verified. In the repo-root `README.md` (not `deploy/pi/README.md` or `.github/rulesets/README.md`),
  immediately after the timer-bar paragraph ending "…preview how the bars
  will look on future days." (`README.md:40-42`, before `### Adding and editing chores`), add a
  new paragraph wrapped at ~95 chars, e.g.: "A thin strip under the room tabs tallies the visible
  list for the displayed day — green = done today, orange = due soon, red = overdue — with segment
  widths proportional to the counts (`frontend/src/components/nav/StatusCountStrip.tsx`)."
  Verify from the repo root with `grep -n "StatusCountStrip" README.md`.

### 5. Verify All Tests Pass
Run the full suites and the repo-checkable Expected-end-state facts.

**To-do:**
- [x] `npm test --workspace frontend` — COMPLETE (2026-09-23) — 344 tests / 35 files — all pass; record the new total inline on this box when ticking it, e.g.
  `— 3xx tests / 35 files` (baseline 322 tests / 32 files at plan time).
- [x] `npm test --workspace backend` — 43 pass, unchanged. — COMPLETE (2026-09-23): 43/43, 5 files.
- [x] — COMPLETE (2026-09-23): lint clean, tsc clean, build OK (2074 modules). `npm run lint` and `npx tsc --noEmit -p frontend/tsconfig.json` (repo root) — clean;
  `npm run build --workspace frontend` succeeds.
- [x] — COMPLETE (2026-09-23): 14/14 passed first attempt, no port retries. Playwright smoke: this checkout is a `c4i-wt-*` worktree, so run
  `env -u PLAYWRIGHT_BASE_URL CI=1 npx playwright test e2e/smoke.spec.ts` from the repo root. On
  `… is already used …` / `Process from config.webServer was not able to start`, retry roughly
  every 30 s (jittered) for up to ~10 min; if still blocked, stop and report the occupied ports
  (`ss -ltnp`, read-only): begin the report line with `UNRESOLVED — requires user
  decision/action:` and leave this box unticked — /run-plan stops, and the user re-runs
  `/run-plan status-count-strip` once the ports are free (Step 5 is re-selected). Never kill a listener, drop `CI=1`, or edit `playwright.config.ts`.
- [x] — COMPLETE (2026-09-23): all greps matched; `<StatusCountStrip counts={statusCounts} />` at App.tsx:346 directly after `<NavBar` at :345. Expected-end-state greps (repo root): `grep -n 'data-testid="status-count-strip"'
  frontend/src/components/nav/StatusCountStrip.tsx`; `grep -n "StatusCountStrip"
  frontend/src/App.tsx` shows the import and the element, and `grep -n -A1 "<NavBar"
  frontend/src/App.tsx` shows `<StatusCountStrip counts={statusCounts} />` on the line directly
  after `<NavBar … />`;
  `grep -n "export function countStatuses" frontend/src/utils/choreStatusCounts.ts`;
  `grep -n "classifyStatus" frontend/src/utils/choreStatusCounts.ts`.
- [x] — N/A, all checks passed (2026-09-23). Investigate and fix any failures before marking the plan finished (tick as `— N/A, all
  checks passed` when nothing failed; tick it only once every other Step 5 box is ticked — after an
  occupied-port stop it is ticked by the resumed run).

## Notes
- **Post-merge follow-up (not a plan gate):** eyeball strip height (`h-5`) and full-opacity
  contrast on the Pi kiosk; adjust only the Tailwind height/opacity class if needed (hue tokens
  stay `STATUS_BAR_COLOR`).
- **Orchestrator Playwright runs (for `/run-plan`):** this checkout is a `c4i-wt-*` worktree
  (sibling `c4i-wt-scroll-to-top` exists) — for every orchestrator-level Playwright run (every
  per-step UI smoke — Steps 1, 2 and 3 all change frontend code — and the final UI suite) use `env -u PLAYWRIGHT_BASE_URL CI=1
  npx playwright test e2e/smoke.spec.ts` in place of `$UI_RUNNER_CMD`, and copy these rules word for word into the
  smoke/UI subagent prompt: on `… is already used …` or `Process from config.webServer was not
  able to start`, retry roughly every 30 s (jittered) for up to ~10 min; if still blocked, report
  the occupied ports (`ss -ltnp`, read-only). Never kill a listener, free a port, drop `CI=1`, or
  edit `playwright.config.ts` (the error text suggests `reuseExistingServer:true` — ignore it).
  **An occupied-port failure is NOT a test failure — do not enter the Test Fix Loop (2e) for
  it**; stop the run and report `UNRESOLVED — requires user decision/action: ports 3000/5174
  occupied`; the user re-runs `/run-plan status-count-strip` once they are free. If this happens at a
  per-step smoke, the step already passed its own validation — run the 2d commit subagent for it
  first, then stop (keeps one commit per step).
- **Load failure shows a green `0` (accepted):** if the initial `fetchAllChores` rejects,
  `choreData` stays `[]` and the strip renders the spec's all-zero full-green `0` beside the
  error toast. This follows the spec's empty-list rule; the toast explains the state, so no
  extra handling (a load-error flag would widen F17's scope).
- **Rollback not separately tested (accepted):** a rejected `completeChore` restores the chore
  via the same `setChoreData` → `searchFilteredChores` → `statusCounts` path the optimistic case
  covers; rollback itself is covered in `App.test.tsx`.
- `choreSort.test.ts:67` has a test-local helper also named `countStatuses`; it is file-scoped
  and does not import the new util — no conflict.

## Status
finished: true
