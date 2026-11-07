import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:workers';
import { getAllChores, createChore, updateChore, completeChore, deleteChore } from '../src/chores.js';
import type { ChoreInput, ChoreWire } from '../src/chores.js';

const HOUSEHOLD_A = 1;
const HOUSEHOLD_B = 2;
const ROOM_A = 1;
const ROOM_B = 2;

async function seedOrgs() {
  await env.DB.batch([
    env.DB.prepare('INSERT INTO households (id, name, timezone) VALUES (?, ?, ?)').bind(
      HOUSEHOLD_A,
      'Household A',
      'America/New_York',
    ),
    env.DB.prepare('INSERT INTO households (id, name, timezone) VALUES (?, ?, ?)').bind(
      HOUSEHOLD_B,
      'Household B',
      'America/Los_Angeles',
    ),
    env.DB.prepare('INSERT INTO rooms (id, household_id, name) VALUES (?, ?, ?)').bind(
      ROOM_A,
      HOUSEHOLD_A,
      'Living Room',
    ),
    env.DB.prepare('INSERT INTO rooms (id, household_id, name) VALUES (?, ?, ?)').bind(
      ROOM_B,
      HOUSEHOLD_B,
      'Living Room',
    ),
  ]);
}

async function createChoreOk(householdId: number, input: ChoreInput, clientId?: string): Promise<ChoreWire> {
  const result = await createChore(env.DB, householdId, input, clientId);
  if (result.status !== 'ok') throw new Error(`createChore failed: ${result.status}`);
  return result.chore;
}

const baseChoreInput = {
  name: 'Vacuum',
  roomId: ROOM_A,
  dateLastCompleted: '2026-06-01T00:00:00.000Z',
  duration: 20,
  frequency: 7,
  urgency: undefined,
};

beforeEach(async () => {
  await env.DB.exec('DELETE FROM chores');
  await env.DB.exec('DELETE FROM rooms');
  await env.DB.exec('DELETE FROM users');
  await env.DB.exec('DELETE FROM households');
  await seedOrgs();
});

describe('getAllChores', () => {
  it('returns only chores belonging to the given household', async () => {
    await createChoreOk(HOUSEHOLD_A, { ...baseChoreInput, name: 'Household A Chore' });
    await createChoreOk(HOUSEHOLD_B, { ...baseChoreInput, roomId: ROOM_B, name: 'Household B Chore' });

    const result = await getAllChores(env.DB, HOUSEHOLD_A);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Household A Chore');
  });
});

describe('createChore', () => {
  it('inserts with version = 1 and returns the row with an assigned id', async () => {
    const chore = await createChoreOk(HOUSEHOLD_A, baseChoreInput);

    expect(chore.id).toEqual(expect.any(Number));
    expect(chore.version).toBe(1);
    expect(chore.name).toBe('Vacuum');
  });

  it('rejects a roomId that belongs to a different household', async () => {
    const result = await createChore(env.DB, HOUSEHOLD_B, baseChoreInput);
    expect(result.status).toBe('invalid_room');
  });

  it('deduplicates a repeated clientId within the same household, returning the original row both times', async () => {
    const first = await createChoreOk(HOUSEHOLD_A, baseChoreInput, 'client-uuid-1');
    const second = await createChoreOk(
      HOUSEHOLD_A,
      { ...baseChoreInput, name: 'Different Name' },
      'client-uuid-1',
    );

    expect(second.id).toBe(first.id);
    expect(second.name).toBe('Vacuum');
    expect(await getAllChores(env.DB, HOUSEHOLD_A)).toHaveLength(1);
  });

  it('allows the same clientId to be reused across two different orgs', async () => {
    await createChoreOk(HOUSEHOLD_A, baseChoreInput, 'shared-client-id');
    await createChoreOk(HOUSEHOLD_B, { ...baseChoreInput, roomId: ROOM_B }, 'shared-client-id');

    expect(await getAllChores(env.DB, HOUSEHOLD_A)).toHaveLength(1);
    expect(await getAllChores(env.DB, HOUSEHOLD_B)).toHaveLength(1);
  });

  it('creates distinct rows when clientId is omitted or differs', async () => {
    await createChoreOk(HOUSEHOLD_A, baseChoreInput);
    await createChoreOk(HOUSEHOLD_A, baseChoreInput);
    await createChoreOk(HOUSEHOLD_A, baseChoreInput, 'client-uuid-2');
    await createChoreOk(HOUSEHOLD_A, baseChoreInput, 'client-uuid-3');

    expect(await getAllChores(env.DB, HOUSEHOLD_A)).toHaveLength(4);
  });
});

