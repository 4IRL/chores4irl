> **STATUS: Merged** `20d3dbe` (#3 — "backend connected, data persistent"). Frozen —
> historical record, do not edit.

# Plan: Backend Connectivity for chores4irl

## Context

All chore data is currently hardcoded in `frontend/src/assets/database.ts` — a stop-gap noted with a `TODO: pull from Express` comment. The backend (`backend/src/router.ts`) is a stub that only returns "Hello World". A SQLite file (`backend/data.db`) exists but is unused.

The goal is to wire up the full stack: build a real SQLite-backed Express API, create a typed frontend service layer, and replace the hardcoded data source in `App.tsx` with live API calls. Completing a chore currently only updates local React state — after this work, completions and additions will persist across page refreshes.

The Vite proxy (`/api` → `localhost:3000`) is already configured. The shared `Chore` interface in `types/SharedTypes.ts` is already the contract between both sides. No schema changes to the interface are needed.

---

## Architecture

### New backend files

```
backend/src/
  db.ts       — SQLite connection, schema init (CREATE TABLE IF NOT EXISTS), idempotent seed
  chores.ts   — typed query service (getAllChores, createChore, completeChore, deleteChore)
  router.ts   — fully replaced: 4 API routes + body parser
```

### New frontend file

```
frontend/src/services/
  choreApi.ts — typed fetch wrapper with Date hydration (string → Date on receive)
```

### Modified frontend files

- `App.tsx` — fetch on mount, loading/error state, `handleCompleteChore`, no more `database.ts` import
- `ChoreList.tsx` — thread `onComplete` prop
- `ChoreTimerBar.tsx` — accept and call `onComplete` in `resetTask`

---

## API Surface

| Method | Path | Body | Returns |
|--------|------|------|---------|
| GET | `/api/chores` | — | `ApiResponse<Chore[]>` |
| POST | `/api/chores` | `Omit<Chore, 'id'>` | `ApiResponse<Chore>` |
| PATCH | `/api/chores/:id/complete` | `{ dateLastCompleted: string }` | `ApiResponse<Chore>` |
| DELETE | `/api/chores/:id` | — | `ApiResponse<null>` |

---

## SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS chores (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name                TEXT    NOT NULL,
    details             TEXT,
    room                TEXT    NOT NULL,
    date_last_completed TEXT    NOT NULL,    -- ISO 8601 string
    duration            INTEGER NOT NULL,
    frequency           INTEGER NOT NULL,
    urgency             TEXT    CHECK(urgency IN ('low', 'medium', 'high')),
    long_term_task      INTEGER NOT NULL DEFAULT 0  -- 0/1 boolean
);
```

Dates are stored as ISO strings (`date.toISOString()`). Booleans stored as 0/1 integers. `AUTOINCREMENT` prevents ID reuse after deletion.

---

## Key Gotchas

1. **ESM default import**: `better-sqlite3` is CJS. With `esModuleInterop: true` in tsconfig, use `import Database from 'better-sqlite3'` (default import). Do NOT use `import * as Database`.

2. **`.js` extensions on local imports**: With `"moduleResolution": "NodeNext"`, all local imports inside `backend/src/` must use `.js` extension even though the source files are `.ts`:
   ```typescript
   import { db } from './db.js';
   import type { Chore } from '../../types/SharedTypes.js';
   ```

3. **`app.use(express.json())`**: The stub router never added a body parser. Without it, `req.body` is `undefined` on POST/PATCH — the most likely silent failure.

4. **Date hydration on the frontend**: `JSON.parse` does not convert ISO date strings to `Date` objects. `choreApi.ts` must explicitly call `new Date(wire.dateLastCompleted)` after parsing each response.

5. **`longTermTask` mapping**: The original data omits the field entirely for non-long-term chores (makes it `undefined`, not `false`). The service must replicate this: `row.long_term_task === 1 ? true : undefined` — not `!!row.long_term_task` — because `choreSort.ts` tests `!c.longTermTask`.

6. **Delete `data.db` before first run**: The SQLite file may contain a stale or empty schema. Deleting it ensures the `CREATE TABLE IF NOT EXISTS` runs fresh and the seed populates correctly.

7. **Optimistic update in `handleCompleteChore`**: `ChoreTimerBar` updates its own local `dateLastCompleted` immediately. `App.tsx` must also update `choreData` optimistically so `useChoreSort` re-sorts on the next tick. Without this, the sort order doesn't reflect completions until the API call returns.

---

## Code Snippets

### `backend/src/db.ts`

```typescript
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '../../data.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
    CREATE TABLE IF NOT EXISTS chores (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        name                TEXT    NOT NULL,
        details             TEXT,
        room                TEXT    NOT NULL,
        date_last_completed TEXT    NOT NULL,
        duration            INTEGER NOT NULL,
        frequency           INTEGER NOT NULL,
        urgency             TEXT    CHECK(urgency IN ('low', 'medium', 'high')),
        long_term_task      INTEGER NOT NULL DEFAULT 0
    );
