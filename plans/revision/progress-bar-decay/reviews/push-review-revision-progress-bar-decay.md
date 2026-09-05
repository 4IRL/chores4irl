# Push Review: revision/progress-bar-decay

## Review 1
Generated: 2026-09-04 18:46
Comparison: origin/main...HEAD (1 commit — `03cf944`)
Verdict: **BLOCKED** — all five to-do items since resolved in the working tree (not yet committed or pushed): four applied, item 5 considered and declined by user decision. Re-run `/git-push` to re-review and push.

### Results by Reviewer

#### 1. Safety & Security — PASS
Diff only changes static Tailwind class thresholds/strings and tests for the chore progress bar; no user input, secrets, or dangerous operations involved. No findings.

#### 2. Correctness — PASS
The two-entry `statusColors` table (green > 0.375, orange `-Infinity` fallback) combined with `computeBar`'s `isOverdue`-gated red branch correctly covers every `remainingRatio` value, including the exact 0.375 boundary and NaN/edge cases via the `??` fallback. The `opacity-50` relocation is applied at the single point (`ProgressBar.tsx`) where `barColor` is consumed. No findings.

#### 3. Simplicity & Conciseness — PASS
- *(minor)* `frontend/src/assets/constants.ts:7` — `statusColors` is now a 2-entry array (one real threshold plus a `-Infinity` catch-all) modeling what is really a single binary decision. The lookup-table shape earned its keep at three tiers; at two it is indirection for one comparison, and the array, the `StatusColor` type, and the `.find()` traversal all exist to serve it.
- *(minor)* `frontend/src/utils/choreBarMath.ts:30` — `(match ?? statusColors[statusColors.length - 1]).color` is now dead-code insurance: the last entry's threshold is `-Infinity` and `remainingRatio` in this branch is always finite, so `.find()` always matches and the `??` arm can never be exercised.

#### 4. Test Coverage — FAIL
- *(major)* `frontend/src/__tests__/components/ChoreTimerBar.barMath.test.ts:17` — **Nothing in the suite guards the regression this commit exists to fix.** Every assertion on `result.barColor` uses `toContain('green'|'orange'|'red')`, which still passes if `choreBarMath.ts` were reverted to append `' bg-opacity-50'` — the substring `'green'` is present either way. Separately, `ProgressBar.test.tsx:7` renders the component with a hand-picked clean prop `color="bg-green-500"`, so it never exercises the real value `computeBar` produces; its new `not.toContain('bg-opacity-50')` assertion therefore only proves the test's own literal is clean, not that production output is. Net effect: a future edit reintroducing `bg-opacity-50` into `computeBar`'s output ships the exact "bar renders fully opaque" bug again, with a green suite.

#### 5. Completeness & Cleanup — PASS
Clean of debug code, TODOs, and incomplete work; all rewritten/added comments in `constants.ts` and the test files accurately match the code's actual thresholds and branch behavior.
- *(minor)* `frontend/src/components/form/AddChoreButton.tsx:8` — out of diff: still uses `bg-opacity-50` (`bg-blue-500 hover:bg-blue-600 bg-opacity-50 ...`). Same dead-utility bug class this commit just fixed, in a sibling component. Pre-existing, not a regression from this change.

#### 6. Consistency & Style — PASS
- *(minor)* `frontend/src/utils/choreBarMath.ts:29` — the single-letter callback param `s` in `statusColors.find(s => ...)` is unchanged context, and matches the codebase's established idiom (`choreData.find(c => ...)` in `App.tsx`, `chores.filter(c => ...)` in `useRoomFilter.ts` and `choreSort.ts`). No `id-length` rule in `eslint.config.js`. Not actionable here; tightening it would be a separate repo-wide cleanup.

#### 7. Integration Risk — PASS
Repo-wide grep confirms `statusColors` and `computeBar` have exactly one consumer each, and `ChoreTimerBar.tsx:124` always routes `barColor` through the updated `ProgressBar`, so the opacity relocation cannot render fully opaque anywhere today. No schema, config, or dependency changes.
- *(minor)* `frontend/src/utils/choreBarMath.ts:3` — the `barColor` contract silently changed meaning: it was a render-ready composed class string, and is now a bare fill color that only looks right if the consumer also applies `opacity-50`. `BarMathResult` carries no note of this, so a second future consumer could render it directly and get an opaque bar with no type-level warning.
- *(minor)* `frontend/src/components/form/AddChoreButton.tsx:8` — same `bg-opacity-50` observation as above.

