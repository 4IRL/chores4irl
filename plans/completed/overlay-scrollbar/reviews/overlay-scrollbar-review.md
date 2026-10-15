# Review: Fading Overlay Scrollbar + Full-Bleed Scroll Region (F22)

## Review — 2026-09-23

### Summary
The plan's architecture holds up. The step order runs producer before consumer (hook, component,
list mount, `px-4` relocation, form, e2e). Every cited line number, class string and test pin was
verified against source, and the jsdom assumptions were dry-run in the repo. It still needed
changes before implementation. A built-CSS gate could never pass, and commit boundaries had no
tsc/lint gate. The executor's own Playwright runs bypassed the sibling-safe `CI=1` form. The e2e
gutter check was vacuous under headless `--hide-scrollbars`, and `README.md` was ambiguous. All
15 mechanical fixes and all 6 design decisions have now been applied to the plan.

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | FAIL | 0 critical, 1 major, 4 minor |
| 2 | Full-Stack Trace | PASS | 0 critical, 0 major, 4 minor |
| 3 | Ordering & Cleanup | FAIL | 0 critical, 3 major, 1 minor |
| 4 | Integration & Conventions | FAIL | 0 critical, 4 major, 5 minor |
| 5 | Verification & Coverage | FAIL | 0 critical, 1 major, 8 minor |
| 6 | Completeness & Risk | FAIL | 0 critical, 1 major, 5 minor |

Raw total: 0 critical, 10 major, 27 minor. After deduplication: 0 critical, 5 major, 16 minor.

### Findings

