// Outbound module for asking the 4irl-notifs delivery-api door to generate a
// fresh ntfy password for a person (a new phone, or a lost password). Mirrors
// notifs-provisioning.ts: a narrowed env slice, the shared doorFetch helper
// returning a discriminated union, fail-closed on any response-shape surprise,
// and structured JSON logging. Both account calls carry the shared 10 s timeout.
//
// SECURITY: the generated password is returned to the caller and nowhere else.
// It is never stored and never written to a log line.

import { doorFetch, mapDoorStatus, parseRetryAfter, type DoorEnv } from './notifs-door.js';
import { NOTIFS_APP_ID } from './notifs-ids.js';

export type ResetPasswordResult =
  | { status: 'ok'; password: string }
  | { status: 'rate_limited'; retryAfterSeconds?: number }
  | { status: 'person_not_in_app' }
  | { status: 'failed'; reason: string };

// Route-specific override for the shared status mapper: the door says 404 when
// the person is not (or no longer) registered with this app.
const RESET_OVERRIDES = { 404: 'person_not_in_app' } as const;

export async function resetPassword(env: DoorEnv, email: string): Promise<ResetPasswordResult> {
  const startedAt = Date.now();
  // The password is deliberately absent from this logger's parameters.
  const finish = (result: ResetPasswordResult, reason?: string, status?: number): ResetPasswordResult => {
    console.log(
      JSON.stringify({
        event: 'notifs-reset-password',
        email,
        outcome: result.status,
        ...(reason ? { reason } : {}),
        ...(status !== undefined ? { status } : {}),
        duration_ms: Date.now() - startedAt,
      }),
    );
    return result;
  };

  const door = await doorFetch(env, `/v1/apps/${NOTIFS_APP_ID}/reset-password`, { email });
  if (!door.ok) {
    return finish({ status: 'failed', reason: door.reason }, door.reason);
  }
  const res = door.res;

  if (res.status === 404) {
    // Only the door's own `person_not_in_app` code means the person is gone.
    // Any other 404 (wrong base URL, path or proxy) must not delete credentials.
    let code: unknown;
    try {
      code = ((await res.json()) as { error?: unknown } | null)?.error;
    } catch {
      code = undefined;
    }
    if (code === 'person_not_in_app') {
      return finish({ status: 'person_not_in_app' }, mapDoorStatus(404, RESET_OVERRIDES), 404);
    }
    const reason = mapDoorStatus(404);
    return finish({ status: 'failed', reason }, reason, 404);
  }
  if (res.status === 429) {
    const retryAfterSeconds = parseRetryAfter(res);
    return finish(
      { status: 'rate_limited', ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}) },
      'rate_limited',
      429,
    );
  }
  if (!res.ok) {
    const reason = mapDoorStatus(res.status, RESET_OVERRIDES);
    return finish({ status: 'failed', reason }, reason, res.status);
  }

  const body = (await res.json().catch(() => null)) as { password?: unknown } | null;
  // Fail closed: a 200 without a usable password is never reported as success.
  if (!body || typeof body.password !== 'string' || body.password === '') {
    return finish({ status: 'failed', reason: 'missing_password' }, 'missing_password');
  }

  return finish({ status: 'ok', password: body.password });
}
