import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { env } from 'cloudflare:workers';
import chores from '../../src/routes/chores.js';
import type { AppEnv } from '../../src/types.js';

const HOUSEHOLD_A = 1;
const HOUSEHOLD_B = 2;
const ROOM_A = 1;

function testApp(householdId: number) {
  const app = new Hono<AppEnv>();
  app.use('*', async (c, next) => {
    c.set('userId', 1);
    c.set('householdId', householdId);
    c.set('isAdmin', true);
    c.set('timezone', null);
    await next();
  });
  app.route('/api/chores', chores);
  return { request: (input: string, init?: RequestInit) => app.request(input, init, env) };
}

beforeEach(async () => {
  await env.DB.exec('DELETE FROM chores');
  await env.DB.exec('DELETE FROM rooms');
  await env.DB.exec('DELETE FROM users');
  await env.DB.exec('DELETE FROM households');
  await env.DB.batch([
    env.DB.prepare('INSERT INTO households (id, name, timezone) VALUES (?, ?, ?)').bind(
      HOUSEHOLD_A,
      'Household A',
      'UTC',
    ),
    env.DB.prepare('INSERT INTO households (id, name, timezone) VALUES (?, ?, ?)').bind(
      HOUSEHOLD_B,
      'Household B',
      'UTC',
    ),
    env.DB.prepare('INSERT INTO rooms (id, household_id, name) VALUES (?, ?, ?)').bind(
      ROOM_A,
      HOUSEHOLD_A,
      'Living Room',
    ),
  ]);
});

const validChoreBody = {
  name: 'Vacuum',
  roomId: ROOM_A,
  dateLastCompleted: '2026-06-01T00:00:00.000Z',
  duration: 20,
  frequency: 7,
};

type ChoreBody = { id: number; version: number; dateLastCompleted: string };

async function postChore(householdId: number, extra: Record<string, unknown> = {}): Promise<ChoreBody> {
  const res = await testApp(householdId).request('/api/chores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...validChoreBody, ...extra }),
  });
  return ((await res.json()) as { data: ChoreBody }).data;
}

function jsonRequest(householdId: number, path: string, method: string, body?: unknown) {
  return testApp(householdId).request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('GET /api/chores', () => {
  it('returns 200 and the household-scoped list for an authenticated request', async () => {
    await testApp(HOUSEHOLD_A).request('/api/chores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validChoreBody),
    });

    const res = await testApp(HOUSEHOLD_A).request('/api/chores');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
  });
});

describe('POST /api/chores', () => {
  it('returns 400 for missing required fields', async () => {
    const res = await testApp(HOUSEHOLD_A).request('/api/chores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Vacuum' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 201 and the created chore for valid input', async () => {
    const res = await testApp(HOUSEHOLD_A).request('/api/chores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validChoreBody),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { success: boolean; data: { id: number; name: string } };
    expect(body.data.name).toBe('Vacuum');
  });

  it('deduplicates a repeated clientId, never creating a second row', async () => {
    const app = testApp(HOUSEHOLD_A);
    const bodyWithClientId = JSON.stringify({ ...validChoreBody, clientId: 'client-uuid-1' });

    const firstRes = await app.request('/api/chores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyWithClientId,
    });
    const secondRes = await app.request('/api/chores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyWithClientId,
    });

    const first = ((await firstRes.json()) as { data: { id: number } }).data;
    const second = ((await secondRes.json()) as { data: { id: number } }).data;
    expect(second.id).toBe(first.id);

    const listRes = await app.request('/api/chores');
    const list = ((await listRes.json()) as { data: unknown[] }).data;
    expect(list).toHaveLength(1);
  });
});

