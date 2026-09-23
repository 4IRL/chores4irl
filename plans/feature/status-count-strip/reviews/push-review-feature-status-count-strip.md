# Push Review: feature/status-count-strip

## Review 1
Generated: 2026-09-23
Comparison: origin/main...HEAD
Verdict: **PUSHED WITH MINOR FINDINGS**

### Results by Reviewer

#### 1. Safety & Security — PASS
This is a pure display feature. Counts go into the DOM only through JSX text and attribute interpolation. There is no `dangerouslySetInnerHTML`, no network, file or system calls, and no secrets. Nothing in the diff is security-relevant.

#### 2. Correctness — PASS
`countStatuses` counts `daysSince === 0` as `doneToday` before it calls `classifyStatus`, which buckets the rest into red and orange. It reuses the shared thresholds and colour map, so no literals are re-declared. A negative `daysSince` (completed after the displayed day) falls through to no segment, and so does a chore with frequency 0. The wiring reads `searchFilteredChores` and `simulatedDate`, as the spec requires.

#### 3. Simplicity & Conciseness — PASS
The change is small and tightly scoped. There is no over-engineering and no dead code.
- *minor* — `StatusCountStrip.tsx:21`: the `count` and `grow` fields in `shown` are equal except in the all-zero fallback, so one of them is redundant.

#### 4. Test Coverage — PASS
Coverage matches the F17 spec's required list: 5 utility cases, 6 component cases and 4 App cases. There are also extras: empty list, completion after the displayed day, frequency 0, search narrowing and day simulation.

#### 5. Completeness & Cleanup — PASS
There is no debug code, TODO, stub or leftover artifact. Every new comment was checked against the code it describes.

#### 6. Consistency & Style — PASS
The code follows the existing conventions: import order, `type XProps` with a default-exported function, path aliases, kebab-case test IDs, and test placement under `__tests__/{utils,components}`.

#### 7. Integration Risk — PASS
The change is purely additive. It adds 2 imports, 1 `useMemo` and 1 JSX line to `App.tsx`. No shared signatures change, and there are no new dependencies or config changes.
- *minor* — `App.tsx:9`: the sibling F18 worktree (`feature/scroll-to-top`) will also edit `App.tsx`, mainly its imports and the JSX near the scroll region. Expect at most an adjacent-import-line conflict at merge time, not a logic conflict.

#### 8. Error Handling & Silent Failures — PASS
Everything is synchronous derived state and pure rendering. There is no try/catch, no async code and no new API calls. A failed initial load shows the green `0` bar, which the plan explicitly accepted (DD-3).

#### 9. Type Design — PASS
The types are small and single-purpose, each with one constructor and one consumer. They reuse the `ChoreStatus` union and the `STATUS_BAR_COLOR` lookup.
- *minor* — `StatusCountStrip.tsx:8`: `SEGMENTS: { key: keyof StatusCounts; … }[]` does not force the array to cover every key of `StatusCounts` exactly once.
- *minor* — `choreStatusCounts.ts:7`: nothing in `StatusCounts` stops a count from being negative or fractional. Awareness only: `countStatuses` is the only constructor, and it only increments.

### To-Do: Required Changes

- [x] **Collapse the redundant `grow` field** _(resolved by the PR #52 follow-up rewrite: segments now always mount and derive `flexGrow` inline)_ — `frontend/src/components/nav/StatusCountStrip.tsx` — Drop `grow` from the `shown` entries and render `style={{ flexGrow: segment.count || 1, flexBasis: 0 }}`. This is safe because `count` is 0 only in the single-segment all-zero fallback. Keep the component test's `flexGrow === '1'` all-zero assertion green.
- [ ] **Make `SEGMENTS` exhaustive over `StatusCounts` at compile time** — `frontend/src/components/nav/StatusCountStrip.tsx` — Declare the segment metadata as `const SEGMENT_META = { doneToday: {…}, dueSoon: {…}, overdue: {…} } satisfies Record<keyof StatusCounts, { testId: string; status: ChoreStatus }>`. Derive the ordered array from a fixed key tuple, so that adding a field to `StatusCounts` without a segment fails `tsc`. This is optional hardening; both sets are closed and low-churn.
- [ ] **(Awareness) Expect an adjacent-import conflict with F18 in `App.tsx`** — `frontend/src/App.tsx` — Whichever of F17 and F18 merges second should rebase onto `main` and resolve the import block. The two JSX insertion points don't overlap.
- [ ] **(Awareness) Guard `StatusCounts` if a second producer appears** — `frontend/src/utils/choreStatusCounts.ts` — No action needed now. If counts ever come from outside `countStatuses` (a form or an API), add a runtime non-negative-integer guard or a branded type.
