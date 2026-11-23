import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { signE2eJwt } from './sign-jwt.js';
import { loadPorts } from '../scripts/ports.mjs';

const BACKEND_URL = `http://localhost:${loadPorts().ports.TT_BACKEND_PORT}`;
const ORIGINAL_DATE = '2026-06-01T00:00:00.000Z';

type ApiChore = { id: number; name: string; version: number; dateLastCompleted: string };

function headers(token: string) {
  return { 'Cf-Access-Jwt-Assertion': token, 'Content-Type': 'application/json' };
}

async function listChores(request: APIRequestContext, token: string): Promise<ApiChore[]> {
  const res = await request.get(`${BACKEND_URL}/api/chores`, { headers: headers(token) });
  expect(res.ok()).toBe(true);
  return ((await res.json()) as { data: ApiChore[] }).data;
}

async function createThrowaway(request: APIRequestContext, token: string, name: string): Promise<number> {
  const res = await request.post(`${BACKEND_URL}/api/chores`, {
    headers: headers(token),
    data: {
      name,
      roomId: 1,
      dateLastCompleted: ORIGINAL_DATE,
      duration: 5,
      frequency: 3,
      clientId: `e2e-live-${name}-${Date.now()}`,
    },
  });
  expect(res.ok()).toBe(true);
  return ((await res.json()) as { data: { id: number } }).data.id;
}

// Tolerates a 404: the chore may already be deleted by the test body.
async function cleanup(request: APIRequestContext, token: string, id: number) {
  await request.delete(`${BACKEND_URL}/api/chores/${id}`, { headers: headers(token) });
}

async function openAs(page: Page, token: string) {
  await page.setExtraHTTPHeaders({ 'Cf-Access-Jwt-Assertion': token });
  await page.goto('/');
}

const barFor = (page: Page, name: string) => page.getByTestId('chore-bar').filter({ hasText: name });

// Dispatches focus until the name shows, so a refresh already in flight cannot swallow the trigger.
async function expectAfterFocus(page: Page, name: string) {
  // Bounded well under the test timeout so a failure still leaves time for cleanup.
  await expect(async () => {
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(barFor(page, name)).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
}

test("another device's create and rename appear on focus without a reload", async ({ page, request }) => {
  const token = await signE2eJwt('member-e2e@example.com');
  // A per-run suffix so a chore leaked by an earlier failed run cannot match.
  const runId = Date.now();
  const name = `E2E Live Created ${runId}`;
  const newName = `E2E Live Renamed ${runId}`;
  await openAs(page, token);
  await expect(barFor(page, 'Vacuum')).toBeVisible();
  // Any navigation from here on would mean a reload, which live refresh must not need.
  let navigations = 0;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigations += 1;
  });

  const id = await createThrowaway(request, token, name);
  try {
    await expect(barFor(page, name)).toHaveCount(0);
    await expectAfterFocus(page, name);

    const version = (await listChores(request, token)).find((c) => c.id === id)?.version;
    expect(version).toBeDefined();
    const res = await request.put(`${BACKEND_URL}/api/chores/${id}`, {
      headers: headers(token),
      data: {
        name: newName,
        roomId: 1,
        dateLastCompleted: ORIGINAL_DATE,
        duration: 5,
        frequency: 3,
        version,
      },
    });
    expect(res.ok()).toBe(true);
    await expect(barFor(page, newName)).toHaveCount(0);
    await expectAfterFocus(page, newName);
    await expect(barFor(page, name)).toHaveCount(0);
    expect(navigations).toBe(0);
  } finally {
    await cleanup(request, token, id);
  }
});
