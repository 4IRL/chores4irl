import { describe, it, expect, afterEach, vi } from 'vitest';
import { resetPassword } from '../src/notifs-reset-password.js';

const TEST_ENV = {
  NOTIFS_DELIVERY_BASE_URL: 'https://notifs-delivery.test',
  NOTIFS_APP_KEY: 'dak_test-app-key',
  NOTIFS_DELIVERY_ACCESS_CLIENT_ID: 'test-client-id',
  NOTIFS_DELIVERY_ACCESS_CLIENT_SECRET: 'test-client-secret',
};

const RESET_PASSWORD_URL = 'https://notifs-delivery.test/v1/apps/chores4irl/reset-password';
const NEW_PASSWORD = 'abcd-efgh-jkmn-pqrs';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function resetBody(overrides: Record<string, unknown> = {}) {
  return { user_id: 42, app_id: 'chores4irl', password: NEW_PASSWORD, ...overrides };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('resetPassword', () => {
  it('POSTs exactly {email} to the door reset-password URL and returns ok with the password', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: typeof input === 'string' ? input : input.toString(), init });
        return jsonResponse(resetBody());
      }),
    );

    const result = await resetPassword(TEST_ENV, 'user@example.com');

    expect(result).toEqual({ status: 'ok', password: NEW_PASSWORD });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(RESET_PASSWORD_URL);
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(calls[0].init!.body as string)).toEqual({ email: 'user@example.com' });
  });

  it('sends the Bearer app key and CF-Access headers when the client id is non-empty', async () => {
    let headers: Headers | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        headers = new Headers(init?.headers);
        return jsonResponse(resetBody());
      }),
    );

    await resetPassword(TEST_ENV, 'user@example.com');

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
        return jsonResponse(resetBody());
      }),
    );

    await resetPassword(
      { ...TEST_ENV, NOTIFS_DELIVERY_ACCESS_CLIENT_ID: '', NOTIFS_DELIVERY_ACCESS_CLIENT_SECRET: '' },
      'user@example.com',
    );

    expect(headers?.get('Authorization')).toBe('Bearer dak_test-app-key');
    expect(headers?.has('CF-Access-Client-Id')).toBe(false);
    expect(headers?.has('CF-Access-Client-Secret')).toBe(false);
  });

  it('makes zero fetch calls and fails with missing_app_key when the app key is empty', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(resetBody()));
    vi.stubGlobal('fetch', fetchMock);

    const result = await resetPassword({ ...TEST_ENV, NOTIFS_APP_KEY: '' }, 'user@example.com');

    expect(result).toEqual({ status: 'failed', reason: 'missing_app_key' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls AbortSignal.timeout with 10000', async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(resetBody())),
    );

    await resetPassword(TEST_ENV, 'user@example.com');

    expect(timeoutSpy).toHaveBeenCalledWith(10000);
  });

  it('maps a 429 with Retry-After to rate_limited carrying the seconds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'slow down' }, 429, { 'Retry-After': '120' })),
    );

    expect(await resetPassword(TEST_ENV, 'user@example.com')).toEqual({
      status: 'rate_limited',
      retryAfterSeconds: 120,
    });
  });

  it.each([[undefined], ['abc'], ['0'], ['1234567890']])(
    'maps a 429 with Retry-After %s to rate_limited without seconds',
    async (retryAfter) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          jsonResponse(
            { error: 'slow down' },
            429,
            retryAfter === undefined ? {} : { 'Retry-After': retryAfter },
          ),
        ),
      );

      expect(await resetPassword(TEST_ENV, 'user@example.com')).toEqual({ status: 'rate_limited' });
    },
  );

  it('maps the real door 404 body (user does not exist) to person_not_in_app and logs that reason', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'user does not exist' }, 404)),
    );

    expect(await resetPassword(TEST_ENV, 'user@example.com')).toEqual({ status: 'person_not_in_app' });

    const line = JSON.parse(logSpy.mock.calls[0][0] as string) as Record<string, unknown>;
    expect(line).toMatchObject({
      event: 'notifs-reset-password',
      outcome: 'person_not_in_app',
      reason: 'person_not_in_app',
    });
  });

  it.each([
    ['another error text', () => jsonResponse({ error: 'app not found' }, 404)],
    ['the internal result name as the error text', () => jsonResponse({ error: 'person_not_in_app' }, 404)],
    ['a bare body', () => new Response('not found', { status: 404 })],
    ['an empty JSON body', () => jsonResponse({}, 404)],
  ])('treats a 404 with %s as failed unexpected_status:404', async (_label, makeResponse) => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => makeResponse()),
    );

    expect(await resetPassword(TEST_ENV, 'user@example.com')).toEqual({
      status: 'failed',
      reason: 'unexpected_status:404',
    });

    const line = JSON.parse(logSpy.mock.calls[0][0] as string) as Record<string, unknown>;
    expect(line).toMatchObject({ outcome: 'failed', reason: 'unexpected_status:404', status: 404 });
  });

  it.each([
    [401, 'door_auth_rejected'],
    [403, 'door_auth_rejected'],
    [503, 'door_unavailable'],
    [500, 'unexpected_status:500'],
  ])('maps a %i to failed with reason %s and logs reason and status', async (status, reason) => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'boom' }, status)),
    );

    expect(await resetPassword(TEST_ENV, 'user@example.com')).toEqual({ status: 'failed', reason });
    const line = JSON.parse(logSpy.mock.calls[0][0] as string) as Record<string, unknown>;
    expect(line).toMatchObject({ event: 'notifs-reset-password', outcome: 'failed', reason, status });
  });

  it('maps a TimeoutError rejection to failed/timeout and another error to failed/network', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('timed out', 'TimeoutError');
      }),
    );
    expect(await resetPassword(TEST_ENV, 'user@example.com')).toEqual({
      status: 'failed',
      reason: 'timeout',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network unreachable');
      }),
    );
    expect(await resetPassword(TEST_ENV, 'user@example.com')).toEqual({
      status: 'failed',
      reason: 'network',
    });
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['non-string', 12345],
  ])('fails closed with missing_password when a 200 carries a %s password', async (_label, password) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(resetBody({ password }))),
    );

    expect(await resetPassword(TEST_ENV, 'user@example.com')).toEqual({
      status: 'failed',
      reason: 'missing_password',
    });
  });

  it('fails closed with missing_password when the 200 body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not json', { status: 200 })),
    );

    expect(await resetPassword(TEST_ENV, 'user@example.com')).toEqual({
      status: 'failed',
      reason: 'missing_password',
    });
  });

  it('never logs the password, the app key or the Access secret, on success', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(resetBody())),
    );

    await resetPassword(TEST_ENV, 'user@example.com');

    expect(logSpy).toHaveBeenCalled();
    for (const call of logSpy.mock.calls) {
      const text = JSON.stringify(call);
      expect(text).not.toContain(NEW_PASSWORD);
      expect(text).not.toContain('dak_test-app-key');
      expect(text).not.toContain('test-client-secret');
    }
    const line = JSON.parse(logSpy.mock.calls[0][0] as string) as Record<string, unknown>;
    expect(line).toMatchObject({
      event: 'notifs-reset-password',
      email: 'user@example.com',
      outcome: 'ok',
    });
    expect(typeof line.duration_ms).toBe('number');
  });

  it('never logs a password carried in a failing response body or in the returned reason', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'boom', password: NEW_PASSWORD }, 500)),
    );

    const result = await resetPassword(TEST_ENV, 'user@example.com');

    expect(JSON.stringify(result)).not.toContain(NEW_PASSWORD);
    for (const call of logSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain(NEW_PASSWORD);
    }
  });

  it.each([[401], [404], [429]])(
    'never logs the password, app key or Access secret on a %i carrying a password body',
    async (status) => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => jsonResponse({ error: 'nope', password: NEW_PASSWORD }, status)),
      );

      const result = await resetPassword(TEST_ENV, 'user@example.com');

      expect(JSON.stringify(result)).not.toContain(NEW_PASSWORD);
      expect(logSpy).toHaveBeenCalled();
      for (const call of logSpy.mock.calls) {
        const text = JSON.stringify(call);
        expect(text).not.toContain(NEW_PASSWORD);
        expect(text).not.toContain('dak_test-app-key');
        expect(text).not.toContain('test-client-secret');
      }
    },
  );

  it('logs the failure outcome and reason', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'boom' }, 500)),
    );

    await resetPassword(TEST_ENV, 'user@example.com');

    const line = JSON.parse(logSpy.mock.calls[0][0] as string) as Record<string, unknown>;
    expect(line).toMatchObject({
      event: 'notifs-reset-password',
      outcome: 'failed',
      reason: 'unexpected_status:500',
    });
  });
});
