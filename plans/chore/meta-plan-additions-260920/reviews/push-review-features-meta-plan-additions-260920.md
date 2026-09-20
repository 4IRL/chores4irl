# Push Review: features/meta-plan-additions-260920

## Review 1
Generated: 2026-09-20 16:19
Comparison: origin/main (`a045b11`)...HEAD (`9e830fb`) — plans-only: `/new-feature` batch adding F16–F21 (★FOCUS F15 → F21, ledger rolled to 260920) + the `/compact-plans` sweep after F6 (freeze/relocate #42/#43/#44 dirs, harvest 18 findings, prune three branches)
Verdict: **BLOCKED**

### Results by Reviewer

#### 1. Safety & Security — PASS
No code, secrets, or destructive operations; the LAN IP/MAC in the F6 docs is a pre-existing accepted-minor (only-if-public), not new content.

#### 2. Correctness — PASS
PR numbers/SHAs, every code citation in F16–F21 (ChoreForm/choreSort/ChoreTimerBar/App/useTouchLock/TouchLock*/choreBarMath), the 43/254 Vitest counts (re-run), the harvest tallies (+3/+12/+1) and ★FOCUS uniqueness all verified.
- minor — `plans/META-PLAN.md:939` — F20's *Assumed starting state* says the `isSimulating` guard is on `resetTask` "and the three swipe callbacks"; only `onSwiping` and `onSwiped` carry it (`onTouchStartOrOnMouseDown` does not).

#### 3. Simplicity & Conciseness — FAIL
- major — `plans/ledger/260920_feature_ledger.md:4-9` — the F16–F21 ledger entries restate their full META-PLAN Design sections (formulas, thresholds, prop/file names) instead of the ledger's short raw-ask convention (cf. F2/F4/F5/F14 in the retired 260708 ledger).
- major — `plans/completed/local-url-alias/local-url-alias.md:2` — the freeze-header Outcome is a ~163-word paragraph; the `/compact-plans` convention is 1–4 lines.
- major — `plans/META-PLAN.md:333-352` — the "Branch/dir cleanup" paragraph still says F6 "awaits the next `/compact-plans` sweep", points at `plans/feature/local-url-alias/` (moved by this branch to `plans/completed/`), and re-lists findings now harvested in `PUSH-REVIEW-FINDINGS.md`.
- minor — `plans/META-PLAN.md:37` vs `:192` — "Where the rollout stands" and "Shortest path" both restate the F15 gating rationale at full length.

#### 4. Test Coverage — PASS
Each of F16–F21 names its test files and the behaviours to pin; Vitest counts still anchored to #43.
- minor — `plans/META-PLAN.md:984` — F16's test list has no case for `urgency` undefined (design point 5 defines "medium or unset ×1"; a lookup-table implementation could yield an undefined multiplier for legacy rows).

#### 5. Completeness & Cleanup — PASS
Placeholders are the two flagged "(name TBD)"s; no TODO/FIXME; ledger ↔ META-PLAN cross-checked word-for-word; PREDECESSOR banner, retention, harvest formats and tallies verified.
- minor — `plans/META-PLAN.md:346` and *Assumptions to revisit* item 4 (~`:463`) — same stale "awaits the next sweep" / `plans/feature/local-url-alias/` prose (pre-existing; `/new-feature` ran before the sweep). Suggests tracking it in `PUSH-REVIEW-FINDINGS.md` rather than hand-editing.

#### 6. Consistency & Style — PASS
Heading shape, ★FOCUS forms, Status-ledger cells, ledger entry shape, freeze-header form, harvest-section form, dates, `c4i.local / c4i` ordering, hard-wrap width all match precedent.
- minor — `plans/META-PLAN.md:109` / `:1557` — the two ASCII tree diagrams gain a bare `★ F21` prefix that the F15-era trees never used.
- minor — `plans/META-PLAN.md:1557` — "★ F21 (...) — no prerequisites, ★FOCUS, runnable now" carries both marker forms on one line.

#### 7. Integration Risk — PASS
`/run-feature` row grep, ★FOCUS detection, ledger naming/banner, `/compact-plans` Step 7 scan (zero `[#N](` hits outside the Status ledger), `/worktree` touch sets and the F18/F19 shared-ref + F19/F20 amendment language all consistent.
- minor — `plans/META-PLAN.md:336` — "three merged features have not been swept yet" should now read two (F4/F5).
- minor — `plans/META-PLAN.md:347` — the F6 sentence lacks the "(or its frozen copy under `plans/completed/`)" hedge its two sibling references (~`:414`, ~`:463`) carry.

#### 8. Error Handling & Silent Failures — FAIL
F16 `frequency === 0`, F17 all-zero override, F18 reduced-motion, F21 rollback/error-toast parity and harvest severity fidelity all explicitly handled.
- major — `plans/META-PLAN.md:1276` (F19) / `:1395-1399` (F20 Open risk (b)) — F20 allows Add Task while locked, and F19's reset re-fires on every idle-expiry tick, but the only dialog-closing logic is the force-close effect keyed on the `isLocked` *transition* — so an Add modal opened after the lock engaged and abandoned stays open across every later tick while scroll/room/search/day reset underneath it, contradicting F19's "canonical boot view" goal. Not deferred as an open question — simply unaddressed.

### To-Do: Required Changes

- [ ] **Specify the abandoned-modal-under-lock behaviour** — `plans/META-PLAN.md` F19 (Design + Expected end state) and F20 Open risk (b) — state that every idle-expiry tick while locked (not only the engage transition) also force-closes an open Add/Edit dialog (the reset's step 0), add the test case "Add form left open across a second idle tick while locked → closed", and mirror the sentence in `plans/ledger/260920_feature_ledger.md`'s F19 entry.
- [ ] **Trim the F16–F21 ledger entries to the raw ask** — `plans/ledger/260920_feature_ledger.md:4-9` — one short paragraph each (the user's ask + the decisions taken that day), pointing at the META-PLAN section for formulas, thresholds and touch sets.
- [ ] **Cut the F6 freeze-header Outcome to ≤ 4 lines** — `plans/completed/local-url-alias/local-url-alias.md:2` — keep what shipped, the Chromium profile-lock deviation, the `c4i.local / c4i` contract, and the #44 fold-back; drop the Docker-bridge caveat and matrix-case letters (they live in the frozen research/review docs).
- [ ] **Update the "Branch/dir cleanup" paragraph and *Assumptions to revisit* item 4** — `plans/META-PLAN.md:333-352`, ~`:463` — drop F6 from the not-yet-swept list ("three" → "two": F4/F5), repoint the path to `plans/completed/local-url-alias/`, remove the re-listed findings (now in `PUSH-REVIEW-FINDINGS.md` § F6), and replace item 4's "after the next sweep" with the present tense. (This branch is the `/new-feature` PR, so editing these paragraphs here is in-scope — the sweep itself never touches `META-PLAN.md`.)
- [ ] **Reword F20's `isSimulating` guard sentence** — `plans/META-PLAN.md:939` — "guard on `resetTask`, `onSwiping` and `onSwiped`" (not "the three swipe callbacks").
- [ ] **Add the unset-`urgency` test case to F16** — `plans/META-PLAN.md:984` — "a chore with `urgency` omitted scores identically to `urgency: 'medium'`".
- [ ] **(Optional) Shorten the top-summary F15 clause to a pointer** — `plans/META-PLAN.md:37` — "`F15` stays gated on external pi-kiosk Phase 2 parity — see *Shortest path* below".
- [ ] **(Optional) Drop one ★ marker form from the tree diagrams** — `plans/META-PLAN.md:109`, `:1557` — either remove the bare `★ ` prefix (match the F15-era trees) or keep it and drop "★FOCUS" from line 1557.
