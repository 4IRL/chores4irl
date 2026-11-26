// Shared request helper for the 4irl-notifs delivery-api "front door". Every
// outbound call (provision, reset-password, and later the test send) goes through
// doorFetch so the app key, the Access headers, the timeout and the fail-closed
// empty-key guard live in exactly one place.
//
// SECURITY: nothing here logs the app key or the Access secret.

export type DoorEnv = {
  NOTIFS_DELIVERY_BASE_URL: string;
  NOTIFS_APP_KEY: string;
  NOTIFS_DELIVERY_ACCESS_CLIENT_ID: string;
  NOTIFS_DELIVERY_ACCESS_CLIENT_SECRET: string;
};

export type DoorFetchResult =
  { ok: true; res: Response } | { ok: false; reason: 'missing_app_key' | 'timeout' | 'network' };

export const DEFAULT_DOOR_TIMEOUT_MS = 10_000;

// POSTs JSON to the door. `path` may carry a query string. Returns
// `missing_app_key` before any fetch when the key is empty (fail closed), and
// maps an abort to `timeout` and any other thrown fetch error to `network`.
export async function doorFetch(
  env: DoorEnv,
  path: string,
  body: unknown,
  options?: { timeoutMs?: number },
): Promise<DoorFetchResult> {
  const appKey = env.NOTIFS_APP_KEY;
  if (!appKey) {
    return { ok: false, reason: 'missing_app_key' };
  }

  const clientId = env.NOTIFS_DELIVERY_ACCESS_CLIENT_ID;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${appKey}`,
    // The CF Access service-token headers are only sent when the id is non-empty
    // — local dev has no Access gate, so the vars are blank there.
    ...(clientId
      ? {
          'CF-Access-Client-Id': clientId,
          'CF-Access-Client-Secret': env.NOTIFS_DELIVERY_ACCESS_CLIENT_SECRET,
        }
      : {}),
  };

  try {
    const res = await fetch(`${env.NOTIFS_DELIVERY_BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options?.timeoutMs ?? DEFAULT_DOOR_TIMEOUT_MS),
    });
    return { ok: true, res };
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'TimeoutError' || name === 'AbortError') {
      return { ok: false, reason: 'timeout' };
    }
    return { ok: false, reason: 'network' };
  }
}

// Whole seconds from a Retry-After header, or undefined when absent, malformed,
// or below 1. Only 1-9 digit integers are accepted.
export function parseRetryAfter(res: Response): number | undefined {
  const raw = res.headers.get('Retry-After');
  if (raw === null || !/^[0-9]{1,9}$/.test(raw)) {
    return undefined;
  }
  const seconds = Number(raw);
  return seconds >= 1 ? seconds : undefined;
}

// The one status-to-reason mapper for every door caller. A route-specific
// override table is consulted first; no override is hard-coded here.
export function mapDoorStatus(status: number, overrides?: Partial<Record<number, string>>): string {
  const override = overrides?.[status];
  if (override) {
    return override;
  }
  if (status === 401 || status === 403) {
    return 'door_auth_rejected';
  }
  if (status === 503) {
    return 'door_unavailable';
  }
  if (status === 429) {
    return 'rate_limited';
  }
  return `unexpected_status:${status}`;
}
