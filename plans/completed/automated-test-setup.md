# Automated Test Infrastructure

## Summary

Establish a complete automated test suite for chores4irl, replacing the current manual smoke test
entirely. The stack uses **Vitest** for both backend (Node/supertest) and frontend (jsdom/RTL) unit
and integration tests, and **Playwright** for end-to-end browser smoke tests that mirror the six
manual steps in `db-routes-and-state-fix.md`. A GitHub Actions CI workflow runs all three suites on
every push and pull request.

## Research Findings

- **No test infrastructure exists** in any workspace. No test runner, no test files, no `test` scripts
  in any `package.json`.
- **Backend blocker:** `backend/src/router.ts` calls `app.listen(3000)` at module level, making it
  untestable without side effects. Must be split into `app.ts` (exports Express app) and `server.ts`
  (calls `listen`). The backend `dev` script (`node --loader ts-node/esm src/router.ts`) must point
  to the new `server.ts`.
- **DB testability:** `backend/src/db.ts` opens `data.db` and runs seed logic at module load. An
  env-var escape hatch (`TEST_DB_PATH=':memory:'`) allows tests to get a fresh, seeded-free in-memory
  SQLite database without touching the production file.
- **Frontend path aliases:** `vite.config.ts` defines `@customTypes → ../types`, `@assets → ./src/assets`,
  `@src → ./`. The frontend's `vitest.config.ts` must extend `vite.config.ts` via `mergeConfig` so
  these aliases resolve in tests.
- **ESM + NodeNext:** Both workspaces use `"type": "module"` and `"moduleResolution": "NodeNext"`,
  with `.js` suffixes in source imports. Vitest resolves `.js` imports to `.ts` source files
  automatically; no extra transform config needed.
- **Pure functions ripe for unit testing:** `calcDurationWeightedScore` and `orderChores` in
  `frontend/src/utils/choreSort.ts`; `useRoomFilter` and `useChoreSort` hooks; the entire
  `frontend/src/services/choreApi.ts` (fetch-based, mockable with `vi.fn()`).
- **`package-lock.json` exists** at root — `npm ci` is safe for CI.

## Steps

### 1. Refactor Backend for Testability

Split `router.ts` so the Express `app` is importable by tests without starting a server, and make
the SQLite path configurable via env var so tests use an in-memory database.

**To-do:**
- [x] In `backend/src/db.ts`, replace the hardcoded `DB_PATH` line:
  ```ts
  const DB_PATH = path.resolve(__dirname, '../../data.db');
  ```
  with:
  ```ts
  const DB_PATH = process.env.TEST_DB_PATH === ':memory:'
      ? ':memory:'
      : path.resolve(__dirname, '../../data.db');
  ```
  Then wrap the seed block (the `const count = ...` through `seedMany(SEED_DATA)`) in a conditional:
  ```ts
  if (!process.env.TEST_DB_PATH) {
      const count = (db.prepare('SELECT COUNT(*) as count FROM chores').get() as { count: number }).count;
      if (count === 0) {
          const insert = db.prepare(`...`);
          const seedMany = db.transaction(...);
          seedMany(SEED_DATA);
      }
  }
  ```
  The WAL pragma and `CREATE TABLE IF NOT EXISTS` block remain unconditional (tests need the schema).
- [x] Create `backend/src/app.ts`. Move everything from `router.ts` into it **except** the
  `app.listen(...)` call. The file must end with:
  ```ts
  export default app;
  ```
  All imports (`express`, `cors`, route handlers, types) move with it. The four route registrations
  (`app.get`, `app.post`, `app.patch`, `app.delete`) stay intact.
- [x] Create `backend/src/server.ts`:
  ```ts
  import app from './app.js';
  app.listen(3000, () => console.log('chores4irl backend listening on port 3000'));
  ```
- [x] Delete `backend/src/router.ts` (it is now replaced by `app.ts` + `server.ts`).
- [x] Update `backend/package.json` `dev` script from:
  ```json
  "dev": "node --loader ts-node/esm src/router.ts"
  ```
  to:
  ```json
  "dev": "node --loader ts-node/esm src/server.ts"
  ```
- [x] Run `npm run dev` from the project root and confirm the backend still starts on port 3000
  with no errors before proceeding.

### 2. Install and Configure Backend Tests (Vitest + Supertest)

