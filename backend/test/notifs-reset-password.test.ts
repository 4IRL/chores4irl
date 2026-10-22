import { describe, it, expect, afterEach, vi } from 'vitest';
import { resetPassword } from '../src/notifs-reset-password.js';

const TEST_ENV = {
  NOTIFS_API_BASE_URL: 'https://notifs-api.test',
  NOTIFS_CF_ACCESS_CLIENT_ID: 'test-client-id',
  NOTIFS_CF_ACCESS_CLIENT_SECRET: 'test-client-secret',
};

const RESET_PASSWORD_URL = 'https://notifs-api.test/v1/reset-password';
const NEW_PASSWORD = 'abcd-efgh-jkmn-pqrs';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
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
  it('POSTs {app_id, email} to {NOTIFS_API_BASE_URL}/v1/reset-password and returns ok with the password', async () => {
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
    expect(JSON.parse(calls[0].init!.body as string)).toEqual({
      app_id: 'chores4irl',
      email: 'user@example.com',
    });
  });

  it('sends CF-Access-Client-Id/Secret headers when the env values are non-empty', async () => {
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
      { ...TEST_ENV, NOTIFS_CF_ACCESS_CLIENT_ID: '', NOTIFS_CF_ACCESS_CLIENT_SECRET: '' },
      'user@example.com',
    );

    expect(headers?.has('CF-Access-Client-Id')).toBe(false);
    expect(headers?.has('CF-Access-Client-Secret')).toBe(false);
  });

  it('maps a 429 to rate_limited', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'slow down' }, 429)),
    );

    expect(await resetPassword(TEST_ENV, 'user@example.com')).toEqual({ status: 'rate_limited' });
  });

  it.each([404, 500])('maps a %i to failed with the prose status reason', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'boom' }, status)),
    );

    const result = await resetPassword(TEST_ENV, 'user@example.com');

    expect(result).toEqual({
      status: 'failed',
      reason: `unexpected status from reset-password API: ${status}`,
    });
  });

  it('returns failed (not a throw) with the error message when the request errors over the network', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network unreachable');
      }),
    );

    const result = await resetPassword(TEST_ENV, 'user@example.com');

    expect(result).toEqual({ status: 'failed', reason: 'network unreachable' });
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

  it('never logs the password, on success or failure', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(resetBody())),
    );

    await resetPassword(TEST_ENV, 'user@example.com');

    expect(logSpy).toHaveBeenCalled();
    for (const call of logSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain(NEW_PASSWORD);
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
      reason: 'unexpected status from reset-password API: 500',
    });
  });
});