`);

type SeedRow = {
    name: string; details: string | null; room: string;
    date_last_completed: string; duration: number; frequency: number;
    urgency: string | null; long_term_task: number;
};

const count = (db.prepare('SELECT COUNT(*) as count FROM chores').get() as { count: number }).count;

if (count === 0) {
    const insert = db.prepare(`
        INSERT INTO chores (name, details, room, date_last_completed, duration, frequency, urgency, long_term_task)
        VALUES (@name, @details, @room, @date_last_completed, @duration, @frequency, @urgency, @long_term_task)
    `);
    const seedMany = db.transaction((rows: SeedRow[]) => { for (const r of rows) insert.run(r); });
    seedMany(SEED_DATA);
}

const SEED_DATA: SeedRow[] = [
    { name: 'Vacuum Bedroom Floor',        details: null, room: 'Bedroom',     date_last_completed: '2025-06-12T00:00:00.000Z', duration: 20, frequency: 7,  urgency: null,  long_term_task: 0 },
    { name: 'Vacuum Living Room Floor',    details: null, room: 'Living Room', date_last_completed: '2025-06-12T00:00:00.000Z', duration: 20, frequency: 7,  urgency: null,  long_term_task: 0 },
    { name: 'Vacuum Kitchen Floor',        details: null, room: 'Kitchen',     date_last_completed: '2025-06-12T00:00:00.000Z', duration: 20, frequency: 7,  urgency: null,  long_term_task: 0 },
    { name: 'Change Bedsheets',            details: null, room: 'Bedroom',     date_last_completed: '2025-06-09T00:00:00.000Z', duration: 10, frequency: 7,  urgency: null,  long_term_task: 0 },
    { name: 'Change Towels',               details: null, room: 'Bathroom',    date_last_completed: '2025-06-13T00:00:00.000Z', duration: 2,  frequency: 3,  urgency: null,  long_term_task: 0 },
    { name: 'Sweep Kitchen Floor',         details: null, room: 'Kitchen',     date_last_completed: '2025-06-14T00:00:00.000Z', duration: 3,  frequency: 2,  urgency: null,  long_term_task: 0 },
    { name: 'Sweep Sunroom Floor',         details: null, room: 'Sunroom',     date_last_completed: '2025-05-31T00:00:00.000Z', duration: 7,  frequency: 30, urgency: null,  long_term_task: 0 },
    { name: 'Mop Kitchen Floor',           details: null, room: 'Kitchen',     date_last_completed: '2025-06-09T00:00:00.000Z', duration: 45, frequency: 7,  urgency: null,  long_term_task: 0 },
    { name: 'Clean Bathroom',              details: null, room: 'Bathroom',    date_last_completed: '2025-06-10T00:00:00.000Z', duration: 60, frequency: 7,  urgency: null,  long_term_task: 0 },
    { name: 'HVAC Air Filter Replacement', details: 'Replace the air filter in the HVAC system to ensure proper airflow and air quality.',
                                                          room: 'Basement',    date_last_completed: '2025-03-31T00:00:00.000Z', duration: 10, frequency: 90, urgency: 'low', long_term_task: 1 },
];
```

### `backend/src/chores.ts`

