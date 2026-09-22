# F16 — Status-bucketed midnight re-sort with red-quota escalation + Urgency weighting

## Summary
Replace the single `duration × daysSince/frequency` scorer in `frontend/src/utils/choreSort.ts`
with a deterministic bucket → rank → quota-fill pipeline: chores are bucketed red / orange /
green by the *same* classifier the timer bar paints with, ranked inside each bucket by what
matters for that bucket, and the first `SORT_FOLD` (8) slots are filled 4/2/2 with donation and a
red-escalation rule driven by how many chores are badly overdue. `urgency` becomes a sort-only
multiplier on overdue-ness. Triggers are unchanged (`reconcileChores` on first load / newly-seen
ids, and the `simulatedDate` effect in `App.tsx` at midnight / day-sim steps), as is the
`orderChores(chores, today): Chore[]` signature. Spec: `plans/META-PLAN.md` § F16.

## Research Findings
- Research done inline (frontend-only, ~5 files touched). Cold survey confirmed the Assumed
  starting state: `choreSort.ts` exports only `calcDurationWeightedScore` + `orderChores`;
  `App.tsx` imports only `orderChores` (L87 `reconcileChores`, L162 `simulatedDate` effect);
  `urgency` is read only by `components/form/ChoreForm.tsx`; `computeBar` in
  `utils/choreBarMath.ts` is the sole classifier and reads `statusColors` (`0.375`) from
  `assets/constants.ts` (`statusColors` is read nowhere else).
- `computeBar(daysSince, frequency)`: red iff `frequency > 0 && daysSince > frequency`;
  else `remainingRatio = frequency > 0 ? (frequency − daysSince)/frequency : 1` → first
  `statusColors` entry with `remainingRatio > threshold` (green `> 0.375`, orange otherwise).
  So `frequency === 0` → green. `ChoreTimerBar.tsx` L25–26 computes `daysSince =
  differenceInDays(startOfDay(day), startOfDay(chore.dateLastCompleted))` — the sort must use
  the identical expression. The sort's `today` is the same `simulatedDate` Date the bars get.
- Wire shape (review-traced): `urgency` reaching the sort is always `'low'|'medium'|'high'|undefined`
  (backend maps SQL NULL → undefined; a CHECK rejects `''`); `dateLastCompleted` is a `Date` on
  every path into `sortedIds`. First load is sorted by `reconcileChores` with the mocked/real
  `simulatedDateRef.current` (the `simulatedDate` effect is a no-op on mount — empty data).
- Order-asserting App tests (`App.test.tsx` "frozen sort order" block ≈L433–557,
  `App.search.test.tsx` "preserves sort order among matches" ≈L143) all mock `useMidnightClock`
  and were hand-checked against the new algorithm: every expected order still holds (midnight
  test day1: B red `4/7` vs A orange → [B, A]; day2: A red ratio 4 vs B red `8/7` → [A, B]).
  Only explanatory comments need rewriting. `App.sync.test.tsx` asserts presence/absence only
  (no order) — no change. `e2e/smoke.spec.ts` asserts no order.
- Baselines (HEAD 433c1c4): frontend `npx vitest run` → 32 files / 296 tests; backend → 8 files /
  73 tests; `cd frontend && npx tsc --noEmit -p .` exits 0 (`vite build` does not typecheck).
- `calcDurationWeightedScore` is imported only by `choreSort.test.ts` and named in `README.md`
  L23 → safe to delete.
- **Open-risk resolutions:** (a) `SORT_FOLD`, 4/2/2, pressure threshold `1` and 0.75/1/1.5 ship
  as the spec's first guesses in named constants with tuning comments; on-Pi tuning is a
  post-merge follow-up. (b) boards smaller than `SORT_FOLD` get a dedicated test documenting
  "reds, then oranges, then greens". (c) no date-math change. (d) resolved by extracting
  `classifyStatus` into `choreBarMath.ts` (the `classifyStatus(daysSince, frequency)` helper F17
  expects) and making `computeBar` derive its colour from it. Fold-back note: Standing invariant
  **14** is already taken (F21), so the sort ↔ bar agreement contract becomes **Standing
  invariant 15** at Phase C. Phase C must also rewrite the Baseline **Sort** paragraph and amend
  Standing invariant 11's clause "`orderChores` is a single duration-weighted sort with no
  long-term partition" to "`orderChores` has no long-term partition (F4); since F16 it is the
  status-bucketed quota sort (Standing invariant 15)".
