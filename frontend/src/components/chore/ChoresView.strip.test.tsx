import type { ComponentProps } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChoresView from './ChoresView';
import { writeChoresCache, clearChoresCache } from '../../cache/choresCache';

vi.mock('@utils/deviceTimezone', () => ({
  getDeviceTimezone: vi.fn(() => 'UTC'),
}));

const mockRooms = [
  { id: 1, householdId: 1, name: 'Living Room' },
  { id: 2, householdId: 1, name: 'Kitchen' },
];

// At 2026-07-01 both are overdue (red).
const mockChores = [
  {
    id: 1,
    name: 'Vacuum',
    roomId: 1,
    dateLastCompleted: '2026-06-01T00:00:00.000Z',
    duration: 20,
    frequency: 7,
    version: 1,
  },
  {
    id: 2,
    name: 'Dishes',
    roomId: 2,
    dateLastCompleted: '2026-06-20T00:00:00.000Z',
    duration: 5,
    frequency: 1,
    version: 1,
  },
];

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  );
}

function stubFetch(handler?: (url: string, method: string) => Promise<Response> | undefined) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';
      const custom = handler?.(url, method);
      if (custom) return custom;
      if (url === '/api/chores' && method === 'GET') {
        return jsonResponse({ success: true, data: mockChores });
      }
      throw new Error(`Unhandled fetch: ${method} ${url}`);
    }),
  );
}

function stubCoarsePointer() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === '(pointer: coarse)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function renderView(props: Partial<ComponentProps<typeof ChoresView>> = {}) {
  return render(
    <ChoresView
      householdTimezone="UTC"
      rooms={mockRooms}
      swipeStyle="ios"
      onSwipeStyleChange={vi.fn()}
      {...props}
    />,
  );
}

function strip() {
  return screen.getByTestId('status-count-strip');
}

function label() {
  return within(strip()).getByRole('img').getAttribute('aria-label');
}

afterEach(async () => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  await clearChoresCache();
});

