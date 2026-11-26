// Outbound module for the "Send test notification" button. Asks the 4irl-notifs
// delivery-api door to deliver a recipient push (POST /v1/messages) instead of
// the app publishing to ntfy itself. Mirrors notifs-reset-password.ts: a narrowed
// env slice, the shared doorFetch helper, fail-closed on any response-shape
// surprise, and structured JSON logging.
//
// The door is asked to wait up to 8 s for the first delivery attempt; the request
// timeout is 12 s so it outlasts that wait. Success is reported only when the
// message status is `delivered`. A `pending` message is reported as a failure even
// though the door may still retry and the push may arrive later.
//
// SECURITY: no log line contains the app key, the Access secret or a subscriber token.

import { doorFetch, mapDoorStatus, type DoorEnv } from './notifs-door.js';
import { NOTIFS_APP_ID } from './notifs-ids.js';

export type PublishResult = { status: 'ok' } | { status: 'failed'; reason: string };

const TEST_SEND_TIMEOUT_MS = 12_000;

// Route-specific override for the shared status mapper: the door answers 422
// when the app has no sealed ntfy publisher yet.
const MESSAGE_OVERRIDES = { 422: 'no_publisher' } as const;

const MESSAGE_STATUS_REASONS: Record<string, string> = {
  dead: 'send_dead',
  partial: 'send_partial',
  unrouted: 'send_unrouted',
  release_failed: 'send_release_failed',
  pending: 'send_pending',
};

export async function sendTestNotification(
  env: DoorEnv,
  personHash: string,
  userId: number,
): Promise<PublishResult> {
  const startedAt = Date.now();
  const finish = (result: PublishResult, status?: number): PublishResult => {
    console.log(
      JSON.stringify({
        event: 'notifs-test-send',
        personHash,
        outcome: result.status,
        ...(result.status === 'failed' ? { reason: result.reason } : {}),
        ...(status !== undefined ? { status } : {}),
        duration_ms: Date.now() - startedAt,
      }),
    );
    return result;
  };
  const fail = (reason: string, status?: number): PublishResult =>
    finish({ status: 'failed', reason }, status);

  const door = await doorFetch(
    env,
    '/v1/messages?wait=8',
    {
      app_id: NOTIFS_APP_ID,
      channel: 'all',
      // Unique per click, so a repeat press is a new send.
      idempotency_key: `test-${userId}-${Date.now()}`,
      to: { recipient: personHash },
      payload: {},
      display: {
        title: 'Chore Reaper test',
        body: 'If you can read this, notifications are working.',
        url: 'https://chores.4irl.app',
        priority: 'default',
      },
    },
    { timeoutMs: TEST_SEND_TIMEOUT_MS },
  );
  if (!door.ok) {
    return fail(door.reason);
  }
  const res = door.res;

  if (!res.ok) {
    return fail(mapDoorStatus(res.status, MESSAGE_OVERRIDES), res.status);
  }

  const body = (await res.json().catch(() => null)) as { message?: unknown } | null;
  const message = body?.message;
  if (!message || typeof message !== 'object') {
    return fail('unexpected_response_shape', res.status);
  }

  const messageStatus = (message as { status?: unknown }).status;
  if (messageStatus === 'delivered') {
    return finish({ status: 'ok' }, res.status);
  }
  if (typeof messageStatus === 'string' && Object.hasOwn(MESSAGE_STATUS_REASONS, messageStatus)) {
    return fail(MESSAGE_STATUS_REASONS[messageStatus], res.status);
  }
  // An unrecognised status is a distinct reason so the real value is not lost.
  const unknownReason =
    typeof messageStatus === 'string'
      ? `send_unknown_status:${messageStatus.slice(0, 64)}`
      : 'send_unknown_status';
  return fail(unknownReason, res.status);
}