- Branch note: an unrelated `.gitignore` line (`graphify-out/*`) and the META-PLAN ledger row
  (`in-progress`) are uncommitted on this branch; per the user they ride in the first commit.

**Prerequisites (Phase 0):** npm/npx, git, grep, env, ss. `cd` is a shell builtin — skip it
(`cd --version` exits 2).

## Steps

### 1. Shared status classifier + sort constants
Extract one `classifyStatus` that both `computeBar` and the sort use, and add the tunable sort constants.

**To-do:** — COMPLETE (2026-09-22): barMath test 19 tests (8 Red → green); `src/__tests__/components/` 18 files / 150 tests green; full `npx vitest run` 304 tests green; tsc exit 0; `npm run lint` no problems.
- [x] **Red:** in `frontend/src/__tests__/components/ChoreTimerBar.barMath.test.ts`, add a
  `describe('classifyStatus')`, importing `classifyStatus` (alongside the existing `computeBar`)
  from `@utils/choreBarMath` and `STATUS_BAR_COLOR` from `@assets/constants`, asserting:
  `(0,10)→'green'`, `(5,10)→'green'`, `(5,8)→'orange'` (ratio exactly 0.375), `(10,10)→'orange'`
  (due, not overdue), `(11,10)→'red'`, `(0,0)→'green'` and `(99,0)→'green'` (frequency 0 never
  red), and an agreement loop: for `frequency` in `[0, 1, 3, 7, 8, 10]` and `daysSince` in
  `-1..(2·frequency+2)`, `computeBar(d,f).barColor` equals `STATUS_BAR_COLOR[classifyStatus(d,f)]`
  and `computeBar(d,f).isOverdue === (classifyStatus(d,f) === 'red')`. Run
  `cd /home/rmila/Code/chores4irl/frontend && npx vitest run src/__tests__/components/ChoreTimerBar.barMath.test.ts`
  → fails (no export).
- [x] **Green:** in `frontend/src/assets/constants.ts`:
  - add `export type ChoreStatus = 'red' | 'orange' | 'green';`
  - add, above `statusColors`, `export const STATUS_BAR_COLOR: Record<ChoreStatus, string> =
    { red: 'bg-red-500', orange: 'bg-orange-500', green: 'bg-green-500' };` with a comment that it
    is the single status → bar-fill map (bare colour, no opacity utility — same rule as
    `BarMathResult.barColor`).
  - change `StatusColor` to `{ threshold: number; status: Exclude<ChoreStatus, 'red'> }` — **drop
    the `color` field** (nothing reads it once `STATUS_BAR_COLOR` exists) — and make the two
    entries `{ threshold: 0.375, status: 'green' }` / `{ threshold: -Infinity, status: 'orange' }`,
    keeping their trailing comments. Keep the header comment block and the `-Infinity` invariant
    comment, but change their references to `computeBar` to `classifyStatus` (in
    `utils/choreBarMath.ts`), which now owns the red check and the
    `?? statusColors[statusColors.length - 1]` fallback; the "Red is deliberately absent"
    sentence stays true.
- [x] **Green:** in `frontend/src/utils/choreBarMath.ts`, add and export
  `classifyStatus(daysSince: number, frequency: number): ChoreStatus` — returns `'red'` when
  `frequency > 0 && daysSince > frequency`; otherwise computes `remainingRatio` exactly as
  `computeBar` does and returns `(statusColors.find(s => remainingRatio > s.threshold) ??
  statusColors[statusColors.length - 1]).status`. Refactor `computeBar` to call it:
  `const status = classifyStatus(daysSince, frequency); const isOverdue = status === 'red';`
  keep the `remainingRatio` / `barWidth` math as-is, and set `barColor = STATUS_BAR_COLOR[status]`,
  deleting the old `let barColor … if (isOverdue) … else statusColors.find(...)` block. Imports
  become `import { statusColors, STATUS_BAR_COLOR } from '@assets/constants';` plus
  `import type { ChoreStatus } from '@assets/constants';` (the repo uses separate `import type`
  statements, never inline `type` modifiers). Leave a one-line comment on `classifyStatus` that it
  is the one status classifier shared by the bar and `orderChores` (F16) — thresholds move here,
  never in the sort.