describe('ChoresView status count strip', () => {
  it('is absent before the first list is applied, then shows the counts', async () => {
    let resolveList: (res: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveList = resolve;
    });
    stubFetch((url) => (url === '/api/chores' ? pending : undefined));
    renderView();
    expect(screen.queryByTestId('status-count-strip')).not.toBeInTheDocument();
    resolveList(await jsonResponse({ success: true, data: mockChores }));
    await waitFor(() => expect(screen.getByTestId('status-count-strip')).toBeInTheDocument());
    expect(label()).toBe('0 done today · 0 due soon · 2 overdue');
  });

  it('follows the room and the search, and restores when cleared', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-07-01T12:00:00.000Z'));
    stubFetch();
    renderView({ selectedRoom: '1' });
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    expect(label()).toBe('0 done today · 0 due soon · 1 overdue');
    cleanup();

    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    expect(label()).toBe('0 done today · 0 due soon · 2 overdue');
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.type(screen.getByLabelText('Search chores'), 'vac');
    expect(label()).toBe('0 done today · 0 due soon · 1 overdue');
    await user.clear(screen.getByLabelText('Search chores'));
    expect(label()).toBe('0 done today · 0 due soon · 2 overdue');
  });

  it('moves a due-soon chore to overdue when the clock passes household midnight', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-07-01T23:59:30.000Z'));
    stubFetch((url) =>
      url === '/api/chores'
        ? jsonResponse({
            success: true,
            data: [
              {
                id: 3,
                name: 'Mop',
                roomId: 1,
                dateLastCompleted: '2026-06-29T00:00:00.000Z',
                duration: 15,
                frequency: 2,
                version: 1,
              },
            ],
          })
        : undefined,
    );
    renderView();
    await waitFor(() => expect(screen.getByText('Mop')).toBeInTheDocument());
    expect(label()).toBe('0 done today · 1 due soon · 0 overdue');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    await waitFor(() => expect(label()).toBe('0 done today · 0 due soon · 1 overdue'));
  });

  it('shows the green 0 strip with no search match', async () => {
    stubFetch();
    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText('Search chores'), 'zzz');
    expect(label()).toBe('0 done today · 0 due soon · 0 overdue');
    expect(screen.getByTestId('status-count-segment-empty')).toHaveTextContent('0');
  });

  it('counts an optimistic complete at once and reverts on rollback', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-07-01T12:00:00.000Z'));
    let resolveComplete: (res: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveComplete = resolve;
    });
    stubFetch((url) => (url === '/api/chores/2/complete' ? pending : undefined));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderView();
    await waitFor(() => expect(screen.getByText('Dishes')).toBeInTheDocument());
    expect(label()).toBe('0 done today · 0 due soon · 2 overdue');

    await user.click(screen.getByText('Dishes').closest('[data-testid="chore-bar"]') as HTMLElement);
    await waitFor(() => expect(label()).toBe('1 done today · 0 due soon · 1 overdue'));

    resolveComplete(await jsonResponse({ success: false, error: 'nope' }, 500));
    await waitFor(() => expect(label()).toBe('0 done today · 0 due soon · 2 overdue'));
  });

  it('sits after the focus target and before the StatusBanner and the search box', async () => {
    await writeChoresCache(mockChores);
    stubFetch((url) => (url === '/api/chores' ? jsonResponse({ success: false }, 401) : undefined));
    renderView();
    const banner = await screen.findByTestId('status-banner');
    const root = strip().parentElement as HTMLElement;
    const children = Array.from(root.children);
    expect(children.indexOf(screen.getByTestId('focus-target'))).toBeLessThan(children.indexOf(strip()));
    expect(children.indexOf(strip())).toBeLessThan(children.indexOf(banner));
    expect(
      strip().compareDocumentPosition(screen.getByLabelText('Search chores')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('is absent in the cannot-load state', async () => {
    await writeChoresCache([]);
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network down'))),
    );
    renderView();
    await waitFor(() => expect(screen.getByTestId('chores-unavailable')).toBeInTheDocument());
    expect(screen.queryByTestId('status-count-strip')).not.toBeInTheDocument();
  });

  it('is shown from a stale cache copy when the cache has chores', async () => {
    await writeChoresCache(mockChores);
    stubFetch((url) => (url === '/api/chores' ? jsonResponse({ success: false }, 401) : undefined));
    renderView();
    await screen.findByTestId('status-banner');
    expect(label()).toBe('0 done today · 0 due soon · 2 overdue');
  });

  it('is absent after a 403 clear, and returns after a later successful load', async () => {
    await writeChoresCache(mockChores);
    const onHouseholdRevoked = vi.fn();
    let revoked = true;
    stubFetch((url) =>
      url === '/api/chores' && revoked
        ? jsonResponse({ success: false, error: 'Not a member' }, 403)
        : undefined,
    );
    const view = renderView({ onHouseholdRevoked });
    await waitFor(() => expect(onHouseholdRevoked).toHaveBeenCalled());
    expect(screen.queryByTestId('status-count-strip')).not.toBeInTheDocument();

    revoked = false;
    view.unmount();
    renderView({ onHouseholdRevoked });
    await waitFor(() => expect(screen.getByTestId('status-count-strip')).toBeInTheDocument());
    expect(screen.getByText('Vacuum')).toBeInTheDocument();
  });

  it('stays rendered while the search is focused on a touch device (the deck hides)', async () => {
    stubCoarsePointer();
    stubFetch();
    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    act(() => screen.getByLabelText('Search chores').focus());
    expect(screen.getByTestId('add-chore-deck')).toHaveClass('invisible');
    expect(strip()).toBeInTheDocument();
  });

  it('gives non-zero segments the inline flex and min-width, and zero segments none', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-07-01T12:00:00.000Z'));
    stubFetch();
    renderView();
    await waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    const overdue = screen.getByTestId('status-count-segment-overdue');
    expect(overdue.style.flex).toBe('2 1 0%');
    expect(overdue).toHaveClass('min-w-6');
    const done = screen.getByTestId('status-count-segment-done');
    expect(done.style.flex).toBe('0 1 0%');
    expect(done).not.toHaveClass('min-w-6');
    expect(done).toBeEmptyDOMElement();
  });
});
