import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import app from '../../src/app.js';
import { getProvisioning, saveProvisioning, setEnabled } from '../../src/notifications.js';
import { signTestJwt } from '../helpers/sign-test-jwt.js';
import { stubAccessJwks, testEnv, TEST_ACCESS_AUD, TEST_JWKS_URL } from '../helpers/access-test-env.js';
import primaryJwks from '../fixtures/test-jwks.json' with { type: 'json' };

// Explicit override env (bare testEnv() carries only the Access vars, not the
// notifs/ntfy secrets — analogous to members.test.ts's ACCESS_ALLOWLIST_ENV).
// Fetch-mock URL/header matchers are keyed off these same fixture constants.
const NOTIFS_TEST_ENV = {
  NOTIFS_API_BASE_URL: 'https://notifs-api.test.fixture',
  NOTIFS_CF_ACCESS_CLIENT_ID: 'test-client-id',
  NOTIFS_CF_ACCESS_CLIENT_SECRET: 'test-client-secret',
  NTFY_BASE_URL: 'https://notifs.test.fixture',
  NTFY_PUBLISHER_TOKEN: 'tk_publisher-fixture',
};

const PROVISION_URL = `${NOTIFS_TEST_ENV.NOTIFS_API_BASE_URL}/v1/provision`;
const DEPROVISION_URL = `${NOTIFS_TEST_ENV.NOTIFS_API_BASE_URL}/v1/deprovision`;

const USER_ID = 1;
const EMAIL = 'user@example.com';

// The values the provisioning stub hands back on a first-time enable. The hash
// mirrors a real 4irl-notifs person_hash: base32, lowercase-alphanumeric (see
// provisionUser's charset guard) — never a hyphen or path separator.
const PROVISION_HASH = 'provis10nedhash7';
const PROVISION_TOKEN = 'tk_provisioned';
// Distinct values used when a row is pre-seeded — so a re-provision (which would
// overwrite them) is detectable by the response carrying the wrong hash/token.
const SEED_HASH = 'seededhash234567';
const SEED_TOKEN = 'tk_seeded';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function provisionResponseBody(overrides: Record<string, unknown> = {}) {
  return {
    user_id: 'notifs-user-1',
    app_id: 'chores4irl',
    person_hash: PROVISION_HASH,
    topic_pattern: `chores4irl-${PROVISION_HASH}-*`,
    broadcast_topic: 'chores4irl-broadcast',
    token: PROVISION_TOKEN,
    ...overrides,
  };
}

// One combined fetch stub serving the JWKS fixture (so accessAuth passes) plus
// the 4irl-notifs provisioning and ntfy publish endpoints. Options tune the
// outbound statuses/bodies per test; returns the mock so calls can be asserted.
function stubFetch(opts: { provisionStatus?: number; provisionBody?: unknown; ntfyStatus?: number } = {}) {
  const { provisionStatus = 200, provisionBody = provisionResponseBody(), ntfyStatus = 200 } = opts;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url === TEST_JWKS_URL) return jsonResponse(primaryJwks);
    if (url === PROVISION_URL) return jsonResponse(provisionBody, provisionStatus);
    if (url.startsWith(`${NOTIFS_TEST_ENV.NTFY_BASE_URL}/chores4irl-`)) {
      return new Response('{}', { status: ntfyStatus, headers: { 'content-type': 'application/json' } });
    }
    return new Response('not found', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function callsTo(fetchMock: ReturnType<typeof stubFetch>, matcher: (url: string) => boolean) {
  return fetchMock.mock.calls.filter(([input]) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    return matcher(url);
  });
}

async function authHeader(email: string) {
  const token = await signTestJwt({ email, aud: TEST_ACCESS_AUD });
  return { 'Cf-Access-Jwt-Assertion': token };
}

function requestEnv() {
  return { ...testEnv(), ...NOTIFS_TEST_ENV };
}

