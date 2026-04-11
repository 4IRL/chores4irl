import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = process.env.TEST_DB_PATH === ':memory:'
    ? ':memory:'
    : path.resolve(__dirname, '../../data.db');

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
    name: string;
    details: string | null;
    room: string;
    date_last_completed: string;
    duration: number;
    frequency: number;
    urgency: string | null;
    long_term_task: number;
};

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
    { name: 'HVAC Air Filter Replacement', details: 'Replace the air filter in the HVAC system to ensure proper airflow and air quality.', room: 'Basement', date_last_completed: '2025-03-31T00:00:00.000Z', duration: 10, frequency: 90, urgency: 'low', long_term_task: 1 },
];

if (!process.env.TEST_DB_PATH) {
    const count = (db.prepare('SELECT COUNT(*) as count FROM chores').get() as { count: number }).count;
    if (count === 0) {
        const insert = db.prepare(`
            INSERT INTO chores (name, details, room, date_last_completed, duration, frequency, urgency, long_term_task)
            VALUES (@name, @details, @room, @date_last_completed, @duration, @frequency, @urgency, @long_term_task)
        `);
        const seedMany = db.transaction((rows: SeedRow[]) => {
            for (const row of rows) insert.run(row);
        });
        seedMany(SEED_DATA);
    }
}
