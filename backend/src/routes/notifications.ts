import { Hono } from 'hono';
import type { ApiResponse, NotificationStatus } from '../../../types/SharedTypes.js';
import { getProvisioning, saveProvisioning, setEnabled } from '../notifications.js';
import { NOTIFS_APP_ID, provisionUser } from '../notifs-provisioning.js';
import { ntfyUsername, personTopic, publishTest } from '../ntfy-publish.js';
import type { BaseEnv } from '../types.js';

// Per-user notification routes, mounted behind accessAuth + resolveUser (BaseEnv,
// the narrower per-user context — notifications are per-user, not household-
// scoped). This route is the ONLY place the NotificationStatus wire type is
// built: from getProvisioning(...) (the DB-only row accessor) plus env (DD-17).
const notifications = new Hono<BaseEnv>();

// Builds the provisioned/enabled wire status from a stored row's credentials.
// server is the full origin (scheme + host) so the frontend never prepends a
// scheme (DD-B); topic and username are derived locally from the person hash,
// and setupUrl is the shared setup-page link with the app, username and display
// name filled in (server-authoritative so the app id has one source).
function provisionedStatus(
  env: BaseEnv['Bindings'],
  personHash: string,
  subscriberToken: string,
  enabled: boolean,
): NotificationStatus {
  const username = ntfyUsername(personHash);
  const setupUrl = new URL(env.NOTIFS_SETUP_BASE_URL);
  setupUrl.searchParams.set('app', NOTIFS_APP_ID);
  setupUrl.searchParams.set('user', username);
  setupUrl.searchParams.set('name', 'Chores4irl');
  return {
    provisioned: true,
    enabled,
    server: new URL(env.NTFY_BASE_URL).origin,
    topic: personTopic(personHash),
    subscriberToken,
    username,
    setupUrl: setupUrl.toString(),
  };
}

notifications.get('/', async (c) => {
  const row = await getProvisioning(c.env.DB, c.var.userId);
  const data: NotificationStatus = row
    ? provisionedStatus(c.env, row.personHash, row.subscriberToken, row.enabled)
    : { provisioned: false, enabled: false };
  return c.json({ success: true, data } satisfies ApiResponse<NotificationStatus>);
});

notifications.post('/enable', async (c) => {
  // Re-enable path (DD-19): a row already exists (e.g. after a prior soft-off) —
  // skip provisioning entirely so the existing token/QR are preserved, just flip
  // the soft-off flag back on and echo the stored credentials.
  const existing = await getProvisioning(c.env.DB, c.var.userId);
  if (existing) {
    await setEnabled(c.env.DB, c.var.userId, true);
    const data = provisionedStatus(c.env, existing.personHash, existing.subscriberToken, true);
    return c.json({ success: true, data } satisfies ApiResponse<NotificationStatus>);
  }

  // First-time enable: provisioning IS the primary action, so a failure is a
  // real error (502), not a degraded warning.
  const result = await provisionUser(c.env, c.var.verifiedEmail);
  if (result.status === 'failed') {
    return c.json(
      { success: false, error: 'Could not set up notifications' } satisfies ApiResponse<never>,
      502,
    );
  }

  await saveProvisioning(c.env.DB, c.var.userId, {
    personHash: result.personHash,
    subscriberToken: result.subscriberToken,
  });
  const data = provisionedStatus(c.env, result.personHash, result.subscriberToken, true);
  return c.json({ success: true, data } satisfies ApiResponse<NotificationStatus>);
});

notifications.post('/test', async (c) => {
  const row = await getProvisioning(c.env.DB, c.var.userId);
  if (!row || !row.enabled) {
    return c.json(
      { success: false, error: 'Notifications are not enabled' } satisfies ApiResponse<never>,
      409,
    );
  }

  const result = await publishTest(c.env, row.personHash);
  if (result.status === 'failed') {
    return c.json(
      { success: false, error: 'Could not send test notification' } satisfies ApiResponse<never>,
      502,
    );
  }

  return c.json({ success: true, data: null } satisfies ApiResponse<null>);
});

notifications.post('/disable', async (c) => {
  const result = await setEnabled(c.env.DB, c.var.userId, false);
  if (result.status === 'not_provisioned') {
    return c.json(
      { success: false, error: 'Notifications are not enabled' } satisfies ApiResponse<never>,
      409,
    );
  }

  // Full NotificationStatus so the frontend can setStatus(body.data) straight off
  // this response (DD-C); server/topic/token are omitted — the collapsed off-state
  // UI doesn't read them.
  const data: NotificationStatus = { provisioned: true, enabled: false };
  return c.json({ success: true, data } satisfies ApiResponse<NotificationStatus>);
});

export default notifications;
