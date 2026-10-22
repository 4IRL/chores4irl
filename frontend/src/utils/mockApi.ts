// Local, in-memory stand-in for the real backend, used only when the app is
// running on a Cloudflare Pages preview domain (see api.ts). Authenticating
// a preview against the real Access-protected production API turned out to
// be structurally impossible — Access's cross-app SSO redirect flow doesn't
// work for script-initiated fetch() calls, only real browser navigation, and
// that's true regardless of CORS configuration (verified live: even with a
// valid production session, the intermediate SSO redirect hop is
// CORS-blocked because it's Cloudflare's own infrastructure). Rather than a
// broken "half-authenticated" preview, previews get their own disposable,
// fully-interactive fake dataset — no network calls, no shared production
// data, resets on every reload.

type ChoreWire = {
  id: number;
  name: string;
  details?: string | null;
  roomId: number;
  dateLastCompleted: string;
  duration: number;
  frequency: number;
  version: number;
};

type MockMember = {
  id: number;
  householdId: number;
  email: string;
  isAdmin: boolean;
  timezone: string | null;
};

type MockRoom = {
  id: number;
  householdId: number;
  name: string;
};

type MockHousehold = {
  id: number;
  name: string;
};

type MockJoinRequest = {
  id: number;
  householdId: number;
  householdName: string;
  requestedEmail: string;
  requestedByEmail: string;
  status: 'pending' | 'approved' | 'denied';
  createdAt: string;
};

// Mirrors the real backend's per-user notification state (see
// backend/src/routes/notifications.ts). `provisioned` flips true on first
// enable; `enabled` is the soft-off flag. server/topic/subscriberToken are the
// fixed fake credentials a provisioned row would carry, used to render the QR;
// username/setupUrl mirror the server-built push-app username and setup link.
type MockNotifications = {
  provisioned: boolean;
  enabled: boolean;
  server: string;
  topic: string;
  subscriberToken: string;
  username: string;
  setupUrl: string;
};

function seedMe() {
  return {
    id: 1,
    email: 'preview@example.com',
    timezone: 'America/Chicago',
    isAdmin: true,
    swipeStyle: 'ios' as 'ios' | 'android',
    memberships: [
      {
        householdId: 1,
        householdName: 'Preview Household',
        householdTimezone: 'America/Chicago',
      },
    ],
    currentHouseholdId: 1,
  };
}

function daysAgoIso(now: number, days: number): string {
  return new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
}

function seedRooms(): MockRoom[] {
  return [
    { id: 1, householdId: 1, name: 'Living Room' },
    { id: 2, householdId: 1, name: 'Kitchen' },
    { id: 3, householdId: 1, name: 'Bathroom' },
  ];
}

function seedChores(): ChoreWire[] {
  const now = Date.now();
  return [
    {
      id: 1,
      name: 'Vacuum',
      roomId: 1,
      dateLastCompleted: daysAgoIso(now, 3),
      duration: 20,
      frequency: 7,
      version: 1,
    },
    {
      id: 2,
      name: 'Dishes',
      roomId: 2,
      dateLastCompleted: daysAgoIso(now, 0),
      duration: 5,
      frequency: 1,
      version: 1,
    },
    {
      id: 3,
      name: "Clip Maple's Nails",
      roomId: 3,
      dateLastCompleted: daysAgoIso(now, 20),
      duration: 10,
      frequency: 18,
      version: 1,
    },
  ];
}

function seedMembers(): MockMember[] {
  return [
    { id: 1, householdId: 1, email: 'preview@example.com', isAdmin: true, timezone: 'America/Chicago' },
    { id: 2, householdId: 1, email: 'roommate@example.com', isAdmin: false, timezone: null },
  ];
}

function seedHouseholds(): MockHousehold[] {
  return [
    { id: 1, name: 'Preview Household' },
    { id: 2, name: 'Preview Household B' },
  ];
}

function seedNotifications(): MockNotifications {
  return {
    provisioned: false,
    enabled: false,
    server: 'https://notifs.4irl.app',
    topic: 'chores4irl-previewhash4e5tei-all',
    subscriberToken: 'tk_preview_9f2a7c1e4b6d8035',
    username: 'u_previewhash4e5tei',
    setupUrl: 'https://notifs-setup.4irl.app/?app=chores4irl&user=u_previewhash4e5tei&name=Chores4irl',
  };
}