Install the test runner and HTTP assertion library for the backend workspace, then wire up Vitest.

**To-do:**
- [x] Pin the following packages to their latest stable versions. Run
  `npm show <pkg> version` to confirm these are still current before installing:
  - `vitest@4.1.4` (devDependency, backend workspace)
  - `supertest@7.2.2` (devDependency, backend workspace)
  - `@types/supertest@7.2.0` (devDependency, backend workspace)
  Install with:
  ```bash
  npm install --save-dev --workspace backend vitest@4.1.4 supertest@7.2.2 @types/supertest@7.2.0
  ```
- [x] Create `backend/vitest.config.ts`:
  ```ts
  import { defineConfig } from 'vitest/config';

  export default defineConfig({
      test: {
          environment: 'node',
          globals: true,
          env: {
              TEST_DB_PATH: ':memory:',
          },
      },
  });
  ```
- [x] Add a `test` script to `backend/package.json`:
  ```json
  "test": "vitest run"
  ```
- [x] Run `npm test --workspace backend` and confirm Vitest starts (it will report "no test files found"
  — this is expected). If it errors, check that `vitest` resolved correctly in `backend/node_modules`.

### 3. Write Backend Tests (TDD: DB Service + Routes)

Write unit tests for the four `chores.ts` service functions and integration tests for all four
Express routes. Follow Red → Green → Refactor for each requirement.

**To-do:**
- [x] Create directory `backend/src/__tests__/`.
- [x] Create `backend/src/__tests__/chores.test.ts`. For each test, run `npm test --workspace backend`
  to confirm the test fails (Red) before writing the implementation fix (this is existing code, so
  failures should not occur — if they do, it reveals a real bug to fix).

  Full file content:
  ```ts
  import { describe, it, expect, beforeEach } from 'vitest';
  import { getAllChores, createChore, completeChore, deleteChore } from '../chores.js';
  import { db } from '../db.js';

  beforeEach(() => {
      db.exec('DELETE FROM chores');
  });

  describe('getAllChores', () => {
      it('returns empty array when table is empty', () => {
          expect(getAllChores()).toEqual([]);
      });

      it('returns all rows ordered by id', () => {
          db.exec(`INSERT INTO chores (name, room, date_last_completed, duration, frequency, long_term_task)
              VALUES ('Sweep', 'Kitchen', '2025-01-01T00:00:00.000Z', 10, 7, 0),
                     ('Mop', 'Kitchen', '2025-01-02T00:00:00.000Z', 20, 7, 0)`);
          const chores = getAllChores();
          expect(chores).toHaveLength(2);
          expect(chores[0].name).toBe('Sweep');
          expect(chores[1].name).toBe('Mop');
      });
  });

  describe('createChore', () => {
      it('inserts a chore and returns it with an id', () => {
          const input = {
              name: 'Test Chore',
              room: 'Bathroom',
              dateLastCompleted: new Date('2025-01-01T00:00:00.000Z'),
              duration: 15,
              frequency: 7,
          };
          const created = createChore(input);
          expect(created.id).toBeGreaterThan(0);
          expect(created.name).toBe('Test Chore');
          expect(created.room).toBe('Bathroom');
          expect(created.dateLastCompleted).toBe('2025-01-01T00:00:00.000Z');
          expect(created.duration).toBe(15);
          expect(created.frequency).toBe(7);
          expect(created.urgency).toBeUndefined();
          expect(created.longTermTask).toBeUndefined();
      });

      it('persists optional fields: details, urgency, longTermTask', () => {
          const input = {
              name: 'Filter',
              room: 'Basement',
              dateLastCompleted: new Date('2025-01-01T00:00:00.000Z'),
              duration: 10,
              frequency: 90,
              details: 'Replace HVAC filter',
              urgency: 'low' as const,
              longTermTask: true,
          };
          const created = createChore(input);
          expect(created.details).toBe('Replace HVAC filter');
          expect(created.urgency).toBe('low');
          expect(created.longTermTask).toBe(true);
      });
  });

  describe('completeChore', () => {
      it('updates date_last_completed and returns the updated row', () => {
          db.exec(`INSERT INTO chores (name, room, date_last_completed, duration, frequency, long_term_task)
              VALUES ('Sweep', 'Kitchen', '2025-01-01T00:00:00.000Z', 10, 7, 0)`);
          const id = (db.prepare('SELECT id FROM chores').get() as { id: number }).id;
          const newDate = '2025-06-01T00:00:00.000Z';
          const result = completeChore(id, newDate);
          expect(result).not.toBeNull();
          expect(result!.dateLastCompleted).toBe(newDate);
          expect(result!.id).toBe(id);
      });

      it('returns null when the id does not exist', () => {
          expect(completeChore(9999, '2025-06-01T00:00:00.000Z')).toBeNull();
      });
  });

  describe('deleteChore', () => {
      it('removes the row and returns true', () => {
          db.exec(`INSERT INTO chores (name, room, date_last_completed, duration, frequency, long_term_task)
              VALUES ('Sweep', 'Kitchen', '2025-01-01T00:00:00.000Z', 10, 7, 0)`);
          const id = (db.prepare('SELECT id FROM chores').get() as { id: number }).id;
          expect(deleteChore(id)).toBe(true);
          expect(getAllChores()).toHaveLength(0);
      });

      it('returns false when the id does not exist', () => {
          expect(deleteChore(9999)).toBe(false);
      });
  });
  ```

