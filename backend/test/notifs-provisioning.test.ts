import { describe, it, expect, afterEach, vi } from 'vitest';
import { provisionUser } from '../src/notifs-provisioning.js';

const TEST_ENV = {
  NOTIFS_API_BASE_URL: 'https://notifs-api.test',
  NOTIFS_CF_ACCESS_CLIENT_ID: 'test-client-id',
  NOTIFS_CF_ACCESS_CLIENT_SECRET: 'test-client-secret',
};

const PROVISION_URL = 'https://notifs-api.test/v1/provision';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// A well-formed 4irl-notifs provisioning response. `topic_pattern`/`broadcast_topic`
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
});

describe('provisionUser', () => {
  it('POSTs {app_id, email} to {NOTIFS_API_BASE_URL}/v1/provision and returns ok with personHash/subscriberToken', async () => {
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
        return jsonResponse(provisionBody());
      }),
    );

    await provisionUser(TEST_ENV, 'user@example.com');

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
        return jsonResponse(provisionBody());
      }),
    );

    await provisionUser(
      { ...TEST_ENV, NOTIFS_CF_ACCESS_CLIENT_ID: '', NOTIFS_CF_ACCESS_CLIENT_SECRET: '' },
      'user@example.com',
    );

    expect(headers?.get('Content-Type')).toBe('application/json');
    expect(headers?.has('CF-Access-Client-Id')).toBe(false);
    expect(headers?.has('CF-Access-Client-Secret')).toBe(false);
  });

  it('returns failed (not a throw) on a non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'boom' }, 500)),
    );

    const result = await provisionUser(TEST_ENV, 'user@example.com');

    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.reason).toBeTruthy();
  });

  it('returns failed (not a throw) when the request errors over the network', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network unreachable');
      }),
    );

    const result = await provisionUser(TEST_ENV, 'user@example.com');

    expect(result.status).toBe('failed');
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
    logSpy.mockRestore();
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
