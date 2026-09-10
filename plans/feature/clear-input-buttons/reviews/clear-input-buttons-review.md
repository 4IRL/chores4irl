# Review: F14 — Clear-✕ affordance on every free-text input

## Review — 2026-09-10

### Summary
The plan is well-researched (all file/line/API/dependency claims independently
re-verified and correct), but Pass 1 found one critical bug in the plan's own prescribed
code (fails its own Step 1 test), one major ambiguity risking a silent visual bug in Step
4, and a major, unaddressed touch-target-size gap for a kiosk touchscreen app. All
mechanical findings have been applied directly to the plan. Four design decisions need
your input before the plan is ready.

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | FAIL | 0 critical, 2 major, 1 minor |
| 2 | Full-Stack Trace | PASS | 0 critical, 0 major, 1 minor |
| 3 | Ordering & Cleanup | PASS | 0 critical, 0 major, 1 minor |
| 4 | Integration & Conventions | FAIL | 0 critical, 1 major, 2 minor |
| 5 | Verification & Coverage | FAIL | 1 critical, 0 major, 3 minor |
| 6 | Completeness & Risk | FAIL | 0 critical, 1 major, 2 minor |

### Findings

#### Critical (must fix before proceeding)
- **[Step 1] `ClearButton`'s `onClick={onClear}` leaks the click `SyntheticEvent`, failing its own Step 1 test** _(Subagent #1, #5)_: `onClick={onClear}` invokes `onClear` with React's `SyntheticEvent` as its first argument, but the Red test's assertion (4) requires `onClear` to be called with **no arguments**. Implemented exactly as originally specified, the Green step's own "confirm it passes" claim was false — the test would keep failing. Downstream call sites (Steps 2–4) are unaffected since they already wrap `onClear` in a zero-arg arrow function. **Fixed:** changed to `onClick={() => onClear()}`.

