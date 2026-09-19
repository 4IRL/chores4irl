# Push Review: chore/compact-plans-260919

## Review 1
Generated: 2026-09-19 11:03
Comparison: origin/main...HEAD
Verdict: **BLOCKED**

### Results by Reviewer

#### 1. Safety & Security — PASS
Documentation-only diff. The new remote-only prune path still passes the branch-name regex, PR-MERGED, merge-commit-on-origin/main, and `remote_tip == head_oid` gates before `gh api -X DELETE`; `git branch -dr` / `git config --remove-section` are local bookkeeping on already-gated names. No secrets.

#### 2. Correctness — PASS
Restructured gate is syntactically balanced and logically sound; `local_done` correctly gates the remote leg; all SHA/PR pairs verified. Minors:
- `plans/PUSH-REVIEW-FINDINGS.md:40` — `[style]`/`[dx]` tally says 32; recount is 31 (two of the new `[dx]` items are `[x]`-resolved, so 21 + 10).
- `SKILL.md:110` — the `git config --remove-section` cleanup is scoped to branches whose remote leg ended in DELETE/404, but a branch whose local `-D` succeeded and whose remote leg then SKIPped/STOPped has the same stale config section and isn't covered.

#### 3. Simplicity & Conciseness — FAIL
- **major** `SKILL.md:112` — the new "A remote-only candidate…" paragraph restates rationale already given in Step 5's opening sentence (line 58) and the snippet's inline comment (line 90). Only two points are novel: remote-only is normal/not-a-SKIP, and why the tip gate alone suffices.
- minor `PUSH-REVIEW-FINDINGS.md:170/174` — F5 section explains the ledger-row resolution in both the blockquote and the `[x]` bullet.
- minor `PUSH-REVIEW-FINDINGS.md:195/197` — meta-plan-update-f14 section explains "moot" in both the blockquote and the `[x]` bullet.

#### 4. Test Coverage — PASS
No application code changed. Minor: Step 7 never re-verifies that the `git config --remove-section` cleanup landed; a failure would leave stale `[branch "…"]` sections undetected.

#### 5. Completeness & Cleanup — FAIL
- **major** `SKILL.md:102` vs `:110` vs `:137` — the 404 branch's new comment says "report it as already-clean, not as pruned", but Step 7's report enumeration defines no such bucket and the stale-ref paragraph says to note 404-vs-deleted *within* the pruned entry. A fully-gone remote-only branch has no defined home in the report.
- minor `PUSH-REVIEW-FINDINGS.md:40` — same 32 → 31 tally error.
- minor `PUSH-REVIEW-FINDINGS.md:159` — "Review 1 was 8/8 PASS" but the source review ran 9 reviewers (Type Design included); should be 9/9.
All `Source:` paths, freeze headers, harvest reconciliation, and tmp/.claude purges verified clean.

#### 6. Consistency & Style — PASS
Minors:
- `SKILL.md:60` — checkpoint introduces a `local-only` tag that nothing in the file produces or explains (unlike `remote-only`).
- `plans/completed/remove-details-longterm/pr-description.md:1` — sidecar freeze header drops the "do not edit" clause every other header carries; Step 3 doesn't document the sidecar variant.
- `remove-details-longterm.md:2`, `translucent-add-deck.md:2` — Outcome lines open "F4 shipped as planned:" where the house form is "Shipped as planned" (no F-ID prefix, no colon).
- `PUSH-REVIEW-FINDINGS.md:214` — Resolved/archived bullet combines two items; house pattern is one bullet per item.

