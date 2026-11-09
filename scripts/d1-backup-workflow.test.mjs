import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { parse } from 'yaml';

import { REPO_ROOT } from './ports.mjs';

const workflow = parse(fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/d1-backup.yml'), 'utf8'));

const job = workflow.jobs.backup;
const stepIndex = (name) => job.steps.findIndex((step) => step.name === name);
const stepNamed = (name) => {
  const index = stepIndex(name);
  assert.ok(index >= 0, `missing step ${name}`);
  return job.steps[index];
};
const text = (step) => `${JSON.stringify(step.env ?? {})}\n${step.run ?? ''}`;

const CHECKOUT = 'Checkout';
const SETUP_NODE = 'Set up Node';
const INSTALL = 'Install dependencies';
const EXPORT = 'Export D1 database';
const CHECK = 'Check dump';
const ENCRYPT = 'Encrypt dump';
const GENKEY = 'Generate backup key';
const UPLOAD = 'Upload backup';
const VERIFY = 'Verify upload';
const SMOKE = 'Restore smoke check';
const DELETE_FAILED = 'Delete failed backup object';
const PRUNE = 'Prune old backups';
const NOTIFY = 'Notify on failure';

const ALL_NAMES = [
  CHECKOUT,
  SETUP_NODE,
  INSTALL,
  EXPORT,
  CHECK,
  ENCRYPT,
  GENKEY,
  UPLOAD,
  VERIFY,
  SMOKE,
  DELETE_FAILED,
  PRUNE,
  NOTIFY,
];
const R2_STEPS = [UPLOAD, VERIFY, DELETE_FAILED, PRUNE];
const runs = () => job.steps.filter((s) => typeof s.run === 'string');
const anyKey = (node, key) =>
  node !== null &&
  typeof node === 'object' &&
  Object.entries(node).some(([k, v]) => k === key || anyKey(v, key));

describe('d1-backup.yml shape', () => {
  it('has the exact steps in order, smoke between verify and delete failed object', () => {
    assert.deepEqual(
      job.steps.map((s) => s.name),
      ALL_NAMES,
    );
    assert.ok(stepIndex(VERIFY) < stepIndex(SMOKE) && stepIndex(SMOKE) < stepIndex(DELETE_FAILED));
    assert.ok(stepIndex(SMOKE) < stepIndex(PRUNE));
  });

  it('has the name, triggers, permissions, concurrency and job settings', () => {
    assert.equal(workflow.name, 'D1 Backup');
    assert.deepEqual(workflow.on.schedule, [{ cron: '17 10 * * 0' }]);
    assert.deepEqual(Object.keys(workflow.on.workflow_dispatch.inputs), ['keep']);
    assert.equal(String(workflow.on.workflow_dispatch.inputs.keep.default), '8');
    assert.deepEqual(workflow.permissions, { contents: 'read' });
    assert.deepEqual(workflow.concurrency, { group: 'd1-backup', 'cancel-in-progress': false });
    assert.equal(job['timeout-minutes'], 20);
    assert.equal(job['runs-on'], 'ubuntu-latest');
    assert.equal(String(workflow.env.WRANGLER_SEND_METRICS), 'false');
    assert.match(String(workflow.env.D1_BACKUP_KEEP), /inputs\.keep/);
    assert.match(String(workflow.env.D1_BACKUP_KEEP), /'8'/);
    assert.equal(workflow.env.D1_BACKUP_BUCKET, 'chores4irl-d1-backups');
  });

  it('runs the export against remote chores4irl non-interactively', () => {
    const run = stepNamed(EXPORT).run;
    assert.ok(run.includes('d1 export chores4irl --remote'));
    assert.match(run, /\s-y\s/);
    assert.ok(run.includes('--output'));
    assert.equal(stepNamed(EXPORT)['working-directory'], 'backend');
  });

  it('pins every action to a commit SHA and never uses continue-on-error', () => {
    for (const step of job.steps) {
      if (step.uses) assert.match(step.uses, /@[0-9a-f]{40}/, `${step.name} is not SHA-pinned`);
    }
    assert.equal(anyKey(workflow, 'continue-on-error'), false);
  });
});

describe('d1-backup.yml shell and hygiene', () => {
  it('uses bash (pipefail) and never overrides shell or pipes into grep -q', () => {
    assert.equal(job.defaults.run.shell, 'bash');
    for (const step of job.steps) {
      assert.equal(step.shell, undefined, `${step.name} sets shell`);
    }
    for (const step of runs()) assert.ok(!step.run.includes('| grep -q'), `${step.name} pipes into grep -q`);
  });

  it('never swallows errors', () => {
    for (const step of runs()) {
      for (const bad of ['|| true', 'set +e', '2>/dev/null', '&>/dev/null']) {
        assert.ok(!step.run.includes(bad), `${step.name} contains ${bad}`);
      }
    }
  });

  it('restricts delete-object and step-level if', () => {
    for (const step of runs()) {
      const has = step.run.includes('delete-object');
      assert.equal(has, step.name === PRUNE || step.name === DELETE_FAILED, `delete-object in ${step.name}`);
    }
    for (const step of job.steps) {
      if (step.name === DELETE_FAILED || step.name === NOTIFY) assert.equal(step.if, 'failure()');
      else assert.equal(step.if, undefined, `${step.name} has an if`);
    }
  });

  it('gives every step an integer timeout summing below the job timeout', () => {
    let sum = 0;
    for (const step of job.steps) {
      assert.ok(Number.isInteger(step['timeout-minutes']), `${step.name} lacks timeout-minutes`);
      sum += step['timeout-minutes'];
    }
    assert.ok(sum < job['timeout-minutes'], `step timeouts ${sum} not below job ${job['timeout-minutes']}`);
  });

  it('logs start and end with exit code and duration in each run step', () => {
    for (const step of runs()) {
      assert.match(step.run, /date -u/, `${step.name} does not log date -u`);
      assert.match(step.run, /duration=/, `${step.name} does not log duration`);
    }
  });
});

describe('d1-backup.yml dump gates and traps', () => {
  it('checks the dump is non-empty and has CREATE TABLE via grep on the file', () => {
    const run = stepNamed(CHECK).run;
    assert.ok(run.includes('test -s'));
    assert.match(run, /grep -q 'CREATE TABLE' "\$RUNNER_TEMP\/backup\.sql"/);
  });

  it('has exactly the trap inventory', () => {
    for (const name of [EXPORT, CHECK, ENCRYPT]) {
      const run = stepNamed(name).run;
      assert.match(run, /trap '[^']*rm -f "\$RUNNER_TEMP\/backup\.sql"[^']*' ERR/, `${name} ERR trap`);
      assert.match(run, /trap '[^']*rm -f "\$RUNNER_TEMP\/backup\.sql"[^']*' TERM/, `${name} TERM trap`);
      assert.doesNotMatch(run, /' EXIT/, `${name} has EXIT trap`);
    }
    const smoke = stepNamed(SMOKE).run;
    assert.ok(smoke.includes(`trap 'rm -rf "$RUNNER_TEMP/smoke-db"' EXIT`));
    assert.ok(smoke.includes(`trap 'exit 143' TERM`));
    for (const step of runs()) {
      if ([EXPORT, CHECK, ENCRYPT, SMOKE].includes(step.name)) continue;
      assert.ok(!step.run.includes('trap'), `${step.name} contains trap`);
    }
    const withExit = runs().filter((s) => /' EXIT/.test(s.run));
    assert.deepEqual(
      withExit.map((s) => s.name),
      [SMOKE],
    );
  });

  it('removes backup.sql explicitly after gpg in the encrypt step', () => {
    const run = stepNamed(ENCRYPT).run;
    const gpgAt = run.indexOf('gpg ');
    const rmAt = run.lastIndexOf('rm -f "$RUNNER_TEMP/backup.sql"');
    assert.ok(gpgAt >= 0);
    assert.ok(rmAt > gpgAt, 'explicit rm must come after gpg');
  });
});

describe('d1-backup.yml upload, verify and key', () => {
  it('uploads the .gpg, never backup.sql', () => {
    const run = stepNamed(UPLOAD).run;
    assert.equal(run.split('aws s3 cp').length - 1, 1);
    const cp = run.split('\n').find((l) => l.includes('aws s3 cp'));
    assert.ok(cp, 'no aws s3 cp');
    assert.ok(cp.includes('"s3://$D1_BACKUP_BUCKET/$D1_BACKUP_KEY"'));
    assert.ok(cp.includes('backup.sql.gpg'));
    assert.ok(!/backup\.sql(?!\.gpg)/.test(cp));
  });

  it('verifies size and md5 with a multipart fallback', () => {
    const run = stepNamed(VERIFY).run;
    for (const needle of ['ContentLength', 'ETag', 'md5sum']) assert.ok(run.includes(needle), needle);
    assert.match(run, /multipart/);
  });

  it('sets both when_required checksum vars in every R2 step', () => {
    for (const name of R2_STEPS) {
      const env = stepNamed(name).env;
      assert.equal(env.AWS_REQUEST_CHECKSUM_CALCULATION, 'when_required', name);
      assert.equal(env.AWS_RESPONSE_CHECKSUM_VALIDATION, 'when_required', name);
    }
  });

  it('generates the key once and exports it after test -n', () => {
    const withKey = runs().filter((s) => s.run.includes('scripts/d1-backup.mjs key'));
    assert.deepEqual(
      withKey.map((s) => s.name),
      [GENKEY],
    );
    const run = withKey[0].run;
    assert.ok(run.includes('KEY=$(node scripts/d1-backup.mjs key)'));
    const testAt = run.indexOf('test -n "$KEY"');
    const appendAt = run.indexOf('>> "$GITHUB_ENV"');
    assert.ok(testAt >= 0 && appendAt > testAt);
    for (const name of R2_STEPS) assert.ok(stepNamed(name).run.includes('D1_BACKUP_KEY'), name);
  });
});

describe('d1-backup.yml failed-backup cleanup', () => {
  it('is placed correctly and deletes exactly the one generated key', () => {
    const step = stepNamed(DELETE_FAILED);
    const run = step.run;
    assert.ok(stepIndex(DELETE_FAILED) > stepIndex(VERIFY));
    assert.ok(stepIndex(DELETE_FAILED) < stepIndex(PRUNE));
    assert.equal(run.split('delete-object').length - 1, 1);
    assert.ok(run.includes('--key "$D1_BACKUP_KEY"'));
    for (const bad of ['list-objects', '--prefix', 'xargs', 'for ', 'while ']) {
      assert.ok(!run.includes(bad), `contains ${bad}`);
    }
    assert.match(run, /-z "\$\{?D1_BACKUP_KEY/);
    assert.match(run, /exit 0/);
    assert.ok(run.includes('d1/chores4irl-'));
  });

  it('references only R2 and account secrets', () => {
    const t = text(stepNamed(DELETE_FAILED));
    for (const bad of ['D1_BACKUP_PASSPHRASE', 'D1_BACKUP_ALERT_WEBHOOK', 'CLOUDFLARE_API_TOKEN']) {
      assert.ok(!t.includes(bad), `references ${bad}`);
    }
  });
});

describe('d1-backup.yml restore smoke check', () => {
  it('restores the retained local .gpg through the CLI with the require flags', () => {
    const step = stepNamed(SMOKE);
    const run = step.run;
    assert.ok(run.includes('node scripts/d1-restore.mjs "$RUNNER_TEMP/backup.sql.gpg"'));
    assert.ok(run.includes('--persist-to "$RUNNER_TEMP/smoke-db"'));
    assert.ok(run.includes('--require-rows users,d1_migrations'));
    assert.ok(run.includes('--require-triggers prevent_owner_account_deletion'));
    assert.ok(!run.includes('awk'), 'no inline awk check');
    assert.equal(step.if, undefined);
    assert.match(run, /d1-restore\.mjs[^\n]*\|\| rc=\$\?/);
    assert.match(run.trimEnd(), /test "\$rc" -eq 0$/);
    const nodeAt = run.indexOf('node scripts/d1-restore.mjs');
    assert.ok(run.indexOf("' EXIT") >= 0 && run.indexOf("' EXIT") < nodeAt, 'EXIT trap before node');
    assert.ok(run.indexOf("' TERM") >= 0 && run.indexOf("' TERM") < nodeAt, 'TERM trap before node');
  });

  it('has only the passphrase secret and no R2 access', () => {
    const step = stepNamed(SMOKE);
    assert.deepEqual(Object.keys(step.env), ['D1_BACKUP_PASSPHRASE']);
    assert.equal(step.env.D1_BACKUP_PASSPHRASE, '${{ secrets.D1_BACKUP_PASSPHRASE }}');
    const t = text(step);
    for (const bad of ['R2_', 'AWS_', 'aws ', 'CLOUDFLARE_']) {
      assert.ok(!t.includes(bad), `smoke references ${bad}`);
    }
  });
});

describe('d1-backup.yml prune', () => {
  it('fails closed and calls the CLI', () => {
    const run = stepNamed(PRUNE).run;
    assert.ok(run.includes(`tr '\\t' '\\n'`));
    assert.ok(run.includes('-z "$LISTING"'));
    assert.ok(run.includes('"None"'));
    assert.ok(run.includes('prune --keep "$D1_BACKUP_KEEP" --protect'));
  });
});

describe('d1-backup.yml passphrase and secrets', () => {
  it('feeds the passphrase to gpg on stdin only', () => {
    const run = stepNamed(ENCRYPT).run;
    const gpgLine = run.split('\n').find((l) => l.includes('gpg '));
    assert.ok(gpgLine.includes('--passphrase-fd 0'));
    assert.ok(!gpgLine.includes('--passphrase '));
    assert.ok(!gpgLine.includes('--passphrase='));
    for (const step of runs()) {
      for (const line of step.run.split('\n')) {
        if (!line.includes('D1_BACKUP_PASSPHRASE')) continue;
        if (/^\s*test -n "\$D1_BACKUP_PASSPHRASE"\s*$/.test(line)) continue; // empty-passphrase guard
        assert.match(line, /^\s*(printf|echo) .*D1_BACKUP_PASSPHRASE.*\|\s*gpg\b/, `${step.name}: ${line}`);
      }
    }
    assert.ok(run.includes('test -n "$D1_BACKUP_PASSPHRASE"'), 'encrypt must reject an empty passphrase');
    assert.match(
      gpgLine,
      /^\s*printf .*D1_BACKUP_PASSPHRASE.*\|\s*gpg /,
      'passphrase must be piped into this gpg line',
    );
  });

  it('allows only the per-step secrets, in env only (never templated into run or with)', () => {
    const R2 = ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'CLOUDFLARE_ACCOUNT_ID'];
    const allowed = {
      [EXPORT]: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],
      [ENCRYPT]: ['D1_BACKUP_PASSPHRASE'],
      [SMOKE]: ['D1_BACKUP_PASSPHRASE'],
      [UPLOAD]: R2,
      [VERIFY]: R2,
      [DELETE_FAILED]: R2,
      [PRUNE]: R2,
      [NOTIFY]: ['D1_BACKUP_ALERT_WEBHOOK'],
    };
    for (const step of job.steps) {
      const used = [
        ...new Set([...JSON.stringify(step).matchAll(/secrets\.(\w+)/g)].map((m) => m[1])),
      ].sort();
      assert.deepEqual(used, [...(allowed[step.name] ?? [])].sort(), `secrets in ${step.name}`);
      assert.ok(
        !JSON.stringify(step.run ?? '').includes('${{'),
        `${step.name} templates an expression into run`,
      );
    }
  });

  it('scopes each secret to the steps that need it', () => {
    for (const bag of [workflow.env, job.env ?? {}]) {
      assert.ok(!JSON.stringify(bag).includes('secrets.'), 'top-level or job env references secrets');
    }
    for (const step of job.steps) {
      const t = text(step);
      if (t.includes('D1_BACKUP_PASSPHRASE'))
        assert.ok([ENCRYPT, SMOKE].includes(step.name), `passphrase in ${step.name}`);
      if (t.includes('R2_ACCESS_KEY_ID') || t.includes('R2_SECRET_ACCESS_KEY')) {
        assert.ok(R2_STEPS.includes(step.name), `R2 keys in ${step.name}`);
      }
      if (t.includes('D1_BACKUP_ALERT_WEBHOOK')) assert.equal(step.name, NOTIFY);
      if (t.includes('CLOUDFLARE_API_TOKEN')) assert.equal(step.name, EXPORT);
      if (t.includes('CLOUDFLARE_ACCOUNT_ID'))
        assert.ok([EXPORT, ...R2_STEPS].includes(step.name), `account id in ${step.name}`);
    }
  });
});

describe('d1-backup.yml notify', () => {
  it('is last, posts with curl and fails when the webhook is unset', () => {
    assert.equal(stepIndex(NOTIFY), job.steps.length - 1);
    const step = stepNamed(NOTIFY);
    for (const needle of [
      'curl',
      '--fail',
      '--max-time',
      'GITHUB_RUN_ID',
      'D1_BACKUP_ALERT_WEBHOOK secret unset',
    ]) {
      assert.ok(step.run.includes(needle), needle);
    }
    assert.match(step.run, /-z "\$D1_BACKUP_ALERT_WEBHOOK"/);
    // one message under every field name the common webhook services read: Discord needs
    // `content`, Slack/Mattermost `text`, generic endpoints `message`; each ignores the rest
    for (const field of ['content', 'text', 'message']) {
      assert.ok(step.run.includes(`\\"${field}\\":\\"D1 Backup failed: $RUN_URL\\"`), field);
    }
    assert.deepEqual(Object.keys(step.env), ['D1_BACKUP_ALERT_WEBHOOK']);
    assert.ok(!/secrets\.(?!D1_BACKUP_ALERT_WEBHOOK)/.test(text(step)));
  });
});
