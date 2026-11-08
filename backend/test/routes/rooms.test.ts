import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import app from '../../src/app.js';
import { signTestJwt } from '../helpers/sign-test-jwt.js';
import { stubAccessJwks, testEnv, TEST_ACCESS_AUD } from '../helpers/access-test-env.js';
import { seedHouseholdMember } from '../helpers/seed.js';

const HOUSEHOLD_A = 1;
const HOUSEHOLD_B = 2;
const ROOM_A = 1;
const ROOM_B = 2;

async function authHeader(email: string) {
  const token = await signTestJwt({ email, aud: TEST_ACCESS_AUD });
  return { 'Cf-Access-Jwt-Assertion': token };
}

async function insertChore(name: string, roomId: number, householdId: number, deletedAt: string | null) {
  const result = await env.DB.prepare(
    `INSERT INTO chores (household_id, name, room_id, date_last_completed, duration, frequency, version, deleted_at)
     VALUES (?, ?, ?, '2026-06-01T00:00:00.000Z', 10, 1, 1, ?)`,
  )
    .bind(householdId, name, roomId, deletedAt)
    .run();
  return Number(result.meta.last_row_id);
}

async function rawChoreCount(roomId: number): Promise<number> {
  const row = await env.DB.prepare('SELECT COUNT(*) as count FROM chores WHERE room_id = ?')
    .bind(roomId)
    .first<{ count: number }>();
  return row!.count;
}

beforeEach(async () => {
  stubAccessJwks();
  await env.DB.exec('DELETE FROM chores');
  await env.DB.exec('DELETE FROM rooms');
  await env.DB.exec('DELETE FROM household_members');
  await env.DB.exec('DELETE FROM users');
  await env.DB.exec('DELETE FROM households');
  await env.DB.batch([
    env.DB.prepare('INSERT INTO households (id, name, timezone) VALUES (1, ?, ?)').bind('Household A', 'UTC'),
    env.DB.prepare('INSERT INTO households (id, name, timezone) VALUES (2, ?, ?)').bind('Household B', 'UTC'),
    env.DB.prepare('INSERT INTO rooms (id, household_id, name) VALUES (?, ?, ?)').bind(
      ROOM_A,
      HOUSEHOLD_A,
      'Kitchen',
    ),
    env.DB.prepare('INSERT INTO rooms (id, household_id, name) VALUES (?, ?, ?)').bind(
      ROOM_B,
      HOUSEHOLD_B,
      'Kitchen',
    ),
  ]);
  await seedHouseholdMember({ id: 1, householdId: HOUSEHOLD_A, email: 'admin-a@example.com', isAdmin: true });
  await seedHouseholdMember({
    id: 2,
    householdId: HOUSEHOLD_A,
    email: 'member-a@example.com',
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GET /api/rooms', () => {
  it('is accessible to a non-admin member and returns only same-household rooms', async () => {
    const res = await app.request(
      '/api/rooms',
      { headers: await authHeader('member-a@example.com') },
      testEnv(),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { name: string }[] };
    expect(body.data.map((r) => r.name)).toEqual(['Kitchen']);
  });
});

describe('POST /api/rooms', () => {
  it('allows a non-admin household member to create a room (open household privileges)', async () => {
    const res = await app.request(
      '/api/rooms',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader('member-a@example.com')) },
        body: JSON.stringify({ name: 'Garage' }),
      },
      testEnv(),
    );
    expect(res.status).toBe(201);
  });

  it('creates a room scoped to the admin own household', async () => {
    const res = await app.request(
      '/api/rooms',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader('admin-a@example.com')) },
        body: JSON.stringify({ name: 'Garage' }),
      },
      testEnv(),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { householdId: number; name: string } };
    expect(body.data.householdId).toBe(HOUSEHOLD_A);
    expect(body.data.name).toBe('Garage');
  });

  it('returns 409 for a duplicate name in the same household', async () => {
    const res = await app.request(
      '/api/rooms',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader('admin-a@example.com')) },
        body: JSON.stringify({ name: 'Kitchen' }),
      },
      testEnv(),
    );
    expect(res.status).toBe(409);
  });
});

