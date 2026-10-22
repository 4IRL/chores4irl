import { StrictMode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsModal from './SettingsModal';
import type { NotificationStatus } from '@customTypes/SharedTypes';

// Stub QRCodeSVG so the exact string it encodes is assertable. The real component
// bakes `value` into an opaque SVG <path>, so a wrong separator/order/missing-origin
// regression in the composed subscribe URL would otherwise be invisible; the stub
// surfaces the `value` prop as a data attribute (DD Test Coverage — QR-content assertion).
vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, title }: { value: string; title?: string }) => (
    <div data-testid="qr-code" data-qr-value={value} title={title} />
  ),
}));

function jsonResponse(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }),
  );
}

type Handler = (init?: RequestInit) => Promise<Response>;

// A configurable fetch stub keyed on "METHOD /path". Any unhandled request
// throws loudly (mirrors the ChoresView/SettingsModal precedent), so a missing
// stub surfaces immediately rather than silently 404-ing.
function makeFetchStub(handlers: Record<string, Handler>) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method ?? 'GET').toUpperCase();
    const key = `${method} ${url}`;
    const handler = handlers[key];
    if (handler) return handler(init);
    throw new Error(`Unhandled fetch: ${key}`);
  });
}

const NOT_PROVISIONED: NotificationStatus = { provisioned: false, enabled: false };
const PROVISIONED: NotificationStatus = {
  provisioned: true,
  enabled: true,
  server: 'https://notifs.4irl.app',
  topic: 'chores4irl-abc123-all',
  subscriberToken: 'tk_test_abc123',
  username: 'u_abc123',
  setupUrl: 'https://notifs-setup.4irl.app/?app=chores4irl&user=u_abc123&name=Chores4irl',
};

function stubClipboard(writeText: () => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
    writable: true,
  });
}

function renderModal() {
  return render(<SettingsModal swipeStyle="ios" onSwipeStyleChange={vi.fn()} onCancel={vi.fn()} />);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  cleanup();
});

describe('SettingsModal — swipe style', () => {
  it('marks the currently active swipe style', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: NOT_PROVISIONED }),
      }),
    );
    renderModal();

    expect(screen.getByRole('button', { name: /iOS/ })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: /Android/ })).toHaveAttribute('aria-current', 'false');
  });

  it('selecting a different style PATCHes /api/me/swipe-style and reports the change', async () => {
    const user = userEvent.setup();
    const onSwipeStyleChange = vi.fn();
    let requestBody: unknown = null;
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: NOT_PROVISIONED }),
        'PATCH /api/me/swipe-style': (init) => {
          requestBody = JSON.parse(init!.body as string);
          return jsonResponse({ success: true, data: { swipeStyle: 'android' } });
        },
      }),
    );

    render(<SettingsModal swipeStyle="ios" onSwipeStyleChange={onSwipeStyleChange} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Android/ }));

    expect(requestBody).toEqual({ swipeStyle: 'android' });
    expect(onSwipeStyleChange).toHaveBeenCalledWith('android');
  });

  it('shows an error and leaves the selection unchanged when the request fails', async () => {
    const user = userEvent.setup();
    const onSwipeStyleChange = vi.fn();
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: NOT_PROVISIONED }),
        'PATCH /api/me/swipe-style': () =>
          jsonResponse({ success: false, error: 'Could not update swipe style' }),
      }),
    );

    render(<SettingsModal swipeStyle="ios" onSwipeStyleChange={onSwipeStyleChange} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Android/ }));

    expect(await screen.findByText('Could not update swipe style')).toBeInTheDocument();
    expect(onSwipeStyleChange).not.toHaveBeenCalled();
  });

  it('closes on Close button click', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: NOT_PROVISIONED }),
      }),
    );
    render(<SettingsModal swipeStyle="ios" onSwipeStyleChange={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('SettingsModal — modal a11y', () => {
  it('marks the backdrop as a labelled modal dialog (DD-13)', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: NOT_PROVISIONED }),
      }),
    );
    renderModal();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'settings-modal-title');
    expect(screen.getByRole('heading', { name: 'Settings' })).toHaveAttribute('id', 'settings-modal-title');
  });
});

