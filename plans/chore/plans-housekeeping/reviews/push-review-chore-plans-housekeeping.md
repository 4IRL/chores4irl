# Push Review: chore/plans-housekeeping

## Review 1
Generated: 2026-06-28
Comparison: origin/main...HEAD
Verdict: **PUSHED WITH MINOR FINDINGS**

All 7 reviewers returned PASS (0 FAIL). The diff is documentation + config only
(version-controlling the previously-untracked `plans/` archive, a README
"How prioritization works" section, `.gitignore`, `.gitattributes`) — no source,
API, schema, or dependency changes. Two findings were fixed in this same push;
the rest are minor/deferred and recorded below.

### Results by Reviewer

#### 1. Safety & Security — PASS
No credentials, API keys, tokens, or private keys. Only informational disclosures
now made public by tracking `plans/`: the Pi's private LAN IP `192.168.1.214`,
the Pi login `rmilarachi` / `/home/rmilarachi`, and the dev-machine path
`/home/rmila/...` — all in historical deploy plans. RFC1918 + non-credential;
accepted as-is for a private home-lab project.

#### 2. Correctness — PASS
All material claims verified: README scoring formula (`duration × daysSince/frequency`),
function names, short/long-term sort split, and `Chore` interface all match current
code; all 5 freeze-header merge SHAs exist on `main` with correct PR numbers; the
"25 open findings" count in the ledger checks out. Flagged the `.gitignore`
`research.node_modules` artifact (**fixed this push**).

#### 3. Simplicity & Conciseness — PASS
The four new docs are distinct in purpose and cross-reference rather than duplicate.
One latent drift risk noted (META-PLAN dual completed-feature tables) — see below.

#### 4. Test Coverage — PASS
Docs + `.gitignore`/`.gitattributes` only; no executable behavior, no tests required.

#### 5. Completeness & Cleanup — PASS
No `tmp/` scratch committed, no stray files, no dangling internal links. Flagged the
`.gitignore` artifact (**fixed this push**).

#### 6. Consistency & Style — PASS
README tone/heading/code-fence style and the `Chore` block match conventions;
freeze-header format uniform across the 5 F-series plans; directory convention
(completed/ vs feature/) correct. Noted older pre-existing archived plans lack
freeze headers — see below.

#### 7. Integration Risk — PASS
Only behavior-affecting change is `.gitignore`; glob `plans/**/tmp/` correctly
scoped, no cross-path shadowing. Flagged that `git archive` would now ship `plans/`
to the Pi (**fixed this push** via `.gitattributes export-ignore`).

### Fixed in this push
- [x] **Remove garbled `.gitignore` line `research.node_modules`; restore `plan.md`/`research.md`** — `.gitignore` — done in `4054daf`.
- [x] **Keep `plans/` out of `git archive` deploy tarballs** — `.gitattributes` — added `plans/ export-ignore` in `4054daf`.

### To-Do: Required Changes (minor / deferred)

- [ ] **Add freeze headers to the older pre-existing completed plans** — `plans/completed/automated-test-setup.md`, `backend-connectivity.md`, `db-routes-and-state-fix.md`, `real-time-midnight-sort.md`, `plan-reconciliation-report.md`, `push-review-reconfig-ClaudeCode.md` — these were already in `plans/completed/` before this session and lack the `> **STATUS: Merged** ...` blockquote the 5 newly-archived plans now carry. Apply during the next `/compact-plans` sweep.
- [ ] **Mark `progress-bar-decay.md` as Superseded, not Merged** — `plans/completed/progress-bar-decay.md` — META-PLAN records this branch as superseded (functionality shipped via F6/bar-redesign `3a30a42`, branch never merged). Add `> **STATUS: Superseded** by bar-redesign (3a30a42)...` per the COMPACT-PLANS template.
- [ ] **Make the META-PLAN dual-table update explicit** — `plans/META-PLAN.md` — completed features live in both the Summary table and the Status ledger; add a one-line reminder to the ledger update protocol to also move the row in the Summary table, so the two never drift.
- [ ] **(Optional) Redact host specifics in historical deploy plans** — `plans/completed/docker-raspberry-pi.md` et al. — replace `192.168.1.214` / `rmilarachi` with placeholders if this repo ever goes public. Non-blocking for a private repo.