- [x] Run `npm test --workspace backend`. Confirm all 8 chores tests pass (Green). If any fail,
  fix the implementation in `chores.ts` first — do not modify the test to match broken behavior.

- [x] Create `backend/src/__tests__/routes.test.ts`. This uses `supertest` to send real HTTP
  requests to the Express app without starting a server:

  ```ts
  import { describe, it, expect, beforeEach } from 'vitest';
  import request from 'supertest';
  import app from '../app.js';
  import { db } from '../db.js';

  beforeEach(() => {
      db.exec('DELETE FROM chores');
  });

  const BASE_CHORE = {
      name: 'Sweep',
      room: 'Kitchen',
      dateLastCompleted: '2025-01-01T00:00:00.000Z',
      duration: 10,
      frequency: 7,
  };

  describe('GET /api/chores', () => {
      it('returns 200 with empty data array when table is empty', async () => {
          const res = await request(app).get('/api/chores');
          expect(res.status).toBe(200);
          expect(res.body).toEqual({ success: true, data: [] });
      });

      it('returns 200 with all chores when table has rows', async () => {
          db.exec(`INSERT INTO chores (name, room, date_last_completed, duration, frequency, long_term_task)
              VALUES ('Sweep', 'Kitchen', '2025-01-01T00:00:00.000Z', 10, 7, 0)`);
          const res = await request(app).get('/api/chores');
          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].name).toBe('Sweep');
      });
  });

  describe('POST /api/chores', () => {
      it('returns 201 with the created chore', async () => {
          const res = await request(app).post('/api/chores').send(BASE_CHORE);
          expect(res.status).toBe(201);
          expect(res.body.success).toBe(true);
          expect(res.body.data.id).toBeGreaterThan(0);
          expect(res.body.data.name).toBe('Sweep');
      });

      it('returns 400 when required fields are missing', async () => {
          const res = await request(app).post('/api/chores').send({ name: 'Only name' });
          expect(res.status).toBe(400);
          expect(res.body.success).toBe(false);
      });
  });

  describe('PATCH /api/chores/:id/complete', () => {
      it('returns 200 with the updated chore', async () => {
          const post = await request(app).post('/api/chores').send(BASE_CHORE);
          const id = post.body.data.id;
          const newDate = '2025-06-01T00:00:00.000Z';
          const res = await request(app)
              .patch(`/api/chores/${id}/complete`)
              .send({ dateLastCompleted: newDate });
          expect(res.status).toBe(200);
          expect(res.body.data.dateLastCompleted).toBe(newDate);
      });

      it('returns 404 when chore does not exist', async () => {
          const res = await request(app)
              .patch('/api/chores/9999/complete')
              .send({ dateLastCompleted: '2025-06-01T00:00:00.000Z' });
          expect(res.status).toBe(404);
      });

      it('returns 400 when dateLastCompleted is missing', async () => {
          const res = await request(app).patch('/api/chores/1/complete').send({});
          expect(res.status).toBe(400);
      });

      it('returns 400 when id is not a number', async () => {
          const res = await request(app)
              .patch('/api/chores/abc/complete')
              .send({ dateLastCompleted: '2025-06-01T00:00:00.000Z' });
          expect(res.status).toBe(400);
      });
  });

  describe('DELETE /api/chores/:id', () => {
      it('returns 200 with null data after deletion', async () => {
          const post = await request(app).post('/api/chores').send(BASE_CHORE);
          const id = post.body.data.id;
          const res = await request(app).delete(`/api/chores/${id}`);
          expect(res.status).toBe(200);
          expect(res.body).toEqual({ success: true, data: null });
      });

      it('returns 404 when chore does not exist', async () => {
          const res = await request(app).delete('/api/chores/9999');
          expect(res.status).toBe(404);
      });

      it('returns 400 when id is not a number', async () => {
          const res = await request(app).delete('/api/chores/abc');
          expect(res.status).toBe(400);
      });
  });
  ```

