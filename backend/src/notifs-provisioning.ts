// Best-effort outbound module for provisioning a user against the self-hosted
// 4irl-notifs service. Mirrors access-allowlist.ts: a narrowed env slice, a
// per-fetch try/catch returning a discriminated union, fail-closed on any
// response-shape surprise, and structured JSON logging. Framework-agnostic
// (plain function taking a narrowed env + args, no Hono Context) so later
// phases' cron/hook can reuse it.
//
// Unlike access-allowlist's "warning wrapper", provisioning IS the primary
// action for enabling notifications — its caller treats a failure as a real
// error (502), not a degraded warning.

// The application identifier registered with 4irl-notifs. Must match
// `^[a-z0-9][a-z0-9_]{0,62}$`.
export const NOTIFS_APP_ID = 'chores4irl';

// The app's display name on the shared ntfy setup page (the `name` query param).
export const NOTIFS_APP_DISPLAY_NAME = 'Chores4irl';

export type ProvisioningEnv = {
  NOTIFS_API_BASE_URL: string;
  NOTIFS_CF_ACCESS_CLIENT_ID: string;
  NOTIFS_CF_ACCESS_CLIENT_SECRET: string;
};

export type ProvisionResult =
  // `password` is the ntfy password 4irl-notifs generated for this person; present
  // only when it was just generated (a person already set up through another 4IRL
  // app gets none). It is passed through to the browser once and never stored/logged.
  | { status: 'ok'; personHash: string; subscriberToken: string; password?: string }
  | { status: 'failed'; reason: string };

export async function provisionUser(env: ProvisioningEnv, email: string): Promise<ProvisionResult> {
  const clientId = env.NOTIFS_CF_ACCESS_CLIENT_ID;
  const clientSecret = env.NOTIFS_CF_ACCESS_CLIENT_SECRET;
  const headers = {
    'Content-Type': 'application/json',
    // The CF Access service-token headers are only sent when non-empty — local
    // dev (make local-up) has no Access gate, so the vars are blank there.
    ...(clientId ? { 'CF-Access-Client-Id': clientId, 'CF-Access-Client-Secret': clientSecret } : {}),
  };

  let res: Response;
  try {
    res = await fetch(`${env.NOTIFS_API_BASE_URL}/v1/provision`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ app_id: NOTIFS_APP_ID, email }),
    });
  } catch (err) {
    const reason = 'network error calling provisioning API';
    console.log(JSON.stringify({ event: 'notifs-provision-failed', email, reason, error: String(err) }));
    return { status: 'failed', reason };
  }

  if (!res.ok) {
    const reason = `unexpected status from provisioning API: ${res.status}`;
    console.log(JSON.stringify({ event: 'notifs-provision-failed', email, reason }));
    return { status: 'failed', reason };
  }

  const body = (await res.json().catch(() => null)) as {
    person_hash?: unknown;
    token?: unknown;
    password?: unknown;
  } | null;
  // Fail closed on any shape surprise — never return a partial result.
  if (!body || typeof body.person_hash !== 'string' || typeof body.token !== 'string') {
    const reason = 'unexpected provisioning response shape';
    console.log(JSON.stringify({ event: 'notifs-provision-failed', email, reason }));
    return { status: 'failed', reason };
  }

  // Charset-guard person_hash: it's interpolated into the ntfy topic/outbound URL
  // and the frontend QR subscribe URL (the topic is a substring, e.g.
  // `chores4irl-${personHash}-all`), so a `/` or other unsafe char would alter
  // path segments. Require a safe alphanumeric charset and fail closed otherwise.
  if (!/^[a-z0-9]+$/i.test(body.person_hash)) {
    const reason = 'invalid person_hash charset in provisioning response';
    console.log(JSON.stringify({ event: 'notifs-provision-failed', email, reason }));
    return { status: 'failed', reason };
  }

  console.log(JSON.stringify({ event: 'notifs-provision', email }));
  // topic_pattern/broadcast_topic are intentionally not parsed — nothing
  // consumes them; the topic is built locally (see ntfy-publish.ts).
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
