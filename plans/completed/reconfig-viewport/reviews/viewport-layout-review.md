# Review: Viewport Layout Reconfiguration

## Review — 2026-04-18

### Summary
The plan has sound overall architecture but contains a critical sequencing gap (add-chore form is unreachable across Steps 5–6), a recurring broken OverdueBadge placement that will not work as specified in any browser, and several major gaps in test coverage and App.css cleanup. Requires changes before proceeding.

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | FAIL | 4 major, 3 minor |
| 2 | Full-Stack Trace | FAIL | 1 critical, 3 major, 4 minor |
| 3 | Ordering & Cleanup | FAIL | 1 major, 2 minor |
| 4 | Integration & Conventions | FAIL | 2 major, 2 minor |
| 5 | Verification & Coverage | FAIL | 3 major, 2 minor |
| 6 | Completeness & Risk | FAIL | 3 major, 4 minor |

### Findings

#### Critical (must fix before proceeding)

- **[Steps 4–7] Add-chore form unreachable across Steps 5–6** _(Subagents #2, #3)_: Step 4 removes the `{showForm ? <AddChoreForm ...> : <AddChoreButton ...>}` conditional (replacing it with a footer that only renders `<AddChoreButton>`) and removes the `AddChoreForm` import. `ChoreFormModal` doesn't exist until Step 7. Across Steps 5 and 6 clicking "+ Add Task" toggles `showForm` to `true` but nothing renders — the add-chore feature is silently broken.

#### Major (should fix)

- **[Step 8] OverdueBadge sm:static broken outside flex container** _(Subagents #1, #4, #6)_: The plan renders `OverdueBadge` as a sibling of the `absolute inset-0` content div at the bar root level, then applies `sm:static` to restore it "in-flow." But `sm:static` on an element that is a sibling of an absolutely-positioned div does not place it inside that div's flex row — on `sm+` the badge drops to normal document flow at the outer `relative` container level, appearing overlaid at position 0,0. `sm:order-none` is also a no-op without the badge being a flex child. The plan's assertion "sm:static restores in-flow placement on wider screens" is incorrect.

- **[Step 8] ProgressBar silently dropped from replacement JSX** _(Subagent #1)_: The current `ChoreTimerBar` renders `<ProgressBar width={barWidth} color={barColor} isUrgent={isUrgent} />` as the first child inside the outer div, before the `absolute inset-0` content div. The plan's Step 8 replacement block only shows the content div, OverdueBadge, and delete button — ProgressBar is not mentioned. Implementers replacing "the entire absolute inset-0 div and its children" may leave ProgressBar in place (it sits outside that div), but the ambiguity is high enough that it should be explicit.

- **[Step 2] App.css Vite scaffold global styles not addressed** _(Subagent #6)_: `App.css` contains live Vite scaffold rules: `a`, `a:hover`, `h1`, `button { background-color: #1a1a1a; border: 1px solid transparent; padding: 0.6em 1.2em; }`, `button:hover`, `button:focus`, `button:focus-visible`, and a `@media (prefers-color-scheme: light)` block (lines 15–59). These global `button` rules will silently override Tailwind utility classes on `AddChoreButton`, the delete button, and form buttons. The plan only removes the commented-out boilerplate block (lines 62–95) and replaces `#root` — it does not address these conflicting live rules.

- **[Step 8] OverdueBadge right-10 overlaps delete button on mobile** _(Subagent #2)_: The delete button sits at `right-3` (12px from right edge) with `px-3 py-1` — approximately 32–36px wide. Its left edge extends to roughly 44–48px from the right edge. The badge at `right-10` (40px) sits inside the delete button's horizontal span, causing visual overlap.

- **[Step 7] overflow-hidden on .App may clip fixed modal on iOS Safari** _(Subagent #2)_: `overflow: hidden` on a parent does not clip `position: fixed` children in standard CSS. However, on iOS Safari/WebKit, if a `transform`, `will-change`, `filter`, or `perspective` is ever added to `.App`, the fixed modal will be clipped to `.App`'s bounds. Safe today but fragile.

- **[Step 11] Vitest unit test suite missing from verification** _(Subagent #5)_: Step 11 only runs `npx playwright test`. The project also has Vitest unit tests (`cd frontend && npm test`) covering `App.tsx`, `ChoreTimerBar.tsx`, `ChoreList.tsx`, and `AddChoreForm.tsx` — all modified by this plan. These tests are not run and failures would go undetected.

- **[Step 7] Playwright smoke tests will break after modal change** _(Subagent #5)_: `e2e/smoke.spec.ts` `adds a new chore via the form` and `deletes a chore` click "+ Add Task" then immediately fill inputs. After the modal refactor, the form renders inside `ChoreFormModal` (a `fixed inset-0` overlay). The test does not wait for the modal to be visible before filling — any React state latency could cause the fill to no-op. The test needs a `await expect(page.locator('.fixed.inset-0')).toBeVisible()` wait added.

- **[Steps 1–9] No intermediate verification checkpoints** _(Subagent #5)_: All 9 implementation steps contain zero verification. Steps 1–2 establish the foundational viewport constraints that all later scroll/sticky assumptions depend on. A wrong `#root` height in Step 2 will silently invalidate Steps 3–8 with no detection point until the manual Step 10 browser check at the end.

#### Minor (nice to fix)

- **[Step 1] Standalone `body {}` rule not explicitly addressed** _(Subagents #1, #6)_: `index.css` has two rules affecting body: the `body, html { ... }` combined rule AND a standalone `body { outline: 3px solid green; }` rule. Step 1 says "remove `outline: 3px solid green` from the body rule" and "replace the `body, html` block." An implementer may remove the outline, leave an empty `body {}` block, and not realize it should be deleted entirely. The final state should have two clean rules (`html {}` and `body {}`) with no leftover empty block.

- **[Step 2] Loading state drops py-4 silently** _(Subagent #1)_: The loading state replacement changes `p-4` to `px-4` (dropping `py-4`). This is intentionally correct (h-screen flex container centers the text) but not called out. An implementer might wonder if the vertical padding was accidentally omitted.

- **[Step 3] ChoreList empty state not addressed** _(Subagent #6)_: When the chore list is empty, the scroll wrapper (`flex-1 overflow-y-auto min-h-0`) collapses to zero height, leaving a bare gap between the date line and the sticky footer. Visually jarring on the RPI target but functional.

- **[Step 7] Modal `items-center` may feel tight on iPhone SE (667px)** _(Subagent #6)_: `AddChoreForm` has 8 fields + buttons. At `max-h-[90dvh]` = 600px on a 667px screen, the form will scroll internally, but `items-center` vertically centers a tall card — the top of the form could be at or above the viewport edge.

- **[Step 1] overflow:hidden on html/body SPA constraint undocumented** _(Subagent #6)_: If a page-level scroll route is ever added, `overflow: hidden` on `html`/`body` will silently break it. A single comment noting the SPA constraint prevents future confusion.

- **[Steps 3–4] Step 3 is subsumed by Step 4 without acknowledgment** _(Subagents #2, #3, #4, #6)_: Step 3 adds a scroll wrapper around `<ChoreList>` inside the existing content wrapper. Step 4 replaces the entire content wrapper (which already includes the scroll wrapper). Step 3's change is immediately overwritten. An implementer applying steps individually will be confused why Step 3's edit disappears. The plan should note this explicitly or merge the steps.

### Verification Gaps

- **Steps 1–9**: Suggest adding a dev-server spot check after Step 2 — start `npm run dev`, open at 375px width, confirm `#root` fills the viewport before proceeding.
- **Step 7**: Suggest running `npm run test:e2e` after Step 7 and fixing any smoke test failures before Steps 8–11.

### To-Do: Mechanical Fixes (auto-applied)

- [x] Add note in Step 8: ProgressBar preservation note added before **To-do** block. _(applied)_
- [x] Add instruction in Step 2 to remove Vite scaffold global styles (a, h1, button, etc.) from App.css. _(applied)_
- [x] Change OverdueBadge mobile offset from `right-10` to `right-16` in Step 8. _(applied)_
- [x] Add to Step 11: `cd frontend && npm test` (Vitest) required alongside Playwright. _(applied)_
- [x] Add to Step 7: smoke.spec.ts tests must await `.fixed.inset-0` visibility before filling inputs. _(applied)_
- [x] Add to Step 1: delete the standalone `body { outline: 3px solid green; }` block entirely. _(applied)_
- [x] Add note in Step 2: loading state intentionally drops `py-4`. _(applied)_
- [x] Add SPA constraint comment above `html { overflow: hidden; }` in Step 1. _(applied)_

### Design Decisions (awaiting user input)

#### DD-1: [Steps 4–7] How should the form-unreachable gap between Steps 4 and 7 be fixed?
**Context:** Step 4 removes the inline `AddChoreForm` render and its import. `ChoreFormModal` doesn't exist until Step 7. The add-chore feature is broken across Steps 5–6. The fix requires either reordering steps or making the transition atomic.

| # | Option | Trade-off |
|---|---|---|
| 1 | Merge Steps 4 and 7 into one atomic step | No intermediate broken state; larger step but cohesive |
| 2 | Move Step 7 to immediately after Step 4 (before Steps 5–6) | Keep steps separate; minimal reorder; Steps 5–6 run after modal is wired |

**Chosen:** Merge Steps 4 and 7

---

#### DD-2: [Step 8] How should OverdueBadge be positioned on sm+ screens?
**Context:** The plan places OverdueBadge as a sibling of the `absolute inset-0` content div, then uses `sm:static` to restore in-flow placement. This doesn't work — `sm:static` on a sibling of an absolutely-positioned div does not place it inside that div's flex row.

| # | Option | Trade-off |
|---|---|---|
| 1 | Move OverdueBadge inside the flex row div; use absolute positioning on mobile via a wrapper, in-flow on sm+ | Correct behavior; requires restructuring the badge into the flex child |
| 2 | Render OverdueBadge twice: `sm:hidden` absolute version for mobile, `hidden sm:block` in-flow version inside the flex row for sm+ | Simple CSS; slight DOM duplication |
| 3 | Use absolute positioning at all breakpoints with adjusted right offset on sm+ (e.g. `absolute top-2 right-14 sm:right-4`) | Simplest to implement; badge always floats, never in flex flow |

**Chosen:** Move inside flex row

---

#### DD-3: [Step 7] Should the modal use React Portal to avoid iOS Safari stacking context risk?
**Context:** `overflow: hidden` on `.App` is safe today (no transforms applied), but if a `transform` or `will-change` is ever added to `.App`, iOS Safari will clip the `fixed` modal. A React Portal renders directly on `document.body`, eliminating the risk entirely.

| # | Option | Trade-off |
|---|---|---|
| 1 | Add a code comment warning on `.App` div: "Do not add transform/will-change — breaks fixed modal on iOS Safari" | Zero code change to ChoreFormModal; warning may be missed |
| 2 | Use `ReactDOM.createPortal` in `ChoreFormModal` to render on `document.body` | Canonical solution; slightly more code but immune to future `.App` changes |

**Chosen:** Use React Portal

---

#### DD-4: [Steps 1–9] Should an intermediate dev-server checkpoint be added after Step 2?
**Context:** All 9 implementation steps have zero verification. A wrong `#root` height in Step 2 silently invalidates all scroll/sticky assumptions in Steps 3–8.

| # | Option | Trade-off |
|---|---|---|
| 1 | Add a brief checkpoint after Step 2: start dev server, confirm `#root` fills viewport at 375px before proceeding | Catches foundational errors early; small overhead |
| 2 | Keep verification deferred to Step 10 — trust the cascade | Faster to implement if you trust the steps; risk is debugging regressions at the end |

**Chosen:** Add checkpoint after Step 2

---

#### DD-5: [Steps 3–4] Should Steps 3 and 4 be merged into one atomic step?
**Context:** Step 3 adds a scroll wrapper to the existing content div. Step 4 replaces the entire content div (including the scroll wrapper). Step 3's change is immediately overwritten by Step 4. The plan currently presents them as separate steps without noting the overlap.

| # | Option | Trade-off |
|---|---|---|
| 1 | Merge Steps 3 and 4 into one step with the full content wrapper replacement | Eliminates confusion; no ambiguity about which edit to apply |
| 2 | Keep separate but add a note in Step 3: "Step 4 will overwrite this with the full content wrapper — apply both before testing" | Preserves step granularity; requires careful reading |

**Chosen:** Merge Steps 3 and 4

---

#### DD-6: [Step 3] Should an empty-state message be added to ChoreList?
**Context:** When the chore list is empty, the `flex-1 overflow-y-auto min-h-0` scroll wrapper collapses to zero height, leaving a bare gap. Particularly visible on the RPI target.

| # | Option | Trade-off |
|---|---|---|
| 1 | Add an empty-state message: "No chores yet — tap + Add Task to get started." | Better UX; small addition to ChoreList |
| 2 | Accept the collapsed area — sticky footer is always visible, UX is functional | Zero extra work; cosmetic issue only |

**Chosen:** Add empty-state message

---

#### DD-7: [Step 7] Should the modal use `items-start` on short screens instead of `items-center`?
**Context:** On iPhone SE (667px), `AddChoreForm` has 8 fields + buttons. At `max-h-[90dvh]` = 600px, the form will scroll internally, but `items-center` can push the card top above the viewport edge on very short screens.

| # | Option | Trade-off |
|---|---|---|
| 1 | Keep `items-center` — form is capped at 90dvh and scrolls internally; acceptable on iPhone SE | Zero extra code; may feel tight at 667px |
| 2 | Use `items-start pt-4` — pin the form near the top on all heights | Slightly better on short screens; loses the centered feel on tall screens |

**Chosen:** Use items-start pt-4

---

### Verdict
[ ] Ready to proceed as-is
[x] Proceed after minor fixes
[ ] Requires changes before proceeding

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | Ordering + Correctness agents traced AddChoreForm, ChoreFormModal imports |
| Type annotations | [x] | Correctness agent read tsconfig.app.json and component files |
| Error handling (status codes, exceptions, user feedback) | [x] | N/A — pure frontend CSS/layout plan with no API changes |
| Test coverage (happy path, sad path, edge cases) | [x] | Verification agent read App.test.tsx, ChoreTimerBar.test.tsx, smoke.spec.ts, playwright.config.ts |
| Breaking changes (API contracts, shared state, DB schema) | [x] | Completeness agent confirmed SPA with no API changes |
| Config consistency (env vars, requirements pins, lint rules) | [x] | Integration agent read vite.config.ts, tailwind.config.js, package.json |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | Integration agent read CLAUDE.md and sample component files |

---

## Review — 2026-04-18 (Pass 2)

### Summary
Pass 1 mechanical fixes and DD choices are mostly applied correctly against source. But DD-2's OverdueBadge fix is still logically inconsistent on sm+ (the `sm:order-2` produces ChoreInfo|CompletionInfo|OverdueBadge, not the claimed ChoreInfo|OverdueBadge|CompletionInfo), the new portal modal will break existing Vitest App tests (container.querySelector returns null for portaled children), and the bare `index.html` references in the plan are ambiguous between two real files. Requires changes before proceeding.

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | FAIL | 0 critical, 1 major, 0 minor |
| 2 | Full-Stack Trace | FAIL | 0 critical, 1 major, 1 minor |
| 3 | Ordering & Cleanup | PASS | 0 critical, 0 major, 2 minor |
| 4 | Integration & Conventions | FAIL | 0 critical, 2 major, 3 minor |
| 5 | Verification & Coverage | FAIL | 0 critical, 2 major, 3 minor |
| 6 | Completeness & Risk | PASS | 0 critical, 0 major, 3 minor |

### Findings

#### Critical (must fix before proceeding)
None.

#### Major (should fix)

- **[Step 7] OverdueBadge `sm:order-2` produces wrong visual order on sm+** _(Subagents #1, #2)_: Plan's replacement JSX places three flex children in source order [ChoreInfo, OverdueBadge-wrapper(sm:order-2), CompletionInfo] and claims final sm+ order is `ChoreInfo | OverdueBadge | CompletionInfo`. Per CSS flex spec, elements with `order:0` (the siblings) render first in source order, then `order:2` elements. Computed visual order on sm+ is actually `ChoreInfo | CompletionInfo | OverdueBadge` — badge lands on far right, past CompletionInfo. The JSX source order is already correct for the intended layout, so the simplest fix is to drop `sm:order-2`. This bug persists from Pass 1 DD-2.

- **[Step 4 / Step 10] Portal modal breaks `App.test.tsx` `container.querySelector` lookups** _(Subagents #4, #5)_: `frontend/src/__tests__/App.test.tsx` uses `container.querySelector('input[name="name"]')` (and siblings) at lines ~147–150 (`openAndFillForm` helper) and ~207–211 (frozen sort test). After Step 4, `ChoreFormModal` calls `createPortal(..., document.body)`, so form inputs render outside RTL's `container` node. Three tests will crash on `.type(null, ...)`: _"appends the new chore to the list on success"_, _"shows error banner when addChore rejects"_, and _"adding a chore appends it to the end without re-sorting"_. Plan's Step 10 only says "Investigate and fix any failures" without pre-listing this as known-broken or prescribing the replacement strategy.

- **[Step 1 / Step 8 / Key File Locations] Ambiguous `index.html` path** _(Subagent #4)_: Repo has two index.html files — `/home/rmila/Code/chores4irl/index.html` (stale, references `/frontend/src/main.tsx`) and `/home/rmila/Code/chores4irl/frontend/index.html` (the actual Vite entry). Plan references bare `index.html` in the Key File Locations table and in Steps 1 and 8. Editing the root file would silently leave viewport meta and rotate-overlay changes invisible in the running app; all tests would still pass. Must specify `frontend/index.html` throughout.

- **[Step 10] `ChoreTimerBar` layout restructure lacks unit test coverage** _(Subagent #5)_: Step 7 significantly restructures ChoreTimerBar (mobile stacked layout at h-36, OverdueBadge wrapper positioning, delete-button repositioning, `chore.id` removal). Existing `ChoreTimerBar.test.tsx` covers delete-button behavior and propagation only — nothing exercises the new layout structure or verifies `chore.id` is gone. Plan relies entirely on the manual Step 9 visual check.

#### Minor (nice to fix)

- **[Step 2] Content-wrapper className edit overwritten by Step 4** _(Subagent #3)_: Step 2 bullet 5 rewrites the inner content-wrapper className, then Step 4's final bullet replaces that entire wrapper (and children) with the same className embedded. The interim edit is not harmful but duplicates work and may confuse an implementer watching the file diff.

- **[Step 4] Sub-edit order is implicit** _(Subagent #3)_: Seven sub-edits in Step 4 — `ChoreFormModal.tsx` file creation (bullet 2) correctly precedes App.tsx import add (bullet 4), but no explicit "apply in listed order" instruction. An implementer who reorders could momentarily import a non-existent file.

- **[Step 4] Empty-state returns `<p>` where non-empty branch returns `<div>`** _(Subagent #4)_: `ChoreList.tsx` non-empty branch returns `<div className="space-y-3 pb-4">`; empty branch returns `<p className="text-gray-400 text-center py-8">`. Structural parity with a `<div>` wrapper would be marginally cleaner.

- **[Step 4] Modal lacks Escape key and backdrop click dismissal** _(Subagents #2, #6)_: `ChoreFormModal` has no keyboard dismissal (Escape) and no backdrop click-to-close. Touch-screen RPI target unaffected; desktop/keyboard a11y gap.

- **[Step 7] Long chore names not addressed in stacked mobile layout** _(Subagent #6)_: `ChoreInfo` has no `truncate` or `line-clamp`. On h-36 mobile bar, a long name could wrap and visually push other rows. `overflow-hidden` on the root clips but doesn't truncate cleanly.

- **[Step 9] Visual verification lacks DevTools / URL / orientation-emulation guidance** _(Subagent #5)_: Step 9 lists viewport sizes but not *how* to set them. No URL stated; no instruction for emulating landscape-under-500px-tall for the rotate overlay check.

- **[Step 3] Verification to-do lacks actionable instrumentation** _(Subagent #5)_: "Confirm #root fills the viewport with no page scroll" is eyeball-able. Stronger guidance (e.g., "computed height === window.innerHeight", "no scrollbar on <html>/<body>") would catch regressions reliably.

- **[Step 10] Expected test breakages not pre-listed** _(Subagent #5)_: Covered by the major finding on `container.querySelector`; noting separately in case the fix strategy is "pre-list known failures" without changing code queries.

### Verification Gaps

- **Step 4 (Vitest side)**: `App.test.tsx` needs updated query strategy after portal change — the plan's `npm test` phase will expose this, but it should be pre-listed as a required edit alongside the `smoke.spec.ts` change.
- **Step 9 (visual check)**: Suggest adding explicit DevTools device-toolbar instructions.

### To-Do: Mechanical Fixes (auto-applied)

- [x] Replace bare `index.html` with `frontend/index.html` in Key File Locations + Steps 1 and 8. _(applied)_
- [x] Add "Apply bullets in listed order — `ChoreFormModal.tsx` must exist before App.tsx imports it" preface to Step 4. _(applied)_
- [x] Expand Step 9 visual verification with DevTools device-toolbar instructions and the dev URL. _(applied)_
- [x] Expand Step 3 verification to-do with concrete checks (computed height, no scrollbar, body scroll attempt). _(applied)_

### Design Decisions (awaiting user input)

#### DD-1 (Pass 2): [Step 7] How should OverdueBadge's sm+ visual order be corrected?
**Context:** Plan claims final sm+ order is `ChoreInfo | OverdueBadge | CompletionInfo`. With current plan JSX (OverdueBadge wrapper has `sm:order-2`, siblings default to order 0), the actual computed order is `ChoreInfo | CompletionInfo | OverdueBadge`. JSX source order already matches the intended layout; simplest fix is to drop `sm:order-2`.

| # | Option | Trade-off |
|---|---|---|
| 1 | Drop `sm:order-2` from badge wrapper (keep `sm:static`) | Smallest change; JSX source order alone produces intended sm+ layout |
| 2 | Keep `sm:order-2`, add `sm:order-3` to CompletionInfo | Explicit ordering; requires wrapping CompletionInfo or editing its className |
| 3 | Accept computed order `ChoreInfo | CompletionInfo | OverdueBadge` and update plan narrative | Zero code change; changes the intended visual design |

**Chosen:** Accept computed order — update plan narrative to state the final sm+ order is ChoreInfo | CompletionInfo | OverdueBadge.

---

#### DD-2 (Pass 2): [Step 4 / Step 10] How should `App.test.tsx` be updated for the portal modal?
**Context:** `openAndFillForm` helper and the frozen-sort test use `container.querySelector('input[name="..."]')`. Portal renders outside RTL's container → queries return null → tests crash. Plan doesn't prescribe a fix.

| # | Option | Trade-off |
|---|---|---|
| 1 | Switch to `screen.getByRole('textbox', {name: ...})` / `getByLabelText` | Canonical RTL approach; works across portals; depends on `<label htmlFor>` or aria-label being present |
| 2 | Switch `container.querySelector` to `document.body.querySelector` | Minimal diff; keeps existing selector pattern |
| 3 | Pass `{ baseElement: document.body }` to render() | Single-line infrastructure change; all lookups search document |

**Chosen:** Use screen.getByLabelText — canonical RTL approach; screen always searches document.body so portals are transparent.

---

#### DD-3 (Pass 2): [Step 10] Should Vitest coverage be added for ChoreTimerBar's new layout?
**Context:** Step 7 restructures the bar but `ChoreTimerBar.test.tsx` covers only delete-button behavior. The restructure is partly visual, but `chore.id` removal and class-presence are unit-testable.

| # | Option | Trade-off |
|---|---|---|
| 1 | Add a test asserting `queryByText(String(chore.id))` returns null | Catches the chore.id removal regression; low-cost |
| 2 | Add class-presence assertions for new wrapper / height / delete position | Brittle against Tailwind refactors; more churn on future design tweaks |
| 3 | Rely on Step 9 manual visual check; add no unit tests | Fastest; no regression guard against silent layout drift |

**Chosen:** No new unit tests — rely on Step 9 manual visual check. Accept the coverage gap.

---

#### DD-4 (Pass 2): [Step 2] Should the content-wrapper className edit in Step 2 be dropped (since Step 4 re-installs it)?
**Context:** Step 2 bullet 5 rewrites the wrapper className; Step 4's atomic rewrite replaces the whole wrapper with the same className embedded. Interim edit is functionally redundant.

| # | Option | Trade-off |
|---|---|---|
| 1 | Drop the Step 2 inner-wrapper className edit; Step 4 installs it | Cleaner diff; no duplicated work |
| 2 | Keep the edit and add a note: "Step 4 will re-install the same className" | Preserves independent-step narrative; requires careful reading |

**Chosen:** Drop the Step 2 edit — Step 4's atomic rewrite installs the same className.

---

#### DD-5 (Pass 2): [Step 4] Should the empty-state be a `<p>` or wrapped in a `<div>`?
**Context:** Non-empty branch returns `<div className="space-y-3 pb-4">`; plan's empty branch returns bare `<p>`. Structural parity would pair with a `<div>` wrapper.

| # | Option | Trade-off |
|---|---|---|
| 1 | Keep `<p>` as-is | Zero extra markup; current plan |
| 2 | Wrap `<p>` in a `<div>` for structural parity with list branch | Slightly more consistent; negligible extra DOM |

**Chosen:** Wrap <p> in a <div> for structural parity with the list branch.

---

#### DD-6 (Pass 2): [Step 4] Should ChoreFormModal have Escape key / backdrop-click dismissal?
**Context:** Modal currently closes only via the Cancel button. Touchscreen RPI target unaffected; desktop/keyboard users cannot dismiss without a mouse click on Cancel.

| # | Option | Trade-off |
|---|---|---|
| 1 | Add Escape keydown listener (useEffect) → onCancel | Standard keyboard a11y; small addition |
| 2 | Add backdrop click-to-close (outer div onClick with target === currentTarget guard) | Standard pointer a11y; slight risk of accidental dismiss |
| 3 | Add both | Most complete; more code |
| 4 | Defer to follow-up a11y pass | Zero extra scope; gap remains |

**Chosen:** Add backdrop click-to-close — clicks on the outer overlay div (where e.target === e.currentTarget) call onCancel; clicks inside the form card do not dismiss.

---

#### DD-7 (Pass 2): [Step 7] Should ChoreInfo name truncate on the stacked mobile layout?
**Context:** On h-36 mobile bar, a long chore name can wrap. `overflow-hidden` on the bar clips but doesn't truncate cleanly.

| # | Option | Trade-off |
|---|---|---|
| 1 | Add `truncate` to ChoreInfo's name div | Clean ellipsis; one-word fix |
| 2 | Add `line-clamp-2` (allow 2 lines) | More room for descriptive names; still clips |
| 3 | Accept overflow-hidden clipping; address if real-world names are an issue | Zero scope; visual artifact persists |

**Chosen:** Add truncate to ChoreInfo name div — ellipsis clip on mobile stacked layout.

---

### Verdict
[ ] Ready to proceed as-is
[x] Proceed after minor fixes
[ ] Requires changes before proceeding

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | Subagent #3 re-verified plan imports match App.tsx and ChoreFormModal file |
| Type annotations | [x] | Subagent #1 read tsconfig, verified Chore type and createPortal import |
| Error handling (status codes, exceptions, user feedback) | [x] | N/A — frontend-only plan |
| Test coverage (happy path, sad path, edge cases) | [x] | Subagent #5 read App.test.tsx, ChoreList.test.tsx, ChoreTimerBar.test.tsx — found App.test.tsx portal gap |
| Breaking changes (API contracts, shared state, DB schema) | [x] | Subagent #6 confirmed SPA with no API changes |
| Config consistency (env vars, requirements pins, lint rules) | [x] | Subagent #4 read vite.config.ts, vitest.config.ts, tailwind.config.js, eslint.config.js, tsconfig.json |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | Subagent #4 read README.md and skill-config; no chores4irl CLAUDE.md exists |

### Missed-Finding Root Causes

| Finding | Root cause | Skill gap? |
|---|---|---|
| OverdueBadge `sm:order-2` wrong visual order | Pass 1 Trusted plan assertion — DD-2 reviewer accepted "Move inside flex row" as fixing the order, without tracing the CSS flex `order` computation for source-order siblings with mixed `order` values | Instructions already cover this under "Do not trust plan assertions" — execution miss |
| Portal breaks App.test.tsx `container.querySelector` | Pass 1 Scoped too narrowly — Verification subagent read `App.test.tsx` but didn't trace portal-implications on RTL's container boundary | Gap: Verification subagent prompt should explicitly flag portal/portal-like DOM-boundary patterns when reviewing modal-introducing plans |
| Ambiguous `index.html` — root vs frontend/index.html | Pass 1 Scoped too narrowly — Integration subagent read `frontend/index.html` but did not grep for sibling `index.html` at repo root | Gap: Integration subagent prompt should check for ambiguous bare filenames when project has nested workspaces |
| ChoreTimerBar layout unit-coverage missing | Pass 1 Verification subagent focused on e2e coverage and final-test-phase commands; did not enumerate which tests exist vs. which steps restructure code | Gap: Verification subagent should map every restructure step to its unit test file and flag coverage holes |

---

## Review — 2026-04-18 (Pass 3)

### Summary
Pass 2 mechanical fixes landed correctly. DD resolutions landed in plan text, but Pass 3 found one critical plus three majors: DD-2's `screen.getByLabelText` prescription is non-functional because `FormField.tsx` renders label/input as unassociated siblings; DD-7's `truncate` won't engage on sm+ flex rows without `min-w-0`; and Step 4's App.test.tsx bullet doesn't enumerate the helper-caller updates, unused-`container` destructures, or five inline `container.querySelector` calls in the frozen-sort test. One false-positive (`React.MouseEvent` without import) — existing codebase uses the same pattern successfully.

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | FAIL | 1 critical, 3 major, 1 minor |
| 2 | Full-Stack Trace | FAIL | 1 critical, 3 major, 1 minor |
| 3 | Ordering & Cleanup | PASS | 0 critical, 0 major, 2 minor |
| 4 | Integration & Conventions | FAIL | 0 critical, 1 major, 3 minor |
| 5 | Verification & Coverage | FAIL | 0 critical, 1 major, 0 minor |
| 6 | Completeness & Risk | FAIL | 0 critical, 3 major, 2 minor |

### Findings

#### Critical (must fix before proceeding)

- **[Step 4 / DD-2 resolution] `screen.getByLabelText` prescription is non-functional** _(Subagents #1, #2, #4, #5, #6)_: Pass 2 DD-2 prescribes replacing `container.querySelector('input[name="..."]')` with `screen.getByLabelText('Name')` and siblings. `FormField.tsx` renders `<label className="text-sm text-gray-400 capitalize">{label}</label>` and `<input name={name} ...>` as **siblings inside a div** — no `htmlFor`, no `id`, no `aria-label`, no `aria-labelledby`, no label wrapping. RTL's `getByLabelText` cannot associate them. Every call will throw `Unable to find a label with the text of: Name`. All three portal-affected tests will fail with a different error than the current `null.type()` crash. The DD-2 resolution is logically correct (portal → use `screen`) but the query needs FormField to gain a label association, OR a different query strategy must be chosen.

#### Major (should fix)

- **[Step 7] DD-7 `truncate` requires `min-w-0` on sm+ flex row to engage** _(Subagents #1, #2, #4 minor, #6)_: On mobile (`flex-col`), `truncate` on ChoreInfo's root works. On sm+ (`flex-row sm:items-center sm:justify-between`), ChoreInfo becomes a flex item with default `min-width: auto` — it refuses to shrink below its intrinsic content width, so `truncate` won't produce ellipsis and long names will push siblings off-row instead. Canonical Tailwind fix is to add `min-w-0` to the same className (`font-medium text-white truncate min-w-0`). Harmless on mobile.

- **[Step 4] DD-2 bullet doesn't enumerate helper callers or unused-`container` destructures** _(Subagents #1, #2)_: The bullet says `openAndFillForm` can drop its `container` parameter but doesn't explicitly list: (1) both callers at lines ~159 and ~171 calling `openAndFillForm(container, user)` must become `openAndFillForm(user)`; (2) the surrounding `const { container } = render(<App />);` destructures at lines ~157, 169, 196 become unused and will trigger ESLint's unused-vars rule — must be changed to `render(<App />)`.

- **[Step 4] Frozen-sort test has five inline `container.querySelector` calls not covered by DD-2 bullet** _(Subagent #2)_: The `adding a chore appends it to the end without re-sorting` test has five inline `container.querySelector('input[name="..."]')` calls at lines 208, 209, 210, 211, 212 (not inside `openAndFillForm`). The plan says "around lines 206-213" but doesn't enumerate these five lines explicitly. An implementer could miss them and the test would crash.

#### Minor (nice to fix)

- **[Step 2] Intermediate state between Step 2 and Step 4 has visible layout issue** _(Subagents #3, #6)_: After Step 2, the outer `.App` has `h-full flex flex-col overflow-hidden` but the inner wrapper still has `min-h-screen`. On short viewports, the inner pushes the sticky footer off-screen until Step 4's atomic rewrite. Functional (clicks still work), but a note on Step 2 would prevent implementer confusion if they start the dev server between steps.

- **[Step 2 / Step 4] Step 2's outer `.App` className edit is also re-installed by Step 4** _(Subagent #1)_: Pass 2 DD-4 removed the inner-wrapper edit for this reason; same duplication pattern holds for the outer-div edit, but it's harmless (identical className). No action needed.

- **[Step 4 / DD-6] Mousedown-in / mouseup-out drag-select can dismiss modal** _(Subagent #6)_: `onClick` with `event.target === event.currentTarget` fires on mouseup target. If the user mousedowns on a form field and drags past the form card to the backdrop before releasing, the modal dismisses. Unlikely on the touchscreen RPI target; desktop edge case.

- **False positive: `React.MouseEvent` without React import** _(Subagents #1, #6 flagged; Subagent #4 cleared)_: `AddChoreForm.tsx` uses `React.FormEvent` with no `import React` and compiles successfully under the project's `jsx: react-jsx` setup — global React namespace is available via `@types/react`. Same pattern is safe for `ChoreFormModal.tsx`. No fix required.

### Verification Gaps

- **Step 4 DD-2 implementability**: Before Pass 3, DD-2's prescription was never traced against FormField's actual markup — Pass 3 caught it.

### To-Do: Mechanical Fixes (auto-applied)

- [x] Add `min-w-0` to ChoreInfo name div className in Step 7 (alongside `truncate`, so the chosen DD-7 option works on sm+). _(applied)_

Mechanicals tied to the critical design decision (enumerating test-edit details) will be applied as part of the DD resolution, not in this section.

### Design Decisions (awaiting user input)

#### DD-1 (Pass 3): [Step 4] How should `App.test.tsx` actually locate form inputs through the portal?
**Context:** Pass 2 DD-2 chose `screen.getByLabelText('Name')` — but `FormField.tsx` renders label and input as siblings with no `htmlFor`/`id` association, so `getByLabelText` throws. The DD-2 prescription cannot succeed as-written. Three options:

| # | Option | Trade-off |
|---|---|---|
| 1 | Add `htmlFor={name}` to FormField's label and `id={name}` to its input, then keep `screen.getByLabelText` | Canonical a11y fix; real screen-reader improvement; ~2-line FormField edit; subsequent tests benefit from proper label association |
| 2 | Switch Step 4 bullet to use `document.body.querySelector('input[name="..."]')` | Smallest diff; no component change; keeps existing selector pattern; non-idiomatic RTL |
| 3 | Keep `container.querySelector` but pass `{ baseElement: document.body }` to `render()` and destructure `baseElement` instead of `container` | Single infrastructure change; existing selector shape preserved (via `baseElement.querySelector`); no a11y change |

**Chosen:** Add htmlFor/id to FormField — canonical a11y fix; enables getByLabelText and improves screen-reader support.

---

### Verdict
[ ] Ready to proceed as-is
[x] Proceed after minor fixes
[ ] Requires changes before proceeding

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | Ordering agent re-confirmed; React namespace convention verified against AddChoreForm |
| Type annotations | [x] | Correctness agent verified Chore / MouseEvent / portal typing |
| Error handling (status codes, exceptions, user feedback) | [x] | N/A — frontend-only |
| Test coverage (happy path, sad path, edge cases) | [x] | Verification + Full-Stack Trace agents traced portal → FormField label association |
| Breaking changes (API contracts, shared state, DB schema) | [x] | N/A |
| Config consistency (env vars, requirements pins, lint rules) | [x] | Integration agent re-read tsconfig, eslint.config.js, package.json |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | React-namespace pattern verified against project convention |

### Missed-Finding Root Causes

| Finding | Root cause | Skill gap? |
|---|---|---|
| `getByLabelText` non-functional due to FormField sibling label markup | Pass 2 Scoped too narrowly — no subagent verified the DD-2 prescription against `FormField.tsx` markup before the user was asked to choose. Both `screen.getByRole` and `getByLabelText` depend on accessibility associations; those were assumed present. | Gap: when a plan prescribes RTL accessibility queries (`getByRole`, `getByLabelText`, `getByText` on form fields), Verification / Full-Stack Trace subagent must read the actual label/input markup and confirm associations exist. |
| `truncate` without `min-w-0` on sm+ flex item | Pass 2 Scoped too narrowly — DD-7 considered truncation behavior in isolation without tracing how flex items with default `min-width: auto` interact with `overflow: hidden`. | Gap: Integration / Full-Stack Trace subagent checklist for Tailwind flex layouts should include the `min-w-0` caveat when `truncate` is applied to flex children. |
| DD-2 bullet missed caller + destructure + inline-query enumeration | Pass 2 fix applied at a high level (change strategy) without reading the full test to enumerate every touch point. | Gap: when a plan changes a test helper's signature, the fix-applying subagent should grep for all callers and unused bindings created by the change. |

### Skill Improvements Applied
| # | Finding | Subagent | Gap type | Change | Status |
|---|---|---|---|---|---|
| 1 | `truncate` without `min-w-0` on sm+ flex item | #1 Correctness | prompt_gap | Added Tailwind/CSS flex specifics block (truncate needs min-w-0, order requires flex parent, mixed order values reorder last) to subagent-prompts.md | Applied |
| 2 | Ambiguous index.html path | #4 Integration | prompt_gap | Added "Ambiguous bare filenames" checklist item for monorepos/nested workspaces | Applied |
| 3 | DD-2 helper-signature-change missed callers + destructures | #3 Ordering | prompt_gap | Added "Helper-signature-change sweep" bullet requiring enumeration of every caller, destructure, and inline usage | Applied |
| 4 | Portal modal breaks App.test.tsx container.querySelector | #5 Verification | prompt_gap | Added "DOM-boundary side effects" bullet for portal/Teleport/modal library introductions | Applied |
| 5 | ChoreTimerBar layout unit-coverage missing | #5 Verification | prompt_gap | Added "Per-step unit-test mapping" bullet requiring each restructure step be mapped to its unit test file | Applied |
| 6 | getByLabelText non-functional (FormField unassociated) | #5 Verification | scope_limitation | Expanded "What to read" to include component files whose markup prescribed RTL queries will match against | Applied |
| 7 | DD options non-viable across DD-2 P1, DD-2 P2, DD-7 P2 | shared (all subagents) | prompt_gap | Added shared rule "DD option viability" requiring each proposed option be verified against real source before presenting | Applied |
| 8 | Subagents under-read files fix depends on | shared (all subagents) | scope_limitation | Added shared rule "What-to-read is a floor, not a ceiling" requiring reads of dependent files not explicitly named in the plan | Applied |
| 9 | OverdueBadge sm:order-2 wrong visual order (Pass 2 miss) | #1 Correctness | no_skill_gap | Execution miss — "Do not trust plan assertions" rule already in place; Improvement 1's flex-order bullet adds defense-in-depth | Applied (via #1) |
