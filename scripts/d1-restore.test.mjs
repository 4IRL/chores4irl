import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { REPO_ROOT } from './ports.mjs';
import { compareTables, missingTriggers, parseDump } from './d1-restore.mjs';

const BACKEND = path.join(REPO_ROOT, 'backend');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'd1-restore.mjs');
const STATE_DIR = path.join(BACKEND, '.wrangler', 'state');
const TRIGGER = 'prevent_owner_account_deletion';
const PASSPHRASE = 'correct horse battery staple';
const GPG_FLAGS = [
  '--batch',
  '--yes',
  '--pinentry-mode',
  'loopback',
  '--passphrase-fd',
  '0',
  '--symmetric',
  '--cipher-algo',
  'AES256',
];

const roots = [];
const mkroot = (label) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `d1rt-${label}-`));
  roots.push(dir);
  return dir;
};

let work;
let gnupgHome;
let sourceConfig;
let dumpPath;
let sourceCounts;
let stateBefore;

function snapshot(dir) {
  if (!fs.existsSync(dir)) return 'absent';
  const out = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        const st = fs.statSync(full);
        out.push(`${full}:${st.size}:${st.mtimeMs}`);
      }
    }
  };
  walk(dir);
  return out.sort().join('\n');
}

function wrangler(args) {
  const res = spawnSync('npx', ['wrangler', ...args], {
    cwd: BACKEND,
    encoding: 'utf8',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    maxBuffer: 64 * 1024 * 1024,
  });
  assert.equal(res.status, 0, `wrangler ${args.join(' ')} failed:\n${res.stdout}\n${res.stderr}`);
  return res.stdout;
}

function queryRows(extra, sql) {
  const out = wrangler(['d1', 'execute', 'DB', '--local', ...extra, '--json', '--command', sql]);
  return JSON.parse(out)[0].results;
}

const USER_TABLES_SQL =
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' ORDER BY name";

function countsOf(extra) {
  const names = queryRows(extra, USER_TABLES_SQL).map((r) => r.name);
  if (names.length === 0) return {};
  const sql = names.map((n) => `SELECT count(*) AS c FROM "${n}"`).join('; ');
  const out = wrangler(['d1', 'execute', 'DB', '--local', ...extra, '--json', '--command', sql]);
  const sets = JSON.parse(out);
  assert.equal(sets.length, names.length);
  return Object.fromEntries(names.map((n, i) => [n, sets[i].results[0].c]));
}

function gpgEnv() {
  return { ...process.env, GNUPGHOME: gnupgHome };
}

function encrypt(plainPath, outPath) {
  const res = spawnSync('gpg', [...GPG_FLAGS, '--output', outPath, plainPath], {
    input: PASSPHRASE,
    encoding: 'utf8',
    env: gpgEnv(),
  });
  assert.equal(res.status, 0, `gpg encrypt failed: ${res.stderr}`);
}

function restore(args, { env = {}, tmpdir } = {}) {
  const tmp = tmpdir ?? mkroot('tmp');
  const res = spawnSync('node', [SCRIPT, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: { ...gpgEnv(), D1_BACKUP_PASSPHRASE: PASSPHRASE, TMPDIR: tmp, ...env },
    maxBuffer: 64 * 1024 * 1024,
  });
  return { ...res, tmp, lines: res.stdout.split('\n').filter((l) => l !== '') };
}

const plainLeftovers = (tmp) => fs.readdirSync(tmp).filter((n) => n.startsWith('d1-restore-plain-'));
const persistLine = (res) => {
  const first = res.lines[0] ?? '';
  assert.match(first, /^persist-to\t.+/, `first stdout line was ${JSON.stringify(first)}`);
  return first.split('\t')[1];
};
const tableLines = (res) =>
  Object.fromEntries(
    res.lines.slice(1).map((l) => {
      const [t, c] = l.split('\t');
      return [t, Number(c)];
    }),
  );