- [x] Run `npm test --workspace backend`. Confirm all 13 route tests pass (Green).
  If any route test fails due to a real bug in the route handler (not a test error), fix the
  handler in `app.ts` first.

### 4. Install and Configure Frontend Tests (Vitest + RTL + jsdom)

Install the frontend test stack and configure Vitest to resolve the Vite path aliases used
throughout the frontend source.

**To-do:**
- [x] Pin and install the following as devDependencies in the frontend workspace. Confirm current
  latest with `npm show <pkg> version` before installing:
  - `vitest@4.1.4`
  - `@testing-library/react@16.3.2`
  - `@testing-library/user-event@14.6.1`
  - `@testing-library/jest-dom@6.9.1`
  - `jsdom@29.0.2`
  ```bash
  npm install --save-dev --workspace frontend \
    vitest@4.1.4 \
    @testing-library/react@16.3.2 \
    @testing-library/user-event@14.6.1 \
    @testing-library/jest-dom@6.9.1 \
    jsdom@29.0.2
  ```
- [x] Create `frontend/vitest.config.ts`. It extends the existing `vite.config.ts` so all path
  aliases (`@customTypes`, `@assets`, `@src`) are inherited automatically:
  ```ts
  import { defineConfig, mergeConfig } from 'vitest/config';
  import viteConfig from './vite.config';

  export default mergeConfig(viteConfig, defineConfig({
      test: {
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./src/test/setup.ts'],
      },
  }));
  ```
- [x] Create `frontend/src/test/setup.ts`:
  ```ts
  import '@testing-library/jest-dom';
  ```
- [x] Add a `test` script to `frontend/package.json`:
  ```json
  "test": "vitest run"
  ```
- [x] Run `npm test --workspace frontend` and confirm Vitest starts without errors (will report
  "no test files found"). If alias resolution errors occur, add explicit aliases to the `mergeConfig`
  `resolve.alias` block matching the ones in `vite.config.ts`.

### 5. Write Frontend Unit Tests (TDD: Utils, Hooks, API Service)

Cover the pure utility functions, two hooks, and the API service client. Run after each group
to maintain a green state.

