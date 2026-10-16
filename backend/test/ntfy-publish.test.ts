import { describe, it, expect, afterEach, vi } from 'vitest';
import { publishTest, personTopic } from '../src/ntfy-publish.js';

const TEST_ENV = {
  NTFY_BASE_URL: 'https://ntfy.test',
  NTFY_PUBLISHER_TOKEN: 'tk_publisher-token',
};

const PERSON_HASH = 'abc123hash';
const PUBLISH_URL = 'https://ntfy.test/chores4irl-abc123hash-all';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('personTopic', () => {
  it('builds the per-user topic as chores4irl-{personHash}-all', () => {
    expect(personTopic(PERSON_HASH)).toBe('chores4irl-abc123hash-all');
  });
});

describe('publishTest', () => {
  it('POSTs to {NTFY_BASE_URL}/chores4irl-{personHash}-all with Bearer auth and the expected headers, returning ok', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: typeof input === 'string' ? input : input.toString(), init });
        return new Response('', { status: 200 });
      }),
    );

    const result = await publishTest(TEST_ENV, PERSON_HASH);

    expect(result).toEqual({ status: 'ok' });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(PUBLISH_URL);
    expect(calls[0].init?.method).toBe('POST');

    expect(calls[0].init?.body).toBeTruthy();

    const headers = new Headers(calls[0].init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer tk_publisher-token');
    expect(headers.get('Title')).toBe('Chore Reaper test');
    expect(headers.get('Click')).toBe('https://chores.4irl.app');
    expect(headers.get('Priority')).toBe('default');
    // Phase 1 sends no interactive action and never leaks Access headers to ntfy.
    expect(headers.has('Actions')).toBe(false);
    expect(headers.has('CF-Access-Client-Id')).toBe(false);
    expect(headers.has('CF-Access-Client-Secret')).toBe(false);
  });

  it('returns failed (not a throw) on a non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );

    const result = await publishTest(TEST_ENV, PERSON_HASH);

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

    const result = await publishTest(TEST_ENV, PERSON_HASH);

    expect(result.status).toBe('failed');
  });
});
