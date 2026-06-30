> **STATUS: Archived report** (2026-04-09 reconciliation snapshot). Frozen — historical
> record, do not edit. Superseded by later reconciles; current backlog truth is `META-PLAN.md`.

# Plan Reconciliation Report

**Generated:** 2026-04-09
**Plans reviewed:**
1. `plans/api/db-routes-and-state-fix.md` — API, state propagation, DELETE wire-up
2. `plans/testing/automated-test-setup.md` — Vitest + Playwright + CI
3. `plans/feature/real-time-midnight-sort.md` — Real clock + frozen sort order
4. `plans/feature/progress-bar-decay.md` — Decay-based progress bar with urgency

**Intended execution order (series with tests between phases):**
Plan 1 → Plan 2 → Plan 3 → Plan 4

---

## Summary

All four plans are individually coherent, but six cross-plan conflicts exist that will cause compilation errors, test failures, or broken smoke-test instructions if the plans are executed in series without coordination. None require changes to plan scope — each conflict can be resolved with targeted amendments to specific steps.

---

## Conflict Index

| # | Severity | Plans | Affected File(s) | Issue |
|---|---|---|---|---|
| C1 | **Critical** | Plan 2 → Plan 3 | `useChoreSort.ts`, `useChoreSort.test.ts` | Plan 2 writes a test for `useChoreSort`; Plan 3 deletes the hook |
| C2 | **Critical** | Plan 1 → Plan 2 | `backend/src/router.ts` | Plan 2 deletes `router.ts`; Plan 1 Step 1 audits it by filename |
| C3 | **Major** | Plan 3 → Plan 4 | smoke test in Plan 4 Step 5 | Plan 3 removes time simulation; Plan 4's smoke test requires it |
| C4 | **Major** | Plan 1 + Plan 3 | `App.tsx` `handleCompleteChore` | Both plans edit `handleCompleteChore`; Plan 3 does not account for Plan 1's new try/catch/rollback body |
| C5 | **Major** | Plan 1 + Plan 3 + Plan 4 | `ChoreTimerBar.tsx` | Three plans independently edit `ChoreTimerBar.tsx`; no plan accounts for the others' changes |
| C6 | **Minor** | Plan 2 → Plan 3 | E2E `smoke.spec.ts` | Plan 2's E2E selectors were written against the pre-Plan-3 UI; sort behaviour and `day` display may differ |

---

## Phase 1 — Resolve C1: `useChoreSort` test vs. deletion

### Background

**Plan 2, Step 5** creates `frontend/src/__tests__/hooks/useChoreSort.test.ts` with 2 tests for the `useChoreSort` hook.

**Plan 3, Step 4** deletes `frontend/src/hooks/useChoreSort.ts` entirely (it is superseded by the `sortedIds` + `useMemo` pattern in App).

**Result if unresolved:** After Plan 3 executes, `useChoreSort.test.ts` imports a deleted module → `npm test --workspace frontend` fails with a module-not-found error.

### Proposed Solution

Amend Plan 3 Step 4 to add a cleanup task:

> - [ ] Delete `frontend/src/__tests__/hooks/useChoreSort.test.ts`. The hook it tests (`useChoreSort`) no longer exists after this step. The sorting logic is now tested indirectly via the `orderedChores` computation in `App.tsx` integration tests (if any are added later) or via `orderChores` unit tests in `choreSort.test.ts`.

### Design Decision DD-1

**Context:** The `useChoreSort` hook wraps `useMemo(() => orderChores(...), [chores, day])`. Its unit test provides marginal value since `orderChores` is already tested directly in `choreSort.test.ts`. However, deleting the test file reduces coverage surface slightly.

| # | Option | Trade-off |
|---|---|---|
| 1 | Delete `useChoreSort.test.ts` in Plan 3 Step 4 (recommended) | Clean — no orphaned test. `orderChores` coverage is maintained. |
| 2 | Migrate `useChoreSort.test.ts` to test the new `orderedChores` `useMemo` output via a `renderHook` on a mock App | Preserves the test surface; requires writing new test logic in Plan 3 (adds scope). |

**Chosen:** Option 1 — Delete `useChoreSort.test.ts` in Plan 3 Step 4.

---

## Phase 2 — Resolve C2: `router.ts` audit vs. deletion

### Background

**Plan 1, Step 1** instructs: *"Read `backend/src/router.ts` in full. Confirm all four routes are registered..."* and explicitly names the file three times.

