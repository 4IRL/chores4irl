// Outbound module for asking the self-hosted 4irl-notifs service to generate a
// fresh ntfy password for a person (a new phone, or a lost password). Mirrors
// notifs-provisioning.ts: a narrowed env slice, a try/catch around the single
// fetch returning a discriminated union, fail-closed on any response-shape
// surprise, and structured JSON logging. Like provisionUser it sets no fetch
// timeout (a deliberate non-change: adding one here alone would diverge from
// the sibling module).
//
// SECURITY: the generated password is returned to the caller and nowhere else.
// It is never stored and never written to a log line.

import { NOTIFS_APP_ID, type ProvisioningEnv } from './notifs-provisioning.js';

export type ResetPasswordResult =
  { status: 'ok'; password: string } | { status: 'rate_limited' } | { status: 'failed'; reason: string };

export async function resetPassword(env: ProvisioningEnv, email: string): Promise<ResetPasswordResult> {
  const clientId = env.NOTIFS_CF_ACCESS_CLIENT_ID;
  const clientSecret = env.NOTIFS_CF_ACCESS_CLIENT_SECRET;
  const headers = {
    'Content-Type': 'application/json',
    // Sent only when non-empty — local dev (make local-up) has no Access gate.
    ...(clientId ? { 'CF-Access-Client-Id': clientId, 'CF-Access-Client-Secret': clientSecret } : {}),
  };

  const startedAt = Date.now();
  // The password is deliberately absent from this logger's parameters.
  const finish = (result: ResetPasswordResult): ResetPasswordResult => {
    const reason = result.status === 'failed' ? result.reason : undefined;
    console.log(
      JSON.stringify({
        event: 'notifs-reset-password',
        email,
        outcome: result.status,
        ...(reason ? { reason } : {}),
        duration_ms: Date.now() - startedAt,
      }),
    );
    return result;
  };

  let res: Response;
  try {
    res = await fetch(`${env.NOTIFS_API_BASE_URL}/v1/reset-password`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ app_id: NOTIFS_APP_ID, email }),
    });
  } catch (err) {
    return finish({ status: 'failed', reason: err instanceof Error ? err.message : String(err) });
  }

  if (res.status === 429) {
    return finish({ status: 'rate_limited' });
  }
  if (!res.ok) {
    return finish({ status: 'failed', reason: `unexpected status from reset-password API: ${res.status}` });
  }

  const body = (await res.json().catch(() => null)) as { password?: unknown } | null;
  // Fail closed: a 200 without a usable password is never reported as success.
  if (!body || typeof body.password !== 'string' || body.password === '') {
    return finish({ status: 'failed', reason: 'missing_password' });
  }

  return finish({ status: 'ok', password: body.password });
}