#### 7. Integration Risk — PASS
worktree ↔ compact-plans hand-off now lines up; no stale "remote refs skipped when local is gone" phrasing anywhere; no broken links after the renames; `plans/chore/` still exists (this sweep's own dir). Minor (no action — already tracked as an open `[dx]` item in the meta-plan-update-f5 findings section): `plans/META-PLAN.md` "Branch/dir cleanup" paragraph names pre-move paths; only `/run-feature` Phase C or `/new-feature` rewrites it.

#### 8. Error Handling & Silent Failures — FAIL
- **major** `SKILL.md:110` — the stale-ref paragraph blesses "remote-tracking branch not found" and "no such section" as benign with no exact-match check and no STOP for anything else, unlike every other branch of the Step 5 gate (which substring-matches e.g. `HTTP 404`). A persisting `.git/config` lock error on `git config --remove-section` would be indistinguishable from the benign case.
- **major** `SKILL.md:102` — same undefined "already-clean" bucket as Completeness; additionally the same 404 line is reached for a branch whose local ref *was* deleted this run, where "not as pruned" would under-report a real deletion.
Remote-only deletion path itself is soundly gated (exact `remote_tip == head_oid`, stricter than the local ancestor check) and the reasoning is stated.

### To-Do: Required Changes

- [ ] **Trim the remote-only paragraph to its two novel points** — `.claude/skills/compact-plans/SKILL.md` Step 5 (the "A **remote-only** candidate…" paragraph) — keep only (a) remote-only is a normal case, not a SKIP, and (b) why the remote leg's `remote_tip == head_oid` check is a sufficient tip gate; drop the restated teardown mechanism and candidate-list-construction sentences (already at line 58 and in the snippet comment).
- [ ] **Define the 404 outcome's report home and reconcile the three passages** — `.claude/skills/compact-plans/SKILL.md` Step 5 404-branch comment, stale-ref paragraph, and Step 7 report line — replace "report it as already-clean, not as pruned" with: the entry stays in the report's "pruned" bucket, annotated per leg (`local: deleted (was <sha>)` / `local: already absent`; `remote: deleted here` / `remote: already gone (404)`); make Step 7's report line say "pruned (branches, local + remote, each annotated with which legs were actually deleted here vs already gone)".
- [ ] **Exact-match the two benign errors in the stale-ref cleanup and STOP on anything else** — `.claude/skills/compact-plans/SKILL.md` Step 5 stale-ref paragraph — turn the prose into a snippet: `git branch -dr "origin/<branch>"` → benign only when stderr contains `remote-tracking branch 'origin/<branch>' not found`; `git config --remove-section "branch.<branch>"` → benign only when stderr contains `no such section`; any other non-zero exit (e.g. `could not lock config file`) is a `STOP:` naming the branch and git's error. Also widen the config-section cleanup's scope to every branch whose local `git branch -D` succeeded this run, regardless of how its remote leg ended.
- [ ] **Add a Step 7 check that the config-section cleanup landed** — `.claude/skills/compact-plans/SKILL.md` Step 7 — after the branch cross-check bullet: `git config --get-regexp '^branch\.'` must list no `branch.<name>.*` key for any branch pruned this run; a hit means the `--remove-section` was skipped — run it now (unsandboxed) and report.
- [ ] **Define or drop the `local-only` tag** — `.claude/skills/compact-plans/SKILL.md` Step 5 pause-and-ask checkpoint — keep the three tags but define them in one clause as the state of `git branch -a` (`local+remote`: both refs present locally; `remote-only`: only `remotes/origin/<branch>`; `local-only`: only `refs/heads/<branch>` — its remote leg will usually hit the benign 404).
- [ ] **Add "do not edit" to the sidecar freeze header and document the variant** — `plans/completed/remove-details-longterm/pr-description.md:1` and `.claude/skills/compact-plans/SKILL.md` Step 3 — header becomes `> **STATUS: Merged** \`d728989\` (#38). Frozen — historical record, do not edit. PR body as submitted; see \`remove-details-longterm.md\` for the outcome.`; Step 3 gains one sentence: sidecar `.md` files at the plan's top level (e.g. `pr-description.md`) get the same STATUS line plus a pointer to the main plan instead of an Outcome.
- [ ] **Normalize the two Outcome openers** — `plans/completed/remove-details-longterm/remove-details-longterm.md:2`, `plans/completed/translucent-add-deck/translucent-add-deck.md:2` — "F4 shipped as planned:" → "Shipped as planned — …"; "F5 shipped with a different layout technique…" → "Shipped with a different layout technique than META-PLAN sketched (F5) — …".
- [ ] **Split the combined Resolved/archived bullet** — `plans/PUSH-REVIEW-FINDINGS.md` "Resolved / archived" — one bullet each for meta-plan-update-f4 (#40) and meta-plan-workflow-improvements-260910 (#35).
- [ ] **Correct the `[style]`/`[dx]` tally** — `plans/PUSH-REVIEW-FINDINGS.md` Quick batch view — 32 → 31.
- [ ] **Correct the F4 harvest note's reviewer count** — `plans/PUSH-REVIEW-FINDINGS.md` F4 section blockquote — "8/8 PASS" → "9/9 PASS (Type Design reviewer included)".
- [ ] **De-duplicate the two blockquote/`[x]` explanations** — `plans/PUSH-REVIEW-FINDINGS.md` F5 section and meta-plan-update-f14 section — keep the resolution detail in the `[x]` bullet; shorten each blockquote to a pointer ("one item resolved — see below").
- [x] **META-PLAN "Branch/dir cleanup" paragraph is stale** — `plans/META-PLAN.md` — no action in this sweep by design (the skill never edits META-PLAN); already tracked as an open `[dx]` item under the meta-plan-update-f5 findings section.

## Review 2
Generated: 2026-09-19 11:14
Comparison: origin/main...HEAD (Review 1's 11 actionable items all landed in `a2efff4`)
Verdict: **BLOCKED**

### Results by Reviewer

#### 1. Safety & Security — PASS
Regex hardening still upstream of every destructive use; `dangerouslyDisableSandbox` scoped to the two-line cleanup block. Minor: the cleanup snippet relies on the loop's earlier regex gate rather than re-asserting it — safe structurally, but the property depends on the executing agent carrying the vetted names forward.

#### 2. Correctness — PASS
Verified in a scratch repo that both exact-match strings (`remote-tracking branch '…' not found`, `no such section`) are what git 2.43 prints, that `if ! out=$(cmd 2>&1)` gates on the real exit status, and that a locked `.git/config` leaves the `branch.<name>.*` section behind after a successful `-D`. Tallies (31/18/3) and all seven SHA/PR pairs re-verified. Minors: Step 7's config check covers "any branch pruned this run" while the cleanup was scoped only to local-`-D` branches (a remote-only entry with a pre-existing stale section falls between them); the F5 Outcome opener omitted the `(F5)` marker Review 1's item specified.

#### 3. Simplicity & Conciseness — PASS
Review 1's major and both minors fixed; the new snippet, Step 7 bullet, report annotation, and Step 3 sentence each add distinct information.

#### 4. Test Coverage — PASS
The added Step 7 bullet covers both leftovers the cleanup creates.

#### 5. Completeness & Cleanup — PASS
All three Review 1 fixes landed and the three passages (404 comment, cleanup comments, report line) agree; no `already-clean` text remains. Minors: the benign-reason comment still named "a remote-only entry" while the scope comment excluded remote-only; the `(F5)` marker gap.

#### 6. Consistency & Style — FAIL
All four Review 1 minors fixed. **major** — this review file had Review 1's 12 To-Do boxes ticked in place with the verdict still `BLOCKED` and no `## Review 2`, contradicting `PUSH-REVIEW-FINDINGS.md`'s rule that per-feature review files are frozen at review time (boxes checked only in the ledger) and `/git-push` Step 6's append-only `## Review N+1` contract.

#### 7. Integration Risk — PASS
worktree ↔ compact-plans hand-off still lines up; no step renumbering, no stale cross-references, no dangling plan paths. Empirically confirmed the sandbox `-D` behaviour the skill describes.

#### 8. Error Handling & Silent Failures — PASS
Both Review 1 majors fixed and verified against real git error text. Minor: same scope/benign-comment contradiction as Correctness/Completeness — not a silent failure (Step 7's check backstops it).

### To-Do: Required Changes

- [ ] **Restore Review 1's To-Do boxes to `[ ]` and append this `## Review 2`** — `plans/chore/compact-plans-260919/reviews/push-review-chore-compact-plans-260919.md` — per-feature review files are frozen at review time; a later round records what landed in its own `Comparison:` line, never by editing an earlier round's checkboxes.
- [ ] **Reconcile the config-section cleanup's scope and benign-reason comments** — `.claude/skills/compact-plans/SKILL.md` Step 5 stale-ref snippet — widen the scope comment to include remote-only entries (a sweep halted by a STOP after `-D` can leave the section for a later run to find as remote-only) and reword the benign reason to "`-D` ran unsandboxed and cleaned it itself, or a remote-only entry that never had one"; make Step 7's bullet say "(either leg)" and add "or was out of scope" to its hit interpretation.
- [ ] **State the cleanup's name provenance** — `.claude/skills/compact-plans/SKILL.md` Step 5 stale-ref intro — "over the same `<branch>` names the loop already passed through its regex gate (never a name from anywhere else)".
- [ ] **Add the `(F5)` marker to the F5 Outcome opener** — `plans/completed/translucent-add-deck/translucent-add-deck.md:2` — "…than META-PLAN sketched (F5) — …", matching Review 1's item verbatim.

## Review 3
Generated: 2026-09-19 11:19
Comparison: origin/main...HEAD (Review 2's 4 items all landed in `2287815`)
Verdict: **PUSHED WITH MINOR FINDINGS**

### Results by Reviewer

#### 1. Safety & Security — PASS
Regex gate precedes every destructive op including the cleanup; Review 2's provenance minor landed verbatim; no secrets.

#### 2. Correctness — PASS
Both Review 2 minors landed and are mutually consistent; control flow re-traced; Review 1 boxes `[ ]`, Review 2 present. Minor: Step 7's "or was out of scope" clause is now a defensive hedge with no live gap behind it.

#### 3. Simplicity & Conciseness — PASS
New comments/prose each add distinct information.

#### 4. Test Coverage — PASS
Step 7 bullet matches the widened cleanup scope.

#### 5. Completeness & Cleanup — PASS
Both Review 2 minors landed; Review 2's four To-Do items verified against `2287815`; no stale text remains.

#### 6. Consistency & Style — PASS
Review record now matches house form (append-only rounds, Review 1 boxes restored). Minor: the two scoping comments in the stale-ref snippet are standalone leading `#` lines; every other snippet comment in the file trails its code line.

#### 7. Integration Risk — PASS
Step numbering unchanged; worktree/META-PLAN references resolve; no dangling plan paths.

#### 8. Error Handling & Silent Failures — PASS
Scope/benign/Step 7 wording consistent; both new STOPs carry `$out`. Minor (pre-existing, unmodified): the `gh api -X DELETE` failure STOP names the branch but doesn't capture the command's output like its newer siblings.

### To-Do: Required Changes

- [ ] **Capture the DELETE call's output in its STOP** — `.claude/skills/compact-plans/SKILL.md` Step 5 per-branch snippet — `elif ! delete_out=$(gh api -X DELETE "repos/4IRL/chores4irl/git/refs/heads/<branch>" 2>&1); then echo "STOP: remote delete failed for <branch> — $delete_out"`, for symmetry with the existence-check and stale-ref STOPs.
- [ ] **Trail the two stale-ref scoping comments** — `.claude/skills/compact-plans/SKILL.md` Step 5 stale-ref snippet — move each leading `# for every branch …` line to trail its `if ! out=$(…); then` line, matching the file's trailing-comment convention (or leave as-is if line length argues for it).
- [ ] **Optionally drop "or was out of scope"** — `.claude/skills/compact-plans/SKILL.md` Step 7 stale-ref bullet — the cleanup scope now covers every category that reaches "pruned"; keep only if future narrowing is anticipated.