describe('PUT /api/chores/:id', () => {
  it('returns 409 for a stale version', async () => {
    const createRes = await testApp(HOUSEHOLD_A).request('/api/chores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validChoreBody),
    });
    const created = ((await createRes.json()) as { data: { id: number } }).data;

    const res = await testApp(HOUSEHOLD_A).request(`/api/chores/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validChoreBody, name: 'Vacuum Deluxe', version: 99 }),
    });
    expect(res.status).toBe(409);
  });

  it('returns 200 and the updated chore for a matching version', async () => {
    const createRes = await testApp(HOUSEHOLD_A).request('/api/chores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validChoreBody),
    });
    const created = ((await createRes.json()) as { data: { id: number; version: number } }).data;

    const res = await testApp(HOUSEHOLD_A).request(`/api/chores/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validChoreBody, name: 'Vacuum Deluxe', version: created.version }),
    });
    expect(res.status).toBe(200);
  });
});

describe('legacy details / longTermTask keys', () => {
  const legacyKeys = { details: 'old note', longTermTask: true };
  const jsonHeaders = { 'Content-Type': 'application/json' };

  type ChoreResponse = { data: Record<string, unknown> & { id: number; version: number } };

  async function createPlain(app: ReturnType<typeof testApp>): Promise<ChoreResponse> {
    const res = await app.request('/api/chores', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(validChoreBody),
    });
    return (await res.json()) as ChoreResponse;
  }

  it('POST accepts legacy keys and returns neither', async () => {
    const res = await testApp(HOUSEHOLD_A).request('/api/chores', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ ...validChoreBody, ...legacyKeys }),
    });
    expect(res.status).toBe(201);
    const { data } = (await res.json()) as ChoreResponse;
    expect(data).not.toHaveProperty('details');
    expect(data).not.toHaveProperty('longTermTask');
  });

  it('POST replaying the same clientId with legacy keys returns the same chore', async () => {
    const app = testApp(HOUSEHOLD_A);
    const body = JSON.stringify({ ...validChoreBody, ...legacyKeys, clientId: 'legacy-client-1' });
    const firstRes = await app.request('/api/chores', { method: 'POST', headers: jsonHeaders, body });
    const secondRes = await app.request('/api/chores', { method: 'POST', headers: jsonHeaders, body });
    expect(secondRes.status).toBeLessThan(300);
    const first = (await firstRes.json()) as ChoreResponse;
    const second = (await secondRes.json()) as ChoreResponse;
    expect(second.data.id).toBe(first.data.id);
  });

  it('POST with legacy keys but missing required fields still returns 400', async () => {
    const res = await testApp(HOUSEHOLD_A).request('/api/chores', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ name: 'Vacuum', ...legacyKeys }),
    });
    expect(res.status).toBe(400);
  });

  it('PUT accepts legacy keys and returns neither', async () => {
    const app = testApp(HOUSEHOLD_A);
    const created = await createPlain(app);

    const res = await app.request(`/api/chores/${created.data.id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({
        ...validChoreBody,
        ...legacyKeys,
        name: 'Renamed',
        version: created.data.version,
      }),
    });
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as ChoreResponse;
    expect(data.name).toBe('Renamed');
    expect(data).not.toHaveProperty('details');
    expect(data).not.toHaveProperty('longTermTask');
  });

  it('PUT with legacy keys and a stale version still returns 409', async () => {
    const app = testApp(HOUSEHOLD_A);
    const created = await createPlain(app);
    const res = await app.request(`/api/chores/${created.data.id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ ...validChoreBody, ...legacyKeys, version: 99 }),
    });
    expect(res.status).toBe(409);
  });

  it('GET rows contain neither key', async () => {
    const app = testApp(HOUSEHOLD_A);
    await createPlain(app);
    const list = (await (await app.request('/api/chores')).json()) as { data: Record<string, unknown>[] };
    expect(list.data).toHaveLength(1);
    expect(list.data[0]).not.toHaveProperty('details');
    expect(list.data[0]).not.toHaveProperty('longTermTask');
  });
});

