# Push Review: feature/translucent-add-deck

## Review 1
Generated: 2026-09-18 08:48
Comparison: origin/main (e488e28)...HEAD (9a02241)
Verdict: **PUSHED WITH MINOR FINDINGS**

### Results by Reviewer

#### 1. Safety & Security — PASS
Pure CSS/JSX restructuring plus tests and plan docs; no input handling, dynamic HTML, secrets or destructive ops.

#### 2. Correctness — PASS
Deck is the scroll region's `lastElementChild` in both `ChoreList` branches (JSX comments compile away); `AddChoreButton.test.tsx` regex matches the new opaque class and rejects the old `/50` form; `App.search.test.tsx`'s `.overflow-y-auto` containment assertions still hold; correctly no z-index (the `chore-bar` inline-transform stacking-context trap).

#### 3. Simplicity & Conciseness — PASS
Tight, proportionate diff; one justified explanatory JSX comment.
- minor — `frontend/src/__tests__/components/AddChoreButton.test.tsx:11`: `not.toContain('bg-blue-500/')` is redundant with the `toMatch(/(^|\s)bg-blue-500(\s|$)/)` on line 10 (the regex already rejects `bg-blue-500/50`).

#### 4. Test Coverage — PASS
Both new tests cover every changed class token and the last-child precondition; real-browser layout check appropriately kept out of committed e2e per META-PLAN F5 scope.
- minor — `frontend/src/__tests__/App.test.tsx` (new `Add Task deck (F5)` describe): the scroll region's `flex flex-col` (which `mt-auto` pinning depends on) is not asserted; a refactor dropping it would pass CI.

#### 5. Completeness & Cleanup — PASS
No debug artifacts or stale comments; JSX comment's `scroll-pb-24` matches the class; plan `finished: true` consistent with all checkboxes.

#### 6. Consistency & Style — PASS
JSX comment idiom, `data-testid` kebab-case, `describe('… (F5)')`, multi-line attribute layout and regex-assertion style all match precedent.

#### 7. Integration Risk — PASS
No API/DB/config changes; `.overflow-y-auto`, e2e locators, swipe/focus paths, overlays' z-index and the overflow chain all unaffected. Sibling F4 branch has zero file overlap except `plans/META-PLAN.md`, where each edits its own ledger row.
- minor — `plans/META-PLAN.md` ledger: F4/F5 rows are adjacent; auto-merge is clean but confirm both rows' final status at Phase C fold-back.

#### 8. Error Handling & Silent Failures — PASS
Only pattern in scope is the guarded `scrollRegion!` in the new tests — `expect(scrollRegion).not.toBeNull()` precedes it, giving a named failure point.

### To-Do: Required Changes

- [ ] **Remove the redundant `not.toContain('bg-blue-500/')` assertion** — `frontend/src/__tests__/components/AddChoreButton.test.tsx:11` — the `toMatch(/(^|\s)bg-blue-500(\s|$)/)` on line 10 already rejects the alpha-suffixed form; drop line 11 and its comment, or keep it only if the exact-token guard is wanted for readability.
- [ ] **Assert the scroll region is a flex column in the deck tests** — `frontend/src/__tests__/App.test.tsx`, both tests in `describe('Add Task deck (F5)')` — add `expect((scrollRegion as HTMLElement).className).toContain('flex')` and `.toContain('flex-col')` next to the existing `scroll-pb-24` assertion, so `mt-auto`'s precondition is guarded.
- [ ] **Confirm F4 and F5 ledger rows after merge** — `plans/META-PLAN.md` Status ledger — at Phase C fold-back, verify the adjacent F4 and F5 rows both carry their correct final state (no action before merge).

