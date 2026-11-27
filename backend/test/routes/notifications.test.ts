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
  NOTIFS_DELIVERY_BASE_URL: 'https://notifs-delivery.test.fixture',
  NOTIFS_APP_KEY: 'dak_route-test-key',
  NOTIFS_DELIVERY_ACCESS_CLIENT_ID: 'test-client-id',
  NOTIFS_DELIVERY_ACCESS_CLIENT_SECRET: 'test-client-secret',
  NOTIFS_SETUP_BASE_URL: 'https://notifs-setup.test.fixture/',
  NTFY_BASE_URL: 'https://notifs.test.fixture',
};

// The shared setup-page link the server builds for a provisioned person: base
// URL from NOTIFS_SETUP_BASE_URL, then app / user / name query params.
function setupUrlFor(personHash: string): string {
  return `${NOTIFS_TEST_ENV.NOTIFS_SETUP_BASE_URL}?app=chores4irl&user=u_${personHash}&name=Chores4irl`;
}

const PROVISION_URL = `${NOTIFS_TEST_ENV.NOTIFS_DELIVERY_BASE_URL}/v1/apps/chores4irl/provision`;
const RESET_PASSWORD_URL = `${NOTIFS_TEST_ENV.NOTIFS_DELIVERY_BASE_URL}/v1/apps/chores4irl/reset-password`;
const MESSAGES_URL = `${NOTIFS_TEST_ENV.NOTIFS_DELIVERY_BASE_URL}/v1/messages?wait=8`;

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

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
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
    provisionHeaders?: Record<string, string>;
    messagesStatus?: number;
    messagesBody?: unknown;
    messagesThrows?: boolean;
    resetStatus?: number;
    resetBody?: unknown;
    resetHeaders?: Record<string, string>;
    resetThrows?: boolean;
  } = {},
) {
  const {
    provisionStatus = 200,
    provisionBody = provisionResponseBody(),
    provisionHeaders = {},
    messagesStatus = 202,
    messagesBody = { message: { id: 'm1', status: 'delivered' } },
    messagesThrows = false,
    resetStatus = 200,
    resetBody = { user_id: 'notifs-user-1', app_id: 'chores4irl', password: RESET_PASSWORD },
    resetHeaders = {},
    resetThrows = false,
  } = opts;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url === TEST_JWKS_URL) return jsonResponse(primaryJwks);
    if (url === PROVISION_URL) return jsonResponse(provisionBody, provisionStatus, provisionHeaders);
    if (url === RESET_PASSWORD_URL) {
      if (resetThrows) throw new Error('network unreachable');
      return jsonResponse(resetBody, resetStatus, resetHeaders);
    }
    if (url === MESSAGES_URL) {
      if (messagesThrows) throw new Error('network unreachable');
      if (typeof messagesBody === 'string') return new Response(messagesBody, { status: messagesStatus });
      return jsonResponse(messagesBody, messagesStatus);
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

  it('returns 502 with no row saved on a door timeout, then a second enable succeeds and saves the row', async () => {
    const base = stubFetch();
    let timedOut = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url === PROVISION_URL && !timedOut) {
          timedOut = true;
          throw new DOMException('timed out', 'TimeoutError');
        }
        return base(input, init);
      }),
    );
    spyOnConsole();

    const first = await app.request(
      '/api/notifications/enable',
      { method: 'POST', headers: await authHeader(EMAIL) },
      requestEnv(),
    );
    expect(first.status).toBe(502);
    expect(await getProvisioning(env.DB, USER_ID)).toBeNull();

    const second = await app.request(
      '/api/notifications/enable',
      { method: 'POST', headers: await authHeader(EMAIL) },
      requestEnv(),
    );
    expect(second.status).toBe(200);
    expect(await getProvisioning(env.DB, USER_ID)).toEqual({
      personHash: PROVISION_HASH,
      subscriberToken: PROVISION_TOKEN,
      enabled: true,
    });
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

  it('sends exactly {email} with the Bearer app key and Access headers to the door', async () => {
    const fetchMock = stubFetch();

    await app.request(
      '/api/notifications/enable',
      { method: 'POST', headers: await authHeader(EMAIL) },
      requestEnv(),
    );

    const calls = callsTo(fetchMock, (url) => url === PROVISION_URL);
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0][1]?.body as string)).toEqual({ email: EMAIL });
    const headers = new Headers(calls[0][1]?.headers);
    expect(headers.get('Authorization')).toBe(`Bearer ${NOTIFS_TEST_ENV.NOTIFS_APP_KEY}`);
    expect(headers.get('CF-Access-Client-Id')).toBe('test-client-id');
    expect(headers.get('CF-Access-Client-Secret')).toBe('test-client-secret');
  });

  it('returns 502, makes no door call and saves no row when the app key is empty', async () => {
    const fetchMock = stubFetch();

    const res = await app.request(
      '/api/notifications/enable',
      { method: 'POST', headers: await authHeader(EMAIL) },
      { ...requestEnv(), NOTIFS_APP_KEY: '' },
    );

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ success: false, error: 'Could not set up notifications' });
    expect(callsTo(fetchMock, (url) => url === PROVISION_URL)).toHaveLength(0);
    expect(await getProvisioning(env.DB, USER_ID)).toBeNull();
  });

  it.each([401, 403, 503])('maps a door %i to the unchanged 502 string and saves no row', async (status) => {
    stubFetch({ provisionStatus: status, provisionBody: { error: 'no' } });

    const res = await app.request(
      '/api/notifications/enable',
      { method: 'POST', headers: await authHeader(EMAIL) },
      requestEnv(),
    );

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ success: false, error: 'Could not set up notifications' });
    expect(await getProvisioning(env.DB, USER_ID)).toBeNull();
  });

  it.each([
    ['1', 'Too many attempts. Try again in 1 minute.', '1'],
    ['60', 'Too many attempts. Try again in 1 minute.', '60'],
    ['61', 'Too many attempts. Try again in 2 minutes.', '61'],
    ['120', 'Too many attempts. Try again in 2 minutes.', '120'],
    ['0', 'Too many attempts. Try again in an hour.', null],
    ['1234567890', 'Too many attempts. Try again in an hour.', null],
    ['soon', 'Too many attempts. Try again in an hour.', null],
    [undefined, 'Too many attempts. Try again in an hour.', null],
  ])(
    'maps a door 429 (Retry-After %s) to 429 "%s", header %s, saving no row',
    async (retryAfter, error, header) => {
      stubFetch({
        provisionStatus: 429,
        provisionBody: { error: 'slow' },
        provisionHeaders: retryAfter === undefined ? {} : { 'Retry-After': retryAfter },
      });

      const res = await app.request(
        '/api/notifications/enable',
        { method: 'POST', headers: await authHeader(EMAIL) },
        requestEnv(),
      );

      expect(res.status).toBe(429);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
      expect(res.headers.get('Retry-After')).toBe(header);
      expect(await res.json()).toEqual({ success: false, error });
      expect(await getProvisioning(env.DB, USER_ID)).toBeNull();
    },
  );

  it('saves the row and reports it set up when a retry enable returns no password', async () => {
    // A retry after an ambiguous provision timeout: the door already generated the
    // password on the first call, so this response carries none.
    stubFetch();

    const res = await app.request(
      '/api/notifications/enable',
      { method: 'POST', headers: await authHeader(EMAIL) },
      requestEnv(),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data).not.toHaveProperty('password');
    expect(await getProvisioning(env.DB, USER_ID)).toEqual({
      personHash: PROVISION_HASH,
      subscriberToken: PROVISION_TOKEN,
      enabled: true,
    });

    const getRes = await app.request(
      '/api/notifications',
      { headers: await authHeader(EMAIL) },
      requestEnv(),
    );
    const getBody = (await getRes.json()) as { data: Record<string, unknown> };
    expect(getBody.data).toMatchObject({ provisioned: true, enabled: true });
  });

  it('never logs the app key, the Access secret or the subscriber token', async () => {
    const spies = spyOnConsole();
    stubFetch();

    await app.request(
      '/api/notifications/enable',
      { method: 'POST', headers: await authHeader(EMAIL) },
      requestEnv(),
    );

    expectNoLoggedValue(spies, NOTIFS_TEST_ENV.NOTIFS_APP_KEY);
    expectNoLoggedValue(spies, NOTIFS_TEST_ENV.NOTIFS_DELIVERY_ACCESS_CLIENT_SECRET);
    expectNoLoggedValue(spies, PROVISION_TOKEN);
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
  async function postTest() {
    return app.request(
      '/api/notifications/test',
      { method: 'POST', headers: await authHeader(EMAIL) },
      requestEnv(),
    );
  }

  function messageCalls(fetchMock: ReturnType<typeof stubFetch>) {
    return callsTo(fetchMock, (url) => url === MESSAGES_URL);
  }

  it('sends one recipient message through the door with the Bearer key and returns success', async () => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    const fetchMock = stubFetch();
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');

    const res = await postTest();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);

    const calls = messageCalls(fetchMock);
    expect(calls).toHaveLength(1);
    const init = calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${NOTIFS_TEST_ENV.NOTIFS_APP_KEY}`);
    const sent = JSON.parse(init.body as string);
    expect(sent.app_id).toBe('chores4irl');
    expect(sent.channel).toBe('all');
    expect(sent.to).toEqual({ recipient: SEED_HASH });
    expect(sent.to.destination).toBeUndefined();
    expect(sent.idempotency_key).toMatch(new RegExp(`^test-${USER_ID}-\\d+$`));
    expect(sent.display.title).toBeTruthy();
    expect(sent.display.body).toBeTruthy();
    expect(sent.display.url).toBe('https://chores.4irl.app');
    expect(timeoutSpy).toHaveBeenCalledWith(12_000);
  });

  it('uses a different idempotency_key for each click', async () => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    const fetchMock = stubFetch();
    // Real clock (fake dates would invalidate the signed test JWT); the pause
    // guarantees the Date.now() component of the key differs between clicks.
    await postTest();
    await new Promise((resolve) => setTimeout(resolve, 5));
    await postTest();

    const keys = messageCalls(fetchMock).map(
      ([, init]) => JSON.parse((init as RequestInit).body as string).idempotency_key,
    );
    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it.each([
    ['dead', 'send_dead'],
    ['partial', 'send_partial'],
    ['unrouted', 'send_unrouted'],
    ['release_failed', 'send_release_failed'],
    ['pending', 'send_pending'],
  ])('returns 502 and logs %s as %s for a non-delivered message', async (status, reason) => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    stubFetch({ messagesBody: { message: { id: 'm1', status } } });
    const spies = spyOnConsole();

    const res = await postTest();
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ success: false, error: 'Could not send test notification' });
    expect(JSON.stringify(spies[0].mock.calls)).toContain(reason);
  });

  it.each([
    ['a non-JSON body', 'not json'],
    ['no message object', { ok: true }],
  ])('returns 502 and logs unexpected_response_shape for a 2xx with %s', async (_label, messagesBody) => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    stubFetch({ messagesBody });
    const spies = spyOnConsole();

    const res = await postTest();
    expect(res.status).toBe(502);
    expect(JSON.stringify(spies[0].mock.calls)).toContain('unexpected_response_shape');
  });

  it.each([
    [422, 'no_publisher'],
    [429, 'rate_limited'],
    [401, 'door_auth_rejected'],
    [403, 'door_auth_rejected'],
    [503, 'door_unavailable'],
    [500, 'unexpected_status:500'],
  ])('returns 502 and logs the door %i as %s', async (messagesStatus, reason) => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    stubFetch({ messagesStatus, messagesBody: { error: 'x' } });
    const spies = spyOnConsole();

    const res = await postTest();
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ success: false, error: 'Could not send test notification' });
    expect(JSON.stringify(spies[0].mock.calls)).toContain(reason);
  });

  it('returns 502 and logs network when the door is unreachable', async () => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    stubFetch({ messagesThrows: true });
    const spies = spyOnConsole();

    const res = await postTest();
    expect(res.status).toBe(502);
    expect(JSON.stringify(spies[0].mock.calls)).toContain('network');
  });

  it('returns 502 and logs timeout when the door call times out', async () => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    const base = stubFetch();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url === MESSAGES_URL) throw new DOMException('timed out', 'TimeoutError');
        return base(input, init);
      }),
    );
    const spies = spyOnConsole();

    const res = await postTest();
    expect(res.status).toBe(502);
    expect(JSON.stringify(spies[0].mock.calls)).toContain('timeout');
  });

  it('returns 502 without any outbound call when the app key is empty', async () => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    const fetchMock = stubFetch();
    const spies = spyOnConsole();

    const res = await app.request(
      '/api/notifications/test',
      { method: 'POST', headers: await authHeader(EMAIL) },
      { ...requestEnv(), NOTIFS_APP_KEY: '' },
    );
    expect(res.status).toBe(502);
    expect(messageCalls(fetchMock)).toHaveLength(0);
    expect(JSON.stringify(spies[0].mock.calls)).toContain('missing_app_key');
  });

  it('never logs the app key, the Access secret or the subscriber token', async () => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    const spies = spyOnConsole();

    for (const opts of [
      {},
      { messagesStatus: 503, messagesBody: { error: 'x' } },
      { messagesBody: { message: { id: 'm1', status: 'dead' } } },
    ]) {
      stubFetch(opts);
      await postTest();
    }
    expectNoLoggedValue(spies, NOTIFS_TEST_ENV.NOTIFS_APP_KEY);
    expectNoLoggedValue(spies, NOTIFS_TEST_ENV.NOTIFS_DELIVERY_ACCESS_CLIENT_SECRET);
    expectNoLoggedValue(spies, NOTIFS_TEST_ENV.NOTIFS_DELIVERY_ACCESS_CLIENT_ID);
    expectNoLoggedValue(spies, SEED_TOKEN);
  });

  it('returns 409 and makes no outbound call when the user has never provisioned', async () => {
    const fetchMock = stubFetch();
    const res = await postTest();
    expect(res.status).toBe(409);
    expect(messageCalls(fetchMock)).toHaveLength(0);
  });

  it('returns 409 when notifications are soft-off (not enabled)', async () => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    await setEnabled(env.DB, USER_ID, false);
    const fetchMock = stubFetch();

    const res = await postTest();
    expect(res.status).toBe(409);
    expect(messageCalls(fetchMock)).toHaveLength(0);
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
    expect(JSON.parse(calls[0][1]?.body as string)).toEqual({ email: EMAIL });
    const headers = new Headers(calls[0][1]?.headers);
    expect(headers.get('Authorization')).toBe(`Bearer ${NOTIFS_TEST_ENV.NOTIFS_APP_KEY}`);
    expect(headers.get('CF-Access-Client-Id')).toBe('test-client-id');

    expectNoLoggedValue(spies, RESET_PASSWORD);
    expectNoLoggedValue(spies, NOTIFS_TEST_ENV.NOTIFS_APP_KEY);
    expectNoLoggedValue(spies, NOTIFS_TEST_ENV.NOTIFS_DELIVERY_ACCESS_CLIENT_SECRET);
  });

  it('returns 502 with no door call when the app key is empty', async () => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    const fetchMock = stubFetch();

    const res = await app.request(
      '/api/notifications/reset-password',
      { method: 'POST', headers: await authHeader(EMAIL) },
      { ...requestEnv(), NOTIFS_APP_KEY: '' },
    );

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ success: false, error: 'Could not generate a new password' });
    expect(callsTo(fetchMock, (url) => url === RESET_PASSWORD_URL)).toHaveLength(0);
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
    expect(JSON.parse(calls[0][1]?.body as string)).toEqual({ email: EMAIL });
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

  it.each([
    ['120', 'Too many new passwords. Try again in 2 minutes.', '120'],
    ['1', 'Too many new passwords. Try again in 1 minute.', '1'],
    ['60', 'Too many new passwords. Try again in 1 minute.', '60'],
    ['61', 'Too many new passwords. Try again in 2 minutes.', '61'],
    ['0', 'Too many new passwords. Try again in an hour.', null],
    ['1234567890', 'Too many new passwords. Try again in an hour.', null],
    ['soon', 'Too many new passwords. Try again in an hour.', null],
    [undefined, 'Too many new passwords. Try again in an hour.', null],
  ])('maps a door 429 (Retry-After %s) to 429 "%s", header %s', async (retryAfter, error, header) => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    stubFetch({
      resetStatus: 429,
      resetBody: { error: 'rate limited' },
      resetHeaders: retryAfter === undefined ? {} : { 'Retry-After': retryAfter },
    });

    const res = await postReset();

    expect(res.status).toBe(429);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Retry-After')).toBe(header);
    expect(await res.json()).toEqual({ success: false, error });
  });

  it.each([401, 403, 503])('maps a door %i to the unchanged 502 string', async (status) => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    stubFetch({ resetStatus: status, resetBody: { error: 'no' } });

    const res = await postReset();

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ success: false, error: 'Could not generate a new password' });
  });

  it.each([
    ['another error text', { error: 'app not found' }],
    ['the legacy text-only body', { error: 'user does not exist' }],
    ['a wrong code', { error: 'user does not exist', code: 'app_not_found' }],
    ['a non-string code', { code: 123 }],
  ])('keeps the row and returns 502 for a door 404 with %s', async (_label, resetBody) => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    stubFetch({ resetStatus: 404, resetBody });

    const res = await postReset();

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ success: false, error: 'Could not generate a new password' });
    expect(await getProvisioning(env.DB, USER_ID)).toEqual({
      personHash: SEED_HASH,
      subscriberToken: SEED_TOKEN,
      enabled: true,
    });
  });

  it('maps a code-only door 404 body to 409 and deletes the row', async () => {
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    stubFetch({ resetStatus: 404, resetBody: { code: 'person_not_in_app' } });

    const res = await postReset();

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      success: false,
      error: 'Notifications are not set up. Turn them on again.',
    });
    expect(await getProvisioning(env.DB, USER_ID)).toBeNull();
  });

  it('maps a door 404 to 409, deletes only that user row, and a following enable provisions', async () => {
    await env.DB.prepare('INSERT INTO users (id, email, is_admin) VALUES (?, ?, 0)')
      .bind(2, 'other@example.com')
      .run();
    await saveProvisioning(env.DB, USER_ID, { personHash: SEED_HASH, subscriberToken: SEED_TOKEN });
    await saveProvisioning(env.DB, 2, { personHash: 'otherhash234567', subscriberToken: 'tk_other' });
    const logSpy = spyOnConsole()[0];
    const fetchMock = stubFetch({
      resetStatus: 404,
      resetBody: { error: 'user does not exist', code: 'person_not_in_app' },
    });

    const res = await postReset();

    expect(res.status).toBe(409);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({
      success: false,
      error: 'Notifications are not set up. Turn them on again.',
    });
    expect(await getProvisioning(env.DB, USER_ID)).toBeNull();
    expect(await getProvisioning(env.DB, 2)).toEqual({
      personHash: 'otherhash234567',
      subscriberToken: 'tk_other',
      enabled: true,
    });
    const logged = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(logged).toContain('person_not_in_app');

    // The next /enable finds no row and provisions through the door.
    const enableRes = await app.request(
      '/api/notifications/enable',
      { method: 'POST', headers: await authHeader(EMAIL) },
      requestEnv(),
    );
    expect(enableRes.status).toBe(200);
    expect(callsTo(fetchMock, (url) => url === PROVISION_URL)).toHaveLength(1);
    expect(await getProvisioning(env.DB, USER_ID)).toEqual({
      personHash: PROVISION_HASH,
      subscriberToken: PROVISION_TOKEN,
      enabled: true,
    });
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
    expect(callsTo(fetchMock, (url) => url.endsWith('/deprovision'))).toHaveLength(0);
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
