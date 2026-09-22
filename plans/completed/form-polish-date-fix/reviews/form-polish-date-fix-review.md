# Review: F21 — Add/edit form polish + UTC-vs-local date-math fix

## Review — 2026-09-21

### Summary
Requires changes before proceeding. The core design (form-boundary helpers, add-mode
defaults, inline fixed toast, no migration) is sound and every META-PLAN § F21 design item
and open risk is resolved, but the review reproduced two blocking defects in-repo: Step 1's
"expected pre-fix failure pattern" is factually wrong (Case B fails in New York, Case C never
fails, D's text is `1 day ago`) so its own halt gate deadlocks a never-ask executor, and the
success toast's copy makes Playwright's substring `text=<name>` locators at
`e2e/smoke.spec.ts:137/199` resolve to two elements (a non-retriable strict-mode violation)
which Step 7 never migrates. Two further test-spec defects (an un-imported `fireEvent`, App
toast tests that never click Save) make prescribed Red tests unrunnable. The rest is
mechanical polish.

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | FAIL | 2 critical, 0 major, 6 minor |
| 2 | Full-Stack Trace | FAIL | 1 critical, 0 major, 3 minor |
| 3 | Ordering & Cleanup | FAIL | 1 critical, 3 major, 3 minor |
| 4 | Integration & Conventions | FAIL | 1 critical, 2 major, 9 minor |
| 5 | Verification & Coverage | FAIL | 4 critical, 4 major, 7 minor |
| 6 | Completeness & Risk | FAIL | 1 critical, 5 major, 6 minor |

Deduplicated: **4 critical, 7 major, 16 minor** (27 distinct findings).

### Findings

#### Critical (must fix before proceeding)
- **[Step 1] Stated pre-fix failure pattern is wrong; the step's halt gate deadlocks the executor** _(Subagents #1, #2, #3, #4, #5, #6 — all reproduced in-repo by running Cases A–D verbatim against the unfixed form)_: Actual pattern — `America/New_York`: A fails (`getDate()` 30, `getHours()` 20), **B fails** (input reads `2025-04-01` — the 21:30 EDT instant is already Apr 1 in UTC), **C passes** (the two bugs cancel on a same-day round-trip), D fails with `'1 day ago'` (singular; the plan's `'1 days ago'` never renders). `Asia/Tokyo`: only A fails (via `getHours() === 9`); B, C, D pass. The plan claims "NY: A, C, D fail; Tokyo: B fails (`2025-03-30`)" and instructs the executor to "fix the test before continuing" when a case passes where it is expected to fail — which fires for C in NY and B in Tokyo, neither of which can be made to fail as written. Research Finding (2) and Decision (a) carry the same inverted claim. → **DD-1**.
- **[Step 7] Success toasts break the smoke spec's `text=<name>` locators** _(Subagents #1, #2, #4, #5, #6 — reproduced with the repo's Playwright 1.59.1 via `page.setContent`)_: Playwright's legacy `text=` engine is a case-insensitive substring match returning the innermost element. After Step 6 a successful add commits `<span>Added "E2E Test Chore"</span>` in the same render as the new bar, so `page.locator('text=E2E Test Chore')` at L137 (and `text=E2E Edited` at L199) resolves to 2 elements; `expect(...).toBeVisible()` throws `strict mode violation` inside `injected.evaluate`, which `isNonRetriableError` treats as terminal — it fails in ~30 ms, never polling until the toast auto-dismisses. L167/L268's `not.toBeVisible` on the deleted name now match only the `Deleted "…"` toast and pass only after 2.5 s (silently coupled to `SUCCESS_TOAST_MS`). Step 7 migrates only `.bg-red-700`. Worse for cadence: `/run-plan` §2c smoke-tests after every UI step, so this surfaces right after Step 6, before Step 7 exists. → **DD-2**.
- **[Step 3] Test (v) uses `fireEvent` but `ChoreForm.test.tsx` imports only `{ render, screen }`** _(Subagents #5, #6)_: `ReferenceError: fireEvent is not defined` — the Red run reports a load error, not the three intended failures. Mechanical.
- **[Step 6] App toast test (i) never clicks Save** _(Subagent #5)_: `openAndFillForm` (App.test.tsx L376-384) opens and fills only; every existing caller follows it with `user.click(getByRole('button', { name: 'Save' }))`. As written `addChore` is never invoked and `waitFor` times out; (iv)–(vii) inherit the omission. Mechanical.

#### Major (should fix)
- **[Step 1] Step 1 ends in a deliberately red suite that the `/run-plan` per-step cadence commits and may treat as a blocker** _(Subagent #3)_: each step runs via a never-ask subagent that validates (tests green), reviews, and commits (`git add .`; no hooks). Step 1 is the only step whose intended end state is failing tests; nothing tells the executor the failure pattern *is* the pass criterion, so it may stop the run or "fix" the red tests. → **DD-3**.
- **[Step 1] Tokyo never exercises the pre-fill direction with the 21:30 fixture** _(Subagent #5; also #1 Option B, #6 Option A)_: an early-morning instant (`new Date(2025, 2, 31, 3, 0, 0)` → `2025-03-30T18:00Z` in Tokyo) is the mirror of Case B. Folded into **DD-1**.
- **[Step 1] Prescribed `fireEvent` import is unused → `@typescript-eslint/no-unused-vars` error** _(Subagents #1, #3, #5, #6)_: lint is `error` with `varsIgnorePattern '^[A-Z_]'`; first seen at Step 5/6's `npm run lint` gate. Mechanical.
- **[Step 6] `showToast` inside `loadChores`'s `useCallback` without joining its deps → `react-hooks/exhaustive-deps` warning** _(Subagents #1, #2, #3, #4, #5, #6 — reproduced with `npx eslint` on a scratch copy)_: `setError` was a state setter (exempt); `showToast` is not. `npm run lint` still exits 0 (warn level, no `--max-warnings`) but is no longer "clean" as Steps 6/9 assert. Mechanical.
- **[Step 6] `describe('feedback toast (F21)')` cannot reach `openAndFillForm`; no `beforeEach`; (vii) re-fill unspecified** _(Subagents #5, #6; #2 for (vii))_: the helper is declared inside `describe('handleAddChore')`; a sibling describe gets TS2304. No file-level `beforeEach` — `vi.clearAllMocks()` resets call history, not implementations, so (iv)'s rejection leaks into (v)–(vii). After a failed add the modal stays open with a reset form, so "submit again" must re-run the fill. → **DD-4** (hoist vs nest); the (vii) re-fill wording is mechanical.
- **[Step 6] A failed tap-to-complete's red toast survives a successful retry** _(Subagent #6)_: META-PLAN § F21 Design 4 says the error tone is replaced by "the next successful mutation"; the plan raises no toast on `handleCompleteChore` success, so the most common kiosk failure (bar-tap PATCH 500) leaves the red pill up until someone finds the ✕. → **DD-5**.
- **[Step 6] The Decisions claim "an identical success within 2.5 s remounts Toast and restarts its timer" has no test** _(Subagent #5 — mechanism verified in-repo, wiring unguarded)_. → **DD-6**.

#### Minor (nice to fix)
- **[Steps 2, 3, 6, 7, 9] Every "returns nothing" / `→ 0` grep gate exits 1 on its pass condition** _(Subagents #1, #3, #4, #6)_: use `! grep -q …` (exit 0 = clean) or `|| true`; Step 7's L314 comment still contains the token `bg-red-700` and must be rewritten or it is the last match. Mechanical.
- **[Steps 1, 6, Research] Citation slips** _(Subagents #1, #2, #5)_: `'1 days ago'` → `'1 day ago'`; `choreSort.ts:4` → `:5`; Step 6 (ii)'s "`let resolveUpdate!` pattern at L297-300" is actually the `rejectEdit` reject pattern — spell out the resolve twin (and `resolveRemove` for (iii)). Mechanical.
- **[Step 5] `Toast.test.tsx` import list unspecified (`act`, `fireEvent`, `render`, `screen`, `vi`) and no `describe('Toast (F21)')`; `formDate.test.ts` has no `(F21)` describe** _(Subagents #1, #3, #4, #5, #6)_. Mechanical.
- **[Steps 3, 6, 7] Line-number anchors go stale after each sequence's first insertion** _(Subagent #3 — simulated whole)_: every quoted anchor is unique; say "anchor on the quoted text, line numbers are pre-edit". Mechanical.
- **[Step 1] "verified on Node 24" comment — CI runs Node 20** _(Subagents #4, #5)_: runtime `TZ` re-read is Node ≥ 13; verified on 22 and 24. Mechanical.
- **[Research] F20's soft dependency never resolved** _(Subagent #4)_: no F20 branch; `App.tsx:316` still `inert={isBlanked || isLocked}` — say the "toast while locked" test is N/A. Mechanical.
- **[Steps 3, 5, 6] New comments should carry the `F21:` feature-ID prefix** _(Subagent #4)_. Mechanical.
- **[Steps 5, 6] Micro-conventions: `<X size={18}>` → `className="w-4 h-4"` (every sibling icon); `useRef(0)` → `useRef<number>(0)`** _(Subagent #4)_. Mechanical.
- **[Decisions (a), Step 8, Research] Bare `vitest.config.ts` / `README.md` are ambiguous in this monorepo** _(Subagent #4)_: qualify as `frontend/vitest.config.ts`, root `README.md`. Mechanical.
- **[Step 3, Decision (b)] jsdom does enforce `required` on submit** _(Subagent #5 — verified)_: `requestSubmit` runs `reportValidity()`; say so in (v) and Decision (b). Mechanical.
- **[Step 7] The new `toContainText('Thu Jan 01 2026')` e2e guard is red pre-fix only on a behind-UTC host** _(Subagent #5)_: CI's UTC browser is green either way; note that the Vitest file is the real guard. Mechanical.
- **[Step 5] `onDismiss` is an effect dependency — document the referential-stability contract on the prop** _(Subagent #6)_. Mechanical.
- **[Decisions] Midnight rollover while the add form is open keeps yesterday's default; TZ-test file location and `SUCCESS_TOAST_MS` naming deviate from META-PLAN's literal wording** _(Subagents #6, #4)_: add two Decisions bullets so Phase C fold-back rewrites the bullets rather than reporting a gap. Mechanical.
- **[Step 1] Case C's click mechanism unspecified; `Date` fixtures must be built inside the `it` body (the `describe.each` callback runs at collection time, before `beforeAll` sets `TZ`)** _(Subagent #6)_. Mechanical.
- **[Step 5] `max-w-[calc(100%-2rem)]` is dead on a `fixed left-1/2` auto-width box** _(Subagent #1)_: shrink-to-fit caps the pill at 50 vw before `max-w` binds; long errors wrap at half width. → **DD-7**.
- **[Step 5] The fixed toast can cover the open form's Save/Cancel row on ≤ 760 px viewports** _(Subagent #6)_: an error toast after a failed add persists over the still-open modal. → **DD-8**.
- **[Steps 7, 9] The inherited `/run-feature` 30-s retry loop cannot be run by a `/next-step-taker` subagent (foreground `sleep` is blocked)** _(Subagent #4)_. → **DD-9**.
- **[Step 8] README: cross-link the form's local-date semantics from the Pi Timezone bullet?** _(Subagent #4)_. → **DD-10**.
- **[Step 6] No App-level test for dismissing the error toast or for "no toast on tap-to-complete"** _(Subagent #5)_. → **DD-11**.

### Verification Gaps
- **Step 1**: the red-phase gate must state the observed pattern (see DD-1); run `npm test --workspace frontend -- src/__tests__/components/ChoreForm.dateBoundary.test.tsx` and compare to the corrected text.
- **Step 6**: `npm run lint` must print `0 problems` — the bare `eslint .` script does not fail on warnings, so read the output.
- **Step 7**: e2e must be green *before* `/run-plan`'s post-Step-6 smoke run (DD-2 placement).

### To-Do: Mechanical Fixes (auto-applied)
- [x] Step 1: drop unused `fireEvent` import; Case C clicks `Save Changes` via `userEvent`; `Date` fixtures built inside the `it` body _(applied by fixing subagent — dry-run: eslint rule + `Save Changes` label confirmed)_
- [x] Citations: `'1 days ago'` → `'1 day ago'`; `choreSort.ts:4` → `:5`; Step 6 (ii)/(iii) spell out the `resolveUpdate`/`resolveRemove` pending-promise form (L297-300 is the `rejectEdit` pattern) _(applied by fixing subagent)_
- [x] Step 3: add `fireEvent` to `ChoreForm.test.tsx:2` import; note jsdom enforces `required` on submit in (v) and Decision (b) _(applied by fixing subagent)_
- [x] Steps 2/5: `Toast.test.tsx` full import list (`act` from RTL) + `describe('Toast (F21)')`; `formDate.test.ts` gets `describe('formDate helpers (F21)')` _(applied by fixing subagent)_
- [x] Step 6: `loadChores` deps `[reconcileChores, showToast]`; lint gate reads "must print 0 problems" _(applied by fixing subagent — dry-run: L83-96 useCallback confirmed)_
- [x] Step 6 Red: (i) clicks Save after `openAndFillForm`; (iv) uses `mockRejectedValueOnce` + open/fill/Save; (vii) re-runs the fill on the still-open reset form _(applied by fixing subagent)_
- [x] Steps 2/3/6/7/9: expected-empty gates rewritten as `! grep -q …` (exit 0 = pass); Step 7 rewrites the L314 comment so `bg-red-700` reaches zero; gate-convention sentence under `## Steps` _(applied by fixing subagent — every gate dry-run on happy + zero-match paths)_
- [x] Steps 3/7: line-number anchors marked pre-edit, edits anchored on quoted text; bare `vitest.config.ts`/`README.md` qualified _(applied by fixing subagent — 4 `user.type` sites and both file ambiguities confirmed)_
- [x] Step 1/Decisions (a): TZ comment no longer Node-24-specific (Node ≥ 13; CI Node 20); F20 recorded as not landed → "toast while locked" test N/A _(applied by fixing subagent)_
- [x] Steps 3/5/6: `F21:` comment prefixes; `<X className="w-4 h-4">`; `useRef<number>(0)`; `onDismiss` stability JSDoc _(applied by fixing subagent)_
- [x] Step 7: e2e `toDateString` guard noted as host-zone-only; Decisions: mount-time default date, TZ-test file location + `SUCCESS_TOAST_MS` naming _(applied by fixing subagent)_
- [x] Whole-document re-run: no stale tokens (`1 days ago`, `size={18}`, `useRef(0)`, `returns nothing`, …), headings + 40 unticked boxes intact, gate convention present _(applied by whole-document re-run)_

### Design Decisions (awaiting user input)

_Step numbers in the DD titles and option text below are as of Pass 1, before DD-3 merged Steps 1 and 2. In the applied plan, Pass-1 Step N is now Step N−1 for N ≥ 3 (Pass-1 Step 5 "Toast" → Step 4; Step 6 "App toast" → Step 5; Step 7 "e2e" → Step 6; Step 8 "README" → Step 7; Step 9 "Verify" → Step 8). Finding text is left as written._

#### DD-1: [Step 1] Correct the pre-fix failure pattern — strengthen the cases or text-only?
**Context:** Reproduced in-repo: NY fails A/B/D, Tokyo fails only A (`getHours`), C never fails (the two bugs cancel), D renders `1 day ago`. The halt gate as written deadlocks. Both options also fix `'1 days ago'`, and reword Research Finding (2) / Decision (a) to the evening-instant behaviour.

| # | Option | Trade-off |
|---|---|---|
| 1 | **Strengthen** — add Case B2 (pre-fill of a *morning* instant `new Date(2025, 2, 31, 3, 0, 0)` → red in Tokyo, `'2025-03-30'`), add `.getHours() === 0` / `.getMinutes() === 0` to Case C (red in both zones: 20:00 EDT / 09:00 JST); pattern becomes NY: A, B, C, D fail; Tokyo: A, B2, C fail | Every case is a genuine bug reproducer in at least one zone; both hemispheres cover the pre-fill direction. One extra case. |
| 2 | **Text-only** — keep A–D, rewrite the pattern to the observed one; scope the halt guard to A/B/D in NY and A in Tokyo; state that C is a post-fix contract pin | Smallest change, but Tokyo covers only the `getHours` facet and C cannot catch a regression of either helper alone. |

**Chosen:** Option 1 — Strengthen cases. Applied: Case B2 (morning instant) added, Case C gains `getHours()`/`getMinutes()` assertions, the pre-fix pattern rewritten to the observed one (NY: A/B/C/D fail, B2 passes; Tokyo: A/B2/C fail, B/D pass — reproduced in-repo 2026-09-21 via a throwaway `frontend/src/__tests__/components/_dd_scratch.test.tsx` run with `npm test --workspace frontend`, 7 failed / 3 passed, then deleted), halt sentence reworded, Research Finding (2) and Decision (a) updated.

#### DD-2: [Step 7 → Step 6] Make the smoke spec's `text=<name>` locators toast-proof, and land the e2e edits before `/run-plan`'s post-Step-6 smoke run
**Context:** `text=` is a substring engine; the four post-mutation assertions (L137, L167, L199, L268) now also match the success toast. The `.bg-gray-800.rounded-full` + `hasText` idiom is already used at L140/164/184 and the toast is never `bg-gray-800`. `/run-plan` runs `npx playwright test` after every UI step, so the e2e edits must move into Step 6 (Step 7 keeps the `toDateString` assertion + smoke run). All options include that move.

| # | Option | Trade-off |
|---|---|---|
| 1 | **Bar-scoped locators**: L137/L199 → `page.locator('.bg-gray-800.rounded-full', { hasText: … }).first()` `toBeVisible`; L167/L268 → same locator `toHaveCount(0)`; gate `grep -nE "expect\(page\.locator\(.text=" e2e/smoke.spec.ts` → nothing | Matches the file's own idiom and the plan's new date assertion; delete negatives no longer wait out the toast. |
| 2 | **Exact-text locators**: `page.getByText(name, { exact: true })` at the four sites | Smallest diff, stays text-based; delete negatives still resolve to the bar only. Playwright's own strict-violation message suggests this form. |
| 3 | **Option 1 + a positive toast assertion** in the add test: `expect(page.getByTestId('toast')).toHaveText('Added "E2E Test Chore"')` + `toHaveAttribute('data-tone', 'success')` | Adds the only real-browser check of the green toast; web-first assertions poll from ~0 ms so they see it before the 2.5 s dismiss. |

**Chosen:** Option 3 — Bar-scoped locators + toast assertion, with the e2e edits moved into (final) Step 5. Applied: `ERROR_TOAST`/`.bg-red-700` migration and the four `text=<name>` re-scopings are Step 5 to-dos before its run gate; Step 5's run gate also runs the smoke spec; Step 6 keeps only the `addedBar` `toContainText('Thu Jan 01 2026')` line + smoke run. The gate was narrowed to `! grep -qE 'expect\(page\.locator\((.text=E2E|.text=\$\{name)' e2e/smoke.spec.ts` because the file-wide form also matches the non-mutation lines L98/L107 (dry-run: exits 1 pre-edit, 0 on a scratch copy with the four lines rewritten).

#### DD-3: [Step 1] How does Step 1's intentional red state survive the `/run-plan` per-step cadence?
**Context:** The executor validates "tests green" after each step and commits. Step 1 is the only step whose intended end is red.

| # | Option | Trade-off |
|---|---|---|
| 1 | **Merge Steps 1 and 2** into one "Red → Green" step (as Steps 3–6 already do); the pre-fix run stays as an internal checkpoint before the helper is written | Executor-compatible by precedent; one commit carries tests + fix. |
| 2 | **Keep the split**, add an executor sentence: "This step is intentionally red: validation PASSES when the pattern above is reproduced. Do not edit `ChoreForm.tsx`, weaken an assertion, or skip a case — Step 2 turns it green. Commit the red file as-is." | Preserves a separate red commit in history; relies on the subagent honouring the sentence over its default "tests must be green" rule. |

**Chosen:** Option 1 — Merge Steps 1 and 2 into one Red → Green step; the pre-fix run is an internal checkpoint marked "expected red; do not commit or stop here". Steps 3–9 renumbered to 2–8 and every cross-reference in the plan updated (see the numbering note above).

#### DD-4: [Step 6] Where does `describe('feedback toast (F21)')` live, and how does it reach `openAndFillForm`?
**Context:** The helper is scoped inside `describe('handleAddChore')`; the new describe needs it plus resolving mocks for `fetchAllChores`/`updateChore`/`removeChore`. Either option also gets: per-test `mockRejectedValueOnce` for (iv), and (vii) spelled out as "re-run `openAndFillForm(user)` (the modal is still open with a reset form; the `+ Add Task` click is a no-op) then click Save".

| # | Option | Trade-off |
|---|---|---|
| 1 | **Hoist** `openAndFillForm` to module scope (next to `swipe`/`stubBarWidth`) and give the new describe its own `beforeEach` (`vi.clearAllMocks()` + resolving mocks for all five service fns) | Reusable by any describe; explicit fixtures; touches the existing `handleAddChore` describe (helper moves out, callers unchanged). |
| 2 | **Nest** the new describe inside `describe('handleAddChore')` after its two tests, inheriting the helper and `beforeEach` | Smaller diff; edit/delete toast tests sit under a misleading parent name. |

**Chosen:** Option 1 — Hoist `openAndFillForm` to module scope after `stubBarWidth` (L46) and give the new describe its own `beforeEach` with resolving mocks for all five service fns (verified anchors: `stubBarWidth` ends L46, helper at L376-384, callers L392/L404).

#### DD-5: [Step 6] Should a successful tap-to-complete retire a standing error toast?
**Context:** META-PLAN Design 4: the error tone stays until dismissed, "and the next successful mutation replaces it". The plan raises no toast on complete-success, so a failed bar tap's red pill survives the successful retry.

| # | Option | Trade-off |
|---|---|---|
| 1 | **Clear on complete-success, no green toast**: after `await completeChore` insert `setToast(prev => (prev?.tone === 'error' ? null : prev))` with an `F21:` comment; add Red test (viii) "a successful complete clears a standing error toast without raising a success toast" | Honours the META-PLAN clause on the kiosk's most common failure path; ~2 lines + 1 test. |
| 2 | **Accept the deviation**: record in Decisions + the README bullet that only add/save/delete successes and the ✕ retire an error toast | No code; stale-error UX on the kiosk until a form mutation or ✕. |

**Chosen:** Option 1 — Clear on complete-success, no green toast: `setToast(prev => (prev?.tone === 'error' ? null : prev))` after `await completeChore` (L234) with the F21 comment; Red test (viii) added; Decisions gained a "Tap-to-complete and a standing error" bullet (verified: `data-testid="chore-bar"` carries `onClick={resetTask}` at `ChoreTimerBar.tsx:119-123`).

#### DD-6: [Step 6] Pin the "identical success message remounts the toast and restarts its timer" contract?
**Context:** Decisions state it; Step 5 tests only unmount-clears-timer; Step 6 (vii) covers error→success, not same-message. Mechanism verified in-repo.

| # | Option | Trade-off |
|---|---|---|
| 1 | **App-level identity test** (viii): two resolving adds of `Mop` (ids 2, 3); capture the first toast element, add again, `waitFor` the toast element is a new node with the same text | Guards App's `key={toast.id}`/`toastIdRef` wiring; no fake timers. |
| 2 | **Toast-level keyed-remount test** in Step 5: fake timers, advance 2000, `rerender` with `key={2}` same props, advance 600 → not called, +1900 → called once | Pins the component contract only, not App's wiring. |
| 3 | **Accept**: soften the Decisions bullet to "intended" and add a code comment at `key={toast.id}` | No test. |

**Chosen:** Option 1 — App-level identity test (ix) added to (final) Step 5; the Decisions "Timer restart" bullet now cites it.

#### DD-7: [Step 5] Toast horizontal sizing — `max-w-[calc(100%-2rem)]` is dead on a `fixed left-1/2` auto-width box
**Context:** CSS shrink-to-fit caps a `left: 50%` positioned box at the remaining 50 vw before `max-w` can bind, so a long error message wraps at half the viewport. All classes compile under Tailwind 4.1.18.

| # | Option | Trade-off |
|---|---|---|
| 1 | **Add `w-max`** to the container (`width: max-content`; `max-w` then caps at viewport − 2 rem) | One token; Step 5 test (vi) unchanged (optionally assert `w-max`). |
| 2 | **Full-width wrapper**: `<div class="pointer-events-none fixed inset-x-4 bottom-40 z-[80] flex justify-center">` around the pill (`pointer-events-auto max-w-full …`) | Robust centring; requires rewriting test (vi) (no `left-1/2`/`-translate-x-1/2` on the status element) and the App containment assertion still holds. |

**Chosen:** Option 2 — Full-width flex wrapper, reconciled with DD-8 Option 1: the frame is `pointer-events-none fixed inset-x-4 bottom-40 z-[80] flex justify-center`; the pill (`role="status"`, `data-testid="toast"`, `data-tone`, colour token) is `max-w-full …` and inherits `pointer-events: none` (no `pointer-events-auto` on the pill); only the ✕ is `pointer-events-auto`. `left-1/2 -translate-x-1/2 max-w-[calc(100%-2rem)]` dropped; test (vi) rewritten; F21 block comment and Decision (d) updated. All ten utilities verified to compile with the repo's `@tailwindcss/node` 4.1.18 (`compile().build([...])` from `frontend/`).

#### DD-8: [Step 5] Should the toast surface be click-through?
**Context:** On ≤ ~760 px viewports (a phone on the LAN) the `bottom-40` pill lands on the form's Save/Cancel row; an error toast after a failed add persists over the still-open modal and swallows taps under it. Not reachable on the Pi's portrait kiosk.

| # | Option | Trade-off |
|---|---|---|
| 1 | **Click-through pill, interactive ✕ only**: `pointer-events-none` on the container, `pointer-events-auto` on the dismiss button; extend test (vi) | Never blocks the form; tapping the pill body no longer dismisses (the plan already chose ✕-only). |
| 2 | **Accept**: note in the "Toast vs. the modal" decision that on small viewports the ✕ dismisses it | No change; kiosk unaffected. |

**Chosen:** Option 1 — Click-through pill, ✕ interactive — applied together with DD-7 Option 2 (see DD-7 for the reconciled markup).

#### DD-9: [Steps 7, 9] How much of `/run-feature`'s port-retry rule to carry into a `/run-plan`-executed plan?
**Context:** The paraphrase is accurate, but the Bash tool blocks foreground `sleep`, so a `/next-step-taker` subagent cannot run a 30-s jittered loop; `/run-plan` §2b already stops-and-asks on a failed test run. `git worktree list` shows only the main checkout today.

| # | Option | Trade-off |
|---|---|---|
| 1 | **Stop-and-report**: keep the conditional `env -u PLAYWRIGHT_BASE_URL CI=1` form; replace the retry loop with "on `… is already used …`/`was not able to start`, do not kill the listener, free the port, or drop `CI=1` — stop and report the occupied ports (`ss -ltnp`)"; note no worktree exists at plan time | Executable by the subagent; matches `/run-plan`'s stop gate. |
| 2 | **Keep the retry wording** and add "implement the wait with `run_in_background` + Monitor, not a foreground `sleep` loop" | Preserves the `/run-feature` contract verbatim; heavier for the executor. |

**Chosen:** Option 1 — Stop-and-report: the conditional `env -u PLAYWRIGHT_BASE_URL CI=1` form is kept in Steps 5, 6 and 8; the retry loop is replaced with "do not kill the listener, free the port, or drop `CI=1` — stop and report the occupied ports (`ss -ltnp`); the orchestrator resumes once they are free"; noted once (Step 5) that no `c4i-wt-*` worktree exists at plan time (`git worktree list` 2026-09-21 shows only the main checkout).

#### DD-10: [Step 8] Cross-link the form's local-date semantics from the Pi Timezone bullet?
**Context:** The new H3 sits under "How prioritization works" (matching `### Data model`'s precedent); a Pi operator reading the Timezone bullet at L131 is the other natural reader.

| # | Option | Trade-off |
|---|---|---|
| 1 | **Add one clause** to the L131 Timezone bullet: "…depend on this (the add/edit form stores the browser's local calendar day — see *Adding and editing chores* above)." | One extra line; both readers find it. |
| 2 | **Keep as written** | The H3's first bullet already names `formDate.ts` and the caveat. |

**Chosen:** Option 1 — Add the clause to the README Timezone bullet (verified `sed -n '131p' README.md` is the `- **Timezone** —` bullet containing "Chore urgency/completion dates depend on this"); new to-do in (final) Step 7.

#### DD-11: [Step 6] Add App-level tests for dismissing the error toast and for "no toast on tap-to-complete"?
**Context:** Step 5 (iv) proves `Toast` calls `onDismiss`; nothing proves App's `dismissToast` removes the element, and the "no success toast on complete" scope rule has no negative assertion. (If DD-5 option 1 is chosen, its test (viii) already covers the complete path's no-success-toast half.)

| # | Option | Trade-off |
|---|---|---|
| 1 | **Add both**: (ix) after (iv)'s rejection `user.click(getByRole('button', { name: 'Dismiss' }))` → `queryByTestId('toast')` is null; (x) resolve `completeChore`, click the bar, `waitFor(completeChore called)`, `queryByTestId('toast')` is null | Two cheap tests; queries verified against the prescribed markup. |
| 2 | **Accept the gap** | Rely on Step 5 (iv) and the Step 9 grep gate. |

**Chosen:** Option 2 as labelled in the user's choice — "Add both tests" (this DD's Option 1 row): (x) Dismiss removes the error toast and (xi) completing a chore raises no toast, added to (final) Step 5; (xi) is flagged in the plan as a negative pin that also passes pre-change.

---

### Verdict
[ ] Ready to proceed as-is
[ ] Proceed after minor fixes
[x] Requires changes before proceeding

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | #3 read `eslint.config.js`, both `tsconfig.json`s, every edited source/test file; simulated Step 6's whole edit sequence on a scratch `App.tsx` (tsc + eslint) — found the missing `fireEvent`/`act` imports and the `showToast` dep. |
| Type annotations | [x] | #1 verified `@utils` alias in `vite.config.ts` + `tsconfig.json` paths, `Chore` shape, `{ id: 1, ...payload }` under `strict`; React 19 `inert` prop. |
| Error handling (status codes, exceptions, user feedback) | [x] | #2 traced all four mutations through `choreApi.ts` → `backend/src/app.ts`/`chores.ts` → hydration → display; every `setError` message expression preserved; toast placement after each `await`. |
| Test coverage (happy path, sad path, edge cases) | [x] | #5 ran throwaway tests in-repo for TZ toggling, pre-fix pattern, `user.type` on a prefilled date, fake-timer submit, jsdom `required`, effect-timer capture, keyed remount; every prescribed RTL query resolved against real markup. |
| Breaking changes (API contracts, shared state, DB schema) | [x] | #6 grepped `T00:00:00.000Z` in backend tests/seed (no exact-string comparison of the POST instant), `error` readers (strip only), optional-prop additions non-breaking, `isRepullGated` untouched. |
| Config consistency (env vars, requirements pins, lint rules) | [x] | #4 read `.github/workflows/ci.yml` (Node 20, no `TZ`), `frontend/package.json` (date-fns 4.1.0, lucide-react 1.8.0, user-event 14.6.1, jsdom 29, vitest 4.1.4), `.claude/settings.json`; Playwright's Chromium launches in-sandbox. |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | #4 compared against `TouchLockOverlay`/`ClearButton`/`ChoreForm`/sibling tests and the completed F5 plan: `F21:` prefixes, icon sizing, `useRef<T>`, `(F21)` describe suffixes, bare-filename ambiguity. |

## Review — 2026-09-21 (Pass 2)

### Summary
Clean at the blocking level: all six subagents PASS with **0 critical, 0 major, 23 minor**
(20 mechanical, 3 design decisions). Every Pass 1 resolution was re-verified against source
and, where runnable, in the repo's own toolchain: the strengthened Step 1 cases reproduce the
stated 7-failed/3-passed pre-fix pattern verbatim and go 10/10 green once the helper lands
(temporary edit, reverted); the DD-7/DD-8 Toast markup compiles under Tailwind 4.1.18 and its
six tests pass; Step 5's full App edit sequence passes tsc + eslint (0 problems) on a scratch
copy and all DD-added App tests pass; every grep gate dry-runs to its stated exit code; the
✕ receives a real Playwright click over the z-50 modal; toast + bar + modal-close commit in one
batched render with ~2.4 s of margin for the e2e toast assertion. Remaining items are
wording/specificity, one typing guard, and three cosmetic decisions.

_(Three reviewers — correctness, ordering, verification — were killed mid-run by a session
rate limit and re-run per the Subagent Reliability Protocol; completeness and full-stack-trace
had written complete JSON before their hand-back was cut off and those results stand.)_

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | PASS | 0 critical, 0 major, 3 minor |
| 2 | Full-Stack Trace | PASS | 0 critical, 0 major, 2 minor |
| 3 | Ordering & Cleanup | PASS | 0 critical, 0 major, 2 minor |
| 4 | Integration & Conventions | PASS | 0 critical, 0 major, 6 minor |
| 5 | Verification & Coverage | PASS | 0 critical, 0 major, 2 minor |
| 6 | Completeness & Risk | PASS | 0 critical, 0 major, 8 minor |

### Prior-resolution re-verification
All 16 Pass 1 mechanical fixes and 11 DDs hold against source (see per-subagent
`pass1_reverification` notes in `tmp/`); none re-opened.

### Findings

#### Minor (nice to fix)
- **[Step 1] Checkpoint guards only one direction** _(#6)_: say that an expected-*pass* case failing also means "fix the test (fixture built at describe scope / wrong zone string)"; pattern must be exactly 7/3. Mechanical.
- **[Step 1] Say how the red checkpoint is reported** _(#3)_: record it under "what was done", not validation results, so `/run-plan` §2b cannot read it as a failure. Mechanical.
- **[Steps preamble] Pre-flight scratch-file gate** _(#6)_: `! git status --porcelain | grep -qE '_p2_|_dd_'` before Step 1's first edit — review artefacts would be swept into the first `git add .` commit and run inside the Vitest gates. Mechanical.
- **[Research] Finding (1) still reads Node-24-specific; `App.search.test.tsx:236` → `:235`** _(#4, #1)_. Mechanical.
- **[Step 4] Test (vi) `parentElement` needs a null guard under `strict`** _(#1 — reproduced TS2531)_: `expect(frame).not.toBeNull()` then `frame!.className`, as `App.test.tsx:726` does. Mechanical.
- **[Decisions (d)] "frame and pill are `pointer-events-none`" contradicts Step 4's "no pointer-events class on the pill"** _(#6)_. Mechanical.
- **[Decisions] DD-5 clear is order- and source-agnostic** _(#2, #6)_: any successful mutation settling after an error retires it (even one started earlier; even a failed add's error cleared by a later bar tap) — inherent to the single-slot toast; document. Mechanical.
- **[Decisions] Phase C fold-back list incomplete** _(#4)_: also note ✕-only click-through, straight-quoted copy, complete-success clearing, and the superseded Open-risk (a) mechanism. Mechanical.
- **[Step 5] Fifth new App.tsx comment lacks `F21:`; `Toast` import slot unspecified (alphabetical `common/*` group)** _(#4)_. Mechanical.
- **[Step 5] (ii) cites L273-293 (actual L277-294) and calls `App.sync.test.tsx:105-108` a `mockReturnValue` twin (it is `mockImplementation`); (iii) doesn't name the delete trigger** _(#1)_. Mechanical.
- **[Step 5] "Once, so it cannot leak" is true only because Save consumes it — `vi.clearAllMocks()` does not drop an unconsumed Once queue** _(#5 — probed)_. Mechanical.
- **[Step 5] (v)/(vi)/(x) phrased as "after (i)/(iv)" — say each is a standalone `it` repeating the driving steps** _(#6)_. Mechanical.
- **[Step 5] (ix) runs under real timers on purpose — note it degrades, never flakes** _(#6)_. Mechanical.
- **[Steps 5/6/8] DD-9 "the orchestrator resumes the step" mis-describes `/run-plan` (§2e fix loop then stop-for-user); two never-list items dropped** _(#4)_. Mechanical.
- **[Step 7] Two bare `README.md` commands; italic cross-ref vs the file's `§ <section>` style; toast bullet says "stays until dismissed" but DD-5 also retires it on the next success** _(#4, #6)_. Mechanical.
- **[Step 8] `grep -n "isRepullGated"` never prints the gate body — use `grep -n -A1 "const isRepullGated"`** _(#3 — dry-run)_. Mechanical.
- **[Step 4 / Decisions (d)] A tap on the click-through pill body reaches the modal backdrop beneath and cancels the modal** _(#2 — hit-tested in Playwright)_. → **DD-12**.
- **[Step 4] `max-w-full` lets a long pill exceed the 768 px app column on wide desktops** _(#6)_. → **DD-13**.
- **[Step 5] DD-8's click-through has no real-browser assertion** _(#5)_. → **DD-14**.

### Verification Gaps
None blocking. DD-14 decides whether the click-through contract gets a real-browser guard.

### To-Do: Mechanical Fixes (auto-applied)
- [x] Step 1 checkpoint: converse guard (expected-pass case failing ⇒ fixture built outside `it`/wrong zone string; pattern must be exactly 7/3) + "report under what-was-done, not validation" sentence _(applied by fixing subagent)_
- [x] Steps preamble: pre-flight `! git status --porcelain | grep -qE '_p2_|_p2r_|_dd_'` scratch-file gate _(applied by fixing subagent — dry-run exit 0 clean / 1 dirty)_
- [x] Research Finding (1): Node ≥ 13 (verified 22/24, CI Node 20) _(applied by fixing subagent)_
- [ ] Research: `App.search.test.tsx:236` → `:235` _(skipped: the fixer's dry-run showed L236 **is** the `querySelector('.overflow-y-auto')` line — the correctness reviewer's claim was wrong; existing citation kept)_
- [x] Step 4 test (vi): `const frame = …parentElement; expect(frame).not.toBeNull(); frame!.className` _(applied by fixing subagent — `App.test.tsx:726` precedent confirmed)_
- [x] Decision (d): frame is `pointer-events-none`, pill inherits (no class on the pill) _(applied by fixing subagent; superseded in part by DD-12)_
- [x] Decisions "Tap-to-complete and a standing error": source-agnostic + order-agnostic clauses _(applied by fixing subagent)_
- [x] Decisions: "Where the TZ tests live" → "**Phase C fold-back notes**" with the full deviation list _(applied by fixing subagent — all cited META-PLAN phrases confirmed present)_
- [x] Step 5 Green — state: `// F21:` prefix on the one-toast comment; `Toast` import slot between `ScreenBlankOverlay`/`TouchLockIndicator` _(applied by fixing subagent)_
- [x] Step 5 Red: standalone-`it` paragraph before the test list _(applied by fixing subagent)_
- [x] Step 5 (ii): L277-294 + `mockImplementation` wording; (iii): explicit `Delete chore` → `confirm-dialog-confirm` idiom; (iv): Once-queue/`clearAllMocks` note; (ix): real-timers rationale _(applied by fixing subagent — all line anchors confirmed)_
- [x] Steps 5/6/8: DD-9 wording → stop-and-report + full never-list + `/run-plan` re-invocation _(applied by fixing subagent — `/run-plan` §2b/§2e confirmed)_
- [x] Step 7 README: repo-root qualifiers on `sed`/`grep`; `§ Adding and editing chores` cross-ref style; toast bullet covers success-clearing _(applied by fixing subagent)_
- [x] Step 8: `grep -n -A1 "const isRepullGated"` shows the gate body _(applied by fixing subagent — dry-run prints L61-62)_

### Design Decisions (awaiting user input)

#### DD-12: [Step 4 / Decisions (d)] A tap on the click-through pill body falls through to the modal/confirm backdrop and cancels it
**Context:** Hit-tested in-repo with the planned markup: `elementFromPoint` on the pill text returns the z-50 backdrop, whose handler sees `target === currentTarget` → `onCancel()`. On the Pi's 600×1024 panel the red pill sits over the backdrop below the add card, so tapping the error text (the natural gesture) closes an open form. After a failed add the form is already reset (one lost `+ Add Task` tap); but an error from a failed complete/delete/edit persists, and a form opened *afterwards* is discarded by that tap.

| # | Option | Trade-off |
|---|---|---|
| 1 | **Accept and document** — Decision (d) + the `F21:` comment state that a pill-body tap reaches whatever is beneath (incl. a modal backdrop, which cancels it exactly as a tap beside the pill would) | No code/test change; ✕ remains the only dismiss. |
| 2 | **Error pill body dismisses** — pill gets `onClick={tone === 'error' ? onDismiss : undefined}` + `pointer-events-auto cursor-pointer` for the error tone only (success stays click-through so the 2.5 s green pill never intercepts Save/Cancel — the smoke spec relies on that); ✕ handler adds `stopPropagation()`; extend Toast tests (iv)/(vi) | Restores META-PLAN's "✕ / tap-to-dismiss" for the error tone; a tap never closes the form; slightly more code. |

**Chosen:** Option 2 — error pill body dismisses. Applied 2026-09-21: Step 4 Green pill gains `onClick={tone === 'error' ? onDismiss : undefined}` + `pointer-events-auto cursor-pointer` for the error tone only (success stays click-through), the ✕ handler adds `event.stopPropagation()`, Toast tests (iv)/(vi) extended and (vii) `'a success pill body click does nothing'` added; Decision (d), the `// F21:` block comment, the Phase C fold-back note, Step 5 test (x) note and the Step 7 README bullet ("dismissed with a tap (or its ✕)") updated. Verified in-repo: the exact Step 4 component + tests (i)–(vii) ran 7/7 green under `npm test --workspace frontend`, `tsc --noEmit` and `eslint` clean (scratch files deleted).

#### DD-13: [Step 4] Frame width on wide viewports
**Context:** `body` is `display:flex; justify-content:center` and `#root` is `max-width: 768px`, so the viewport-relative frame centres the pill on the app column at any width; but `max-w-full` caps the pill at viewport − 2 rem, so on a desktop wider than ~800 px an unusually long message renders wider than the column. Cosmetic, dev-only (kiosk is 600 px). Both options compile under Tailwind 4.1.18.

| # | Option | Trade-off |
|---|---|---|
| 1 | **Accept** — one sentence in Decision (d) | No code/test change. |
| 2 | **Cap the frame** — add `max-w-3xl mx-auto` to the frame (fixed-inset + max-w + mx-auto idiom); extend test (vi) | Pill never exceeds the 768 px column; two more tokens. |

**Chosen:** Other — enforce message length with ellipses: `min-w-0 truncate` on the span, `min-w-0` on the pill; no width cap. Applied 2026-09-21: Step 4 Green markup + `// F21:` comment updated, test (vi) asserts `truncate`/`min-w-0` on the span and `min-w-0` on the pill, Decision (d) carries the DD-13 width paragraph. Verified: `truncate`, `min-w-0`, `cursor-pointer`, `pointer-events-auto` all emit CSS under the repo's Tailwind 4.1.18 (`@tailwindcss/node` `compile().build([...])` from `frontend/`); the final component passed tests (i)–(vii) in-repo.

#### DD-14: [Step 5 e2e] Real-browser guard for the click-through contract?
**Context:** Toast test (vi) pins class tokens in jsdom; nothing proves in Chromium that a tap through the pill reaches what is under it, and the smoke suite would not fail on a non-click-through pill either (cleanup uses `dispatchEvent`; confirm-dialog clicks would just retry until the 2.5 s dismiss). Adding a check is a new test requirement.

| # | Option | Trade-off |
|---|---|---|
| 1 | **Accept** — Decision (d) notes "pinned by Toast test (vi), class presence only" | No change. |
| 2 | **Add an `elementFromPoint` check** to the e2e error test after the `ERROR_TOAST` visibility assertion: sample 8 px inside the pill's left edge and `expect(hit).not.toBe('toast')` | One real-browser assertion; standard CSS hit-testing, not run in-repo by the reviewer. |

**Chosen:** Option 1 — accept. Applied 2026-09-21: Decision (d) now states "Click-through is pinned by Toast test (vi) (class presence only) and, after DD-12, applies to the success pill alone; no real-browser hit-test assertion (DD-14)." No e2e change.

---

### Verdict
[ ] Ready to proceed as-is
[x] Proceed after minor fixes
[ ] Requires changes before proceeding

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | #3: full Step 5 sequence simulated on scratch copies; tsc + eslint 0 problems; all forward references resolve across the renumbered steps. |
| Type annotations | [x] | #1: `parentElement` null guard (TS2531 reproduced); `ToastState` updater; DOM-node identity assertion. |
| Error handling (status codes, exceptions, user feedback) | [x] | #2: DD-5 clear traced against optimistic/reconcile paths; ✕ reachable over z-50; string names end-to-end. |
| Test coverage (happy path, sad path, edge cases) | [x] | #5: Step 1 pattern 7/3 → 10/10 post-fix; Toast tests green; mock sequencing probed; every query resolves. |
| Breaking changes (API contracts, shared state, DB schema) | [x] | #6: none; DD-5/DD-6/DD-11 mutually consistent; merged Step 1 is one revertable commit. |
| Config consistency (env vars, requirements pins, lint rules) | [x] | #4: `/run-plan` §2c paraphrase accurate; CI Node 20; `ss` in-sandbox; Chromium launches in-sandbox. |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | #4: all Pass 1 convention fixes hold; one missed `F21:` comment and the import slot noted. |

### Missed-Finding Root Causes
Most Pass 2 findings concern text that Pass 1's own DD edits introduced (frame markup, hoisted helper, new tests) and so could not have been found earlier. Three were present in the Pass 1 plan:

| Finding | Root cause | Skill gap? |
|---|---|---|
| Step 8's `grep -n "isRepullGated"` gate never prints the gate body it claims to show | **Fix verification stopped at plan text** — Pass 1's #3 dry-ran only the expected-*empty* gates (the exit-1 finding); positive-output gates were accepted on the strength of their exit code, not their output | Instructions already cover this ("run that exact command … a gate that returns different content than the plan claims is unsatisfiable"); execution miss |
| Step 5 tests (v)/(vi) phrased "after (i)/(iv)" — reads as cross-test state carry-over | **Scoped too narrowly** — Pass 1's #6 checked each new test's queries and mocks but not whether each was a standalone `it` | Instructions already cover this ("enough detail for an implementer to execute without additional research"); execution miss |
| Two bare `README.md` commands survived Pass 1's bare-filename qualification | **Scoped too narrowly** — #4's sweep qualified prose mentions but not the shell commands that name the file | Instructions already cover this ("in every occurrence — including … verification commands"); execution miss |

No root cause recurs across passes; all three are execution misses against existing checklist items, so no skill change is proposed (Step 7 recorded below).

### Skill Improvements Applied
| # | Finding | Subagent | Gap type | Change | Status |
|---|---|---|---|---|---|
| 1 | `isRepullGated` positive-output gate not dry-run | #3 | no_skill_gap | — | Skipped (instructions already cover) |
| 2 | Tests phrased as cross-test carry-over | #6 | no_skill_gap | — | Skipped (instructions already cover) |
| 3 | Bare `README.md` in shell commands | #4 | no_skill_gap | — | Skipped (instructions already cover) |

---

**Pass 2 clean (0 critical, 0 major). Plan is ready for implementation.** Final state: 8 steps, 43 unticked boxes, `finished: false`; 14 design decisions resolved (DD-1…DD-14); `tmp/` deleted.