#### Major (should fix)
- **[Step 2] Built-CSS grep gate over-escaped: it can never list all three utilities** _(Subagents #1, #3, #4, #5, #6)_:
  inside single quotes, `\\\\` asks ERE for two literal backslashes, but Tailwind v4 escapes `:`
  and `/` with one. Two in-repo dry runs gave the same result. The first was a scratch vite build
  with the planned classes; the second ran against the current `frontend/dist`. In both, the
  plan's pattern printed only `duration-400` and the single-escape form printed all three. The
  gate was the only proof that `motion-reduce:transition-none` ships. → M1.
- **[Steps 3, 4, 5, 7] Commit boundaries without tsc/lint; step 3 re-runs only 3 of 7 App test files** _(Subagent #3 major; #5 minor duplicate)_:
  `vite build` does not type-check and there is no pre-commit hook, so type errors and
  `no-unused-vars` errors would be committed at each per-step commit. → M8.
- **[Step 6] Bare `README.md` is ambiguous** _(Subagent #4)_: three `README.md` files exist
  (root, `deploy/pi/`, `.github/rulesets/`). → M9.
- **[Steps 3–8, executor cadence] The executor's own Playwright runs bypass the `CI=1` sibling-safety** _(Subagents #3, #4)_:
  `/run-plan` 2c smoke, `/run-plan` Step 3 completion and `/next-step-taker` Step 3 run
  `$UI_RUNNER_CMD`/`$TEST_RUN_CMD`/`$TEST_RUN_BUILT_CMD`. Skill-config resolves all three to bare
  `npx playwright test`. With `reuseExistingServer: !process.env.CI`, a bare run adopts a sibling
  worktree's dev servers, and a port-held failure is routed into the 2e Test Fix Loop. → DD-1.
- **[Step 7 / Decision (c)] The e2e "no native gutter" check is vacuous** _(Subagent #4)_: Playwright adds
  `--hide-scrollbars` to every headless Chromium launch
  (`node_modules/playwright-core/lib/server/chromium/chromium.js:287-293`). `offsetWidth − clientWidth`
  is therefore 0 with or without `.scrollbar-none`. → DD-2.

#### Minor (nice to fix)
- **[Step 8] Repo-fact greps do not return what the plan claims** _(Subagents #1, #2, #3, #4, #5, #6)_ → M2.
- **[Decisions / Step 1] `clamp(raw, MIN, track)` is ambiguous when track < MIN** _(Subagent #1)_ → M3.
- **[Step 1] Hook tests must hoist the ref object** _(Subagents #1, #5)_: an inline `{ current: el }`
  re-runs the effect on every render, which doubles the `observe` count → M4.
- **[Step 7] "Close with Escape": the app has no Escape handler** _(Subagents #1, #2, #5, #6)_ → M5,
  later superseded by DD-4.
- **[Steps 3, 5] Metric spies must be installed before render** _(Subagents #2, #6)_ → M6.
- **[Step 7] Thumb-height check races smoke.spec's parallel list mutations** _(Subagent #2)_ → M7.
- **[Step 3] `OverlayScrollbar` import breaks the alphabetical `components/common` run** _(Subagent #4)_ → M10.
- **[Step 5] Conditional "import useRef (if not already)": it already is** _(Subagent #4)_ → M11.
- **[Step 2] Hook import path unspecified; mirror ScrollToTopButton's relative import** _(Subagent #4)_ → M12.
- **[Steps 3, 4, 5] Red gates say "confirm the new cases fail", but some are expected to pass** _(Subagent #5)_ → M13.
- **[Step 6] README step has no verification** _(Subagent #5)_ → M14.
- **[Decisions (b) / Manual Pi checks] Search/filter-driven `scrollTop` clamps also flash the thumb** _(Subagent #6)_ → M15.
- **[Decisions (e) / Thumb geometry] No recorded relation of the thumb track to the deck / `bottom-40` line (Standing invariant 14)** _(Subagent #4)_ → DD-3.
- **[Step 5 / Decision (g)] The backdrop-click "guard" is overstated** _(Subagent #5)_: jsdom does
  no hit-testing, so no test proves that the wrapper is card-sized → DD-4.
- **[Step 7] "Instant under reduced motion" is never checked in a real browser** _(Subagent #5)_ → DD-5.
- **[Step 8] "Copy Manual Pi checks … so it reaches the user" has no verified carrier** _(Subagent #6)_ → DD-6.

### Verification Gaps
Steps that lack sufficient verification:
- **Step 7**: the e2e spec could not be dry-run, because the component does not exist yet.
  Supporting observables were checked in the repo's own `playwright-core` 1.59.1, Chromium
  147.0.7727.15 headless, on synthetic pages:
  - `scrollbar-width` computes to `none` under `.scrollbar-none` and `auto` without it. The gutter
    is `0` in both cases.
  - `transition-property` computes to `none` under `reducedMotion: 'reduce'` and `opacity` without it.
  - `elementFromPoint(6, 200)` on a replica of the modal markup at 400×400 hits the backdrop. The
    card spans x 16–384, y 16–376.

  Run `env -u PLAYWRIGHT_BASE_URL CI=1 npx playwright test e2e/overlay-scrollbar.spec.ts` at
  step 7 to confirm these in the app.
- **Executor-owned Playwright runs (DD-1)**: the Orchestrator note is prose addressed to the
  orchestrator. No `/run-plan` SKILL.md line reads per-plan overrides of `$UI_RUNNER_CMD`: 2c
  substitutes it literally. Compliance therefore depends on the orchestrator honouring the note.
- **Visible gutter, clamp flashes, frame drops**: Pi-only (Manual Pi checks). The PR body is now
  the carrier (DD-6).

### To-Do: Mechanical Fixes (auto-applied)
- [x] M1 — Step 2: built-CSS grep uses single-backslash escapes (`motion-reduce\\:transition-none`,
  `bg-gray-300\\/50` inside single quotes) and names the three expected lines; dry-run recorded _(applied by fixing subagent)_
- [x] M2 — Step 8: repo-fact greps rewritten to what they actually print (exact counts, `|| true` guards, `--include=*.tsx` scope) _(applied by fixing subagent)_
- [x] M3 — Decisions: clamp precedence stated as `Math.min(Math.max(raw, MIN_THUMB_PX), track)`, so the track bound wins _(applied by fixing subagent)_
- [x] M4 — Step 1: hook tests hoist the ref before `renderHook`; the inline `{ current: el }` hazard is explained _(applied by fixing subagent)_
- [x] M5 — Step 7: Escape close replaced by the Cancel button _(applied by fixing subagent; later superseded by DD-4's backdrop click)_
- [x] M6 — Steps 3, 5: metric spies installed before `render`, with the reason given (no ResizeObserver in jsdom) _(applied by fixing subagent)_
- [x] M7 — Step 7: thumb height and region metrics read in one atomic `thumb.evaluate` _(applied by fixing subagent)_
- [x] M8 — Steps 3, 4, 5, 7: tsc/lint gates at each commit boundary; step 3 runs the full Vitest suite _(applied by fixing subagent)_
- [x] M9 — Step 6: repo-root `README.md` named explicitly _(applied by fixing subagent)_
- [x] M10 — Step 3: `OverlayScrollbar` import placed between `ConfirmDialog` and `ScreenBlankOverlay` _(applied by fixing subagent)_
- [x] M11 — Step 5: `useRef` already imported (`ChoreForm.tsx:1`) _(applied by fixing subagent)_
- [x] M12 — Step 2: relative hook import `../../hooks/useScrollIndicator` _(applied by fixing subagent)_
- [x] M13 — Steps 3, 4, 5: Red gates list which cases are expected to fail and which already pass _(applied by fixing subagent)_
- [x] M14 — Step 6: README verify box (`grep -n "OverlayScrollbar.tsx" README.md`) _(applied by fixing subagent)_
- [x] M15 — Decisions (b) + Manual Pi checks: search, room-tab and day-step clamp flashes listed _(applied by fixing subagent)_
- [x] W1 — Step 3/4/8 line anchors: the sequence was simulated on a scratch copy of `App.tsx`.
  After Step 3's import and constant land, the frame comment moves from `:360` to `:364` and the
  outer column from `:349` to `:353`. Step 3's frame-comment edit, Step 4's outer-column edit and
  Step 8's "before step 4 it prints" line are now anchored on quoted text, not bare line numbers _(applied by whole-document re-run)_
- [x] W2 — Research Findings: the claim that `ChoreFormModal.test.tsx:13-25` "guards" the
  card-sized wrapper now carries DD-4's qualifier (backdrop-targeted clicks only; the geometry is
  proved by e2e Test 3) _(applied by whole-document re-run)_
- [x] W3 — Step 8 repo-fact greps re-run against the current source after the DDs landed. All
  "before" claims still hold. The new `<OverlayScrollbar … trackInsetBottomPx={LIST_THUMB_BOTTOM_INSET_PX} />`
  line does not match the case-sensitive `ref={scrollRegionRef}` grep (count 0, exit 1).
  Heading count: 8 `###` steps. No Prerequisites/exemption list exists, and no new tool tokens
  were added _(verified by whole-document re-run; no edit needed)_

### Design Decisions (awaiting user input)

#### DD-1: [Steps 3–8, executor cadence] Executor/orchestrator Playwright runs bypass `CI=1` sibling-safety
**Context:** The plan's `env -u PLAYWRIGHT_BASE_URL CI=1` form and its port-retry/UNRESOLVED
protocol cover only its own step 7 and step 8 boxes. The executor skills run Playwright on their
own:
- `/run-plan` 2c: "Execute: $UI_RUNNER_CMD".
- `/run-plan` Step 3: "spawn UI test subagent: `$UI_RUNNER_CMD`".
- `/next-step-taker` Step 3: `$TEST_RUN_BUILT_CMD` / `$UI_RUNNER_CMD`.

`.claude/skill-config.md` resolves all of these to bare `npx playwright test`. `playwright.config.ts`
has `reuseExistingServer: !process.env.CI`, so a bare run adopts a sibling worktree's servers on
:3000/:5174 and `smoke.spec.ts` writes to that sibling's DB. A port-held failure goes into 2e's Test
Fix Loop rather than a stop. Merged from Subagents #3 and #4.

| # | Option | Trade-off |
|---|---|---|
| 1 | Orchestrator note above `## Steps`: every executor/orchestrator Playwright run uses `env -u PLAYWRIGHT_BASE_URL CI=1 npx playwright test [spec]`; port conflicts use Step 7's retry, then the canonical UNRESOLVED stop | Covers every run from the plan file; depends on the orchestrator honouring plan prose (no SKILL.md line reads per-plan overrides) |
| 2 | Before `/run-plan`, the user sets the checkout-local (gitignored) `.claude/skill-config.md` runner commands to the `CI=1` form (replace the symlink with a local copy; never edit through it) | Every skill run inherits it mechanically; it is a user action outside the plan, and port conflicts still hit the 2e fix loop unless paired with option 1 |
| 3 | Accept it: add a risk note; only the step 7/8 results are authoritative | Cheapest; intermediate commit boundaries stay unverified and a sibling's DB can be written |

**Chosen:** Option 1, "Orchestrator note" (user, 2026-09-23). Added a note block above `## Steps`
addressed to the executor and the `/run-plan` orchestrator:
- wherever `$UI_RUNNER_CMD`/`$TEST_RUN_CMD`/`$TEST_RUN_BUILT_CMD` would run (2c smoke, Step 3
  completion, `/next-step-taker` validation), run `env -u PLAYWRIGHT_BASE_URL CI=1 npx playwright test [spec]`.
- on `is already used` / `was not able to start`, retry with Step 7's jittered ~30 s backoff for up
  to ~10 min, then stop with the canonical UNRESOLVED line. For a step box, the line goes under that
  box. For the orchestrator's own run, which owns no box, it ends the orchestrator's summary.
- never the Test Fix Loop; never kill listeners or edit `playwright.config.ts`.

#### DD-2: [Step 7 / Decision (c)] The e2e gutter check is vacuous under headless `--hide-scrollbars`
**Context:** Headless Chromium launched by Playwright gets `--hide-scrollbars`
(`chromium.js:287-293`). The gutter is therefore 0 before and after F22, and both
`offsetWidth − clientWidth` checks (list and form card) cannot detect a regression.

| # | Option | Trade-off |
|---|---|---|
| 1 | Replace both checks with `toHaveCSS('scrollbar-width', 'none')` on region and card; reword (c): e2e proves the rule applies, the Pi check proves the visible gutter | Non-vacuous and cheap; proves the rule rather than the pixels |
| 2 | Keep the width checks and add `test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } })` | Measures real pixels if headless Linux draws classic scrollbars _(unverified)_ |
| 3 | Drop the gutter assertions; the Pi check alone covers it | Loses the only automated check |

**Chosen:** Option 1 (user, 2026-09-23). Verified in the repo's `playwright-core` 1.59.1 with
Chromium 147.0.7727.15 headless. `scrollbar-width` has been supported since Chromium 121.
- On a synthetic page, `getComputedStyle().scrollbarWidth` is `none` with `.scrollbar-none` and
  `auto` without it.
- `offsetWidth − clientWidth` was `0` for both, which confirms the old check was vacuous.

Test 1 and Test 3 now assert `toHaveCSS('scrollbar-width', 'none')`, and Decision (c) was reworded
to match.

#### DD-3: [Decisions (e) / Thumb geometry] Thumb track vs the deck / `bottom-40` line (Standing invariant 14)
**Context:** Invariant 14 requires any feature adding bottom real estate to decide its relation to
the shared `bottom-40` line. Invariant 12 makes the deck plus its 4 rem frosted overhang the
bottom ~10 rem of the scroller. A full-height list track paints the thumb over the frosted deck at
the right edge.

| # | Option | Trade-off |
|---|---|---|
| 1 | Keep the full-height track (META-PLAN formula); record that the thumb stays at the right edge only and never meets the centred button or toast | No signature change; the thumb crosses the frost |
| 2 | Stop the track above the deck: separate top/bottom insets, list bottom inset = 10 rem | Thumb never enters the deck zone; signature change through Steps 1–3 and 5 and their tests; departs from the META-PLAN formula |

**Chosen:** Option 2, "Stop track above deck" (user, 2026-09-23). Applied as follows.
- **Signatures:** positional numeric insets, `computeThumbGeometry(scrollTop, scrollHeight, clientHeight, trackInsetTopPx = 0, trackInsetBottomPx = 0)`
  and `useScrollIndicator(ref, trackInsetTopPx = 0, trackInsetBottomPx = 0)`, with effect deps
  `[ref, trackInsetTopPx, trackInsetBottomPx]`. Positional primitives were chosen over an options
  object, because a fresh `{ top, bottom }` literal per render would re-run the effect.
- **Props:** `OverlayScrollbar` takes `trackInsetTopPx?` and `trackInsetBottomPx?`.
- **Formula:** `track = clientHeight − top − bottom`, and `top` is offset by the top inset.
- **List constant:** `LIST_THUMB_BOTTOM_INSET_PX = 160`, an unexported constant in `App.tsx` beside
  the frame. It lives there because it mirrors App.tsx's own `scroll-pb-40`/`bottom-40`, and
  `ChoreForm`'s constant is also unexported. The value is the deck (≈ 81 px) plus its 64 px
  overhang, rounded up to the shared 10 rem line.
- **Form:** passes 12/12.
- **Numbers:** every numeric expectation was recomputed with node. Examples: list 1000/400 →
  `{ height: 96, top: 0 }`, and at scrollTop 600 → `top: 144` (bottom = 240 = 400 − 160); the form
  at 12/12 → height 150.4.
- **e2e:** uses `track·ch/sh` with `track = ch − 160`, plus a thumb-bottom ≤ frame bottom − 160 bound.
- **Decisions:** record the departure from the META-PLAN formula and the short-viewport behaviour.
  At clientHeight ≤ 160 the thumb returns null. At 160 < clientHeight ≤ 184 it is a static bar the
  height of the track (boundary corrected in Pass 2, P2-M1).

#### DD-4: [Step 5 / Decision (g)] The card-sized backdrop wrapper is untested in a real browser
**Context:** `ChoreFormModal.test.tsx:13-25` clicks the backdrop node directly, and jsdom does no
hit-testing. It would still pass if the new wrapper were full-screen. Only the class-level
exact-className assertion guards the change.

| # | Option | Trade-off |
|---|---|---|
| 1 | e2e Test 3 closes the modal by clicking beside the card inside the backdrop's `px-4`, then asserts the modal is gone (replaces the Cancel close) | Real hit-test of the wrapper size; still read-only |
| 2 | Keep the coverage; reword the "guard" text and move "tap beside the card cancels" to the manual Pi checks | No new e2e; the guard stays class-level |

**Chosen:** Option 1 (user, 2026-09-23). Test 3 now closes with `page.mouse.click(6, 200)`. The
backdrop is `fixed inset-0 … flex items-start justify-center px-4 pt-4`, so at 400×400 the card
spans x 16–384 and y 16–376 (`pt-4`, `max-h-[90dvh]` = 360). A Chromium replica confirmed
`elementFromPoint(6, 200)` is the backdrop. The test then asserts
`page.getByTestId('chore-modal-backdrop')` has count 0. This replaces M5's Cancel close.

#### DD-5: [Step 7] Reduced motion is not checked in a real browser
**Context:** Vitest runs with `css: false`. Only the className assertion and the built-CSS grep
cover "instant under reduced motion".

| # | Option | Trade-off |
|---|---|---|
| 1 | Add e2e Test 4: `emulateMedia({ reducedMotion: 'reduce' })`, scroll, assert `transition-property: none` on the thumb | Real-browser proof; one more short test |
| 2 | Keep the className + built-CSS coverage as an accepted gap | No extra test |

**Chosen:** Option 1 (user, 2026-09-23). Added Test 4. Verified in Chromium 147 with the repo's
`playwright-core`: `transition-property` computes to `none` under `reducedMotion: 'reduce'` and to
`opacity` under `no-preference`.

#### DD-6: [Step 8] Manual Pi checks carrier
**Context:** No SKILL.md line relays a step executor's final-report text to the user. `/run-plan`'s
completion summary carries only steps and test results.

| # | Option | Trade-off |
|---|---|---|
| 1 | The PR body is the carrier: the Step 8 box copies the checks into the final report, and they fill the PR body's "How to manually verify" bullet when `/git-push` opens the PR; add a Summary line for the `/run-feature` operator | Explicit, user-visible carrier |
| 2 | The committed plan file is the carrier; drop "so it reaches the user" | Honest, but less visible |

**Chosen:** Option 1, "PR body" (user, 2026-09-23). The Step 8 box now says the checks are the
content of the PR body's `## Verification Steps` → "- How to manually verify (if applicable)"
bullet. That bullet is in the `~/.claude/skills/git-push/SKILL.md` "PR Body Format" template, and
`/run-feature` Phase A step 9 runs `/git-push`. The Summary also gained a line for the operator.

---

### Verdict
[ ] Ready to proceed as-is
[ ] Proceed after minor fixes
[x] Requires changes before proceeding

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | #3 read `eslint.config.js`, both tsconfigs, `App.tsx`, `ChoreForm.tsx`, `ScrollToTopButton.tsx`; import order/path fixed (M10–M12) |
| Type annotations | [x] | #1 read the hook/component patterns, `tsconfig.json`; the hook/geometry signatures are typed in the plan |
| Error handling (status codes, exceptions, user feedback) | [x] | #2: frontend-only change with no endpoints; traced `ChoreFormModal` backdrop cancel and the jsdom guard paths |
| Test coverage (happy path, sad path, edge cases) | [x] | #5 read all affected test files, `vitest.config.ts`, `playwright.config.ts`, both e2e specs |
| Breaking changes (API contracts, shared state, DB schema) | [x] | #6 read the App/strip test pins and META-PLAN invariants 12–17; no backend/data change |
| Config consistency (env vars, requirements pins, lint rules) | [x] | #4 read `package.json` ×2, `eslint.config.js`, `playwright.config.ts`, `.github/workflows/ci.yml`, skill-config |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | #4 read `~/.claude/CLAUDE.md` and META-PLAN; constants and file placement mirror F18 |

## Review — 2026-09-23 (Pass 2)

### Summary
Pass 1's fixes hold. All six reviewers re-checked the Pass-1 `[x]` items against source and found
none wrong. They recomputed the DD-3 geometry numbers in node and in the repo's Vitest, and
measured the real app in Chromium. The only major finding was environmental and has been resolved:
15 zero-byte sandbox `.claude/` placeholders under `plans/` would have been swept into Step 1's
`git add .` commit. All 15 mechanical minors (13 after dedup) and DD-7 are now applied. The plan is
ready for implementation, and the review loop exits after this pass.

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | PASS | 0 critical, 0 major, 3 minor |
| 2 | Full-Stack Trace | PASS | 0 critical, 0 major, 1 minor |
| 3 | Ordering & Cleanup | FAIL | 0 critical, 1 major, 2 minor |
| 4 | Integration & Conventions | PASS | 0 critical, 0 major, 3 minor |
| 5 | Verification & Coverage | PASS | 0 critical, 0 major, 4 minor |
| 6 | Completeness & Risk | PASS | 0 critical, 0 major, 3 minor |

Raw total: 0 critical, 1 major, 16 minor (15 mechanical, 1 design decision). After deduplication:
0 critical, 1 major, 14 minor. Two pairs were merged: Step 7's test-local locators (#2, #5) and
Step 5's `afterEach` import (#1, #4).

### Findings

#### Major (should fix)
- **[Step 1 commit / executor cadence] Step 1's `git add .` would sweep 15 zero-byte `.claude/` placeholders into the branch** _(Subagent #3)_:
  `launch.json`, `loop.md`, `output-styles`, `routines` and `workflows` appeared under each of
  `plans/.claude/`, `plans/feature/.claude/` and `plans/feature/overlay-scrollbar/.claude/`. The
  root `.gitignore` rule `.claude/*` is anchored to the root, so it does not match them.
  **Resolved out-of-band (environment).** They were sandbox bind-mount targets, created because
  a review command ran with its cwd under `plans/`. The real on-disk dirs were empty and the
  orchestrator removed them. `git status --porcelain --untracked-files=all` now lists only
  `plans/META-PLAN.md`, the plan and this review (re-run by the fixing subagent from the repo
  root: exit 0, and `git add --dry-run .` lists the same 3 paths). No design change was needed.
  The plan's Orchestrator note gained a working-directory rule and a pre-commit check for Step 1
  (P2-M13).

#### Minor (nice to fix)
- **[Decisions: short viewports] Boundary off by one: at `clientHeight = 184` the list thumb is still static** _(Subagent #1)_ → P2-M1.
- **[Step 2] Green did not say the four numeric constants are exported, but the Red test imports them** _(Subagent #1)_ → P2-M2.
- **[Step 5] Metric stubs were described for the whole describe, which conflicts with its no-spies case; `afterEach` is missing from `ChoreForm.test.tsx`'s vitest import** _(Subagents #1, #4)_ → P2-M3.
- **[Step 7] Tests 2 and 4 used locators declared only in other tests** _(Subagents #2, #5)_ → P2-M4.
- **[Steps 1, 2] Step 1's `npm run lint` had no `(root)` qualifier after `cd frontend`; Step 2's build + grep named no cwd** _(Subagent #3)_ → P2-M5.
- **[Step 2] The built-CSS grep cannot detect a misspelled class, because Tailwind v4 also scans the Red test's literals** _(Subagent #3)_ → P2-M6.
- **[Decisions (e)] "Never meets the toast" holds only while the frame spans the viewport (the Pi)** _(Subagent #4)_ → P2-M7.
- **[Step 7] Single-letter locals `r` / `t` in the prescribed read** _(Subagent #4)_ → P2-M8.
- **[Step 1] Hook cases 8 and 9 use fake-timer APIs without enabling fake timers** _(Subagent #5)_ → P2-M9.
- **[Step 7] The end-of-list poll could hang if a parallel smoke worker grows the list after the single `scrollTop` write** _(Subagent #5)_ → P2-M10.
- **[Step 7] Test 2's height check is a single read; it can race React's re-measure after a smoke re-pull** _(Subagent #6)_ → P2-M10.
- **[Step 7] Record the measured real-browser geometry** _(Subagent #5)_ → P2-M11.
- **[Step 8] The conditional "Investigate and fix any failure" box had no tick-as-N/A form** _(Subagent #6)_ → P2-M12.
- **[Decisions (e) / Summary] Nothing carries DD-3's new contract (the 160 px track stop and its re-check obligation) to META-PLAN's Phase C fold-back** _(Subagent #6)_ → DD-7.

### Verification Gaps
- **Step 7**: the e2e spec still cannot run before the component exists. Pass 2 measured the
  real app at the relevant viewports: 1280×600 gives list clientHeight 365, scrollHeight 844 and
  thumb ≈ 88.7 px; 400×400 gives card 360/573. Pass 2 also type-checked the `readThumb` / `expect.poll`
  snippet in a scratch `e2e/` spec. Root `npx eslint` exited 0 and strict `tsc` on the file exited 0.
  The scratch file was deleted and `git status` was clean.
- **Phase C fold-back (DD-7)**: the PR body is the only carrier. No SKILL.md line makes
  `/run-feature` Phase C read it, so the operator must fold the notes by hand.

### To-Do: Mechanical Fixes (auto-applied)
- [x] P2-M1 — Decisions, short viewports: `160 < clientHeight ≤ 184` is static, and `> 184` is normal. Node: ch 184 → `{24, top 0}` at both ends; ch 185 → top 0 → 1. The review's DD-3 bullet was corrected to match _(applied by fixing subagent)_
- [x] P2-M2 — Step 2 Green: the four numeric constants are `export const` (verified: `ScrollToTopButton.tsx:7,10` export theirs; `eslint.config.js:34,55` has `allowConstantExport: true`). `VISIBLE_CLASSES`/`HIDDEN_CLASSES` stay unexported like `OFFSET_CLASSES` (`:19`) _(applied by fixing subagent)_
- [x] P2-M3 — Step 5 Red: stubs installed per case, before render and not in `beforeEach`; `afterEach` added to `ChoreForm.test.tsx:1`'s vitest import. Sibling sweep: the new Step 1 and Step 2 test files import `beforeEach`/`afterEach` explicitly. Dry run: a scratch `frontend/src/__tests__/_scratch_p2.test.ts` using a bare `afterEach` failed `npx tsc --noEmit -p .` (in `frontend/`) with `TS2304: Cannot find name 'afterEach'` (exit 2). It was then deleted and `git status` was clean _(applied by fixing subagent)_
- [x] P2-M4 — Step 7: Test 2 declares `region`/`frame`/`thumb` and Test 4 declares `region`/`thumb` in its own body _(applied by fixing subagent)_
- [x] P2-M5 — cwd class. Step 1 Refactor now reads `npx tsc --noEmit -p .` (in `frontend/`) + `npm run lint` (root); Step 2's build/grep says repo root. Sibling sweep: Steps 1–3 Red runs use `(cd frontend && …)` subshells; Step 6's README grep, Step 7's and Step 8's Playwright runs and Step 8's repo-fact greps say "from the repo root"; Step 8's tsc/lint line matches. Dry runs from `/home/rmila/Code/c4i-wt-overlay-scrollbar`: `npm run lint` exit 0 at the root and exit 1 in `frontend/` (missing script); `npx tsc --noEmit -p .` in `frontend/` exit 0; the grep from `frontend/` exit 2 (No such file or directory) and from the root it printed the 3 existing utilities; the Step 1 Red vitest run exit 1 (file missing) _(applied by fixing subagent)_
- [x] P2-M6 — Step 2: the misspelling diagnostic was replaced. The gate proves Tailwind can emit the utilities; a source misspelling is caught by the className test (cases 2–3). The `duration-[400ms]` fallback was kept _(applied by fixing subagent)_
- [x] P2-M7 — Decisions (e): the toast relation is qualified. It holds on the Pi; on desktop viewports wider than 800 px a long toast pill can cover the lower track, harmlessly, since the toast is `z-[80]`. The same qualifier is carried into the DD-7 fold-back note for invariant 14 _(applied by fixing subagent)_
- [x] P2-M8 — Step 7: `r`/`t` renamed to `scroller`/`thumbRect` _(applied by fixing subagent)_
- [x] P2-M9 — Step 1 cases 8 and 9: fake timers enabled with the `try { … } finally { vi.useRealTimers(); }` idiom _(applied by fixing subagent)_
- [x] P2-M10 — Step 7 Test 2: a single `readThumb(pinEnd)` helper, one `thumb.evaluate`. The height check is an `expect.poll(…).toBeLessThanOrEqual(1)`. The end-of-scroll poll re-pins `scrollTop` inside the same evaluate on every iteration. The `thumbBottom ≤ frameBottom − 160 + 0.5` bound stays a single-read assertion. The snippet passed root `npx eslint` (exit 0) and a strict standalone `tsc` (exit 0) in a scratch `e2e/_scratch_p2.spec.ts`, which was then deleted _(applied by fixing subagent)_
- [x] P2-M11 — Step 7: measured geometry recorded in Test 2 (365/844/479, track 205, ≈ 88.7 px, ≈ 116 px travel) and Test 3 (card 360/573; list 173 px, a static 13 px bar, which node confirms: `{h: 13, top: 0}`) _(applied by fixing subagent)_
- [x] P2-M12 — Step 8: the "Investigate and fix" box ticks as N/A ("no failures") on a clean run. An unfixable failure uses the canonical `UNRESOLVED` stop, and the marker line is deleted before ticking on a later passing run _(applied by fixing subagent)_
- [x] P2-M13 — Orchestrator note (Task C): commands run from the repo root, or as `(cd frontend && …)`, and never with cwd under `plans/`. Before Step 1's commit subagent, the orchestrator runs `git status --porcelain --untracked-files=all | grep -vE '^.. (<META-PLAN|plan|review|Step 1's two files>)$' || true`, which must print nothing; otherwise it stops with the canonical `UNRESOLVED` line ending its summary. Dry run from the repo root: printed nothing (exit 0, also under `set -euo pipefail`). Negative path: a piped extra `?? plans/.claude/loop.md` line was printed (exit 0). The consumer `git add --dry-run .` listed only the 3 expected paths _(applied by fixing subagent)_
- [x] W4 — Whole-document gate re-run after all edits and DD-7. 8 `###` steps. No Prerequisites/exemption list exists; the new tool tokens are `git`, `grep`, `cd` (subshell), all already in use. No stale `< 184` or `≥ 184`, no bare `cd frontend &&` outside subshells, and no single-letter locals remain. Step 8's before-state greps were re-run: outer column at `App.tsx:349`, counts 1/1/1, `scrollbar-none` only in `NavBar.tsx`. The anchors `ToastState :27`, imports `:18/:19`, `ChoreForm.tsx:1/:5` and README `:48-50` all hold _(verified by whole-document re-run; no edit needed)_

### Design Decisions

#### DD-7: [Decisions (e) / Summary] Carrier for F22's contract deltas to Phase C fold-back
**Context:** DD-3 departs from the META-PLAN formula (the list track stops 160 px above the frame
bottom) and adds a re-check obligation. Invariant 12's re-check rule and invariant 14's `bottom-40`
relations do not know about it. No SKILL.md line reads this plan at Phase C, and the META-PLAN's
F22 section is deleted at fold-back.

| # | Option | Trade-off |
|---|---|---|
| 1 | Fold-back notes in the PR body (same carrier as DD-6) | Explicit and user-visible; the Phase C operator still folds them by hand |
| 2 | Edit the META-PLAN's F22 section now | Lands in the ledger commit; mixes plan-time edits into META-PLAN outside Phase C |
| 3 | Accept the gap | Phase C would record the unclamped formula and miss the re-check item |

**Chosen:** Option 1, "Fold-back notes in PR" (user, 2026-09-23). The plan's Summary gained a
**Fold-back notes for Phase C** list under the operator line:
- invariant 12's re-check rule gains `LIST_THUMB_BOTTOM_INSET_PX` (`App.tsx`) alongside
  `scroll-pb-*` and `bottom-40`;
- the list track stops 160 px above the frame bottom, a deliberate departure from the META-PLAN's
  unclamped formula;
- invariant 14's `bottom-40` line gains the thumb's relation: it stops at the line and never
  enters it, with the Pi/desktop toast qualifier from P2-M7;
- invariant 16 records `mx-4` replacing `w-full`;
- the form card sits in a card-sized `relative w-full max-w-md` wrapper, with `OverlayScrollbar`
  top/bottom insets of 12.

The operator line and Step 8's final box now copy these into the final report and into the PR
body's "How to manually verify" bullet, right after the Manual Pi checks under their own heading.
The plan text says honestly that no SKILL.md line reads them at Phase C.

---

### Re-verification of Pass-1 Resolutions
All six reviewers re-read the source behind every Pass-1 `[x]` item (M1–M15, W1–W3, DD-1–DD-6)
and found none incorrect:
- #1 re-verified the M1 escapes against the current `dist`, the anchors and the jsdom mechanics.
- #2 traced the DD-4 wrapper hit-test and the `#root`-relative e2e geometry.
- #3 re-simulated the W1 anchor drift (27→28, 349→353, 360→364).
- #4 confirmed the DD-1 skill-config claim and the DD-6 `git-push` quote.
- #5 re-ran the DD-3 numbers in Vitest and measured DD-4 on the real app.
- #6 found no regressions.

The P2-M1 boundary correction is a Pass-2 fix to DD-3's recorded text, not a re-opened finding.

### Missed-Finding Root Causes
| Finding | Root cause | Skill gap? |
|---|---|---|
| Stray `.claude/` placeholders swept by `git add .` | Other: an environment artifact created *by the review's own subagents*, whose cwd was under `plans/`. It did not exist when Pass 1 checked git state. | Yes: reviewer, fixer and DD subagent prompts should require running every command from the repo root (never cwd under `plans/`), and a pass should re-check `git status --porcelain --untracked-files=all` before handing off |
| Short-viewport boundary `< 184` vs `≤ 184` | Other: introduced by Pass-1 DD-3 application, which wrote a boundary from reasoning instead of evaluating the rule at the boundary value | Instructions already cover this (5f: run the rule, not a recomputed number); execution miss |
| Constants not exported | Trusted plan assertion: the Red imports and the Green declarations were never cross-checked | Instructions already cover this |
| Step 5 spy scoping + missing `afterEach` import | Fix verification stopped at plan text: M6 rewrote "before render" describe-wide without re-reading `ChoreForm.test.tsx:1` or the describe's no-spies case | Instructions already cover this (sibling-step sweep; read the file the fix depends on) |
| Test 2/4 locators out of scope | Other: DD-4/DD-5 application added and reworked Playwright test bullets without simulating per-test scope | Instructions already cover this; execution miss |
| Step 1 lint cwd | Scoped too narrowly: M8's sibling sweep added `(root)` to Steps 2–8 and missed Step 1 | Instructions already cover this (sibling-step sweep) |
| Built-CSS misspelling diagnostic vacuous | Fix verification stopped at the happy path: M1 dry-ran the grep but not its diagnostic's negative path (misspelled source plus a test literal) | Instructions already cover this (rule 5, negative path) |
| Toast claim holds only on the Pi | Scoped too narrowly: DD-3 geometry was checked at the Pi viewport, not at the e2e 1280 px viewport where `#root` is capped at 768 px | Possible gap: DD-application geometric claims should be checked at every viewport the plan's tests use |
| Single-letter `r`/`t` locals | Other: introduced by M7's snippet | Instructions already cover this (naming rule); execution miss |
| Fake timers not enabled for cases 8/9 | Trusted plan assertion: present since the initial plan | Instructions already cover this |
| End-scroll poll re-pin + height-check race | Fix verification stopped at DOM atomicity: M7 made the read atomic against the DOM, not against React's ResizeObserver-driven re-render | Instructions already cover this; execution miss |
| Measured geometry not recorded | Other: Pass 1 could not run the real app before the component existed; Pass 2 measured the live app | No gap |
| Step 8 conditional box without N/A form | Trusted plan assertion: present since the initial plan | Instructions already cover this (rule 4 tick-as-N/A); execution miss |
| DD-3 contract has no Phase C carrier (DD-7) | Other: DD-3 application created a new durable contract without asking where it lands at fold-back | Possible gap: when a DD departs from the META-PLAN spec, 5f should require naming a fold-back carrier |

### Verdict
[ ] Ready to proceed as-is
[x] Proceed after minor fixes
[ ] Requires changes before proceeding

The only major was environmental and has been resolved out-of-band. All minors and DD-7 are
applied, so there are 0 open critical and 0 open major findings, and the review loop exits after
Pass 2.

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | #3 read `eslint.config.js`, both tsconfigs, `App.tsx`, `ChoreForm.tsx` and `ScrollToTopButton.tsx`; the `ChoreForm.test.tsx:1` import gap was fixed (P2-M3) |
| Type annotations | [x] | #1 read the hook/component patterns and `tsconfig.json`; the constant exports were fixed (P2-M2) |
| Error handling (status codes, exceptions, user feedback) | [x] | #2: frontend-only, with no endpoints; traced the backdrop cancel, the jsdom guards and the scroll/RO/timer → state chain |
| Test coverage (happy path, sad path, edge cases) | [x] | #5 read all affected tests, `vitest.config.ts`, `playwright.config.ts` and both e2e specs, and measured the real app |
| Breaking changes (API contracts, shared state, DB schema) | [x] | #6 read META-PLAN invariants 1–17, the test pins and `run-feature` Phase C; the fold-back carrier was added (DD-7) |
| Config consistency (env vars, requirements pins, lint rules) | [x] | #4 read `package.json` ×2, `eslint.config.js`, skill-config, `playwright.config.ts` and the executor SKILL.md files |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | #4 read `~/.claude/CLAUDE.md` and META-PLAN; single-letter locals were fixed (P2-M8) |

### Skill Improvements Applied
| # | Finding | Subagent | Gap type | Change | Status |
|---|---|---|---|---|---|
| 1 | Stray `.claude/` placeholders swept by `git add .` | #3 | missing_context | Subagent prompts: run from repo root; re-check `git status --untracked-files=all` per pass | Not applied (user selected none, 2026-09-23); captured as project memory `sandbox-cwd-claude-placeholders` |
| 2 | Toast claim holds only on the Pi | #4 | prompt_gap | 5f: check DD geometric claims at every test viewport | Not applied (user selected none) |
| 3 | DD-3 contract has no Phase C carrier | #6 | prompt_gap | 5f: name a fold-back carrier when a DD departs from the spec | Not applied (user selected none) |