describe('DELETE /api/rooms/:id', () => {
  it('cannot target a room in a different household (404)', async () => {
    const res = await app.request(
      `/api/rooms/${ROOM_B}`,
      { method: 'DELETE', headers: await authHeader('admin-a@example.com') },
      testEnv(),
    );
    expect(res.status).toBe(404);
  });

  it('returns 409 and refuses to delete a room that still has chores', async () => {
    await app.request(
      '/api/chores',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader('admin-a@example.com')) },
        body: JSON.stringify({
          name: 'Wash dishes',
          roomId: ROOM_A,
          dateLastCompleted: '2026-06-01T00:00:00.000Z',
          duration: 10,
          frequency: 1,
        }),
      },
      testEnv(),
    );

    const res = await app.request(
      `/api/rooms/${ROOM_A}`,
      { method: 'DELETE', headers: await authHeader('admin-a@example.com') },
      testEnv(),
    );
    expect(res.status).toBe(409);
  });

  it('deletes a room whose only chores are soft-deleted and removes the rows', async () => {
    await insertChore('Hidden 1', ROOM_A, HOUSEHOLD_A, '2026-06-02T00:00:00.000Z');
    await insertChore('Hidden 2', ROOM_A, HOUSEHOLD_A, '2026-06-02T00:00:00.000Z');

    const res = await app.request(
      `/api/rooms/${ROOM_A}`,
      { method: 'DELETE', headers: await authHeader('admin-a@example.com') },
      testEnv(),
    );

    expect(res.status).toBe(200);
    expect(await rawChoreCount(ROOM_A)).toBe(0);
  });

  it('refuses a room with one live and one soft-deleted chore, keeping both rows', async () => {
    await insertChore('Live', ROOM_A, HOUSEHOLD_A, null);
    await insertChore('Hidden', ROOM_A, HOUSEHOLD_A, '2026-06-02T00:00:00.000Z');

    const res = await app.request(
      `/api/rooms/${ROOM_A}`,
      { method: 'DELETE', headers: await authHeader('admin-a@example.com') },
      testEnv(),
    );

    expect(res.status).toBe(409);
    expect(await rawChoreCount(ROOM_A)).toBe(2);
  });

  it('leaves another household soft-deleted chores untouched when deleting a room', async () => {
    await insertChore('Hidden A', ROOM_A, HOUSEHOLD_A, '2026-06-02T00:00:00.000Z');
    await insertChore('Hidden B', ROOM_B, HOUSEHOLD_B, '2026-06-02T00:00:00.000Z');

    const res = await app.request(
      `/api/rooms/${ROOM_A}`,
      { method: 'DELETE', headers: await authHeader('admin-a@example.com') },
      testEnv(),
    );

    expect(res.status).toBe(200);
    expect(await rawChoreCount(ROOM_B)).toBe(1);
  });

  it('returns 409 (not a foreign-key 500) when a restore lands between the count and the batch', async () => {
    const restoredId = await insertChore('Restored', ROOM_A, HOUSEHOLD_A, '2026-06-02T00:00:00.000Z');
    const stillHiddenId = await insertChore('Still hidden', ROOM_A, HOUSEHOLD_A, '2026-06-02T00:00:00.000Z');
    let fired = false;
    const realDb = env.DB;
    const racingDb = new Proxy(realDb, {
      get(target, prop) {
        if (prop === 'batch') {
          return async (statements: D1PreparedStatement[]) => {
            fired = true;
            await realDb.prepare('UPDATE chores SET deleted_at = NULL WHERE id = ?').bind(restoredId).run();
            return realDb.batch(statements);
          };
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });

    const res = await app.request(
      `/api/rooms/${ROOM_A}`,
      { method: 'DELETE', headers: await authHeader('admin-a@example.com') },
      { ...testEnv(), DB: racingDb },
    );

    expect(fired).toBe(true);
    expect(res.status).toBe(409);
    expect(await rawChoreCount(ROOM_A)).toBe(2);
    const rows = await env.DB.prepare('SELECT id, deleted_at FROM chores WHERE room_id = ?')
      .bind(ROOM_A)
      .all<{ id: number; deleted_at: string | null }>();
    const byId = new Map(rows.results.map((r) => [r.id, r.deleted_at]));
    expect(byId.get(restoredId)).toBeNull();
    expect(byId.get(stillHiddenId)).not.toBeNull();
    const room = await env.DB.prepare('SELECT COUNT(*) as count FROM rooms WHERE id = ?')
      .bind(ROOM_A)
      .first<{ count: number }>();
    expect(room!.count).toBe(1);
  });

  it('returns 404 (not a foreign-key 500) when the room is deleted concurrently before the batch', async () => {
    await insertChore('Hidden', ROOM_A, HOUSEHOLD_A, '2026-06-02T00:00:00.000Z');
    let fired = false;
    const realDb = env.DB;
    const racingDb = new Proxy(realDb, {
      get(target, prop) {
        if (prop === 'batch') {
          return async (statements: D1PreparedStatement[]) => {
            fired = true;
            await realDb.prepare('DELETE FROM chores WHERE room_id = ?').bind(ROOM_A).run();
            await realDb.prepare('DELETE FROM rooms WHERE id = ?').bind(ROOM_A).run();
            return realDb.batch(statements);
          };
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });

    const res = await app.request(
      `/api/rooms/${ROOM_A}`,
      { method: 'DELETE', headers: await authHeader('admin-a@example.com') },
      { ...testEnv(), DB: racingDb },
    );

    expect(fired).toBe(true);
    expect(res.status).toBe(404);
  });

  it('deletes an empty same-household room', async () => {
    const res = await app.request(
      `/api/rooms/${ROOM_A}`,
      { method: 'DELETE', headers: await authHeader('admin-a@example.com') },
      testEnv(),
    );
    expect(res.status).toBe(200);
  });
});
