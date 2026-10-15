# Review: Permissive touch lock (F20)

## Review — 2026-09-24

### Summary
The plan is structurally sound. The UI event-chain trace found no path where a destructive request (PATCH complete, PUT edit, DELETE) fires while locked, and every step's ordering holds. One critical break needed fixing: Step 1's `INACTIVITY_MS` import crashes `App.lockViewReset` under its partial `vi.mock` (reproduced in-repo by five reviewers). Four majors were fixed too: the full-bleed test loop, `isClosing` left write-only, the fake-timer ordering, and the locked-Add test. Also found: a stale Standing invariant 12, plus a set of overlay-behavior design decisions. Mechanical fixes are applied; the design decisions are below.

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | FAIL | 0 critical, 2 major, 6 minor |
| 2 | Full-Stack Trace | PASS | 0 critical, 0 major, 4 minor |
| 3 | Ordering & Cleanup | FAIL | 0 critical, 2 major, 5 minor |
| 4 | Integration & Conventions | FAIL | 0 critical, 1 major, 9 minor |
| 5 | Verification & Coverage | FAIL | 1 critical, 3 major, 6 minor |
| 6 | Completeness & Risk | FAIL | 0 critical, 3 major, 9 minor |

Deduplicated: **1 critical, 5 major, 25 minor**.

### Findings

