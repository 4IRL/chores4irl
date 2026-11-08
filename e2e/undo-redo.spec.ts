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
      clientId: `e2e-undo-${name}-${Date.now()}`,
    },
  });
  expect(res.ok()).toBe(true);
  return ((await res.json()) as { data: { id: number } }).data.id;
}

// Tolerates a 404: the chore may already be deleted by the test body.
async function cleanup(request: APIRequestContext, token: string, id: number) {
  await request.delete(`${BACKEND_URL}/api/chores/${id}`, { headers: headers(token) });
}

async function dateOf(request: APIRequestContext, token: string, id: number) {
  return (await listChores(request, token)).find((c) => c.id === id)?.dateLastCompleted;
}

async function pendingOutboxCount(page: Page): Promise<number> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('outbox-v1') ?? '[]').length);
}

async function openAs(page: Page, token: string) {
  await page.setExtraHTTPHeaders({ 'Cf-Access-Jwt-Assertion': token });
  await page.goto('/');
}

const barFor = (page: Page, name: string) => page.getByTestId('chore-bar').filter({ hasText: name });

test('complete then Undo restores the due date, then Redo re-applies it', async ({ page, request }) => {
  const token = await signE2eJwt('member-e2e@example.com');
  const name = 'E2E Undo Complete';
  const id = await createThrowaway(request, token, name);
  try {
    await openAs(page, token);
    await barFor(page, name).click();
    await page.getByTestId('feedback-toast-undo').click();
    await expect(page.getByTestId('feedback-toast-redo')).toBeVisible();
    await expect.poll(() => dateOf(request, token, id)).toBe(ORIGINAL_DATE);

    await page.getByTestId('feedback-toast-redo').click();
    await expect(page.getByTestId('feedback-toast-undo')).toBeVisible();
    await expect.poll(() => dateOf(request, token, id)).not.toBe(ORIGINAL_DATE);
  } finally {
    await cleanup(request, token, id);
  }
});

test('delete then Undo restores the chore in place, then Redo deletes it again', async ({
  page,
  request,
}) => {
  const token = await signE2eJwt('member-e2e@example.com');
  const name = 'E2E Undo Delete';
  const id = await createThrowaway(request, token, name);
  try {
    await openAs(page, token);
    await expect(barFor(page, name)).toBeVisible();
    await page.getByTestId('chore-row').filter({ hasText: name }).getByLabel('Delete chore').click();
    await expect(barFor(page, name)).toHaveCount(0);
    await page.getByTestId('feedback-toast-undo').click();

    await expect(barFor(page, name)).toBeVisible();
    await expect(page.getByTestId('feedback-toast-redo')).toBeVisible();
    await expect.poll(async () => (await listChores(request, token)).some((c) => c.id === id)).toBe(true);

    await page.getByTestId('feedback-toast-redo').click();
    await expect(barFor(page, name)).toHaveCount(0);
    await expect.poll(async () => (await listChores(request, token)).some((c) => c.id === id)).toBe(false);
  } finally {
    await cleanup(request, token, id);
  }
});

test('undoing an offline complete cancels the queued entry and sends nothing', async ({
  page,
  context,
  request,
}) => {
  const token = await signE2eJwt('member-e2e@example.com');
  const name = 'E2E Undo Offline';
  const id = await createThrowaway(request, token, name);
  try {
    await openAs(page, token);
    await expect(barFor(page, name)).toBeVisible();

    await context.setOffline(true);
    await barFor(page, name).click();
    await expect.poll(() => pendingOutboxCount(page)).toBe(1);
    await page.getByTestId('feedback-toast-undo').click();
    await expect.poll(() => pendingOutboxCount(page)).toBe(0);

    const mutations: string[] = [];
    page.on('request', (req) => {
      if (req.method() !== 'GET' && req.url().includes('/api/chores')) mutations.push(req.url());
    });
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    // Give a (wrongly) surviving flush time to fire before asserting nothing was sent.
    await page.waitForTimeout(1500);
    expect(mutations).toEqual([]);
    expect(await dateOf(request, token, id)).toBe(ORIGINAL_DATE);
  } finally {
    await context.setOffline(false);
    await cleanup(request, token, id);
  }
});

test('Ctrl+Z undoes outside fields and is not intercepted inside the add modal', async ({
  page,
  request,
}) => {
  const token = await signE2eJwt('member-e2e@example.com');
  const name = 'E2E Undo Shortcut';
  const id = await createThrowaway(request, token, name);
  try {
    await openAs(page, token);
    await barFor(page, name).click();
    await expect(page.getByTestId('feedback-toast-undo')).toBeVisible();
    await page.keyboard.press('Control+z');
    await expect(page.getByTestId('feedback-toast-redo')).toBeVisible();
    await expect.poll(() => dateOf(request, token, id)).toBe(ORIGINAL_DATE);

    // Re-arm via Redo, then confirm Ctrl+Z inside the modal's name field does nothing.
    await page.getByTestId('feedback-toast-redo').click();
    await expect(page.getByTestId('feedback-toast-undo')).toBeVisible();
    await expect.poll(() => dateOf(request, token, id)).not.toBe(ORIGINAL_DATE);
    const redoneDate = await dateOf(request, token, id);

    await page.getByRole('button', { name: '+ Add Chore' }).click();
    const nameField = page.getByLabel('Name', { exact: true });
    await nameField.click();
    const mutations: string[] = [];
    page.on('request', (req) => {
      if (req.method() !== 'GET' && req.url().includes('/api/chores')) mutations.push(req.url());
    });
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    expect(mutations).toEqual([]);
    await expect(page.getByTestId('feedback-toast-undo')).toBeVisible();
    expect(await dateOf(request, token, id)).toBe(redoneDate);
  } finally {
    await cleanup(request, token, id);
  }
});