beforeEach(async () => {
  stubAccessJwks();
  await env.DB.exec('DELETE FROM user_notifications');
  await env.DB.exec('DELETE FROM household_members');
  await env.DB.exec('DELETE FROM users');
  await env.DB.prepare('INSERT INTO users (id, email, is_admin) VALUES (?, ?, 0)').bind(USER_ID, EMAIL).run();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GET /api/notifications', () => {
  it('returns provisioned:false, enabled:false for a user with no row', async () => {
    const res = await app.request('/api/notifications', { headers: await authHeader(EMAIL) }, requestEnv());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown };
    expect(body).toEqual({ success: true, data: { provisioned: false, enabled: false } });
  });

  it('returns the full status (full-origin server per DD-B) for a provisioned, enabled user', async () => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });

    const res = await app.request('/api/notifications', { headers: await authHeader(EMAIL) }, requestEnv());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> };
    expect(body).toEqual({
      success: true,
      data: {
        provisioned: true,
        enabled: true,
        // Full origin (scheme + host), not host-only — new URL(NTFY_BASE_URL).origin.
        server: 'https://notifs.test.fixture',
        topic: `chores4irl-${SEED_HASH}-all`,
        subscriberToken: SEED_TOKEN,
      },
    });
  });

  it('reflects a soft-off row as enabled:false while retaining the token/topic', async () => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    await setEnabled(env.DB, USER_ID, false);

    const res = await app.request('/api/notifications', { headers: await authHeader(EMAIL) }, requestEnv());
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data.provisioned).toBe(true);
    expect(body.data.enabled).toBe(false);
    expect(body.data.subscriberToken).toBe(SEED_TOKEN);
  });
});