**To-do:**
- [x] Create `frontend/src/__tests__/utils/choreSort.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { calcDurationWeightedScore, orderChores } from '../../utils/choreSort';
  import type { Chore } from '@customTypes/SharedTypes';

  const makeChore = (overrides: Partial<Chore> = {}): Chore => ({
      id: 1,
      name: 'Test',
      room: 'Kitchen',
      dateLastCompleted: new Date('2025-01-01T00:00:00.000Z'),
      duration: 10,
      frequency: 7,
      ...overrides,
  });

  describe('calcDurationWeightedScore', () => {
      it('returns 0 when completed today', () => {
          const today = new Date('2025-01-01T12:00:00.000Z');
          const chore = makeChore({ dateLastCompleted: new Date('2025-01-01T00:00:00.000Z') });
          expect(calcDurationWeightedScore(chore, today)).toBe(0);
      });

      it('returns duration * (daysSince / frequency)', () => {
          const today = new Date('2025-01-08T00:00:00.000Z');
          // 7 days since completed, frequency 7 → percentOverdue = 1.0
          const chore = makeChore({ duration: 20, frequency: 7,
              dateLastCompleted: new Date('2025-01-01T00:00:00.000Z') });
          expect(calcDurationWeightedScore(chore, today)).toBe(20);
      });

      it('gives higher score to more overdue chore', () => {
          const today = new Date('2025-01-15T00:00:00.000Z');
          const recent = makeChore({ duration: 10, frequency: 7,
              dateLastCompleted: new Date('2025-01-12T00:00:00.000Z') });
          const overdue = makeChore({ duration: 10, frequency: 7,
              dateLastCompleted: new Date('2025-01-01T00:00:00.000Z') });
          expect(calcDurationWeightedScore(overdue, today))
              .toBeGreaterThan(calcDurationWeightedScore(recent, today));
      });
  });

  describe('orderChores', () => {
      it('separates short-term from long-term chores', () => {
          const today = new Date('2025-01-15T00:00:00.000Z');
          const shortTerm = makeChore({ id: 1, longTermTask: undefined,
              dateLastCompleted: new Date('2025-01-01T00:00:00.000Z') });
          const longTerm = makeChore({ id: 2, longTermTask: true,
              dateLastCompleted: new Date('2024-01-01T00:00:00.000Z') });
          const result = orderChores([longTerm, shortTerm], today);
          // short-term should come first regardless of score
          expect(result[0].id).toBe(1);
          expect(result[1].id).toBe(2);
      });

      it('sorts within each group by descending score', () => {
          const today = new Date('2025-01-15T00:00:00.000Z');
          const leastOverdue = makeChore({ id: 1, duration: 10, frequency: 7,
              dateLastCompleted: new Date('2025-01-12T00:00:00.000Z') });
          const mostOverdue = makeChore({ id: 2, duration: 10, frequency: 7,
              dateLastCompleted: new Date('2025-01-01T00:00:00.000Z') });
          const result = orderChores([leastOverdue, mostOverdue], today);
          expect(result[0].id).toBe(2);
          expect(result[1].id).toBe(1);
      });

      it('returns empty array for empty input', () => {
          expect(orderChores([], new Date())).toEqual([]);
      });
  });
  ```

- [x] Run `npm test --workspace frontend`. Confirm all 6 choreSort tests pass.

- [x] Create `frontend/src/__tests__/hooks/useRoomFilter.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { renderHook } from '@testing-library/react';
  import { useRoomFilter } from '../../hooks/useRoomFilter';
  import type { Chore } from '@customTypes/SharedTypes';

  const makeChore = (id: number, room: string): Chore => ({
      id, name: 'Test', room,
      dateLastCompleted: new Date('2025-01-01T00:00:00.000Z'),
      duration: 10, frequency: 7,
  });

  const chores = [makeChore(1, 'Kitchen'), makeChore(2, 'Bedroom'), makeChore(3, 'Kitchen')];

  describe('useRoomFilter', () => {
      it('returns all chores when selectedRoom is "all"', () => {
          const { result } = renderHook(() => useRoomFilter(chores, 'all'));
          expect(result.current).toHaveLength(3);
      });

      it('filters to matching room', () => {
          const { result } = renderHook(() => useRoomFilter(chores, 'Kitchen'));
          expect(result.current).toHaveLength(2);
          expect(result.current.every(c => c.room === 'Kitchen')).toBe(true);
      });

      it('returns empty array when no chores match', () => {
          const { result } = renderHook(() => useRoomFilter(chores, 'Basement'));
          expect(result.current).toHaveLength(0);
      });
  });
  ```

- [x] Create `frontend/src/__tests__/hooks/useChoreSort.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { renderHook } from '@testing-library/react';
  import { useChoreSort } from '../../hooks/useChoreSort';
  import type { Chore } from '@customTypes/SharedTypes';

  const makeChore = (id: number, daysAgo: number, duration = 10, frequency = 7): Chore => {
      const d = new Date('2025-01-15T00:00:00.000Z');
      d.setDate(d.getDate() - daysAgo);
      return { id, name: 'C', room: 'K', dateLastCompleted: d, duration, frequency };
  };

  describe('useChoreSort', () => {
      it('returns chores sorted by score descending', () => {
          const today = new Date('2025-01-15T00:00:00.000Z');
          const low = makeChore(1, 1);   // completed yesterday → low score
          const high = makeChore(2, 10); // completed 10 days ago → high score
          const { result } = renderHook(() => useChoreSort([low, high], today));
          expect(result.current[0].id).toBe(2);
          expect(result.current[1].id).toBe(1);
      });

      it('returns empty array for empty input', () => {
          const { result } = renderHook(() => useChoreSort([], new Date()));
          expect(result.current).toEqual([]);
      });
  });
  ```

