import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { dropLegacyChoreColumns } from '../db.js';

// The 9-column DDL that db.ts shipped before F4 removed `details` / `long_term_task`.
const LEGACY_CREATE_TABLE = `
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
`;

const NEW_CREATE_TABLE = `
    CREATE TABLE IF NOT EXISTS chores (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        name                TEXT    NOT NULL,
        room                TEXT    NOT NULL,
        date_last_completed TEXT    NOT NULL,
        duration            INTEGER NOT NULL,
        frequency           INTEGER NOT NULL,
        urgency             TEXT    CHECK(urgency IN ('low', 'medium', 'high'))
    );
`;

const MIGRATED_COLUMNS = ['id', 'name', 'room', 'date_last_completed', 'duration', 'frequency', 'urgency'];

const INSERT_LEGACY_HVAC = `
    INSERT INTO chores (name, details, room, date_last_completed, duration, frequency, urgency, long_term_task)
    VALUES ('HVAC Air Filter Replacement', 'Replace the filter', 'Basement', '2025-03-31T00:00:00.000Z', 10, 90, 'low', 1)
`;

const INSERT_LEGACY_SWEEP = `
    INSERT INTO chores (name, details, room, date_last_completed, duration, frequency, urgency, long_term_task)
    VALUES ('Sweep', NULL, 'Kitchen', '2025-01-01T00:00:00.000Z', 10, 7, NULL, 0)
`;

function columnNames(target: Database.Database): string[] {
    return (target.pragma("table_info('chores')") as { name: string }[]).map(c => c.name);
}

function rowCount(target: Database.Database): { c: number } {
    return target.prepare('SELECT COUNT(*) AS c FROM chores').get() as { c: number };
}

function makeLegacyDb(): Database.Database {
    const legacy = new Database(':memory:');
    legacy.exec(LEGACY_CREATE_TABLE);
    legacy.exec(INSERT_LEGACY_HVAC);
    legacy.exec(INSERT_LEGACY_SWEEP);
    return legacy;
}

describe('dropLegacyChoreColumns', () => {
    it('drops details and long_term_task from a legacy table and preserves the other columns and rows', () => {
        const legacy = makeLegacyDb();

        dropLegacyChoreColumns(legacy);

        expect(columnNames(legacy)).toEqual(MIGRATED_COLUMNS);
        expect(
            legacy.prepare('SELECT name, room, date_last_completed, duration, frequency, urgency FROM chores ORDER BY id').all(),
        ).toEqual([
            { name: 'HVAC Air Filter Replacement', room: 'Basement', date_last_completed: '2025-03-31T00:00:00.000Z', duration: 10, frequency: 90, urgency: 'low' },
            { name: 'Sweep', room: 'Kitchen', date_last_completed: '2025-01-01T00:00:00.000Z', duration: 10, frequency: 7, urgency: null },
        ]);
        legacy.close();
    });

    it('is idempotent — a second call on an already-migrated table is a no-op', () => {
        const legacy = makeLegacyDb();

        dropLegacyChoreColumns(legacy);
        dropLegacyChoreColumns(legacy);
        expect(() => dropLegacyChoreColumns(legacy)).not.toThrow();

        expect(columnNames(legacy)).toEqual(MIGRATED_COLUMNS);
        expect(rowCount(legacy)).toEqual({ c: 2 });
        legacy.close();
    });

    it('is a no-op on a table already created with the new 7-column schema', () => {
        const fresh = new Database(':memory:');
        fresh.exec(NEW_CREATE_TABLE);

        expect(() => dropLegacyChoreColumns(fresh)).not.toThrow();

        expect(columnNames(fresh)).toEqual(MIGRATED_COLUMNS);
        fresh.close();
    });

    it('still enforces the urgency CHECK constraint after migration', () => {
        const legacy = makeLegacyDb();

        dropLegacyChoreColumns(legacy);

        expect(() =>
            legacy.prepare(
                "INSERT INTO chores (name, room, date_last_completed, duration, frequency, urgency) VALUES ('x','y','2025-01-01T00:00:00.000Z',1,1,'bogus')",
            ).run(),
        ).toThrow(/CHECK constraint failed/);
        legacy.close();
    });
});

describe('db.ts boot migration', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'chores4irl-mig-'));
        vi.resetModules();
        delete process.env.DB_PATH;
        delete process.env.TEST_DB_PATH;
    });

    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
        delete process.env.DB_PATH;
        delete process.env.TEST_DB_PATH;
    });

    // Writes the legacy 9-column file and closes the handle, so db.ts opens a flushed file with no
    // competing writer from this test while it runs the DROPs.
    function writeLegacyFile(): string {
        const file = join(tmpDir, 'legacy.db');
        const legacy = new Database(file);
        legacy.exec(LEGACY_CREATE_TABLE);
        legacy.exec(INSERT_LEGACY_HVAC);
        legacy.close();
        return file;
    }

    it('migrates a legacy file DB on import and skips seeding because rows already exist', async () => {
        process.env.DB_PATH = writeLegacyFile();

        const { db } = await import('../db.js');

        expect(columnNames(db)).toEqual(MIGRATED_COLUMNS);
        expect(rowCount(db)).toEqual({ c: 1 });
        expect(db.prepare('SELECT name, urgency FROM chores').get()).toEqual({
            name: 'HVAC Air Filter Replacement',
            urgency: 'low',
        });
    });

    it('boots twice against the same legacy file without throwing', async () => {
        process.env.DB_PATH = writeLegacyFile();

        await import('../db.js');
        vi.resetModules();
        const second = await import('../db.js');

        expect(columnNames(second.db)).toEqual(MIGRATED_COLUMNS);
        expect(rowCount(second.db)).toEqual({ c: 1 });
    });

    it('a fresh file DB gets the 7-column schema and the 10 seed rows', async () => {
        process.env.DB_PATH = join(tmpDir, 'fresh.db');

        const { db } = await import('../db.js');

        expect(columnNames(db)).toEqual(MIGRATED_COLUMNS);
        expect(rowCount(db)).toEqual({ c: 10 });
        expect(db.prepare("SELECT urgency FROM chores WHERE name = 'HVAC Air Filter Replacement'").get()).toEqual({
            urgency: 'low',
        });
    });
});