#### Critical (must fix before proceeding)
- **[Step 1] Importing `INACTIVITY_MS` into `App.lockViewReset` crashes the whole file** _(Subagents #1, #3, #4, #5, #6)_: the file's `vi.mock('../hooks/useTouchLock')` factory returns only `{ useTouchLock }`, and Vitest throws `No "INACTIVITY_MS" export is defined on the … mock`. Reproduced in-repo. **Fixed:** the factory now spreads `...actual`.

#### Major (should fix)
- **[Step 3] NavBar `pl-14 pr-4` also fails the full-bleed test's inset-row loop** `/\b(px|mx)-4\b/` at `App.test.tsx:~949` _(#1, #5)_. **Fixed:** NavBar is excluded from that loop.
- **[Step 4] `isClosing` is necessarily write-only after Step 4**, which fails the error-level `no-unused-vars` rule (reproduced) _(#1, #3, #5, #6)_. **Fixed:** its removal is now required, and `handleArm`'s timer clears `lockAttempt`.
- **[Step 4] The "no second tap" test never said to click the bar after `vi.useFakeTimers()`** _(#2, #5, #6)_. **Fixed.**
- **[Step 4] The locked Add-submit test reused the default `makeChore()` (a duplicate id) and submitted with filters still active** _(#1, #5)_. **Fixed.**
- **[Step 6] Standing invariant 12 still says NavBar is `px-4`** _(#4, #6)_. **Fixed:** a to-do was added.
- **[Step 4] The full-viewport overlay swallows every tap during the window, and a far tap restarts it** _(#6)_. → DD-1.

#### Minor (nice to fix)
Mechanical, all applied:
- `showCenteredPadlock` deletion (a TS2367 risk).
- The full 4-field mock shape.
- Expected-zero `grep -c` gates now carry `|| true`.
- Step 6 gate wording about the plan file.
- "From the repo root" on the lint/tsc lines.
- Invariant 19's `isRepullGated` sentence.
- The F2-contract note on the gutter's `F15` coupling.
- Explicit generics.
- Scroll-to-top anchor and stub.
- Vertical-drag coordinates.
- Partial-drag `stubBarWidth` plus the transform assertion.
- sr-only `onEdit`.
- Scoped icon queries.
- Stale overlay `Step 4`/`isClosing` comments.

Design decisions: DD-2 … DD-13.

### Verification Gaps
- **Step 1**: no assertion that activity while locked leaves `isLocked` true (DD-9).
- **Step 3**: the *All*-tab ↔ indicator geometry is checked only by className (DD-10).

### To-Do: Mechanical Fixes (auto-applied)
All applied inline by the orchestrator. The 18 fixes all edit one plan file, and parallel per-fix subagents would race on it. Each old anchor was asserted unique before the replacement.
- [x] Step 1: spread `...actual` in the `App.lockViewReset` useTouchLock mock factory, and update the stale comment.
- [x] Step 1/4: `useState<number>(0)` / `useRef<number>(0)`.
- [x] Step 2: vertical-drag coordinates repeat `clientX`.
- [x] Step 2: partial drag uses `stubBarWidth` and asserts `translateX(0px)` with no reveal layer.
- [x] Step 2: sr-only test renders with `onEdit`.
- [x] Steps 2–5: lint/tsc run "from the repo root".
- [x] Step 3: exclude NavBar from the full-bleed inset loop.
- [x] Step 4: delete `showCenteredPadlock` and unwrap its guard.
- [x] Step 4: rewrite the stale overlay comments, and keep the exhaustive-deps disable.
- [x] Step 4: `isClosing` removal required; `handleArm` timer clears `lockAttempt`; `(g)` retitled, with the click after the fake timers.
- [x] Step 4: no-second-tap ordering.
- [x] Step 4: locked search/room/day/Add sub-bullets made concrete (distinct `Vacuum` chore, filters cleared first, real labels).
- [x] Step 4: scroll-to-top anchor `~:827-850` and a local `scrollTo` stub.
- [x] Step 4: full 4-field mock shape; scoped icon queries (Vitest + smoke).
- [x] Steps 4/5/7: `|| true` on expected-zero `grep -c` (Step 4's also covers `isClosing`).
- [x] Step 6: plan-file wording in the working-tree gate.
- [x] Step 6: invariant 19 `isRepullGated` sentence; new invariant 12 to-do; F2 contract gutter/`F15` note.

### Design Decisions (resolved)

#### DD-1: [Step 4] A tap far from the blocked tap while the padlock is up
**Context:** The overlay is `fixed inset-0`, so for 1.5 s after a blocked attempt it swallows every tap. A tap more than 60 px away re-seeds and restarts the window, so repeated taps elsewhere keep the padlock up.

| # | Option | Trade-off |
|---|---|---|
| 1 | Far tap dismisses the overlay (the tap is still swallowed) | The board returns immediately; changes the ">60 px" unit test and the mixed keyboard test |
| 2 | Keep re-seed; document and manual-check it | As today's F2; the padlock can linger |

**Chosen:** Option 2 — Keep re-seed; document (Decision (d), invariant-9 text in Step 6, Manual check; pinned by the >60 px unit test).

#### DD-2: [Step 4] Instant hide vs fade after the window
| # | Option | Trade-off |
|---|---|---|
| 1 | Instant hide; record the deviation from META-PLAN's "fades" | Simplest; matches today's revert |
| 2 | Fade (reuse `duration-[400ms]`, pointer-events-none), then dismiss | Matches the spec wording; more code and timing in the tests |

**Chosen:** Option 2 — Fade: new `'dismissing'` phase (`opacity-0 pointer-events-none`, `duration-[400ms]`, taps ignored), `onDismiss` at 1500 + `CLOSING_SETTLE_MS` ms.

#### DD-3: [Step 4] Indicator unlock while an attempt overlay is up (keyboard only)
| # | Option | Trade-off |
|---|---|---|
| 1 | `onUnlock` also clears `lockAttempt` (+ test) | No stray padlock over an unlocked board |
| 2 | Accept; it auto-dismisses within 1.5 s | Less code |

**Chosen:** Option 1 — main-branch indicator `onUnlock={handleIndicatorUnlock}` (`arm()` + `setLockAttempt(null)`), + App.touchLock test.

#### DD-4: [Step 4] Stale closing timer clears a newer attempt
| # | Option | Trade-off |
|---|---|---|
| 1 | `handleGuardedAttempt` cancels the pending closing timer first | One line |
| 2 | The timer clears only the armed attempt's id | More precise, slightly more code |
| 3 | Accept (a 400 ms window) | — |

**Chosen:** Option 3 — Accept; recorded in Decision (d).

#### DD-5: [Step 3] The now-interactive `z-[80]` indicator sits over the modal backdrops
| # | Option | Trade-off |
|---|---|---|
| 1 | Accept and document (a manual lock closes the modals) + manual check | Consistent with Open risk (b) |
| 2 | Lower the indicator below the modals (e.g. `z-40`) | A backdrop tap cancels as before; touches invariant 14's z-ladder |

**Chosen:** Option 2 — Lower the indicator to `z-40` (below the `z-50` modal backdrops), + unit assertion + manual check; invariant 14 does not name the indicator, so only invariant 9 records it.

#### DD-6: [Step 4] Overlay focus hand-back
| # | Option | Trade-off |
|---|---|---|
| 1 | Restore the previously focused element on unmount (+ test) | Better keyboard a11y |
| 2 | Accept the focus drop (touch kiosk) and note it under (g) | Less code |

**Chosen:** Option 1 — Restore the previously focused element on unmount, + overlay test.

#### DD-7: [Step 2] Day simulation vs lock precedence
| # | Option | Trade-off |
|---|---|---|
| 1 | State "simulation wins"; add a test; leave the sr-only pills guarded by the lock only | Documents today's asymmetry |
| 2 | Same, and the sr-only pills also return first on `isSimulating` | Consistent paths; changes unlocked-simulating keyboard behavior |

**Chosen:** Option 1 — "Simulation wins" recorded in Decisions; ChoreTimerBar test added; sr-only pills stay lock-guarded only.

#### DD-8: [Step 4] Smoke keeps the post-unlock PATCH /complete assertion
| # | Option | Trade-off |
|---|---|---|
| 1 | Keep it (as the old F2 smoke did) | Real-browser proof the guard releases |
| 2 | Drop it (jsdom + manual cover it) | No shared-DB write |

**Chosen:** Option 1 — Keep the post-unlock PATCH /complete assertion in the smoke.

#### DD-9: [Step 1] Unit-assert that activity while locked never unlocks
| # | Option | Trade-off |
|---|---|---|
| 1 | Add `isLocked` true assertions after the dispatched events | Cheap, direct |
| 2 | Rely on the smoke's indirect coverage | — |

**Chosen:** Option 1 — `isLocked` true assertions after each dispatched event.

#### DD-10: [Step 4] Smoke geometry: the *All* tab is clear of the indicator
| # | Option | Trade-off |
|---|---|---|
| 1 | Add a `boundingBox` assertion to the smoke | A real layout check |
| 2 | Manual check only | — |

**Chosen:** Option 1 — `boundingBox` assertion in the smoke (at a 768 px viewport so it is not vacuous).

#### DD-11: [Orchestrator note] Per-step Playwright scope
| # | Option | Trade-off |
|---|---|---|
| 1 | The full suite, sibling-safe (`env -u … CI=1 npx playwright test`) | F18/F22 specs run after every step |
| 2 | Keep smoke-only per step; the full specs run at Step 7 | Faster |

**Chosen:** Option 2 — Keep smoke-only per step; the full specs run at Step 7 (no plan change).

#### DD-12: [Step 6] F19 follow-up (a) and invariant 19's flicker sentence describe a deleted backdrop
| # | Option | Trade-off |
|---|---|---|
| 1 | Rewrite both in Step 6 (the reset now runs on an unobscured board) | META-PLAN self-consistent |
| 2 | Leave them to Phase C with a note | Smaller diff |

**Chosen:** Option 1 — Rewrite F19 follow-up (a) and invariant 19's flicker sentence in Step 6.

#### DD-13: [Step 6] How the rewritten F2 section signals to Phase C that it holds F20's contract
| # | Option | Trade-off |
|---|---|---|
| 1 | Keep the `## F2 — …` header; the text says "this section is F20's kept contract; Phase C adds no separate F20 entry" | Minimal |
| 2 | Retitle to `## F2/F20 — …` and sweep the cross-references | Greppable; more edits |

**Chosen:** Option 1 — Keep `## F2 — …`; header says this section *is* F20's kept contract and Phase C adds no separate F20 entry.

---

### Verdict
[ ] Ready to proceed as-is
[ ] Proceed after minor fixes
[x] Requires changes before proceeding

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | #3: `isClosing`, `showCenteredPadlock`, `CLOSING_SETTLE_MS` consumers, `TapPoint` type export |
| Type annotations | [x] | #1: `TapPoint`, the hook return type, mock inferred types |
| Error handling (status codes, exceptions, user feedback) | [x] | #2: no destructive request path while locked; toast behavior unchanged |
| Test coverage (happy path, sad path, edge cases) | [x] | #5: every prescribed query checked against real markup |
| Breaking changes (API contracts, shared state, DB schema) | [x] | #6: F15/pi-kiosk contract, invariants 9/12/19 |
| Config consistency (env vars, requirements pins, lint rules) | [x] | #4: eslint `no-unused-vars` error-level; skill-config Playwright commands |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | #4: generics, comment style, 44 px convention |

## Review — 2026-09-24 (Pass 2)

### Summary
Clean on severity: **0 critical, 0 major**. All six reviewers PASS. Every Pass-1 fix and DD-1..DD-13 was re-verified against the source (in-repo scratch tests for the fade chain, focus restore and the leaked-timer check). The remaining items are minors: 18 mechanical fixes (applied) and 9 design decisions (below). This is the final pass (early exit).

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | PASS | 0 critical, 0 major, 6 minor |
| 2 | Full-Stack Trace | PASS | 0 critical, 0 major, 2 minor |
| 3 | Ordering & Cleanup | PASS | 0 critical, 0 major, 5 minor |
| 4 | Integration & Conventions | PASS | 0 critical, 0 major, 6 minor |
| 5 | Verification & Coverage | PASS | 0 critical, 0 major, 8 minor |
| 6 | Completeness & Risk | PASS | 0 critical, 0 major, 6 minor |

### To-Do: Mechanical Fixes (auto-applied, inline by the orchestrator)
- [x] Step 4: the Boundaries test is named as the replacement for the inverted `exactly 1500ms` test.
- [x] Step 4: rewrite or delete the stale `Entrance animation hand-off` and `shrink-back timeout` comments.
- [x] Decision (d) + invariant 9: during `'dismissing'`, taps pass through to the still-locked board (a bar tap re-raises the padlock) and keys are ignored. A Manual-check sentence was added.
- [x] Step 4 smoke: bound the gap between the two taps with `waitForTimeout(250)`, and cancel via the `Cancel` button with a closed-state assertion.
- [x] Step 6: the working-tree gate uses `git status --porcelain` (untracked files would slip past `git diff`).
- [x] Step 6: add a META-PLAN content gate (four stale phrases → 0, `pl-14` ≥ 3; dry-run pre-edit gives 1/1/1/1/0).
- [x] Step 3: the intro notes the indicator's unlock path is unreachable in a browser until Step 4.
- [x] Step 2: `ChoreList.tsx` imports `TapPoint`.
- [x] Step 6: invariant 9's closing "no longer only an inert gate" sentence; invariant 19 / F19 contract test counts 6→9; "two remaining features" → `F15`; the REMAINING FEATURES preamble clause.
- [x] Step 6: the F2-contract gutter-revert obligation names all three pin sites.
- [x] Step 6: the README bullet keeps "Locking also returns the view" (matches its own gate).
- [x] Step 7: the final report and Completion summary carry an "Intended deviations from META-PLAN § F20" line for `/run-feature` Phase A step 8.
- [x] Step 1: the unmount-while-locked test also asserts `vi.getTimerCount() === 0`.
- [x] Step 4: the locked scroll-to-top test asserts no `[inert]` ancestor.
- [x] Step 4: the locked search/room test loads two chores (`Sweep`/Kitchen, `Dust`/Bathroom) with concrete assertions.
- [x] Steps 1–2: the Red expectations note which new tests may already pass.

### Design Decisions (Pass 2)
- **DD-14** [Step 4] Idle engage: the edit modal and ConfirmDialog stay clickable for one passive-effect gap. Options: gate both in JSX on `!isLocked` / accept. **Chosen:** Gate both in JSX — Step 4 Green: `{!showForm && !isLocked && editingChore && (` and `{pendingChore && !isLocked && (` (verified against `App.tsx:433`/`:442`); the force-close effect still clears the state; the Add form stays ungated. Recorded in Decision (c) and invariant 9; the existing `(e)` auto-dismiss tests cover it.
- **DD-15** [Step 4] Focus restore can steal focus the user moved elsewhere (Add autoFocus, Tab to the indicator, re-keyed remount). Options: guarded restore (only when focus is still on the overlay or body) + test / accept + note. **Chosen:** Guarded restore — the mount effect captures `const node = overlayRef.current;`; cleanup restores only if `document.activeElement` is `null`/`body`/`node` and `previouslyFocused?.isConnected`. New overlay test `does not steal focus if it moved elsewhere before unmount`; Decision (g) and invariant 9 updated. Verified in-repo (`frontend/src/__tests__/_scratch.test.tsx`, `npx vitest run`, 3/3 pass incl. `<StrictMode>` double-mount; scratch deleted).
- **DD-16** [Step 4] META-PLAN hands F20 a "success toast for an add made while locked" test. Options: assert `Added "Vacuum"` / drop the promise in Step 6. **Chosen:** Assert it — Step 4's locked Add sub-bullet adds `expect(await screen.findByText('Added "Vacuum"')).toBeInTheDocument()` (`handleAddChore` → ``showToast('success', `Added "${created.name}"`)``; `Toast` renders the message as `<span>` text).
- **DD-17** [Step 1] Add a pre-flight `git status --porcelain` gate before the first `git add .` commit. Options: add / no gate. **Chosen:** Add — a first Step 1 pre-flight box: `git status --porcelain | grep -vE '<allowed>' || true` must print nothing (allowed: ` M plans/META-PLAN.md`, anything under `plans/feature/permissive-lock/`, and on a partial Step 1 re-run the three Step 1 files), else the canonical `UNRESOLVED … unexpected files in working tree (…)` stop before any edit. Dry-run on the current tree prints nothing (exit 0); unexpected/zero-match paths simulated.
- **DD-18** [Step 4] Smoke: add a real-browser locked swipe. Options: add / tap-only. **Chosen:** Add — Step 4 smoke: DELETE listener + `swipeBar(page, firstChoreBar, 'right')` while locked → no DELETE, `confirm-dialog-confirm` not visible, overlay visible; then `fastForward(1600)` + `fastForward(500)` → overlay count 0 before the tap sequence. (A single `fastForward(2000)` would not fire the chained `onDismiss`: Playwright's `_innerFastForwardTo` fires due timers at the target time, so a timer scheduled by a callback lands past it.)
- **DD-19** [Step 4] Smoke: prove DD-5 (a corner tap over the Add backdrop cancels, doesn't toggle). Options: add / className + manual only. **Chosen:** Add — the smoke's Add-Task step cancels with `page.mouse.click(30, 30)` over the backdrop (indicator box 8–52 px): backdrop count 0, scoped closed icon still visible, no POST. The DD-10 `setViewportSize(768×720)` + geometry check moves first, so every coordinate is taken at 768 px (card wrapper x 160–608, so (30, 30) is bare backdrop; `ChoreFormModal` cancels only on `target === currentTarget`). Supersedes the Pass-2 mechanical "cancel via the Cancel button" wording.
- **DD-20** [Step 4] The Step 4 executor runs the smoke it rewrote. Options: run it (with port-conflict stop) / leave to §2c. **Chosen:** Run it — appended to Step 4's final to-do: `env -u PLAYWRIGHT_BASE_URL CI=1 npx playwright test e2e/smoke.spec.ts` from the repo root, with the ~30 s-jitter / ~10 min port-conflict retry, the canonical `Playwright ports 3000/5174 occupied …` stop, and never kill/drop `CI=1`/edit the config.
- **DD-21** [Step 4] A third tap within 400 ms of the unlock falls through the `'opening'` overlay and completes the chore. Options: accept + document / swallow taps during `'opening'`. **Chosen:** Swallow taps during `'opening'` — root className keeps `pointer-events-none` only for `'dismissing'`; the qualifying-tap test asserts no `pointer-events-none` and `onArm` stays 1 after a further click; opening-guard test comments rewritten; Decision (d), invariant 9 and a Manual check updated. App `(g)` makes no pointer-events assertion (no change); the smoke's `fastForward(500)` after the second tap still clears the overlay.
- **DD-22** [Step 4] While the padlock shows, a corner-button tap is swallowed as a far tap. Options: accept + document / raise the indicator above the overlay while an attempt shows. **Chosen:** Raise it — `TouchLockIndicator` gains `raised?: boolean` (default `false`, `z-40` → `z-[95]`) in Step 3 with unit tests (`sits below…` scoped to the default; new `raised` case); Step 4 passes `raised={lockAttempt !== null}` in the main branch and merges the App test with DD-3's; the smoke adds a corner `page.mouse.click(30, 30)` unlock while the padlock shows; Research, Decisions (DD-5/DD-3 now pointer-reachable), invariant 9, the Step 6 invariant-14 note (no new sentence: `z-[95]` sits inside the ladder's gap), the F2 contract, a Step 7 grep fact and a Manual check updated. Accepted: a keyboard pill attempt with the Add form open lets the corner unlock rather than cancel; a corner tap during `'opening'` re-locks.
