type RoomRow = {
  id: number;
  household_id: number;
  name: string;
};

export type RoomWire = {
  id: number;
  householdId: number;
  name: string;
};

export type CreateRoomResult = { status: 'ok'; room: RoomWire } | { status: 'duplicate' };
export type RenameRoomResult =
  { status: 'ok'; room: RoomWire } | { status: 'not_found' } | { status: 'duplicate' };
export type DeleteRoomResult =
  { status: 'ok' } | { status: 'not_found' } | { status: 'in_use'; choreCount: number };

function rowToRoom(row: RoomRow): RoomWire {
  return { id: row.id, householdId: row.household_id, name: row.name };
}

export async function getRoomsByHousehold(db: D1Database, householdId: number): Promise<RoomWire[]> {
  const result = await db
    .prepare('SELECT id, household_id, name FROM rooms WHERE household_id = ? ORDER BY name')
    .bind(householdId)
    .all<RoomRow>();
  return result.results.map(rowToRoom);
}

export async function createRoom(
  db: D1Database,
  householdId: number,
  name: string,
): Promise<CreateRoomResult> {
  let lastRowId: number | bigint;
  try {
    const result = await db
      .prepare('INSERT INTO rooms (household_id, name) VALUES (?, ?)')
      .bind(householdId, name)
      .run();
    lastRowId = result.meta.last_row_id;
  } catch (err) {
    if (!String(err).includes('UNIQUE constraint failed')) throw err;
    return { status: 'duplicate' };
  }

  const row = await db
    .prepare('SELECT id, household_id, name FROM rooms WHERE id = ? AND household_id = ?')
    .bind(lastRowId, householdId)
    .first<RoomRow>();
  return { status: 'ok', room: rowToRoom(row!) };
}

export async function renameRoom(
  db: D1Database,
  householdId: number,
  id: number,
  name: string,
): Promise<RenameRoomResult> {
  const existing = await db
    .prepare('SELECT id, household_id, name FROM rooms WHERE id = ? AND household_id = ?')
    .bind(id, householdId)
    .first<RoomRow>();
  if (!existing) return { status: 'not_found' };

  try {
    await db
      .prepare('UPDATE rooms SET name = ? WHERE id = ? AND household_id = ?')
      .bind(name, id, householdId)
      .run();
  } catch (err) {
    if (!String(err).includes('UNIQUE constraint failed')) throw err;
    return { status: 'duplicate' };
  }

  const row = await db
    .prepare('SELECT id, household_id, name FROM rooms WHERE id = ? AND household_id = ?')
    .bind(id, householdId)
    .first<RoomRow>();
  return { status: 'ok', room: rowToRoom(row!) };
}

export async function deleteRoom(db: D1Database, householdId: number, id: number): Promise<DeleteRoomResult> {
  const existing = await db
    .prepare('SELECT id FROM rooms WHERE id = ? AND household_id = ?')
    .bind(id, householdId)
    .first<{ id: number }>();
  if (!existing) return { status: 'not_found' };

  const inUse = await db
    .prepare(
      'SELECT COUNT(*) as count FROM chores WHERE room_id = ? AND household_id = ? AND deleted_at IS NULL',
    )
    .bind(id, householdId)
    .first<{ count: number }>();
  if (inUse && inUse.count > 0) {
    return { status: 'in_use', choreCount: inUse.count };
  }

  // Both statements carry the same NOT EXISTS guard and run in one D1 batch (one transaction), so a
  // restore landing after the count above makes both no-ops instead of tripping the chores.room_id FK.
  const liveGuard =
    'NOT EXISTS (SELECT 1 FROM chores WHERE room_id = ? AND household_id = ? AND deleted_at IS NULL)';
  const results = await db.batch([
    db
      .prepare(
        `DELETE FROM chores WHERE room_id = ? AND household_id = ? AND deleted_at IS NOT NULL AND ${liveGuard}`,
      )
      .bind(id, householdId, id, householdId),
    db
      .prepare(`DELETE FROM rooms WHERE id = ? AND household_id = ? AND ${liveGuard}`)
      .bind(id, householdId, id, householdId),
  ]);
  if (results[1].meta.changes === 0) {
    const recount = await db
      .prepare(
        'SELECT COUNT(*) as count FROM chores WHERE room_id = ? AND household_id = ? AND deleted_at IS NULL',
      )
      .bind(id, householdId)
      .first<{ count: number }>();
    const liveCount = recount?.count ?? 0;
    // Zero live chores and no room row deleted: the room was deleted concurrently.
    if (liveCount === 0) return { status: 'not_found' };
    return { status: 'in_use', choreCount: liveCount };
  }
  return { status: 'ok' };
}

export async function roomBelongsToHousehold(
  db: D1Database,
  householdId: number,
  id: number,
): Promise<boolean> {
  const row = await db
    .prepare('SELECT id FROM rooms WHERE id = ? AND household_id = ?')
    .bind(id, householdId)
    .first<{ id: number }>();
  return row != null;
}
