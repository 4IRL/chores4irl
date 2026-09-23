# Review: Floating Scroll-to-Top Button (F18)

## Review — 2026-09-23

### Summary
The design is sound and was dry-run in-repo by several reviewers: the hook, the component and the App frame pass their cases, the ref attaches before the effect runs, and the scroller's class list and last child are unchanged. Two issues would have committed lint/tsc errors: an `as any` teardown and a missing `afterEach` import. There were also gate-wording and executor-cadence gaps. All of these are now fixed mechanically. Six design decisions remain.

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | FAIL | 0 critical, 2 major, 3 minor |
| 2 | Full-Stack Trace | PASS | 0 critical, 0 major, 3 minor |
| 3 | Ordering & Cleanup | FAIL | 0 critical, 4 major, 3 minor |
| 4 | Integration & Conventions | FAIL | 0 critical, 2 major, 3 minor |
| 5 | Verification & Coverage | FAIL | 0 critical, 3 major, 1 minor |
| 6 | Completeness & Risk | FAIL | 0 critical, 2 major, 6 minor |

Deduplicated: 0 critical, 7 major, 10 minor.

### Findings

#### Major (should fix)
- **[Step 2, 3] `delete (Element.prototype as any).scrollTo` fails `@typescript-eslint/no-explicit-any`** _(#1, #3, #4, #5, #6)_: verified with eslint exit 1; replaced with `as Partial<Element>` (lint + tsc exit 0).
- **[Step 3] `afterEach` not imported in App.test.tsx** _(#1, #3, #5, #6)_: `tsc --noEmit -p frontend` → TS2304; vitest `globals` masks it at runtime.
- **[Step 4] Bare `README.md` is ambiguous** _(#4)_: 3 README.md files exist; the target is the repo root.
- **[Step 5] Manual Pi checkbox can never be ticked by a never-ask subagent** _(#3)_ → DD-4.
- **[Step 5] Smoke-spec ports-occupied exit has no tick form / stop token** _(#3)_ → DD-5.
- **[Steps 2, 3, 5] Layout/visibility verified only through className strings in jsdom (`css: false`)** _(#5)_ → DD-6.

#### Minor (nice to fix)
- **[Step 2] `right-4` comment misstates geometry** _(#1, #2, #6)_: the button is 2 rem from the screen edge today and 1 rem after F22 → DD-1.
- **[Step 2] Tapped button keeps focus while it becomes aria-hidden** _(#2, #6)_; a hidden button still fires on a synthetic click (#5) → DD-2.
- **[Step 2] Fade ignores prefers-reduced-motion** _(#6)_ → DD-3.
- **[Step 5] Visible button overlaps the left-swipe start zone at a bar's right end; flick starting on the button is unverified** _(#2, #6)_ → folded into DD-4.
- **[Step 2, 3] Receiver of the shared prototype `scrollTo` stub is not asserted** _(#6)_.
- **[Step 5] e2e button-count grep returns 5 `toHaveCount` hits, so "shows nothing" is unsatisfiable** _(#1, #3, #4, #5)_.
- **[Step 4] README has no "UI overview" heading** _(#1)_.
- **[Steps 1–3] Abbreviated names and inline `type` import** _(#4)_.
- **[Steps 1–3] lint/tsc deferred to Step 5 despite per-step commits** _(#3)_.
- **[All] `cd frontend && …` mixed with root-relative paths** _(#3)_.
- **[Decisions (e)] F19/F22 hand-off facts not recorded for fold-back** _(#6)_.

### Verification Gaps
- **Steps 2–3**: real-browser layout (anchoring, deck clearance, fade, tap-through) is not verified at any layer (DD-6). _Resolved by DD-6: new plan Step 5 (`e2e/scroll-to-top.spec.ts`) covers opacity/`inert`, anchoring, deck clearance and click → top in Chromium; touch/swipe interplay remains in the plan's "Manual Pi checks" section (DD-4)._

### To-Do: Mechanical Fixes (auto-applied)
_(applied inline by the orchestrator: all target one small plan file, where parallel fixers would clobber each other. Each fix's dry-run evidence comes from the reviewers' in-repo probes cited above.)_
- [x] `as any` → `as Partial<Element>` in Step 2 and Step 3 teardown
- [x] Step 3: add `afterEach` to App.test.tsx vitest import
- [x] Steps 2–3: assert the receiver via `vi.mocked(Element.prototype.scrollTo).mock.contexts[0]`
- [x] Step 4: repo-root README path + section label; root-relative verify grep
- [x] Step 5: e2e grep gate states the 5 known `toHaveCount` hits
- [x] Steps 1–3: `scrollElement` / `button` / `prefersReducedMotion` names; separate `import type`
- [x] Steps 1–3: run `npm run lint` + `npx tsc --noEmit -p frontend` after each Green
- [x] All: `(cd frontend && …)` subshell form + a "commands run from repo root" note
- [x] Decisions (e): fold-back notes for F19/F22

### Design Decisions (awaiting user input)

#### DD-1: [Step 2] Horizontal inset of the button
**Context:** The frame sits inside the column's `px-4`, so `right-4` places the button 2 rem from the screen edge today. After F22 moves `px-4` off the column, it will be 1 rem. The spec asks for "≈ 1 rem".

| # | Option | Trade-off |
|---|---|---|
| 1 | Keep `right-4`, fix the comment | 1 rem inside the bars' right edge today; lands at 1 rem from the screen once F22 is full-bleed, with no F22 change needed |
| 2 | `right-0` | Flush with the bars' right edge now (1 rem from the screen); F22 must bump it to `right-4` |

**Chosen:** Option 1 — keep `right-4`, fix the comment. OFFSET_CLASSES comment + a Decisions bullet now say: 1 rem in from the frame's edge; 2 rem from the screen today (frame inside `px-4`), 1 rem from the screen once F22 goes full-bleed, no F22 change.

#### DD-2: [Step 2] Focus/interaction when the button hides after a tap
**Context:** Chromium focuses the tapped button. It then hides (aria-hidden, opacity-0) while still holding focus, which is an ARIA violation, and Enter or Space would still activate it.

| # | Option | Trade-off |
|---|---|---|
| 1 | Add `inert` when hidden | Drops focus and blocks pointer and keyboard at the DOM level (React 19 boolean prop, already used in App); one extra attribute |
| 2 | `blur()` in the click handler | Handles only the tap path |
| 3 | Accept | Harmless on a touch kiosk |

**Chosen:** Option 1 — `inert={!isVisible}`. _(Pass 2: timing changed by DD-8 — now `inert={!isInteractive}`, applied `FADE_MS` after the fade-out starts; the focus drop happens then.)_ tsc/eslint accept it (probe, exit 0). Chromium drops focus to `<body>` by the next frame (probed). jsdom 29 ignores `inert` (`fireEvent.click` still fires, probed), so unit tests assert only the attribute (Step 2 cases 1–3, Step 3 case 2), and the new e2e spec asserts it in Chromium.

#### DD-3: [Step 2] Reduced motion for the fade
| # | Option | Trade-off |
|---|---|---|
| 1 | Add `motion-reduce:transition-none` | Matches the scroll behaviour and F22's spec; class-only |
| 2 | Keep the fade always | Simpler; inconsistent with the scroll |

**Chosen:** User variant — neither listed option. The scroll's reduced-motion behaviour is unchanged, and no `motion-reduce:` class is added. The fade is lengthened to `duration-500`, matching Chromium's measured smooth-scroll time (≈ 500–516 ms for 803–903 px; Pi not measured). Step 2 case 7 now asserts `duration-500`.

#### DD-4: [Step 5] Manual Pi checks — representation and scope
**Context:** A `- [ ]` box a never-ask executor cannot perform either stalls `/run-plan` or gets ticked falsely. Scope also misses a left swipe that starts under the button and a flick that starts on it.

| # | Option | Trade-off |
|---|---|---|
| 1 | Move to a non-checkbox "Manual Pi checks (post-merge, reported to the user)" section, expanded scope | Survives the cadence; surfaced at the Phase B merge gate |
| 2 | Keep as a checkbox, ticked as "deferred — reported" | Stays in the checklist, but the tick is a fake completion |

**Chosen:** Option 1 — the checkbox is removed. The plan now has a `## Manual Pi checks (post-merge, reported to the user — not executor checkboxes)` section with 4 plain bullets: tap, hidden tap-through, the left-swipe band overlap (accepted and observed), and a flick starting on the button. `/run-feature` surfaces it at the Phase B merge gate. _(Pass 2: that delivery claim was wrong — no skill surfaces it. Superseded by DD-7: pre-merge, via the executor's final report and the PR description.)_

#### DD-5: [Step 5] Smoke-spec ports stay occupied
| # | Option | Trade-off |
|---|---|---|
| 1 | Leave the box unticked, write `UNRESOLVED — requires user decision/action: smoke ports occupied` and stop | Honest; `/run-plan` halts and the user decides |
| 2 | Tick it with a note and let `/run-feature` step 8 re-run it | Keeps the plan finishing, but the gate is deferred |

**Chosen:** Option 1 — after ~10 min of jittered retries, the box stays unticked with `UNRESOLVED — requires user decision/action: smoke ports occupied (<ss -ltnp>)` and the run stops. Never tick, kill, drop `CI=1`, or edit the config. The same rule applies to the new e2e box (Step 5). The old "Step 5" in these DD headings is now Step 6 (Verify All Tests Pass).

#### DD-6: [Steps 2–3] Real-browser verification of layout/visibility
| # | Option | Trade-off |
|---|---|---|
| 1 | New `e2e/scroll-to-top.spec.ts` | Hidden (opacity 0) at load; visible after scroll; stays put; clear of the deck; click returns to top. Real coverage, plus one more e2e file under the port constraint |
| 2 | Explicit manual visual checks (DD-4 section) | Cheap; not automated |
| 3 | Documented accepted gap | Cheapest; nothing checks layout |

**Chosen:** Option 1 — the new plan Step 5 writes `e2e/scroll-to-top.spec.ts` and then runs it to green. It is read-only, pins the clock to noon, and uses a 1280×600 viewport, where the overflow is 451 px (measured). Assertions: opacity 0 + `inert` at load; opacity 1 after `scrollTop = 150`; the box stays fixed while the region scrolls; the bottom edge is ≤ deck y − 64; click → `scrollTop` 0 → hidden. Verify moved to Step 6.

---

### Verdict
[ ] Ready to proceed as-is
[ ] Proceed after minor fixes
[x] Requires changes before proceeding

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | afterEach import gap found (#3); no deletions, so no dead imports |
| Type annotations | [x] | RefObject typing + tsc dry-run (#1) |
| Error handling (status codes, exceptions, user feedback) | [x] | No endpoints; matchMedia/scrollTo absence guarded (#2) |
| Test coverage (happy path, sad path, edge cases) | [x] | All spec-required tests present; layout gap → DD-6 (#5) |
| Breaking changes (API contracts, shared state, DB schema) | [x] | Scroller class/lastChild unchanged; F19/F22 hand-off (#6) |
| Config consistency (env vars, requirements pins, lint rules) | [x] | eslint no-explicit-any, tsconfig globals (#4) |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | Renames applied (#4) |

---

## Review — 2026-09-23 (Pass 2)

### Summary
The Pass-1 fixes all held against the source. Two reviewers built the full plan in-repo and got green results: vitest 34 files, lint and tsc exit 0, a clean build, the e2e spec `1 passed` (4/4 repeats), and smoke plus the spec at 15 passed. Pass 2 found four majors. Three are executor or cadence gaps: the Manual Pi checks had no delivery path; the UNRESOLVED stop never reached the executor's report; and `/run-plan`'s own Playwright runs could adopt a sibling worktree's servers. The fourth is a real UX bug: during the 500 ms fade-out, taps fell through the still-visible button and completed the chore bar beneath. All mechanical fixes are applied. DD-7, DD-8 and DD-9 were decided by the user and applied. For DD-8, the component and unit cases were dry-run in-repo, and the App cases and e2e spec in a `git archive HEAD` copy.

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | PASS | 0 critical, 0 major, 1 minor |
| 2 | Full-Stack Trace | FAIL | 0 critical, 1 major, 1 minor |
| 3 | Ordering & Cleanup | FAIL | 0 critical, 3 major, 2 minor |
| 4 | Integration & Conventions | FAIL | 0 critical, 1 major, 6 minor |
| 5 | Verification & Coverage | PASS | 0 critical, 0 major, 1 minor |
| 6 | Completeness & Risk | FAIL | 0 critical, 1 major, 4 minor |

Deduplicated: 0 critical, 4 major, 13 minor. (#4's minor "run-plan's final e2e run lacks `CI=1`" is merged into #3's major, and #3's and #5's "1 flaky" minors are one finding.)

### Findings

#### Major (should fix)
- **[Manual Pi checks, Decisions (b)] Nothing delivers the Manual Pi checks to the user** _(#3, #4, #6)_. `.claude/skills/run-feature/SKILL.md` Phase B is a single two-option AskUserQuestion that never reads the plan. `/git-push` builds its PR body from the diff. The section's "post-merge" also contradicted Phase B's pre-merge "works correctly on its branch" confirmation. → DD-7.
- **[Step 2] Taps during the fade-out complete the chore bar beneath** _(#2)_. `pointer-events-none` and `inert` flipped in the same render as `opacity-0`, while `duration-500` kept the button painted. Measured with `elementFromPoint`: from about 200 ms to 600 ms after a tap, the hit target was `chore-bar` while the button's opacity went from 0.97 to 0.15. → DD-8.
- **[Steps 1–3, 5; run-plan 2c/final suite] `/run-plan`'s own `$UI_RUNNER_CMD` was bare `npx playwright test`** _(#3; #4 minor)_. With `reuseExistingServer: !CI`, it could adopt a sibling `c4i-wt-*` worktree's servers. After Step 5, that would make the new spec fail against correct code and send the Test Fix Loop the wrong way. → DD-9.
- **[Step 5 box 2, Step 6 e2e box] The UNRESOLVED stop was written only into the plan** _(#3)_. `/run-plan` 2b stops on the executor's report, and a stale marker survived a later passing run. → Mechanical fix 1.

#### Minor (nice to fix)
- **[Step 2 comment, DD-3 bullet] "The fade roughly tracks the scroll" is wrong** _(#2)_. The fade-out starts only when the scroll crosses 80 px (about 200 ms in), so it trails the scroll. → Fix 5.
- **[Step 5 intro] The planning-run note claimed the deck precondition had passed** _(#1)_. Only the overflow check runs before the first button assertion. → Fix 4.
- **[Steps 5–6] No gate type-checks `e2e/*.ts`** _(#3)_. eslint is not type-aware, and `-p frontend` excludes `e2e/`. → Fix 3.
- **[Step 5 box 2] With `CI=1`, a pass can print `1 flaky` instead of `1 passed`** _(#3, #5)_. → Fix 2.
- **[Step 5] Concurrency with smoke in CI is unstated** _(#4)_. `npm run test:e2e` runs both files in parallel workers. → Fix 6.
- **[Step 6] Only smoke was re-run, while CI runs every spec** _(#6)_. → Fix 11.
- **[Step 3 case 1] The exact-className pin will break when F22 adds `scrollbar-none`** _(#4)_. The pin is kept deliberately, and a fold-back note was added (Fix 8).
- **[Decisions (e)] F22 Open risk (e) predicts an `h-full` scroller that F18 does not build** _(#4)_. → Fix 8.
- **[Step 2 case 7] `q` in the matchMedia stub** _(#4)_. → Fix 9.
- **[Step 2 Green] The props type did not follow the `type <Component>Props` convention** _(#4)_. → Fix 10.
- **[Step 6] The plan did not say why smoke's raw-mouse left swipe cannot start on the button** _(#6)_. → Fix 7.
- **[Decisions (e)] Fold-back notes missed Standing invariants 12 and 14 and the stale `App.tsx:318` anchor** _(#6)_. → Fix 8.
- **[Decisions] The unblank-while-scrolled case was unaddressed** _(#6)_. → Fix 12, accepted and documented.

### Verification Gaps
- **Manual Pi checks** (tap vs swipe, tapping during the fade-out, the left-swipe band, a flick on the button) stay manual and pre-merge (DD-7).
- **Fade and scroll timing on the Pi's own Chromium build and refresh rate** was not measured _(unverified: no Pi access from the sandbox)_.
- **The DD-7 PR-body section and the DD-9 skill-config substitution** were not dry-run through a real `/run-feature` or `/run-plan` invocation _(unverified: both are skill runs, not commands)_. The substituted command itself (`env -u PLAYWRIGHT_BASE_URL CI=1 npx playwright test`) was run: 15 passed.

### Dry-run evidence (Pass 2 application)
Paths:
- In-repo root: `/home/rmila/Code/c4i-wt-scroll-to-top`.
- `$COPY` = the scratchpad `copy/` (a `git archive HEAD` copy with the worktree's `node_modules` and `frontend/node_modules` symlinked, using the repo's own configs). The copy was used for the App.tsx and e2e runs so that no worktree source file was edited.

All probe files were deleted. `git status --short` is back to ` M plans/META-PLAN.md` + `?? plans/feature/scroll-to-top/`.

Results:
- **DD-8 component and unit cases, in-repo.** The Step 1 hook, the Step 2 Green file (verbatim from the plan) and the Step 2 cases were written to their planned paths under `frontend/src`.
  - `(cd frontend && npx vitest run src/__tests__/components/ScrollToTopButton.test.tsx)` → 9 passed.
  - `npm run lint` → exit 0. `npx tsc --noEmit -p frontend` → exit 0.
  - The files were then deleted.
- **Timer counts.** `vi.getTimerCount()` read: mount 1, visible 0, fading 1, after re-show 0, after unmount 0.
- **Mutations.**
  - No `clearTimeout` cleanup → cases 4 and 5 fail.
  - A 0 ms delay → cases 3 and 4 fail.
  - `inert={!isVisible}` → case 3 fails.
- **The `$COPY` build (Steps 1–3 + 5).**
  - `(cd frontend && npx vitest run)` → 33 files, 334 tests passed (no hook test file in the copy).
  - `npx tsc --noEmit -p frontend` → 0. `npx eslint .` → 0. `npm run build --workspace frontend` → 0.
- **e2e, in `$COPY`.**
  - `env -u PLAYWRIGHT_BASE_URL CI=1 npx playwright test e2e/scroll-to-top.spec.ts` → 1 passed.
  - `--repeat-each 10 --retries 0` → 10 passed (2 workers).
  - Single-phase mutation (`inert`, `aria-hidden`, `tabIndex` and `pointer-events-none` keyed on `isVisible`) → 1 failed at `expect(firstFadeFrame).toEqual(…)`.
  - `env -u PLAYWRIGHT_BASE_URL CI=1 npx playwright test` (both specs, as CI runs them) → 15 passed.
- **The Fix 3 type-check, in-repo, on a temp copy of the plan's spec at `e2e/scroll-to-top.spec.ts`.** The command was `npx tsc --noEmit --strict --module esnext --moduleResolution bundler --target es2022 --skipLibCheck --lib es2022,dom e2e/scroll-to-top.spec.ts`.
  - The spec as written → exit 0.
  - With an injected `number`→`string` assignment → TS2322, exit 2.
  - With the file missing → exit 2.
  - The temp file was deleted.
- **Step 6 greps (in `$COPY`).**
  - `inert={!isInteractive}`, `export const FADE_MS = 500;` and `transition-opacity duration-500` → 1 each.
  - `getByTestId('scroll-to-top')` in the spec → 1.
  - `scrollRegionRef` in App.tsx → 3 lines (no comment naming it).
  - `inert={!isVisible}` → 0, exit 1, so a stale grep would fail the gate.
- **The plan's embedded component and spec blocks** were extracted and `diff`ed against the dry-run files: identical.

### To-Do: Mechanical Fixes (auto-applied)
- [x] 1. UNRESOLVED stop line also ends the executor's final report, and the stale marker is deleted on a later passing run. Applied to Step 5 box 2 and Step 6's e2e box.
- [x] 2. A `1 flaky` / `N flaky` result is a failure to investigate. Applied to Step 5 box 2 and Step 6's e2e box.
- [x] 3. Standalone `npx tsc … e2e/scroll-to-top.spec.ts` added to Step 5 box 1 and Step 6 box 2 (dry-run above).
- [x] 4. Step 5 note: "overflow precondition".
- [x] 5. Fade wording: the fade-out trails the scroll. Applied to the Step 2 component comment and the DD-3 bullet, and reconciled with DD-8 (tappable for the whole fade-out).
- [x] 6. CI concurrency: Step 5 conventions paragraph (row count, parallel workers) and the spec header comment.
- [x] 7. Smoke-swipe clearance note in Step 6.
- [x] 8. Decisions (e) fold-back notes:
  - Standing invariants 12 and 14.
  - Every stale `App.tsx:318` reference (Baseline plus F22).
  - F22 Open risk (e).
  - F22 must update F18's exact-className pin in Step 3 case 1. The pin is kept deliberately.
  - Also: F19's "hidden after reset" test now needs `advanceTimersByTime(FADE_MS)` before asserting `inert`/`aria-hidden` (DD-8 propagation).
- [x] 9. `q` → `query` in the matchMedia stub (Step 2 case 7).
- [x] 10. `type ScrollToTopButtonProps = {…}` with the destructured signature (in the Step 2 Green file).
- [x] 11. Step 6's e2e box runs all of `e2e/` as CI does (`env -u PLAYWRIGHT_BASE_URL CI=1 npx playwright test` → 15 passed), keeping the sibling-port retry, UNRESOLVED and flaky rules.
- [x] 12. Decisions bullet "Unblank while scrolled (accepted)".

### Design Decisions

#### DD-7: [Manual Pi checks] Delivery path and timing
**Context:** Pass 1's DD-4 said `/run-feature` surfaces the checks at Phase B. It does not. The section was also labelled post-merge, although Phase B asks the user to confirm the branch works *before* merge.

| # | Option | Trade-off |
|---|---|---|
| 1 | Pre-merge: the executor's final report plus a PR-description section | Rides channels that exist (next-step-taker lists manual steps, the orchestrator holds the report and runs `/git-push`); the PR is what the user reviews at merge. Relies on the orchestrator following the plan, because no skill copies the section automatically |
| 2 | Post-merge: keep the section as is and fix the wording only | Cheapest; nothing delivers the checks, so open risk (b) may never be confirmed on the Pi |

**Chosen:** Option 1.
- The section is retitled "Manual Pi checks (pre-merge, reported to the user — not executor checkboxes)".
- A final Step 6 box has the executor copy the bullets verbatim into its final report under "Manual checks for the user (pre-merge)".
- The `/run-feature` orchestrator adds them to the PR body as a `## Manual test plan` section after `/git-push`'s `## Verification Steps`, or with `gh pr edit` on an open PR.
- The user runs them before answering Phase B. Its "The feature works correctly on its branch (you've verified it)" confirmation covers them.
- Decisions (b) and the new DD-7 bullet state plainly that no skill does this automatically.

#### DD-8: [Step 2] Taps during the fade-out
**Context:** The button went non-interactive in the same render as `opacity-0`, so for about 0.4 s a visibly present button passed taps to the chore bar beneath, which completed that chore.

| # | Option | Trade-off |
|---|---|---|
| 1 | Stay tappable until the fade ends (two-phase: opacity from `isVisible`, non-interactive state after a `FADE_MS` timer) | A tap during the fade just re-scrolls to the top (harmless). Adds one state, an effect and a timer. The focus drop is delayed by 500 ms |
| 2 | Instant or short fade-out (e.g. `duration-150` on hide, or no fade-out) | Shrinks or removes the window with class-only changes. Partly reverses DD-3's 500 ms fade |
| 3 | Accept and document | No code change; a re-tap within about 0.5 s can complete a chore |

**Chosen:** Option 1. The implementation:
- `export const FADE_MS = 500` is tied to `duration-500` by a doc comment.
- `isInteractive` is `useState(false)`, so the boot view is non-interactive immediately.
- A `useEffect` on `[isVisible]` sets it true on show. On hide, `setTimeout(() => setIsInteractive(false), FADE_MS)`, and the cleanup clears the timer on re-show and on unmount.
- `inert`, `aria-hidden`, `tabIndex` and `pointer-events-none` key on `isInteractive`, and the opacity keys on `isVisible`.

Tests and plan text:
- Step 2 cases 1 and 3–5 use fake timers with Toast.test.tsx's `try/finally` pattern plus `vi.getTimerCount()`.
- Step 3 case 2 checks non-interactive immediately on load.
- The e2e spec has an in-page rAF sample at the first faded frame (`{ inert: false, hitsButton: true }`), then polls opacity to 0 and asserts `inert` is present. It was deterministic in 10/10 runs, and the single-phase variant fails it.
- The Step 6 grep is now `inert={!isInteractive}`, plus `export const FADE_MS = 500;`.
- Decisions (b), DD-2 and DD-3 are updated.

#### DD-9: [run-plan] Sibling-safe orchestrator Playwright runs
**Context:** `/run-plan` substitutes `ui_runner_cmd` from `.claude/skill-config.md` for its 2c smoke run and its final suite. That value was bare `npx playwright test`.

| # | Option | Trade-off |
|---|---|---|
| 1 | Sibling-safe skill-config: set `ui_runner_cmd`, `test_run_cmd` and `test_run_built_cmd` to `env -u PLAYWRIGHT_BASE_URL CI=1 npx playwright test` | Deterministic for every orchestrator run. The file is git-ignored, so the change is per-worktree and not in the PR. A busy port fails loudly, and the plan must say that is not a code failure |
| 2 | Orchestrator override: an "Orchestrator note" in the plan telling `/run-plan` to use the sibling-safe form | Plan-only, but relies on the orchestrator honouring plan text over its config |

**Chosen:** Option 1. The orchestrator already made the change in this worktree's `.claude/skill-config.md`. It is local to the worktree and not part of the PR. The plan gained:
- a DD-9 Decisions bullet saying a port-in-use failure is a port conflict and not a Test Fix Loop input, and that an "element(s) not found" failure while smoke passes means a sibling's servers were adopted;
- a one-line Orchestrator note in the Steps preamble pointing to that bullet.

### Missed-Finding Root Causes

| Pass-2 major | What Pass 1 missed | Why | Skill gap? |
|---|---|---|---|
| Manual Pi checks have no delivery path (DD-7) | Pass 1's DD-4 option text claimed "`/run-feature` surfaces it at the Phase B merge gate", and the chosen fix repeated the claim | **Trusted plan assertion**: a skill-behaviour claim, written by the orchestrator in a DD option, that nobody checked against `run-feature/SKILL.md`. DD option viability was applied to code observables, not to claims about what a skill does | **Yes.** Proposal for plan-reviewer `subagent-prompts.md`: DD option viability must cover any claim that a skill surfaces, relays or runs something, and must quote the skill line that does it. If there is none, the option is unviable or annotated `_(unverified)_`. Optional durable fix: `run-feature` Phase B reads and relays a plan's `## Manual … checks` section (integration option 3) |
| Taps during the fade-out complete a chore (DD-8) | DD-2 (`inert` when hidden) and DD-3 (500 ms fade) were each probed alone. The e2e spec checked only end states (opacity 0 + `inert` after the click) | **Cross-DD interaction not simulated**, plus **end-state-only verification** of a timed transition. Nobody sampled hit-testing *during* the fade | **Yes.** Proposal for the Full-Stack Trace checklist and the cross-fix interaction check: when an element's interactivity toggles while a CSS transition keeps it painted, sample `elementFromPoint` or `pointer-events` across the transition's frames. Also treat two DDs that touch the same element's state and timing as an interaction pair |
| Orchestrator Playwright runs could adopt sibling servers (DD-9) | Pass 1 hardened the plan's own gates (DD-5) but did not trace commands `/run-plan` runs outside the plan text (2c smoke, final suite) | **Incomplete file reads**: `run-plan/SKILL.md` was read, but not the `.claude/skill-config.md` values it substitutes (`ui_runner_cmd`) | **Yes.** Proposal for Verification-locus rule (4): also resolve every `$VAR` the executing skills substitute from `skill-config.md`, and simulate those commands under the same hazards as the plan's own gates |
| UNRESOLVED stop only in the plan file | DD-5 persisted the marker in the plan but did not route the stop token into the executor's final report. The resume path (removing the stale marker) was not walked | **Partial executor simulation**: rule (4) already names "the orchestrator's stop-gate token" and resume. The persisted state was checked, but the reporting channel `/run-plan` 2b reads was not | **Partly.** The rule exists but was under-applied. Proposal: add a canonical stop-protocol snippet to plan-creator/plan-reviewer references (plan marker + identical final-report line + delete-on-resume), cited by the local-url-alias precedent, so that each DD does not re-derive it |

---

### Verdict
[ ] Ready to proceed as-is
[ ] Proceed after minor fixes
[x] Requires changes before proceeding. _All 4 majors and 13 minors are now applied (12 mechanical fixes plus DD-7, DD-8 and DD-9). A Pass 3 should confirm there are 0 critical and 0 major findings._

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | Step 2 test imports `FADE_MS` and `act`; component imports `useEffect`/`useState`; lint and tsc exit 0 (in-repo dry-run) |
| Type annotations | [x] | `ScrollToTopButtonProps`; e2e spec now type-checked by a standalone `tsc` gate (Fix 3) |
| Error handling (status codes, exceptions, user feedback) | [x] | No endpoints; port-in-use is a port conflict, not a code failure (DD-9); UNRESOLVED routed to the report (Fix 1) |
| Test coverage (happy path, sad path, edge cases) | [x] | Fade-window cases 3–5 with mutation probes; the e2e fade-frame hit-test; Step 6 runs all specs (Fix 11) |
| Breaking changes (API contracts, shared state, DB schema) | [x] | Scroller class and last child unchanged; F19/F22 fold-back notes extended (Fix 8) |
| Config consistency (env vars, requirements pins, lint rules) | [x] | skill-config runner commands are sibling-safe (DD-9, git-ignored); `retries: CI ? 1 : 0` → flaky rule (Fix 2); react-hooks 5.2.0 does not flag setState in an effect |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | `query` (Fix 9), `type <Component>Props` (Fix 10), exported `FADE_MS` like `SUCCESS_TOAST_MS` |

## Review — 2026-09-23 (Pass 3)

### Summary
Clean pass. All six reviewers PASS; each ran the whole plan (Steps 1–6) verbatim in an isolated `git archive HEAD` copy with the repo's own toolchain. Results: vitest 339–341 tests passed, `npm run lint` 0, both tsc gates 0, frontend build 0, full e2e (`env -u PLAYWRIGHT_BASE_URL CI=1 npx playwright test`) 15 passed, and every Step 6 grep matched. All Pass-1/2 `[x]` fixes and DD-1…DD-9 re-verified against real source. **Plan is ready for implementation.**

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | PASS | 0 critical, 0 major, 1 minor |
| 2 | Full-Stack Trace | PASS | 0 critical, 0 major, 3 minor |
| 3 | Ordering & Cleanup | PASS | 0 critical, 0 major, 3 minor |
| 4 | Integration & Conventions | PASS | 0 critical, 0 major, 1 minor |
| 5 | Verification & Coverage | PASS | 0 critical, 0 major, 2 minor |
| 6 | Completeness & Risk | PASS | 0 critical, 0 major, 2 minor |

Deduplicated: 0 critical, 0 major, 11 minor.

### To-Do: Mechanical Fixes (auto-applied, inline by orchestrator)
- [x] Step 3 case 3: search input located via `getByLabelText('Search for a chore')` (role `textbox`, not `searchbox`) _(#1, #6)_
- [x] Step 3 case 3: day offset untouched (`queryByText('Return to today')` null), per META-PLAN Action _(#5 — minor DD resolved: add, verified passing)_
- [x] Step 6: SCROLL_TO_TOP_THRESHOLD_PX/OFFSET_CLASSES grep expects 4 lines _(#6)_
- [x] Steps 1–2 Refactor boxes also run lint + tsc _(#5)_
- [x] Decisions (e): fold-back note names F22's actual stale line; F19 already reuses the ref _(#4)_
- [x] DD-8: tail-of-fade-out tappable window recorded (measured, harmless) _(#2)_
- [x] Manual Pi checks bullets 3–4: third outcome ("neither") + desktop-Chromium probe results _(#2)_
- [x] DD-7 item 2: fall back to the plan's section when the Step 6 report is unavailable (resume) _(#3)_
- [x] DD-9: orchestrator-side port-conflict stop ends the orchestrator's own summary with the UNRESOLVED line and re-runs on resume _(#3 — minor DD resolved)_
- Phase C fold-back notes delivery _(#3 minor DD)_: accepted as the existing convention — the /run-feature Phase C orchestrator reads this plan's Decisions (e) alongside META-PLAN.

### Verdict
[ ] Ready to proceed as-is
[x] Proceed after minor fixes (all applied)
[ ] Requires changes before proceeding

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | Full-sequence dry-run; lint/tsc 0 (#3) |
| Type annotations | [x] | tsc frontend + standalone e2e tsc 0 (#1) |
| Error handling (status codes, exceptions, user feedback) | [x] | No endpoints; matchMedia/scrollTo guarded (#2) |
| Test coverage (happy path, sad path, edge cases) | [x] | 339–341 unit + 15 e2e passed (#5) |
| Breaking changes (API contracts, shared state, DB schema) | [x] | Scroller class/lastChild pinned; F19/F22 fold-back notes (#6) |
| Config consistency (env vars, requirements pins, lint rules) | [x] | skill-config sibling-safe (local, gitignored) (#4) |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | (#4) |

### Skill Improvements Applied
| # | Finding (Pass 2 miss) | Subagent | Gap type | Change | Status |
|---|---|---|---|---|---|
| 1 | Manual checks had no delivery path | #3/#6 | prompt_gap | Verification locus rule (4): skill-behaviour claims must quote the SKILL.md line (subagent-prompts.md) | Applied |
| 2 | Tap fall-through during fade | #2 | prompt_gap | Per-frame transition hit-testing checklist item | Rejected by user |
| 3 | Orchestrator Playwright adopted sibling servers | #3 | scope_limitation | Rule (4): resolve skill-config `$VAR`s and simulate the skills' own commands | Applied |
| 4 | UNRESOLVED stop only in plan | #3 | prompt_ambiguity | Canonical stop protocol in rule (4) + new "Stop Protocol (canonical)" section in plan-creator/SKILL.md | Applied |
