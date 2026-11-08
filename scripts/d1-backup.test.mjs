import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { backupKey, isBackupKey, selectBackupsToPrune } from './d1-backup.mjs';

const SCRIPT = path.resolve(fileURLToPath(new URL('./d1-backup.mjs', import.meta.url)));

function mkKeys(n) {
  const keys = [];
  for (let i = 1; i <= n; i += 1) {
    keys.push(`d1/chores4irl-202610${String(i).padStart(2, '0')}T101703Z.sql.gpg`);
  }
  return keys;
}

function cli(args, input = '') {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { input, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

describe('backupKey', () => {
  it('formats a UTC timestamp key', () => {
    assert.equal(backupKey(new Date('2026-11-08T10:17:03Z')), 'd1/chores4irl-20261108T101703Z.sql.gpg');
  });

  it('sorts lexicographically in time order', () => {
    const a = backupKey(new Date('2026-01-02T03:04:05Z'));
    const b = backupKey(new Date('2026-11-08T10:17:03Z'));
    const c = backupKey(new Date('2027-01-01T00:00:00Z'));
    assert.deepEqual([c, a, b].sort(), [a, b, c]);
  });

  it('produces keys accepted by isBackupKey', () => {
    assert.equal(isBackupKey(backupKey(new Date())), true);
  });
});

describe('isBackupKey', () => {
  it('accepts a valid key', () => {
    assert.equal(isBackupKey('d1/chores4irl-20261108T101703Z.sql.gpg'), true);
  });

  it('rejects other prefixes, plaintext, missing Z and path tricks', () => {
    for (const k of [
      'x/chores4irl-20261108T101703Z.sql.gpg',
      'd1/other-20261108T101703Z.sql.gpg',
      'd1/chores4irl-20261108T101703Z.sql',
      'd1/chores4irl-20261108T101703.sql.gpg',
      'd1/../x',
      'd1/../d1/chores4irl-20261108T101703Z.sql.gpg',
      'd1/sub/chores4irl-20261108T101703Z.sql.gpg',
      'd1/chores4irl-20261108T101703Z.sql.gpg\n',
      '',
    ]) {
      assert.equal(isBackupKey(k), false, k);
    }
  });

  it('rejects non-strings', () => {
    assert.equal(isBackupKey(undefined), false);
    assert.equal(isBackupKey(5), false);
  });
});

describe('selectBackupsToPrune', () => {
  it('returns the 2 oldest of 10 with keep=8', () => {
    const keys = mkKeys(10);
    const out = selectBackupsToPrune(keys, 8, keys[9]);
    assert.deepEqual([...out].sort(), [keys[0], keys[1]]);
  });

  it('returns [] when fewer than keep', () => {
    const keys = mkKeys(3);
    assert.deepEqual(selectBackupsToPrune(keys, 8, keys[2]), []);
  });

  it('never returns non-matching keys', () => {
    const keys = [...mkKeys(3), 'd1/old.txt', 'other/a', 'd1/chores4irl-19990101T000000Z.sql'];
    const out = selectBackupsToPrune(keys, 1, keys[2]);
    assert.deepEqual([...out].sort(), [keys[0], keys[1]]);
  });

  it('never returns protect, even when it is old', () => {
    const keys = mkKeys(5);
    const out = selectBackupsToPrune(keys, 1, keys[0]);
    assert.ok(!out.includes(keys[0]));
  });

  it('throws when protect is absent', () => {
    const keys = mkKeys(3);
    assert.throws(() => selectBackupsToPrune(keys, 2, 'd1/chores4irl-20300101T000000Z.sql.gpg'));
  });

  it('throws on bad keep', () => {
    const keys = mkKeys(3);
    for (const k of [0, -1, 1.5, '8', NaN, undefined]) {
      assert.throws(() => selectBackupsToPrune(keys, k, keys[2]), undefined, String(k));
    }
  });
});

describe('CLI key', () => {
  it('prints a valid key', () => {
    const r = cli(['key']);
    assert.equal(r.status, 0);
    assert.equal(isBackupKey(r.stdout.trim()), true);
  });
});

describe('CLI prune', () => {
  const keys = mkKeys(10);

  it('prints keys to delete', () => {
    const r = cli(['prune', '--keep', '8', '--protect', keys[9]], keys.join('\n') + '\n');
    assert.equal(r.status, 0);
    assert.deepEqual(r.stdout.split('\n').filter(Boolean).sort(), [keys[0], keys[1]]);
  });

  it('ignores blank lines and trailing newline', () => {
    const input = '\n' + keys.join('\n\n') + '\n\n';
    const r = cli(['prune', '--keep', '8', '--protect', keys[9]], input);
    assert.equal(r.status, 0);
    assert.deepEqual(r.stdout.split('\n').filter(Boolean).sort(), [keys[0], keys[1]]);
  });

  it('prints nothing and exits 0 when nothing to prune', () => {
    const r = cli(['prune', '--keep', '20', '--protect', keys[9]], keys.join('\n'));
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
  });

  it('rejects bad --keep (non-numeric, empty, decimal, zero)', () => {
    for (const bad of ['abc', '', '1.5', '0', '-1', '8x', ' 8']) {
      const r = cli(['prune', '--keep', bad, '--protect', keys[9]], keys.join('\n'));
      assert.notEqual(r.status, 0, JSON.stringify(bad));
      assert.equal(r.stdout, '');
      assert.notEqual(r.stderr, '');
    }
  });

  it('fails on missing --keep or --protect', () => {
    for (const args of [
      ['prune', '--protect', keys[9]],
      ['prune', '--keep', '8'],
    ]) {
      const r = cli(args, keys.join('\n'));
      assert.notEqual(r.status, 0);
      assert.equal(r.stdout, '');
      assert.notEqual(r.stderr, '');
    }
  });

  it('fails when protect is absent from stdin', () => {
    const r = cli(['prune', '--keep', '8', '--protect', keys[9]], keys.slice(0, 5).join('\n'));
    assert.notEqual(r.status, 0);
    assert.equal(r.stdout, '');
    assert.notEqual(r.stderr, '');
  });
});

describe('CLI misc', () => {
  it('fails on unknown subcommand', () => {
    const r = cli(['bogus']);
    assert.notEqual(r.status, 0);
    assert.equal(r.stdout, '');
    assert.notEqual(r.stderr, '');
  });

  it('fails with no subcommand', () => {
    const r = cli([]);
    assert.notEqual(r.status, 0);
    assert.equal(r.stdout, '');
  });
});