**Plan 2, Step 1** deletes `backend/src/router.ts` and replaces it with `backend/src/app.ts` (routes) + `backend/src/server.ts` (listen call).

**Result if unresolved:** If Plan 1 runs first (correct order), its Step 1 audit is valid. Plan 2 then renames the file. No runtime breakage — but Plan 1's step wording refers to a file that no longer exists after Plan 2. If someone re-runs or re-reads Plan 1 after Plan 2, the step is misleading.

### Proposed Solution

Amend Plan 1 Step 1 to add a note at the end of the "read `router.ts`" checklist item:

> **Note:** This file will be renamed to `app.ts` (without the `app.listen` call) in the test infrastructure plan (`automated-test-setup.md`). All four routes survive the rename unchanged.

This is documentation-only; no code change required.

### Design Decision DD-2

| # | Option | Trade-off |
|---|---|---|
| 1 | Add note to Plan 1 Step 1 (recommended) | Zero-cost clarity fix. |
| 2 | No change — accept the filename drift | Minor confusion if plan is re-read; no runtime impact. |

**Chosen:** Moot — Plan 1 has already run and will not be re-run. Option 2 applies by default: no note will be added to Plan 1 Step 1. Plan 2 will delete `backend/src/router.ts` when it executes.

---

## Phase 3 — Resolve C3: Progress bar smoke test expects time simulation

### Background

**Plan 3** removes `useTimeSimulation` entirely. After Plan 3 executes, there is no automatic day-advance mechanism.

**Plan 4, Step 5** (Manual smoke test) contains:

> "Observe the time simulation (1 day / 20 s). For a chore with a short frequency (e.g., 2-day cycle), confirm the bar visibly shrinks from 100% green → orange → red..."

This instruction is impossible to follow after Plan 3 runs, because the time simulation no longer exists.

Separately, **Plan 3, Step 5** already establishes a testing workaround for the midnight clock:

> "To verify midnight sort without waiting 24 hours: temporarily change `useMidnightClock.ts` to fire after 10 seconds (`const msUntilMidnight = 10_000`), reload the app, wait 10 seconds, and confirm the list reorders. Revert the change after confirming."

### Proposed Solution

Amend **Plan 4 Step 5** to replace the time-simulation smoke test instructions with instructions that work under the real clock. The amended step should:

1. Use `daysSince` math from the seed data (or ask the user to pick a chore that is already N days old based on actual seed `dateLastCompleted` values).
2. For testing the full bar progression, temporarily manipulate `dateLastCompleted` directly in SQLite or in the component (similar to how Plan 3 suggests a 10-second clock tweak).
3. Remove all references to "time simulation" and "1 day / 20 s".

### Design Decision DD-3

**Context:** After Plan 3, there is no automated way to advance the clock without modifying `useMidnightClock.ts`. The smoke test needs an alternative approach.