#### Major (should fix)
- **[Step 4] Room field's `ClearButton` placement instructions were ambiguous, risking a silent absolute-positioning bug** _(Subagent #1)_: Steps 2/3 explicitly require the button to stay inside the `relative`-positioned wrapper; Step 4's wording for the Room field didn't repeat this constraint alongside its (correctly flexible) `<datalist>`-placement note, and no test in the plan would catch the button rendering in the wrong place if misread. **Fixed:** Step 4 now explicitly separates the two placement decisions and restates the `relative`-wrapper requirement for `ClearButton`.
- **[Step 1] `ClearButton`'s tap target (~24×24px) is well below this app's own 44×44px touch-target convention on a Pi-kiosk touchscreen app** _(Subagent #4, #6)_: `DateNavigationBanner.tsx`'s icon buttons use `min-w-[44px] min-h-[44px]`; the plan's `ClearButton` (`p-1`, `w-4 h-4` icon, no min-w/min-h) doesn't, and the plan's own "Refactor" verification bullet never checks sizing. **Design decision — see DD-1 below.**

#### Minor (nice to fix)
- **[Step 1/2/5] `aria-label` capitalization inconsistent across the three buttons** _(Subagent #2)_: `"Clear search"` (lowercase) vs. `"Clear Name"`/`"Clear Room"` (capitalized). **Fixed:** standardized to `"Clear Search"` everywhere (label text + all test query strings).
- **[Step 3] Step 3's Red bullet claimed TypeScript would reject the unknown `clearable` prop — inaccurate for this repo's non-type-checked Vitest/Vite pipeline** _(Subagent #3, #6)_: `vitest run`/`vite build` transform `.tsx` via esbuild with no `tsc` step. The runtime `getByRole` assertion (test 3) is the real, sufficient red signal. **Fixed:** reworded to describe the actual failure mode.
- **[Summary] Overstated "Details field ... is unaffected"** _(Subagent #1)_: Step 3's wrapper-div change lands on all 5 `FormField` call sites, including Details — behaviorally/visually inert (confirmed: no CSS depends on the input's flex-child position; existing tests use `getByLabelText(...).toHaveValue(...)`), but the Summary's blanket phrasing overstated it. **Fixed:** softened wording to clarify the harmless markup delta.
- **[Research Findings] Misattributed lucide-react convention to "this repo's Frontend Conventions"** _(Subagent #4)_: no such doc exists in this repo; the rule lives in the user's global `~/.claude/CLAUDE.md`. **Fixed:** reworded to cite the actual in-repo precedent (`DateNavigationBanner.tsx`, `ChoreTimerBar.tsx`) plus the global convention.
- **[Step 3] Dangling reference to a non-existent "Open risk (b) below" section** _(Subagent #4)_: no "Open risks" section exists elsewhere in the plan. **Fixed:** dropped the dangling parenthetical.
- **[Step 4] No test for the clear-✕ appearing immediately on mount in edit mode (pre-populated Name/Room, no typing)** _(Subagent #5)_: all three original Step 4 tests only exercised the "type then it appears" path. **Fixed:** added test (4), rendering `ChoreForm` in edit mode with a pre-populated `initialChore` and asserting both buttons are present with no `user.type` call first.
- **[Step 2] Whitespace-only search value: clear button visible while `App.tsx`'s trimmed filter is already effectively empty** _(Subagent #5)_: `ChoreSearchInput`'s visibility check (`value !== ''`) doesn't match `App.tsx`'s `searchQuery.trim().toLowerCase()` filter semantics for whitespace-only input. Not a functional bug (clicking still clears correctly). **Design decision — see DD-3 below.**
- **[Step 1] No keyboard-activation test for the clear button** _(Subagent #5)_: none of the plan's tests verify Tab+Enter/Space activation. Low risk (native `<button>`, matches existing `DateNavigationBanner` precedent, which also has no such test). **Design decision — see DD-4 below.**
- **[Step 1] Post-clear focus behavior left undecided** _(Subagent #6)_: clicking a button moves focus to it by default; since the button then unmounts (field is now empty), focus lands nowhere. No current test/behavior depends on this, but it's an unaddressed UX/a11y gap. **Design decision — see DD-2 below.**

### To-Do: Mechanical Fixes (auto-applied)
- [x] `ClearButton`'s `onClick={onClear}` → `onClick={() => onClear()}` _(applied directly to the plan — critical fix)_
- [x] Step 4 Room-field `ClearButton` placement reworded to explicitly require the `relative`-div wrapper _(applied directly)_
- [x] Standardized `"Clear search"` → `"Clear Search"` across all label strings and test queries _(applied directly)_
- [x] Step 3 Red bullet's TypeScript-rejection claim corrected to the actual (runtime-assertion) red signal _(applied directly)_
- [x] Summary's "Details ... unaffected" wording softened to describe the harmless markup delta _(applied directly)_
- [x] Research Findings' lucide-react citation corrected to the actual in-repo precedent _(applied directly)_
- [x] Dangling "Open risk (b) below" reference removed from Step 3 _(applied directly)_
- [x] Added Step 4 test (4): clear-✕ present immediately on mount in edit mode, no typing required _(applied directly)_

### Design Decisions (awaiting user input)

#### DD-1: [Step 1] `ClearButton` touch-target size on a Pi-kiosk touchscreen app
**Context:** This app's production target is a Raspberry Pi touchscreen kiosk (finger-touch, not mouse, per `README.md`). The codebase's one existing convention for a persistently-visible interactive icon button (`DateNavigationBanner.tsx`'s Previous/Next buttons) uses a 44×44px minimum tap target. The plan's `ClearButton` as specified has roughly a 24×24px tap target — about a quarter the area — with no minimum-size class at all, and sits directly adjacent to the text it's clearing (a near-miss tap risks landing in the input instead).

| # | Option | Trade-off |
|---|---|---|
| 1 | Add `min-w-[44px] min-h-[44px]` to `ClearButton` (matching `DateNavigationBanner`'s pattern), keep the visible icon at `w-4 h-4` centered inside the larger invisible tap target | Matches house convention and touch-target best practice; requires widening the reserved input padding (`pr-9` → `pr-11` or similar) and re-checking the `right-3` offset so the larger hit box doesn't visually collide with the input's border/rounded corner |
| 2 | Explicitly accept the smaller target as an intentional trade-off (document the rationale: the compact `~36–40px`-tall inputs can't fit a 44px button without overflowing above the label row) | No layout rework needed; a real usability regression on the kiosk touchscreen this app is built for, now at least a documented choice rather than an oversight |
| 3 | Increase the input height on the three affected fields (`py-2` → `py-3`) so a full 44px button fits without overflow | Keeps `ClearButton` fully consistent with `DateNavigationBanner`; larger diff, changes the visual height of `ChoreSearchInput`'s toolbar and all `FormField`/Room inputs (not just the clearable ones, unless scoped only to fields that opt in) |

**Chosen:** Option 1 — expand `ClearButton` to a 44×44px minimum tap target
(`min-w-[44px] min-h-[44px]`), keep the visible icon at `w-4 h-4`. Applied to Step 1's
`ClearButton` className, and the reserved padding on all three inputs updated from `pr-9`
to `pr-14` (56px = `right-3`'s 12px + the new 44px min-width) in Steps 2, 3, and 4.

#### DD-2: [Step 1] Post-clear focus behavior
**Context:** Clicking `ClearButton` moves DOM focus to it by default (browser behavior); since the field is now empty, the button unmounts on the next render, leaving focus nowhere (effectively `<body>`). No current test or app behavior depends on focus state, but this is an unaddressed UX/accessibility gap — the common pattern for an inline clear-✕ is to return focus to the now-empty input so the user can keep typing.

| # | Option | Trade-off |
|---|---|---|
| 1 | Leave default browser behavior (focus moves to the vanishing button, ends up on `<body>`) | No extra code; acceptable since nothing currently depends on focus, but is a minor UX rough edge for keyboard/screen-reader users |
| 2 | Have `onClear` refocus the associated input right after clearing (e.g. the caller passes a ref-based refocus callback alongside `onChange('')`) | Matches the common "clear-then-keep-typing" pattern; adds a small amount of ref-plumbing to all three call sites |

**Chosen:** Option 2 — refocus the input. Each of the three call sites (`ChoreSearchInput`,
`FormField`, `ChoreForm`'s Room field) now creates its own `useRef<HTMLInputElement>`,
attaches it to its own `<input>`, and calls `.focus()` on it from inside `onClear` right
after clearing the value. Applied to Steps 2, 3, and 4, each with a new
`toHaveFocus()`-based test.

#### DD-3: [Step 2] Whitespace-only search value: should the clear button's visibility match the trimmed filter?
**Context:** `ChoreSearchInput`'s clear-✕ visibility check is `value !== ''` on the raw value, but `App.tsx` filters using `searchQuery.trim().toLowerCase()`. Typing only spaces shows the clear button even though no filter is actually active. Not a functional bug — clicking still correctly empties the field.

| # | Option | Trade-off |
|---|---|---|
| 1 | Leave as-is: button shows whenever the raw field is non-empty, including whitespace-only | No test/code change; arguably still correct since the button's job is "clear whatever is typed" |
| 2 | Add an explicit test documenting/asserting the current (accepted) whitespace-only behavior | Locks in current behavior as intentional so a future refactor doesn't silently change it, without changing any production code |
| 3 | Change the visibility check to `value.trim() !== ''`, matching `App.tsx`'s filter semantics exactly, plus a test | Fully consistent semantics; small additional code + test |

**Chosen:** Option 1 — leave as-is. No plan change; the whitespace-only visibility
behavior is accepted as-is, undocumented by a dedicated test.

#### DD-4: [Step 1] Keyboard-activation test coverage
**Context:** None of the plan's tests verify the clear-✕ is reachable via Tab and activatable via Enter/Space. Risk is low — it's a native `<button type="button">`, keyboard-operable by default, and the existing `DateNavigationBanner` precedent has no such test either.

| # | Option | Trade-off |
|---|---|---|
| 1 | Leave uncovered, relying on native `<button>` semantics (matches existing repo convention) | No extra test; consistent with how the codebase already treats icon buttons |
| 2 | Add an explicit keyboard-activation test to `ClearButton.test.tsx` (`user.tab()` + `user.keyboard('{Enter}')`) | Defense-in-depth against a future implementation swapping the native `<button>` for something less accessible |

**Chosen:** Option 1 — leave uncovered. No plan change; relies on native `<button>`
keyboard semantics, consistent with the rest of the codebase's icon buttons.

---

### Verdict
[ ] Ready to proceed as-is
[ ] Proceed after minor fixes
[x] Requires changes before proceeding

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | Ordering subagent confirmed the plan is purely additive — no deletions, no dead imports, ESLint's `no-unused-vars` unaffected |
| Type annotations | [x] | Correctness subagent verified prop types (`ClearButtonProps`, `FormFieldProps`) against actual usage |
| Error handling (status codes, exceptions, user feedback) | [x] | N/A — no backend/HTTP surface; full-stack-trace subagent confirmed no separate validation-error state needs resetting |
| Test coverage (happy path, sad path, edge cases) | [x] | Verification subagent found and we fixed one real gap (edit-mode-at-mount); whitespace/keyboard edge cases surfaced as DDs |
| Breaking changes (API contracts, shared state, DB schema) | [x] | Completeness subagent re-verified sole-caller claims for `FormField`/`ChoreSearchInput`/Room block via independent grep |
| Config consistency (env vars, requirements pins, lint rules) | [x] | Integration subagent confirmed no CI/config changes needed; Vitest auto-discovers new `*.test.tsx` files |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | Integration subagent checked against global `~/.claude/CLAUDE.md` and in-repo component/test placement conventions |

---

## Review — 2026-09-10 (Pass 2)

### Summary
Pass 2 re-verified Pass 1's fixes and the DD-1/DD-2 edits: all held up correctly (the
`pr-14` math, `useRef` wiring, `onClick={() => onClear()}` fix, and Room-field placement
rule all check out against the real source). Pass 2 also found one new **major** issue
that Pass 1 couldn't have caught — DD-1's larger touch target, evaluated in isolation in
Pass 1, turns out to collide with `FormField`'s specific `gap-1` label spacing once
checked against the real layout — plus three minor documentation-accuracy nits (all
fixed).

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | PASS | 0 critical, 0 major, 1 minor |
| 3 | Ordering & Cleanup | PASS | 0 critical, 0 major, 2 minor |
| 5 | Verification & Coverage | PASS | 0 critical, 0 major, 2 minor |
| 6 | Completeness & Risk (+ Integration delta) | FAIL | 0 critical, 1 major, 0 minor |

*(Subagent #2 Full-Stack Trace and #4 Integration were not re-run in Pass 2 — Pass 1 found
them clean with only a cosmetic finding already fixed, and this pass's edits don't touch
their review area beyond what #6 absorbed.)*

### Findings

#### Major (should fix)
- **[Step 3, Step 4] DD-1's 44px `ClearButton` has ~0px clearance from the label above it in `FormField`/Room, risking accidental field-clear on a near-miss tap** _(Subagent #6)_: `FormField`'s/Room's wrapper is `flex flex-col gap-1` (a 4px label–input gap); the input renders ~36px tall (`py-2 text-sm`, no border); `ClearButton`'s `min-h-[44px]`, vertically centered via `top-1/2 -translate-y-1/2` on that 36px box, overflows ~4px above the input's top edge — exactly consuming the label–input gap with zero clearance. `ChoreSearchInput` is **not** affected (no `<label>` above it; `aria-label` only). No test in this Vitest/jsdom suite can catch this (no real layout computed). **Design decision — see DD-5 below.**

### To-Do: Mechanical Fixes (auto-applied)
- [x] Step 2's `useRef` import instruction dropped the inapplicable "(or extend the existing React import)" parenthetical — `ChoreSearchInput.tsx` has no existing `'react'` import _(applied directly)_
- [x] Step 2's Red bullet corrected: only 2 of 3 new assertions genuinely fail pre-Green (test (1) is a trivially-passing regression guard) _(applied directly)_
- [x] Step 4's Red bullet corrected: only 4 of 5 new tests genuinely fail pre-Green (test (3), the Details regression guard, passes trivially both before and after Green) _(applied directly)_

### Design Decisions (awaiting user input)

#### DD-5: [Step 3, Step 4] `ClearButton`'s 44px height overflows into the label–input gap
**Context:** DD-1 (Pass 1) gave `ClearButton` a 44×44px minimum tap target to fix a touch-accessibility gap. Pass 2 found that in `FormField`/Room specifically (unlike the search bar, which has no label), the button's height now overflows into the 4px `gap-1` between the field's label and its input, with zero clearance — a near-miss tap there would clear the field instead of doing nothing.

| # | Option | Trade-off |
|---|---|---|
| 1 | Widen the label–input gap from `gap-1` (4px) to `gap-2` (8px)+ in both `FormField` and the Room block | Simple, one class change per wrapper; but widens vertical spacing for **all** `FormField` instances, including the 4 non-clearable fields — a small visual change beyond this feature's scope |
| 2 | Keep `gap-1`; stop centering `ClearButton` symmetrically (`top-1/2 -translate-y-1/2`) and instead let its ~8px of unavoidable overflow (44px button vs. ~36px input) extend only downward, into the `gap-3` between form fields, which has room | No change to the shared label-gap convention; the button is no longer pixel-perfectly centered on the input (imperceptible in practice) |
| 3 | Accept the overlap as a documented trade-off of DD-1's touch-target decision — no code change | Keeps DD-1 exactly as specified; re-opens (in a new spot) the same category of touch-accessibility risk DD-1 was meant to close |

**Chosen:** Option 2 — push the overflow downward only. Implemented via a new `anchor?:
'center' | 'top'` prop on `ClearButton` (default `'center'`, using `top-1/2
-translate-y-1/2`, unchanged for `ChoreSearchInput`, which has no label collision).
`FormField` and the Room field now pass `anchor="top"` (`top-0`, no translate), confining
the 44px box's ~8px overflow entirely below the ~36px input, into the inter-field
`gap-3` space rather than the 4px label gap above. Applied to Steps 1, 3, and 4, with new
`ClearButton.test.tsx` assertions (6)/(7) covering both anchor modes.

---

## Review — 2026-09-10 (Pass 3, final — hard cap)

### Summary
Pass 3 re-verified DD-5's `anchor="top"` fix pixel-by-pixel against the real source: the
overflow math checks out exactly (0px above / 8px below / +4px net clearance to the next
field, positive but thin) and every call site, prop name, and test count is internally
consistent — 0 findings from the correctness+ordering pass. The verification+completeness
pass found one real, still-open gap: no test verified that `FormField`/`ChoreForm`
actually thread `anchor="top"` through to `ClearButton` (the one integration point DD-5's
whole fix depends on) — a silent future regression there would reintroduce Pass 2's
collision with nothing catching it. Both findings were mechanical and have been applied
directly. This is Pass 3, the hard cap — no further passes run regardless of outcome, but
in this case there is nothing left needing another pass: both findings are resolved.

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1+3 | Correctness & Ordering (combined) | PASS | 0 critical, 0 major, 0 minor |
| 5+6 | Verification & Completeness (combined) | FAIL | 0 critical, 1 major, 1 minor |

### Findings

#### Major (should fix)
- **[Step 3, Step 4] No test verified `FormField`/Room actually pass `anchor="top"` to `ClearButton`** _(Subagent #5+6)_: Step 1's `ClearButton.test.tsx` verified both anchor modes in isolation, but nothing at the `FormField`/`ChoreForm` integration layer checked that `anchor="top"` is the prop value actually threaded through in practice — a dropped prop there would silently fall back to `ClearButton`'s default centered anchoring and reintroduce Pass 2's label-overlap collision, undetected by any test in the plan. **Fixed:** added `className` assertions (`toContain('top-0')`, not `top-1/2`) to `FormField.test.tsx` test (3) and `ChoreForm.test.tsx` tests (1) and (2), at the exact points those tests already locate each button via `getByRole`.

#### Minor (nice to fix)
- **[Step 3, Step 4] DD-5's net clearance to the next field (~4px) wasn't stated explicitly** _(Subagent #5+6)_: re-verified against the real source — positive, not an overlap, but thin on a touchscreen kiosk where the next field's label is itself clickable. **Fixed:** added one sentence to Step 1's `anchor` explanation stating the exact computed clearance and naming it an accepted, untested trade-off.

### To-Do: Mechanical Fixes (auto-applied)
- [x] Added `className` assertions confirming `anchor="top"` threading in `FormField.test.tsx` test (3) and `ChoreForm.test.tsx` tests (1)/(2) _(applied directly)_
- [x] Added an explicit sentence documenting the ~4px net clearance to the next field as an accepted, untested trade-off _(applied directly)_

### Verdict
[x] Ready to proceed as-is (after Pass 3's mechanical fixes)
[ ] Proceed after minor fixes
[ ] Requires changes before proceeding

Pass 3 is the hard cap (3 of 3). Both of this pass's findings were mechanical and fixed
directly — no design decisions remain open, and no `### Resolve During Implementation`
section is needed. The plan is ready for `run-plan`.

---
