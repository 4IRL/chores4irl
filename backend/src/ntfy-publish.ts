// Best-effort outbound module for publishing a push notification to the
// self-hosted ntfy service. Mirrors access-allowlist.ts: a narrowed env slice,
// a per-fetch try/catch returning a discriminated union, and structured JSON
// logging. Framework-agnostic (plain function taking a narrowed env + args, no
// Hono Context) so later phases' cron/hook can reuse it.
//
// SECURITY: never send CF-Access-* headers to ntfy — the ntfy host is guarded
// only by the publisher Bearer token, a distinct auth surface from the
// provisioning API's CF Access service token.

export type NtfyEnv = {
  NTFY_BASE_URL: string;
  NTFY_PUBLISHER_TOKEN: string;
};

export type PublishResult = { status: 'ok' } | { status: 'failed'; reason: string };

// The per-user topic. `-all` is this user's catch-all subscription topic; the
// hash namespaces it so topics aren't guessable across users.
export function personTopic(personHash: string): string {
  return `chores4irl-${personHash}-all`;
}

export async function publishTest(env: NtfyEnv, personHash: string): Promise<PublishResult> {
  const topic = personTopic(personHash);
  // No Actions header in Phase 1 — the real "Mark done" http action is deferred
  // to the completion-broadcast phase, where a real chore id exists to target.
  const headers = {
    Authorization: `Bearer ${env.NTFY_PUBLISHER_TOKEN}`,
    Title: 'Chore Reaper test',
    Click: 'https://chores.4irl.app',
    Priority: 'default',
  };

  let res: Response;
  try {
    res = await fetch(`${env.NTFY_BASE_URL}/${topic}`, {
      method: 'POST',
      headers,
      body: 'If you can read this, notifications are working.',
    });
  } catch (err) {
    const reason = 'network error calling ntfy';
    console.log(JSON.stringify({ event: 'ntfy-publish-failed', topic, reason, error: String(err) }));
    return { status: 'failed', reason };
  }

  if (!res.ok) {
    const reason = `unexpected status from ntfy: ${res.status}`;
    console.log(JSON.stringify({ event: 'ntfy-publish-failed', topic, reason }));
    return { status: 'failed', reason };
  }

  console.log(JSON.stringify({ event: 'ntfy-publish', topic }));
  return { status: 'ok' };
}
