import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { parse } from 'yaml';

import { REPO_ROOT } from './ports.mjs';

const workflow = parse(fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/ci.yml'), 'utf8'));
const backendPackage = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'backend/package.json'), 'utf8'));

const job = workflow.jobs['deploy-backend'];
const stepIndex = (name) => job.steps.findIndex((step) => step.name === name);
const stepNamed = (name) => {
  const index = stepIndex(name);
  assert.ok(index >= 0, `missing step ${name}`);
  return job.steps[index];
};
const norm = (s) => String(s).replace(/\s+/g, '');

const RESTORE = 'Record D1 restore point';
const APPLY = 'Apply D1 migrations';
const DEPLOY = 'Deploy Worker';
const CF_ENV = {
  CLOUDFLARE_API_TOKEN: '${{ secrets.CLOUDFLARE_API_TOKEN }}',
  CLOUDFLARE_ACCOUNT_ID: '${{ secrets.CLOUDFLARE_ACCOUNT_ID }}',
};

describe('ci.yml deploy-backend migrations', () => {
  it('orders restore point, apply, deploy', () => {
    const [restore, apply, deploy] = [RESTORE, APPLY, DEPLOY].map(stepIndex);
    assert.ok(restore >= 0 && apply >= 0 && deploy >= 0, 'restore, apply and deploy steps must all exist');
    assert.ok(restore < apply, 'restore point must precede apply');
    assert.ok(apply < deploy, 'apply must precede deploy');
  });

  it('gates the job on a main push and adds no step-level if or continue-on-error', () => {
    // The job-level `if` literal is a deliberate guard: changing it must fail this test.
    assert.equal(job.if, "github.event_name == 'push' && github.ref == 'refs/heads/main'");
    for (const name of [RESTORE, APPLY]) {
      const step = stepNamed(name);
      assert.equal(step['continue-on-error'], undefined, `${name} has continue-on-error`);
      assert.equal(step.if, undefined, `${name} has a step-level if`);
    }
  });

  it('runs the expected commands', () => {
    const restore = stepNamed(RESTORE);
    assert.equal(restore.run, 'npx wrangler d1 time-travel info chores4irl');
    assert.equal(restore['working-directory'], 'backend');
    const apply = stepNamed(APPLY);
    assert.equal(apply.run, 'npm run migrate:remote --workspace backend');
    assert.equal(apply['working-directory'], undefined);
  });

  it('passes exactly the Cloudflare secrets', () => {
    const normEnv = (env) => Object.fromEntries(Object.entries(env).map(([k, v]) => [k, norm(v)]));
    assert.deepEqual(normEnv(stepNamed(RESTORE).env), normEnv(CF_ENV));
    assert.deepEqual(normEnv(stepNamed(APPLY).env), normEnv(CF_ENV));
  });

  it('targets remote D1', () => {
    assert.match(backendPackage.scripts['migrate:remote'], /d1 migrations apply/);
    assert.match(backendPackage.scripts['migrate:remote'], /--remote/);
    assert.doesNotMatch(backendPackage.scripts['migrate:remote'], /--env|--local/);
  });

  it('folds the notifs key exchange into deploy-backend', () => {
    assert.equal(workflow.jobs['notifs-identity'], undefined);
    assert.deepEqual(job.permissions, { contents: 'read', 'id-token': 'write' });
    assert.equal(job.environment, undefined);

    const notifs = stepNamed('Exchange notifs app key');
    assert.equal(notifs.id, 'notifs');
    assert.match(notifs.uses, /^4IRL\/4irl-notifs\/\.github\/actions\/notifs-app@[0-9a-f]{40}$/);
    assert.equal(notifs['continue-on-error'], undefined);
    assert.equal(notifs.if, undefined);
    assert.ok(stepIndex('Exchange notifs app key') < stepIndex(RESTORE), 'exchange must precede D1 steps');
    assert.deepEqual(Object.keys(notifs.with).sort(), [
      'access_client_id',
      'access_client_secret',
      'app_id',
      'delivery_url',
    ]);
  });

  it('hands the key and Access pair to the Worker as secrets', () => {
    const deploy = stepNamed(DEPLOY);
    const secrets = String(deploy.with.secrets)
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    assert.deepEqual(secrets.sort(), [
      'NOTIFS_APP_KEY',
      'NOTIFS_DELIVERY_ACCESS_CLIENT_ID',
      'NOTIFS_DELIVERY_ACCESS_CLIENT_SECRET',
    ]);
    for (const name of secrets) {
      assert.ok(deploy.env?.[name] !== undefined, `${name} missing from Deploy Worker env`);
    }
    assert.equal(norm(deploy.env.NOTIFS_APP_KEY), norm('${{ steps.notifs.outputs.key }}'));
    for (const name of ['NOTIFS_DELIVERY_ACCESS_CLIENT_ID', 'NOTIFS_DELIVERY_ACCESS_CLIENT_SECRET']) {
      assert.equal(norm(deploy.env[name]), norm(`\${{ secrets.${name} }}`));
    }
  });

  it('uses the notifs-app action only in deploy-backend', () => {
    const uses = (j) => (j.steps ?? []).filter((step) => /notifs-app/.test(String(step.uses ?? '')));
    assert.equal(uses(job).length, 1, 'deploy-backend must have exactly one notifs-app use');
    for (const [name, j] of Object.entries(workflow.jobs)) {
      if (name === 'deploy-backend') continue;
      for (const step of j.steps ?? []) {
        assert.doesNotMatch(String(step.uses ?? ''), /notifs-app/, `${name} uses notifs-app`);
      }
    }
  });

  it('cancels in-progress runs only for pull requests', () => {
    assert.equal(
      norm(workflow.concurrency['cancel-in-progress']),
      norm("${{ github.event_name == 'pull_request' }}"),
    );
  });
});
