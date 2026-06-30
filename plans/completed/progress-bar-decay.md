> **STATUS: Merged** `e929b75` (#7). Frozen — historical record, do not edit.
> **Outcome:** The decay/urgency bar model merged here was later consolidated into
> `@utils/choreBarMath` (`computeBar`) during F6 bar-redesign (`3a30a42`); that consolidated
> module is the live implementation. (META-PLAN's note that the *branch* was deleted/superseded
> refers to the later F6 consolidation — the original PR #7 did merge to `main`.)

# Progress Bar Decay & Urgency Feature

## Summary

Replace the current fill-based progress bar (grows from 0→100% as a chore ages) with a decay-based model that visually communicates time *remaining* before a chore is due. Before the due date the bar shrinks from 100% to 0% proportionally, changing colour from green → orange → red as urgency mounts. After the due date the bar grows at 2× speed, capping out fully red with an "Urgent" label rendered inside it.

## Research Findings

- **`ChoreTimerBar.tsx`** owns all status calculations. `status = daysSince / frequency` drives both `barWidth` (`Math.min(status, 1) * 100`) and colour via `getStatusColor(status)`. Both must be replaced.
- **`constants.ts`** exports `statusColors: StatusColor[]` with `benchmark` values `0.65`, `0.85`, `1`. `getStatusColor` finds the first entry where `benchmark >= status`. The array and lookup logic need to be redesigned for a descending-remaining-ratio model.
- **`ProgressBar.tsx`** is a thin wrapper: `width` prop → `style.width`, `color` prop → className. It has no label support; the "Urgent" tag must be added here.
- **`OverdueBadge.tsx`** renders a floating `"Overdue"` pill in the overlay. It is conditionally shown in `ChoreTimerBar` when `status > 1`. It can remain for overdue tasks; the new "Urgent" label lives *inside the bar itself* (in `ProgressBar`), not in the overlay.
- No backend, no tests, no DB — this is a pure frontend visual change.

## Steps

### 1. Derive & verify the new bar math

Pin down the exact formulas before touching any code, using the 10-day example as a test oracle.

**To-do:**
- [x] Confirm the pre-due formula: `remainingRatio = (frequency - daysSince) / frequency`. Spot-check: day 0 → 1.0 (100%, green), day 3 → 0.7 (70%, green), day 5 → 0.5 (50%, orange), day 9 → 0.1 (10%, red), day 10 → 0.0 (0%, red).
- [x] Confirm the post-due formula: `growthRatio = (daysOverdue × 2) / frequency` where `daysOverdue = daysSince - frequency`. Spot-check: 1 day overdue → 0.2 (20%), 2 days → 0.4 (40%), 5 days → 1.0 (100%, urgent).
- [x] Confirm colour thresholds on `remainingRatio`: `> 0.5` → green, `> 0.25 and ≤ 0.5` → orange, `≤ 0.25` → red. Post-due is always red regardless of `growthRatio`.
- [x] Confirm urgent condition: `growthRatio >= 1` (i.e., `daysOverdue >= frequency / 2`).

### 2. Update `constants.ts`

Replace the old ascending-status thresholds with a descending-remaining-ratio model.

**To-do:**
- [x] Open `frontend/src/assets/constants.ts`. Delete the existing `statusColors` array (`benchmark: 0.65 / 0.85 / 1`, all green/yellow/red).
- [x] Define a new exported type and array using descending threshold order:
  ```typescript
  type StatusColor = { threshold: number; color: string };

  // Thresholds are minimum remaining-ratio values (exclusive lower bound).
  // Listed descending so the first match wins.
  export const statusColors: StatusColor[] = [
      { threshold: 0.5,  color: 'bg-green-500' },   // remainingRatio > 0.5
      { threshold: 0.25, color: 'bg-orange-500' },   // remainingRatio > 0.25
      { threshold: -Infinity, color: 'bg-red-500' }, // remainingRatio ≤ 0.25 (fallback)
  ];
  ```
- [x] Remove the `bg-yellow-500` entry — it is no longer used. (No other file imports `statusColors`, so no dead-import ripple.)

### 3. Update `ChoreTimerBar.tsx` — new width & colour logic

Replace the current `status`-based calculations with the decay/growth model.

**Prerequisite:** If `db-routes-and-state-fix` and `real-time-midnight-sort` have been applied, `ChoreTimerBar.tsx` will already contain:
- A `useEffect` syncing `dateLastCompleted` from props (Plan 1 Step 3)
- An `onDelete` prop and delete button (Plan 1 Step 4)
- `resetTask()` using `new Date()` (Plan 3 Step 3)

These are all compatible with the changes in this step. Preserve them.

**To-do:**
- [x] Open `frontend/src/components/chore/ChoreTimerBar.tsx`.
- [x] Replace the `getStatusColor` function. The new signature takes `remainingRatio: number` and `isOverdue: boolean`:
  ```typescript
  function getStatusColor(remainingRatio: number, isOverdue: boolean): string {
      if (isOverdue) return 'bg-red-500 bg-opacity-50';
      const match = statusColors.find(s => remainingRatio > s.threshold);
      return (match ?? statusColors[statusColors.length - 1]).color + ' bg-opacity-50';
  }
  ```
- [x] Replace the three derived values (`status`, `barWidth`, `barColor`) with the new calculations inside the component body (keep inside `useMemo` or as direct derived values — match the existing pattern of inline `const`s):
  ```typescript
  const isOverdue = daysSince > chore.frequency;
  const remainingRatio = (chore.frequency - daysSince) / chore.frequency; // can go negative when overdue

  let barWidth: number;
  let isUrgent = false;
  if (!isOverdue) {
      barWidth = Math.max(remainingRatio, 0) * 100;
  } else {
      const daysOverdue = daysSince - chore.frequency;
      const growthRatio = (daysOverdue * 2) / chore.frequency;
      barWidth = Math.min(growthRatio, 1) * 100;
      isUrgent = growthRatio >= 1;
  }

  const barColor = getStatusColor(remainingRatio, isOverdue);
  ```
- [x] Update the `<ProgressBar>` JSX call to pass the new `isUrgent` prop and remove the special-case `status === 0 ? 100 : barWidth` hack (the new formula already returns 100% at day 0):
  ```tsx
  <ProgressBar width={barWidth} color={barColor} isUrgent={isUrgent} />
  ```
- [x] Update the `OverdueBadge` condition — it was `status > 1`, change to `isOverdue`:
  ```tsx
  {isOverdue && <OverdueBadge />}
  ```
- [x] Remove the now-unused `status` variable. Verify no other references to `status` or `barWidth` remain referencing the old variables.

### 4. Update `ProgressBar.tsx` — add "Urgent" label inside the bar

The bar must render the "Urgent" tag as text within its own element when full post-due.

**To-do:**
- [x] Open `frontend/src/components/chore/ProgressBar.tsx`.
- [x] Add `isUrgent?: boolean` to `ProgressBarProps`.
- [x] Render the label inside the bar div when `isUrgent` is true. The bar is `h-24` tall so centre the label vertically and horizontally:
  ```tsx
  type ProgressBarProps = {
      width: number;
      color: string;
      isUrgent?: boolean;
  };

  export default function ProgressBar({ width, color, isUrgent }: ProgressBarProps) {
      return (
          <div
              className={`absolute left-0 top-0 h-full rounded-full transition-all duration-300 ease-in-out flex items-center justify-center ${color}`}
              style={{ width: `${width}%` }}
          >
              {isUrgent && (
                  <span className="text-white text-xs font-bold tracking-wide uppercase">
                      Urgent
                  </span>
              )}
          </div>
      );
  }
  ```

### 5. Vitest unit tests + manual smoke test

Add unit tests for the new bar math (no clock dependency), then do a minimal manual verification in the browser.

**Unit tests (automated):**
- [x] Create `frontend/src/__tests__/components/ChoreTimerBar.barMath.test.ts`. The file should test the `barWidth`, `barColor`, and `isUrgent` calculations in isolation — extract the pure math into a helper (or test via rendered output if preferred). Cover at minimum:
  - Day 0 of a 10-day chore → `barWidth = 100`, color green, `isUrgent = false`
  - Day 3 of a 10-day chore → `barWidth ≈ 70`, color green
  - Day 5 of a 10-day chore → `barWidth = 50`, color orange
  - Day 9 of a 10-day chore → `barWidth = 10`, color red
  - 2 days overdue on a 10-day chore → `barWidth = 40`, color red, `isUrgent = false`
  - 5 days overdue on a 10-day chore → `barWidth = 100`, color red, `isUrgent = true`
- [x] Run `npm test --workspace frontend` and confirm all new tests pass. (8 test files, 45 tests — all passed)

**Manual smoke test (real clock — no time simulation):**
- [ ] Run `npm run dev` from the project root and open `http://localhost:5174`. (requires running dev server — skipped in automated run)
- [ ] Find a chore whose `dateLastCompleted` makes it visibly overdue (check the bar state — it should already be red). Confirm `OverdueBadge` is shown and the bar is growing (not shrinking). (requires running dev server)
- [ ] If no chore is overdue, directly update `dateLastCompleted` in the SQLite DB to a past date (`UPDATE chores SET date_last_completed = date('now', '-N days') WHERE id = X`) and reload — confirm the bar reflects the correct state for that many days elapsed. (requires running dev server)
- [ ] Click a chore bar to reset it (`resetTask()`). Confirm the bar snaps back to 100% green and `daysSince` becomes 0. (requires running dev server)
- [ ] To test the full green → orange → red progression without waiting real days: temporarily set `dateLastCompleted` via SQLite for a short-frequency chore at different elapsed-day offsets, reload, and observe each state. (requires running dev server)
- [x] Confirm no TypeScript errors (`npx tsc --noEmit` from `frontend/`). (zero errors)
- [x] Confirm no ESLint errors (`npx eslint frontend/src` from root). (0 errors, 1 pre-existing warning in App.tsx unrelated to this feature)

## Status
finished: true
