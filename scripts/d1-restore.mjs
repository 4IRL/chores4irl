// Restore a D1 backup (.sql or gpg-encrypted .sql.gpg) into a throwaway LOCAL D1.
//
//   node scripts/d1-restore.mjs <file> [--persist-to DIR] [--passphrase-env NAME]
//                               [--require-rows t1,t2] [--require-triggers n1,n2]
//
// stdout: `persist-to<TAB>DIR` first (always, even when the restore later fails),
// then on success one `table<TAB>count` line per user table. See the plan
// "Weekly D1 backup export" (Contracts -> Restore) for the full contract.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(HERE, '..', 'backend');
const DEFAULT_PASSPHRASE_ENV = 'D1_BACKUP_PASSPHRASE';
const GPG_DECRYPT_FLAGS = [
  '--batch',
  '--yes',
  '--pinentry-mode',
  'loopback',
  '--passphrase-fd',
  '0',
  '--decrypt',
];
const OUTPUT_CAP = 8 * 1024 * 1024;
const TAIL_CHARS = 400;
const SIGNAL_GRACE_MS = 5000;
const QUERY_TIMEOUT_MS = 120_000;
const GPG_TIMEOUT_MS = 120_000;
const IMPORT_TIMEOUT_MS = 300_000;

const isInternalTable = (name) => /^(sqlite_|_cf_)/.test(name);

// Only statements starting at the beginning of a line are recognised (D1 export format).
// Replace every single-quoted string literal with '' and drop -- and block comments, so
// text inside data (e.g. 'CREATE TABLE fake (') can never look like a statement.
// Double-quoted identifiers and backtick/bracket names are passed through intact.
function stripLiteralsAndComments(sql) {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === "'") {
      i += 1;
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") i += 2;
        else if (sql[i] === "'") {
          i += 1;
          break;
        } else i += 1;
      }
      out += "''";
    } else if (ch === '"') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === '"' && sql[j + 1] === '"') j += 2;
        else if (sql[j] === '"') {
          j += 1;
          break;
        } else j += 1;
      }
      out += sql.slice(i, j);
      i = j;
    } else if (ch === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i += 1;
    } else if (ch === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      i = end === -1 ? sql.length : end + 2;
      out += ' ';
    } else {
      out += ch;
      i += 1;
    }
  }
  return out;
}

function unquoteName(raw) {
  if (raw.startsWith('"')) return raw.slice(1, -1).replaceAll('""', '"');
  if (raw.startsWith('`')) return raw.slice(1, -1);
  if (raw.startsWith('[')) return raw.slice(1, -1);
  return raw;
}

const STATEMENT_RE =
  /^[ \t]*CREATE[ \t]+(TABLE|TRIGGER)[ \t]+(?:IF[ \t]+NOT[ \t]+EXISTS[ \t]+)?("(?:[^"]|"")+"|`[^`]+`|\[[^\]]+\]|[A-Za-z0-9_$]+)/gim;

export function parseDump(sql) {
  const tables = [];
  const triggers = [];
  for (const m of stripLiteralsAndComments(sql).matchAll(STATEMENT_RE)) {
    const name = unquoteName(m[2]);
    if (m[1].toUpperCase() === 'TABLE') {
      if (!isInternalTable(name) && !tables.includes(name)) tables.push(name);
    } else if (!triggers.includes(name)) {
      triggers.push(name);
    }
  }
  return { tables, triggers };
}

// Returns null when the sets are equal, else a reason string.
export function compareTables(restored, dumpTables) {
  const have = new Set(restored.filter((n) => !isInternalTable(n)));
  const want = new Set(dumpTables.filter((n) => !isInternalTable(n)));
  const missing = [...want].filter((n) => !have.has(n)).sort();
  const extra = [...have].filter((n) => !want.has(n)).sort();
  if (missing.length === 0 && extra.length === 0) return null;
  const parts = [];
  if (missing.length) parts.push(`tables in the dump but not restored: ${missing.join(', ')}`);
  if (extra.length) parts.push(`restored tables not in the dump: ${extra.join(', ')}`);
  return parts.join('; ');
}

export function missingTriggers(expected, restored) {
  const have = new Set(restored);
  return expected.filter((n) => !have.has(n));
}

