import { describe, it, expect, beforeEach } from 'vitest';
import { mockFetch, resetMockData } from './mockApi';

type ChoreWire = {
  id: number;
  name: string;
  roomId: number;
  dateLastCompleted: string;
  duration: number;
  frequency: number;
  version: number;
};

async function json<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

beforeEach(() => {
  resetMockData();
});

describe('mockFetch: /api/me', () => {
  it('returns a fake authenticated admin user with a single-household membership', async () => {
    const res = await mockFetch('/api/me');
    expect(res.status).toBe(200);
    const me = await json<{
      email: string;
      isAdmin: boolean;
      currentHouseholdId: number;
      memberships: { householdId: number }[];
    }>(res);
    expect(me.email).toBeTruthy();
    expect(me.memberships).toHaveLength(1);
    expect(me.isAdmin).toBe(true);
    expect(me.currentHouseholdId).toBe(me.memberships[0].householdId);
  });
});

describe('mockFetch: PATCH /api/households/:id', () => {
  it('updates the timezone and reflects it in a subsequent GET /api/me', async () => {
    const res = await mockFetch('/api/households/1', {
      method: 'PATCH',
      body: JSON.stringify({ timezone: 'Europe/London' }),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: { timezone: string } }>(res);
    expect(body.data.timezone).toBe('Europe/London');

    const meRes = await json<{ memberships: { householdId: number; householdTimezone: string }[] }>(
      await mockFetch('/api/me'),
    );
    expect(meRes.memberships.find((m) => m.householdId === 1)?.householdTimezone).toBe('Europe/London');
  });
});

describe('mockFetch: /api/notifications', () => {
  type Status = {
    provisioned: boolean;
    enabled: boolean;
    server?: string;
    topic?: string;
    subscriberToken?: string;
    username?: string;
    setupUrl?: string;
  };

  it('GET returns the not-provisioned state by default', async () => {
    const res = await mockFetch('/api/notifications');
    expect(res.status).toBe(200);
    const body = await json<{ success: boolean; data: Status }>(res);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ provisioned: false, enabled: false });
    expect(body.data.subscriberToken).toBeUndefined();
    expect(body.data.username).toBeUndefined();
    expect(body.data.setupUrl).toBeUndefined();
  });

  it('POST enable provisions, and a subsequent GET reflects the provisioned+enabled state', async () => {
    const enableRes = await mockFetch('/api/notifications/enable', { method: 'POST' });
    expect(enableRes.status).toBe(200);
    const enableBody = await json<{ success: boolean; data: Status }>(enableRes);
    expect(enableBody.success).toBe(true);
    expect(enableBody.data.provisioned).toBe(true);
    expect(enableBody.data.enabled).toBe(true);
    expect(enableBody.data.server).toBeTruthy();
    expect(enableBody.data.topic).toBeTruthy();
    expect(enableBody.data.subscriberToken).toBeTruthy();
    expect(enableBody.data.username).toMatch(/^u_/);
    expect(enableBody.data.setupUrl).toBe(
      `https://notifs-setup.4irl.app/?app=chores4irl&user=${enableBody.data.username}&name=Chores4irl`,
    );

    const getBody = await json<{ data: Status }>(await mockFetch('/api/notifications'));
    expect(getBody.data.provisioned).toBe(true);
    expect(getBody.data.enabled).toBe(true);
    expect(getBody.data.topic).toBe(enableBody.data.topic);
    expect(getBody.data.username).toBe(enableBody.data.username);
    expect(getBody.data.setupUrl).toBe(enableBody.data.setupUrl);
  });

  it('POST test returns 409 before enabling and 200 once enabled', async () => {
    const before = await mockFetch('/api/notifications/test', { method: 'POST' });
    expect(before.status).toBe(409);

    await mockFetch('/api/notifications/enable', { method: 'POST' });

    const after = await mockFetch('/api/notifications/test', { method: 'POST' });
    expect(after.status).toBe(200);
    const body = await json<{ success: boolean; data: null }>(after);
    expect(body.success).toBe(true);
    expect(body.data).toBeNull();
  });

  it('POST disable soft-offs (enabled=false) while keeping the same token for re-enable', async () => {
    const enableBody = await json<{ data: Status }>(
      await mockFetch('/api/notifications/enable', { method: 'POST' }),
    );
    const originalToken = enableBody.data.subscriberToken;

    const disableRes = await mockFetch('/api/notifications/disable', { method: 'POST' });
    expect(disableRes.status).toBe(200);
    const disableBody = await json<{ data: Status }>(disableRes);
    expect(disableBody.data).toEqual({ provisioned: true, enabled: false });

    const getBody = await json<{ data: Status }>(await mockFetch('/api/notifications'));
    expect(getBody.data.enabled).toBe(false);
    expect(getBody.data.provisioned).toBe(true);
    // Re-enable preserves the originally provisioned token (no re-provision).
    const reEnable = await json<{ data: Status }>(
      await mockFetch('/api/notifications/enable', { method: 'POST' }),
    );
    expect(reEnable.data.subscriberToken).toBe(originalToken);
  });

  it('POST disable returns 409 when notifications were never enabled', async () => {
    const res = await mockFetch('/api/notifications/disable', { method: 'POST' });
    expect(res.status).toBe(409);
  });
});