describe('PATCH /api/chores/:id/complete', () => {
  it('returns 400 when dateLastCompleted is missing', async () => {
    const createRes = await testApp(HOUSEHOLD_A).request('/api/chores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validChoreBody),
    });
    const created = ((await createRes.json()) as { data: { id: number } }).data;

    const res = await testApp(HOUSEHOLD_A).request(`/api/chores/${created.id}/complete`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 for a nonexistent chore', async () => {
    const res = await testApp(HOUSEHOLD_A).request('/api/chores/999999/complete', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateLastCompleted: '2026-07-01T00:00:00.000Z' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 200 and updates dateLastCompleted', async () => {
    const createRes = await testApp(HOUSEHOLD_A).request('/api/chores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validChoreBody),
    });
    const created = ((await createRes.json()) as { data: { id: number } }).data;

    const res = await testApp(HOUSEHOLD_A).request(`/api/chores/${created.id}/complete`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateLastCompleted: '2026-07-01T00:00:00.000Z' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { dateLastCompleted: string } };
    expect(body.data.dateLastCompleted).toBe('2026-07-01T00:00:00.000Z');
  });

  it('keeps the later completion when an earlier one arrives afterward — never conflicts', async () => {
    const createRes = await testApp(HOUSEHOLD_A).request('/api/chores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validChoreBody),
    });
    const created = ((await createRes.json()) as { data: { id: number } }).data;

    const laterRes = await testApp(HOUSEHOLD_A).request(`/api/chores/${created.id}/complete`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateLastCompleted: '2026-07-01T03:00:00.000Z' }),
    });
    expect(laterRes.status).toBe(200);

    const earlierRes = await testApp(HOUSEHOLD_A).request(`/api/chores/${created.id}/complete`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateLastCompleted: '2026-07-01T02:00:00.000Z' }),
    });
    expect(earlierRes.status).toBe(200);
    const body = (await earlierRes.json()) as { data: { dateLastCompleted: string } };
    expect(body.data.dateLastCompleted).toBe('2026-07-01T03:00:00.000Z');
  });
});