function parseArgs(argv) {
  const opts = {
    file: undefined,
    persistTo: undefined,
    passphraseEnv: DEFAULT_PASSPHRASE_ENV,
    requireRows: [],
    requireTriggers: [],
  };
  const list = (v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '');
  const nonEmptyList = (flag, v) => {
    const items = list(v);
    if (items.length === 0) throw new Error(`${flag} needs a non-empty comma-separated list`);
    return items;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const value = argv[i + 1];
      if (value === undefined) throw new Error(`${arg} needs a value`);
      i += 1;
      if (arg === '--persist-to') opts.persistTo = path.resolve(value);
      else if (arg === '--passphrase-env') opts.passphraseEnv = value;
      else if (arg === '--require-rows') opts.requireRows = nonEmptyList(arg, value);
      else if (arg === '--require-triggers') opts.requireTriggers = nonEmptyList(arg, value);
      else throw new Error(`unknown argument ${arg}`);
    } else if (opts.file === undefined) {
      opts.file = arg;
    } else {
      throw new Error(`unexpected extra argument ${arg}`);
    }
  }
  if (opts.file === undefined)
    throw new Error(
      'usage: d1-restore.mjs <file> [--persist-to DIR] [--passphrase-env NAME] [--require-rows t1,t2] [--require-triggers n1,n2]',
    );
  return opts;
}

// ---- process management (async children so a SIGTERM handler can run) ----

const children = new Map(); // child -> promise resolved on close
const cleanup = { plainDir: undefined, defaultDir: undefined };

function removeTemp() {
  if (cleanup.plainDir) fs.rmSync(cleanup.plainDir, { recursive: true, force: true });
  if (cleanup.defaultDir) fs.rmSync(cleanup.defaultDir, { recursive: true, force: true });
}

function killGroup(child, sig) {
  try {
    process.kill(-child.pid, sig);
  } catch {
    try {
      child.kill(sig);
    } catch {
      // already gone
    }
  }
}

let shuttingDown = false;
async function onSignal(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  const pending = [...children.values()];
  for (const child of children.keys()) killGroup(child, 'SIGTERM');
  let timer;
  const grace = new Promise((resolve) => {
    timer = setTimeout(resolve, SIGNAL_GRACE_MS, 'timeout');
  });
  const outcome = await Promise.race([Promise.all(pending).then(() => 'closed'), grace]);
  clearTimeout(timer);
  if (outcome === 'timeout') {
    for (const child of children.keys()) killGroup(child, 'SIGKILL');
    await Promise.race([Promise.all(pending), new Promise((r) => setTimeout(r, 1000))]);
  }
  removeTemp();
  process.exit(code);
}
process.on('SIGTERM', () => void onSignal(143));
process.on('SIGINT', () => void onSignal(130));
process.on('exit', removeTemp); // safety net for any exit path outside main's try/catch

// Children never see the passphrase in their environment (gpg gets it on stdin).
let passphraseEnvName = DEFAULT_PASSPHRASE_ENV;
function childEnv(extra) {
  const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', ...extra };
  delete env[DEFAULT_PASSPHRASE_ENV];
  delete env[passphraseEnvName];
  return env;
}