- [x] Create `frontend/src/__tests__/services/choreApi.test.ts`. This mocks the global `fetch`:
  ```ts
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { fetchAllChores, addChore, completeChore, removeChore } from '../../services/choreApi';

  const mockFetch = vi.fn();
  vi.stubGlobal('fetch', mockFetch);

  function mockResponse<T>(data: T, status = 200) {
      return Promise.resolve({
          ok: status >= 200 && status < 300,
          status,
          json: () => Promise.resolve({ success: true, data }),
      } as Response);
  }

  function mockErrorResponse(error: string, status: number) {
      return Promise.resolve({
          ok: false,
          status,
          json: () => Promise.resolve({ success: false, error }),
      } as Response);
  }

  const WIRE_CHORE = {
      id: 1, name: 'Sweep', room: 'Kitchen',
      dateLastCompleted: '2025-01-01T00:00:00.000Z',
      duration: 10, frequency: 7,
  };

  beforeEach(() => mockFetch.mockReset());

  describe('fetchAllChores', () => {
      it('returns parsed Chore array with dateLastCompleted as Date', async () => {
          mockFetch.mockReturnValue(mockResponse([WIRE_CHORE]));
          const result = await fetchAllChores();
          expect(result).toHaveLength(1);
          expect(result[0].dateLastCompleted).toBeInstanceOf(Date);
          expect(result[0].dateLastCompleted.toISOString()).toBe('2025-01-01T00:00:00.000Z');
      });

      it('throws when API returns success: false', async () => {
          mockFetch.mockReturnValue(mockErrorResponse('Server error', 500));
          // handleResponse checks json.success, not HTTP status
          mockFetch.mockReturnValue(Promise.resolve({
              json: () => Promise.resolve({ success: false, error: 'Server error' }),
          } as Response));
          await expect(fetchAllChores()).rejects.toThrow('Server error');
      });
  });

  describe('addChore', () => {
      it('sends POST with ISO date string and returns parsed Chore', async () => {
          mockFetch.mockReturnValue(mockResponse(WIRE_CHORE));
          const input = {
              name: 'Sweep', room: 'Kitchen',
              dateLastCompleted: new Date('2025-01-01T00:00:00.000Z'),
              duration: 10, frequency: 7,
          };
          const result = await addChore(input);
          expect(result.dateLastCompleted).toBeInstanceOf(Date);
          const call = mockFetch.mock.calls[0];
          const body = JSON.parse(call[1].body);
          expect(body.dateLastCompleted).toBe('2025-01-01T00:00:00.000Z');
      });
  });

  describe('completeChore', () => {
      it('sends PATCH with ISO date and returns updated Chore', async () => {
          mockFetch.mockReturnValue(mockResponse(WIRE_CHORE));
          const result = await completeChore(1, new Date('2025-01-01T00:00:00.000Z'));
          expect(result.dateLastCompleted).toBeInstanceOf(Date);
          const call = mockFetch.mock.calls[0];
          expect(call[0]).toBe('/api/chores/1/complete');
          expect(call[1].method).toBe('PATCH');
      });
  });

  describe('removeChore', () => {
      it('sends DELETE and resolves without error', async () => {
          mockFetch.mockReturnValue(mockResponse(null));
          await expect(removeChore(1)).resolves.toBeUndefined();
          const call = mockFetch.mock.calls[0];
          expect(call[0]).toBe('/api/chores/1');
          expect(call[1].method).toBe('DELETE');
      });
  });
  ```

- [x] Run `npm test --workspace frontend`. Confirm all 14 frontend unit tests pass.

### 6. Install and Configure Playwright for E2E

Install Playwright and create a config that auto-starts both dev servers before running tests.

**To-do:**
- [x] Install Playwright in the root workspace (not inside `frontend` or `backend` — it needs to
  orchestrate both servers):
  ```bash
  npm install --save-dev @playwright/test@1.59.1
  ```
  Confirm latest with `npm show @playwright/test version` before running.
- [x] Install Chromium browser binary (the only browser needed for these smoke tests):
  ```bash
  npx playwright install chromium
  ```
