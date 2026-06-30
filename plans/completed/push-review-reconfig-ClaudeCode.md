> **STATUS: Frozen push-review** for reconfig/ClaudeCode (#4/#5, `af4ebff`); all 20 findings
> resolved at push time. Historical record, do not edit.

# Push Review: reconfig/ClaudeCode

## Review 1
Generated: 2026-04-10 00:00
Comparison: origin/main...HEAD
Verdict: **BLOCKED**

### Results by Reviewer

#### 1. Safety & Security — PASS
No security vulnerabilities. All SQL uses parameterized prepared statements, `:id` params are validated with `parseInt`, no secrets committed, JSX escapes output by default.

#### 2. Correctness — PASS
All logic paths correct. Optimistic update rollbacks capture the right snapshot, `handleResponse` correctly distinguishes `null` vs `undefined` for DELETE, in-memory DB isolation via `TEST_DB_PATH` is properly gated.

#### 3. Simplicity & Conciseness — PASS
Minor findings (non-blocking):
- The `if (choreText)` null guard in `e2e/smoke.spec.ts` delete test is dead code — `textContent()` never returns `null` for an existing locator.
- `localNoon` helper duplicated across two test files — minor at this scope.

#### 4. Test Coverage — PASS
Full coverage across backend unit, route integration, frontend hook/util/service, and E2E layers. All changed behavior exercised.

#### 5. Completeness & Cleanup — PASS
No debug artifacts, TODO comments, stubs, or incomplete implementations. `console.log` in server startup is acceptable operational logging.

#### 6. Consistency & Style — FAIL
- **Mixed function declaration styles in `App.tsx`:** `handleDeleteChore` uses `const` arrow function syntax while `handleCompleteChore` uses `async function` declaration — both in the same component, inconsistent within the file.
- **Test setup file misplaced:** `frontend/src/test/setup.ts` lives outside `frontend/src/__tests__/` where all other test files are colocated — breaks the established test file convention.
- **`page.waitForTimeout(500)` in `e2e/smoke.spec.ts`:** Playwright anti-pattern — should use a deterministic selector wait instead.

#### 7. Integration Risk — PASS
Backend split (`router.ts` → `app.ts` + `server.ts`) is clean. All cross-module contracts intact. The pre-existing `start` script pointing to `dist/index.js` (no such file) is not a regression introduced here.

---

### To-Do: Required Changes

- [x] **Standardize function declaration style in `App.tsx`** — `frontend/src/App.tsx` — Change `handleDeleteChore` from `const` arrow function to `async function` declaration to match the style of `handleCompleteChore` (or vice versa — pick one style and apply consistently within the component).

- [x] **Move test setup file into `__tests__/` directory** — `frontend/src/test/setup.ts` → `frontend/src/__tests__/setup.ts` — Relocate the file to match the test colocation convention used by all other test files. Update the `setupFiles` path in `frontend/vitest.config.ts` from `'./src/test/setup.ts'` to `'./src/__tests__/setup.ts'`.

- [x] **Replace `page.waitForTimeout(500)` with deterministic wait** — `e2e/smoke.spec.ts` (the "persists completed chore date after page reload" test) — Replace `await page.waitForTimeout(500)` with `await page.waitForResponse(resp => resp.url().includes('/api/chores') && resp.request().method() === 'PATCH')` or similar network-idle wait so the test doesn't rely on a fixed delay.

- [x] **Remove dead null guard in delete E2E test**

---

## Review 2
Generated: 2026-04-10 00:00
Comparison: origin/main...HEAD
Verdict: **BLOCKED**

### Results by Reviewer

#### 1. Safety & Security — PASS
No security issues. Parameterized SQL throughout, id validated as numeric before use, no secrets committed, no XSS vectors, TEST_DB_PATH only accepts literal `:memory:`.

#### 2. Correctness — PASS
All logic correct. Minor notes: `prev` snapshot for rollback is safe in practice; `TEST_DB_PATH` seed guard uses `!process.env.TEST_DB_PATH` rather than strict `=== ':memory:'` equality (harmless in current setup); E2E delete test 15-char text slice is slightly fragile.

#### 3. Simplicity & Conciseness — PASS
Minor: `mockErrorResponse` helper in `choreApi.test.ts` is defined but never called (dead code). `ChoreTimerBar` local state/useEffect pattern is a pre-existing structural issue, not introduced here.

#### 4. Test Coverage — FAIL
- No component tests for `ChoreTimerBar`: the new delete button (stopPropagation, aria-label, onDelete prop) and the `useEffect` sync are untested at the unit level.
- No component test for `ChoreList`: the new `onDelete` prop threading is untested.
- `handleDeleteChore` in `App.tsx` (optimistic remove + rollback on failure) has no unit or integration test — only the E2E suite exercises the delete flow, and only the happy path.

#### 5. Completeness & Cleanup — PASS
No debug artifacts, TODOs, stubs, or WIP state. All new files are fully implemented.

#### 6. Consistency & Style — PASS
Minor: `frontend/vitest.config.ts` uses 4-space indentation while `frontend/vite.config.ts` uses 2-space — the two frontend config files are inconsistent.

#### 7. Integration Risk — PASS
Minor: E2E CI step installs only Chromium (`npx playwright install --with-deps chromium`) but `playwright.config.ts` uses `devices['Desktop Chrome']` — these are consistent. However, `vite.config.ts` adds `open: true` which will attempt to open a browser on `npm run dev` — harmless in CI but unexpected for developers.

---

### To-Do: Required Changes

- [x] **Add component tests for `ChoreTimerBar` delete behavior** — `frontend/src/__tests__/` (new file, e.g. `components/ChoreTimerBar.test.tsx`) — Test that: (1) the delete button renders with `aria-label="Delete chore"`, (2) clicking it calls `onDelete` with the correct chore id, (3) clicking it does NOT call `onComplete` (stopPropagation working), and (4) the `useEffect` updates local `dateLastCompleted` when the `chore` prop changes.

- [x] **Add component test for `ChoreList` onDelete prop wiring** — `frontend/src/__tests__/` (new file, e.g. `components/ChoreList.test.tsx`) — Render `ChoreList` with a mock `onDelete` and verify it is passed through to each `ChoreTimerBar` instance.

- [x] **Add unit test for `handleDeleteChore` rollback in `App.tsx`** — `frontend/src/__tests__/` (new file or within an existing App test) — Mock `removeChore` to reject, call `handleDeleteChore`, and assert: (1) the chore is optimistically removed from state, (2) on rejection the chore is restored in state, and (3) `error` state is set. Use `renderHook` or render `App` with mocked API module.

- [x] **Remove dead `mockErrorResponse` helper** — `frontend/src/__tests__/services/choreApi.test.ts` — The `mockErrorResponse` function is defined but never called in the file. Remove it.

- [x] **Fix `frontend/vitest.config.ts` indentation** — `frontend/vitest.config.ts` — Change indentation from 4 spaces to 2 spaces to match `frontend/vite.config.ts` and the rest of the frontend config files. — `e2e/smoke.spec.ts` (the "deletes a chore" test) — `textContent()` on an existing locator never returns `null`, so the `if (choreText)` guard is dead code. Simplify to: `await expect(page.locator(\`text=\${choreText!.trim().slice(0, 20)}\`)).not.toBeVisible({ timeout: 5_000 })`.

---

## Review 3
Generated: 2026-04-10 12:00
Comparison: origin/main...HEAD
Verdict: **BLOCKED**

### Results by Reviewer

#### 1. Safety & Security — PASS
No critical or major vulnerabilities. SQL uses parameterized queries throughout; no secrets committed; destructive routes validate input. Minor: overly permissive CORS (wildcard), missing field-type/enum validation on POST body, missing date string validation on PATCH, server binds to all interfaces.

#### 2. Correctness — FAIL
One major: optimistic rollback in `handleDeleteChore` (App.tsx:51) uses a stale closure snapshot via a non-functional setter — concurrent state updates between the optimistic remove and the rollback will be silently overwritten. Minor: `handleResponse` null vs. undefined guard is semantically incomplete for DELETE's `data: null`; WAL pragma applied to in-memory test DB (no-op but misleading); E2E delete test brittle against pre-existing DB state.

#### 3. Simplicity & Conciseness — FAIL
One major: `ChoreTimerBar` holds unnecessary derived local state for `dateLastCompleted` via `useState` + `useEffect` sync — parent prop is always authoritative after server reconciliation. Minor: `makeChore` factory duplicated across 4 test files; `localNoon` duplicated across 2 test files; redundant `<div>` wrapper in `ChoreList.tsx`; inconsistent env-var checks in `db.ts`; `mockResponse` helper doesn't cover error shape.

#### 4. Test Coverage — FAIL
Three major gaps: `handleCompleteChore` (optimistic update + server reconciliation + rollback) is entirely untested; `handleAddChore` has no App-level test; `fetchAllChores` failure path (error banner, loading cleared) is untested. Minor: `removeChore`, `addChore`, `completeChore` error paths untested in choreApi.test.ts; delete E2E assertion uses fragile 20-char prefix; no E2E test for delete rollback path.

#### 5. Completeness & Cleanup — FAIL
Two major: `server.open: true` committed to `frontend/vite.config.ts` auto-opens a browser tab for all contributors on every `npm run dev`; `backend/src/server.ts` startup log has hardcoded port 3000 that won't stay in sync if port changes. Minor: delete E2E test uses fragile text slice selector; `.gitignore` missing trailing newline; `playwright.config.ts` defines Firefox project but CI installs Chromium — E2E will fail in CI.

#### 6. Consistency & Style — PASS
Minor only: single-letter variable names (`d`, `y`, `m`, `r`, `c`) in arrow callbacks and test helpers; `localNoon` destructuring uses single-letter bindings; minor indentation divergence between `frontend/vitest.config.ts` and `backend/vitest.config.ts`.

#### 7. Integration Risk — PASS
All changes are additive. No breaking API, schema, or cross-module issues. Minor: `TEST_DB_PATH` env var undocumented; `open: true` in vite.config is noisy in headless environments; `onDelete` as required prop enforced by TypeScript at compile time; E2E `beforeEach` coupled to a specific seed chore name.

---

### To-Do: Required Changes

- [x] **Fix stale closure in `handleDeleteChore` rollback** — `frontend/src/App.tsx` (~line 51) — Captured the specific deleted chore by id before the optimistic remove (`deletedChore = choreData.find(...)`), then used a functional rollback `setChoreData(curr => curr.some(...) ? curr : [...curr, deletedChore])`. Applied the same pattern to `handleCompleteChore`: captured `originalChore` by id, rollback uses `setChoreData(curr => curr.map(chore => chore.id === id ? originalChore : chore))`. This is safer than the review's suggested fix which still referenced a closure-captured snapshot array.

- [x] **Remove local `dateLastCompleted` state from `ChoreTimerBar`** — `frontend/src/components/chore/ChoreTimerBar.tsx` — Delete `const [dateLastCompleted, setDateLastCompleted] = useState(chore.dateLastCompleted)` and its `useEffect` sync. Replace all usages of the local variable with `chore.dateLastCompleted` directly; the `daysSince` memo will recompute correctly from the prop.

- [x] **Add `handleCompleteChore` tests to App.test.tsx** — `frontend/src/__tests__/App.test.tsx` — Add `describe('handleCompleteChore')` covering: (1) optimistic update visible before server resolves, (2) UI reconciled with server-returned value on success, (3) rollback + error state set on `completeChore` rejection.

- [x] **Add `handleAddChore` tests to App.test.tsx** — `frontend/src/__tests__/App.test.tsx` — Add tests for: (1) new chore appears in list after `addChore` resolves, (2) error banner shown when `addChore` rejects.

- [x] **Add `fetchAllChores` failure-path test to App.test.tsx** — `frontend/src/__tests__/App.test.tsx` — Add a test where `fetchAllChores` rejects; verify the error banner is shown and the loading state is cleared.

- [x] **Remove `server.open: true` from vite.config.ts** — `frontend/vite.config.ts` — Remove or gate the `open: true` line behind an env-var check (e.g. `open: !process.env.CI`) to avoid auto-opening a browser for all contributors.

- [x] **Fix Playwright browser mismatch** — `playwright.config.ts` and `.github/workflows/ci.yml` — Either change `playwright.config.ts` projects to use `chromium` / `Desktop Chrome` (matching the CI install), or change the CI install step to `npx playwright install --with-deps firefox` and keep Firefox in the config. Currently CI installs Chromium but tests run on Firefox, causing E2E failures in CI.

- [x] **Parameterize port in `backend/src/server.ts`** — `backend/src/server.ts` — Replace hardcoded `3000` in the startup log with `const PORT = process.env.PORT ?? 3000; app.listen(PORT, () => console.log(\`chores4irl backend listening on port \${PORT}\`))` so the log stays in sync with the actual port.

- [x] **Add error-path tests for `removeChore`, `addChore`, `completeChore`** — `frontend/src/__tests__/services/choreApi.test.ts` — Add tests for each that mock `fetch` to return `{ success: false, error: '...' }` and assert the function rejects with that message.

- [x] **Extract shared `makeChore` fixture** — `frontend/src/__tests__/fixtures/chore.ts` (new file) — Move the `makeChore` factory (and `localNoon` helper) into a shared fixtures file and import from all four test files that currently duplicate it.

- [x] **Fix single-letter variable names** — `frontend/src/__tests__/hooks/useChoreSort.test.ts`, `frontend/src/__tests__/utils/choreSort.test.ts`, `backend/src/db.ts`, `frontend/src/App.tsx` — Rename: `d` → `baseDate`, `[y, m, d]` → `[year, month, day]` in `localNoon`, `r` → `row` in the `for` loop in `db.ts`, `c =>` → `chore =>` in App.tsx arrow callbacks.
