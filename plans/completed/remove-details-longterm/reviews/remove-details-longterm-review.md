# Review: Remove *Details* and *Long-term task* fields (F4)

## Review — 2026-09-18

### Summary
The plan's code-level claims all verify against the tree (line citations, types, migration semantics on SQLite 3.51.3, a11y queries, baseline counts 4/32 and 29/252, Step 6/7 gates dry-run green). It needs changes before implementation on four fronts: the Step 1 → Step 2 boundary is a deliberately red, POST/PUT-broken state that `/run-plan`'s per-step green gate cannot pass through; Step 6's grep gates contradict both META-PLAN's literal "no matches" fact and Step 4's own new frontend assertions; the Step 2 `routes.test.ts` INSERT rewrite would break an existing `toBe('Sweep')` assertion; and the Step 8 Pi rollback note omits that the pre-F4 image cannot write to a migrated DB. The remaining findings are narrative-accuracy fixes (wrong SQLite error strings, a test body that depends on state `beforeEach` discards, the dev `data.db` being migrated by Step 1's test run rather than Step 7's smoke run).

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | PASS | 0 critical, 0 major, 4 minor |
| 2 | Full-Stack Trace | PASS | 0 critical, 0 major, 3 minor |
| 3 | Ordering & Cleanup | FAIL | 0 critical, 1 major, 3 minor |
| 4 | Integration & Conventions | FAIL | 0 critical, 2 major, 3 minor |
| 5 | Verification & Coverage | FAIL | 0 critical, 1 major, 8 minor |
| 6 | Completeness & Risk | FAIL | 0 critical, 1 major, 11 minor |