#### 8. Error Handling & Silent Failures — PASS
No try/catch, async, or I/O anywhere in the changed code — pure synchronous threshold math plus static config and tests. The `bg-opacity-50` → `opacity-50` change itself fixes a real silent bug.
- *(minor)* `frontend/src/utils/choreBarMath.ts:29` — the `?? statusColors[length - 1]` fallback would silently pick whatever entry happens to be last if the `-Infinity` sentinel were ever removed or reordered, producing a wrong-but-plausible color with no warning. Latent and low-blast-radius, not a defect introduced here.

*(Reviewer 9, Type Design, was not launched — the diff introduces no new type definitions and does not reshape existing ones.)*

### To-Do: Required Changes

- [x] **Assert `computeBar` output is free of the dead `bg-opacity-50` utility** *(done 2026-09-04 — guard added at `ChoreTimerBar.barMath.test.ts:9` (non-overdue branch) and `:40` (overdue branch); mutation-verified: reintroducing the concat fails both tests)* — `frontend/src/__tests__/components/ChoreTimerBar.barMath.test.ts` — In at least the overdue and one non-overdue case, add `expect(result.barColor).not.toContain('bg-opacity-50')` alongside the existing `toContain('red')` / `toContain('orange')` assertions. Current assertions substring-match color names only, so they pass whether or not the dead utility is concatenated back on. **This is the blocking item.**
- [x] **Close the computeBar → ProgressBar integration gap** *(done 2026-09-05 — two rendering tests added at the end of `ChoreTimerBar.test.tsx` driving the real component for a not-yet-due and an overdue chore; mutation-verified: reintroducing the concat fails exactly these two, on the opacity assertion)* — `frontend/src/__tests__/components/ChoreTimerBar.test.tsx` — Add one rendering test that drives the full component for an overdue and a non-overdue chore and asserts the fill div's `className` contains `opacity-50` and not `bg-opacity-50`. `ProgressBar.test.tsx` currently passes a hand-written `color` prop, so it never exercises the real value `computeBar` produces.
- [x] **Document the `barColor` opacity contract** *(done 2026-09-05 — 3-line comment on `BarMathResult.barColor` in `choreBarMath.ts`; kept the field name rather than renaming to `barFillClass`, since the rename would churn `ChoreTimerBar.tsx` for no added safety)* — `frontend/src/utils/choreBarMath.ts` — Add a short comment on `BarMathResult.barColor` (or rename it to `barFillClass`) noting that opacity is deliberately applied by the renderer (`ProgressBar`) and is not baked into the string, so a future second consumer doesn't render an opaque bar.
- [x] **Fix the same dead-utility bug in the sibling button** *(done 2026-09-04 — ported to `bg-blue-500/50 hover:bg-blue-600/50`; the alpha-suffixed colour, not `opacity-50`, since v3's `bg-opacity-*` tinted only the background and `opacity-50` would fade the white label too)* — `frontend/src/components/form/AddChoreButton.tsx:8` — Replace `bg-opacity-50` with `opacity-50` (or the alpha-suffixed `bg-blue-500/50`). Tailwind is pinned at `^4.1.8`, which dropped `bg-opacity-*`, so the button currently renders fully opaque. Pre-existing, out of this diff.
- [x] **Consider collapsing the two-entry `statusColors` table** *(considered and DECLINED 2026-09-05 by user decision — table kept as-is for extensibility: adding a tier stays a one-line array edit. The unreachable `??` fallback is retained deliberately as part of that choice. No code change.)* — `frontend/src/assets/constants.ts`, `frontend/src/utils/choreBarMath.ts` — With red moved out, the table encodes one binary decision. Optionally replace with a single exported threshold constant and `remainingRatio > threshold ? 'bg-green-500' : 'bg-orange-500'`, dropping the `StatusColor` type, the `.find()` traversal, and the now-unreachable `??` fallback together. Optional; the table is not wrong, only more machinery than a two-way split needs.
