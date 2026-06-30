> **STATUS: Merged** `0305107` (#8). Frozen — historical record, do not edit.

# Real Time Clock + Midnight-Only Sort

## Summary

Replace the 20-second-per-day time simulation with the device's real local clock, and change the sort trigger so the chore list only reorders at midnight. This lets users see their completed chores stay in place during the day — providing a sense of accomplishment — rather than immediately re-ranking completed chores to the bottom. At midnight, a fresh sort reflects the new day's urgency landscape.

## Research Findings

Research done inline (28 source files, frontend-only change).

- **`useTimeSimulation.ts`** (`frontend/src/hooks/useTimeSimulation.ts`): Uses `addDays` from `date-fns` inside a recursive `setTimeout(20s)` to advance `day` state by 1 calendar day per tick. The returned `Date` is passed as the `day` prop throughout the entire render tree.
- **`App.tsx`** (`frontend/src/App.tsx`): Owns `day`, `choreData`, `selectedRoom`. Pipes `filteredChores = useRoomFilter(choreData, selectedRoom)` → `orderedChores = useChoreSort(filteredChores, day)` → `<ChoreList chores={orderedChores} day={day} />`. Completing a chore updates `choreData` (and persists to API), which immediately re-triggers `useChoreSort` and reorders the list.
- **`useChoreSort.ts`** (`frontend/src/hooks/useChoreSort.ts`): A thin wrapper — `useMemo(() => orderChores(chores, day), [chores, day])`. Changing either `chores` or `day` causes an immediate full resort.
- **`ChoreTimerBar.tsx`** (`frontend/src/components/chore/ChoreTimerBar.tsx`): Uses `day` prop in `resetTask()` as the new `dateLastCompleted` value, and in `daysSince` via `differenceInDays(startOfDay(day), startOfDay(dateLastCompleted))`.
- **Key constraint**: The `orderedChores` list currently recomputes any time `choreData` changes — meaning completing a chore causes an immediate resort. The fix requires decoupling "which position each chore holds" from "what the live chore data is."

## Steps

### 1. Create `useMidnightClock` hook

Replace `useTimeSimulation` with a hook that returns the real local `Date` and re-renders the component tree exactly once per day — at midnight.

**To-do:**
- [x] Create `frontend/src/hooks/useMidnightClock.ts` with the following implementation:
  ```ts
  import { useState, useEffect } from 'react';
  import { startOfDay, addDays } from 'date-fns';

  export function useMidnightClock(): Date {
      const [now, setNow] = useState<Date>(new Date());

      useEffect(() => {
          const nextMidnight = startOfDay(addDays(now, 1));
          const msUntilMidnight = nextMidnight.getTime() - Date.now();
          const timer = setTimeout(() => {
              setNow(new Date());
          }, msUntilMidnight);
          return () => clearTimeout(timer);
      }, [now]);

      return now;
  }
  ```
  - `startOfDay(addDays(now, 1))` gives the exact midnight of the next calendar day.
  - The effect re-arms after each midnight tick (via the `[now]` dep), so it fires every night indefinitely.
  - On page load, `now` is initialized to the real current `Date` (no simulation).

**Verification:**
- [x] Create `frontend/src/__tests__/hooks/useMidnightClock.test.ts` with fake-timer coverage:
  ```ts
  import { renderHook, act } from '@testing-library/react';
  import { vi, describe, it, expect, afterEach } from 'vitest';
  import { useMidnightClock } from '../../hooks/useMidnightClock';
  import { startOfDay, addDays } from 'date-fns';

  describe('useMidnightClock', () => {
      afterEach(() => vi.useRealTimers());

      it('initializes to the current real date', () => {
          const fixedNow = new Date(2025, 0, 15, 14, 30, 0);
          vi.useFakeTimers({ now: fixedNow });
          const { result } = renderHook(() => useMidnightClock());
          expect(result.current.toDateString()).toBe(fixedNow.toDateString());
      });

      it('advances to the next day after midnight fires', async () => {
          const fixedNow = new Date(2025, 0, 15, 23, 59, 0);
          vi.useFakeTimers({ now: fixedNow });
          const { result } = renderHook(() => useMidnightClock());
          const nextMidnight = startOfDay(addDays(fixedNow, 1));
          const msUntilMidnight = nextMidnight.getTime() - fixedNow.getTime();
          await act(async () => { vi.advanceTimersByTime(msUntilMidnight + 1); });
          expect(result.current.toDateString()).toBe(nextMidnight.toDateString());
      });

      it('clears the timer on unmount', () => {
          vi.useFakeTimers();
          const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
          const { unmount } = renderHook(() => useMidnightClock());
          unmount();
          expect(clearSpy).toHaveBeenCalled();
      });
  });
  ```
- Run `cd frontend && npm test -- --testPathPattern=useMidnightClock` and confirm all 3 tests pass.

---

### 2. Refactor `App.tsx` — frozen sort order + real time

Introduce a `sortedIds` state (array of chore IDs in sort order) that only updates at midnight (or when a new chore is added). Live chore data flows into display but does not trigger a resort during the day.

**To-do:**
- [x] In `frontend/src/App.tsx`, update the `react` import to include `useRef`:
  ```ts
  import { useEffect, useMemo, useRef, useState } from 'react';
  ```
- [x] Replace the `useTimeSimulation` import with `useMidnightClock`:
  ```ts
  // remove: import { useTimeSimulation } from './hooks/useTimeSimulation';
  import { useMidnightClock } from './hooks/useMidnightClock';
  ```
- [x] Remove the `useChoreSort` import (it will no longer be called in App):
  ```ts
  // remove: import { useChoreSort } from './hooks/useChoreSort';
  ```
- [x] Add the `orderChores` import from the utils module:
  ```ts
  import { orderChores } from './utils/choreSort';
  ```
- [x] Replace `const day = useTimeSimulation();` with:
  ```ts
  const day = useMidnightClock();
  ```
- [x] In `frontend/src/__tests__/App.test.tsx`, update the hook mock to match the new import. Replace:
  ```ts
  vi.mock('../hooks/useTimeSimulation', () => ({ useTimeSimulation: () => new Date(2025, 0, 15, 12, 0, 0) }));
  ```
  With:
  ```ts
  vi.mock('../hooks/useMidnightClock', () => ({ useMidnightClock: () => new Date(2025, 0, 15, 12, 0, 0) }));
  ```
  This mock must be updated in the **same step** as the hook swap to prevent test failures.
- [x] Below the existing state declarations, add:
  ```ts
  const [sortedIds, setSortedIds] = useState<number[]>([]);
  const choreDataRef = useRef<Chore[]>(choreData);
  choreDataRef.current = choreData;
  ```
  - `sortedIds`: the frozen sort order (array of chore IDs). Starts empty; populated once chores load.
  - `choreDataRef`: always holds the current `choreData` without creating a dependency in the midnight effect.
- [x] Inside the existing `fetchAllChores` effect, after `setChoreData(chores)`, add:
  ```ts
  setSortedIds(orderChores(chores, new Date()).map(c => c.id));
  ```
  Full updated effect:
  ```ts
  useEffect(() => {
      fetchAllChores()
          .then(chores => {
              setChoreData(chores);
              setSortedIds(orderChores(chores, new Date()).map(c => c.id));
              setLoading(false);
          })
          .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : 'Failed to load chores');
              setLoading(false);
          });
  }, []);
  ```
- [x] Add the midnight-sync effect after the fetch effect:
  ```ts
  useEffect(() => {
      if (choreDataRef.current.length > 0) {
          setSortedIds(orderChores(choreDataRef.current, day).map(c => c.id));
      }
  }, [day]);
  ```
  - Reads `choreDataRef.current` (not `choreData`) to avoid adding it to the dep array — the intent is to re-sort based on whatever chores exist when midnight fires, not to re-sort whenever chores change.
  - Guard `length > 0` prevents overwriting a populated sort with an empty result if `day` somehow fires before chores load.
- [x] Replace `const orderedChores = useChoreSort(filteredChores, day);` with:
  ```ts
  const orderedChores = useMemo(() => {
      const choreMap = new Map(filteredChores.map(c => [c.id, c]));
      return sortedIds
          .map(id => choreMap.get(id))
          .filter((c): c is Chore => c !== undefined);
  }, [sortedIds, filteredChores]);
  ```
  - Positions come from `sortedIds` (frozen until midnight).
  - Data (bar color, days since) comes from `filteredChores` (live).
  - Chores not in the current room filter are excluded by the `choreMap.get(id)` returning `undefined`.
- [x] In `handleAddChore`, after `setChoreData(prev => [...prev, created])`, update `sortedIds` to include the new chore in its correct scored position:
  ```ts
  async function handleAddChore(newChore: Omit<Chore, 'id'>) {
      try {
          const created = await addChore(newChore);
          const updated = [...choreData, created];
          setChoreData(updated);
          setSortedIds(orderChores(updated, day).map(c => c.id));
          setShowForm(false);
      } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to add chore');
      }
  }
  ```
  - Both `setChoreData` and `setSortedIds` are called sequentially at the same scope level — not nested. React's Strict Mode double-invokes updater functions, which would call a nested `setSortedIds` twice; sequential calls avoid this.
  - Re-sorting on add is intentional: the user just created a new chore and expects to see it placed correctly.
- [x] **Note (if `db-routes-and-state-fix` has already been applied):** `handleCompleteChore` already contains a snapshot/reconcile/rollback pattern from that plan. Do NOT replace or simplify that function body — only ensure it does not call `setSortedIds`. The existing reconcile pattern (`setChoreData(curr => curr.map(c => c.id === id ? updated : c))`) and rollback (`setChoreData(prev)`) must be preserved.
- [x] Do NOT call `setSortedIds` inside `handleCompleteChore` — leaving it unchanged ensures positions freeze when a chore is completed.
- [x] Inside `handleDeleteChore`, after the `setChoreData` call that removes the deleted chore, add:
  ```ts
  setSortedIds(prev => prev.filter(id => id !== choreId));
  ```
  This keeps `sortedIds` in sync with `choreData` so deleted IDs do not accumulate in the sort array. (The `orderedChores` useMemo would filter `undefined` gracefully regardless, but explicit cleanup makes the invariant clear.)
- [x] Add a frozen-sort integration test to `frontend/src/__tests__/App.test.tsx`:
  ```ts
  it('completing a chore does not change its list position', async () => {
      const choreA = { ...localNoon, id: 1, name: 'Chore A', dateLastCompleted: new Date(2024, 11, 1) };
      const choreB = { ...localNoon, id: 2, name: 'Chore B', dateLastCompleted: new Date(2025, 0, 14) };
      vi.mocked(fetchAllChores).mockResolvedValue([choreA, choreB]);
      const updatedA = { ...choreA, dateLastCompleted: new Date(2025, 0, 15, 12, 0, 0) };
      vi.mocked(completeChore).mockResolvedValue(updatedA);
      render(<App />);
      await waitFor(() => expect(screen.getAllByTestId('chore-item')).toHaveLength(2));
      const orderBefore = screen.getAllByTestId('chore-item').map(el => el.textContent);
      fireEvent.click(screen.getAllByTestId('chore-item')[0]);
      await waitFor(() => expect(completeChore).toHaveBeenCalled());
      const orderAfter = screen.getAllByTestId('chore-item').map(el => el.textContent);
      expect(orderAfter).toEqual(orderBefore);
  });
  ```
  Note: this test assumes chore items have a `data-testid="chore-item"` attribute. Add this attribute to the chore element in `ChoreList.tsx` (or wherever individual chores are rendered) if it does not already exist.

**Verification:** Load the app, confirm the displayed date matches the system clock. Complete a chore; confirm its bar resets to green/0% but its position in the list does not change.

---

### 3. Update `ChoreTimerBar.tsx` — use real completion time

`resetTask()` currently sets `dateLastCompleted = day` (the prop). After the clock change, `day` is the real time as of the last midnight tick — which is correct for date-math purposes, but `new Date()` is more semantically accurate for recording when the user actually completed the chore.

**To-do:**
- [x] In `frontend/src/components/chore/ChoreTimerBar.tsx`, update `resetTask` to use `new Date()` as the completion timestamp instead of the `day` prop:
  ```ts
  function resetTask() {
      onComplete(chore.id, new Date());
  }
  ```
  - Calling `onComplete(chore.id, new Date())` passes the real completion timestamp directly to the parent. No local state is needed — `ChoreTimerBar` derives `daysSince` from `chore.dateLastCompleted` (a prop), which the parent updates via its optimistic update in `handleCompleteChore`.
  - Since both `startOfDay(day)` and `startOfDay(new Date())` resolve to today's midnight, `daysSince` correctly becomes 0.
  - The `day` prop and its use in `daysSince` is unchanged — no prop signature change needed.
- [x] In `frontend/src/__tests__/App.test.tsx`, update the `completeChore` call assertion. After this step, `resetTask()` calls `onComplete(chore.id, new Date())` using the real wall clock — not the fixed mock date. Replace the exact-date assertion with a type check:
  ```ts
  // Before:
  expect(completeChore).toHaveBeenCalledWith(1, new Date(2025, 0, 15, 12, 0, 0));
  // After:
  expect(completeChore).toHaveBeenCalledWith(1, expect.any(Date));
  ```

**Verification:**
- [x] Add a unit test to `frontend/src/__tests__/components/ChoreTimerBar.test.tsx`:
  ```ts
  it('calls onComplete with the real current date when the chore bar is clicked', () => {
      const fixedNow = new Date(2025, 0, 15, 14, 0, 0);
      vi.useFakeTimers({ now: fixedNow });
      const onComplete = vi.fn();
      render(<ChoreTimerBar chore={testChore} day={new Date(2025, 0, 15)} onComplete={onComplete} onDelete={vi.fn()} />);
      fireEvent.click(screen.getByTestId('chore-bar'));
      expect(onComplete).toHaveBeenCalledWith(testChore.id, fixedNow);
      vi.useRealTimers();
  });
  ```
  Note: this assumes the clickable chore bar element has `data-testid="chore-bar"`. Add this attribute to the relevant element in `ChoreTimerBar.tsx` if it does not already exist.
- [x] Visually confirm in the browser: mark a chore complete and confirm `daysSince` becomes 0 and the bar goes green.

---

### 4. Delete dead hooks

Remove `useTimeSimulation.ts` (superseded) and `useChoreSort.ts` (no longer called after Step 2's App.tsx changes). Both imports were already removed in Step 2.

**To-do:**
- [x] Delete `frontend/src/hooks/useTimeSimulation.ts`. Dead imports within the deleted file: `useState`, `useEffect` from `react`; `addDays` from `date-fns` — all removed with the file, no action needed elsewhere.
- [x] Confirm no other file imports `useTimeSimulation`:
  ```
  grep -r "useTimeSimulation" frontend/src/
  ```
  Expected: no matches. If any remain, remove them.
- [x] Delete `frontend/src/hooks/useChoreSort.ts`. Dead imports within: `useMemo` from `react`; `Chore` from `@customTypes/SharedTypes`; `orderChores` from `../utils/choreSort` — all removed with the file.
- [x] Confirm no other file imports `useChoreSort`:
  ```
  grep -r "useChoreSort" frontend/src/
  ```
  Expected: no matches. If any remain, remove them.
- [x] Delete `frontend/src/__tests__/hooks/useChoreSort.test.ts`. The hook it tests (`useChoreSort`) no longer exists after this step. The sorting logic is now tested indirectly via the `orderedChores` computation in `App.tsx` integration tests (if any are added later) or via `orderChores` unit tests in `choreSort.test.ts`.


**Verification:**
- Run `npm run build` (or `npx tsc --noEmit`) from the project root and confirm zero TypeScript errors and no unresolved imports.
- Run `cd frontend && npm test` and confirm the test suite passes with no failures. This confirms no dangling references in the test runner after `useChoreSort.test.ts` is deleted.

---

### 5. Test & Smoke Verification

Automated testing now exists. Run the automated suite first; only proceed to manual steps if all pass.

**Automated tests (required gate):**
- [x] Run `cd frontend && npm test` and confirm all tests pass. Key suites affected by this plan: `App.test.tsx` (mock updated from `useTimeSimulation` to `useMidnightClock` in Step 2), `ChoreTimerBar.test.tsx` (no prop signature change — should still pass), `choreSort.test.ts` (unchanged — pure utility).
- [x] Run `npm run test:e2e` from the project root and confirm all Playwright E2E smoke tests pass with the new sort behaviour. Update any selectors that broke.

**Manual smoke test (steps not covered by automated tests):**
- [x] Start the dev server (`npm run dev` from project root). Open `http://localhost:5174`. Confirm the date displayed in the top bar matches today's real system date (automated tests use a fixed mock date; this verifies the real clock path in the browser). The `{day.toDateString()}` display is a permanent UI element — do not remove it as part of cleanup.
- [x] Click a chore bar to mark it complete. Confirm:
  - The chore **stays in its current list position** (does not jump to the bottom). This is the feature's core guarantee and is not currently asserted by the E2E suite.
  - The timer bar resets to green (0 days since).
- [x] The midnight sort trigger is verified by the `useMidnightClock.test.ts` unit test added in Step 1 (fake-timer advances to midnight and confirms the returned date advances by one day). No manual code change is needed to verify this behaviour.

---

## Status
finished: true