describe('d1-restore.mjs', { timeout: 600000 }, () => {
  before(() => {
    const gpg = spawnSync('gpg', ['--version'], { encoding: 'utf8' });
    assert.equal(gpg.status, 0, 'gpg required: install gnupg (gpg --version failed)');

    work = mkroot('src');
    gnupgHome = mkroot('gnupg');
    fs.chmodSync(gnupgHome, 0o700);
    stateBefore = snapshot(STATE_DIR);

    const toml = fs
      .readFileSync(path.join(BACKEND, 'wrangler.toml'), 'utf8')
      .replace(
        /^migrations_dir = .*$/m,
        `migrations_dir = ${JSON.stringify(path.join(BACKEND, 'migrations'))}`,
      )
      .replace(/^main = .*$/m, '');
    sourceConfig = path.join(work, 'wrangler.toml');
    fs.writeFileSync(sourceConfig, toml);
    const cfg = ['--config', sourceConfig];

    wrangler(['d1', 'migrations', 'apply', 'DB', '--local', ...cfg]);
    wrangler([
      'd1',
      'execute',
      'DB',
      '--local',
      ...cfg,
      '--json',
      '--command',
      [
        "INSERT INTO households(name,timezone) VALUES ('H','UTC')",
        "INSERT INTO users(email,is_admin) VALUES ('owner@example.com',0)",
        "INSERT INTO rooms(household_id,name) VALUES (1,'Kitchen')",
        "INSERT INTO chores(household_id,name,room,room_id,date_last_completed,duration,frequency,urgency) VALUES (1,'Dishes','Kitchen',1,'2026-01-01',10,1,'low')",
        "INSERT INTO user_notifications(user_id,person_hash,subscriber_token) VALUES (1,'h','tok')",
        "INSERT INTO join_requests(household_id,requested_email,requested_by) VALUES (1,'b@example.com',1)",
      ].join('; '),
    ]);
    dumpPath = path.join(work, 'dump.sql');
    wrangler(['d1', 'export', 'DB', '--local', ...cfg, '--output', dumpPath]);
    sourceCounts = countsOf(cfg);
  });

  after(() => {
    if (gnupgHome) {
      spawnSync('gpgconf', ['--kill', 'gpg-agent'], { env: gpgEnv(), stdio: 'ignore' });
    }
    for (const dir of roots) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('source seed leaves household_members empty and migrations at the file count', () => {
    assert.equal(sourceCounts.household_members, 0);
    assert.equal(sourceCounts.d1_migrations, fs.readdirSync(path.join(BACKEND, 'migrations')).length);
    assert.ok(sourceCounts.users > 0);
  });

  it('1: round trip with matching counts and exact stdout contract', () => {
    const dir = path.join(mkroot('b1'), 'db');
    const res = restore([
      dumpPath,
      '--persist-to',
      dir,
      '--require-rows',
      'users,d1_migrations',
      '--require-triggers',
      TRIGGER,
    ]);
    assert.equal(res.status, 0, res.stderr);
    assert.equal(persistLine(res), dir);
    const printed = tableLines(res);
    assert.deepEqual(printed, sourceCounts);
    assert.equal(res.lines.length - 1, Object.keys(sourceCounts).length, 'one line per user table');
    assert.ok(!res.lines.some((l) => /^(sqlite_|_cf_)/.test(l)));
    assert.equal(printed.household_members, 0);
    assert.deepEqual(countsOf(['--persist-to', dir]), sourceCounts);
  });

  it('2: trigger present after restore', () => {
    const dir = path.join(mkroot('b2'), 'db');
    const res = restore([dumpPath, '--persist-to', dir]);
    assert.equal(res.status, 0, res.stderr);
    const rows = queryRows(['--persist-to', dir], "SELECT name FROM sqlite_master WHERE type='trigger'");
    assert.deepEqual(
      rows.map((r) => r.name),
      [TRIGGER],
    );
  });

  it('3: missing file exits non-zero with the reason', () => {
    const res = restore([path.join(work, 'nope.sql')]);
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /nope\.sql/);
    assert.match(res.stderr, /not found|missing|no such|does not exist/i);
  });

  it('4: wrong passphrase on a .gpg exits non-zero', () => {
    const gpgPath = path.join(work, 'wrongpass.sql.gpg');
    encrypt(dumpPath, gpgPath);
    const res = restore([gpgPath], { env: { D1_BACKUP_PASSPHRASE: 'definitely wrong' } });
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /decrypt/i);
    assert.deepEqual(plainLeftovers(res.tmp), []);
  });

  it('5: restore onto a non-empty DB fails and changes nothing', () => {
    const dir = path.join(mkroot('b5'), 'db');
    const first = restore([dumpPath, '--persist-to', dir]);
    assert.equal(first.status, 0, first.stderr);
    const before = countsOf(['--persist-to', dir]);
    const second = restore([dumpPath, '--persist-to', dir]);
    assert.notEqual(second.status, 0);
    assert.match(second.stderr, /not empty/i);
    assert.deepEqual(countsOf(['--persist-to', dir]), before);
    assert.ok(fs.existsSync(dir), 'caller-supplied dir must not be removed');

    const migrated = path.join(mkroot('b5m'), 'db');
    wrangler([
      'd1',
      'migrations',
      'apply',
      'DB',
      '--local',
      '--config',
      sourceConfig,
      '--persist-to',
      migrated,
    ]);
    const migratedBefore = countsOf(['--persist-to', migrated]);
    const third = restore([dumpPath, '--persist-to', migrated]);
    assert.notEqual(third.status, 0);
    assert.match(third.stderr, /not empty/i);
    assert.deepEqual(countsOf(['--persist-to', migrated]), migratedBefore);
  });

  it('6: no temp plaintext remains after a failure and after a success', () => {
    const gpgPath = path.join(work, 'plain.sql.gpg');
    encrypt(dumpPath, gpgPath);
    const dir = path.join(mkroot('b6'), 'db');
    const ok = restore([gpgPath, '--persist-to', dir]);
    assert.equal(ok.status, 0, ok.stderr);
    assert.deepEqual(plainLeftovers(ok.tmp), []);
    const bad = restore([gpgPath, '--persist-to', dir]);
    assert.notEqual(bad.status, 0);
    assert.deepEqual(plainLeftovers(bad.tmp), []);
  });

  it('7: default dir is printed first, kept on success and removed on failure', () => {
    const ok = restore([dumpPath]);
    assert.equal(ok.status, 0, ok.stderr);
    const dir = persistLine(ok);
    assert.ok(fs.existsSync(dir), 'default dir kept on success');
    fs.rmSync(dir, { recursive: true, force: true });

    const bad = restore([dumpPath, '--require-rows', 'no_such_table']);
    assert.notEqual(bad.status, 0);
    const badDir = persistLine(bad);
    assert.ok(!fs.existsSync(badDir), 'default dir removed on failure');

    const missing = restore([path.join(work, 'nope.sql')]);
    assert.notEqual(missing.status, 0);
    assert.ok(!fs.existsSync(persistLine(missing)), 'default dir removed when the file is missing');
  });

  it('8: .gpg encrypted with the contract flags restores via --passphrase-env', () => {
    const gpgPath = path.join(work, 'contract.sql.gpg');
    encrypt(dumpPath, gpgPath);
    const dir = path.join(mkroot('b8'), 'db');
    const res = restore([gpgPath, '--persist-to', dir, '--passphrase-env', 'MY_PASS'], {
      env: { MY_PASS: PASSPHRASE, D1_BACKUP_PASSPHRASE: 'unused wrong value' },
    });
    assert.equal(res.status, 0, res.stderr);
    assert.deepEqual(tableLines(res), sourceCounts);
    assert.deepEqual(countsOf(['--persist-to', dir]), sourceCounts);
  });

  it('9: --require-rows fails on a zero-row or missing table and passes otherwise', () => {
    const zero = restore([dumpPath, '--require-rows', 'users,household_members']);
    assert.notEqual(zero.status, 0);
    assert.match(zero.stderr, /household_members/);
    assert.ok(!fs.existsSync(persistLine(zero)));

    const missing = restore([dumpPath, '--require-rows', 'users,no_such_table']);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /no_such_table/);
    assert.ok(!fs.existsSync(persistLine(missing)));

    const ok = restore([dumpPath, '--require-rows', 'users,d1_migrations']);
    assert.equal(ok.status, 0, ok.stderr);
    fs.rmSync(persistLine(ok), { recursive: true, force: true });
  });

  it('10: --require-triggers fails when the dump lacks the trigger', () => {
    const sql = fs.readFileSync(dumpPath, 'utf8');
    const cut = sql.indexOf('CREATE TRIGGER');
    assert.ok(cut > 0);
    const noTrigger = path.join(work, 'no-trigger.sql');
    fs.writeFileSync(noTrigger, sql.slice(0, cut));
    const res = restore([noTrigger, '--require-triggers', TRIGGER]);
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, new RegExp(TRIGGER));
    assert.ok(!fs.existsSync(persistLine(res)));
  });

  it('11: parser, table comparison and trigger check', () => {
    const sql = [
      'PRAGMA defer_foreign_keys=TRUE;',
      'CREATE TABLE IF NOT EXISTS "quoted" (id INTEGER);',
      'CREATE TABLE plain (id INTEGER);',
      'CREATE TABLE `tick` (id INTEGER);',
      'CREATE TABLE [brack] (id INTEGER);',
      'CREATE TABLE sqlite_sequence(name,seq);',
      'CREATE TABLE _cf_KV (k TEXT);',
      'CREATE TRIGGER "my_trg" BEFORE DELETE ON plain BEGIN SELECT 1; END;',
      'CREATE TRIGGER IF NOT EXISTS other_trg BEFORE DELETE ON plain BEGIN SELECT 1; END;',
    ].join('\n');
    const parsed = parseDump(sql);
    assert.deepEqual([...parsed.tables].sort(), ['brack', 'plain', 'quoted', 'tick']);
    assert.deepEqual([...parsed.triggers].sort(), ['my_trg', 'other_trg']);

    assert.ok(!compareTables(['a', 'b'], ['b', 'a']), 'equal sets pass');
    assert.match(String(compareTables(['a'], ['a', 'b'])), /b/, 'missing table fails');
    assert.match(String(compareTables(['a', 'b', 'c'], ['a', 'b'])), /c/, 'extra table fails');

    assert.deepEqual(missingTriggers(['t1', 't2'], ['t1', 't2', 'x']), []);
    assert.deepEqual(missingTriggers(['t1', 't2'], ['t1']), ['t2']);
  });

  it('12: parser ignores CREATE text inside multi-line string literals', () => {
    const sql = [
      'CREATE TABLE real_tbl (id INTEGER, note TEXT);',
      "INSERT INTO real_tbl VALUES(1,'it''s',",
      "'line one",
      'CREATE TABLE fake (',
      'CREATE TRIGGER fake_trg',
      "tail ''quoted'' CREATE TABLE fake2 (');",
      'CREATE TRIGGER real_trg BEFORE DELETE ON real_tbl BEGIN SELECT 1; END;',
    ].join('\n');
    const parsed = parseDump(sql);
    assert.deepEqual(parsed.tables, ['real_tbl']);
    assert.deepEqual(parsed.triggers, ['real_trg']);
  });

  it('13: SIGTERM removes the plaintext and the default dir, never a supplied dir', async () => {
    const gpgPath = path.join(work, 'sigterm.sql.gpg');
    encrypt(dumpPath, gpgPath);
    const stubDir = mkroot('stub');
    const marker = path.join(stubDir, 'started');
    const stub = path.join(stubDir, 'npx');
    fs.writeFileSync(stub, '#!/bin/sh\ntouch "$STUB_MARKER"\nexec sleep 60\n');
    fs.chmodSync(stub, 0o755);

    const run = async (extraArgs) => {
      fs.rmSync(marker, { force: true });
      const tmp = mkroot('sigtmp');
      const child = spawn('node', [SCRIPT, gpgPath, ...extraArgs], {
        cwd: REPO_ROOT,
        env: {
          ...gpgEnv(),
          D1_BACKUP_PASSPHRASE: PASSPHRASE,
          TMPDIR: tmp,
          STUB_MARKER: marker,
          PATH: `${stubDir}${path.delimiter}${process.env.PATH}`,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let out = '';
      child.stdout.on('data', (d) => (out += d));
      const closed = new Promise((resolve) => child.on('close', (code, signal) => resolve({ code, signal })));
      const deadline = Date.now() + 30000;
      while (!fs.existsSync(marker) && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 100));
      }
      assert.ok(fs.existsSync(marker), 'stub npx never started');
      child.kill('SIGTERM');
      const { code, signal } = await closed;
      return { code, signal, out, tmp };
    };

    const dflt = await run([]);
    assert.notEqual(dflt.code, 0);
    assert.equal(dflt.signal, null, 'script must handle SIGTERM, not die from it');
    const printed = dflt.out.split('\n')[0].split('\t')[1];
    assert.ok(printed, 'persist-to line printed');
    assert.ok(!fs.existsSync(printed), 'default dir removed on SIGTERM');
    assert.deepEqual(plainLeftovers(dflt.tmp), []);

    const supplied = mkroot('sigdir');
    const own = await run(['--persist-to', supplied]);
    assert.notEqual(own.code, 0);
    assert.deepEqual(plainLeftovers(own.tmp), []);
    assert.ok(fs.existsSync(supplied), 'caller-supplied dir kept');
  });

  it('14: parser ignores CREATE text inside block and line comments', () => {
    const sql = [
      "/* it's a comment",
      'CREATE TABLE in_block (id INTEGER);',
      '*/',
      'CREATE TABLE real_tbl (id INTEGER);',
      "-- it's a line comment",
      'CREATE TRIGGER real_trg BEFORE DELETE ON real_tbl BEGIN SELECT 1; END;',
    ].join('\n');
    const parsed = parseDump(sql);
    assert.deepEqual(parsed.tables, ['real_tbl']);
    assert.deepEqual(parsed.triggers, ['real_trg']);
  });

  it('15: a dump with no CREATE TABLE fails and removes the default dir', () => {
    const empty = path.join(work, 'empty.sql');
    fs.writeFileSync(empty, '-- nothing here\nPRAGMA defer_foreign_keys=TRUE;\n');
    const res = restore([empty]);
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /no CREATE TABLE/);
    assert.ok(!fs.existsSync(persistLine(res)));
  });

  it('16: unset passphrase env on a .gpg fails with the reason', () => {
    const gpgPath = path.join(work, 'nopass.sql.gpg');
    encrypt(dumpPath, gpgPath);
    const res = restore([gpgPath], { env: { D1_BACKUP_PASSPHRASE: '' } });
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /D1_BACKUP_PASSPHRASE.*unset or empty/);
    assert.deepEqual(plainLeftovers(res.tmp), []);
  });

  it('17: unknown flags, valueless flags and empty require lists exit 2', () => {
    for (const args of [
      [dumpPath, '--bogus', 'x'],
      [dumpPath, '--persist-to'],
      [dumpPath, '--require-rows', ''],
      [dumpPath, '--require-triggers', ' , '],
    ]) {
      const res = restore(args);
      assert.equal(res.status, 2, `${args.join(' ')}: ${res.stderr}`);
      assert.match(res.stderr, /d1-restore:/);
    }
  });

  it('leaves backend/.wrangler/state untouched', () => {
    assert.equal(snapshot(STATE_DIR), stateBefore);
  });
});
