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
  NOTIFS_SETUP_BASE_URL: 'https://notifs-setup.test.fixture/',
  NTFY_BASE_URL: 'https://notifs.test.fixture',
  NTFY_PUBLISHER_TOKEN: 'tk_publisher-fixture',
};

// The shared setup-page link the server builds for a provisioned person: base
// URL from NOTIFS_SETUP_BASE_URL, then app / user / name query params.
function setupUrlFor(personHash: string): string {
  return `${NOTIFS_TEST_ENV.NOTIFS_SETUP_BASE_URL}?app=chores4irl&user=u_${personHash}&name=Chores4irl`;
}

const PROVISION_URL = `${NOTIFS_TEST_ENV.NOTIFS_API_BASE_URL}/v1/provision`;
const DEPROVISION_URL = `${NOTIFS_TEST_ENV.NOTIFS_API_BASE_URL}/v1/deprovision`;
const RESET_PASSWORD_URL = `${NOTIFS_TEST_ENV.NOTIFS_API_BASE_URL}/v1/reset-password`;

// Generated ntfy passwords the upstream stubs hand back (provision / reset).
const PROVISION_PASSWORD = 'abcd-efgh-jkmn-pqrs';
const RESET_PASSWORD = 'wxyz-2345-6789-abcd';

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
function stubFetch(
  opts: {
    provisionStatus?: number;
    provisionBody?: unknown;
    ntfyStatus?: number;
    resetStatus?: number;
    resetBody?: unknown;
    resetThrows?: boolean;
  } = {},
) {
  const {
    provisionStatus = 200,
    provisionBody = provisionResponseBody(),
    ntfyStatus = 200,
    resetStatus = 200,
    resetBody = { user_id: 'notifs-user-1', app_id: 'chores4irl', password: RESET_PASSWORD },
    resetThrows = false,
  } = opts;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url === TEST_JWKS_URL) return jsonResponse(primaryJwks);
    if (url === PROVISION_URL) return jsonResponse(provisionBody, provisionStatus);
    if (url === RESET_PASSWORD_URL) {
      if (resetThrows) throw new Error('network unreachable');
      return jsonResponse(resetBody, resetStatus);
    }
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
  // Restore console spies even when an assertion threw before an inline restore.
  vi.restoreAllMocks();
});

// Spies on every console method so "never logged" holds for any layer (including
// Hono's default onError, which uses console.error).
function spyOnConsole() {
  return (['log', 'error', 'warn', 'info', 'debug'] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => {}),
  );
}

