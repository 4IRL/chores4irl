import { describe, it, expect, afterEach, vi } from 'vitest';
import { provisionUser } from '../src/notifs-provisioning.js';

const TEST_ENV = {
  NOTIFS_DELIVERY_BASE_URL: 'https://notifs-delivery.test',
  NOTIFS_APP_KEY: 'dak_test-app-key',
  NOTIFS_DELIVERY_ACCESS_CLIENT_ID: 'test-client-id',
  NOTIFS_DELIVERY_ACCESS_CLIENT_SECRET: 'test-client-secret',
};

const PROVISION_URL = 'https://notifs-delivery.test/v1/apps/chores4irl/provision';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

// A well-formed door provisioning response. `topic_pattern`/`broadcast_topic`
// are present in the real response but intentionally ignored by provisionUser.
function provisionBody() {
  return {
    user_id: 42,
    app_id: 'chores4irl',
    person_hash: 'abc123hash',
    topic_pattern: 'chores4irl-abc123hash-*',
    broadcast_topic: 'chores4irl-broadcast',
    token: 'tk_subscriber-token',
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('provisionUser', () => {
  it('POSTs exactly {email} to the door provision URL and returns ok with personHash/subscriberToken', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: typeof input === 'string' ? input : input.toString(), init });
        return jsonResponse(provisionBody());
      }),
    );

    const result = await provisionUser(TEST_ENV, 'user@example.com');

    expect(result).toEqual({
      status: 'ok',
      personHash: 'abc123hash',
      subscriberToken: 'tk_subscriber-token',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(PROVISION_URL);
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(calls[0].init!.body as string)).toEqual({ email: 'user@example.com' });
  });

  it('sends the Bearer app key and CF-Access headers when the client id is non-empty', async () => {
    let headers: Headers | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        headers = new Headers(init?.headers);
        return jsonResponse(provisionBody());
      }),
    );

    await provisionUser(TEST_ENV, 'user@example.com');

    expect(headers?.get('Content-Type')).toBe('application/json');
    expect(headers?.get('Authorization')).toBe('Bearer dak_test-app-key');
    expect(headers?.get('CF-Access-Client-Id')).toBe('test-client-id');
    expect(headers?.get('CF-Access-Client-Secret')).toBe('test-client-secret');
  });

  it('omits CF-Access headers entirely when the client id is empty (local, no Access gate)', async () => {
    let headers: Headers | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        headers = new Headers(init?.headers);
        return jsonResponse(provisionBody());
      }),
    );

    await provisionUser(
      { ...TEST_ENV, NOTIFS_DELIVERY_ACCESS_CLIENT_ID: '', NOTIFS_DELIVERY_ACCESS_CLIENT_SECRET: '' },
      'user@example.com',
    );

    expect(headers?.get('Authorization')).toBe('Bearer dak_test-app-key');
    expect(headers?.has('CF-Access-Client-Id')).toBe(false);
    expect(headers?.has('CF-Access-Client-Secret')).toBe(false);
  });

  it('makes zero fetch calls and fails with missing_app_key when the app key is empty', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(provisionBody()));
    vi.stubGlobal('fetch', fetchMock);

    const result = await provisionUser({ ...TEST_ENV, NOTIFS_APP_KEY: '' }, 'user@example.com');

    expect(result).toEqual({ status: 'failed', reason: 'missing_app_key' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls AbortSignal.timeout with 10000', async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(provisionBody())),
    );

    await provisionUser(TEST_ENV, 'user@example.com');

    expect(timeoutSpy).toHaveBeenCalledWith(10000);
  });

  it('maps a TimeoutError rejection to failed/timeout and another error to failed/network', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('timed out', 'TimeoutError');
      }),
    );
    expect(await provisionUser(TEST_ENV, 'user@example.com')).toEqual({
      status: 'failed',
      reason: 'timeout',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network unreachable');
      }),
    );
    expect(await provisionUser(TEST_ENV, 'user@example.com')).toEqual({
      status: 'failed',
      reason: 'network',
    });
  });

  it.each([
    [401, 'door_auth_rejected'],
    [403, 'door_auth_rejected'],
    [503, 'door_unavailable'],
    [500, 'unexpected_status:500'],
    [404, 'unexpected_status:404'],
  ])('maps a %i to failed with reason %s and logs reason and status', async (status, reason) => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'boom' }, status)),
    );

    expect(await provisionUser(TEST_ENV, 'user@example.com')).toEqual({ status: 'failed', reason });
    const line = JSON.parse(logSpy.mock.calls[0][0] as string) as Record<string, unknown>;
    expect(line).toMatchObject({ event: 'notifs-provision-failed', reason, status });
  });

  it('logs rate_limited with status 429 on a door 429', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'slow' }, 429)),
    );

    await provisionUser(TEST_ENV, 'user@example.com');

    const line = JSON.parse(logSpy.mock.calls[0][0] as string) as Record<string, unknown>;
    expect(line).toMatchObject({ event: 'notifs-provision-failed', reason: 'rate_limited', status: 429 });
  });

  it('maps a 429 to rate_limited carrying the parsed Retry-After', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'slow' }, 429, { 'Retry-After': '120' })),
    );

    expect(await provisionUser(TEST_ENV, 'user@example.com')).toEqual({
      status: 'rate_limited',
      retryAfterSeconds: 120,
    });
  });

  it('maps a 429 with no Retry-After to rate_limited without retryAfterSeconds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'slow' }, 429)),
    );

    expect(await provisionUser(TEST_ENV, 'user@example.com')).toEqual({ status: 'rate_limited' });
  });

  it('fails closed when the response body is missing person_hash', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ ...provisionBody(), person_hash: undefined })),
    );

    const result = await provisionUser(TEST_ENV, 'user@example.com');

    expect(result.status).toBe('failed');
  });

  it('fails closed when the response body is missing token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ ...provisionBody(), token: undefined })),
    );

    const result = await provisionUser(TEST_ENV, 'user@example.com');

    expect(result.status).toBe('failed');
  });

  it('fails closed when person_hash contains an unsafe char (e.g. a path separator)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ ...provisionBody(), person_hash: 'abc/../evil' })),
    );

    const result = await provisionUser(TEST_ENV, 'user@example.com');

    expect(result.status).toBe('failed');
  });

  it('includes a non-empty string password in the ok result, and never logs it', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ ...provisionBody(), password: 'abcd-efgh-jkmn-pqrs' })),
    );

    const result = await provisionUser(TEST_ENV, 'user@example.com');

    expect(result).toEqual({
      status: 'ok',
      personHash: 'abc123hash',
      subscriberToken: 'tk_subscriber-token',
      password: 'abcd-efgh-jkmn-pqrs',
    });
    expect(logSpy).toHaveBeenCalled();
    for (const call of logSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain('abcd-efgh-jkmn-pqrs');
    }
  });

  it('never logs the app key, the Access secret or the subscriber token, on success or failure', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(provisionBody())),
    );
    await provisionUser(TEST_ENV, 'user@example.com');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'no' }, 401)),
    );
    await provisionUser(TEST_ENV, 'user@example.com');

    expect(logSpy).toHaveBeenCalled();
    for (const call of logSpy.mock.calls) {
      const line = JSON.stringify(call);
      expect(line).not.toContain('dak_test-app-key');
      expect(line).not.toContain('test-client-secret');
      expect(line).not.toContain('tk_subscriber-token');
    }
  });

  it.each([
    ['an empty string', ''],
    ['a number', 12345],
    ['null', null],
    ['an object', { value: 'abcd-efgh-jkmn-pqrs' }],
  ])('drops a password that is %s without failing the call', async (_label, password) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ ...provisionBody(), password })),
    );

    const result = await provisionUser(TEST_ENV, 'user@example.com');

    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.password).toBeUndefined();
  });

  it('fails closed when the response body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not json', { status: 200 })),
    );

    const result = await provisionUser(TEST_ENV, 'user@example.com');

    expect(result.status).toBe('failed');
  });
});
