// Naming and retention logic for the weekly D1 backup workflow
// (.github/workflows/d1-backup.yml). Pure functions plus a small CLI wrapper.

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const KEY_RE = /^d1\/chores4irl-\d{8}T\d{6}Z\.sql\.gpg$/;

export function backupKey(date) {
  const p = (n, w = 2) => String(n).padStart(w, '0');
  const stamp =
    `${p(date.getUTCFullYear(), 4)}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}` +
    `T${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}Z`;
  return `d1/chores4irl-${stamp}.sql.gpg`;
}

export function isBackupKey(key) {
  return typeof key === 'string' && KEY_RE.test(key);
}

export function selectBackupsToPrune(keys, keep, protect) {
  if (!Number.isInteger(keep) || keep < 1) {
    throw new Error(`keep must be an integer >= 1, got ${String(keep)}`);
  }
  if (!keys.includes(protect)) {
    throw new Error(`protected key ${String(protect)} not found in listing`);
  }
  return keys
    .filter(isBackupKey)
    .sort()
    .reverse()
    .slice(keep)
    .filter((k) => k !== protect);
}

function parseStrictInt(raw, name) {
  if (typeof raw !== 'string' || !/^[0-9]+$/.test(raw)) {
    throw new Error(`${name} must be a base-10 integer string, got ${JSON.stringify(raw)}`);
  }
  return Number.parseInt(raw, 10);
}

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    if (flag !== '--keep' && flag !== '--protect') throw new Error(`unknown argument ${flag}`);
    if (i + 1 >= args.length) throw new Error(`${flag} needs a value`);
    flags[flag.slice(2)] = args[i + 1];
  }
  return flags;
}

export function runCli(argv, readStdin = () => fs.readFileSync(0, 'utf8')) {
  const [cmd, ...rest] = argv;
  if (cmd === 'key') {
    return `${backupKey(new Date())}\n`;
  }
  if (cmd === 'prune') {
    const flags = parseFlags(rest);
    if (flags.keep === undefined) throw new Error('--keep is required');
    if (flags.protect === undefined) throw new Error('--protect is required');
    const keep = parseStrictInt(flags.keep, '--keep');
    const keys = readStdin()
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '');
    const out = selectBackupsToPrune(keys, keep, flags.protect);
    return out.map((k) => `${k}\n`).join('');
  }
  throw new Error(`unknown subcommand ${JSON.stringify(cmd)} (expected key | prune)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(runCli(process.argv.slice(2)));
  } catch (err) {
    process.stderr.write(`d1-backup: ${err.message}\n`);
    process.exit(1);
  }
}
