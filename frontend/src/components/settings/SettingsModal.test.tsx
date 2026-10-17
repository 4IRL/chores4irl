import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
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

  it('encodes the composed `${server}/${topic}` subscribe URL into the QR code', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
      }),
    );
    renderModal();

    // subscribeUrl = `${status.server}/${status.topic}` — assert the exact string
    // (origin + single '/' + topic, in that order) that QRCodeSVG receives, so a
    // wrong separator/order/missing-origin regression is caught.
    const qr = await screen.findByTestId('qr-code');
    expect(qr).toHaveAttribute('data-qr-value', 'https://notifs.4irl.app/chores4irl-abc123-all');
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

  it('Copy token flips to "Copied!" and reverts after ~2s (DD-23)', async () => {
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

    const copyButton = await screen.findByRole('button', { name: 'Copy token' });
    await user.click(copyButton);

    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(await screen.findByRole('button', { name: 'Copy token' })).toBeInTheDocument();
  });

  it('Copy token surfaces an inline failure note and does not claim success when clipboard write rejects (DD-E)', async () => {
    const user = userEvent.setup();
    stubClipboard(() => Promise.reject(new Error('denied')));
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        'GET /api/notifications': () => jsonResponse({ success: true, data: PROVISIONED }),
      }),
    );
    renderModal();

    const copyButton = await screen.findByRole('button', { name: 'Copy token' });
    await user.click(copyButton);

    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t copy — select the token above.');
    expect(screen.queryByRole('button', { name: 'Copied!' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy token' })).toBeInTheDocument();
  });
});