function seedJoinRequests(): MockJoinRequest[] {
  return [
    {
      id: 1,
      householdId: 1,
      householdName: 'Preview Household',
      requestedEmail: 'newcomer@example.com',
      requestedByEmail: 'roommate@example.com',
      status: 'pending',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

let chores: ChoreWire[] = seedChores();
let members: MockMember[] = seedMembers();
let rooms: MockRoom[] = seedRooms();
let households: MockHousehold[] = seedHouseholds();
let joinRequests: MockJoinRequest[] = seedJoinRequests();
let notifications: MockNotifications = seedNotifications();
let me = seedMe();
let nextChoreId = 4;
let nextMemberId = 3;
let nextRoomId = 4;
let nextJoinRequestId = 2;
let nextHouseholdId = 3;

export function resetMockData(): void {
  chores = seedChores();
  members = seedMembers();
  rooms = seedRooms();
  households = seedHouseholds();
  joinRequests = seedJoinRequests();
  notifications = seedNotifications();
  me = seedMe();
  nextChoreId = 4;
  nextMemberId = 3;
  nextRoomId = 4;
  nextJoinRequestId = 2;
  nextHouseholdId = 3;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function parseBody(init?: RequestInit): Record<string, unknown> {
  if (!init?.body) return {};
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

const CHORE_ID_RE = /^\/api\/chores\/(\d+)$/;
const CHORE_COMPLETE_RE = /^\/api\/chores\/(\d+)\/complete$/;
const MEMBER_ID_RE = /^\/api\/members\/(\d+)$/;
const ROOM_ID_RE = /^\/api\/rooms\/(\d+)$/;
const HOUSEHOLD_ID_RE = /^\/api\/households\/(\d+)$/;
const JOIN_REQUEST_APPROVE_RE = /^\/api\/admin\/join-requests\/(\d+)\/approve$/;
const JOIN_REQUEST_DENY_RE = /^\/api\/admin\/join-requests\/(\d+)\/deny$/;
const ADMIN_USER_ID_RE = /^\/api\/admin\/users\/(\d+)$/;
const ADMIN_USER_PROMOTE_RE = /^\/api\/admin\/users\/(\d+)\/promote$/;

export async function mockFetch(path: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();

  if (path === '/api/me' && method === 'GET') {
    return jsonResponse(me);
  }
  if (path === '/api/me/swipe-style' && method === 'PATCH') {
    const body = parseBody(init);
    const swipeStyle = body.swipeStyle;
    if (swipeStyle !== 'ios' && swipeStyle !== 'android') {
      return jsonResponse({ success: false, error: 'Invalid swipe style' }, 400);
    }
    me = { ...me, swipeStyle };
    return jsonResponse({ success: true, data: { swipeStyle } });
  }

  // Notifications — mirrors backend/src/routes/notifications.ts. GET returns the
  // full NotificationStatus wire shape; enable/disable/test echo the same shapes
  // the real routes do so the frontend can setStatus(body.data) straight off the
  // action responses (no re-fetch).
  if (path === '/api/notifications' && method === 'GET') {
    const data = notifications.provisioned
      ? {
          provisioned: true,
          enabled: notifications.enabled,
          server: notifications.server,
          topic: notifications.topic,
          subscriberToken: notifications.subscriberToken,
          username: notifications.username,
          setupUrl: notifications.setupUrl,
        }
      : { provisioned: false, enabled: false };
    return jsonResponse({ success: true, data });
  }
  if (path === '/api/notifications/enable' && method === 'POST') {
    // First enable provisions; a re-enable after soft-off preserves the existing
    // token/topic — either way the row ends up provisioned + enabled.
    notifications = { ...notifications, provisioned: true, enabled: true };
    return jsonResponse({
      success: true,
      data: {
        provisioned: true,
        enabled: true,
        server: notifications.server,
        topic: notifications.topic,
        subscriberToken: notifications.subscriberToken,
        username: notifications.username,
        setupUrl: notifications.setupUrl,
      },
    });
  }
  if (path === '/api/notifications/test' && method === 'POST') {
    if (!notifications.provisioned || !notifications.enabled) {
      return jsonResponse({ success: false, error: 'Notifications are not enabled' }, 409);
    }
    return jsonResponse({ success: true, data: null });
  }
  if (path === '/api/notifications/disable' && method === 'POST') {
    if (!notifications.provisioned) {
      return jsonResponse({ success: false, error: 'Notifications are not enabled' }, 409);
    }
    notifications = { ...notifications, enabled: false };
    return jsonResponse({ success: true, data: { provisioned: true, enabled: false } });
  }

  if (path === '/api/chores' && method === 'GET') {
    return jsonResponse({ success: true, data: chores });
  }
  if (path === '/api/chores' && method === 'POST') {
    const body = parseBody(init);
    const chore = { ...body, id: nextChoreId++, version: 1 } as ChoreWire;
    chores = [...chores, chore];
    return jsonResponse({ success: true, data: chore }, 201);
  }

  const completeMatch = path.match(CHORE_COMPLETE_RE);
  if (completeMatch && method === 'PATCH') {
    const id = Number(completeMatch[1]);
    const body = parseBody(init);
    const existing = chores.find((c) => c.id === id);
    if (!existing) return jsonResponse({ success: false, error: 'not found' }, 404);
    const updated = {
      ...existing,
      dateLastCompleted: body.dateLastCompleted as string,
      version: existing.version + 1,
    };
    chores = chores.map((c) => (c.id === id ? updated : c));
    return jsonResponse({ success: true, data: updated });
  }

  const choreIdMatch = path.match(CHORE_ID_RE);
  if (choreIdMatch && method === 'PUT') {
    const id = Number(choreIdMatch[1]);
    const existing = chores.find((c) => c.id === id);
    if (!existing) return jsonResponse({ success: false, error: 'not found' }, 404);
    const body = parseBody(init);
    const updated = { ...existing, ...body, id, version: existing.version + 1 } as ChoreWire;
    chores = chores.map((c) => (c.id === id ? updated : c));
    return jsonResponse({ success: true, data: updated });
  }
  if (choreIdMatch && method === 'DELETE') {
    const id = Number(choreIdMatch[1]);
    if (!chores.some((c) => c.id === id)) return jsonResponse({ success: false, error: 'not found' }, 404);
    chores = chores.filter((c) => c.id !== id);
    return jsonResponse({ success: true, data: null });
  }

  if (path === '/api/members' && method === 'GET') {
    return jsonResponse({ success: true, data: members });
  }

  if (path === '/api/admin/users' && method === 'GET') {
    const householdName =
      me.memberships.find((m) => m.householdId === 1)?.householdName ?? 'Preview Household';
    const data = members.map((member) => ({
      id: member.id,
      email: member.email,
      timezone: member.timezone,
      isAdmin: member.isAdmin,
      households: [{ id: member.householdId, name: householdName }],
    }));
    return jsonResponse({ success: true, data });
  }
  const adminUserIdMatch = path.match(ADMIN_USER_ID_RE);
  if (adminUserIdMatch && method === 'DELETE') {
    const id = Number(adminUserIdMatch[1]);
    if (id === me.id) {
      return jsonResponse({ success: false, error: 'You cannot delete your own account' }, 400);
    }
    if (!members.some((m) => m.id === id)) {
      return jsonResponse({ success: false, error: 'User not found' }, 404);
    }
    members = members.filter((m) => m.id !== id);
    return jsonResponse({ success: true, data: null });
  }
  const promoteMatch = path.match(ADMIN_USER_PROMOTE_RE);
  if (promoteMatch && method === 'POST') {
    const id = Number(promoteMatch[1]);
    const existing = members.find((m) => m.id === id);
    if (!existing) return jsonResponse({ success: false, error: 'User not found' }, 404);
    members = members.map((m) => (m.id === id ? { ...m, isAdmin: true } : m));
    const updated = members.find((m) => m.id === id)!;
    const householdName =
      me.memberships.find((m) => m.householdId === 1)?.householdName ?? 'Preview Household';
    const data = {
      id: updated.id,
      email: updated.email,
      timezone: updated.timezone,
      isAdmin: updated.isAdmin,
      households: [{ id: updated.householdId, name: householdName }],
    };
    return jsonResponse({ success: true, data });
  }
  if (path === '/api/members' && method === 'POST') {
    const body = parseBody(init);
    const member = {
      householdId: 1,
      timezone: null,
      isAdmin: false,
      ...body,
      id: nextMemberId++,
    } as MockMember;
    members = [...members, member];
    return jsonResponse({ success: true, data: member }, 201);
  }
  const memberIdMatch = path.match(MEMBER_ID_RE);
  if (memberIdMatch && method === 'DELETE') {
    const id = Number(memberIdMatch[1]);
    if (!members.some((m) => m.id === id)) return jsonResponse({ success: false, error: 'not found' }, 404);
    members = members.filter((m) => m.id !== id);
    return jsonResponse({ success: true, data: null });
  }

  if (path === '/api/members/requests' && method === 'POST') {
    const body = parseBody(init);
    const email = String(body.email ?? '');
    const request: MockJoinRequest = {
      id: nextJoinRequestId++,
      householdId: 1,
      householdName: households.find((h) => h.id === 1)?.name ?? 'Preview Household',
      requestedEmail: email,
      requestedByEmail: me.email,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    joinRequests = [...joinRequests, request];
    return jsonResponse({ success: true, data: request }, 201);
  }

  if (path === '/api/admin/households' && method === 'GET') {
    return jsonResponse({ success: true, data: households });
  }
  if (path === '/api/admin/households' && method === 'POST') {
    const body = parseBody(init);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return jsonResponse({ success: false, error: 'Missing required fields' }, 400);
    if (households.some((h) => h.name === name)) {
      return jsonResponse({ success: false, error: `A household named "${name}" already exists` }, 409);
    }
    const timezone = typeof body.timezone === 'string' && body.timezone ? body.timezone : 'UTC';
    const household: MockHousehold = { id: nextHouseholdId++, name };
    households = [...households, household];
    return jsonResponse({ success: true, data: { ...household, timezone } }, 201);
  }
  if (path === '/api/admin/members' && method === 'POST') {
    const body = parseBody(init);
    const householdId = Number(body.householdId);
    const member = {
      timezone: null,
      ...body,
      householdId,
      isAdmin: body.makeAdmin === true,
      id: nextMemberId++,
    } as MockMember;
    if (householdId === 1) members = [...members, member];
    return jsonResponse({ success: true, data: member }, 201);
  }

  if (path === '/api/admin/join-requests' && method === 'GET') {
    return jsonResponse({ success: true, data: joinRequests.filter((r) => r.status === 'pending') });
  }
  const approveMatch = path.match(JOIN_REQUEST_APPROVE_RE);
  if (approveMatch && method === 'POST') {
    const id = Number(approveMatch[1]);
    const request = joinRequests.find((r) => r.id === id);
    if (!request) return jsonResponse({ success: false, error: 'not found' }, 404);
    joinRequests = joinRequests.map((r) => (r.id === id ? { ...r, status: 'approved' } : r));
    const member: MockMember = {
      id: nextMemberId++,
      householdId: request.householdId,
      email: request.requestedEmail,
      isAdmin: false,
      timezone: null,
    };
    if (request.householdId === 1) members = [...members, member];
    return jsonResponse({ success: true, data: member });
  }
  const denyMatch = path.match(JOIN_REQUEST_DENY_RE);
  if (denyMatch && method === 'POST') {
    const id = Number(denyMatch[1]);
    if (!joinRequests.some((r) => r.id === id))
      return jsonResponse({ success: false, error: 'not found' }, 404);
    joinRequests = joinRequests.map((r) => (r.id === id ? { ...r, status: 'denied' } : r));
    return jsonResponse({ success: true, data: null });
  }

  if (path === '/api/rooms' && method === 'GET') {
    return jsonResponse({ success: true, data: rooms });
  }
  if (path === '/api/rooms' && method === 'POST') {
    const body = parseBody(init);
    const name = String(body.name ?? '');
    if (rooms.some((r) => r.name === name)) {
      return jsonResponse({ success: false, error: 'A room with this name already exists' }, 409);
    }
    const room: MockRoom = { id: nextRoomId++, householdId: 1, name };
    rooms = [...rooms, room];
    return jsonResponse({ success: true, data: room }, 201);
  }
  const roomIdMatch = path.match(ROOM_ID_RE);
  if (roomIdMatch && method === 'PUT') {
    const id = Number(roomIdMatch[1]);
    const existing = rooms.find((r) => r.id === id);
    if (!existing) return jsonResponse({ success: false, error: 'not found' }, 404);
    const body = parseBody(init);
    const name = String(body.name ?? existing.name);
    if (rooms.some((r) => r.id !== id && r.name === name)) {
      return jsonResponse({ success: false, error: 'A room with this name already exists' }, 409);
    }
    const updated = { ...existing, name };
    rooms = rooms.map((r) => (r.id === id ? updated : r));
    return jsonResponse({ success: true, data: updated });
  }
  if (roomIdMatch && method === 'DELETE') {
    const id = Number(roomIdMatch[1]);
    if (!rooms.some((r) => r.id === id)) return jsonResponse({ success: false, error: 'not found' }, 404);
    const choreCount = chores.filter((c) => c.roomId === id).length;
    if (choreCount > 0) {
      return jsonResponse(
        {
          success: false,
          error: `${choreCount} chore(s) are still in this room — reassign or delete them first`,
        },
        409,
      );
    }
    rooms = rooms.filter((r) => r.id !== id);
    return jsonResponse({ success: true, data: null });
  }

  const householdIdMatch = path.match(HOUSEHOLD_ID_RE);
  if (householdIdMatch && method === 'PATCH') {
    const householdId = Number(householdIdMatch[1]);
    const body = parseBody(init);
    const current = me.memberships.find((m) => m.householdId === householdId);
    const timezone = String(body.timezone ?? current?.householdTimezone ?? 'UTC');
    me = {
      ...me,
      memberships: me.memberships.map((m) =>
        m.householdId === householdId ? { ...m, householdTimezone: timezone } : m,
      ),
    };
    return jsonResponse({ success: true, data: { id: householdId, name: 'Preview Household', timezone } });
  }

  return jsonResponse({ success: false, error: `mock not implemented for ${method} ${path}` }, 501);
}