## Review 2
Generated: 2026-09-19 09:20
Comparison: origin/feature/translucent-add-deck...HEAD (`dc96d65`, `f044147` — post-Pi-verification deck-edge fade)
Verdict: **PUSHED WITH MINOR FINDINGS** (Simplicity's single "major" refuted — see below)

### Results by Reviewer

#### 1. Safety & Security — PASS
Pure CSS/JSX styling change; no input, network, secrets, or injection surface touched.

#### 2. Correctness — PASS
Sticky deck is a valid containing block for the absolute backing; overhang/mask math (4rem fade, opaque over the deck body) is sound; backing-first + positioned button wrapper gives the intended paint order; scroll-pb-40 (160px) clears 81px + 64px with margin; test assertions match their comments.

#### 3. Simplicity & Conciseness — FAIL (refuted → treated as PASS)
- *major (refuted)* — `App.tsx:351`: replace the arbitrary `[mask-image:linear-gradient(to_bottom,transparent,black_4rem)]` with Tailwind v4.1's `mask-t-from-0% mask-t-to-16`. **Verified against the project's Tailwind 4.1.18 via `compile()`:** `mask-t-*` composes `linear-gradient(to top, black <from>, transparent <to>)`, so the suggested pair emits `black 0%, transparent 4rem` measured from the *bottom* — it keeps only the bottom 4rem opaque and masks out the deck body, the inverse of the intent. The only equivalent built-in is `mask-t-from-[calc(100%-4rem)]`, which emits a 4-layer `mask-composite: intersect` stack plus ~10 `--tw-mask-*` custom properties — not simpler than the one-line arbitrary property. Not applied.
- *minor* — `App.tsx:353-355`: drop the `relative` wrapper by giving the backing `-z-10`. Not applied: with no stacking context on the deck, a negative z-index paints the backing behind the *scroll region's* in-flow chore bars (invisible where bars are); forcing a context via `isolate` changes the backdrop-root situation that the on-Pi verification was done against. Recorded as a follow-up to evaluate, not a change to make blind.

#### 4. Test Coverage — PASS
- *minor* — `App.test.tsx`: backing's `inset-x-0`/`bottom-0` not asserted (only `-top-16`).
- *minor* — the three coupled magic numbers (`-top-16`, `black_4rem`, `scroll-pb-40`) are asserted independently; nothing ties them together.

#### 5. Completeness & Cleanup — PASS
- *minor* — `App.test.tsx:718` comment said "deck" where the assertion now targets the backing. **Fixed in this push.**

#### 6. Consistency & Style — PASS
Follows kebab-case testids, `aria-hidden` decorative-layer + DOM-order stacking comments (precedent `ChoreTimerBar.tsx`), bracket-arbitrary values (precedent `TouchLockIndicator.tsx`).

#### 7. Integration Risk — PASS
e2e selectors are role/text-based and unaffected; `add-task-deck` testid unchanged; build emits `-webkit-mask-image`/`mask-image` and `-webkit-backdrop-filter`/`backdrop-filter`; META-PLAN F5 Expected-end-state bullets still hold.
- *minor* — plan doc's Run-1/Run-2 "verified" facts (`scroll-pb-24`/81px math, pixel rects) predate this tweak. **Fixed in this push** (dated addendum appended after Run 2).

#### 8. Error Handling & Silent Failures — PASS
- *minor* — `App.test.tsx`: `button.parentElement!` lacked a `not.toBeNull()` guard matching the `scrollRegion` pattern. **Fixed in this push.**

### To-Do: Required Changes

- [ ] **Assert the backing's full extent** — `frontend/src/__tests__/App.test.tsx` ('Add Task deck (F5)' first test) — add `expect(backing.className).toContain('inset-x-0')` and `.toContain('bottom-0')` beside the `-top-16` assertion so a dropped edge fails a test.
- [ ] **Tie the overhang/mask/scroll-padding numbers together** — `frontend/src/__tests__/App.test.tsx` — derive the three from one constant in the test (e.g. `const OVERHANG_REM = 4` → `-top-${OVERHANG_REM*4}`, `black_${OVERHANG_REM}rem`, and assert `scroll-pb-N` with `N*4 >= 81/4 + OVERHANG_REM*4`), or add one comment-linked assertion block, so editing one without the others fails.
- [ ] **Evaluate removing the `relative` button wrapper** — `frontend/src/App.tsx` deck markup — only if `isolate` on the deck plus `-z-10` on the backing is re-verified on the Pi kiosk to still blur the list beneath (isolation may change the backdrop root); otherwise keep the wrapper.