Deduplicated total: **0 critical, 5 major, 17 minor** (32 raw minors collapsed — the Step 1/2 red-state wording was raised by #1/#2/#3/#5/#6, the "boots twice" body by #1/#2/#5/#6, the dev-`data.db` timing by #1/#5/#6, the META-PLAN grep by #4/#6).

### Findings

#### Major (should fix)
- **[Step 1→2] Step 1/Step 2 boundary is a deliberately red, runtime-broken state the per-step orchestrator cannot pass through** _(Subagent #3)_: Step 1 drops the columns from `CREATE TABLE` while `chores.ts` still binds `@details`/`@long_term_task`, so after Step 1 every `createChore` INSERT throws `table chores has no column named details`, every `updateChore` UPDATE throws `no such column: details`, and `chores.test.ts`, `routes.test.ts` **and `events.test.ts`** fail; against a real DB POST/PUT 500 while GET works. `/run-plan` auto-continues only on green and spawns a Test Fix Loop on failure, which would pre-empt Step 2 ad hoc. → **DD-3**.
- **[Step 6] Plan's grep gate contradicts META-PLAN F4 "Expected end state" bullet 1 (`grep … returns no matches`) — and that bullet is unsatisfiable by construction** _(Subagents #4, #6)_: the migration must emit `long_term_task` inside its `ALTER` statement and META-PLAN's own required idempotency test must recreate the legacy DDL. `/run-feature` step 8 requires "reconcile any gap before publishing" and nothing prescribes the reconciliation. → **DD-1**.
- **[Step 4 / Step 6] Step 4 adds `not.toHaveProperty('details'|'longTermTask')` to `ChoreForm.test.tsx`, but Step 6 asserts no `frontend/` file matches** _(Subagents #4, #2)_: both greps are case-sensitive and will match those two literals (the `'Details'`/`'Long-term task'`/`'Clear Details'` label queries do not). Removing a test requirement is bright-line → **DD-2**.
- **[Step 2] Prescribed `routes.test.ts` INSERT rewrite changes the seeded row and breaks the existing GET assertion** _(Subagent #5)_: the plan rewrites lines 26-27 as `('Vacuum', 'Bedroom', …, 20, 7)` but line 32 asserts `expect(res.body.data[0].name).toBe('Sweep')`. Only `long_term_task` and its trailing `, 0` need removing. _(mechanical)_
- **[Step 8] Rollback path is one clause with no procedure and omits that the old image cannot write to the migrated DB** _(Subagent #6)_: compatibility is asymmetric — verified the NEW 6-column INSERT/UPDATE succeed against the OLD 9-column schema, but the OLD image's SQL names both columns so every POST/PUT 500s against the migrated DB. A code-only rollback silently breaks writes; the snapshot must be restored into the `chores-data` volume together with the old image, and no restore procedure exists anywhere. _(mechanical)_

#### Minor (nice to fix)
- **[Step 1] Red-state description says "TypeError at import"; under vitest 4.1.4 a missing named export is `undefined` and fails at call time** _(#1, #3)_: verified in a scratch project — the four `dropLegacyChoreColumns` cases throw `TypeError: (0 , __vite_ssr_import_N__.dropLegacyChoreColumns) is not a function`; the three boot cases fail their 7-column `toEqual` with 9 columns. _(mechanical)_
- **[Step 1 / Step 2] Quoted SQLite error strings and failing-test set are wrong** _(#1, #2, #3, #5, #6)_: verified on better-sqlite3 12.8.0 — raw INSERT naming a missing column → `table chores has no column named long_term_task` (not `no such column`); `createChore` INSERT → `table chores has no column named details`; `updateChore` UPDATE → `no such column: details`; and `events.test.ts` also fails (its emit test POSTs first). Step 2's red state is likewise "every create/update-reaching test", not only the stale-key ones. _(mechanical)_
- **[Step 1] `'boots twice'` test body depends on state `beforeEach`/`afterEach` discard** _(#1, #2, #5, #6)_: written literally it would import against the compiled default path (repo-root `data.db`) and prove nothing; the legacy-file setup and first import must be repeated inside the `it`. _(mechanical)_
- **[Step 1] Test sketch omits `import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'`** _(#5)_: `globals: true` lets it run, but no `vitest/globals` types are configured and `backend/tsconfig.json` includes `src`, so bare globals fail the Step 1 `tsc` gate (dry-run confirmed TS2582/TS2304). _(mechanical)_
- **[Step 1 / Step 7] The worktree's legacy `data.db` is migrated by Step 1's first backend test run, not Step 7's smoke spec** _(#1, #5, #6)_: `db-path.test.ts` case 3 opens the repo-root `data.db` with `TEST_DB_PATH` unset; the stop-the-dev-server guard and the 7-column check belong at Step 1, Step 7 only exercises the idempotent no-op path, and the local revert path (delete `data.db*`, reseed) is unstated. _(mechanical)_
- **[Step 1] Pragma read sits outside the transaction — small TOCTOU window between two concurrent booters** _(#3)_: `.immediate()` with the pragma inside the transaction closes it for free. → **DD-4**.
- **[Step 1] Migration error handling is an implicit crash-loud choice whose usual justification does not hold here** _(#6)_: verified the new INSERT/UPDATE work against the legacy schema, so a logged-and-tolerated failure would leave a fully functional app. → **DD-8**.
- **[Step 2] PUT stale-key test references `${id}` without saying where it comes from** _(#5)_ → **DD-5**.
- **[Step 3] Replacement sort test is a contract pin, not a regression detector — a stale-key variant that genuinely goes red exists** _(#5)_: verified `{ ...makeChore({…}), longTermTask: true } as unknown as Chore` returns `[1, 2]` on current code and `[2, 1]` on the collapsed sort. → **DD-6**.
- **[Step 4] `queryByRole('button', { name: 'Clear Details' })` is null before and after — vacuous** _(#5)_ → **DD-7**.
- **[Step 4] F4 absence test sketch omits required render props (`onSubmit`, `onCancel`) and needs `unmount()` between the two modes** _(#5, #6)_: without unmount the red state throws "Found multiple elements" instead of returning an element. _(mechanical)_
- **[Step 5] Bare `README.md` is ambiguous (3 READMEs) and the interface block is lines 39-49 (delete 42 and 48), not 40-50** _(#4)_ _(mechanical)_
- **[Step 5] Replacement prose for README lines 24-27 is described, not given** _(#6)_ _(mechanical)_
- **[Step 5] "Schema migrations" note placement — README line 7 is an Architecture bullet, not a paragraph** _(#6)_ → **DD-9**.
- **[Step 8 / Decision (c)] `bin/chores4irl-backup.sh` exits 1 unless `BACKUP_RSYNC_DEST` is set — only the systemd unit supplies it; and README's update procedure is `docker compose up -d --build`** _(#4)_ _(mechanical)_
- **[Decision (b) / Step 8] Irreversible loss of user-entered Details on the Pi is under-stated; no pre-deploy inspection step; kiosk Chromium keeps the old bundle until reloaded** _(#6)_ _(mechanical)_
- **[Research Findings] SQLite-on-Pi claim is right for the wrong reason — better-sqlite3 12.8.0 installs via `prebuild-install || node-gyp rebuild` and `node:20.18.0-bookworm-slim` has no toolchain, so the Pi uses the upstream `linux-arm64` prebuilt (same bundled 3.51.3)** _(#6)_ _(mechanical)_
- **[Research Findings / Step 6] `tsc --noEmit` and `npm run lint` are local-only — CI runs only the two Vitest suites and the e2e smoke** _(#4)_ _(mechanical)_

### Verification Gaps
None beyond the above — Step 7 carries backend Vitest + frontend Vitest + the exact `/run-feature` step-8 Playwright invocation; a11y queries, migration assertions, seed-skip/fresh-seed flows, and `git diff main` in the worktree were all dry-run green by Subagent #5.

### To-Do: Mechanical Fixes (auto-applied)
- [x] Step 1/2 red-state narrative: vitest call-time `TypeError`, real SQLite error strings, `events.test.ts` in the failing set; move the stop-dev-server guard + pre-state capture + local revert to Step 1; reword Step 7 to the idempotent no-op path
- [x] Step 1 `'boots twice'` test body repeats the legacy-file setup inside the `it`
- [x] Step 1 test imports include the explicit `vitest` named imports
- [x] Step 2 `routes.test.ts` INSERT keeps `('Sweep', 'Kitchen', …, 10, 7)`
- [x] Step 4 F4 absence test written out with `onSubmit`/`onCancel` props and `unmount()` between modes
- [x] Step 5 qualified to repo-root `README.md`, interface block 39-49 (lines 42, 48), exact replacement prose for 24-27
- [x] Step 8 runbook: restore procedure into `chores-data` + old-image incompatibility, `systemctl start chores4irl-backup.service` instead of the bare script, `up -d --build`, pre-deploy Details inspection, kiosk reload; decision (b)/(c) wording
- [x] Research Findings: CI local-only gates note (+ Step 6 reminder)
- [x] Research Findings: better-sqlite3 prebuilt mechanism _(all applied by fixing subagents; each dry-ran its gate — routes.test.ts lines 26-27/32, db-path.test.ts pattern, vitest import + tsconfig include, ChoreFormProps, README lines 25-27/39-49 (paragraph actually starts at 25), backup script/unit/compose/Dockerfile, ci.yml, better-sqlite3 install script + sqlite3.h)_

### Design Decisions (awaiting user input)

#### DD-1: [Step 6] META-PLAN's literal "`grep … returns no matches`" cannot be satisfied — how does the plan reconcile it?
**Context:** META-PLAN F4 "Expected end state" bullet 1 demands zero matches for `longTermTask\|long_term_task` under `backend frontend types`. The migration must emit `long_term_task` in its `ALTER TABLE … DROP COLUMN` SQL, and META-PLAN's own "Test-suite deltas" require an idempotency test that recreates the legacy DDL. Renaming constants does not help; an allow-list drop ("drop every column not in the 7-name set") would destroy columns a future release adds and is not recommended. `/run-feature` step 8 says "reconcile any gap before publishing".

| # | Option | Trade-off |
|---|---|---|
| 1 | Leave META-PLAN untouched; add a "Reconciled deviation" note to Step 6 listing the exact allowed files (`db.ts` migration list; `db-migration.test.ts`; stale-key tests) with the amended wording for `/run-feature` Phase C to fold in | Zero code impact; keeps META-PLAN edits inside Phase C where `/run-feature` owns them; the PR description carries the same note |
| 2 | Amend META-PLAN line 512 on the feature branch as part of this feature's commits, replacing the bullet with a scoped, satisfiable grep (`--exclude-dir=__tests__`, `db.ts` matches only inside the migration list) | META-PLAN is accurate at merge time; but `/run-feature` Phase A/C treat META-PLAN as ledger-row-only during Phase A, so this is an out-of-contract edit |

**Chosen:** Option 1 — Note for Phase C. META-PLAN stays untouched on this branch; Step 6 now quotes line 512 verbatim, explains why the literal is unsatisfiable, and carries the amended "matches only (a)…(c)" wording for `/run-feature` Phase C, with Step 8 putting the same sentence in the PR description.

#### DD-2: [Step 4 / Step 6] Keep the two `not.toHaveProperty` frontend assertions (and widen Step 6), or drop them (and keep Step 6 strict)?
**Context:** Step 4 adds `expect(payload).not.toHaveProperty('details'); expect(payload).not.toHaveProperty('longTermTask');` to `ChoreForm.test.tsx`; Step 6's case-sensitive greps will match those literals.

| # | Option | Trade-off |
|---|---|---|
| 1 | Keep them; amend Step 6 bullets 1-2 to list `ChoreForm.test.tsx` as an intentional test-only match ("nothing in any non-test `frontend/src` file") | Consistent with the backend stale-key tests the plan already allows; explicit payload-shape pin |
| 2 | Drop them; keep Step 6 as written (frontend: zero matches) | Contract still pinned by the new F4 absence test, `tsc -p frontend/tsconfig.json` (excess-property errors), and the backend stale-key tests |

**Chosen:** Option 1 — Keep + widen Step 6. The two `not.toHaveProperty` assertions stay; Step 6 bullet 1 now allows `ChoreForm.test.tsx` and (because of DD-6) `choreSort.test.ts` and says "nothing in any non-test `frontend/src` file"; bullet 2 allows `ChoreForm.test.tsx`'s `not.toHaveProperty('details')` (dry-run confirmed the case-sensitive greps skip the `'Details'` label queries).

#### DD-3: [Step 1 → Step 2] How should Steps 1 and 2 relate so every step boundary is green and independently committable?
**Context:** After Step 1 alone, `chores.ts` still names the dropped columns → POST/PUT 500 and three backend test files fail until Step 2. `/run-plan` gates each step on green.

| # | Option | Trade-off |
|---|---|---|
| 1 | Swap the order: new Step 1 = today's Step 2 (`chores.ts` de-reference + `chores.test.ts`/`routes.test.ts` edits incl. stale-key tests), new Step 2 = today's Step 1 (`db.ts` schema + migration + seed + `db-migration.test.ts`) | Verified viable: the 6-column INSERT and trimmed UPDATE succeed against the still-legacy 9-column table (`details` nullable, `long_term_task` DEFAULT 0); both steps end green; two bisectable commits; new Step 1's red is the `not.toHaveProperty` assertions rather than a runtime error |
| 2 | Merge Steps 1 and 2 into one step "Backend — schema, migration, seed and data access (`db.ts` + `chores.ts`), TDD": Red = `db-migration.test.ts` + test edits; Green = `db.ts` then `chores.ts`; one gate, one commit | Simplest narrative; single larger commit; no intermediate red to describe |

**Chosen:** Option 1 — Swap order. New Step 1 = `chores.ts` + its tests (red = the `not.toHaveProperty` assertions against `rowToChore`'s always-present keys; green with every backend test passing against the legacy table — verified the 5/6-column INSERT and trimmed UPDATE succeed on the 9-column schema); new Step 2 = `db.ts` schema/migration/seed + `db-migration.test.ts` (red = only the new file). Every intermediate-red sentence removed; all cross-references re-pointed.

#### DD-4: [Step 1] Close the pragma-read/ALTER race in `dropLegacyChoreColumns`?
**Context:** `present` is computed before the deferred transaction takes a lock; two processes booting the same un-migrated file at the same instant (dev server + `db-path.test.ts` case 3) could make the second throw `no such column` at module load.

| # | Option | Trade-off |
|---|---|---|
| 1 | Move the pragma read inside the transaction and use `.immediate()` (`BEGIN IMMEDIATE` serialises booters; a busy first booter surfaces as the already-documented `SQLITE_BUSY`) | Free correctness; one extra line; the Step 1 unit tests need no change |
| 2 | Leave as planned; add a "single-writer assumption" sentence to the db.ts comment and Research Findings | No code change; relies on the operator never running two booters concurrently |

**Chosen:** Option 1 — Pragma inside `.immediate()`. Snippet rewritten with the `table_info` read inside `target.transaction(...).immediate()` and the BEGIN IMMEDIATE comment; verified on a file-backed WAL DB (two calls → 7 columns, row intact, second call a no-op) and `Transaction<F>.immediate` exists in `@types/better-sqlite3` for 12.8.0.

#### DD-5: [Step 2] How do the new `routes.test.ts` stale-key tests obtain `id`?
| # | Option | Trade-off |
|---|---|---|
| 1 | Sibling pattern: `const post = await request(app).post('/api/chores').send(BASE_CHORE); const id = post.body.data.id;` | Matches every other PUT test in the file (lines 86-87, 117-118) |
| 2 | Raw INSERT then `const id = (db.prepare('SELECT id FROM chores').get() as { id: number }).id;` | Matches `chores.test.ts`'s pattern; independent of POST working |

**Chosen:** Option 1 — POST first, sibling pattern. The PUT stale-key test obtains `id` via `request(app).post('/api/chores').send(BASE_CHORE)` exactly as lines 86-87/117-118 do (`BASE_CHORE` is the module-level literal at lines 10-16).

#### DD-6: [Step 3] Should the replacement sort test be able to fail on the pre-change implementation?
**Context:** The prescribed test passes on old code too (verified). A stale-key variant — `{ ...makeChore({ id: 2, duration: 10, frequency: 90, dateLastCompleted: localNoon('2024-01-01') }), longTermTask: true } as unknown as Chore` — returns `[1, 2]` on current code and `[2, 1]` after the collapse, and survives Step 4's type removal.

| # | Option | Trade-off |
|---|---|---|
| 1 | Keep the prescribed test; reword the note to call it a contract pin (Step 4's type removal is what prevents the partition from returning) | Simpler test, no cast; honest note |
| 2 | Use the stale-key formulation (title: "ignores a legacy longTermTask flag and orders purely by descending duration-weighted score"; `import type { Chore } from '@customTypes/SharedTypes'`) | Real red→green; mirrors the backend stale-key tests; adds a `longTermTask` literal to a frontend test (interacts with DD-2's Step 6 allow-list) |

**Chosen:** Option 2 — Stale-key variant. Step 3's test is now `ignores a legacy longTermTask flag …` with the `as unknown as Chore` cast and the `@customTypes/SharedTypes` type import; verified RED on current code (`expected [ 1, 2 ] to deeply equal [ 2, 1 ]`) via a scratch test that was then deleted; the "no runtime red" note is gone.

#### DD-7: [Step 4] Keep the vacuous `queryByRole('button', { name: 'Clear Details' })` assertion?
| # | Option | Trade-off |
|---|---|---|
| 1 | Drop it — the other three assertions are the real guards; `FormField.test.tsx` covers non-clearable fields | Tighter test |
| 2 | Keep with a comment (`// was never clearable — see FormField.test.tsx`) | Documents intent; adds no signal |

**Chosen:** Option 1 — Drop it. The `'Clear Details'` query and its parenthetical clause are removed from Step 4's `assertAbsent`; the three remaining queries are stated as the real regression guards; the Decisions bullet never mentioned Clear Details.

#### DD-8: [Step 1] Should a migration failure crash the backend (implicit current choice) or be logged and tolerated?
**Context:** Unguarded at module load, a thrown `ALTER` (SQLITE_BUSY, read-only volume, future schema object) exits the process; the Docker `HEALTHCHECK` never passes, `restart: on-failure:5` gives up, the kiosk stays dark. Verified the new INSERT/UPDATE work against the legacy schema, so tolerating the failure leaves a fully functional app with two lingering columns.

| # | Option | Trade-off |
|---|---|---|
| 1 | Keep crash-loud; add a sentence to the db.ts comment + Decisions ("a failed DROP aborts boot on purpose; check `docker compose logs backend` if the frontend never comes up") | Simplest; matches the planned test set; failure is loud |
| 2 | Wrap in `try { … } catch (err) { console.error('[db] legacy column migration failed; continuing on legacy schema', err); }` and add a unit test that the wrapper swallows (export the wrapper; stub `target.exec` to throw) | App stays up; migration retries next boot; one more test |

**Chosen:** Option 1 — Crash loud. No try/catch; the db.ts comment block gains the "aborts boot on purpose … `docker compose logs backend`" lines, a new Decisions item records the rationale (tolerating would be viable since the new SQL works on the legacy schema, but loud failure is preferred), and Step 8 step 4's existing logs pointer is tagged as the by-design path.

#### DD-9: [Step 5] Where does the README "Schema migrations" note live?
| # | Option | Trade-off |
|---|---|---|
| 1 | Extend the Architecture **Backend** bullet (line 7) with one sentence, and add a caveat paragraph at the end of "Updating an existing Pi deployment" (after line 184) about snapshot-before-deploy and old-image incompatibility | Puts the operational rule next to the procedure it guards; two small edits |
| 2 | New `### Schema migrations` subsection under "Data model" (after line 50) covering mechanism + rule; leave line 7 and the Pi section untouched | One place; Step 5's grep expectation must allow the new section's `details`/`long_term` mentions |

**Chosen:** Option 1 — Backend bullet + Pi-update caveat. Step 5 now appends the migration sentence to README line 7 and the snapshot/rollback paragraph after line 184 (the end of "Updating an existing Pi deployment"), reordered so the two line-numbered deletions come first; the grep expectation is now "exactly one line: line 7" (dry-run: currently matches 25/42/48, all removed).

---

### Verdict
[ ] Ready to proceed as-is
[ ] Proceed after minor fixes
[x] Requires changes before proceeding

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | #3 read eslint.config.js, all three tsconfigs, db.ts/chores.ts/ChoreForm.tsx/choreSort.ts/database.ts; no deferred dead symbol; `@assets` alias still used by `constants.ts` |
| Type annotations | [x] | #1 verified `Database.Database`, `pragma()` cast, `transaction()` typing, stale-key cast path against `@types/better-sqlite3` and backend/frontend tsconfigs |
| Error handling (status codes, exceptions, user feedback) | [x] | #2 traced all six routes; status codes unchanged; better-sqlite3 stale-key tolerance verified experimentally |
| Test coverage (happy path, sad path, edge cases) | [x] | #5 ran both suites (4/32, 29/252), dry-ran every migration assertion and a11y query, `git diff main` valid in the worktree |
| Breaking changes (API contracts, shared state, DB schema) | [x] | #6 confirmed single table, no indexes/views/triggers, no API consumers besides the frontend; flagged the asymmetric rollback |
| Config consistency (env vars, requirements pins, lint rules) | [x] | #4 verified ci.yml, docker-compose.yml, Dockerfile.backend, backup script/unit, `.gitignore`; no new deps |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | #4 confirmed `LEGACY_CHORE_COLUMNS`/`dropLegacyChoreColumns` match existing constant/function naming; `node:` imports match db-path.test.ts |

## Review — 2026-09-18 (Pass 2)

### Summary
Clean pass: all six subagents PASS with 0 critical and 0 major. Every Pass-1 mechanical fix and DD-1…DD-9 was re-verified against the code by experiment (trimmed SQL against the legacy table, vitest 4.1.4 `not.toHaveProperty` semantics, `.immediate()` two-connection lock behaviour, RTL queries, README line numbers, Step 6 greps, `git diff main` in the worktree) — nothing needed re-opening. The 17 raw minors collapse to 12 narrative/citation fixes (all mechanical) and 2 small design decisions; the plan is ready for implementation once they land.

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | PASS | 0 critical, 0 major, 2 minor |
| 2 | Full-Stack Trace | PASS | 0 critical, 0 major, 0 minor |
| 3 | Ordering & Cleanup | PASS | 0 critical, 0 major, 2 minor |
| 4 | Integration & Conventions | PASS | 0 critical, 0 major, 4 minor |
| 5 | Verification & Coverage | PASS | 0 critical, 0 major, 4 minor |
| 6 | Completeness & Risk | PASS | 0 critical, 0 major, 5 minor |

Deduplicated total: **0 critical, 0 major, 14 minor** (Step 5 bottom-up ordering raised by #3/#5/#6; Step 8 volume-name tag by #4/#6).

### Findings

#### Minor (nice to fix)
- **[Step 1] `createChore` (37-51) / `updateChore` (62-80) cite the `db.prepare(...).run({...})` statements, not the function bodies (36-53 / 61-83)** _(#1)_ _(mechanical)_
- **[Step 1] DD-5 citation nit: routes.test.ts 117-118 is the DELETE test, not a second PUT test** _(#4)_ _(mechanical)_
- **[Step 1] Post-swap, the user-visible sort change already lands at Step 1's commit** _(#3)_: once `rowToChore` stops emitting `longTermTask`, the untouched `orderChores` sees every chore as short-term; Step 3 removes now-dead partition code. Worth one sentence for the bisect/PR narrative. _(mechanical)_
- **[Step 2] Quoted TypeError should be `TypeError: dropLegacyChoreColumns is not a function`** _(#5)_: vitest 4.1.4 rewrites the SSR accessor name in the message (dry-run in this worktree). _(mechanical)_
- **[Step 3] "Remove every other `longTermTask:` override" — there are none outside the replaced test (lines 34/36)** _(#1)_ _(mechanical)_
- **[Step 4] Red state understated: the edited 'edit submit…' test is red too** _(#5)_: the payload still carries own `details: null` / `longTermTask: undefined` keys and `not.toHaveProperty` counts an own `undefined` key as present. _(mechanical)_
- **[Step 5] Bullet 1 (25-27 → one sentence) shifts the interface block before bullet 2 uses lines 42/48** _(#3, #5, #6)_: work bottom-up (48, 42, then 25-27, then the insertions); content anchors make it recoverable, hence minor. _(mechanical)_
- **[Step 6] Phase C fold target: META-PLAN line 512 is deleted with the F4 section; the literal survives at the Baseline Domain-model line (~255) and Chain-integrity bullet `plans/META-PLAN.md:843`** _(#4)_ _(mechanical)_
- **[Step 6] State that run-feature step 8's literal grep WILL return the (a)–(e) matches and that META-PLAN must not be edited on this branch to close it (step 10 requires the ledger row to be the only META-PLAN diff)** _(#4)_ _(mechanical)_
- **[Decisions / Step 6] "META-PLAN is not edited on this branch" is inaccurate — the run-feature ledger-row edit is already on the branch and must stay** _(#6)_ _(mechanical)_
- **[Step 8] Volume-name `_(unverified…)_` tag can be tightened with repo evidence (`deploy/pi/chores4irl-backup.service` `ExecStart=`, script `COMPOSE_FILE` default) and a `--filter/--format` discovery command; use `/home/rmilarachi/backups` (the script's `BACKUP_DIR` default) not `$HOME/backups`** _(#4, #6)_ _(mechanical)_
- **[Step 8] PR reconciliation should also note `fixtures/chore.ts` (META-PLAN Test-suite deltas) needed no change** _(#6)_ _(mechanical)_
- **[Step 3] No tsc/lint gate at the Step 3 boundary although every step is meant to be independently committable** _(#5)_ → **DD-10**.
- **[Step 5] README Pi-update caveat (DD-9) does not carry the crash-loud pointer (DD-8)** _(#6)_ → **DD-11**.

### Verification Gaps
None — Step 7 unchanged and complete; every prescribed test body was dry-run red/green against the current tree by #5 (scratch files deleted, tree clean apart from `plans/`).

### To-Do: Mechanical Fixes (auto-applied)
- [x] Step 1: function-vs-statement line ranges; DD-5 citation (PUT 86-87 / DELETE 117-118); sort-change-lands-here note
- [x] Step 2: TypeError wording; Step 3: override sentence; Step 4: two-tests-red sentence
- [x] Step 5: reorder bullets bottom-up and reword the ordering preamble
- [x] Step 6 + Decisions: ledger-row exception wording; Phase C fold targets (~255, :843); run-feature step 8 note
- [x] Step 8: volume-name evidence + discovery command + absolute backups path; fixtures/chore.ts reconciliation line _(all applied by fixing subagents; dry-runs: chores.ts function spans 36-53/61-83, routes.test.ts describe map, vitest 4.1.4, choreSort.test.ts lines 34/36, ChoreForm payload lines 59-72, README 7/25-27/39-49/169/184, META-PLAN :255/:843/:512, run-feature SKILL.md :45/:50/:52, backup script :12-13/service :10, fixtures/chore.ts)_

### Design Decisions (awaiting user input)

#### DD-10: [Step 3] Add a tsc/lint gate at the Step 3 boundary?
**Context:** Steps 1, 2 and 4 end with `npx tsc --noEmit -p …` + `npm run lint`; Step 3 ends with only `npm test --workspace frontend -- choreSort App`. Step 3 deletes `orderSubList` (lint `no-unused-vars` is error-level) and adds an `import type { Chore }`; vitest does not typecheck. Dry-run: the prescribed test compiles today and both gates are clean.

| # | Option | Trade-off |
|---|---|---|
| 1 | Append `npx tsc --noEmit -p frontend/tsconfig.json` and `npm run lint` to Step 3's final bullet | Consistent with Steps 1/2/4; self-verifying commit; ~20 s |
| 2 | Leave as written; note that Step 4's gate (same layer, next step) is the first typecheck after the Step 3 commit | One fewer gate; relies on Step 4 always following before `/git-push` |

**Chosen:** Option 1 — Add tsc + lint to Step 3. Step 3's final bullet now runs `npx tsc --noEmit -p frontend/tsconfig.json` and `npm run lint` after the vitest run, so the commit that deletes `orderSubList` and adds the type-only `Chore` import is self-verifying (both gates dry-run clean today, exit 0/0).

#### DD-11: [Step 5] Should the README Pi-update caveat also carry the crash-loud pointer?
**Context:** DD-8's "a failed DROP aborts boot on purpose; check `docker compose logs backend`" lives in the db.ts comment, the Decisions bullet and Step 8's PR runbook. The durable operator doc is the README paragraph DD-9 appends after line 184, which covers only snapshot-before-deploy and old-image incompatibility.

| # | Option | Trade-off |
|---|---|---|
| 1 | Append one clause to the Step 5 end-of-file paragraph: "If the frontend never comes up after the rebuild, run `docker compose logs backend` — a failed migration aborts the backend on purpose rather than running on a half-migrated schema." | Durable pointer where a future operator will look; Step 5's grep gate unaffected |
| 2 | Leave the README as planned | PR runbook + db.ts comment judged sufficient for a single-operator deployment |

**Chosen:** Option 1 — Add crash-loud clause to README. The Step 5 Pi-update paragraph gains the `docker compose logs backend` sentence (verified it matches none of Step 5's grep terms, so the "exactly one line: line 7" gate stands), and the Decisions crash-loud item now cross-references it.

---

### Verdict
[ ] Ready to proceed as-is
[x] Proceed after minor fixes
[ ] Requires changes before proceeding

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | #3 re-ran lint/tsc baselines (clean), re-traced every deletion post-swap; no deferred dead symbol |
| Type annotations | [x] | #1 re-verified `Transaction<F>.immediate` (@types/better-sqlite3:40), pragma cast, `as unknown as Chore`, backend `Chore` import path |
| Error handling (status codes, exceptions, user feedback) | [x] | #2 re-traced all six routes at both new step boundaries; codes unchanged; `inTransaction` false after `.immediate()` |
| Test coverage (happy path, sad path, edge cases) | [x] | #5 re-ran every prescribed test body as scratch (red/green as claimed), both suites 4/32 & 29/252, Step 6/7 gates |
| Breaking changes (API contracts, shared state, DB schema) | [x] | #6 re-verified rollback asymmetry, two-connection `.immediate()` behaviour, no other API consumers |
| Config consistency (env vars, requirements pins, lint rules) | [x] | #4 re-verified ci.yml, compose/Dockerfile/backup unit, `.gitignore`, run-feature steps 3/8/10 vs DD-1 |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | #4: no repo CLAUDE.md/ARCHITECTURE.md; global rules honoured; naming consistent |

### Missed-Finding Root Causes
| Finding | Root cause | Skill gap? |
|---|---|---|
| Step 5 bottom-up ordering (25-27 replacement shifts 42/48) | **Fix verification stopped at plan text** — the Pass-1 README fixer dry-ran each line number individually but wrote an ordering claim without simulating the sequence of edits on one file | Possible gap: fixing-subagent dry-run rule covers single gates, not multi-edit line-number sequences in one file |
| Step 2 TypeError string (`__vite_ssr_import_N__` vs repo's `dropLegacyChoreColumns is not a function`) | **Other** — Pass-1 reviewers verified the string in a scratch vitest project, not the target repo's toolchain/transform | Possible gap: "verify before writing" should require running runtime-observable checks inside the target repo |
| Phase C fold target (`META-PLAN:512` is deleted with the F4 section; literal survives at `:255`/`:843`) | **Scoped too narrowly** — Pass-1 integration/completeness checked only the F4 section's bullet, not other META-PLAN restatements of the same fact | Instructions already cover this (enumerate-all-instances sweep) — execution miss |
| Step 3 lacks tsc/lint gate | **Trusted plan assertion** — Pass-1 verification accepted the vitest run as the step's gate without comparing it to sibling steps' gates | Instructions already cover this ("Verification exists" per step) — execution miss |
| `createChore`/`updateChore` ranges label statements, not functions; Step 3 "every other override" | **Trusted plan assertion** — Pass-1 correctness confirmed each cited edit line but not the range labels/quantifiers | Instructions already cover this — execution miss |
| DD-5 citation (117-118 is the DELETE test) | **Fix verification stopped at plan text** — Pass-1 verification's own DD option text carried the mislabel into the plan | Instructions already cover this |
| "META-PLAN not edited on this branch" vs the ledger-row diff; Step 4 two-tests-red; sort change lands at Step 1; README crash-loud pointer; `fixtures/chore.ts` reconciliation; volume-name tag | **Other** — consequences of Pass-1 DD-1/DD-3/DD-8/DD-9 edits reviewed for the first time in Pass 2 (iteration, not a miss) | No gap |

Recurring: two findings share "verified outside the target context" (scratch project string; ordering claim not simulated) — flagged for Step 7.

### Skill Improvements Applied
| # | Finding | Subagent | Gap type | Change | Status |
|---|---|---|---|---|---|
| 1 | Step 5 bottom-up ordering (multi-edit line-number sequence) | fixing-subagent | prompt_gap | SKILL.md Step 5b item 2: added "A sequence of edits is also a rule" — simulate the whole edit sequence on a `$TMPDIR` copy, reorder bottom-up or re-anchor on content | Applied |
| 2 | Step 2 TypeError string reproduced in a scratch project | #1 (+ fixing-subagent) | prompt_ambiguity | `references/subagent-prompts.md`: "Verify before writing" rewritten to require the target repo's own toolchain/config (throwaway test inside the workspace, deleted after); SKILL.md Step 5b "scratch directory or real file" tightened; `dry_run` JSON field now names directory + toolchain + command | Applied |
| 3 | Recurring: verification performed outside the target context | #1, #3, fixing-subagent, dd-application | structural | New shared **Verification locus** paragraph in `references/subagent-prompts.md` (in-repo toolchain; sequences simulated whole; locus reported), cross-referenced from SKILL.md Step 5b item 2 and Step 5f item (1) | Applied |
| 4 | Phase C fold target (`META-PLAN:255`/`:843`) | #4 | no_skill_gap | — (enumerate-all-instances sweep already covers it) | Skipped (no gap) |
| 5 | Step 3 lacks tsc/lint gate | #5 | no_skill_gap | — ("Verification exists"/"Deferred cleanup commit gate" already cover it) | Skipped (no gap) |
| 6 | Range labels / "every other override" quantifier | #1 | no_skill_gap | — | Skipped (no gap) |
| 7 | DD-5 citation (117-118 is the DELETE test) | #5 | no_skill_gap | — (DD option viability + Step 5f verify-every-observable already cover it) | Skipped (no gap) |
| 8 | Consequences of Pass-1 DD-1/3/8/9 edits | dd-application | no_skill_gap | — (first review of new text; iteration, not a miss) | Skipped (no gap) |