- [x] **Green:** in `constants.ts`, add the sort constants, each with a one-line comment on what
  it tunes (first guesses — re-tune on the Pi via the day simulator and record final values here).
  Add `import type { Chore } from '@customTypes/SharedTypes';` at the top of `constants.ts`.
  ```ts
  // Chores visible above the fold on the kiosk (≈ one unscrolled screen of h-20 bars).
  export const SORT_FOLD = 8;
  // Base fold split per status; must sum to SORT_FOLD.
  export const SORT_BASE_QUOTA: Record<ChoreStatus, number> = { red: 4, orange: 2, green: 2 };
  // A red chore counts toward escalation pressure once its urgency-weighted
  // overdueRatio reaches this (1 = at least 2× its frequency has elapsed).
  export const SORT_PRESSURE_THRESHOLD = 1;
  // Sort-only weighting of a red chore's overdueRatio (bar colour ignores urgency); unset urgency uses `medium`.
  export const SORT_URGENCY_MULTIPLIER: Record<NonNullable<Chore['urgency']>, number> = { low: 0.75, medium: 1, high: 1.5 };
  ```
- [x] Gates, from `/home/rmila/Code/chores4irl/frontend`: `npx vitest run src/__tests__/components/`
  → green; `npx tsc --noEmit -p .` → exit 0; from the repo root `npm run lint` → prints no problems (`eslint .` exits 0 on warnings, so read the output; baseline prints none).

### 2. Rewrite `orderChores` as bucket → rank → quota-fill (TDD), App-test comments and README
Replace the scorer one guarantee at a time, then bring the App-test comments and README in line so this step's commit is green and self-consistent.

**To-do:**
- [ ] Rewrite `frontend/src/__tests__/utils/choreSort.test.ts` (drop the `calcDurationWeightedScore`
  describe block). Imports (path aliases throughout, separate `import type`):
  `describe, it, expect` from `vitest`; `import type { Chore } from '@customTypes/SharedTypes'`;
  `subDays` from `date-fns`; `orderChores` from `@utils/choreSort`; `makeChore, localNoon` from
  `../fixtures/chore`; plus `classifyStatus` / `computeBar` from `@utils/choreBarMath` and
  `SORT_FOLD` from `@assets/constants` only if a test uses them (an unused `classifyStatus`/`computeBar` import fails
  `@typescript-eslint/no-unused-vars`; SCREAMING_CASE names like `SORT_FOLD` are exempt via
  `varsIgnorePattern: '^[A-Z_]'`, so drop an unused one by hand). Add `const TODAY = localNoon('2025-03-01');` and a local
  helper `due(id: number, daysSince: number, frequency: number, extra: Partial<Chore> = {}) =>
  makeChore({ id, frequency, dateLastCompleted: subDays(TODAY, daysSince), ...extra })`
  (`subDays` keeps TODAY's local noon, so `daysSince` round-trips exactly through
  `differenceInDays(startOfDay(...))` in every timezone). For fold-composition assertions, keep a
  per-test `Map<id, ChoreStatus>` (or compute `classifyStatus(daysSince, frequency)` from the
  `daysSince`/`frequency` you passed to `due()`) and map the output ids through it — never
  re-derive status from the output dates. **Fixture recipe** for boards given only by counts
  (tests 8–12, 19): pressured red = `due(id, 10 + k, 5)` (medium, weighted (5+k)/5 ≥ 1, k = 0..5);
  non-pressured red = `due(id, 20 + k, 20)` for k = 1..10 (raw 0.05–0.5, distinct); orange =
  `due(id, 10 + k, 16)` for k = 0..6 (remainingRatio 0.375 → 0, distinct); green = `due(id, k, 30)`
  for k = 0..9 (distinct `daysSince`). Give each board in reversed expected order.