| # | Option | Trade-off |
|---|---|---|
| 1 | Temporarily patch `useMidnightClock.ts` to fast-forward (mirrors Plan 3's approach) | Consistent pattern; developer must remember to revert. |
| 2 | Use real seed data: pick a chore with an old `dateLastCompleted`, confirm the bar state matches the formula for the real elapsed days | Realistic; no code patching. But can't test the full green→orange→red→urgent progression in one session. |
| 3 | Amend Plan 4 to add a Vitest unit test for the `barWidth`/`barColor` calculations in `ChoreTimerBar` (automated, no clock dependency) and keep the manual step minimal | Best coverage; adds a small unit test file (not in Plan 4's current scope). |

**Chosen:** Option 3 — Amend Plan 4 to add a Vitest unit test for `barWidth`/`barColor` calculations in `ChoreTimerBar`; keep the manual smoke step minimal with no time simulation references.

---

## Phase 4 — Resolve C4: `handleCompleteChore` edits in both Plan 1 and Plan 3

### Background

**Plan 1, Step 2** rewrites `handleCompleteChore` to add:
- `const prev = choreData` snapshot
- Optimistic `setChoreData` update
- `const updated = await completeChore(id, date)` + reconciling `setChoreData(curr => curr.map(...))`
- `catch` block with `setChoreData(prev)` rollback

**Plan 3, Step 2** includes this note:
> "Do NOT call `setSortedIds` inside `handleCompleteChore` — leaving it unchanged ensures positions freeze when a chore is completed."

The word "unchanged" is ambiguous: it refers to `sortedIds` being unchanged, not the function itself. But a developer executing Plan 3 after Plan 1 may be confused by this wording, and if they re-read Plan 3 before Plan 1 they could leave the original (broken) `handleCompleteChore` in place.

Additionally, Plan 3 modifies App.tsx across multiple steps and its Step 2 lists specific `useEffect` and `useMemo` replacements. It does not redescribe the full `handleCompleteChore` function, which means there is no instruction to preserve Plan 1's new try/catch pattern when applying Plan 3's changes.

**Result if unresolved:** A developer applying Plan 3 mechanically might overwrite or overlook Plan 1's reconcile/rollback code in `handleCompleteChore`.

### Proposed Solution

Amend **Plan 3, Step 2** to add an explicit preservation note immediately before the `handleCompleteChore` bullet:

> **Note (if `db-routes-and-state-fix` has already been applied):** `handleCompleteChore` already contains a snapshot/reconcile/rollback pattern from that plan. Do NOT replace or simplify that function body — only ensure it does not call `setSortedIds`. The existing reconcile pattern (`setChoreData(curr => curr.map(c => c.id === id ? updated : c))`) and rollback (`setChoreData(prev)`) must be preserved.

### Design Decision DD-4

| # | Option | Trade-off |
|---|---|---|
| 1 | Add preservation note to Plan 3 Step 2 (recommended) | Prevents accidental regression; no code change needed. |
| 2 | Rewrite the full `handleCompleteChore` body in Plan 3 to include both Plan 1's reconcile pattern and Plan 3's non-sort constraint | Explicit and unambiguous; duplicates code between plans. |

**Chosen:** Option 1 — Add preservation note to Plan 3 Step 2.

---

## Phase 5 — Resolve C5: `ChoreTimerBar.tsx` edited by three plans

### Background

All three feature/fix plans touch `ChoreTimerBar.tsx` independently:

| Plan | Step | Change |
|---|---|---|
| Plan 1, Step 3 | Adds `useEffect` to sync `dateLastCompleted` when prop changes |
| Plan 1, Step 4 | Adds `onDelete: (id: number) => void` prop + delete button |
| Plan 3, Step 3 | Changes `resetTask()` to use `new Date()` instead of `day` |
| Plan 4, Step 3 | Replaces `status`/`barWidth`/`barColor` calculations; changes `OverdueBadge` condition; adds `isUrgent`; updates `<ProgressBar>` call |

**No plan cross-references any other.** If applied in order (Plan 1 → Plan 3 → Plan 4) there are no logical conflicts — the changes touch different parts of the component. However, two specific interactions need to be verified explicitly:

1. **Plan 4 removes `status`** — Plan 1 Step 3's `useEffect` and Plan 1 Step 4's delete button do not reference `status`, so no issue there. But a developer should confirm `status` is not referenced anywhere after Plan 4 executes.

2. **Plan 4 changes `OverdueBadge` condition from `status > 1` to `isOverdue`** — Plan 1 does not touch the `OverdueBadge` line. No conflict, but the condition must be `isOverdue` (boolean) after Plan 4.

3. **`resetTask()` in Plan 3 Step 3 uses `new Date()`** — Plan 4's smoke test description (`resetTask()` snaps back to 100% green) remains valid since `daysSince` still computes to 0 when `dateLastCompleted` is today.

### Proposed Solution

Amend each plan to note the other plans' changes as context:

**Plan 1, Step 3** — Add at the end:
> **Note:** A later plan (`real-time-midnight-sort`) will change `resetTask()` to use `new Date()` instead of the `day` prop. The `useEffect` added here is compatible with that change — `setDateLastCompleted` is called in both the effect and `resetTask()`, and they do not conflict.

**Plan 4, Step 3** — Add at the start:
> **Prerequisite:** If `db-routes-and-state-fix` and `real-time-midnight-sort` have been applied, `ChoreTimerBar.tsx` will already contain:
> - A `useEffect` syncing `dateLastCompleted` from props (Plan 1 Step 3)
> - An `onDelete` prop and delete button (Plan 1 Step 4)
> - `resetTask()` using `new Date()` (Plan 3 Step 3)
>
> These are all compatible with the changes in this step. Preserve them.

### Design Decision DD-5

| # | Option | Trade-off |
|---|---|---|
| 1 | Add cross-reference notes to Plan 1 Step 3 and Plan 4 Step 3 (recommended) | Low-friction; no scope change. |
| 2 | Consolidate all `ChoreTimerBar.tsx` edits into a single plan step | Eliminates ambiguity; requires restructuring plan sequence significantly. |

**Chosen:** Option 1 — Add cross-reference notes to Plan 1 Step 3 and Plan 4 Step 3.

---

## Phase 6 — Resolve C6: E2E selector compatibility after Plan 3

### Background

**Plan 2, Step 7** E2E smoke tests include:
- `page.waitForSelector('[data-testid="chore-list"], .chore-item, text=Vacuum')`
- `await expect(page.locator('text=Vacuum Bedroom Floor')).toBeVisible()`
- References to `text=Vacuum` generally

**Plan 3** changes how `orderedChores` is computed (frozen sort order). The seed chores themselves are unchanged, so `Vacuum Bedroom Floor` should still appear. However:

- Plan 3 Step 2 changes the `{day.toDateString()}` display to show the real current date. Plan 2's E2E tests do not assert on the date display, so no selector breaks here.
- The note in Plan 2 Step 7 already anticipates selector drift: *"After implementing that plan, run the tests and update any selector that doesn't match."* This covers Plan 3's UI changes.

**Severity is Minor** — the tests already contain a self-healing instruction. However, one specific assertion may need attention:

The test `'marks a chore complete and shows updated timer'` clicks the first `button[hasText=/done|complete/i]`. After Plan 3, completing a chore no longer changes its position. The test currently only asserts no error appears — it doesn't assert position, so it remains valid.

### Proposed Solution

No plan amendments required. The existing self-healing note in Plan 2 Step 7 covers this. However, add a reminder in Plan 3's smoke test (Step 5) that E2E tests should be re-run after this plan:

> **Note:** After completing this plan, re-run `npm run test:e2e` to confirm the E2E smoke tests still pass with the new sort behaviour. Update any selectors that changed.

### Design Decision DD-6

| # | Option | Trade-off |
|---|---|---|
| 1 | Add re-run reminder to Plan 3 Step 5 (recommended) | Free reminder with no risk. |
| 2 | No change — existing note in Plan 2 Step 7 is sufficient | Slightly less explicit. |

**Chosen:** Option 1 — Add re-run reminder to Plan 3 Step 5.

---

## Recommended Execution Order

```
Plan 1: db-routes-and-state-fix
  → verify: manual smoke test (Plan 1 Step 5)
  → verify: no TypeScript errors

Plan 2: automated-test-setup
  → verify: npm test --workspace backend (13 tests green)
  → verify: npm test --workspace frontend (14 tests green)
  → verify: npm run test:e2e (smoke tests pass; delete test is expected Red)

Plan 3: real-time-midnight-sort
  → verify: npm run test:e2e (re-run after selector check)
  → verify: npx tsc --noEmit from project root
  → note: useChoreSort.test.ts deleted in this phase (DD-1)

Plan 4: progress-bar-decay
  → verify: npm test --workspace frontend
  → verify: manual smoke test with updated approach (DD-3)
  → verify: npx tsc --noEmit
```

---

## Amendment Checklist

Once design decisions are made, apply these targeted amendments:

| # | Plan | Step | Type | Status |
|---|---|---|---|---|
| A1 | Plan 3 | Step 4 | Add cleanup task: delete `useChoreSort.test.ts` | **Apply** (DD-1: Option 1) |
| A2 | Plan 1 | Step 1 | Add note: router.ts will be renamed to app.ts in Plan 2 | **Skip** (DD-2: Moot — Plan 1 already ran) |
| A3 | Plan 4 | Step 5 | Replace time-simulation smoke test instructions; add Vitest unit test for barWidth/barColor | **Apply** (DD-3: Option 3) |
| A4 | Plan 3 | Step 2 | Add note: preserve Plan 1's handleCompleteChore reconcile/rollback | **Apply** (DD-4: Option 1) |
| A5 | Plan 1 | Step 3 | Add note: compatible with Plan 3's resetTask change | **Skip** (DD-5: Option 1, but Plan 1 already ran) |
| A6 | Plan 4 | Step 3 | Add prerequisite note listing Plan 1 and Plan 3's ChoreTimerBar changes | **Apply** (DD-5: Option 1) |
| A7 | Plan 3 | Step 5 | Add note: re-run E2E tests after this plan | **Apply** (DD-6: Option 1) |
