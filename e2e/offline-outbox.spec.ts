import { test, expect, type APIRequestContext } from '@playwright/test';
import { signE2eJwt } from './sign-jwt.js';
import { loadPorts } from '../scripts/ports.mjs';

const BACKEND_URL = `http://localhost:${loadPorts().ports.TT_BACKEND_PORT}`;

async function pendingOutboxCount(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('outbox-v1') ?? '[]').length);
}

async function getChores(
  request: APIRequestContext,
  token: string,
): Promise<{ id: number; name: string; version: number }[]> {
  const res = await request.get(`${BACKEND_URL}/api/chores`, {
    headers: { 'Cf-Access-Jwt-Assertion': token },
  });
  const body = (await res.json()) as { data: { id: number; name: string; version: number }[] };
  return body.data;
}

// These tests mutate/create real rows against the shared seeded org — global-setup only wipes
// the DB once per whole suite run, not per file, so leaving residue here would break sibling
// spec files (e.g. timezone-parity.spec.ts) that assume exactly the two originally-seeded chores.
async function restoreVacuum(request: APIRequestContext, token: string) {
  const chores = await getChores(request, token);
  const vacuum = chores.find((c) => c.name === 'Vacuum');
  if (!vacuum) return;
  await request.put(`${BACKEND_URL}/api/chores/${vacuum.id}`, {
    headers: { 'Cf-Access-Jwt-Assertion': token, 'Content-Type': 'application/json' },
    data: {
      name: 'Vacuum',
      roomId: 1,
      dateLastCompleted: '2026-06-01T00:00:00.000Z',
      duration: 20,
      frequency: 7,
      version: vacuum.version,
    },
  });
}

async function deleteChoreByName(request: APIRequestContext, token: string, name: string) {
  const chores = await getChores(request, token);
  const match = chores.find((c) => c.name === name);
  if (!match) return;
  await request.delete(`${BACKEND_URL}/api/chores/${match.id}`, {
    headers: { 'Cf-Access-Jwt-Assertion': token },
  });
}

test('completing a chore while offline updates the UI immediately and syncs once back online', async ({
  page,
  context,
  request,
}) => {
  const token = await signE2eJwt('member-e2e@example.com');
  await page.setExtraHTTPHeaders({ 'Cf-Access-Jwt-Assertion': token });
  await page.goto('/');

  const vacuumBar = page.getByTestId('chore-bar').filter({ hasText: 'Vacuum' });
  await expect(vacuumBar).toBeVisible();

  await context.setOffline(true);
  await vacuumBar.click();

  // Optimistic update happens immediately, with no network round trip completing.
  await expect(vacuumBar.getByText('0 days ago')).toBeVisible({ timeout: 2000 });
  await expect.poll(() => pendingOutboxCount(page)).toBe(1);
  await expect(page.getByTestId('feedback-toast')).toBeVisible();
  await expect(page.getByTestId('feedback-toast')).toHaveAttribute('data-tone', 'neutral');

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => pendingOutboxCount(page), { timeout: 10_000 }).toBe(0);

  // Reload (now online) to confirm the server-confirmed state actually persisted.
  await page.reload();
  const vacuumBarAfterReload = page.getByTestId('chore-bar').filter({ hasText: 'Vacuum' });
  await expect(vacuumBarAfterReload.getByText('0 days ago')).toBeVisible();

  await restoreVacuum(request, token);
});

test('adding a chore while offline survives a reload while still offline', async ({
  page,
  context,
  request,
}) => {
  const token = await signE2eJwt('member-e2e@example.com');
  await page.setExtraHTTPHeaders({ 'Cf-Access-Jwt-Assertion': token });
  await page.goto('/');
  await expect(page.getByTestId('chore-bar').filter({ hasText: 'Vacuum' })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);

  await context.setOffline(true);

  await page.getByRole('button', { name: '+ Add Chore' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Mop Floors');
  await page.getByLabel('Room').selectOption({ label: 'Kitchen' });
  await page.getByLabel('Last Completed').fill('2026-06-15');
  await page.getByLabel('Duration (minutes)').fill('15');
  await page.getByLabel('Frequency (days)').fill('3');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Mop Floors')).toBeVisible();

  await page.reload();

  await expect(page.getByText('Mop Floors')).toBeVisible();

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => pendingOutboxCount(page), { timeout: 10_000 }).toBe(0);

  await deleteChoreByName(request, token, 'Mop Floors');
});

test('a create mutation whose ack is lost over the network is not duplicated once retried', async ({
  page,
  context,
  request,
}) => {
  const token = await signE2eJwt('member-e2e@example.com');
  await page.setExtraHTTPHeaders({ 'Cf-Access-Jwt-Assertion': token });
  await page.goto('/');
  await expect(page.getByTestId('chore-bar').filter({ hasText: 'Vacuum' })).toBeVisible();

  await context.setOffline(true);

  await page.getByRole('button', { name: '+ Add Chore' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Water Plants');
  await page.getByLabel('Room').selectOption({ label: 'Living Room' });
  await page.getByLabel('Last Completed').fill('2026-06-10');
  await page.getByLabel('Duration (minutes)').fill('5');
  await page.getByLabel('Frequency (days)').fill('4');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect.poll(() => pendingOutboxCount(page)).toBe(1);
  const clientId: string = await page.evaluate(
    () => JSON.parse(localStorage.getItem('outbox-v1') ?? '[]')[0].id,
  );

  // Simulate the request having actually reached and been applied by the server, with only the
  // ack lost on the way back — by directly creating the row against the real backend using the
  // same clientId the outbox will retry with once it flushes.
  const preSeed = await request.post(`${BACKEND_URL}/api/chores`, {
    headers: { 'Cf-Access-Jwt-Assertion': token, 'Content-Type': 'application/json' },
    data: {
      name: 'Water Plants',
      roomId: 1,
      dateLastCompleted: '2026-06-10T00:00:00.000Z',
      duration: 5,
      frequency: 4,
      clientId,
    },
  });
  expect(preSeed.ok()).toBe(true);

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => pendingOutboxCount(page), { timeout: 10_000 }).toBe(0);

  const chores = await getChores(request, token);
  expect(chores.filter((c) => c.name === 'Water Plants')).toHaveLength(1);

  await deleteChoreByName(request, token, 'Water Plants');
});