- [ ] Write the tests below **one at a time** (Red → Green in `choreSort.ts` → next) — a test that
  already passes against the current code (e.g. 1) is kept as-is and noted; do not alter it to
  force a Red. Each asserts on `orderChores(list, TODAY).map(c => c.id)` (or statuses of that
  list). **Every test except 1, 16 and 20 supplies its chores in an input order that differs
  from the expected output (e.g. reversed, or the expected-last chore first), so a stable sort
  ignoring the rank key would fail; test 16 is the only one whose input order equals its
  expected order.** If a test passes on its first run against the old scorer, confirm its input
  order is non-trivial before moving on.
  1. empty input → `[]`.
  2. **bucket order on a small board (< SORT_FOLD):** red, orange, green chores given in mixed
     input order → all reds, then oranges, then greens (documents open-risk (b)).
  3. **bucket ↔ `computeBar` agreement:** board (given shuffled) f8/d4, f8/d5, f8/d8, f8/d9,
     f0/d30, f1/d1, f1/d2 (`fN/dM` = frequency N, daysSince M). Mapping each output chore to
     `computeBar(daysSince, frequency).barColor` gives exactly `[red, red, orange, orange, orange,
     green, green]` (`bg-red-500` ×2, `bg-orange-500` ×3, `bg-green-500` ×2). Expected buckets: red =
     f1/d2 (ratio 1), f8/d9 (ratio 0.125); orange = f8/d8 and f1/d1 (remaining 0, tie → input
     order), then f8/d5 (remaining exactly 0.375); green = f8/d4, f0/d30.
  4. **a 10-day-overdue 2-min chore outranks a green 60-min chore** (2-min every-3-days at
     daysSince 13 vs 60-min weekly at daysSince 3; input green first).
  5. **among reds, larger overdueRatio ranks higher regardless of duration** (2-min at ratio 2
     above 90-min at ratio 0.5); equal overdueRatio → larger `duration` first.
  6. **orange ranked by remainingRatio ascending** (closest to due first).
  7. **green ranked most-recently-completed first** (`daysSince` ascending).
  8. **quota fill 4/2/2 on a mixed board:** 6 reds (all raw ratio < 1, so pressure 0), 4 oranges,
     4 greens → first 8 = top-4 reds, top-2 oranges, top-2 greens; then remaining 2 reds,
     2 oranges, 2 greens in bucket order.
  9. **donation:** (a) 1 red, 5 oranges, 5 greens → fold = 1 red, 5 oranges (red's 3 unused slots
     donate to red first — none left — then orange), 2 greens; then 3 greens. (b) board: 6 reds
     (all raw ratio < 1), 0 oranges, 3 greens → fold = 6 reds + 2 greens (orange's 2 slots go to
     red); then 1 green.
  10. **escalation:** board of 8 reds + 2 oranges + 2 greens, all non-pressured reds at raw ratio
      < 1: (a) with 4 reds at weighted ratio ≥ 1 → fold is all 8 reds (`redQuota = min(8, 4+4)`),
      then 2 oranges, 2 greens; (b) with exactly 2 pressured reds → fold 6 reds / 0 oranges /
      2 greens (orange quota drained first), then 2 reds, 2 oranges.
  11. **escalation branches (DD-4):** same 8r/2o/2g board shape: (a) pressure 3 → fold 7 reds /
      0 oranges / 1 green (green quota partially reduced: `2 − (3 − 2)`), then 1 red, 2 oranges,
      1 green; (b) inclusive threshold — board of 5 reds (one medium at f5/d10 = weighted exactly 1,
      four at raw ≤ 0.5), 2 oranges, 2 greens → fold 5r/1o/2g; replacing that chore with f10/d19
      (weighted 0.9) → fold 4r/2o/2g; (c) pressure beyond fold capacity — 10 reds with 6 pressured + 2 oranges +
      2 greens → fold is 8 reds, then 2 reds, 2 oranges, 2 greens; output length 14 with every input
      id exactly once (the `min(SORT_FOLD, …)` clamp is defensive and has no observable effect).
  12. **all-one-bucket boards larger than SORT_FOLD (DD-4):** 10 greens → all 10 in `daysSince`
      ascending; 10 non-pressured reds → all 10 in weighted-overdue descending (donation pours
      every fold slot into the one bucket; tail follows in bucket order).
  13. **urgency flips rank at the same daysSince:** two reds with identical `frequency`/`daysSince`
      (raw ratio 0.8), input `[low, high]` → `high` first; a `low` chore at raw ratio 1.0
      (weighted 0.75) ranks below a `high` at raw 0.6 (weighted 0.9).
  14. **urgency flips pressure:** board of 4 medium reds at raw ratio 0.2 (f5/d6), one candidate red
      at raw 0.8 (f5/d9), 2 oranges and 2 greens (9 chores). Candidate `high` (weighted 1.2 ≥ 1,
      pressure 1) → the first `SORT_FOLD` ids contain 5 reds / 1 orange / 2 greens and the 9th chore
      is the second orange. Candidate `low` (weighted 0.6, pressure 0) → 4 reds / 2 oranges /
      2 greens and the 9th chore is a red.
  15. **unset urgency ≡ `'medium'`:** a board of 6 reds — X at f5/d10 (raw exactly 1.0, on the
      pressure threshold), Y at f5/d11 with `urgency: 'medium'` (raw 1.2), four more at raw ≤ 0.5 —
      plus 2 oranges and 2 greens. Ordered with X's `urgency` omitted (`makeChore` sets none by
      default) and with X `urgency: 'medium'`, both equal the explicit expected order [Y, X, the four
      low reds, 2 greens] then the 2 oranges (pressure 2 → fold 6r/0o/2g). This rejects unset→low
      (pressure 1 → 5r/1o/2g) and unset→high (X weighted 1.5 would rank above Y).
  16. **stable ties:** chores with identical rank keys keep input order (in every bucket) — give the tied chores in
      each bucket non-monotonic ids (e.g. input [3, 1, 2]) so an id-based tiebreak would fail.
  17. **`frequency === 0`** chores land in green, never red, and don't throw/NaN.
  18. **legacy flag ignored:** a chore carrying a stale `longTermTask: true` (cast `as unknown as
      Chore`, as in the old test) sorts exactly as without it.
  19. **small board is plain bucket order even with pressure:** fewer than `SORT_FOLD` chores with a
      pressured red: `due(1, 10, 5)` (weighted 1.0, pressure 1), `due(2, 12, 10)` (raw 0.2), oranges
      `due(3, 6, 8)`, `due(4, 7, 8)`, greens `due(5, 1, 30)`, `due(6, 2, 30)`, given in reversed input
      order → `[1, 2, 4, 3, 5, 6]` (pressure cuts the orange quota to 1, but donation still pulls the
      second orange into the fold ahead of the greens).
  20. **quota invariant (DD-5):** `SORT_BASE_QUOTA.red + SORT_BASE_QUOTA.orange +
      SORT_BASE_QUOTA.green === SORT_FOLD` (guards future on-Pi re-tuning; import both constants).
