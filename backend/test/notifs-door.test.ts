import { describe, it, expect, afterEach, vi } from 'vitest';
import { doorFetch, mapDoorStatus, parseRetryAfter } from '../src/notifs-door.js';

const ENV = {
  NOTIFS_DELIVERY_BASE_URL: 'https://notifs-delivery.test',
  NOTIFS_APP_KEY: 'dak_test-app-key',
  NOTIFS_DELIVERY_ACCESS_CLIENT_ID: 'id',
  NOTIFS_DELIVERY_ACCESS_CLIENT_SECRET: 'secret',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function withRetryAfter(value?: string): Response {
  return new Response('{}', { status: 429, headers: value === undefined ? {} : { 'Retry-After': value } });
}

describe('parseRetryAfter', () => {
  it.each([
    ['1', 1],
    ['60', 60],
    ['61', 61],
    ['0', undefined],
    ['1234567890', undefined],
    ['abc', undefined],
    ['-5', undefined],
    ['1.5', undefined],
    [undefined, undefined],
  ])('parses %s as %s', (raw, expected) => {
    expect(parseRetryAfter(withRetryAfter(raw))).toBe(expected);
  });
});

describe('mapDoorStatus', () => {
  it.each([
    [401, 'door_auth_rejected'],
    [403, 'door_auth_rejected'],
    [503, 'door_unavailable'],
    [429, 'rate_limited'],
    [404, 'unexpected_status:404'],
    [422, 'unexpected_status:422'],
    [500, 'unexpected_status:500'],
  ])('maps %i to %s without overrides', (status, reason) => {
    expect(mapDoorStatus(status)).toBe(reason);
  });

  it('consults the override table first, and only for the listed statuses', () => {
    expect(mapDoorStatus(404, { 404: 'person_not_in_app' })).toBe('person_not_in_app');
    expect(mapDoorStatus(422, { 422: 'no_publisher' })).toBe('no_publisher');
    expect(mapDoorStatus(500, { 404: 'person_not_in_app' })).toBe('unexpected_status:500');
    expect(mapDoorStatus(401, { 404: 'person_not_in_app' })).toBe('door_auth_rejected');
  });
});

describe('doorFetch', () => {
  it('returns missing_app_key without fetching when the key is empty', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await doorFetch({ ...ENV, NOTIFS_APP_KEY: '' }, '/v1/x', {})).toEqual({
      ok: false,
      reason: 'missing_app_key',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('defaults the timeout to 10000 and honours timeoutMs and a query string', async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        urls.push(String(input));
        return new Response('{}');
      }),
    );

    await doorFetch(ENV, '/v1/a', {});
    await doorFetch(ENV, '/v1/messages?wait=8', {}, { timeoutMs: 12_000 });

    expect(timeoutSpy).toHaveBeenNthCalledWith(1, 10000);
    expect(timeoutSpy).toHaveBeenNthCalledWith(2, 12000);
    expect(urls[1]).toBe('https://notifs-delivery.test/v1/messages?wait=8');
  });

  it('maps TimeoutError and AbortError to timeout and other errors to network', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('t', 'TimeoutError');
      }),
    );
    expect(await doorFetch(ENV, '/v1/x', {})).toEqual({ ok: false, reason: 'timeout' });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('a', 'AbortError');
      }),
    );
    expect(await doorFetch(ENV, '/v1/x', {})).toEqual({ ok: false, reason: 'timeout' });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );
    expect(await doorFetch(ENV, '/v1/x', {})).toEqual({ ok: false, reason: 'network' });
  });
});
