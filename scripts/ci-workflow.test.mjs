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

  it('cancels in-progress runs only for pull requests', () => {
    assert.equal(
      norm(workflow.concurrency['cancel-in-progress']),
      norm("${{ github.event_name == 'pull_request' }}"),
    );
  });
});