- [ ] Implement in `frontend/src/utils/choreSort.ts` (delete `calcDurationWeightedScore`; the
  `differenceInDays`/`startOfDay` imports stay in use):
  ```ts
  import { differenceInDays, startOfDay } from 'date-fns';
  import type { Chore } from '@customTypes/SharedTypes';
  import { classifyStatus } from '@utils/choreBarMath';
  import { SORT_FOLD, SORT_BASE_QUOTA, SORT_PRESSURE_THRESHOLD, SORT_URGENCY_MULTIPLIER } from '@assets/constants';
  import type { ChoreStatus } from '@assets/constants';
  ```
  - `daysSinceCompleted(chore, today)` = `differenceInDays(startOfDay(today), startOfDay(chore.dateLastCompleted))` (same expression as `ChoreTimerBar`).
  - `weightedOverdue(chore, daysSince)` = `((daysSince − frequency) / frequency) × SORT_URGENCY_MULTIPLIER[chore.urgency ?? 'medium']` (only called for red chores, so `frequency > 0`).
  - Precompute one entry per chore `{ chore, daysSince, status, key }` once (no repeated date math inside comparators).
  - Buckets: red sorted by `weightedOverdue` desc, then `duration` desc; orange by
    `remainingRatio = (frequency − daysSince)/frequency` asc; green by `daysSince` asc — all via
    `Array.prototype.sort` (stable, so ties keep input order).
  - `pressure` = reds with `weightedOverdue ≥ SORT_PRESSURE_THRESHOLD`.
    `redQuota = min(SORT_FOLD, SORT_BASE_QUOTA.red + pressure)`; `extra = redQuota − SORT_BASE_QUOTA.red`;
    `orangeQuota = max(0, SORT_BASE_QUOTA.orange − extra)`;
    `greenQuota = max(0, SORT_BASE_QUOTA.green − max(0, extra − SORT_BASE_QUOTA.orange))`.
  - `take[s] = min(bucket[s].length, quota[s])`; `spare = SORT_FOLD − Σtake`; for `s` of
    `['red','orange','green']`: `add = min(spare, bucket[s].length − take[s])`; `take[s] += add`;
    `spare −= add`.
  - Result = `red.slice(0,take.red)`, `orange.slice(0,take.orange)`, `green.slice(0,take.green)`,
    then `red.slice(take.red)`, `orange.slice(take.orange)`, `green.slice(take.green)`, mapped
    back to `Chore`. Keep the exported signature `orderChores(chores: Chore[], today: Date): Chore[]`.
  - Short header comment: the full order is computed by `App.tsx`'s `reconcileChores` on first
    load (every id is newly seen) and recomputed by the `simulatedDate` effect at midnight /
    day-simulation steps; later re-pulls sort only newly-seen ids and append them after the kept
    order (a quota-fill on that subset is intentional and harmless) — completing or editing never
    re-sorts.
