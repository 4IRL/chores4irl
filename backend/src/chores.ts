import type { Chore } from '../../types/SharedTypes.js';
import { roomBelongsToHousehold } from './rooms.js';

type ChoreRow = {
  id: number;
  household_id: number;
  name: string;
  room_id: number;
  date_last_completed: string;
  duration: number;
  frequency: number;
  urgency: 'low' | 'medium' | 'high' | null;
  version: number;
};

export type ChoreWire = Omit<Chore, 'dateLastCompleted'> & {
  dateLastCompleted: string;
  version: number;
};

export type ChoreInput = Omit<Chore, 'id' | 'dateLastCompleted'> & {
  dateLastCompleted: Chore['dateLastCompleted'] | string;
};

export type MutationResult =
  | { status: 'ok'; chore: ChoreWire }
  | { status: 'conflict' }
  | { status: 'not_found' }
  | { status: 'invalid_room' };

function rowToChore(row: ChoreRow): ChoreWire {
  return {
    id: row.id,
    name: row.name,
    roomId: row.room_id,
    dateLastCompleted: row.date_last_completed,
    duration: row.duration,
    frequency: row.frequency,
    urgency: row.urgency ?? undefined,
    version: row.version,
  };
}

function dateLastCompletedString(value: Chore['dateLastCompleted'] | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

export async function getAllChores(db: D1Database, householdId: number): Promise<ChoreWire[]> {
  const result = await db
    .prepare('SELECT * FROM chores WHERE household_id = ? ORDER BY id')
    .bind(householdId)
    .all<ChoreRow>();
  return result.results.map(rowToChore);
}

export type CreateChoreResult = { status: 'ok'; chore: ChoreWire } | { status: 'invalid_room' };

export async function createChore(
  db: D1Database,
  householdId: number,
  input: ChoreInput,
  clientId?: string,
): Promise<CreateChoreResult> {
  if (!(await roomBelongsToHousehold(db, householdId, input.roomId))) {
    return { status: 'invalid_room' };
  }

  let lastRowId: number | bigint;
  try {
    const result = await db
      .prepare(
        `INSERT INTO chores
          (household_id, name, room_id, date_last_completed, duration, frequency, urgency, version, client_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      )
      .bind(
        householdId,
        input.name,
        input.roomId,
        dateLastCompletedString(input.dateLastCompleted),
        input.duration,
        input.frequency,
        input.urgency ?? null,
        clientId ?? null,
      )
      .run();
    lastRowId = result.meta.last_row_id;
  } catch (err) {
    if (!clientId || !String(err).includes('UNIQUE constraint failed')) throw err;
    const existing = await db
      .prepare('SELECT * FROM chores WHERE household_id = ? AND client_id = ?')
      .bind(householdId, clientId)
      .first<ChoreRow>();
    return { status: 'ok', chore: rowToChore(existing!) };
  }

  const row = await db
    .prepare('SELECT * FROM chores WHERE id = ? AND household_id = ?')
    .bind(lastRowId, householdId)
    .first<ChoreRow>();
  return { status: 'ok', chore: rowToChore(row!) };
}

async function fetchByHousehold(db: D1Database, householdId: number, id: number): Promise<ChoreRow | null> {
  const row = await db
    .prepare('SELECT * FROM chores WHERE id = ? AND household_id = ?')
    .bind(id, householdId)
    .first<ChoreRow>();
  return row ?? null;
}

async function applyVersionedMutation(
  db: D1Database,
  householdId: number,
  id: number,
  expectedVersion: number,
  run: () => Promise<D1Result>,
): Promise<MutationResult> {
  const existing = await fetchByHousehold(db, householdId, id);
  if (!existing) return { status: 'not_found' };

  const result = await run();
  if (result.meta.changes === 0) {
    // Row exists in this household — the WHERE clause only excludes on a version mismatch.
    return { status: 'conflict' };
  }

  const row = await fetchByHousehold(db, householdId, id);
  return { status: 'ok', chore: rowToChore(row!) };
}

export async function updateChore(
  db: D1Database,
  householdId: number,
  id: number,
  input: ChoreInput,
  expectedVersion: number,
): Promise<MutationResult> {
  if (!(await roomBelongsToHousehold(db, householdId, input.roomId))) {
    return { status: 'invalid_room' };
  }

  return applyVersionedMutation(db, householdId, id, expectedVersion, () =>
    db
      .prepare(
        `UPDATE chores
         SET name = ?, room_id = ?, date_last_completed = ?,
             duration = ?, frequency = ?, urgency = ?,
             version = version + 1
         WHERE id = ? AND household_id = ? AND version = ?`,
      )
      .bind(
        input.name,
        input.roomId,
        dateLastCompletedString(input.dateLastCompleted),
        input.duration,
        input.frequency,
        input.urgency ?? null,
        id,
        householdId,
        expectedVersion,
      )
      .run(),
  );
}

export type CompleteResult = { status: 'ok'; chore: ChoreWire } | { status: 'not_found' };

export async function completeChore(
  db: D1Database,
  householdId: number,
  id: number,
  dateLastCompleted: string,
): Promise<CompleteResult> {
  const existing = await fetchByHousehold(db, householdId, id);
  if (!existing) return { status: 'not_found' };

  await db
    .prepare(
      `UPDATE chores
       SET date_last_completed = CASE WHEN date_last_completed < ? THEN ? ELSE date_last_completed END,
           version = version + 1
       WHERE id = ? AND household_id = ?`,
    )
    .bind(dateLastCompleted, dateLastCompleted, id, householdId)
    .run();

  const row = await fetchByHousehold(db, householdId, id);
  return { status: 'ok', chore: rowToChore(row!) };
}

export async function deleteChore(db: D1Database, householdId: number, id: number): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM chores WHERE id = ? AND household_id = ?')
    .bind(id, householdId)
    .run();
  return result.meta.changes > 0;
}
