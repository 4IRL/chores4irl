# Push Review: feature/remove-details-longterm

## Review 1
Generated: 2026-09-18
Comparison: origin/main (e488e28)...HEAD (31ae36f), 6 commits, 16 files
Verdict: **PUSHED WITH MINOR FINDINGS**

### Results by Reviewer

#### 1. Safety & Security — PASS
`ALTER TABLE … DROP COLUMN ${col}` interpolates only the module-scoped `as const` tuple `LEGACY_CHORE_COLUMNS`; no client input reaches it. No secrets, no new unsanitised boundary; stale-client keys never reach SQLite (explicit named-param literals).

#### 2. Correctness — PASS
Migration order CREATE TABLE IF NOT EXISTS → `dropLegacyChoreColumns(db)` → seed guard verified for fresh and legacy DBs; pragma read inside `transaction(...).immediate()`; seed INSERT columns match `SeedRow`; test DDL/assertions internally consistent.

#### 3. Simplicity & Conciseness — PASS (1 minor)
No dead code/imports after the deletions. Minor: the two-element `LEGACY_CHORE_COLUMNS` loop could be two straight-line guarded statements — taste, not required.

#### 4. Test Coverage — PASS (1 minor)
7 migration tests + 4 stale-key tests + F4 absence test + stale-flag sort test cover the behavioural changes. Minor: the `BEGIN IMMEDIATE` concurrency claim in the `db.ts` comment is documented but not exercised by a two-connection test.

#### 5. Completeness & Cleanup — PASS
No debug code, TODOs, stubs, or stale comments; README/comment claims match code.

#### 6. Consistency & Style — PASS (1 minor)
Naming, ESM `.js`/`node:` imports, indent, fixtures and describe tags all match siblings. Minor: `db-migration.test.ts` `rowCount` aliases `COUNT(*) AS c` / `{ c: number }` while `db.ts` uses `as count` / `{ count: number }` for the same shape.

#### 7. Integration Risk — PASS
Single wire consumer (this frontend); old kiosk bundle degrades gracefully; migration deployment path, rollback asymmetry and CI impact all documented (README + PR runbook); no dependency or config changes.

#### 8. Error Handling & Silent Failures — PASS (2 minor)
Crash-loud migration verified: nothing in server.ts → app.ts → chores.ts → db.ts wraps the import. Minor: an optional `console.error('[db] F4 legacy-column migration failed:', err); throw err;` would add a greppable tag before the stack trace. Minor (no change needed): silent-ignore of stale `details`/`longTermTask` keys is the right call vs a 400 during the kiosk rollout window.

#### 9. Type Design — PASS
`Chore`, `ChoreRow`, `SeedRow`, `FormState` trimmed in lockstep; create/update param literals symmetric; no orphaned assumptions.

### To-Do: Required Changes

- [ ] **Rename the count alias in the migration test helper** — `backend/src/__tests__/db-migration.test.ts` (`rowCount`) — use `SELECT COUNT(*) AS count FROM chores` / `{ count: number }` to match `backend/src/db.ts`'s existing convention for the same query
- [ ] **Add a greppable log line before the migration rethrows** — `backend/src/db.ts` (`dropLegacyChoreColumns` body or its module-load call) — wrap in `try { … } catch (err) { console.error('[db] F4 legacy-column migration failed:', err); throw err; }` so crash-loud behaviour is unchanged but the log carries an explicit tag
- [ ] **Add a two-connection `BEGIN IMMEDIATE` test (optional)** — `backend/src/__tests__/db-migration.test.ts` — open two better-sqlite3 connections on one legacy temp file, call `dropLegacyChoreColumns` on both without closing the first, assert the second either serialises to a 7-column no-op or throws `SQLITE_BUSY` as the comment documents
- [ ] **Inline the two guarded ALTER statements (optional, taste)** — `backend/src/db.ts` — replace the `LEGACY_CHORE_COLUMNS` loop with two straight-line `if (present.has('details')) …` / `if (present.has('long_term_task')) …` statements