describe('DELETE /api/chores/:id', () => {
  it('returns 404 for a nonexistent chore', async () => {
    const res = await testApp(HOUSEHOLD_A).request('/api/chores/999999', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });

  it('returns 200 for a successful delete', async () => {
    const createRes = await testApp(HOUSEHOLD_A).request('/api/chores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validChoreBody),
    });
    const created = ((await createRes.json()) as { data: { id: number } }).data;

    const res = await testApp(HOUSEHOLD_A).request(`/api/chores/${created.id}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
  });
});

describe('soft delete and PATCH /api/chores/:id/restore', () => {
  it('hides a deleted chore from the list and 404s every later write', async () => {
    const created = await postChore(HOUSEHOLD_A);
    await jsonRequest(HOUSEHOLD_A, `/api/chores/${created.id}`, 'DELETE');

    const list = (await (await jsonRequest(HOUSEHOLD_A, '/api/chores', 'GET')).json()) as { data: unknown[] };
    expect(list.data).toHaveLength(0);
    const put = await jsonRequest(HOUSEHOLD_A, `/api/chores/${created.id}`, 'PUT', {
      ...validChoreBody,
      version: created.version + 1,
    });
    const complete = await jsonRequest(HOUSEHOLD_A, `/api/chores/${created.id}/complete`, 'PATCH', {
      dateLastCompleted: '2026-07-01T00:00:00.000Z',
    });
    const second = await jsonRequest(HOUSEHOLD_A, `/api/chores/${created.id}`, 'DELETE');
    expect([put.status, complete.status, second.status]).toEqual([404, 404, 404]);
  });

  it('restores the same id with a bumped version, and it reappears in the list without deleted_at', async () => {
    const created = await postChore(HOUSEHOLD_A);
    await jsonRequest(HOUSEHOLD_A, `/api/chores/${created.id}`, 'DELETE');

    const res = await jsonRequest(HOUSEHOLD_A, `/api/chores/${created.id}/restore`, 'PATCH');

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: ChoreBody & Record<string, unknown> };
    expect(body.data.id).toBe(created.id);
    expect(body.data.version).toBe(created.version + 2);
    expect(body.data).not.toHaveProperty('deleted_at');
    expect(body.data).not.toHaveProperty('deletedAt');
    const list = (await (await jsonRequest(HOUSEHOLD_A, '/api/chores', 'GET')).json()) as {
      data: { id: number }[];
    };
    expect(list.data.map((chore) => chore.id)).toEqual([created.id]);
  });

  it('restore is 404 for a live chore, an absent id, another household, and a second restore', async () => {
    const live = await postChore(HOUSEHOLD_A);
    const gone = await postChore(HOUSEHOLD_A);
    await jsonRequest(HOUSEHOLD_A, `/api/chores/${gone.id}`, 'DELETE');

    expect((await jsonRequest(HOUSEHOLD_A, `/api/chores/${live.id}/restore`, 'PATCH')).status).toBe(404);
    expect((await jsonRequest(HOUSEHOLD_A, '/api/chores/999999/restore', 'PATCH')).status).toBe(404);
    expect((await jsonRequest(HOUSEHOLD_B, `/api/chores/${gone.id}/restore`, 'PATCH')).status).toBe(404);
    expect((await jsonRequest(HOUSEHOLD_A, `/api/chores/${gone.id}/restore`, 'PATCH')).status).toBe(200);
    expect((await jsonRequest(HOUSEHOLD_A, `/api/chores/${gone.id}/restore`, 'PATCH')).status).toBe(404);
  });

  it('restore with a non-numeric id is 400', async () => {
    const res = await jsonRequest(HOUSEHOLD_A, '/api/chores/abc/restore', 'PATCH');
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('Invalid id');
  });

  it('complete then PUT of the pre-complete snapshot restores the date (version + 2); the stale version is 409', async () => {
    const created = await postChore(HOUSEHOLD_A);
    const completeRes = await jsonRequest(HOUSEHOLD_A, `/api/chores/${created.id}/complete`, 'PATCH', {
      dateLastCompleted: '2026-07-01T00:00:00.000Z',
    });
    const completed = ((await completeRes.json()) as { data: ChoreBody }).data;

    const stale = await jsonRequest(HOUSEHOLD_A, `/api/chores/${created.id}`, 'PUT', {
      ...validChoreBody,
      version: created.version,
    });
    const undo = await jsonRequest(HOUSEHOLD_A, `/api/chores/${created.id}`, 'PUT', {
      ...validChoreBody,
      version: completed.version,
    });

    expect(stale.status).toBe(409);
    expect(undo.status).toBe(200);
    const undone = ((await undo.json()) as { data: ChoreBody }).data;
    expect(undone.dateLastCompleted).toBe(validChoreBody.dateLastCompleted);
    expect(undone.version).toBe(created.version + 2);
  });

  it('a replayed clientId create of a live chore is 201 with the row; of a deleted chore it is 410', async () => {
    const created = await postChore(HOUSEHOLD_A, { clientId: 'cid-route' });
    const replayLive = await jsonRequest(HOUSEHOLD_A, '/api/chores', 'POST', {
      ...validChoreBody,
      clientId: 'cid-route',
    });
    expect(replayLive.status).toBe(201);
    expect(((await replayLive.json()) as { data: ChoreBody }).data.id).toBe(created.id);

    await jsonRequest(HOUSEHOLD_A, `/api/chores/${created.id}`, 'DELETE');
    const replayDeleted = await jsonRequest(HOUSEHOLD_A, '/api/chores', 'POST', {
      ...validChoreBody,
      clientId: 'cid-route',
    });
    expect(replayDeleted.status).toBe(410);
    expect(await replayDeleted.json()).toEqual({ success: false, error: 'Chore was deleted' });
  });
});
