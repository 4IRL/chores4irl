type MockChoreSpec = {
  name: string;
  room: string;
  daysAgo: number;
  duration: number;
  frequency: number;
};

const MOCK_CHORES: MockChoreSpec[] = [
  { name: 'Wash dishes', room: 'Kitchen', daysAgo: 0, duration: 15, frequency: 1 },
  { name: 'Take out trash', room: 'Kitchen', daysAgo: 3, duration: 5, frequency: 2 },
  { name: 'Vacuum living room', room: 'Living Room', daysAgo: 2, duration: 20, frequency: 7 },
  { name: 'Clean bathroom', room: 'Bathroom', daysAgo: 10, duration: 30, frequency: 7 },
  { name: 'Change bed sheets', room: 'Bedroom', daysAgo: 5, duration: 15, frequency: 14 },
  { name: 'Mow the lawn', room: 'Yard', daysAgo: 20, duration: 60, frequency: 14 },
  { name: 'Organize garage', room: 'Garage', daysAgo: 40, duration: 90, frequency: 90 },
  { name: 'Deep clean fridge', room: 'Kitchen', daysAgo: 60, duration: 45, frequency: 90 },
];

export type SeedMockChoresResult = { count: number };

export async function seedMockChores(
  db: D1Database,
  householdId: number,
  now: Date = new Date(),
): Promise<SeedMockChoresResult> {
  const existing = await db
    .prepare('SELECT COUNT(*) as count FROM chores WHERE household_id = ? AND deleted_at IS NULL')
    .bind(householdId)
    .first<{ count: number }>();
  if (existing && existing.count > 0) {
    throw new Error(
      `Household ${householdId} already has ${existing.count} chore(s) — refusing to seed mock data on top of existing chores`,
    );
  }

  const roomNames = Array.from(new Set(MOCK_CHORES.map((spec) => spec.room)));
  await db.batch(
    roomNames.map((name) =>
      db.prepare('INSERT OR IGNORE INTO rooms (household_id, name) VALUES (?, ?)').bind(householdId, name),
    ),
  );
  const roomRows = await db
    .prepare('SELECT id, name FROM rooms WHERE household_id = ?')
    .bind(householdId)
    .all<{ id: number; name: string }>();
  const roomIdByName = new Map(roomRows.results.map((row) => [row.name, row.id]));

  const statements = MOCK_CHORES.map((spec) => {
    const dateLastCompleted = new Date(now.getTime() - spec.daysAgo * 24 * 60 * 60 * 1000).toISOString();
    return db
      .prepare(
        `INSERT INTO chores
          (household_id, name, room_id, date_last_completed, duration, frequency, version)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
      )
      .bind(
        householdId,
        spec.name,
        roomIdByName.get(spec.room),
        dateLastCompleted,
        spec.duration,
        spec.frequency,
      );
  });

  await db.batch(statements);
  return { count: statements.length };
}
