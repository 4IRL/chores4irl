// Best-effort outbound module for provisioning a user against the 4irl-notifs
// delivery-api door. A narrowed env slice, the shared doorFetch helper returning
// a discriminated union, fail-closed on any response-shape surprise, and
// structured JSON logging. Framework-agnostic (plain function taking a narrowed
// env + args, no Hono Context) so later phases' cron/hook can reuse it.
//
// Unlike access-allowlist's "warning wrapper", provisioning IS the primary
// action for enabling notifications — its caller treats a failure as a real
// error (502), not a degraded warning.

import { doorFetch, mapDoorStatus, parseRetryAfter, type DoorEnv } from './notifs-door.js';
import { NOTIFS_APP_ID } from './notifs-ids.js';

export type ProvisionResult =
  // `password` is the ntfy password 4irl-notifs generated for this person; present
  // only when it was just generated (a person already set up through another 4IRL
  // app gets none). It is passed through to the browser once and never stored/logged.
  | { status: 'ok'; personHash: string; subscriberToken: string; password?: string }
  | { status: 'rate_limited'; retryAfterSeconds?: number }
  | { status: 'failed'; reason: string };

export async function provisionUser(env: DoorEnv, email: string): Promise<ProvisionResult> {
  const startedAt = Date.now();
  const fail = (reason: string, status?: number): ProvisionResult => {
    console.log(
      JSON.stringify({
        event: 'notifs-provision-failed',
        email,
        reason,
        ...(status !== undefined ? { status } : {}),
        duration_ms: Date.now() - startedAt,
      }),
    );
    return { status: 'failed', reason };
  };

  const door = await doorFetch(env, `/v1/apps/${NOTIFS_APP_ID}/provision`, { email });
  if (!door.ok) {
    return fail(door.reason);
  }
  const res = door.res;

  if (res.status === 429) {
    const retryAfterSeconds = parseRetryAfter(res);
    console.log(
      JSON.stringify({
        event: 'notifs-provision-failed',
        email,
        reason: 'rate_limited',
        status: 429,
        duration_ms: Date.now() - startedAt,
      }),
    );
    return { status: 'rate_limited', ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}) };
  }
  if (!res.ok) {
    return fail(mapDoorStatus(res.status), res.status);
  }

  const body = (await res.json().catch(() => null)) as {
    person_hash?: unknown;
    token?: unknown;
    password?: unknown;
  } | null;
  // Fail closed on any shape surprise — never return a partial result.
  if (!body || typeof body.person_hash !== 'string' || typeof body.token !== 'string') {
    return fail('unexpected provisioning response shape');
  }

  // Charset-guard person_hash: it's interpolated into the ntfy topic/outbound URL
  // and the frontend QR subscribe URL (the topic is a substring, e.g.
  // `chores4irl-${personHash}-all`), so a `/` or other unsafe char would alter
  // path segments. Require a safe alphanumeric charset and fail closed otherwise.
  if (!/^[a-z0-9]+$/i.test(body.person_hash)) {
    return fail('invalid person_hash charset in provisioning response');
  }

  console.log(JSON.stringify({ event: 'notifs-provision', email, duration_ms: Date.now() - startedAt }));
  // topic_pattern/broadcast_topic are intentionally not parsed — nothing
  // consumes them; the topic is built locally (see notifs-ids.ts).
  // The password is optional: anything other than a non-empty string is dropped
  // (not a failure). The log line above deliberately omits it.
  const password = typeof body.password === 'string' && body.password !== '' ? body.password : undefined;
  return {
    status: 'ok',
    personHash: body.person_hash,
    subscriberToken: body.token,
    password,
  };
}
