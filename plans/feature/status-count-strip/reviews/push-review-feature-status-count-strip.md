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

## Review 2
Generated: 2026-09-23
Comparison: origin/feature/status-count-strip...HEAD (PR #52 follow-up: animated widths + bar-matched colour/opacity)
Verdict: **PUSHED WITH MINOR FINDINGS**

### Results by Reviewer

#### 1. Safety & Security — PASS
The change is purely presentational styling. Counts are React-escaped text.

#### 2. Correctness — PASS
`flex-grow` and `min-width` are both animatable, and `transition-all duration-300 ease-in-out` matches ProgressBar. The stable `key={segment.key}` keeps each node mounted, so widths animate in both directions. `overflow-hidden` on the root clips collapsed segments.

#### 3. Simplicity & Conciseness — PASS
The result is net simpler than before: there is no intermediate `shown` array and no `total` or `grow` fields.
- *minor* — `StatusCountStrip.tsx:35`: `showsZero` picks the all-zero fallback by array position (`index === 0`), not by key.

#### 4. Test Coverage — PASS
The tests were rewritten to cover the always-mounted, collapsing segments; the colour and opacity-50 fill against a full-opacity label; the transition classes; and DOM identity across a rerender.
- *minor* — `StatusCountStrip.test.tsx:12`: `fillOf` and `labelOf` locate elements by DOM structure (`firstElementChild`, `querySelector('span')`), not by test ID.
- *minor* — `StatusCountStrip.test.tsx:107`: the identity-across-rerender case only covers the grow direction (0→1), not shrinking to zero.

#### 5. Completeness & Cleanup — PASS
- *minor* — PR #52's description is stale. It says zero segments are "not rendered" and that colours are at "full opacity". *(Resolved: the PR body was updated after this push.)*

#### 6. Consistency & Style — PASS
The change mirrors ProgressBar and ChoreTimerBar: an opacity-50 hue over a `bg-gray-800` track, `transition-all duration-300 ease-in-out`, and the same `firstElementChild` test-access pattern.

#### 7. Integration Risk — PASS
The component is a self-contained leaf. The root's new `bg-gray-800` never appears together with `rounded-full`, so the e2e `.bg-gray-800.rounded-full` selector can't match it.

#### 8. Error Handling & Silent Failures — PASS
No I/O, async code or fallbacks.

### To-Do: Required Changes

- [ ] **Select the all-zero fallback segment by key** — `frontend/src/components/nav/StatusCountStrip.tsx` — Replace `allZero && index === 0` with `allZero && segment.key === 'doneToday'` and drop the unused `index` map argument.
- [ ] **Give the fill and label stable test IDs** — `frontend/src/components/nav/StatusCountStrip.tsx`, `frontend/src/__tests__/components/StatusCountStrip.test.tsx` — Add `data-testid="<segment>-fill"` and `data-testid="<segment>-label"`, and query by those in `fillOf`/`labelOf` instead of `firstElementChild` and `querySelector('span')`.
- [ ] **Cover the shrink-to-zero rerender** — `frontend/src/__tests__/components/StatusCountStrip.test.tsx` — Add a rerender from `{ doneToday: 2, dueSoon: 0, overdue: 1 }` to `{ doneToday: 0, dueSoon: 0, overdue: 1 }`. Assert it is the same node, `flexGrow` is `'0'`, and `textContent` is empty.
- [x] **Update the PR #52 description to the new rendering** — GitHub PR body — The description now covers always-mounted collapsing segments, the opacity-50 fill over the `bg-gray-800` track, and e2e safety coming from omitting `rounded-full`.