```typescript
import { db } from './db.js';
import type { Chore } from '../../types/SharedTypes.js';

type ChoreRow = {
    id: number; name: string; details: string | null; room: string;
    date_last_completed: string; duration: number; frequency: number;
    urgency: 'low' | 'medium' | 'high' | null; long_term_task: number;
};

function rowToChore(row: ChoreRow) {
    return {
        id: row.id, name: row.name, details: row.details ?? null, room: row.room,
        dateLastCompleted: row.date_last_completed,   // ISO string — frontend parses to Date
        duration: row.duration, frequency: row.frequency,
        urgency: row.urgency ?? undefined,
        longTermTask: row.long_term_task === 1 ? true : undefined,  // undefined, NOT false
    };
}

export function getAllChores() {
    return (db.prepare('SELECT * FROM chores ORDER BY id').all() as ChoreRow[]).map(rowToChore);
}

export function createChore(input: Omit<Chore, 'id'>) {
    const result = db.prepare(`
        INSERT INTO chores (name, details, room, date_last_completed, duration, frequency, urgency, long_term_task)
        VALUES (@name, @details, @room, @date_last_completed, @duration, @frequency, @urgency, @long_term_task)
    `).run({
        name: input.name, details: input.details ?? null, room: input.room,
        date_last_completed: input.dateLastCompleted instanceof Date
            ? input.dateLastCompleted.toISOString() : input.dateLastCompleted,
        duration: input.duration, frequency: input.frequency,
        urgency: input.urgency ?? null, long_term_task: input.longTermTask ? 1 : 0,
    });
    return rowToChore(db.prepare('SELECT * FROM chores WHERE id = ?').get(result.lastInsertRowid) as ChoreRow);
}

export function completeChore(id: number, dateLastCompleted: string) {
    const result = db.prepare('UPDATE chores SET date_last_completed = ? WHERE id = ?').run(dateLastCompleted, id);
    if (result.changes === 0) return null;
    return rowToChore(db.prepare('SELECT * FROM chores WHERE id = ?').get(id) as ChoreRow);
}

export function deleteChore(id: number): boolean {
    return db.prepare('DELETE FROM chores WHERE id = ?').run(id).changes > 0;
}
```

### `backend/src/router.ts` (replacement)

```typescript
import express from 'express';
import cors from 'cors';
import { getAllChores, createChore, completeChore, deleteChore } from './chores.js';
import type { Chore, ApiResponse } from '../../types/SharedTypes.js';

const app = express();
app.use(cors());
app.use(express.json());   // CRITICAL: must add this — stub never had a body parser

app.get('/api/chores', (_req, res) => {
    try {
        res.json({ success: true, data: getAllChores() } satisfies ApiResponse<ReturnType<typeof getAllChores>>);
    } catch { res.status(500).json({ success: false, error: 'Failed to fetch chores' }); }
});

app.post('/api/chores', (req, res) => {
    const body = req.body as Omit<Chore, 'id'>;
    if (!body.name || !body.room || !body.dateLastCompleted || body.duration == null || body.frequency == null)
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    try {
        return res.status(201).json({ success: true, data: createChore(body) });
    } catch { return res.status(500).json({ success: false, error: 'Failed to create chore' }); }
});

app.patch('/api/chores/:id/complete', (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid id' });
    const { dateLastCompleted } = req.body as { dateLastCompleted: string };
    if (!dateLastCompleted) return res.status(400).json({ success: false, error: 'dateLastCompleted is required' });
    try {
        const chore = completeChore(id, dateLastCompleted);
        if (!chore) return res.status(404).json({ success: false, error: 'Chore not found' });
        return res.json({ success: true, data: chore });
    } catch { return res.status(500).json({ success: false, error: 'Failed to update chore' }); }
});

app.delete('/api/chores/:id', (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid id' });
    try {
        if (!deleteChore(id)) return res.status(404).json({ success: false, error: 'Chore not found' });
        return res.json({ success: true, data: null });
    } catch { return res.status(500).json({ success: false, error: 'Failed to delete chore' }); }
});

app.listen(3000, () => console.log('chores4irl backend listening on port 3000'));
```

### `frontend/src/services/choreApi.ts` (new file)

```typescript
import type { Chore, ApiResponse } from '@customTypes/SharedTypes';

type ChoreWire = Omit<Chore, 'dateLastCompleted'> & { dateLastCompleted: string };

function parseChore(wire: ChoreWire): Chore {
    return { ...wire, dateLastCompleted: new Date(wire.dateLastCompleted) };
}

async function handleResponse<T>(res: Response): Promise<T> {
    const json: ApiResponse<T> = await res.json();
    if (!json.success || json.data === undefined) throw new Error(json.error ?? 'Unknown API error');
    return json.data;
}

export async function fetchAllChores(): Promise<Chore[]> {
    const wires = await handleResponse<ChoreWire[]>(await fetch('/api/chores'));
    return wires.map(parseChore);
}

export async function addChore(newChore: Omit<Chore, 'id'>): Promise<Chore> {
    const res = await fetch('/api/chores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...newChore,
            dateLastCompleted: newChore.dateLastCompleted instanceof Date
                ? newChore.dateLastCompleted.toISOString()
                : newChore.dateLastCompleted,
        }),
    });
    return parseChore(await handleResponse<ChoreWire>(res));
}

export async function completeChore(id: number, date: Date): Promise<Chore> {
    const res = await fetch(`/api/chores/${id}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateLastCompleted: date.toISOString() }),
    });
    return parseChore(await handleResponse<ChoreWire>(res));
}

