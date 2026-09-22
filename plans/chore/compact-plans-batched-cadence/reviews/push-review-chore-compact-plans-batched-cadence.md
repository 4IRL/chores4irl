# Push Review: chore/compact-plans-batched-cadence

## Review 1
Generated: 2026-09-22 10:15
Comparison: origin/main (`85f8a55`)...HEAD (`e38a61c`) — 1 commit, 1 file: `.claude/skills/compact-plans/SKILL.md` gains a "Sweep frequency" section stating the sweep is batched across features rather than per-feature, one Step 5 sentence reworked, frontmatter description updated
Verdict: **BLOCKED**

### Results by Reviewer

#### 1. Safety & Security — PASS
Doc-only. Every destructive-operation safeguard verified byte-identical across the diff: the PR-merge/tip verification chain, the `AskUserQuestion` branch-deletion checkpoint, every STOP/SKIP rule, the "Never prune" list, and Step 7's re-verification. No secrets.
- minor — `.claude/skills/compact-plans/SKILL.md:139` / `:19` — the new "hard ordering rule" language describes a gate the pruning code does not implement (see Correctness). Documentation self-consistency, not a loosened safeguard.

#### 2. Correctness — FAIL
Three of the four factual claims check out against the real files: Step 7's scan genuinely is forward-only (its own text already says so); `/worktree` does hand off one `/run-feature` per worktree and its teardown does leave merged remote refs to Step 5 (`worktree/SKILL.md:9`, `:169`); `/new-feature` Steps 3/7/8 do perform the fold-back inline.
- major — `.claude/skills/compact-plans/SKILL.md:19` (and the echo at `:139`) — the new text asserts a "hard ordering rule: never sweep an F-ID's branch before that F-ID's fold-back has merged." **No such gate exists.** Step 5's per-branch loop gates purely on `state == "MERGED"`, `mergedAt`, `mergeCommit`, `headRefName` and tip position — it never reads the Status-ledger row. Worse, the same paragraph's *unchanged* sentence says the opposite in as many words: "Pruning the branch itself is still safe." The addition describes a constraint that does not exist and that its own surrounding text denies.
- minor — `:17` — "`/worktree` **requires** it" overstates the source: `worktree/SKILL.md` shows design compatibility, not a stated hard requirement.

#### 3. Simplicity & Conciseness — PASS
- minor — `:14-17` — the "Two reasons the batched form is the right default" bullet block is rationale-to-a-reader with no attached instruction; the behaviour change lands in the first sentence alone.
- minor — `:19` — the closing ordering/frequency paragraph restates the Step 5 rework.

#### 4. Test Coverage — PASS
No application source or test file changes. Confirmed the repo has no harness asserting anything about `.claude/skills/**` — no suite, no lint, no CI step over skill markdown. No test obligation; none invented.

#### 5. Completeness & Cleanup — FAIL
No placeholders, TODOs or broken cross-references; the frontmatter change matches the body, and "see *Sweep frequency* above" did resolve to a real section above it. Sibling skills checked clean: `run-feature/SKILL.md` never references sweep cadence at all, `worktree/SKILL.md`'s single mention is cadence-agnostic, `/new-feature` has none, and `PUSH-REVIEW-FINDINGS.md`'s "sweep" mentions are dated historical narrative rather than prescriptive.
- major — `plans/META-PLAN.md:364-365` — still reads "Run `/compact-plans` **after each merge**, then `/run-feature <F-ID>` …", asserting exactly the per-merge cadence this change retires. META-PLAN is the file a fresh, memory-less agent is meant to run from end-to-end, so leaving it contradicting the skill is a real gap. (It also has the *order* backwards relative to the skill: sweep-then-Phase-C, where the skill requires Phase C first.)

#### 6. Consistency & Style — FAIL
Frontmatter description style, backtick/bold/em-dash usage and the Step 5 rework all match the file's conventions; the commit message matches `git log`'s `[tag] imperative` shape.
- major — `:10` — `## Sweep frequency` is unnumbered and sits before `## Branch Guard`. In this codebase that pre-Branch-Guard slot holds *procedural gating* steps (`run-feature`'s "Resolve the F-ID" / "Decide which phase to resume", which determine whether Branch Guard even applies); `worktree` puts Branch Guard straight after the intro with nothing ahead of it. Cadence rationale gates nothing procedural and fits neither that slot, the numbered Step 1–7 pattern, nor the terse `## Important Notes` bullet style.
- major — `:14` — the free-floating justification block is a voice drift: every other rationale aside in this file (`:36`, `:65`, `:159`) is welded directly to an instruction the agent then executes.
- minor — `:139` — "see *Sweep frequency* above" italicises a section name; every other in-file cross-reference uses plain "Step N's …".

#### 7. Integration Risk — PASS
No skill depends on the sweep's cadence. `/run-feature` Phase A's cold survey, its branch checkout and `/plan-creator`'s topic inference are all unaffected by dirs sitting live under `plans/feature/` longer. `/worktree`'s touch-set analysis and teardown are cadence-agnostic. `/git-push` topic inference has no collision risk from extra live dirs. `/run-review` and `/next-step-taker` read `PUSH-REVIEW-FINDINGS.md` on demand, not on a schedule, so later harvest arrival disrupts nothing.

#### 8. Error Handling & Silent Failures — PASS
The mandatory instructions in Step 5's Status-ledger paragraph ("leave it in place — do not delete it", "record the F-ID under a 'Phase C pending' list") are untouched context the diff never modifies, so no path was opened to proceed past a surviving row. The forward-only justification for batching is accurate, so batching does not silently drop missed fold-backs. Step 5's `git fetch` STOP gate is untouched, and Step 3's harvest reconciliation is per-dir, so neither weakens as more dirs enter one run.
- minor — `:19` — same overstatement Correctness raised: "hard rule" / "gates which F-IDs a sweep may prune" describes intent backed by Step 7 post-hoc detection, not a pre-prune gate.

### To-Do: Required Changes

- [ ] **Delete the invented "hard ordering rule"** — `.claude/skills/compact-plans/SKILL.md` — remove the claim that a sweep may not prune an F-ID's branch before its fold-back merged, from both the new section and the reworked Step 5 sentence. Step 5 gates on PR-merged state and tip only, and the paragraph already states pruning before the fold-back is safe; the true rule is the existing one — a surviving row is reported as "Phase C pending" and never deleted, and the prune proceeds regardless.
- [ ] **Fix the sibling contradiction in META-PLAN** — `plans/META-PLAN.md:364-365` — "Run `/compact-plans` after each merge, then `/run-feature <F-ID>`" must become Phase C first, sweep batched across several features.
- [ ] **Remove the free-floating `## Sweep frequency` section** — same skill file — fold the one behavioural sentence into the intro paragraph and move the two-reason rationale into `## Important Notes`, whose bullet style it matches. Resolves the placement major, the voice major and both Simplicity minors together.
- [ ] **Soften "`/worktree` requires it"** — to what the source supports: `/worktree` hands off one `/run-feature` per worktree and leaves merged remote refs to Step 5, so a parallel batch wants one sweep rather than N.
- [ ] **Drop the italicised section cross-reference** — replace "see *Sweep frequency* above" with plain-text phrasing matching the file's other cross-references.