describe('mockFetch: /api/chores', () => {
  it('GET returns a non-empty seeded list wrapped in ApiResponse', async () => {
    const res = await mockFetch('/api/chores');
    const body = await json<{ success: boolean; data: ChoreWire[] }>(res);
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('POST creates a chore and it appears in a subsequent GET', async () => {
    const createRes = await mockFetch('/api/chores', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Mop Floors',
        roomId: 2,
        dateLastCompleted: '2026-07-01T00:00:00.000Z',
        duration: 15,
        frequency: 3,
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await json<{ data: ChoreWire }>(createRes);
    expect(created.data.name).toBe('Mop Floors');
    expect(created.data.id).toBeTypeOf('number');
    expect(created.data.version).toBe(1);

    const listRes = await mockFetch('/api/chores');
    const list = await json<{ data: ChoreWire[] }>(listRes);
    expect(list.data.map((c) => c.name)).toContain('Mop Floors');
  });

  it('PUT edits an existing chore and increments its version', async () => {
    const before = await json<{ data: ChoreWire[] }>(await mockFetch('/api/chores'));
    const target = before.data[0];

    const res = await mockFetch(`/api/chores/${target.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: 'Renamed Chore',
        roomId: target.roomId,
        dateLastCompleted: target.dateLastCompleted,
        duration: target.duration,
        frequency: target.frequency,
        version: target.version,
      }),
    });
    expect(res.status).toBe(200);
    const updated = await json<{ data: ChoreWire }>(res);
    expect(updated.data.name).toBe('Renamed Chore');
    expect(updated.data.version).toBe(target.version + 1);
  });

  it('PATCH .../complete updates dateLastCompleted', async () => {
    const before = await json<{ data: ChoreWire[] }>(await mockFetch('/api/chores'));
    const target = before.data[0];
    const newDate = '2026-07-07T00:00:00.000Z';

    const res = await mockFetch(`/api/chores/${target.id}/complete`, {
      method: 'PATCH',
      body: JSON.stringify({ dateLastCompleted: newDate }),
    });
    expect(res.status).toBe(200);
    const updated = await json<{ data: ChoreWire }>(res);
    expect(updated.data.dateLastCompleted).toBe(newDate);
  });

  it('DELETE removes a chore so it no longer appears in a subsequent GET', async () => {
    const before = await json<{ data: ChoreWire[] }>(await mockFetch('/api/chores'));
    const target = before.data[0];

    const res = await mockFetch(`/api/chores/${target.id}`, { method: 'DELETE' });
    expect(res.status).toBe(200);

    const after = await json<{ data: ChoreWire[] }>(await mockFetch('/api/chores'));
    expect(after.data.map((c) => c.id)).not.toContain(target.id);
  });

  it('returns 404 for a PUT/DELETE against a chore id that does not exist', async () => {
    const res = await mockFetch('/api/chores/999999', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});

describe('mockFetch: /api/members', () => {
  it('GET returns a non-empty seeded list', async () => {
    const res = await mockFetch('/api/members');
    const body = await json<{ success: boolean; data: unknown[] }>(res);
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('POST creates a member and it appears in a subsequent GET', async () => {
    const createRes = await mockFetch('/api/members', {
      method: 'POST',
      body: JSON.stringify({ email: 'preview@example.com' }),
    });
    expect(createRes.status).toBe(201);

    const listRes = await mockFetch('/api/members');
    const list = await json<{ data: { email: string }[] }>(listRes);
    expect(list.data.map((m) => m.email)).toContain('preview@example.com');
  });

  it('DELETE removes a member', async () => {
    const before = await json<{ data: { id: number }[] }>(await mockFetch('/api/members'));
    const target = before.data[0];

    await mockFetch(`/api/members/${target.id}`, { method: 'DELETE' });

    const after = await json<{ data: { id: number }[] }>(await mockFetch('/api/members'));
    expect(after.data.map((m) => m.id)).not.toContain(target.id);
  });
});

describe('mockFetch: /api/admin/users', () => {
  it('returns every seeded member reshaped with a households array', async () => {
    const res = await mockFetch('/api/admin/users');
    expect(res.status).toBe(200);
    const body = await json<{
      data: { email: string; isAdmin: boolean; households: { id: number; name: string }[] }[];
    }>(res);

    expect(body.data.length).toBeGreaterThan(0);
    const admin = body.data.find((u) => u.email === 'preview@example.com');
    expect(admin?.isAdmin).toBe(true);
    expect(admin?.households).toEqual([{ id: 1, name: 'Preview Household' }]);
  });
});

describe('mockFetch: POST /api/admin/households', () => {
  it('creates a household, defaulting timezone to UTC, and it appears in a subsequent GET', async () => {
    const res = await mockFetch('/api/admin/households', {
      method: 'POST',
      body: JSON.stringify({ name: 'Preview Household C' }),
    });
    expect(res.status).toBe(201);
    const body = await json<{ data: { id: number; name: string; timezone: string } }>(res);
    expect(body.data).toMatchObject({ name: 'Preview Household C', timezone: 'UTC' });

    const listRes = await json<{ data: { name: string }[] }>(await mockFetch('/api/admin/households'));
    expect(listRes.data.map((h) => h.name)).toContain('Preview Household C');
  });

  it('honors a caller-supplied timezone', async () => {
    const res = await mockFetch('/api/admin/households', {
      method: 'POST',
      body: JSON.stringify({ name: 'Preview Household C', timezone: 'America/Chicago' }),
    });
    const body = await json<{ data: { timezone: string } }>(res);
    expect(body.data.timezone).toBe('America/Chicago');
  });

  it('returns 400 when name is missing', async () => {
    const res = await mockFetch('/api/admin/households', { method: 'POST', body: JSON.stringify({}) });
    expect(res.status).toBe(400);
  });

  it('returns 409 for a duplicate name', async () => {
    const res = await mockFetch('/api/admin/households', {
      method: 'POST',
      body: JSON.stringify({ name: 'Preview Household' }),
    });
    expect(res.status).toBe(409);
  });
});

describe('mockFetch: DELETE /api/admin/users/:id', () => {
  it('removes the user so they no longer appear in /api/members or /api/admin/users', async () => {
    const before = await json<{ data: { id: number; email: string }[] }>(await mockFetch('/api/members'));
    const target = before.data.find((m) => m.email !== 'preview@example.com')!;

    const res = await mockFetch(`/api/admin/users/${target.id}`, { method: 'DELETE' });
    expect(res.status).toBe(200);

    const members = await json<{ data: { id: number }[] }>(await mockFetch('/api/members'));
    expect(members.data.map((m) => m.id)).not.toContain(target.id);
    const users = await json<{ data: { id: number }[] }>(await mockFetch('/api/admin/users'));
    expect(users.data.map((u) => u.id)).not.toContain(target.id);
  });

  it('returns 400 when targeting the current admin own account', async () => {
    const me = await json<{ id: number }>(await mockFetch('/api/me'));

    const res = await mockFetch(`/api/admin/users/${me.id}`, { method: 'DELETE' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await mockFetch('/api/admin/users/999999', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});

describe('mockFetch: POST /api/admin/users/:id/promote', () => {
  it('grants admin and reflects it in a subsequent GET /api/admin/users', async () => {
    const before = await json<{ data: { id: number; email: string; isAdmin: boolean }[] }>(
      await mockFetch('/api/members'),
    );
    const target = before.data.find((m) => !m.isAdmin)!;

    const res = await mockFetch(`/api/admin/users/${target.id}/promote`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { id: number; isAdmin: boolean } }>(res);
    expect(body.data).toMatchObject({ id: target.id, isAdmin: true });

    const users = await json<{ data: { id: number; isAdmin: boolean }[] }>(
      await mockFetch('/api/admin/users'),
    );
    expect(users.data.find((u) => u.id === target.id)?.isAdmin).toBe(true);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await mockFetch('/api/admin/users/999999/promote', { method: 'POST' });
    expect(res.status).toBe(404);
  });
});

describe('mockFetch: /api/rooms', () => {
  it('GET returns a non-empty seeded list', async () => {
    const res = await mockFetch('/api/rooms');
    const body = await json<{ success: boolean; data: { id: number; name: string }[] }>(res);
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('POST creates a room and it appears in a subsequent GET', async () => {
    const createRes = await mockFetch('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({ name: 'Garage' }),
    });
    expect(createRes.status).toBe(201);

    const listRes = await mockFetch('/api/rooms');
    const list = await json<{ data: { name: string }[] }>(listRes);
    expect(list.data.map((r) => r.name)).toContain('Garage');
  });

  it('POST returns 409 for a duplicate name', async () => {
    const res = await mockFetch('/api/rooms', { method: 'POST', body: JSON.stringify({ name: 'Kitchen' }) });
    expect(res.status).toBe(409);
  });

  it('DELETE returns 409 when the room still has chores', async () => {
    const before = await json<{ data: { id: number; roomId: number }[] }>(await mockFetch('/api/chores'));
    const inUseRoomId = before.data[0].roomId;

    const res = await mockFetch(`/api/rooms/${inUseRoomId}`, { method: 'DELETE' });
    expect(res.status).toBe(409);
  });

  it('DELETE removes an empty room', async () => {
    const createRes = await mockFetch('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({ name: 'Garage' }),
    });
    const created = await json<{ data: { id: number } }>(createRes);

    const res = await mockFetch(`/api/rooms/${created.data.id}`, { method: 'DELETE' });
    expect(res.status).toBe(200);

    const after = await json<{ data: { id: number }[] }>(await mockFetch('/api/rooms'));
    expect(after.data.map((r) => r.id)).not.toContain(created.data.id);
  });
});

describe('resetMockData', () => {
  it('restores the original seed data, discarding any mutations', async () => {
    await mockFetch('/api/chores', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Temporary',
        roomId: 2,
        dateLastCompleted: '2026-07-01T00:00:00.000Z',
        duration: 1,
        frequency: 1,
      }),
    });
    const beforeReset = await json<{ data: ChoreWire[] }>(await mockFetch('/api/chores'));
    expect(beforeReset.data.map((c) => c.name)).toContain('Temporary');

    // Also mutate the notifications seed so the reset is proven to cover it.
    await mockFetch('/api/notifications/enable', { method: 'POST' });
    const enabled = await json<{ data: { enabled: boolean } }>(await mockFetch('/api/notifications'));
    expect(enabled.data.enabled).toBe(true);

    resetMockData();

    const afterReset = await json<{ data: ChoreWire[] }>(await mockFetch('/api/chores'));
    expect(afterReset.data.map((c) => c.name)).not.toContain('Temporary');
    const notifs = await json<{ data: { provisioned: boolean; enabled: boolean } }>(
      await mockFetch('/api/notifications'),
    );
    expect(notifs.data).toEqual({ provisioned: false, enabled: false });
  });
});