export async function removeChore(id: number): Promise<void> {
    await handleResponse<null>(await fetch(`/api/chores/${id}`, { method: 'DELETE' }));
}
```

### `frontend/src/App.tsx` changes (summary)

- Remove `import { database }` — add `import { fetchAllChores, addChore, completeChore }`
- `useState<Chore[]>([])` (empty initial, not `database`)
- Add `loading` and `error` state
- `useEffect(fetchAllChores, [])` on mount
- `handleAddChore` → async, calls `addChore()`, updates state with returned chore
- Add `handleCompleteChore(id, date)` → optimistic state update + `completeChore()` API call
- Loading spinner render path; error banner with dismiss button
- Pass `onComplete={handleCompleteChore}` to `<ChoreList>`

### `ChoreTimerBar.tsx` changes (targeted diff)

```typescript
// Add to props type:
onComplete: (id: number, date: Date) => void;

// Update resetTask:
function resetTask() {
    setDateLastCompleted(day);   // keep — immediate local UI update
    onComplete(chore.id, day);   // add — persist to backend via App.tsx
}
```

### `ChoreList.tsx` changes (targeted diff)

```typescript
// Add to props type:
onComplete: (id: number, date: Date) => void;

// Pass through to ChoreTimerBar:
<ChoreTimerBar chore={chore} day={day} onComplete={onComplete} />
```

---

## TODO List

### Phase 1 — Backend Dependencies

- [x] `npm install better-sqlite3 --workspace backend`
- [x] `npm install --save-dev @types/better-sqlite3 --workspace backend`
- [x] Delete `backend/data.db` to ensure clean seed on first run

### Phase 2 — Backend Implementation

- [x] Create `backend/src/db.ts` — connection, WAL pragma, schema init, idempotent seed
- [x] Create `backend/src/chores.ts` — `getAllChores`, `createChore`, `completeChore`, `deleteChore`
- [x] Replace `backend/src/router.ts` — add `express.json()`, implement all 4 routes

### Phase 3 — Backend Verification

- [x] Start backend alone: `npm run dev --workspace backend`
- [x] `curl localhost:3000/api/chores` — expect 10 chores as JSON
- [x] `curl -X POST localhost:3000/api/chores -H 'Content-Type: application/json' -d '{...}'` — expect 201 + new chore
- [x] `curl -X PATCH localhost:3000/api/chores/1/complete -H 'Content-Type: application/json' -d '{"dateLastCompleted":"2026-03-28T00:00:00.000Z"}'` — expect updated chore
- [x] `curl -X DELETE localhost:3000/api/chores/1` — expect `{ success: true, data: null }`

### Phase 4 — Frontend Service Layer

- [x] Create `frontend/src/services/choreApi.ts` with `ChoreWire` type, `parseChore`, `handleResponse`, and all 4 export functions

### Phase 5 — Frontend Component Wiring

- [x] Update `ChoreTimerBar.tsx` — add `onComplete` prop, call it in `resetTask`
- [x] Update `ChoreList.tsx` — add `onComplete` prop, thread to `ChoreTimerBar`
- [x] Update `App.tsx` — remove `database.ts` import, add `useEffect` fetch, add loading/error state, add `handleCompleteChore`, pass `onComplete` to `ChoreList`

### Phase 6 — End-to-End Verification

- [x] Run full stack: `npm run dev` (frontend + backend concurrent)
- [x] Verify app loads with 10 chores from SQLite (not hardcoded)
- [x] Add a new chore via form → refresh page → chore still exists
- [x] Click a chore bar (mark complete) → refresh page → date reset persists
- [x] Verify sort order re-evaluates immediately after completing a chore (optimistic update)
- [x] Verify room filter tabs still work correctly

### Phase 7 — Cleanup

- [x] Confirm `database.ts` is no longer imported anywhere (keep the file as reference)
- [x] Update `TODO: pull from Express` comment in `database.ts` to express implementation is complete 

---

## Critical Files

| File | Change |
|------|--------|
| `backend/src/db.ts` | New — SQLite connection + schema + seed |
| `backend/src/chores.ts` | New — database service layer |
| `backend/src/router.ts` | Replaced — real API routes |
| `frontend/src/services/choreApi.ts` | New — typed fetch + Date hydration |
| `frontend/src/App.tsx` | Modified — fetch on mount, API handlers, loading/error |
| `frontend/src/components/chore/ChoreList.tsx` | Modified — thread `onComplete` prop |
| `frontend/src/components/chore/ChoreTimerBar.tsx` | Modified — call `onComplete` in `resetTask` |
| `types/SharedTypes.ts` | No change — already correct contract |
| `frontend/src/assets/database.ts` | No change — kept, just no longer imported |
