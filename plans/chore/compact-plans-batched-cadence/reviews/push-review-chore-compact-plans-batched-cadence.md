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

## Review 2
Generated: 2026-09-22 10:32
Comparison: origin/main (`85f8a55`)...HEAD (`27d1524` + the minor below) — all five of Review 1's To-Do items landed in `27d1524`; per the append-only convention adopted in #42, Review 1's boxes stay `[ ]` and this line is the record. Re-ran the five reviewers that failed or raised the substantive findings, plus Integration Risk (the diff grew to include `plans/META-PLAN.md`). Safety & Security, Simplicity and Test Coverage were not re-run: their Review 1 verdicts were PASS and this delta only removes text they had flagged as excess.
Verdict: **PUSHED WITH MINOR FINDINGS**

### Results by Reviewer

#### 2. Correctness — PASS
The blocking major is resolved: grep confirms zero hits for "Sweep frequency", "hard ordering" or "requires it" in the skill. Step 5's paragraph now ends "A hit here is a signal, not a cleanup task, and not a reason to hold back the prune" — consistent with, rather than contradicting, the unchanged "Pruning the branch itself is still safe" in the same paragraph. The `/worktree` overstatement is gone and the new wording matches `worktree/SKILL.md:9` and `:169`. Surviving claims re-verified true. META-PLAN's rewritten passage is descriptive of rhythm, not a pre-prune gate, and its "never hand-delete a merged row" warning survived intact and still matches `run-feature/SKILL.md:31-32`'s resume table exactly.

#### 5. Completeness & Cleanup — PASS
META-PLAN now states Phase C first and the sweep as batched, fixing both the contradiction and the backwards ordering; surrounding context preserved. A fresh repo-wide re-sweep found no other text implying a per-feature cadence — all remaining "sweep" mentions are dated historical narrative. No debris from the deleted section: the only surviving "Sweep frequency" strings are in this review record documenting the fixed finding, not live cross-references. No placeholders, no TODO/FIXME, `git diff --check` clean, reviewer scratch correctly gitignored under `plans/**/tmp/`.

#### 6. Consistency & Style — PASS
All three Review 1 findings resolved: the section is gone (intro now runs straight into `## Branch Guard`), the rationale is welded to an instruction bullet, and the italicised cross-reference is plain text. Two bold sentences in a row at the intro were checked explicitly and match the file's existing "**Bold lead-in:** explanation" pattern. META-PLAN's rewrite matches the surrounding paragraph's wrap and voice; the review file matches sibling `push-review-*.md` structure; commit messages match `[tag] imperative`.
- minor — `.claude/skills/compact-plans/SKILL.md:158` — the new Important Notes bullet was a length/shape outlier (504 chars vs 250 for the list's next-longest, with a "Two reasons …:" preamble no sibling bullet uses) — **fixed before push** (rewritten to the list's one-rule-plus-em-dash-clause shape, ~310 chars).

#### 7. Integration Risk — PASS
`git diff -- plans/META-PLAN.md` is a single prose hunk in the "Branch/dir cleanup" narrative beneath the Status-ledger table; no added line begins `| `, and no `[#N](` syntax exists anywhere in the file — so neither `/run-feature` Phase A step 3's row grep nor `/compact-plans` Step 7's whole-ledger scan can match it. ★FOCUS and the Baseline header are outside the hunk. Nothing in `/run-feature`, `/worktree` or `/new-feature` depends on prompt archival. The new review file follows the topic-inference path convention, so Step 3's harvest and `/run-review`'s auto-detect resolve it. `PUSH-REVIEW-FINDINGS.md` has no scheduled consumer — only `/compact-plans` writes it.
- note — this branch's own `plans/chore/compact-plans-batched-cadence/` dir will need archiving on a future sweep. Normal lifecycle, same as #42/#44.

#### 8. Error Handling & Silent Failures — PASS
The rewrite is not an over-correction: "not a reason to hold back the prune" matches Step 5's actual gate, and both mandatory clauses survive verbatim — "leave it in place — do not delete it" and "record the F-ID under a 'Phase C pending' list for Step 7's report". The Phase C pending signal chain (Step 5 → Step 7's two greps → the report bucket) is untouched. The batching rationale is accurate against Step 7's real scan text. META-PLAN's hand-delete warning is preserved verbatim, only reflowed. No instruction anywhere tells the agent to continue past an error.

### To-Do: Required Changes

- [x] **Shorten the Important Notes bullet to the list's shape** — `.claude/skills/compact-plans/SKILL.md:158` — done before push.