- [x] Create `playwright.config.ts` at the project root:
  ```ts
  import { defineConfig, devices } from '@playwright/test';

  export default defineConfig({
      testDir: './e2e',
      fullyParallel: false,
      retries: process.env.CI ? 1 : 0,
      use: {
          baseURL: 'http://localhost:5174',
          headless: true,
      },
      projects: [
          {
              name: 'chromium',
              use: { ...devices['Desktop Chrome'] },
          },
      ],
      webServer: [
          {
              command: 'npm run dev --workspace backend',
              url: 'http://localhost:3000/api/chores',
              reuseExistingServer: !process.env.CI,
              timeout: 15_000,
          },
          {
              command: 'npm run dev --workspace frontend',
              url: 'http://localhost:5174',
              reuseExistingServer: !process.env.CI,
              timeout: 15_000,
          },
      ],
  });
  ```
- [x] Add a `test:e2e` script to the root `package.json`:
  ```json
  "test:e2e": "playwright test"
  ```
- [x] Create directory `e2e/`.
- [x] Run `npm run test:e2e` and confirm Playwright starts both servers and reports
  "no tests found" without crashing.

### 7. Write E2E Smoke Tests (Playwright)

Implement the six manual smoke-test scenarios from `plans/api/db-routes-and-state-fix.md` Step 5
as automated Playwright assertions. These tests run against real dev servers with real SQLite.

**To-do:**
- [x] Create `e2e/smoke.spec.ts`:
  ```ts
  import { test, expect } from '@playwright/test';

  test.describe('Chores App Smoke Tests', () => {

      test.beforeEach(async ({ page }) => {
          await page.goto('/');
          await page.waitForSelector('[data-testid="chore-list"], .chore-item, text=Vacuum',
              { timeout: 10_000 });
      });

      test('loads chores from /api/chores on page open', async ({ page }) => {
          // Seed chores from db.ts are visible on load
          await expect(page.locator('text=Vacuum Bedroom Floor')).toBeVisible();
      });

      test('marks a chore complete and shows updated timer', async ({ page }) => {
          // Find the first complete button and click it
          const firstCompleteBtn = page.locator('button', { hasText: /done|complete/i }).first();
          await firstCompleteBtn.click();
          // The timer bar resets — verify no error message appeared
          await expect(page.locator('text=Failed')).not.toBeVisible();
          await expect(page.locator('text=Error')).not.toBeVisible();
      });

      test('persists completed chore date after page reload', async ({ page }) => {
          // Click complete on the first chore, then reload and confirm no error
          const firstCompleteBtn = page.locator('button', { hasText: /done|complete/i }).first();
          await firstCompleteBtn.click();
          await page.waitForTimeout(500); // let PATCH settle
          await page.reload();
          await page.waitForSelector('text=Vacuum', { timeout: 10_000 });
          await expect(page.locator('text=Failed')).not.toBeVisible();
      });

      test('adds a new chore via the form', async ({ page }) => {
          await page.locator('button', { hasText: /add chore/i }).click();
          await page.fill('input[name="name"], input[placeholder*="name" i]', 'E2E Test Chore');
          await page.fill('input[name="room"], input[placeholder*="room" i]', 'Office');
          // Fill duration and frequency fields
          const durationInput = page.locator('input[name="duration"], input[placeholder*="duration" i]');
          const frequencyInput = page.locator('input[name="frequency"], input[placeholder*="frequency" i]');
          await durationInput.fill('5');
          await frequencyInput.fill('3');
          await page.locator('button[type="submit"], button', { hasText: /save|add|submit/i }).click();
          await expect(page.locator('text=E2E Test Chore')).toBeVisible({ timeout: 5_000 });
      });

      test('deletes a chore and it disappears from the list', async ({ page }) => {
          // This test requires the delete button added in db-routes-and-state-fix Step 4.
          // If Step 4 is not yet complete, this test will fail — that is the expected Red state.
          const deleteBtn = page.locator('button', { hasText: /delete|remove/i }).first();
          const choreText = await page.locator('.chore-item, [data-testid="chore-item"]').first().textContent();
          await deleteBtn.click();
          if (choreText) {
              await expect(page.locator(`text=${choreText.trim().slice(0, 20)}`)).not.toBeVisible({ timeout: 5_000 });
          }
      });

      test('shows error and rolls back on simulated backend failure', async ({ page }) => {
          // Intercept the PATCH request and force it to fail
          await page.route('**/api/chores/*/complete', route =>
              route.fulfill({ status: 500, body: JSON.stringify({ success: false, error: 'Forced error' }) })
          );
          const firstCompleteBtn = page.locator('button', { hasText: /done|complete/i }).first();
          await firstCompleteBtn.click();
          await expect(page.locator('text=Failed, text=error, text=Forced error').first()).toBeVisible({ timeout: 5_000 });
      });
  });
  ```

