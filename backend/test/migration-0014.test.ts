import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

const USER_ID = 1;
const MIGRATION = '0014_clear_stale_user_notifications.sql';

beforeEach(async () => {
  await env.DB.exec('DELETE FROM user_notifications');
  await env.DB.exec('DELETE FROM household_members');
  await env.DB.exec('DELETE FROM users');
  await env.DB.prepare('INSERT INTO users (id, email, is_admin) VALUES (?, ?, 0)')
    .bind(USER_ID, 'user@example.com')
    .run();
});

describe('migration 0014 clear_stale_user_notifications', () => {
  it('deletes every user_notifications row and leaves the schema unchanged', async () => {
    // The setup file already applied all migrations, so run 0014's SQL directly.
    const migration = env.TEST_MIGRATIONS.find((m) => m.name === MIGRATION);
    expect(migration, `${MIGRATION} not found in TEST_MIGRATIONS`).toBeDefined();

    await env.DB.prepare(
      'INSERT INTO user_notifications (user_id, person_hash, subscriber_token) VALUES (?, ?, ?)',
    )
      .bind(USER_ID, 'hash-1', 'tk_1')
      .run();
    const before = await env.DB.prepare('PRAGMA table_info(user_notifications)').all();

    for (const q of migration!.queries) {
      await env.DB.prepare(q).run();
    }

    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM user_notifications').first<{ n: number }>();
    expect(count?.n).toBe(0);
    const after = await env.DB.prepare('PRAGMA table_info(user_notifications)').all();
    expect(after.results).toEqual(before.results);
  });
});
