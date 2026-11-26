// DB-only data-access module for the user_notifications table. Flat functions
// taking the D1 handle first, returning discriminated unions. Deliberately does
// NO wire shaping — the NotificationStatus wire type is built by the route from
// getProvisioning(...) + env (DD-17), so there is exactly one read accessor here.

// Private snake_case shape of a user_notifications row as read from D1.
type UserNotificationRow = {
  person_hash: string;
  subscriber_token: string;
  enabled: number;
};

// The single row accessor. Returns null when the user has no row; otherwise the
// stored credentials plus the current enabled flag (soft-off preserves the row).
export async function getProvisioning(
  db: D1Database,
  userId: number,
): Promise<{ personHash: string; subscriberToken: string; enabled: boolean } | null> {
  const row = await db
    .prepare('SELECT person_hash, subscriber_token, enabled FROM user_notifications WHERE user_id = ?')
    .bind(userId)
    .first<UserNotificationRow>();

  if (!row) {
    return null;
  }

  return {
    personHash: row.person_hash,
    subscriberToken: row.subscriber_token,
    enabled: row.enabled === 1,
  };
}

// Insert-or-update the single per-user row (UNIQUE(user_id) index backs the
// upsert), always (re)setting enabled=1 and bumping updated_at — re-provisioning
// re-enables.
export async function saveProvisioning(
  db: D1Database,
  userId: number,
  { personHash, subscriberToken }: { personHash: string; subscriberToken: string },
): Promise<{ status: 'ok' }> {
  await db
    .prepare(
      `INSERT INTO user_notifications (user_id, person_hash, subscriber_token, enabled, updated_at)
       VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET
         person_hash = excluded.person_hash,
         subscriber_token = excluded.subscriber_token,
         enabled = 1,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(userId, personHash, subscriberToken)
    .run();

  return { status: 'ok' };
}

// Hard-deletes the user's row (the door said the person is no longer registered
// with this app, so the local credentials are dead). The next enable provisions
// again. Idempotent: deleting a missing row is still ok.
export async function deleteProvisioning(db: D1Database, userId: number): Promise<{ status: 'ok' }> {
  await db.prepare('DELETE FROM user_notifications WHERE user_id = ?').bind(userId).run();
  return { status: 'ok' };
}

// Soft on/off toggle — never deletes the row, so the subscriber token/QR can be
// re-displayed on re-enable without re-provisioning. not_provisioned when the
// user has no row to toggle.
export async function setEnabled(
  db: D1Database,
  userId: number,
  enabled: boolean,
): Promise<{ status: 'ok' } | { status: 'not_provisioned' }> {
  const result = await db
    .prepare('UPDATE user_notifications SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?')
    .bind(enabled ? 1 : 0, userId)
    .run();

  if (result.meta.changes === 0) {
    return { status: 'not_provisioned' };
  }

  return { status: 'ok' };
}