- [ ] After each Green, run `cd /home/rmila/Code/chores4irl/frontend && npx vitest run src/__tests__/utils/choreSort.test.ts`;
  after all pass, refactor for readability and re-run.
- [ ] `cd /home/rmila/Code/chores4irl && grep -rn "calcDurationWeightedScore" frontend/src` → no
  output (grep exit 1 is the pass value).
- [ ] **App-test comments (assertions unchanged):** in `frontend/src/__tests__/App.test.tsx`
  "midnight re-sort recalculates sortedIds when day advances" (≈L518–557): replace the opening
  sentence ("The initial fetch effect in App.tsx calls `new Date()` directly … unpredictable in
  tests") with "The initial load sorts via reconcileChores at the mocked MOCK_DAY (Jan 15): A green,
  B red → [B, A]; the test then drives re-sorts via [simulatedDate]-effect rerenders.", and replace
  the old-score comment block with the new reasoning — day1 (Jan 16): A daysSince 1 / freq 1 →
  orange (due), B daysSince 11 / freq 7 → red → [B, A]; day2 (Jan 20): A red overdueRatio 4, B red
  overdueRatio 8/7 → [A, B]; note in the comment that day1's order equals the initial order, so the
  day2 flip is the assertion that proves the re-sort. In "rolling back a failed delete…" change "(order depends on real
  clock initial sort)" to "(initial sort at mocked MOCK_DAY)". In "adding a chore appends…"
  (≈L441–473: L442 "more urgent", L455 "(most urgent)" → "(red, furthest overdue)", L473 "not
  re-sorted by urgency" → "not re-sorted") and `App.search.test.tsx` "preserves sort order among matches" (≈L144) reword
  "more urgent" to "further overdue (red)".
- [ ] **README:** rewrite `README.md` § "How prioritization works" (currently L11–27: the heading,
  the `score = duration × (daysSinceLastCompleted / frequency)` block and the two paragraphs after
  it) to explain: each chore is bucketed by the colour its bar shows (red overdue / orange ≤ 37.5 %
  of cycle left / green); reds rank by how overdue they are relative to their frequency
  (× urgency: Low 0.75, Medium/unset 1, High 1.5) with duration as tiebreak, oranges by closest
  to due, greens most-recently-completed first; the first 8 slots show 4 red / 2 orange / 2 green
  with unused slots donated red → orange → green; each red that is overdue by at least one full
  frequency — i.e. 2× its frequency has elapsed (after urgency weighting) — moves one more fold
  slot to red, so 4+ such chores fill the fold; urgency affects sort only, not bar colour; and
  plainly that the order changes only at midnight (and when stepping the simulated date) —
  completing a chore leaves it in place until then. Keep one sentence that there is still no
  separate tier for infrequent maintenance chores — a quarterly chore sits in whichever status
  bucket its bar shows and competes there like daily upkeep. Name `frontend/src/utils/choreSort.ts`
  (`orderChores`), `choreBarMath.ts` (`classifyStatus`) and the tunables in
  `frontend/src/assets/constants.ts`. Keep the existing timer-bar paragraph (L29–31, "Each chore
  renders as a timer bar…").
- [ ] `cd /home/rmila/Code/chores4irl && grep -n "calcDurationWeightedScore\|duration ×" README.md`
  → no output (exit 1).
- [ ] **Step gates** (this step's commit must be green on its own): from
  `/home/rmila/Code/chores4irl/frontend`, `npx vitest run` → all green, more than the 296-test
  baseline and no test file dropped (32 files); if any App order assertion fails, recompute the
  expected order under the F16 rules and update the expectation with a comment showing the
  bucket/rank reasoning — never loosen it to an order-agnostic check. `npx tsc --noEmit -p .` →
  exit 0; from the repo root `npm run lint` → prints no problems (`eslint .` exits 0 on warnings, so read the output; baseline prints none).

### 3. Verify All Tests Pass
Run the full test suites to confirm nothing is broken.

**To-do:**
- [ ] From `/home/rmila/Code/chores4irl`: `npm test --workspace frontend` → all green (> 296
  tests, 32 files); `npm test --workspace backend` → 73 passing (8 files), unchanged from the
  pre-F16 baseline.
- [ ] `cd /home/rmila/Code/chores4irl/frontend && npx tsc --noEmit -p .` → exit 0; from the repo
  root `npm run lint` → prints no problems (`eslint .` exits 0 on warnings, so read the output; baseline prints none), and `npm run build --workspace frontend` succeeds.
- [ ] From the repo root run `npx playwright test` (`e2e/smoke.spec.ts`); if `git worktree list`
  shows any `c4i-wt-*` worktree, run `env -u PLAYWRIGHT_BASE_URL CI=1 npx playwright test e2e/smoke.spec.ts`
  instead. If the CI=1 run fails with `… is already used …` or `was not able to start`, do not
  kill the listener, free the port, or drop `CI=1` — stop and report the occupied ports
  (`ss -ltnp`) — begin the report line with `UNRESOLVED — requires user decision/action:` and
  leave this box unticked; /run-plan stops, and the user re-runs `/run-plan status-bucketed-sort`
  once the ports are free (Step 3 is re-selected). (At plan time `git worktree list` shows only the main checkout.)
- [ ] Expected-end-state greps, from `/home/rmila/Code/chores4irl`:
  `grep -n "classifyStatus" frontend/src/utils/choreSort.ts` → at least one hit (shared classifier
  imported); `grep -nE "0\.375|> *frequency|statusColors" frontend/src/utils/choreSort.ts || echo none`
  → prints `none` (no copied classifier literal);
  `grep -rn "urgency" frontend/src --include=*.ts --include=*.tsx -l | grep -v __tests__` → lists
  exactly `frontend/src/components/form/ChoreForm.tsx`, `frontend/src/utils/choreSort.ts` and
  `frontend/src/assets/constants.ts` (via `Chore['urgency']` / the comment), in any order.
- [ ] Investigate and fix any failures before marking the plan finished (tick as `— N/A, all
  checks passed` when nothing failed).

## Status
finished: false