function expectNoLoggedValue(spies: ReturnType<typeof spyOnConsole>, secret: string) {
  for (const spy of spies) {
    for (const call of spy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain(secret);
    }
  }
}

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
        username: `u_${SEED_HASH}`,
        setupUrl: setupUrlFor(SEED_HASH),
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

  it('returns 401 with Cache-Control: no-store on POST /enable without a JWT, and never provisions', async () => {
    const fetchMock = stubFetch();

    const res = await app.request('/api/notifications/enable', { method: 'POST' }, requestEnv());
    expect(res.status).toBe(401);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = (await res.json()) as { success: boolean; error?: string };
    expect(body.success).toBe(false);
    expect(body.error).toBe('Unauthorized');
    expect(callsTo(fetchMock, (url) => url === PROVISION_URL)).toHaveLength(0);
    expect(await getProvisioning(env.DB, USER_ID)).toBeNull();
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
        username: `u_${PROVISION_HASH}`,
        setupUrl: setupUrlFor(PROVISION_HASH),
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

  it('passes a freshly generated password through once, never storing or logging it', async () => {
    const spies = spyOnConsole();
    stubFetch({ provisionBody: provisionResponseBody({ password: PROVISION_PASSWORD }) });

    const res = await app.request(
      '/api/notifications/enable',
      { method: 'POST', headers: await authHeader(EMAIL) },
      requestEnv(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> };
    expect(body.success).toBe(true);
    expect(body.data.password).toBe(PROVISION_PASSWORD);
    expect(body.data.provisioned).toBe(true);

    // Not stored: read the raw D1 row (getProvisioning only selects three columns, so
    // it could not falsify a stored password) and check no column mentions password.
    const raw = await env.DB.prepare('SELECT * FROM user_notifications WHERE user_id = ?')
      .bind(USER_ID)
      .first<Record<string, unknown>>();
    expect(raw).not.toBeNull();
    expect(Object.keys(raw!).filter((k) => k.toLowerCase().includes('password'))).toEqual([]);
    expect(Object.values(raw!)).not.toContain(PROVISION_PASSWORD);
    // Belt and suspenders: the columns are exactly the 0011 migration's.
    expect(Object.keys(raw!).sort()).toEqual(
      [
        'id',
        'user_id',
        'person_hash',
        'subscriber_token',
        'enabled',
        'provisioned_at',
        'created_at',
        'updated_at',
      ].sort(),
    );

    // Not logged by any layer.
    expectNoLoggedValue(spies, PROVISION_PASSWORD);

    // Never in a later GET.
    const getRes = await app.request(
      '/api/notifications',
      { headers: await authHeader(EMAIL) },
      requestEnv(),
    );
    const getBody = (await getRes.json()) as { data: Record<string, unknown> };
    expect(getBody.data).not.toHaveProperty('password');
    expect(JSON.stringify(getBody)).not.toContain(PROVISION_PASSWORD);
  });

  it('omits password when the upstream did not generate one (no password key at all)', async () => {
    stubFetch();

    const res = await app.request(
      '/api/notifications/enable',
      { method: 'POST', headers: await authHeader(EMAIL) },
      requestEnv(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data).not.toHaveProperty('password');
  });

  it('omits an empty-string upstream password from the response', async () => {
    stubFetch({ provisionBody: provisionResponseBody({ password: '' }) });

    const res = await app.request(
      '/api/notifications/enable',
      { method: 'POST', headers: await authHeader(EMAIL) },
      requestEnv(),
    );
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data).not.toHaveProperty('password');
  });

  it('never includes password on the existing-row (re-enable) branch, and makes no outbound call', async () => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    await setEnabled(env.DB, USER_ID, false);
    // Even an upstream that would hand back a password must not be reached.
    const fetchMock = stubFetch({ provisionBody: provisionResponseBody({ password: PROVISION_PASSWORD }) });

    const res = await app.request(
      '/api/notifications/enable',
      { method: 'POST', headers: await authHeader(EMAIL) },
      requestEnv(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data).not.toHaveProperty('password');
    expect(callsTo(fetchMock, (url) => url === PROVISION_URL)).toHaveLength(0);
  });

  it('sends Cache-Control: no-store on the 502 provisioning-failure response too', async () => {
    stubFetch({ provisionStatus: 500 });

    const res = await app.request(
      '/api/notifications/enable',
      { method: 'POST', headers: await authHeader(EMAIL) },
      requestEnv(),
    );
    expect(res.status).toBe(502);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
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
    expect(body.data.username).toBe(`u_${SEED_HASH}`);
    expect(body.data.setupUrl).toBe(setupUrlFor(SEED_HASH));
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

describe('POST /api/notifications/reset-password', () => {
  async function postReset() {
    return app.request(
      '/api/notifications/reset-password',
      { method: 'POST', headers: await authHeader(EMAIL) },
      requestEnv(),
    );
  }

  it('makes exactly one outbound reset call with the app id and verified email, and returns the new password', async () => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    const spies = spyOnConsole();
    const fetchMock = stubFetch();

    const res = await postReset();

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ success: true, data: { password: RESET_PASSWORD } });

    const calls = callsTo(fetchMock, (url) => url === RESET_PASSWORD_URL);
    expect(calls).toHaveLength(1);
    expect(calls[0][1]?.method).toBe('POST');
    expect(JSON.parse(calls[0][1]?.body as string)).toEqual({ app_id: 'chores4irl', email: EMAIL });

    expectNoLoggedValue(spies, RESET_PASSWORD);
  });

  it('takes the email only from the verified Access identity, ignoring any in the request', async () => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    const fetchMock = stubFetch();

    const res = await app.request(
      '/api/notifications/reset-password?email=attacker@example.com',
      {
        method: 'POST',
        headers: {
          ...(await authHeader(EMAIL)),
          'Content-Type': 'application/json',
          'X-Email': 'attacker@example.com',
        },
        body: JSON.stringify({ email: 'attacker@example.com', app_id: 'someotherapp' }),
      },
      requestEnv(),
    );

    expect(res.status).toBe(200);
    const calls = callsTo(fetchMock, (url) => url === RESET_PASSWORD_URL);
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0][1]?.body as string)).toEqual({ app_id: 'chores4irl', email: EMAIL });
  });

  it('never logs or returns a password carried in a failing upstream body', async () => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    const spies = spyOnConsole();
    stubFetch({ resetStatus: 500, resetBody: { error: 'boom', password: RESET_PASSWORD } });

    const res = await postReset();

    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain(RESET_PASSWORD);
    expectNoLoggedValue(spies, RESET_PASSWORD);
  });

  it('sends Cache-Control: no-store even when an unexpected error is thrown (500)', async () => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    stubFetch();
    spyOnConsole();
    const throwingEnv = {
      ...requestEnv(),
      DB: {
        prepare: () => {
          throw new Error('d1 down');
        },
      },
    };

    const res = await app.request(
      '/api/notifications/reset-password',
      { method: 'POST', headers: await authHeader(EMAIL) },
      throwingEnv,
    );

    expect(res.status).toBe(500);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('does not store the new password (the row is unchanged)', async () => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    stubFetch();

    await postReset();

    const raw = await env.DB.prepare('SELECT * FROM user_notifications WHERE user_id = ?')
      .bind(USER_ID)
      .first<Record<string, unknown>>();
    expect(Object.values(raw!)).not.toContain(RESET_PASSWORD);
    expect(await getProvisioning(env.DB, USER_ID)).toEqual({
      personHash: SEED_HASH,
      subscriberToken: SEED_TOKEN,
      enabled: true,
    });
  });

  it('returns 409 with no outbound call when the user has no provisioning row', async () => {
    const fetchMock = stubFetch();

    const res = await postReset();

    expect(res.status).toBe(409);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ success: false, error: 'Notifications are not enabled' });
    expect(callsTo(fetchMock, (url) => url === RESET_PASSWORD_URL)).toHaveLength(0);
  });

  it('returns 409 with no outbound call when the row is soft-off (disabled)', async () => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    await setEnabled(env.DB, USER_ID, false);
    const fetchMock = stubFetch();

    const res = await postReset();

    expect(res.status).toBe(409);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(callsTo(fetchMock, (url) => url === RESET_PASSWORD_URL)).toHaveLength(0);
  });

  it('maps an upstream 429 to 429 with the try-again-in-an-hour message', async () => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    stubFetch({ resetStatus: 429, resetBody: { error: 'rate limited' } });

    const res = await postReset();

    expect(res.status).toBe(429);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({
      success: false,
      error: 'Too many new passwords. Try again in an hour.',
    });
  });

  it('maps an upstream 404 to 502', async () => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    stubFetch({ resetStatus: 404, resetBody: { error: 'no such user' } });

    const res = await postReset();

    expect(res.status).toBe(502);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ success: false, error: 'Could not generate a new password' });
  });

  it('maps a thrown upstream fetch to 502', async () => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    stubFetch({ resetThrows: true });

    const res = await postReset();

    expect(res.status).toBe(502);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ success: false, error: 'Could not generate a new password' });
  });

  it('maps an upstream 200 without a password to 502 (never success)', async () => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    stubFetch({ resetBody: { user_id: 'notifs-user-1', app_id: 'chores4irl' } });

    const res = await postReset();

    expect(res.status).toBe(502);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ success: false, error: 'Could not generate a new password' });
  });

  it('returns 401 without the Access JWT, with no outbound reset call', async () => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    const fetchMock = stubFetch();

    const res = await app.request('/api/notifications/reset-password', { method: 'POST' }, requestEnv());

    expect(res.status).toBe(401);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(callsTo(fetchMock, (url) => url === RESET_PASSWORD_URL)).toHaveLength(0);
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