describe('SettingsModal — notifications', () => {
  it('shows the off toggle when GET reports not provisioned', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: NOT_PROVISIONED }),
      }),
    );
    renderModal();

    const checkbox = await screen.findByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    expect(screen.getByText('Enable push notifications')).toBeInTheDocument();
  });

  it('renders the role=alert error and defaults to the off toggle when the mount GET rejects (DD-8)', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => Promise.reject(new Error('network down')),
      }),
    );
    renderModal();

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load notification settings');
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toHaveAttribute('aria-disabled', 'false');
    expect(screen.getByText('Enable push notifications')).toBeInTheDocument();
  });

  it('renders the role=alert error and defaults to the off toggle when the mount GET resolves { success:false } (DD-8)', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () =>
          jsonResponse({ success: false, error: 'Notifications service unavailable' }),
      }),
    );
    renderModal();

    // The mount effect's else branch (resolved failure, not a thrown rejection)
    // surfaces body.error verbatim into the same role=alert region.
    expect(await screen.findByRole('alert')).toHaveTextContent('Notifications service unavailable');
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toHaveAttribute('aria-disabled', 'false');
    expect(screen.getByText('Enable push notifications')).toBeInTheDocument();
  });

  it('enabling renders the QR + topic straight from the POST /enable response, with no re-fetch (DD-C)', async () => {
    const user = userEvent.setup();
    const fetchMock = makeFetchStub({
      'GET /api/notifications': () => jsonResponse({ success: true, data: NOT_PROVISIONED }),
      'POST /api/notifications/enable': () => jsonResponse({ success: true, data: PROVISIONED }),
    });
    vi.stubGlobal('fetch', fetchMock);
    renderModal();

    await user.click(await screen.findByRole('checkbox'));

    // The topic appears both as the Topic value line and in the install steps.
    expect((await screen.findAllByText('chores4irl-abc123-all')).length).toBeGreaterThan(0);
    expect(screen.getByText('tk_test_abc123')).toBeInTheDocument();
    // No follow-up GET — the panel came from the enable response (setStatus(body.data)).
    const getCalls = fetchMock.mock.calls.filter(
      ([input, init]) =>
        String(input) === '/api/notifications' && (init?.method ?? 'GET').toUpperCase() === 'GET',
    );
    expect(getCalls).toHaveLength(1);
  });

  it('renders the enabled checkbox as checked + aria-disabled, never natively disabled (DD-D/DD-5)', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
      }),
    );
    renderModal();

    const checkbox = await screen.findByRole('checkbox');
    await waitFor(() => expect(checkbox).toBeChecked());
    expect(checkbox).toHaveAttribute('aria-disabled', 'true');
    expect(checkbox).not.toBeDisabled();
    expect(screen.getByText('Push notifications enabled')).toBeInTheDocument();
  });

  it('encodes the server-provided setupUrl into the QR code, with a visible caption', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
      }),
    );
    renderModal();

    const qr = await screen.findByTestId('qr-code');
    expect(qr).toHaveAttribute('data-qr-value', PROVISIONED.setupUrl);
    expect(qr).toHaveAttribute('title', 'Scan to open setup on your phone');
    expect(screen.getByText('Scan to open setup on your phone')).toBeInTheDocument();
  });

  it('shows the Username and Topic rows alongside Server and Access token', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
      }),
    );
    renderModal();

    expect(await screen.findByText('Username')).toBeInTheDocument();
    expect(screen.getByText('u_abc123')).toBeInTheDocument();
    expect(screen.getByText('Topic')).toBeInTheDocument();
    expect(screen.getByText('chores4irl-abc123-all')).toBeInTheDocument();
    expect(screen.getByText('Access token')).toBeInTheDocument();
    expect(screen.getByText('https://notifs.4irl.app')).toBeInTheDocument();
  });

  it('keeps only Server, Topic and Access token in the QR/meta card (no Username)', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
      }),
    );
    renderModal();

    const meta = await screen.findByTestId('ntfy-meta-card');
    expect(within(meta).getByText('Server')).toBeInTheDocument();
    expect(within(meta).getByText('Topic')).toBeInTheDocument();
    expect(within(meta).getByText('Access token')).toBeInTheDocument();
    expect(within(meta).queryByText('Username')).not.toBeInTheDocument();
    expect(within(meta).queryByText('u_abc123')).not.toBeInTheDocument();
    expect(within(meta).queryByRole('button', { name: 'Copy username' })).not.toBeInTheDocument();
  });

  it('explains the meta card fields with a short caption inside it', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
      }),
    );
    renderModal();

    const meta = await screen.findByTestId('ntfy-meta-card');
    expect(
      within(meta).getByText(
        'Server and topic are for manual setup — the ntfy setup page shows them too. The access token is only for Android or other apps.',
      ),
    ).toBeInTheDocument();
  });

  it('groups Username above the password reveal inside one "Sign in to ntfy" block, before the setup CTA', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () =>
          jsonResponse({ success: true, data: { provisioned: false, enabled: false } }),
        'POST /api/notifications/enable': () =>
          jsonResponse({ success: true, data: { ...PROVISIONED, password: 'abcd-efgh-jkmn-pqrs' } }),
      }),
    );
    const user = userEvent.setup();
    renderModal();

    await user.click(await screen.findByRole('checkbox'));
    const group = await screen.findByRole('group', { name: 'Sign in to ntfy' });
    expect(within(group).getByText('Username')).toBeInTheDocument();
    expect(within(group).getByText('u_abc123')).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Copy username' })).toBeInTheDocument();
    expect(within(group).getByText('abcd-efgh-jkmn-pqrs')).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Copy password' })).toBeInTheDocument();
    expect(within(group).getByText('Shown once. Copy it now.')).toBeInTheDocument();
    // The reveal box (role=status) lives inside the group.
    expect(within(group).getByRole('status')).toHaveTextContent('Shown once. Copy it now.');

    // Username comes directly before the password in document order.
    const username = within(group).getByText('u_abc123');
    const password = within(group).getByText('abcd-efgh-jkmn-pqrs');
    expect(username.compareDocumentPosition(password) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // The sign-in block comes before the setup CTA.
    const cta = screen.getByRole('link', { name: 'Set up the ntfy app →' });
    expect(group.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps Username and the set-up text together in the same group in the set-up and confirm states', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
      }),
    );
    const user = userEvent.setup();
    renderModal();

    const group = await screen.findByRole('group', { name: 'Sign in to ntfy' });
    expect(within(group).getByText('u_abc123')).toBeInTheDocument();
    expect(within(group).getByText(/Your ntfy sign-in is set up/)).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Generate a new password' })).toBeInTheDocument();

    await user.click(within(group).getByRole('button', { name: 'Generate a new password' }));
    expect(within(group).getByText('u_abc123')).toBeInTheDocument();
    expect(within(group).getByText(/Phones using the current password will stop/)).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders "Set up the ntfy app →" as a new-tab link to setupUrl, styled as the primary action', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
      }),
    );
    renderModal();

    const link = await screen.findByRole('link', { name: 'Set up the ntfy app →' });
    expect(link).toHaveAttribute('href', PROVISIONED.setupUrl);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
    expect(link.className).toContain('bg-indigo-600');
    expect(
      screen.getByText('Step-by-step for iPhone and Android. It also shows your server and topic.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/with your details filled in/)).not.toBeInTheDocument();
    // Send test is now the neutral style so the setup link is the single primary action.
    expect(screen.getByRole('button', { name: 'Send test notification' }).className).not.toContain(
      'bg-indigo-600',
    );
  });

  it('no longer renders the old install steps or app-store links', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
      }),
    );
    renderModal();

    await screen.findByRole('link', { name: 'Set up the ntfy app →' });
    expect(screen.queryByText(/manual entry/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Install the/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Subscribe to topic/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /App Store/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Google Play/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /ntfy web/ })).not.toBeInTheDocument();
    expect(document.querySelector('ol')).toBeNull();
  });

  it('a guarded onChange no-ops while the checkbox is aria-disabled (DD-D)', async () => {
    const user = userEvent.setup();
    const fetchMock = makeFetchStub({
      'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
      'POST /api/notifications/enable': () => jsonResponse({ success: true, data: PROVISIONED }),
    });
    vi.stubGlobal('fetch', fetchMock);
    renderModal();

    const checkbox = await screen.findByRole('checkbox');
    await waitFor(() => expect(checkbox).toBeChecked());

    await user.click(checkbox);

    const enableCalls = fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/enable'));
    expect(enableCalls).toHaveLength(0);
    // status unchanged — still enabled.
    expect(screen.getByText('Push notifications enabled')).toBeInTheDocument();
  });

  it('clicking the enabled/locked toggle preventDefaults the native check-flip and never POSTs /enable', async () => {
    const user = userEvent.setup();
    const fetchMock = makeFetchStub({
      'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
      'POST /api/notifications/enable': () => jsonResponse({ success: true, data: PROVISIONED }),
    });
    vi.stubGlobal('fetch', fetchMock);
    renderModal();

    const checkbox = await screen.findByRole('checkbox');
    await waitFor(() => expect(checkbox).toBeChecked());

    // Capture the native click as it bubbles to document (after React's delegated
    // handler ran) to confirm the onClick handler cancelled the browser's native
    // check-toggle. We assert defaultPrevented rather than `.toBeChecked()` because
    // jsdom does not implement the checkbox activation-behaviour revert on a
    // cancelled click (its `.checked` reads false even when defaultPrevented is
    // true), whereas a real browser leaves the box checked — which is exactly what
    // preventDefault buys us here.
    let clickDefaultPrevented: boolean | null = null;
    const captureClick = (event: MouseEvent) => {
      if (event.target === checkbox) clickDefaultPrevented = event.defaultPrevented;
    };
    document.addEventListener('click', captureClick);
    try {
      await user.click(checkbox);
    } finally {
      document.removeEventListener('click', captureClick);
    }

    expect(clickDefaultPrevented).toBe(true);
    const enableCalls = fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/enable'));
    expect(enableCalls).toHaveLength(0);
    expect(screen.getByText('Push notifications enabled')).toBeInTheDocument();
  });

  it('shows the transient aria-disabled toggle + "Setting up…" while /enable is in flight (DD-F)', async () => {
    const user = userEvent.setup();
    let resolveEnable!: (r: Response) => void;
    const pending = new Promise<Response>((r) => (resolveEnable = r));
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: NOT_PROVISIONED }),
        'POST /api/notifications/enable': () => pending,
      }),
    );
    renderModal();

    const checkbox = await screen.findByRole('checkbox');
    await user.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(checkbox).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Setting up your notifications…');

    await act(async () => {
      resolveEnable(new Response(JSON.stringify({ success: true, data: PROVISIONED })));
    });

    expect((await screen.findAllByText('chores4irl-abc123-all')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Setting up your notifications…')).not.toBeInTheDocument();
  });

  it('enable failure surfaces the red error and reverts the toggle to unchecked + interactive (DD-21)', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: NOT_PROVISIONED }),
        'POST /api/notifications/enable': () =>
          jsonResponse({ success: false, error: 'Could not set up notifications' }),
      }),
    );
    renderModal();

    const checkbox = await screen.findByRole('checkbox');
    await user.click(checkbox);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not set up notifications');
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toHaveAttribute('aria-disabled', 'false');
  });

  it('Send test notification shows the green confirmation on success', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
        'POST /api/notifications/test': () => jsonResponse({ success: true, data: null }),
      }),
    );
    renderModal();

    await user.click(await screen.findByRole('button', { name: 'Send test notification' }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Test notification sent — check your phone.');
    expect(status.className).toContain('text-green-400');
  });

  it('Send test notification shows the red error on failure', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
        'POST /api/notifications/test': () =>
          jsonResponse({ success: false, error: 'Could not send test notification' }),
      }),
    );
    renderModal();

    await user.click(await screen.findByRole('button', { name: 'Send test notification' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not send test notification');
    expect(alert.className).toContain('text-red-400');
  });

  it('clears a stale test message synchronously before the next request resolves (DD-7)', async () => {
    const user = userEvent.setup();
    let testCall = 0;
    let resolveSecond!: (r: Response) => void;
    const secondPending = new Promise<Response>((r) => (resolveSecond = r));
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
        'POST /api/notifications/test': () => {
          testCall += 1;
          if (testCall === 1) return jsonResponse({ success: true, data: null });
          return secondPending;
        },
      }),
    );
    renderModal();

    const sendButton = await screen.findByRole('button', { name: 'Send test notification' });
    await user.click(sendButton);
    expect(await screen.findByText('Test notification sent — check your phone.')).toBeInTheDocument();

    // Second click: the stale success message must be gone immediately, while the
    // second request is still pending.
    await user.click(sendButton);
    expect(screen.queryByText('Test notification sent — check your phone.')).not.toBeInTheDocument();

    await act(async () => {
      resolveSecond(
        new Response(JSON.stringify({ success: false, error: 'Could not send test notification' })),
      );
    });
    expect(await screen.findByText('Could not send test notification')).toBeInTheDocument();
  });

  it('disables both Send test and Disable while an action is in flight (DD-6)', async () => {
    const user = userEvent.setup();
    let resolveTest!: (r: Response) => void;
    const pending = new Promise<Response>((r) => (resolveTest = r));
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
        'POST /api/notifications/test': () => pending,
      }),
    );
    renderModal();

    const sendButton = await screen.findByRole('button', { name: 'Send test notification' });
    const disableButton = screen.getByRole('button', { name: 'Disable' });
    await user.click(sendButton);

    expect(sendButton).toBeDisabled();
    expect(disableButton).toBeDisabled();

    await act(async () => {
      resolveTest(new Response(JSON.stringify({ success: true, data: null })));
    });

    await waitFor(() => expect(sendButton).not.toBeDisabled());
    expect(disableButton).not.toBeDisabled();
  });

  it('Disable collapses to the off state from the response and returns focus to the toggle (DD-22/DD-C)', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
        'POST /api/notifications/disable': () =>
          jsonResponse({ success: true, data: { provisioned: true, enabled: false } }),
      }),
    );
    renderModal();

    await user.click(await screen.findByRole('button', { name: 'Disable' }));

    expect(await screen.findByText('Enable push notifications')).toBeInTheDocument();
    expect(screen.queryByText('chores4irl-abc123-all')).not.toBeInTheDocument();
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    await waitFor(() => expect(checkbox).toHaveFocus());
  });

  it('enable fetch rejection surfaces the fallback error and reverts the toggle (catch branch)', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: NOT_PROVISIONED }),
        'POST /api/notifications/enable': () => Promise.reject(new Error('network down')),
      }),
    );
    renderModal();

    const checkbox = await screen.findByRole('checkbox');
    await user.click(checkbox);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not set up notifications');
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toHaveAttribute('aria-disabled', 'false');
  });

  it('Send test fetch rejection surfaces the red fallback error (catch branch)', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
        'POST /api/notifications/test': () => Promise.reject(new Error('network down')),
      }),
    );
    renderModal();

    await user.click(await screen.findByRole('button', { name: 'Send test notification' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not send test notification');
    expect(alert.className).toContain('text-red-400');
  });

  it('Disable fetch rejection surfaces the fallback error and stays enabled (catch branch)', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
        'POST /api/notifications/disable': () => Promise.reject(new Error('network down')),
      }),
    );
    renderModal();

    await user.click(await screen.findByRole('button', { name: 'Disable' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not disable notifications');
    expect(screen.getByText('Push notifications enabled')).toBeInTheDocument();
  });

  it.each([
    ['Copy username', 'u_abc123'],
    ['Copy topic', 'chores4irl-abc123-all'],
    ['Copy token', 'tk_test_abc123'],
  ])('%s writes its own value to the clipboard', async (label, value) => {
    const user = userEvent.setup();
    const writeText = vi.fn(() => Promise.resolve());
    // userEvent.setup() installs its own clipboard stub; override after setup.
    stubClipboard(writeText);
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
      }),
    );
    renderModal();

    await user.click(await screen.findByRole('button', { name: label }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(value));
    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it('Copy topic flips only that button to "Copied!" and reverts after ~2s (DD-23)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    stubClipboard(() => Promise.resolve());
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
      }),
    );
    renderModal();

    await user.click(await screen.findByRole('button', { name: 'Copy topic' }));

    // Exactly one "Copied!" — the other copy buttons keep their labels.
    expect(await screen.findAllByRole('button', { name: 'Copied!' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Copy username' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy token' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy topic' })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(await screen.findByRole('button', { name: 'Copy topic' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copied!' })).not.toBeInTheDocument();
  });

  it('copying a second field moves "Copied!" to it and clears the first', async () => {
    const user = userEvent.setup();
    stubClipboard(() => Promise.resolve());
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
      }),
    );
    renderModal();

    await user.click(await screen.findByRole('button', { name: 'Copy username' }));
    expect(await screen.findAllByRole('button', { name: 'Copied!' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Copy username' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Copy token' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy username' })).toBeInTheDocument());
    expect(screen.getAllByRole('button', { name: 'Copied!' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Copy token' })).not.toBeInTheDocument();
  });

  it("a denied clipboard shows only that field's alert and does not claim success (DD-E)", async () => {
    const user = userEvent.setup();
    stubClipboard(() => Promise.reject(new Error('denied')));
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
      }),
    );
    renderModal();

    await user.click(await screen.findByRole('button', { name: 'Copy topic' }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent('Couldn’t copy — select the topic above.');
    expect(screen.queryByRole('button', { name: 'Copied!' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy topic' })).toBeInTheDocument();
  });

  it("a new copy attempt clears the previous field's failure alert", async () => {
    const user = userEvent.setup();
    let attempt = 0;
    stubClipboard(() => {
      attempt += 1;
      return attempt === 1 ? Promise.reject(new Error('denied')) : Promise.resolve();
    });
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
      }),
    );
    renderModal();

    await user.click(await screen.findByRole('button', { name: 'Copy username' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('select the username above.');

    await user.click(screen.getByRole('button', { name: 'Copy token' }));
    await screen.findByRole('button', { name: 'Copied!' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

const PASSWORD = 'k7mq-2xfp-9wnr-h3tc';
const NEW_PASSWORD = 'm4tz-8kqe-v2pa-5hyw';
const SETUP_TEXT =
  "Your ntfy sign-in is set up and works for every 4IRL app. Your phone stays signed in, so you won't need the password again.";
const CONFIRM_TEXT =
  'Phones using the current password will stop getting notifications until they sign in with the new one.';
const WHY_TEXT =
  "The ntfy app needs a sign-in to deliver your notifications, so we created one for you. It's not a personal account, just the link between ntfy and your 4IRL apps.";

describe('SettingsModal — one-time password and generate new', () => {
  it('an enable response with a password shows the reveal box, the exact copy and focus on Copy password', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: NOT_PROVISIONED }),
        'POST /api/notifications/enable': () =>
          jsonResponse({ success: true, data: { ...PROVISIONED, password: PASSWORD } }),
      }),
    );
    renderModal();

    await user.click(await screen.findByRole('checkbox'));

    const reveal = await screen.findByRole('status');
    expect(reveal).toHaveTextContent('Your ntfy password');
    expect(reveal).toHaveTextContent(PASSWORD);
    expect(reveal).toHaveTextContent(WHY_TEXT);
    expect(reveal).toHaveTextContent('You only enter it once. Your phone stays signed in.');
    expect(reveal).toHaveTextContent('Shown once. Copy it now.');
    expect(reveal).not.toHaveTextContent('Sign in again on each phone');
    expect(screen.getByText(PASSWORD).className).toContain('font-mono');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy password' })).toHaveFocus());
    expect(screen.queryByText(SETUP_TEXT)).not.toBeInTheDocument();
  });

  it('the one-time password is held only by the reveal box: exactly one occurrence in the whole DOM', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: NOT_PROVISIONED }),
        'POST /api/notifications/enable': () =>
          jsonResponse({ success: true, data: { ...PROVISIONED, password: PASSWORD } }),
      }),
    );
    renderModal();

    await user.click(await screen.findByRole('checkbox'));

    const reveal = await screen.findByRole('status');
    expect(within(reveal).getAllByText(PASSWORD)).toHaveLength(1);
    expect(screen.getAllByText(PASSWORD)).toHaveLength(1);
    // Markup, not just text: no attribute (QR value, link href, title) may carry it either.
    const occurrences = document.body.innerHTML.split(PASSWORD).length - 1;
    expect(occurrences).toBe(1);
    // The status-driven panels render the rest of the response but not the password.
    const meta = screen.getByTestId('ntfy-meta-card');
    expect(meta.innerHTML).not.toContain(PASSWORD);
    expect(screen.getByTestId('qr-code').getAttribute('data-qr-value')).not.toContain(PASSWORD);
    expect(screen.getByRole('link', { name: 'Set up the ntfy app →' }).getAttribute('href')).not.toContain(
      PASSWORD,
    );
  });

  it('an enable response without a password shows the set-up state, not the reveal', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: NOT_PROVISIONED }),
        'POST /api/notifications/enable': () => jsonResponse({ success: true, data: PROVISIONED }),
      }),
    );
    renderModal();

    await user.click(await screen.findByRole('checkbox'));

    expect(await screen.findByText(SETUP_TEXT)).toBeInTheDocument();
    expect(screen.getByText('Only for a new phone or a lost password.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate a new password' })).toBeInTheDocument();
    expect(screen.queryByText('Your ntfy password')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy password' })).not.toBeInTheDocument();
  });

  it('Copy password writes the password to the clipboard', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: NOT_PROVISIONED }),
        'POST /api/notifications/enable': () =>
          jsonResponse({ success: true, data: { ...PROVISIONED, password: PASSWORD } }),
      }),
    );
    renderModal();

    await user.click(await screen.findByRole('checkbox'));
    await user.click(await screen.findByRole('button', { name: 'Copy password' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(PASSWORD));
    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument();
    // Only the password button flips; the other copy buttons keep their labels.
    expect(screen.getByRole('button', { name: 'Copy username' })).toBeInTheDocument();
  });

  it('a fresh mount (reopening Settings) never shows a password', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
      }),
    );
    renderModal();

    expect(await screen.findByText(SETUP_TEXT)).toBeInTheDocument();
    expect(screen.queryByText('Your ntfy password')).not.toBeInTheDocument();
    expect(screen.queryByText(PASSWORD)).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('the confirm flow focuses Cancel, Cancel restores focus, and generating shows the new password', async () => {
    const user = userEvent.setup();
    let resolveReset!: (r: Response) => void;
    const pending = new Promise<Response>((r) => (resolveReset = r));
    let resetInit: RequestInit | undefined;
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
        'POST /api/notifications/reset-password': (init) => {
          resetInit = init;
          return pending;
        },
      }),
    );
    renderModal();

    const link = await screen.findByRole('button', { name: 'Generate a new password' });
    await user.click(link);

    const confirm = screen.getByRole('status');
    expect(confirm).toHaveTextContent(CONFIRM_TEXT);
    expect(screen.queryByText(SETUP_TEXT)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus());

    // Cancel returns to the set-up state with focus back on the link.
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText(SETUP_TEXT)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Generate a new password' })).toHaveFocus(),
    );

    // Open again and confirm.
    await user.click(screen.getByRole('button', { name: 'Generate a new password' }));
    await user.click(screen.getByRole('button', { name: 'Generate new password' }));

    // Pending: the confirm button reads Generating… and everything else is disabled.
    expect(resetInit?.method).toBe('POST');
    expect(resetInit?.body).toBeUndefined();
    expect(screen.getByRole('button', { name: 'Generating…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send test notification' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Disable' })).toBeDisabled();

    await act(async () => {
      resolveReset(new Response(JSON.stringify({ success: true, data: { password: NEW_PASSWORD } })));
    });

    const reveal = await screen.findByRole('status');
    expect(reveal).toHaveTextContent(NEW_PASSWORD);
    expect(reveal).toHaveTextContent('Sign in again on each phone with this new password.');
    expect(reveal).toHaveTextContent(WHY_TEXT);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy password' })).toHaveFocus());
    expect(screen.queryByText(CONFIRM_TEXT)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send test notification' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Disable' })).not.toBeDisabled();
  });

  it('disables Generate while a Send test is in flight', async () => {
    const user = userEvent.setup();
    let resolveTest!: (r: Response) => void;
    const pending = new Promise<Response>((r) => (resolveTest = r));
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
        'POST /api/notifications/test': () => pending,
      }),
    );
    renderModal();

    await user.click(await screen.findByRole('button', { name: 'Send test notification' }));
    expect(screen.getByRole('button', { name: 'Generate a new password' })).toBeDisabled();

    await act(async () => {
      resolveTest(new Response(JSON.stringify({ success: true, data: null })));
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Generate a new password' })).not.toBeDisabled(),
    );
  });

  it('disables the open confirm\'s "Generate new password" button while a Send test is in flight', async () => {
    const user = userEvent.setup();
    let resolveTest!: (r: Response) => void;
    const pending = new Promise<Response>((r) => (resolveTest = r));
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
        'POST /api/notifications/test': () => pending,
      }),
    );
    renderModal();

    await user.click(await screen.findByRole('button', { name: 'Generate a new password' }));
    const confirmButton = screen.getByRole('button', { name: 'Generate new password' });
    expect(confirmButton).not.toBeDisabled();

    // Send test stays clickable with the confirm open; its in-flight request sets actionPending.
    await user.click(screen.getByRole('button', { name: 'Send test notification' }));
    expect(screen.getByText(CONFIRM_TEXT)).toBeInTheDocument();
    expect(confirmButton).toBeDisabled();
    // Only actionPending is set here (no reset in flight), so Cancel is still usable.
    expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeDisabled();

    await act(async () => {
      resolveTest(new Response(JSON.stringify({ success: true, data: null })));
    });
    await waitFor(() => expect(confirmButton).not.toBeDisabled());
  });

  it.each([
    ['429 rate limit', 'Too many new passwords. Try again in an hour.'],
    ['502 service failure', 'Could not generate a new password'],
  ])(
    'a %s body closes the confirm back to the set-up state and renders the error there',
    async (_label, error) => {
      const user = userEvent.setup();
      vi.stubGlobal(
        'fetch',
        makeFetchStub({
          'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
          'POST /api/notifications/reset-password': () => jsonResponse({ success: false, error }),
        }),
      );
      renderModal();

      await user.click(await screen.findByRole('button', { name: 'Generate a new password' }));
      await user.click(screen.getByRole('button', { name: 'Generate new password' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(error);
      expect(screen.getByText(SETUP_TEXT)).toBeInTheDocument();
      expect(screen.queryByText(CONFIRM_TEXT)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Generate a new password' })).toHaveFocus(),
      );
      expect(screen.getByRole('button', { name: 'Send test notification' })).not.toBeDisabled();
    },
  );

  it('a rejected reset fetch closes the confirm and renders the fallback error', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
        'POST /api/notifications/reset-password': () => Promise.reject(new Error('network down')),
      }),
    );
    renderModal();

    await user.click(await screen.findByRole('button', { name: 'Generate a new password' }));
    await user.click(screen.getByRole('button', { name: 'Generate new password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not generate a new password. Try again.',
    );
    expect(screen.getByText(SETUP_TEXT)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Generate a new password' })).toHaveFocus(),
    );
  });

  it('a new Generate attempt clears the previous error synchronously', async () => {
    const user = userEvent.setup();
    let attempt = 0;
    let resolveSecond!: (r: Response) => void;
    const secondPending = new Promise<Response>((r) => (resolveSecond = r));
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
        'POST /api/notifications/reset-password': () => {
          attempt += 1;
          if (attempt === 1)
            return jsonResponse({ success: false, error: 'Too many new passwords. Try again in an hour.' });
          return secondPending;
        },
      }),
    );
    renderModal();

    await user.click(await screen.findByRole('button', { name: 'Generate a new password' }));
    await user.click(screen.getByRole('button', { name: 'Generate new password' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Generate a new password' }));
    await user.click(screen.getByRole('button', { name: 'Generate new password' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await act(async () => {
      resolveSecond(new Response(JSON.stringify({ success: true, data: { password: NEW_PASSWORD } })));
    });
    expect(await screen.findByText(NEW_PASSWORD)).toBeInTheDocument();
  });

  it('Disable clears a shown password, and a re-enable without one shows the set-up state', async () => {
    const user = userEvent.setup();
    let enableCall = 0;
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: NOT_PROVISIONED }),
        'POST /api/notifications/enable': () => {
          enableCall += 1;
          return jsonResponse({
            success: true,
            data: enableCall === 1 ? { ...PROVISIONED, password: PASSWORD } : PROVISIONED,
          });
        },
        'POST /api/notifications/disable': () =>
          jsonResponse({ success: true, data: { provisioned: true, enabled: false } }),
      }),
    );
    renderModal();

    await user.click(await screen.findByRole('checkbox'));
    expect(await screen.findByText(PASSWORD)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Disable' }));
    expect(await screen.findByText('Enable push notifications')).toBeInTheDocument();
    expect(screen.queryByText(PASSWORD)).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox'));
    expect(await screen.findByText(SETUP_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(PASSWORD)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy password' })).not.toBeInTheDocument();
  });

  it('a Disable while the confirm is open leaves no stale confirm box or error on the next re-enable', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
        'POST /api/notifications/disable': () =>
          jsonResponse({ success: true, data: { provisioned: true, enabled: false } }),
        'POST /api/notifications/enable': () => jsonResponse({ success: true, data: PROVISIONED }),
      }),
    );
    renderModal();

    await user.click(await screen.findByRole('button', { name: 'Generate a new password' }));
    expect(screen.getByText(CONFIRM_TEXT)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Disable' }));
    expect(await screen.findByText('Enable push notifications')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox'));
    expect(await screen.findByText(SETUP_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(CONFIRM_TEXT)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('a Disable after a failed reset leaves no stale error on the next re-enable', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
        'POST /api/notifications/reset-password': () =>
          jsonResponse({ success: false, error: 'Too many new passwords. Try again in an hour.' }),
        'POST /api/notifications/disable': () =>
          jsonResponse({ success: true, data: { provisioned: true, enabled: false } }),
        'POST /api/notifications/enable': () => jsonResponse({ success: true, data: PROVISIONED }),
      }),
    );
    renderModal();

    await user.click(await screen.findByRole('button', { name: 'Generate a new password' }));
    await user.click(screen.getByRole('button', { name: 'Generate new password' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Disable' }));
    expect(await screen.findByText('Enable push notifications')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox'));

    expect(await screen.findByText(SETUP_TEXT)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('copying a field, then Disable, then re-enable shows the new password Copy button in its default state', async () => {
    const user = userEvent.setup();
    stubClipboard(() => Promise.resolve());
    let enableCall = 0;
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: NOT_PROVISIONED }),
        'POST /api/notifications/enable': () => {
          enableCall += 1;
          return jsonResponse({
            success: true,
            data: { ...PROVISIONED, password: enableCall === 1 ? PASSWORD : NEW_PASSWORD },
          });
        },
        'POST /api/notifications/disable': () =>
          jsonResponse({ success: true, data: { provisioned: true, enabled: false } }),
      }),
    );
    renderModal();

    await user.click(await screen.findByRole('checkbox'));
    await user.click(await screen.findByRole('button', { name: 'Copy password' }));
    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Disable' }));
    expect(await screen.findByText('Enable push notifications')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox'));

    expect(await screen.findByText(NEW_PASSWORD)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy password' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copied!' })).not.toBeInTheDocument();
  });

  it("a failed copy after a successful one clears the first field's Copied! state and its revert timer", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    let attempt = 0;
    stubClipboard(() => {
      attempt += 1;
      return attempt === 1 ? Promise.resolve() : Promise.reject(new Error('denied'));
    });
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
      }),
    );
    renderModal();

    await user.click(await screen.findByRole('button', { name: 'Copy username' }));
    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument();
    // The 2s revert timer for the username is pending.
    expect(vi.getTimerCount()).toBe(1);

    // Well inside the 2s window, copy a different field with a rejecting clipboard.
    await user.click(screen.getByRole('button', { name: 'Copy token' }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent('Couldn’t copy — select the token above.');
    expect(screen.queryByRole('button', { name: 'Copied!' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy username' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy token' })).toBeInTheDocument();
    // handleCopy's catch cleared the first copy's revert timer rather than leaving it to fire.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a denied clipboard on the password shows the password-specific alert', async () => {
    const user = userEvent.setup();
    stubClipboard(() => Promise.reject(new Error('denied')));
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: NOT_PROVISIONED }),
        'POST /api/notifications/enable': () =>
          jsonResponse({ success: true, data: { ...PROVISIONED, password: PASSWORD } }),
      }),
    );
    renderModal();

    await user.click(await screen.findByRole('checkbox'));
    await user.click(await screen.findByRole('button', { name: 'Copy password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t copy — select the password above.');
    expect(screen.queryByRole('button', { name: 'Copied!' })).not.toBeInTheDocument();
  });

  // The isMountedRef guard's unmount branch (skip set* after the modal closed) is not
  // observable: React 19 silently drops a setState on an unmounted component (no
  // warning, no DOM), so an "unmount, then resolve" test would pass with or without
  // the guard and has been deliberately omitted. What IS observable is the guard's
  // other half: StrictMode runs mount -> cleanup -> mount, and the effect must flip
  // the ref back to true, or every post-response set* would be suppressed on a
  // still-mounted modal and the new password would never appear.
  it('the mount guard does not suppress a reset response on a still-mounted modal under StrictMode', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
        'POST /api/notifications/reset-password': () =>
          jsonResponse({ success: true, data: { password: NEW_PASSWORD } }),
      }),
    );
    render(
      <StrictMode>
        <SettingsModal swipeStyle="ios" onSwipeStyleChange={vi.fn()} onCancel={vi.fn()} />
      </StrictMode>,
    );

    await user.click(await screen.findByRole('button', { name: 'Generate a new password' }));
    await user.click(screen.getByRole('button', { name: 'Generate new password' }));

    expect(await screen.findByText(NEW_PASSWORD)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generating…' })).not.toBeInTheDocument();
  });
});