describe('updateChore', () => {
  it('succeeds and increments version by 1 when expectedVersion matches', async () => {
    const created = await createChoreOk(HOUSEHOLD_A, baseChoreInput);

    const result = await updateChore(
      env.DB,
      HOUSEHOLD_A,
      created.id,
      { ...baseChoreInput, name: 'Vacuum Deluxe' },
      1,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.chore.version).toBe(2);
      expect(result.chore.name).toBe('Vacuum Deluxe');
    }
  });

  it('rejects a roomId that belongs to a different household', async () => {
    const created = await createChoreOk(HOUSEHOLD_A, baseChoreInput);

    const result = await updateChore(
      env.DB,
      HOUSEHOLD_A,
      created.id,
      { ...baseChoreInput, roomId: ROOM_B },
      1,
    );

    expect(result.status).toBe('invalid_room');
  });

  it('returns a conflict result (not a thrown error) when expectedVersion does not match', async () => {
    const created = await createChoreOk(HOUSEHOLD_A, baseChoreInput);

    const result = await updateChore(
      env.DB,
      HOUSEHOLD_A,
      created.id,
      { ...baseChoreInput, name: 'Vacuum Deluxe' },
      99,
    );

    expect(result.status).toBe('conflict');
  });

  it('returns not-found when the id does not exist', async () => {
    const result = await updateChore(env.DB, HOUSEHOLD_A, 999_999, baseChoreInput, 1);

    expect(result.status).toBe('not_found');
  });

  it('returns not-found (same as nonexistent) when the id belongs to a different household', async () => {
    const created = await createChoreOk(HOUSEHOLD_B, { ...baseChoreInput, roomId: ROOM_B });

    const result = await updateChore(env.DB, HOUSEHOLD_A, created.id, baseChoreInput, 1);

    expect(result.status).toBe('not_found');
  });
});

describe('completeChore', () => {
  it('updates dateLastCompleted and increments version', async () => {
    const created = await createChoreOk(HOUSEHOLD_A, baseChoreInput);

    const result = await completeChore(env.DB, HOUSEHOLD_A, created.id, '2026-07-01T00:00:00.000Z');

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.chore.dateLastCompleted).toBe('2026-07-01T00:00:00.000Z');
      expect(result.chore.version).toBe(2);
    }
  });

  it('keeps the later of two competing completions regardless of call order — never conflicts', async () => {
    const created = await createChoreOk(HOUSEHOLD_A, baseChoreInput);

    const earlier = await completeChore(env.DB, HOUSEHOLD_A, created.id, '2026-07-01T02:00:00.000Z');
    const later = await completeChore(env.DB, HOUSEHOLD_A, created.id, '2026-07-01T03:00:00.000Z');

    expect(earlier.status).toBe('ok');
    expect(later.status).toBe('ok');
    if (later.status === 'ok') {
      expect(later.chore.dateLastCompleted).toBe('2026-07-01T03:00:00.000Z');
    }
  });

  it('leaves the stored timestamp unchanged when an earlier completion arrives after a later one', async () => {
    const created = await createChoreOk(HOUSEHOLD_A, baseChoreInput);

    await completeChore(env.DB, HOUSEHOLD_A, created.id, '2026-07-01T03:00:00.000Z');
    const result = await completeChore(env.DB, HOUSEHOLD_A, created.id, '2026-07-01T02:00:00.000Z');

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.chore.dateLastCompleted).toBe('2026-07-01T03:00:00.000Z');
    }
  });

  it('returns not-found for a nonexistent chore', async () => {
    const result = await completeChore(env.DB, HOUSEHOLD_A, 999_999, '2026-07-01T00:00:00.000Z');

    expect(result.status).toBe('not_found');
  });

  it('returns not-found for a chore in a different household', async () => {
    const created = await createChoreOk(HOUSEHOLD_B, { ...baseChoreInput, roomId: ROOM_B });

    const result = await completeChore(env.DB, HOUSEHOLD_A, created.id, '2026-07-01T00:00:00.000Z');

    expect(result.status).toBe('not_found');
  });
});

describe('deleteChore', () => {
  it('deletes a chore scoped to its household', async () => {
    const created = await createChoreOk(HOUSEHOLD_A, baseChoreInput);

    const deleted = await deleteChore(env.DB, HOUSEHOLD_A, created.id);

    expect(deleted).toBe(true);
    expect(await getAllChores(env.DB, HOUSEHOLD_A)).toHaveLength(0);
  });

  it('returns false for a chore in a different household, leaving it intact', async () => {
    const created = await createChoreOk(HOUSEHOLD_B, { ...baseChoreInput, roomId: ROOM_B });

    const deleted = await deleteChore(env.DB, HOUSEHOLD_A, created.id);

    expect(deleted).toBe(false);
    expect(await getAllChores(env.DB, HOUSEHOLD_B)).toHaveLength(1);
  });
});
