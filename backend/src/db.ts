import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = process.env.TEST_DB_PATH === ':memory:'
    ? ':memory:'
    : (process.env.DB_PATH ?? path.resolve(__dirname, '../../data.db'));

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
    CREATE TABLE IF NOT EXISTS chores (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        name                TEXT    NOT NULL,
        room                TEXT    NOT NULL,
        date_last_completed TEXT    NOT NULL,
        duration            INTEGER NOT NULL,
        frequency           INTEGER NOT NULL,
        urgency             TEXT    CHECK(urgency IN ('low', 'medium', 'high'))
    );
`);

// F4 migration: drop the legacy `details` / `long_term_task` columns from databases created
// before their removal. `CREATE TABLE IF NOT EXISTS` never alters an existing table, and an
// unguarded DROP COLUMN throws "no such column" on the second boot — so guard on
// pragma table_info. Requires SQLite >= 3.35 (better-sqlite3 bundles 3.51.3).
// BEGIN IMMEDIATE takes the write lock before the pragma read, so two processes booting the
// same un-migrated file serialise instead of the second throwing "no such column"; a busy
// first booter surfaces as SQLITE_BUSY.
// A failed DROP aborts boot on purpose (no try/catch): the compose stack stops after 5
// restarts, and the PR runbook tells the operator to check `docker compose logs backend` if
// the frontend never comes up.
const LEGACY_CHORE_COLUMNS = ['details', 'long_term_task'] as const;

export function dropLegacyChoreColumns(target: Database.Database): void {
    target.transaction(() => {
        const present = new Set(
            (target.pragma("table_info('chores')") as { name: string }[]).map(c => c.name),
        );
        for (const col of LEGACY_CHORE_COLUMNS) {
            if (present.has(col)) target.exec(`ALTER TABLE chores DROP COLUMN ${col}`);
        }
    }).immediate();
}

dropLegacyChoreColumns(db);

type SeedRow = {
    name: string;
    room: string;
    date_last_completed: string;
    duration: number;
    frequency: number;
    urgency: string | null;
};

const SEED_DATA: SeedRow[] = [
    { name: 'Vacuum Bedroom Floor',        room: 'Bedroom',     date_last_completed: '2025-06-12T00:00:00.000Z', duration: 20, frequency: 7,  urgency: null  },
    { name: 'Vacuum Living Room Floor',    room: 'Living Room', date_last_completed: '2025-06-12T00:00:00.000Z', duration: 20, frequency: 7,  urgency: null  },
    { name: 'Vacuum Kitchen Floor',        room: 'Kitchen',     date_last_completed: '2025-06-12T00:00:00.000Z', duration: 20, frequency: 7,  urgency: null  },
    { name: 'Change Bedsheets',            room: 'Bedroom',     date_last_completed: '2025-06-09T00:00:00.000Z', duration: 10, frequency: 7,  urgency: null  },
    { name: 'Change Towels',               room: 'Bathroom',    date_last_completed: '2025-06-13T00:00:00.000Z', duration: 2,  frequency: 3,  urgency: null  },
    { name: 'Sweep Kitchen Floor',         room: 'Kitchen',     date_last_completed: '2025-06-14T00:00:00.000Z', duration: 3,  frequency: 2,  urgency: null  },
    { name: 'Sweep Sunroom Floor',         room: 'Sunroom',     date_last_completed: '2025-05-31T00:00:00.000Z', duration: 7,  frequency: 30, urgency: null  },
    { name: 'Mop Kitchen Floor',           room: 'Kitchen',     date_last_completed: '2025-06-09T00:00:00.000Z', duration: 45, frequency: 7,  urgency: null  },
    { name: 'Clean Bathroom',              room: 'Bathroom',    date_last_completed: '2025-06-10T00:00:00.000Z', duration: 60, frequency: 7,  urgency: null  },
    { name: 'HVAC Air Filter Replacement', room: 'Basement',    date_last_completed: '2025-03-31T00:00:00.000Z', duration: 10, frequency: 90, urgency: 'low' },
];

if (!process.env.TEST_DB_PATH) {
    const count = (db.prepare('SELECT COUNT(*) as count FROM chores').get() as { count: number }).count;
    if (count === 0) {
        const insert = db.prepare(`
            INSERT INTO chores (name, room, date_last_completed, duration, frequency, urgency)
            VALUES (@name, @room, @date_last_completed, @duration, @frequency, @urgency)
        `);
        const seedMany = db.transaction((rows: SeedRow[]) => {
            for (const row of rows) insert.run(row);
        });
        seedMany(SEED_DATA);
    }
}