describe('GET /api/notifications — auth chain (real mounted accessAuth + resolveUser)', () => {
  it('returns 401 when no Cf-Access-Jwt-Assertion header is present (accessAuth rejects)', async () => {
    const res = await app.request('/api/notifications', {}, requestEnv());
    expect(res.status).toBe(401);
    const body = (await res.json()) as { success: boolean; error?: string };
    expect(body.success).toBe(false);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 for an Access-verified email with no matching users row (resolveUser rejects)', async () => {
    // Positive control: the same signing/JWKS path verifies for the SEEDED email
    // and passes accessAuth (200). This pins the ghost 401 below to resolveUser's
    // "no users row" branch — accessAuth and resolveUser both emit an identical
    // { success:false, error:'Unauthorized' } 401 body, so without this control a
    // JWT-path regression could green the ghost case for the wrong reason.
    const control = await app.request(
      '/api/notifications',
      { headers: await authHeader(EMAIL) },
      requestEnv(),
    );
    expect(control.status).toBe(200);

    // Valid JWT (so accessAuth passes) but an email not seeded into users — the
    // beforeEach only inserts EMAIL/USER_ID, so resolveUser fails to resolve it.
    const res = await app.request(
      '/api/notifications',
      { headers: await authHeader('ghost@example.com') },
      requestEnv(),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { success: boolean; error?: string };
    expect(body.success).toBe(false);
    expect(body.error).toBe('Unauthorized');
  });
});

describe('POST /api/notifications/enable', () => {
  it('provisions on first enable, writes the row, and returns the full status', async () => {
    const fetchMock = stubFetch();

    const res = await app.request(
      '/api/notifications/enable',
      { method: 'POST', headers: await authHeader(EMAIL) },
      requestEnv(),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> };
    expect(body).toEqual({
      success: true,
      data: {
        provisioned: true,
        enabled: true,
        server: 'https://notifs.test.fixture',
        topic: `chores4irl-${PROVISION_HASH}-all`,
        subscriberToken: PROVISION_TOKEN,
      },
    });

    // Provisioning actually ran against the real outbound URL.
    expect(callsTo(fetchMock, (url) => url === PROVISION_URL)).toHaveLength(1);

    // A row now exists carrying the provisioned credentials, enabled.
    const row = await getProvisioning(env.DB, USER_ID);
    expect(row).toEqual({ personHash: PROVISION_HASH, subscriberToken: PROVISION_TOKEN, enabled: true });
  });

  it('returns 502 and writes no row when provisioning fails', async () => {
    const fetchMock = stubFetch({ provisionStatus: 500 });

    const res = await app.request(
      '/api/notifications/enable',
      { method: 'POST', headers: await authHeader(EMAIL) },
      requestEnv(),
    );
    expect(res.status).toBe(502);
    const body = (await res.json()) as { success: boolean; error?: string };
    expect(body.success).toBe(false);
    expect(body.error).toBeTruthy();

    expect(callsTo(fetchMock, (url) => url === PROVISION_URL)).toHaveLength(1);
    expect(await getProvisioning(env.DB, USER_ID)).toBeNull();
  });

  it('re-enables a soft-off row without re-provisioning (DD-19)', async () => {
    // Seed a distinct hash/token, then soft-off — a re-provision would overwrite
    // these with the PROVISION_* values, so their survival proves no re-provision.
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    await setEnabled(env.DB, USER_ID, false);

    const fetchMock = stubFetch();

    const res = await app.request(
      '/api/notifications/enable',
      { method: 'POST', headers: await authHeader(EMAIL) },
      requestEnv(),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, unknown> };

    // No second provisioning call happened.
    expect(callsTo(fetchMock, (url) => url === PROVISION_URL)).toHaveLength(0);

    // Row flipped back on, token/hash preserved (not re-provisioned).
    const row = await getProvisioning(env.DB, USER_ID);
    expect(row).toEqual({ personHash: SEED_HASH, subscriberToken: SEED_TOKEN, enabled: true });

    // Response carries the original token/topic, not the provisioning stub's.
    expect(body.data.subscriberToken).toBe(SEED_TOKEN);
    expect(body.data.topic).toBe(`chores4irl-${SEED_HASH}-all`);
  });
});

describe('POST /api/notifications/test', () => {
  it('publishes to ntfy with Bearer auth and returns success when enabled', async () => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    const fetchMock = stubFetch();

    const res = await app.request(
      '/api/notifications/test',
      { method: 'POST', headers: await authHeader(EMAIL) },
      requestEnv(),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);

    const ntfyCalls = callsTo(
      fetchMock,
      (url) => url === `${NOTIFS_TEST_ENV.NTFY_BASE_URL}/chores4irl-${SEED_HASH}-all`,
    );
    expect(ntfyCalls).toHaveLength(1);
    const headers = ntfyCalls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${NOTIFS_TEST_ENV.NTFY_PUBLISHER_TOKEN}`);
  });

  it('returns 502 when the ntfy publish fails', async () => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    stubFetch({ ntfyStatus: 500 });

    const res = await app.request(
      '/api/notifications/test',
      { method: 'POST', headers: await authHeader(EMAIL) },
      requestEnv(),
    );
    expect(res.status).toBe(502);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(false);
  });

  it('returns 409 when the user has never provisioned', async () => {
    const res = await app.request(
      '/api/notifications/test',
      { method: 'POST', headers: await authHeader(EMAIL) },
      requestEnv(),
    );
    expect(res.status).toBe(409);
  });

  it('returns 409 when notifications are soft-off (not enabled)', async () => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    await setEnabled(env.DB, USER_ID, false);

    const res = await app.request(
      '/api/notifications/test',
      { method: 'POST', headers: await authHeader(EMAIL) },
      requestEnv(),
    );
    expect(res.status).toBe(409);
  });
});

describe('POST /api/notifications/disable', () => {
  it('soft-offs the row and returns the full NotificationStatus (DD-C), no deprovision call', async () => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    const fetchMock = stubFetch();

    const res = await app.request(
      '/api/notifications/disable',
      { method: 'POST', headers: await authHeader(EMAIL) },
      requestEnv(),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> };
    expect(body).toEqual({ success: true, data: { provisioned: true, enabled: false } });

    // Row is soft-off, not deleted.
    const row = await getProvisioning(env.DB, USER_ID);
    expect(row?.enabled).toBe(false);
    expect(row?.subscriberToken).toBe(SEED_TOKEN);

    // Soft-off — never calls a deprovision endpoint.
    expect(callsTo(fetchMock, (url) => url === DEPROVISION_URL)).toHaveLength(0);
  });

  it('returns 409 for a user who never enabled notifications', async () => {
    const res = await app.request(
      '/api/notifications/disable',
      { method: 'POST', headers: await authHeader(EMAIL) },
      requestEnv(),
    );
    expect(res.status).toBe(409);
  });
});