function run(phase, timeoutMs, cmd, args, { input } = {}) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(cmd, args, {
      cwd: BACKEND_DIR,
      env: childEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true,
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let onClosed;
    children.set(child, new Promise((r) => (onClosed = r)));
    const finish = (rc) => {
      process.stderr.write(
        `d1-restore: ${phase} rc=${rc} dur=${((Date.now() - started) / 1000).toFixed(1)}s\n`,
      );
    };
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup(child, 'SIGKILL');
      finish('timeout');
      reject(new Error(`${phase} timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    child.stdout.on('data', (d) => {
      if (stdout.length < OUTPUT_CAP) stdout += d;
    });
    child.stderr.on('data', (d) => {
      if (stderr.length < OUTPUT_CAP) stderr += d;
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      children.delete(child);
      onClosed();
      reject(err);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      children.delete(child);
      onClosed();
      if (timedOut) return;
      finish(code ?? signal);
      resolve({ code, signal, stdout, stderr });
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input ?? '');
  });
}

// Error tails go to stderr only and are kept short: a failed import can echo SQL (emails, tokens).
const tail = (s) => {
  const t = s.trim().split('\n').slice(-15).join('\n');
  return t.length > TAIL_CHARS ? `...${t.slice(-TAIL_CHARS)}` : t;
};

async function wrangler(phase, timeoutMs, dir, extra) {
  const res = await run(phase, timeoutMs, 'npx', [
    'wrangler',
    'd1',
    'execute',
    'DB',
    '--local',
    '--persist-to',
    dir,
    '--json',
    ...extra,
  ]);
  if (res.code !== 0) {
    throw new Error(`wrangler ${phase} failed (rc=${res.code}):\n${tail(res.stderr)}`);
  }
  return res.stdout;
}

// One result set per statement (D1 limits compound SELECTs, so counts use one statement per table).
async function queryAll(phase, dir, sql) {
  const out = await wrangler(phase, QUERY_TIMEOUT_MS, dir, ['--command', sql]);
  let parsed;
  try {
    parsed = JSON.parse(out);
  } catch {
    throw new Error(`could not parse wrangler JSON output: ${tail(out)}`);
  }
  return parsed.map((set) => set.results ?? []);
}

async function query(phase, dir, sql) {
  return (await queryAll(phase, dir, sql))[0] ?? [];
}

const quoteIdent = (n) => `"${n.replaceAll('"', '""')}"`;

async function listSchema(phase, dir) {
  const rows = await query(
    phase,
    dir,
    "SELECT type, name FROM sqlite_master WHERE type IN ('table','trigger')",
  );
  return {
    tables: rows.filter((r) => r.type === 'table' && !isInternalTable(r.name)).map((r) => r.name),
    triggers: rows.filter((r) => r.type === 'trigger').map((r) => r.name),
  };
}

async function countRows(dir, tables) {
  if (tables.length === 0) return {};
  const sql = tables.map((t) => `SELECT count(*) AS c FROM ${quoteIdent(t)}`).join('; ');
  const sets = await queryAll('count-rows', dir, sql);
  if (sets.length !== tables.length) {
    throw new Error(`expected ${tables.length} count results, got ${sets.length}`);
  }
  const counts = {};
  tables.forEach((t, i) => {
    counts[t] = sets[i][0]?.c;
  });
  return counts;
}

async function decrypt(file, passphraseEnv) {
  const passphrase = process.env[passphraseEnv];
  if (!passphrase) throw new Error(`passphrase env ${passphraseEnv} is unset or empty`);
  cleanup.plainDir = fs.mkdtempSync(path.join(os.tmpdir(), 'd1-restore-plain-'));
  const out = path.join(cleanup.plainDir, 'dump.sql');
  const res = await run(
    'gpg-decrypt',
    GPG_TIMEOUT_MS,
    'gpg',
    [...GPG_DECRYPT_FLAGS, '--output', out, path.resolve(file)],
    { input: passphrase },
  );
  if (res.code !== 0) throw new Error(`could not decrypt ${file} (gpg rc=${res.code}): ${tail(res.stderr)}`);
  return out;
}

async function restore(opts) {
  const isDefault = opts.persistTo === undefined;
  const dir = isDefault ? fs.mkdtempSync(path.join(os.tmpdir(), 'd1-restore-db-')) : opts.persistTo;
  if (isDefault) cleanup.defaultDir = dir;
  fs.writeSync(1, `persist-to\t${dir}\n`);

  const file = path.resolve(opts.file);
  if (!fs.existsSync(file)) throw new Error(`file not found: ${opts.file}`);
  const sqlPath = file.endsWith('.gpg') ? await decrypt(file, opts.passphraseEnv) : file;
  const dump = parseDump(fs.readFileSync(sqlPath, 'utf8'));
  if (dump.tables.length === 0) throw new Error('dump contains no CREATE TABLE statements');

  const before = await listSchema('list-schema-before', dir);
  if (before.tables.length > 0) {
    throw new Error(
      `target database is not empty (tables: ${before.tables.join(', ')}); restore only into an empty database`,
    );
  }

  await wrangler('import', IMPORT_TIMEOUT_MS, dir, ['--file', sqlPath]);

  const after = await listSchema('list-schema-after', dir);
  const mismatch = compareTables(after.tables, dump.tables);
  if (mismatch) throw new Error(`restored table list does not match the dump: ${mismatch}`);
  const lostTriggers = missingTriggers(dump.triggers, after.triggers);
  if (lostTriggers.length)
    throw new Error(`triggers in the dump but absent after restore: ${lostTriggers.join(', ')}`);

  const counts = await countRows(dir, after.tables);
  for (const t of opts.requireRows) {
    if (!Object.hasOwn(counts, t))
      throw new Error(`--require-rows: table ${t} is missing from the restored database`);
    if (!(counts[t] > 0)) throw new Error(`--require-rows: table ${t} has 0 rows`);
  }
  const needed = missingTriggers(opts.requireTriggers, after.triggers);
  if (needed.length)
    throw new Error(`--require-triggers: trigger(s) absent after restore: ${needed.join(', ')}`);

  for (const t of [...after.tables].sort()) fs.writeSync(1, `${t}\t${counts[t]}\n`);
  cleanup.defaultDir = undefined; // kept on success
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`d1-restore: ${err.message}\n`);
    process.exit(2);
  }
  passphraseEnvName = opts.passphraseEnv;
  const started = Date.now();
  try {
    await restore(opts);
    process.stderr.write(`d1-restore: ok duration=${Math.round((Date.now() - started) / 1000)}s\n`);
  } catch (err) {
    removeTemp();
    process.stderr.write(`d1-restore: ${err.message}\n`);
    process.exit(1);
  }
  removeTemp();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