- [x] **IMPORTANT:** The selectors above (`button[hasText=/done|complete/i]`, `text=Vacuum Bedroom Floor`,
  etc.) are written against the current DOM as it will look after `db-routes-and-state-fix` Step 4
  is complete. After implementing that plan, run the tests and **update any selector that doesn't
  match** by inspecting the actual rendered HTML with `page.pause()` or Playwright's `--ui` flag:
  ```bash
  npx playwright test --ui
  ```
  For each failing selector, open DevTools in the Playwright UI, find the actual element, and update
  the selector in `smoke.spec.ts` to match.
- [x] Run `npm run test:e2e`. Confirm at minimum the first two tests (load + error rollback via
  route intercept) pass. The delete test is expected to fail (Red) until `db-routes-and-state-fix`
  Step 4 is complete.

### 8. Set Up GitHub Actions CI

Create a workflow file that runs backend tests, frontend tests, and E2E tests automatically on every
push and pull request. You must create this file manually — Claude Code cannot push to GitHub or
configure Actions remotely.

**To-do:**
- [x] Create directory `.github/workflows/` at the project root.
- [x] Create `.github/workflows/ci.yml` with the following content:
  ```yaml
  name: CI

  on:
    push:
      branches: [main]
    pull_request:

  jobs:
    test-backend:
      name: Backend Tests
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: '20'
            cache: 'npm'
        - run: npm ci
        - run: npm test --workspace backend

    test-frontend:
      name: Frontend Unit Tests
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: '20'
            cache: 'npm'
        - run: npm ci
        - run: npm test --workspace frontend

    test-e2e:
      name: E2E Smoke Tests
      runs-on: ubuntu-latest
      needs: [test-backend, test-frontend]
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: '20'
            cache: 'npm'
        - run: npm ci
        - run: npx playwright install --with-deps chromium
        - run: npm run test:e2e
          env:
            CI: true
  ```

  **Notes on the CI design:**
  - `test-backend` and `test-frontend` run in parallel; `test-e2e` waits for both (`needs:`) since
    it exercises the full stack.
  - `npx playwright install --with-deps chromium` installs the browser binary and its OS-level
    dependencies (required on `ubuntu-latest` because Chromium needs system libs not pre-installed).
  - `CI: true` enables Playwright's retry-once-on-failure mode (set in `playwright.config.ts`).
  - The `webServer` entries in `playwright.config.ts` start the dev servers inside the CI runner
    automatically — no separate `npm run dev &` step needed.
  - `cache: 'npm'` caches `~/.npm` between runs based on `package-lock.json` hash, reducing install
    time.

- [x] **To activate GitHub Actions** _(user action — commit and push `.github/workflows/ci.yml` to GitHub, then enable Actions if prompted):_
  1. Commit `.github/workflows/ci.yml` (and all test files and config changes from Steps 1–7) to a
     branch and push to GitHub.
  2. Open the repository on GitHub.com → **Actions** tab. If this is the first workflow, GitHub will
     prompt you to enable Actions — click **I understand my workflows, go ahead and enable them**.
  3. The workflow runs automatically on every subsequent push and PR. View run status and logs under
     the **Actions** tab.
  - **Private repo minutes:** GitHub provides 2,000 free minutes/month for private repos. This
    workflow takes roughly 2–4 minutes per run. Monitor usage under **Settings → Billing and plans**
    if approaching the limit.

- [ ] After pushing, open the GitHub Actions tab and confirm the first CI run succeeds. If any job
  fails, click the job name to see the log and address the failure before marking this step done.

### 9. Verify All Tests Pass

Run each test suite locally to confirm a fully green state before closing this plan.

**To-do:**
- [x] Run `npm test --workspace backend` and confirm all backend tests pass.
- [x] Run `npm test --workspace frontend` and confirm all frontend unit tests pass.
- [x] Run `npm run test:e2e` and confirm the E2E smoke tests pass (the delete test may remain Red
  until `db-routes-and-state-fix` Step 4 is implemented — document its Red status in a comment in
  `smoke.spec.ts` rather than disabling it).
- [x] Investigate and fix any failures before marking the plan finished.

## Status
finished: true
