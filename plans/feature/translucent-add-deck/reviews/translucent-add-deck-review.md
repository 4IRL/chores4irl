# Review: Translucent / blur Add Task deck (F5)

## Review — 2026-09-18

### Summary
The plan is factually accurate against the source (every cited line/class/command was re-verified; subagents #5 and #6 executed the plan's test edits and a synthetic Chromium repro of the sticky-in-scroller layout and both behaved exactly as predicted). Findings are about tightening the plan text (z-index fallback location, dev-server lifecycle between steps 3 and 4, empty-state wording) and four design decisions on test coverage / tolerance values. Requires small changes before proceeding.

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | PASS | 0 critical, 0 major, 2 minor |
| 2 | Full-Stack Trace | FAIL | 0 critical, 1 major, 1 minor |
| 3 | Ordering & Cleanup | FAIL | 0 critical, 1 major, 2 minor |
| 4 | Integration & Conventions | PASS | 0 critical, 0 major, 0 minor |
| 5 | Verification & Coverage | FAIL | 0 critical, 2 major, 2 minor |
| 6 | Completeness & Risk | PASS | 0 critical, 0 major, 2 minor |

Deduplicated total: 0 critical, 4 major, 6 minor (the "No chores match" wording was raised by #3, #5 and #6 — counted once).

### Findings

#### Major (should fix)
- **[Step 2a] z-index fallback names no location; the obvious one is structurally ineffective** _(Subagent #2)_: `chore-bar` (`ChoreTimerBar.tsx:117-123`) carries an unconditional inline `transform: translateX(…)` which creates its own stacking context, so any z-index placed on it or its `focus:z-10` sr-only buttons can never out-rank the sticky deck. If a z-index is ever needed it must go on the outer `relative` div at `ChoreTimerBar.tsx:96`.
- **[Step 3d / Step 4] Dev servers started in 3a are never stopped and would deadlock step 4's `CI=1` run** _(Subagent #3)_: `reuseExistingServer: !process.env.CI` makes Playwright refuse a held port; step 4's "wait for the sibling" loop can never succeed if the occupant is our own leftover server.
- **[Step 1a] Deck test asserts containment but not last-child order** _(Subagent #5)_: `mt-auto`/sticky pinning depends on the deck being the scroll container's *last* child; a future JSX reorder would pass the test but break pinning. → DD-1.
- **[Step 1a / 3c] No persisted test for the empty-list branch** _(Subagent #5)_: the plan promises correct pinning "in every list length (empty, short, overflowing)" but only a throwaway browser script checks empty. → DD-2.

#### Minor (nice to fix)
- **[Research Findings] "Only scrolling element" claim overlooks `ChoreForm.tsx:75`** _(Subagent #1)_: a second `overflow-y-auto` exists inside `ChoreFormModal`'s portal (never co-mounted with the assertion).
- **[Research Findings] `TouchLockIndicator` does not `createPortal`** _(Subagent #1)_: it renders inline at `App.tsx:317` but is still `fixed z-[80]`; conclusion unchanged.
- **[Step 3] No visual check of keyboard focus on a sr-only button near the deck** _(Subagent #2)_: the plan claims `scroll-pb-20` keeps focus targets clear of the deck but never screenshots it.
- **[Step 3c] Empty-state copy "No chores match" does not exist** _(Subagents #3, #5, #6)_: `ChoreList.tsx:18` renders `No chores yet — tap + Add Task to get started.` for both empty and zero-match.
- **[Step 3a] Throwaway script location "`$TMPDIR`/scratchpad" is ambiguous** _(Subagent #3)_.
- **[Step 3a] `ss -ltnp` cannot establish which worktree owns :3000/:5174** _(Subagent #5)_: no PID→cwd lookup specified; in the sandbox `-p` shows nothing. → DD-3.
- **[Step 2a] `scroll-pb-20` (80px) is 1px short of the computed 81px deck height** _(Subagent #6)_. → DD-4.

### Verification Gaps
- **Step 1a**: no DOM-order assertion (see DD-1) and no empty-list test (see DD-2).
- **Step 3**: keyboard-focus visibility was unverified — now covered by the added step 3c-bis.

### To-Do: Mechanical Fixes (auto-applied)
- [x] Research Findings: qualified the "only scrolling element" claim with `ChoreForm.tsx:75` _(applied inline by orchestrator; fact re-verified by grep)_
- [x] Research Findings: `TouchLockIndicator` described as inline `fixed z-[80]`, portal claim limited to the two overlays _(applied inline; verified: 0 `createPortal` in the file)_
- [x] Step 2a: z-index fallback now names `ChoreTimerBar.tsx:96` and explains the `chore-bar` transform stacking-context trap _(applied inline; verified inline `style={{ transform: … }}` at `ChoreTimerBar.tsx:121`)_
- [x] Step 3: added 3c-bis keyboard-focus screenshot check (Tab to last bar's sr-only Delete, rect bottom ≤ deck top) _(applied inline)_
- [x] Step 3d: stop self-started dev servers; Step 4: distinguish own-leftover vs. sibling occupant _(applied inline)_
- [x] Step 3c: empty-state copy corrected to `No chores yet — tap + Add Task to get started.` _(applied inline; verified `ChoreList.tsx:18`)_
- [x] Step 3a: script location reworded to `$TMPDIR` (or session scratchpad), outside the repo _(applied inline)_

### Design Decisions (awaiting user input)

#### DD-1: [Step 1a] Assert the deck is the scroll container's last child?
**Context:** `mt-auto` pins the deck to the bottom only because nothing follows it; step 1a's test checks containment only. Subagent #5 verified `expect(scrollRegion!.lastElementChild).toBe(deck)` passes against the plan's markup.

| # | Option | Trade-off |
|---|---|---|
| 1 | Add the `lastElementChild` assertion | Cheap jsdom guard for the layout's real precondition; one extra line |
| 2 | Containment only + documented rationale | Relies on step 3's one-off screenshots; a future reorder passes CI silently |

**Chosen:** Option 1 — `expect(scrollRegion!.lastElementChild).toBe(deck)` added to step 1a.

#### DD-2: [Step 1a] Add a persisted empty-list deck test?
**Context:** `ChoreList` renders a different subtree when `chores.length === 0`; only the throwaway step 3c checks the deck there. Subagent #5 verified an empty-list test (`fetchAllChores → []`, deck present, inside scroll region, last child, button inside) passes against the plan's markup.

| # | Option | Trade-off |
|---|---|---|
| 1 | Add a second `it(...)` with `mockResolvedValue([])` | Persisted regression coverage for a stated requirement; ~8 lines |
| 2 | Manual-only + documented rationale | Deck JSX is unconditional in `App.tsx`, so structural correctness is implied; only visual `mt-auto` pinning needs a browser — accept the gap |

**Chosen:** Option 1 — second `it()` with `fetchAllChores → []` added to step 1a; step 1c expects three failures; step 4 expects 254 tests.

#### DD-3: [Step 3a] How should the visual-check script decide whether :3000/:5174 belong to this worktree?
**Context:** The script bypasses Playwright's `webServer` (and its `CI=1` loud-fail), so a sibling's dev server would silently produce screenshots of the wrong build. `ss -ltnp` shows no PID in the sandbox.

| # | Option | Trade-off |
|---|---|---|
| 1 | Concrete PID→cwd check | `ss -ltnp`/`lsof -i :5174` → `readlink /proc/<pid>/cwd` must resolve under this worktree; needs unsandboxed Bash for PID visibility |
| 2 | Self-diagnosing screenshots | Drop the port precondition; state that if screenshot B/C shows the old look (no frosted deck, translucent blue button) the servers are someone else's — wait and re-run |
| 3 | Always start own servers on the default ports | Simplest; if the ports are busy, apply the same wait-and-retry rule as step 4 (never kill) |

**Chosen:** Option 3 — step 3a always starts this worktree's own servers (never reuses), waits per step 4's rule if ports are busy; step 3d stops them and confirms the ports are free.

#### DD-4: [Step 2a / 1a] `scroll-pb-20` (80px) vs. `scroll-pb-24` (96px) against the ~81px deck
**Context:** The plan's own math gives an 81px deck footprint; `scroll-pb-20` leaves a theoretical 1px sliver. Subagent #1 confirmed both utilities compile under Tailwind v4.1.18.

| # | Option | Trade-off |
|---|---|---|
| 1 | Keep `scroll-pb-20`, add a one-sentence justification | Tighter padding; 1px worst case is far from any clickable/focus target's centre |
| 2 | Bump to `scroll-pb-24` (test literal + className) | 15px headroom; slightly more over-scroll on programmatic scrolls |

**Chosen:** Option 1 — keep `scroll-pb-20`; justification sentence added to the hit-testing Research Finding.

---

### Verdict
[ ] Ready to proceed as-is
[x] Proceed after minor fixes
[ ] Requires changes before proceeding

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | #3 read `App.test.tsx`, `eslint.config.js`; `within` is new and used in 1a |
| Type annotations | [x] | #1 — no new functions; tsc clean reproduced |
| Error handling (status codes, exceptions, user feedback) | [x] | #2 — no endpoints; render/interaction chain traced incl. overlays, focus, swipe |
| Test coverage (happy path, sad path, edge cases) | [x] | #5 executed steps 1–2 and the full suite (252→253); gaps → DD-1/DD-2 |
| Breaking changes (API contracts, shared state, DB schema) | [x] | #6 — no API/DB change; `App.search.test.tsx:236` constraint holds |
| Config consistency (env vars, requirements pins, lint rules) | [x] | #4 — no new packages; lint/tsc/CI commands verified |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | #4 — testid, describe naming, JSX comment idiom all match precedent |

## Review — 2026-09-18 (Pass 2)

### Summary
Pass 1's seven mechanical fixes and four design decisions were all re-verified against source and by execution (subagents #1 and #5 independently applied steps 1–2: exactly three red failures, then 254/254 green, lint/tsc clean; #1 also re-confirmed in headless Chromium that `scroll-padding-bottom` steers `scrollIntoView`/`focus()`/`scrollIntoViewIfNeeded` clear of the sticky deck). The production-code design is clean. Every remaining finding is in the plan's *verification tooling* (steps 3a/3c-bis/4), including two sentences Pass 1 itself introduced. Proceed after the fixes below and the four design decisions.

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | PASS | 0 critical, 0 major, 0 minor |
| 2 | Full-Stack Trace | FAIL | 0 critical, 3 major, 1 minor |
| 3 | Ordering & Cleanup | FAIL | 0 critical, 2 major, 0 minor |
| 4 | Integration & Conventions | PASS | 0 critical, 0 major, 0 minor |
| 5 | Verification & Coverage | FAIL | 0 critical, 1 major, 0 minor |
| 6 | Completeness & Risk | FAIL | 0 critical, 2 major, 2 minor |

Deduplicated total: 0 critical, 5 major, 3 minor (the Vite "startup log names the path" sentence was raised by #2, #3 and #6; the Tab-loop stop condition by #2 and #6).

### Findings

#### Major (should fix)
- **[Step 3a] "Confirm the frontend server's startup log names this worktree's path" is unexecutable** _(Subagents #2, #3, #6)_: Vite's real startup output (captured live) prints only version/ready-time/Local+Network URLs — no path. Stale leftover of Pass 1's DD-3 edit.
- **[Step 3a] Vite has no `strictPort`; a second dev server silently rebinds to :5175** _(Subagent #2)_: verified live (`Port 5174 is in use, trying another one...`). So "if the port is bound, wait" never fires for the frontend, and the script would screenshot a sibling's build on :5174. → DD-5.
- **[Step 3a/3d/4] Dev-server start/stop mechanism is unnamed; bare shell `&` does not survive across tool calls** _(Subagent #3)_: verified empirically in this harness. → DD-5.
- **[Step 3c-bis] Tab-loop stop condition can't tell the last bar from the first** _(Subagents #2, #6)_: every bar's Delete button has the identical `aria-label="Delete chore"` (`ChoreTimerBar.tsx:148`).
- **[Step 3a/3c-bis] 768×1024 exercises ~12× less overflow than the e2e viewport** _(Subagent #2)_: measured live — 1280×720 gives 332px overflow, 768×1024 only 28px. → DD-6.
- **[Step 4] "swipes a freshly-added, last-in-list bar" is false** _(Subagent #5)_: computed with `choreSort.ts` against the seed under the pinned clock, the new chore lands 8th of 11; HVAC (long-term) is always last and deliberately untouched by e2e. No persisted e2e test drives a pointer gesture on the deck-adjacent bar. → DD-7.

#### Minor (nice to fix)
- **[Step 2a] Document that `focus:z-10` is trapped inside `chore-bar`'s transform stacking context** _(Subagent #2)_.
- **[Step 3c-bis] Tab loop has no iteration cap** _(Subagent #6)_.
- **[META-PLAN F5 open risk] "Confirm backdrop-blur performs acceptably on the Pi" has no closing step and isn't sandbox-checkable** _(Subagent #6)_: the Pi is LAN-only and unreachable from the sandbox. → DD-8.

### Verification Gaps
- **Step 3**: server lifecycle and viewport (DD-5, DD-6).
- **Step 4**: deck-adjacent pointer hit-testing is not CI-gated (DD-7).

### To-Do: Mechanical Fixes (auto-applied)
- [x] Step 3a: deleted the "startup log names this worktree's path" sentence _(applied inline; Vite output verified path-free by #2, #3, #6)_
- [x] Step 3c-bis: stop condition now requires `closest('[data-testid="chore-bar"]')` to be the last bar; loop capped at 40 presses with a diagnostic failure _(applied inline; `aria-label="Delete chore"` at `ChoreTimerBar.tsx:148` verified)_
- [x] Step 2a: added the `focus:z-10`-is-trapped sentence _(applied inline)_

### Missed-Finding Root Causes
| Finding | Root cause | Skill gap? |
|---|---|---|
| Vite "startup log names the path" unexecutable | **Other** — introduced by Pass 1's DD-3 application (orchestrator wrote an unverified observable into the plan) | Instructions already cover this (5f step (1) "verify every observable it asserts") — execution miss by the orchestrator, not a prompt gap |
| Vite non-strict port fallback | **Scoped too narrowly** — Pass 1 reviewed `playwright.config.ts`'s webServer but not `frontend/vite.config.ts`/Vite's own port behaviour, which only became load-bearing once DD-3 chose "start own servers" | Instructions already cover this (new DD text is a hypothesis until verified) |
| Server backgrounding mechanism unnamed | **Trusted plan assertion** — "in the background" accepted as executable | Instructions already cover this |
| Tab-loop stop condition ambiguous | **Other** — introduced by Pass 1's mechanical fix (#2 minor); the fixer didn't check `aria-label` uniqueness | Instructions already cover this (5b dry-run of selection rules) — execution miss |
| Viewport mismatch 768×1024 vs 1280×720 | **Scoped too narrowly** — Pass 1 didn't compare step 3's viewport with `playwright.config.ts`'s device | Instructions already cover this |
| Step 4 "last-in-list" claim false | **Trusted plan assertion** — sort order never computed in Pass 1 | Instructions already cover this |
| Pi blur perf open risk unclosed | **Scoped too narrowly** — META-PLAN's "Open risks" not cross-checked for a closing step | Instructions already cover this |

All Pass 2 misses trace to execution (three of them to the orchestrator's own Pass 1 edits, applied inline without dry-running the observables they asserted); no recurring prompt gap.

### Design Decisions (awaiting user input)

#### DD-5: [Step 3a/3d/4] Dev-server lifecycle for the visual check
**Context:** Bare `&` backgrounding doesn't survive across tool calls; Vite silently falls back to :5175 when :5174 is taken (no `strictPort`), so a sibling's build could be screenshotted unnoticed.

| # | Option | Trade-off |
|---|---|---|
| 1 | One self-contained script: start backend + `vite --strictPort` with `&`, capture `$!`, wait for readiness, run the whole Playwright script (A–E), `kill` both via `trap` before exiting | No cross-call state, no leftover servers, loud failure on a held port; step 3d's "stop servers" becomes a no-op check; 3b's screenshot review happens after servers are gone |
| 2 | Bash `run_in_background: true` handles + `--strictPort`; stop via the harness's task tooling in 3d | Servers persist across steps; relies on harness task handles, easier to leave a leftover |
| 3 | `run_in_background` + keep Vite's port fallback; parse the bound port from stdout and abort if ≠ 5174 | More parsing; still loud-ish, but indirect |

**Chosen:** Option 1 — step 3 rewritten around a single self-contained driver (`deck-visual.sh`: `&` + `$!` + `trap kill` on EXIT, `vite --strictPort`, readiness poll, then `node deck-visual.mjs`); 3d verifies the ports are free.

#### DD-6: [Step 3] Visual-check viewport
**Context:** `#root` is `max-width: 768px`, so width is clamped either way; only height changes overflow. 1280×720 (Playwright's Desktop Chrome) gives 332px overflow, 768×1024 only 28px.

| # | Option | Trade-off |
|---|---|---|
| 1 | Run the script at both 768×1024 and 1280×720 | Covers the real kiosk and the CI regime; the script loops over two viewports, ~2× screenshots |
| 2 | 768×1024 only, with a sentence accepting that the CI overflow regime is checked only by step 4's swipeBar (which has no keyboard-focus equivalent) | Less work; named gap |

**Chosen:** Option 1 — the `.mjs` loops over 768×1024 and 1280×720; 3b/3c/3c-bis run per viewport, with 3c-bis required to pass at 1280×720.

#### DD-7: [Step 4] Deck-adjacent hit-testing in e2e
**Context:** META-PLAN F5 says "No e2e change". No persisted test swipes the bottommost bar; the plan's step 4 sentence claiming otherwise is false.

| # | Option | Trade-off |
|---|---|---|
| 1 | Correct the sentence (the delete test swipes a mid-list bar — a general `swipeBar` regression) and document that deck-adjacent hit-testing is verified only by the throwaway step 3 script | Honours "no e2e change"; the worst-case risk stays un-gated in CI |
| 2 | Add one persisted smoke assertion: `page.locator('[data-testid="chore-bar"]').last()` (HVAC, always last), `swipeBar(..., 'right')`, assert the confirm dialog is visible, click **Cancel** (seed preserved) | CI-gates the exact risk; deviates from META-PLAN's "no e2e change" (Phase C must note it) |

**Chosen:** Option 1 — step 4 wording corrected (mid-list swipe, 8th of 11; HVAC always last); deck-adjacent hit-testing documented as verified only by step 3, per META-PLAN's no-e2e-change scope.

#### DD-8: [META-PLAN F5 open risk] Pi backdrop-blur performance
**Context:** Unreachable from the sandbox (Pi is LAN-only). The deck's blur area (≤768×81px) is far smaller than the already-shipped full-viewport `backdrop-blur-sm` scrims.

| # | Option | Trade-off |
|---|---|---|
| 1 | Accept the size/precedent argument as closure; state it in Research Findings | No new step; risk closed on reasoning |
| 2 | Add a post-merge manual spot-check note (scroll-blur smoothness on the Pi) as a non-blocking follow-up | Explicit trail for Phase C; needs someone at the Pi |

**Chosen:** Post-merge spot-check on the Pi (user's revised option after asking whether the sandbox could be amended for SSH — it cannot: loopback-only netns; unsandboxed `ssh milarachic4i` is the existing path). Research Findings now closes the risk on size/precedent for the PR and records a non-blocking post-merge eyeball check for Phase C.

---

### Verdict
[ ] Ready to proceed as-is
[x] Proceed after minor fixes
[ ] Requires changes before proceeding

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | #3 — `within` used by both new tests |
| Type annotations | [x] | #1 — tsc clean reproduced in a disposable worktree |
| Error handling (status codes, exceptions, user feedback) | [x] | #2 — render/interaction chain re-traced; focus-scroll clearance confirmed in Chromium |
| Test coverage (happy path, sad path, edge cases) | [x] | #5 executed steps 1–2 (3 red → 254 green); e2e gap → DD-7 |
| Breaking changes (API contracts, shared state, DB schema) | [x] | #6 — none |
| Config consistency (env vars, requirements pins, lint rules) | [x] | #4 — no new packages; commands verified |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | #4 — new test names/idioms match precedent |

## Review — 2026-09-18 (Pass 3)

### Summary
All Pass 2 resolutions re-verified against source and by execution (`--strictPort` forwards through npm workspaces; readiness URLs match Playwright's own probes; "8th of 11" recomputed exactly from `choreSort.ts` + seed + pinned clock; `[...].at(-1)` fine in the bundled Chromium 147). One genuine critical surfaced in Pass 2's own DD-5 resolution — `kill $!` on `npm run dev … &` only kills the npm wrapper and orphans the real server — plus a major the reviewers missed twice: the visual script never pins the clock, so run outside 06:00–21:00 the app renders `inert` behind the screen-blank overlay. Both fixed with live dry-runs. Hard cap reached; nothing remains unresolved.

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | FAIL | 0 critical, 1 major, 0 minor |
| 2 | Full-Stack Trace | FAIL | 0 critical, 1 major, 1 minor |
| 3 | Ordering & Cleanup | FAIL | 1 critical, 0 major, 1 minor |
| 4 | Integration & Conventions | FAIL | 0 critical, 1 major, 0 minor |
| 5 | Verification & Coverage | FAIL | 0 critical, 1 major, 0 minor |
| 6 | Completeness & Risk | PASS | 0 critical, 0 major, 4 minor |

Deduplicated total: 1 critical, 3 major, 5 minor (the trap-orphan issue was raised by #1 and #3; the `scrollTop` reset by #3 and #6).

### Findings

#### Critical (must fix before proceeding)
- **[Step 3a/3d/4] `trap 'kill $BACKEND_PID $FRONTEND_PID' EXIT` kills only the npm wrapper — vite/ts-node grandchildren keep both ports on every run** _(Subagents #1, #3; both reproduced live)_. Fixed: ownership-gated port kill (see mechanical fixes).

#### Major (should fix)
- **[Step 3a] The `.mjs` never pins the clock; `useScreenBlank` blanks the app 21:00–06:00** _(Subagent #2)_. Fixed: `page.clock.setFixedTime(new Date(2025, 0, 15, 12, 0, 0))` before `goto`, as in `smoke.spec.ts:21`.
- **[Step 4] "Own leftover vs. sibling" carve-out had no sandbox-viable ownership check** _(Subagent #4)_. Fixed: carve-out dropped; step 3d proves our servers are gone (or stops and reports); step 4 applies `/run-feature` step 8's wait-and-retry rule uniformly.
- **[Step 3] Pinning was verified only by eyeballing rects** _(Subagent #5)_. → DD-9.

#### Minor (nice to fix)
- **[Step 3c-bis] "Scrolled to top" precondition was never actioned** _(Subagents #3, #6)_. Fixed: explicit `scrollTop = 0` + `blur()`.
- **[Step 3a] 332px/28px overflow figures assume a fresh 10-row seed** _(Subagent #2)_. Fixed: precondition stated (`data.db` at repo root, gitignored).
- **[Research Findings] Pi closure conflated "renders" with "scrolls smoothly"** _(Subagent #6)_. → DD-10.
- **[Research Findings] META-PLAN's "(`flex-shrink-0`)" pinning parenthetical will be stale after this change** _(Subagent #6)_. Fixed: Phase C note added.
- **[Step 3c] Search locator unnamed** _(Subagent #6)_. Fixed: `page.getByPlaceholder('Search for a chore')`.

### To-Do: Mechanical Fixes (auto-applied)
- [x] Step 3a trap → `OWNED=0`; `trap '[ "$OWNED" = 1 ] && fuser -k 3000/tcp 5174/tcp …' EXIT`; `OWNED=1` only after readiness **and** `kill -0` on both npm PIDs (so a sibling-held port — which makes `vite --strictPort`/`EADDRINUSE` exit our process — never triggers a kill) _(applied inline; dry-run in this sandbox: ready 3 s, `OWNED=1`, both ports freed, no leftover processes; the `setsid` + `kill -- -$!` alternative was dry-run and rejected — `setsid` forks here, so `$!` is not the group leader)_
- [x] Step 3a `.mjs`: pin the clock before `goto`; state the fresh-seed precondition _(applied inline; `BLANK_START_HOUR=21`/`BLANK_END_HOUR=6` verified in `useScreenBlank.ts:6-7`)_
- [x] Step 3c: `page.getByPlaceholder('Search for a chore')` _(applied inline; verified `ChoreSearchInput.tsx:25`)_
- [x] Step 3c-bis: explicit `scrollTop = 0` and `blur()` before the Tab loop _(applied inline)_
- [x] Step 3d: stop-and-report if a port is still bound; Step 4: carve-out removed, uniform wait-and-retry _(applied inline)_
- [x] Research Findings: Phase C note about META-PLAN's `flex-shrink-0` parenthetical _(applied inline)_

### Missed-Finding Root Causes
| Finding | Root cause | Skill gap? |
|---|---|---|
| Trap kills only the npm wrapper | **Fix verification stopped at plan text** — Pass 2's DD-5 was applied without dry-running the trap; both Pass 3 agents caught it by executing it | Instructions already cover this (5f step (1)); orchestrator execution miss |
| `.mjs` never pins the clock | **Scoped too narrowly** — Passes 1–2 traced `useScreenBlank` only for stacking/inert, not for the visual script's runtime conditions | Instructions already cover this ("every interaction path") |
| Own-leftover carve-out unverifiable | **Trusted plan assertion** — carried from Pass 1's mechanical fix | Instructions already cover this |
| Pinning verified by eyeballing | **Other** — accepted as a manual step in Pass 1 | Instructions already cover this |

Recurring pattern across passes: three findings trace to orchestrator-applied edits (Pass 1 ×2, Pass 2 ×1) that asserted an observable without dry-running it. Not a prompt gap — the skill's 5b/5f dry-run rule already prohibits it — but an execution discipline the orchestrator broke by applying fixes inline instead of via the prescribed fixing subagents.

### Design Decisions (awaiting user input)

#### DD-9: [Step 3] Scripted assertions vs. printed numbers
**Context:** The plan's central pinning claim was checked only by a human comparing printed rects to prose.

| # | Option | Trade-off |
|---|---|---|
| 1 | `.mjs` asserts each rect comparison (≤2px "flush"), logs `PASS:`/`FAIL:`, exits 1 on failure | Driver exit status is the verdict; screenshots stay for the human judgements |
| 2 | Print rects at every point, human decides | No assert logic; judgement by eye |

**Chosen:** Option 1 — assertions written into 3a/3b/3c/3c-bis.

#### DD-10: [Research Findings] Pi-risk sentence precision
**Context:** The modal-scrim precedent proves `backdrop-filter` renders, not that it scrolls smoothly under moving content.

| # | Option | Trade-off |
|---|---|---|
| 1 | Reword only: precedent closes rendering; the post-merge Pi check answers smoothness | No code change |
| 2 | Reword + `transform-gpu`/`will-change` on the deck | Speculative on the Pi; extra class + test literal |

**Chosen:** Option 1 — sentence reworded.

---

### Resolve During Implementation
None — every Pass 3 finding was resolved in the plan text.

### Verdict
[x] Ready to proceed as-is
[ ] Proceed after minor fixes
[ ] Requires changes before proceeding

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | #3 — lint clean on HEAD; new tests add nothing that trips eslint |
| Type annotations | [x] | #1 — unchanged since Pass 2 (tsc clean) |
| Error handling (status codes, exceptions, user feedback) | [x] | #2 — clock-pin gap found and fixed; focus/scroll paths re-traced |
| Test coverage (happy path, sad path, edge cases) | [x] | #5 — step 3 now asserts numerically; step 4 suite list complete |
| Breaking changes (API contracts, shared state, DB schema) | [x] | #6 — none |
| Config consistency (env vars, requirements pins, lint rules) | [x] | #4 — sandbox rules respected (`$TMPDIR`, localhost curl); no new packages |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | #4 — unchanged since Pass 2 |
