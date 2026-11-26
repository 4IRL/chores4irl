import { describe, it, expect, afterEach, vi } from 'vitest';
import { sendTestNotification } from '../src/notifs-test-send.js';

const TEST_ENV = {
  NOTIFS_DELIVERY_BASE_URL: 'https://notifs-delivery.test',
  NOTIFS_APP_KEY: 'dak_test-app-key',
  NOTIFS_DELIVERY_ACCESS_CLIENT_ID: 'test-client-id',
  NOTIFS_DELIVERY_ACCESS_CLIENT_SECRET: 'test-client-secret',
};

const MESSAGES_URL = 'https://notifs-delivery.test/v1/messages?wait=8';
const PERSON_HASH = 'abc123hash';

function stubFetch(handler: () => Response | Promise<Response>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: typeof input === 'string' ? input : input.toString(), init });
      return handler();
    }),
  );
  return calls;
}

function messageResponse(status: string, httpStatus = 202) {
  return new Response(JSON.stringify({ message: { id: 'm1', status } }), {
    status: httpStatus,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('sendTestNotification', () => {
  it('POSTs a recipient message to /v1/messages?wait=8 and returns ok on delivered', async () => {
    const calls = stubFetch(() => messageResponse('delivered'));
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');

    const result = await sendTestNotification(TEST_ENV, PERSON_HASH, 7);

    expect(result).toEqual({ status: 'ok' });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(MESSAGES_URL);
    expect(calls[0].init?.method).toBe('POST');
    const headers = new Headers(calls[0].init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer dak_test-app-key');
    expect(headers.get('CF-Access-Client-Id')).toBe('test-client-id');
    const body = JSON.parse(calls[0].init?.body as string);
    expect(body).toMatchObject({
      app_id: 'chores4irl',
      channel: 'all',
      to: { recipient: PERSON_HASH },
      payload: {},
      display: {
        title: 'Chore Reaper test',
        body: 'If you can read this, notifications are working.',
        url: 'https://chores.4irl.app',
        priority: 'default',
      },
    });
    expect(body.idempotency_key).toMatch(/^test-7-\d+$/);
    expect(timeoutSpy).toHaveBeenCalledWith(12_000);
  });

  it.each([
    ['dead', 'send_dead'],
    ['partial', 'send_partial'],
    ['unrouted', 'send_unrouted'],
    ['release_failed', 'send_release_failed'],
    ['pending', 'send_pending'],
    ['something_new', 'send_unknown_status:something_new'],
    ['toString', 'send_unknown_status:toString'],
  ])('returns failed %s -> %s for a non-delivered message', async (status, reason) => {
    stubFetch(() => messageResponse(status));
    expect(await sendTestNotification(TEST_ENV, PERSON_HASH, 7)).toEqual({ status: 'failed', reason });
  });

  it.each([[42], [null], [undefined]])(
    'returns failed send_unknown_status for a non-string status %s',
    async (status) => {
      stubFetch(
        () =>
          new Response(JSON.stringify({ message: { id: 'm1', status } }), {
            status: 202,
            headers: { 'content-type': 'application/json' },
          }),
      );
      expect(await sendTestNotification(TEST_ENV, PERSON_HASH, 7)).toEqual({
        status: 'failed',
        reason: 'send_unknown_status',
      });
    },
  );

  it('fails closed on a 2xx with a non-JSON body or no message object', async () => {
    stubFetch(() => new Response('not json', { status: 202 }));
    expect(await sendTestNotification(TEST_ENV, PERSON_HASH, 7)).toEqual({
      status: 'failed',
      reason: 'unexpected_response_shape',
    });

    stubFetch(() => new Response('{"ok":true}', { status: 200 }));
    expect(await sendTestNotification(TEST_ENV, PERSON_HASH, 7)).toEqual({
      status: 'failed',
      reason: 'unexpected_response_shape',
    });
  });

  it.each([
    [422, 'no_publisher'],
    [429, 'rate_limited'],
    [401, 'door_auth_rejected'],
    [403, 'door_auth_rejected'],
    [503, 'door_unavailable'],
    [500, 'unexpected_status:500'],
  ])('maps door status %i to %s', async (status, reason) => {
    stubFetch(() => new Response('{}', { status }));
    expect(await sendTestNotification(TEST_ENV, PERSON_HASH, 7)).toEqual({ status: 'failed', reason });
  });

  it('maps a TimeoutError to timeout and other throws to network', async () => {
    stubFetch(() => {
      throw new DOMException('timed out', 'TimeoutError');
    });
    expect(await sendTestNotification(TEST_ENV, PERSON_HASH, 7)).toEqual({
      status: 'failed',
      reason: 'timeout',
    });

    stubFetch(() => {
      throw new Error('network unreachable');
    });
    expect(await sendTestNotification(TEST_ENV, PERSON_HASH, 7)).toEqual({
      status: 'failed',
      reason: 'network',
    });
  });

  it('makes no outbound call when the app key is empty', async () => {
    const calls = stubFetch(() => messageResponse('delivered'));
    const result = await sendTestNotification({ ...TEST_ENV, NOTIFS_APP_KEY: '' }, PERSON_HASH, 7);
    expect(result).toEqual({ status: 'failed', reason: 'missing_app_key' });
    expect(calls).toHaveLength(0);
  });
});
