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

  async function legacyColumns(id: number) {
    return env.DB.prepare('SELECT details, long_term_task FROM chores WHERE id = ?')
      .bind(id)
      .first<{ details: string | null; long_term_task: number }>();
  }

  async function createPlain(app: ReturnType<typeof testApp>): Promise<ChoreResponse> {
    const res = await app.request('/api/chores', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(validChoreBody),
    });
    return (await res.json()) as ChoreResponse;
  }

  async function setLegacyInSql(id: number) {
    await env.DB.prepare('UPDATE chores SET details = ?, long_term_task = 1 WHERE id = ?')
      .bind('set in sql', id)
      .run();
  }

  it('POST accepts legacy keys, returns neither, and writes nothing', async () => {
    const res = await testApp(HOUSEHOLD_A).request('/api/chores', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ ...validChoreBody, ...legacyKeys }),
    });
    expect(res.status).toBe(201);
    const { data } = (await res.json()) as ChoreResponse;
    expect(data).not.toHaveProperty('details');
    expect(data).not.toHaveProperty('longTermTask');
    expect(await legacyColumns(data.id)).toEqual({ details: null, long_term_task: 0 });
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

  it('PUT accepts legacy keys, returns neither, and leaves SQL-set columns unchanged', async () => {
    const app = testApp(HOUSEHOLD_A);
    const created = await createPlain(app);
    await setLegacyInSql(created.data.id);

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
    expect(await legacyColumns(created.data.id)).toEqual({ details: 'set in sql', long_term_task: 1 });
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
    const created = await createPlain(app);
    await setLegacyInSql(created.data.id);
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
