import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('db.ts DB path resolution', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'chores4irl-db-'));
        vi.resetModules();
        delete process.env.DB_PATH;
        delete process.env.TEST_DB_PATH;
    });

    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
        delete process.env.DB_PATH;
        delete process.env.TEST_DB_PATH;
    });

    it('uses DB_PATH when set and TEST_DB_PATH is unset', async () => {
        const target = join(tmpDir, 'custom.db');
        process.env.DB_PATH = target;
        const { db } = await import('../db.js');
        const rows = db.pragma('database_list') as Array<{ file: string }>;
        expect(rows[0].file).toBe(target);
    });

    it('uses in-memory when TEST_DB_PATH=:memory: even if DB_PATH is set', async () => {
        process.env.DB_PATH = join(tmpDir, 'ignored.db');
        process.env.TEST_DB_PATH = ':memory:';
        const { db } = await import('../db.js');
        const rows = db.pragma('database_list') as Array<{ file: string }>;
        expect(rows[0].file).toBe('');
    });

    it('falls back to the compiled default path when both env vars are unset', async () => {
        const { db } = await import('../db.js');
        const rows = db.pragma('database_list') as Array<{ file: string }>;
        expect(rows[0].file).toMatch(/data\.db$/);
    });
});
