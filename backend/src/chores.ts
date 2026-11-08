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
  deleted_at: string | null;
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
    .prepare('SELECT * FROM chores WHERE household_id = ? AND deleted_at IS NULL ORDER BY id')
    .bind(householdId)
    .all<ChoreRow>();
  return result.results.map(rowToChore);
}

export type CreateChoreResult =
  { status: 'ok'; chore: ChoreWire } | { status: 'invalid_room' } | { status: 'deleted' };

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
    // Unfiltered on purpose: the unique (household_id, client_id) index spans soft-deleted rows.
    // A null row means it was hard-deleted concurrently; report it as deleted.
    if (!existing || existing.deleted_at !== null) return { status: 'deleted' };
    return { status: 'ok', chore: rowToChore(existing) };
  }

  const row = await db
    .prepare('SELECT * FROM chores WHERE id = ? AND household_id = ?')
    .bind(lastRowId, householdId)
    .first<ChoreRow>();
  return { status: 'ok', chore: rowToChore(row!) };
}

async function fetchByHousehold(db: D1Database, householdId: number, id: number): Promise<ChoreRow | null> {
  const row = await db
    .prepare('SELECT * FROM chores WHERE id = ? AND household_id = ? AND deleted_at IS NULL')
    .bind(id, householdId)
    .first<ChoreRow>();
  return row ?? null;
}

/** Exported for tests only (the delete-vs-write race branch); not part of the module's public API. */
export async function applyVersionedMutation(
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
    // Either a version mismatch or the chore was soft-deleted after the existence check.
    const stillThere = await fetchByHousehold(db, householdId, id);
    return stillThere ? { status: 'conflict' } : { status: 'not_found' };
  }

  const row = await fetchByHousehold(db, householdId, id);
  if (!row) return { status: 'not_found' };
  return { status: 'ok', chore: rowToChore(row) };
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
         WHERE id = ? AND household_id = ? AND version = ? AND deleted_at IS NULL`,
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
       WHERE id = ? AND household_id = ? AND deleted_at IS NULL`,
    )
    .bind(dateLastCompleted, dateLastCompleted, id, householdId)
    .run();

  const row = await fetchByHousehold(db, householdId, id);
  if (!row) return { status: 'not_found' };
  return { status: 'ok', chore: rowToChore(row) };
}

export async function deleteChore(db: D1Database, householdId: number, id: number): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE chores SET deleted_at = ?, version = version + 1
       WHERE id = ? AND household_id = ? AND deleted_at IS NULL`,
    )
    .bind(new Date().toISOString(), id, householdId)
    .run();
  return result.meta.changes > 0;
}

export type RestoreResult = { status: 'ok'; chore: ChoreWire } | { status: 'not_found' };

export async function restoreChore(db: D1Database, householdId: number, id: number): Promise<RestoreResult> {
  const result = await db
    .prepare(
      `UPDATE chores SET deleted_at = NULL, version = version + 1
       WHERE id = ? AND household_id = ? AND deleted_at IS NOT NULL`,
    )
    .bind(id, householdId)
    .run();
  if (result.meta.changes === 0) return { status: 'not_found' };
  const row = await fetchByHousehold(db, householdId, id);
  if (!row) return { status: 'not_found' };
  return { status: 'ok', chore: rowToChore(row) };
}
