import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { useMidnightClock } from './hooks/useMidnightClock';
import { setCurrentHouseholdId } from './utils/api';

vi.mock('./hooks/useMidnightClock', () => ({
  useMidnightClock: vi.fn(() => new Date('2026-07-01T00:00:00.000Z')),
}));

function jsonResponse(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }),
  );
}

function unauthorizedResponse() {
  return Promise.resolve(
    new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

function forbiddenResponse() {
  return Promise.resolve(
    new Response(JSON.stringify({ success: false, error: 'Not a member of this household' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

const ME_CACHE_KEY = 'me-cache-v1';
const ROOMS_CACHE_KEY = 'rooms-cache-v1';
const CURRENT_HOUSEHOLD_ID_KEY = 'current-household-id-v1';

const meResponse = {
  id: 1,
  email: 'a@example.com',
  timezone: 'Asia/Tokyo',
  isAdmin: false,
  memberships: [
    {
      householdId: 1,
      householdName: 'Household A',
      householdTimezone: 'America/New_York',
    },
  ],
  currentHouseholdId: 1,
};

const roomsResponse = {
  success: true,
  data: [
    { id: 1, householdId: 1, name: 'Living Room' },
    { id: 2, householdId: 1, name: 'Kitchen' },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  setCurrentHouseholdId(null);
  // Some tests navigate directly via the History API — reset the URL so
  // that state never leaks into the next test.
  window.history.pushState({}, '', '/');
  cleanup();
});

describe('App', () => {
  it("passes the household's timezone — not the viewing user's personal timezone — into useMidnightClock", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === '/api/me') return jsonResponse(meResponse);
        if (url === '/api/chores') {
          return jsonResponse({ success: true, data: [] });
        }
        if (url === '/api/rooms') {
          return jsonResponse(roomsResponse);
        }
        throw new Error(`Unhandled fetch: ${url}`);
      }),
    );

    render(<App />);

    await vi.waitFor(() => expect(vi.mocked(useMidnightClock)).toHaveBeenCalled());
    expect(useMidnightClock).toHaveBeenCalledWith('America/New_York');
    expect(useMidnightClock).not.toHaveBeenCalledWith('Asia/Tokyo');
  });

  it('falls back to the last-cached /api/me response when a later fetch fails (e.g. offline reload)', async () => {
    vi.mocked(useMidnightClock).mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === '/api/me') return jsonResponse(meResponse);
        if (url === '/api/chores') return jsonResponse({ success: true, data: [] });
        if (url === '/api/rooms') return jsonResponse(roomsResponse);
        throw new Error(`Unhandled fetch: ${url}`);
      }),
    );
    const { unmount } = render(<App />);
    await vi.waitFor(() => expect(vi.mocked(useMidnightClock)).toHaveBeenCalledWith('America/New_York'));
    unmount();
    vi.mocked(useMidnightClock).mockClear();

    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );

    render(<App />);

    await vi.waitFor(() => expect(vi.mocked(useMidnightClock)).toHaveBeenCalledWith('America/New_York'));
  });

  it('renders a tab per distinct chore room and filters chores when a tab is selected', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === '/api/me') return jsonResponse(meResponse);
        if (url === '/api/chores') {
          return jsonResponse({
            success: true,
            data: [
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
            ],
          });
        }
        if (url === '/api/rooms') return jsonResponse(roomsResponse);
        throw new Error(`Unhandled fetch: ${url}`);
      }),
    );

    render(<App />);

    await vi.waitFor(() => expect(screen.getByText('Vacuum')).toBeInTheDocument());
    expect(screen.getByText('Dishes')).toBeInTheDocument();

    const kitchenTab = await screen.findByRole('button', { name: 'Kitchen' });
    expect(screen.getByRole('button', { name: 'Living Room' })).toBeInTheDocument();

    await user.click(kitchenTab);

    expect(screen.getByText('Dishes')).toBeInTheDocument();
    expect(screen.queryByText('Vacuum')).not.toBeInTheDocument();
  });

  it('keeps the chore search query across a room-tab switch and an /admin round trip', async () => {
    const user = userEvent.setup();
    const adminMeResponse = { ...meResponse, isAdmin: true };
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === '/api/me') return jsonResponse(adminMeResponse);
        if (url === '/api/chores') {
          return jsonResponse({
            success: true,
            data: [
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
            ],
          });
        }
        if (url === '/api/members') return jsonResponse({ success: true, data: [] });
        if (url === '/api/admin/users') return jsonResponse({ success: true, data: [] });
        if (url === '/api/admin/join-requests') return jsonResponse({ success: true, data: [] });
        if (url === '/api/admin/households') return jsonResponse({ success: true, data: [] });
        if (url === '/api/rooms') return jsonResponse(roomsResponse);
        throw new Error(`Unhandled fetch: ${url}`);
      }),
    );

    render(<App />);

    await screen.findByText('Vacuum');
    await user.type(screen.getByLabelText('Search chores'), 'vac');
    expect(screen.queryByText('Dishes')).not.toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Living Room' }));
    expect(screen.getByLabelText('Search chores')).toHaveValue('vac');

    await user.click(screen.getByTestId('admin-nav-link'));
    await screen.findByRole('heading', { name: 'Members' });
    // The scroll-to-top button belongs to ChoresView only, never /admin.
    expect(screen.queryByLabelText('Scroll to top')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All' }));

    expect(await screen.findByLabelText('Search chores')).toHaveValue('vac');
    expect(await screen.findByText('Vacuum')).toBeInTheDocument();
    expect(screen.queryByText('Dishes')).not.toBeInTheDocument();
  });

  it('navigates back to Home when a room tab is clicked while on the Admin page', async () => {
    const user = userEvent.setup();
    const adminMeResponse = { ...meResponse, isAdmin: true };
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === '/api/me') return jsonResponse(adminMeResponse);
        if (url === '/api/chores') {
          return jsonResponse({
            success: true,
            data: [
              {
                id: 1,
                name: 'Vacuum',
                roomId: 1,
                dateLastCompleted: '2026-06-01T00:00:00.000Z',
                duration: 20,
                frequency: 7,
                version: 1,
              },
            ],
          });
        }
        if (url === '/api/members') return jsonResponse({ success: true, data: [] });
        if (url === '/api/admin/users') return jsonResponse({ success: true, data: [] });
        if (url === '/api/admin/join-requests') return jsonResponse({ success: true, data: [] });
        if (url === '/api/admin/households') return jsonResponse({ success: true, data: [] });
        if (url === '/api/rooms') return jsonResponse(roomsResponse);
        throw new Error(`Unhandled fetch: ${url}`);
      }),
    );

    render(<App />);

    await screen.findByText('Vacuum');
    await user.click(screen.getByTestId('admin-nav-link'));
    await screen.findByRole('heading', { name: 'Members' });
    expect(screen.queryByText('Vacuum')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All' }));

    expect(await screen.findByText('Vacuum')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Members' })).not.toBeInTheDocument();
  });

  describe('admin users directory', () => {
    it('renders the Users directory at the bottom of the Admin page for an admin', async () => {
      const user = userEvent.setup();
      const adminMeResponse = { ...meResponse, isAdmin: true };
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL) => {
          const url = typeof input === 'string' ? input : input.toString();
          if (url === '/api/me') return jsonResponse(adminMeResponse);
          if (url === '/api/chores') return jsonResponse({ success: true, data: [] });
          if (url === '/api/rooms') return jsonResponse(roomsResponse);
          if (url === '/api/members') return jsonResponse({ success: true, data: [] });
          if (url === '/api/admin/users') {
            return jsonResponse({
              success: true,
              data: [
                {
                  id: 1,
                  email: 'a@example.com',
                  timezone: 'Asia/Tokyo',
                  isAdmin: true,
                  households: [{ id: 1, name: 'Household A' }],
                },
              ],
            });
          }
          if (url === '/api/admin/join-requests') return jsonResponse({ success: true, data: [] });
          if (url === '/api/admin/households') return jsonResponse({ success: true, data: [] });
          throw new Error(`Unhandled fetch: ${url}`);
        }),
      );

      render(<App />);
      await user.click(await screen.findByTestId('admin-nav-link'));

      expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument();
      expect(await screen.findByText('a@example.com')).toBeInTheDocument();
    });

    it('does not render the Users directory (or fetch it) for a non-admin', async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL) => {
          const url = typeof input === 'string' ? input : input.toString();
          if (url === '/api/me') return jsonResponse(meResponse);
          if (url === '/api/chores') return jsonResponse({ success: true, data: [] });
          if (url === '/api/rooms') return jsonResponse(roomsResponse);
          if (url === '/api/members') return jsonResponse({ success: true, data: [] });
          throw new Error(`Unhandled fetch: ${url}`);
        }),
      );

      render(<App />);
      await user.click(await screen.findByTestId('admin-nav-link'));

      await screen.findByRole('heading', { name: 'Members' });
      expect(screen.queryByRole('heading', { name: 'Users' })).not.toBeInTheDocument();
    });
  });

  describe('multi-household membership', () => {
    const multiHouseholdMeResponse = {
      id: 1,
      email: 'a@example.com',
      timezone: 'UTC',
      // isAdmin is global, not per-household — a single value for the whole
      // fixture, unlike the old per-membership role that could differ.
      isAdmin: true,
      memberships: [
        { householdId: 1, householdName: 'Household A', householdTimezone: 'UTC' },
        { householdId: 2, householdName: 'Household B', householdTimezone: 'UTC' },
      ],
      currentHouseholdId: 1,
    };

    function stubMultiHouseholdFetch() {
      const calls: { url: string; headers: Record<string, string> }[] = [];
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
          const url = typeof input === 'string' ? input : input.toString();
          const headers = new Headers(init?.headers);
          const householdId = headers.get('X-Household-Id');
          calls.push({ url, headers: { 'X-Household-Id': householdId ?? '' } });

          if (url === '/api/me') {
            return jsonResponse({
              ...multiHouseholdMeResponse,
              currentHouseholdId: householdId ? Number(householdId) : 1,
            });
          }
          if (url === '/api/chores') {
            const name = householdId === '2' ? 'Household B Chore' : 'Household A Chore';
            return jsonResponse({
              success: true,
              data: [
                {
                  id: 1,
                  name,
                  roomId: 1,
                  dateLastCompleted: '2026-06-01T00:00:00.000Z',
                  duration: 20,
                  frequency: 7,
                  version: 1,
                },
              ],
            });
          }
          if (url === '/api/rooms') return jsonResponse(roomsResponse);
          if (url === '/api/members') return jsonResponse({ success: true, data: [] });
          if (url === '/api/admin/users') return jsonResponse({ success: true, data: [] });
          if (url === '/api/admin/join-requests') return jsonResponse({ success: true, data: [] });
          if (url === '/api/admin/households') return jsonResponse({ success: true, data: [] });
          throw new Error(`Unhandled fetch: ${url}`);
        }),
      );
      return calls;
    }

    // The switcher itself (and this coverage of it) lives on the Household
    // admin page now, not the NavBar — see HouseholdSection.test.tsx for the
    // single-membership-hides-it / opens-modal-and-selects unit coverage.
    // This test is the one place that proves the whole wiring end to end:
    // App → AdminRoute → AdminPanel → HouseholdSection → SwitchHouseholdModal
    // → switchHousehold → a real re-fetch with the new X-Household-Id header.
    it('switching households on the Household admin page sends the new X-Household-Id header and swaps the chore list to the other household', async () => {
      const user = userEvent.setup();
      stubMultiHouseholdFetch();

      render(<App />);

      await screen.findByText('Household A Chore');

      await user.click(await screen.findByTestId('admin-nav-link'));
      await user.click(await screen.findByRole('button', { name: 'Switch household' }));
      const modal = screen.getByTestId('switch-household-modal-backdrop');
      await user.click(within(modal).getByRole('button', { name: 'Household B' }));

      await user.click(await screen.findByRole('button', { name: 'All' }));

      expect(await screen.findByText('Household B Chore')).toBeInTheDocument();
      expect(screen.queryByText('Household A Chore')).not.toBeInTheDocument();
    });

    it('clears the chore search query on a household switch', async () => {
      const user = userEvent.setup();
      stubMultiHouseholdFetch();

      render(<App />);

      await screen.findByText('Household A Chore');
      await user.type(screen.getByLabelText('Search chores'), 'Household');

      await user.click(await screen.findByTestId('admin-nav-link'));
      await user.click(await screen.findByRole('button', { name: 'Switch household' }));
      const modal = screen.getByTestId('switch-household-modal-backdrop');
      await user.click(within(modal).getByRole('button', { name: 'Household B' }));
      await user.click(await screen.findByRole('button', { name: 'All' }));

      expect(await screen.findByText('Household B Chore')).toBeInTheDocument();
      expect(screen.getByLabelText('Search chores')).toHaveValue('');
    });

    // FIX 4: a failed switch must surface an explicit error, never silently
    // revert to the old household via the generic /api/me cache fallback.
    it('surfaces an error (no silent revert) when a household switch fails', async () => {
      const user = userEvent.setup();
      const multiHouseholdMeResponse = {
        id: 1,
        email: 'a@example.com',
        timezone: 'UTC',
        isAdmin: true,
        memberships: [
          { householdId: 1, householdName: 'Household A', householdTimezone: 'UTC' },
          { householdId: 2, householdName: 'Household B', householdTimezone: 'UTC' },
        ],
        currentHouseholdId: 1,
      };
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
          const url = typeof input === 'string' ? input : input.toString();
          const householdId = new Headers(init?.headers).get('X-Household-Id');
          if (url === '/api/me') {
            // The switch target (household 2) fails — e.g. the session died
            // mid-switch. The initial headerless mount resolves household 1.
            if (householdId === '2') return unauthorizedResponse();
            return jsonResponse({ ...multiHouseholdMeResponse, currentHouseholdId: 1 });
          }
          if (url === '/api/chores') return jsonResponse({ success: true, data: [] });
          if (url === '/api/rooms') return jsonResponse(roomsResponse);
          if (url === '/api/members') return jsonResponse({ success: true, data: [] });
          if (url === '/api/admin/users') return jsonResponse({ success: true, data: [] });
          if (url === '/api/admin/join-requests') return jsonResponse({ success: true, data: [] });
          if (url === '/api/admin/households') return jsonResponse({ success: true, data: [] });
          throw new Error(`Unhandled fetch: ${url}`);
        }),
      );

      render(<App />);

      await user.click(await screen.findByTestId('admin-nav-link'));
      await user.click(await screen.findByRole('button', { name: 'Switch household' }));
      const modal = screen.getByTestId('switch-household-modal-backdrop');
      await user.click(within(modal).getByRole('button', { name: 'Household B' }));

      // The failure is surfaced explicitly rather than silently reverting.
      expect(await screen.findByText(/Couldn't switch households/)).toBeInTheDocument();
      // And the app stays usable on the still-valid old household (Household A).
      expect(screen.getByTestId('household-name')).toHaveTextContent('Household A');
    });

    // FIX 2 (App layer): a 403 for the scoped household must not surface stale
    // data — it re-resolves /api/me headerless onto a household we're in.
    it('re-resolves onto a valid household when /api/me 403s for the scoped household', async () => {
      // The client is still scoped to household 2 from a prior session but has
      // been removed from it; only household 1 remains. Set it through the api
      // module (not raw localStorage) so apiFetch's in-memory header cache
      // actually reflects it.
      setCurrentHouseholdId(2);
      const householdHeaders: (string | null)[] = [];
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
          const url = typeof input === 'string' ? input : input.toString();
          const householdId = new Headers(init?.headers).get('X-Household-Id');
          if (url === '/api/me') {
            householdHeaders.push(householdId);
            if (householdId === '2') return forbiddenResponse();
            return jsonResponse(meResponse); // headerless re-resolve → household 1
          }
          if (url === '/api/chores') {
            return jsonResponse({
              success: true,
              data: [
                {
                  id: 1,
                  name: 'Vacuum',
                  roomId: 1,
                  dateLastCompleted: '2026-06-01T00:00:00.000Z',
                  duration: 20,
                  frequency: 7,
                  version: 1,
                },
              ],
            });
          }
          if (url === '/api/rooms') return jsonResponse(roomsResponse);
          throw new Error(`Unhandled fetch: ${url}`);
        }),
      );

      render(<App />);

      // We land on the valid household's data, not a blank/stale screen.
      expect(await screen.findByText('Vacuum')).toBeInTheDocument();
      // /api/me was retried headerless after the 403 (re-resolve happened).
      expect(householdHeaders).toEqual(['2', null]);
    });

    // FIX A: when the revoked household was the user's ONLY membership, the
    // headerless re-resolve returns 401 (zero memberships). The client must NOT
    // re-adopt the stale cached identity that still names the revoked household
    // (which would leave it silently stuck AND reload-proof) — it resolves to
    // the no-household state instead.
    it('does not re-persist the revoked household when it was the last one (403 → headerless 401)', async () => {
      // Scoped to household 2, and a stale ME cache still naming household 2 —
      // exactly the identity that must NOT be resurrected.
      setCurrentHouseholdId(2);
      localStorage.setItem(ME_CACHE_KEY, JSON.stringify({ ...meResponse, currentHouseholdId: 2 }));
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
          const url = typeof input === 'string' ? input : input.toString();
          const householdId = new Headers(init?.headers).get('X-Household-Id');
          if (url === '/api/me') {
            // Scoped call 403s (removed); headerless re-resolve 401s (the
            // revoked household was the only membership → zero left).
            if (householdId === '2') return forbiddenResponse();
            return unauthorizedResponse();
          }
          if (url === '/api/rooms') return unauthorizedResponse();
          if (url === '/api/chores') return unauthorizedResponse();
          throw new Error(`Unhandled fetch: ${url}`);
        }),
      );

      render(<App />);

      // The user gets an explanation, not a blank screen or the revoked data.
      expect(await screen.findByTestId('no-household')).toBeInTheDocument();
      expect(screen.getByText(/not a member of any household/i)).toBeInTheDocument();
      // The revoked id is neither re-persisted to localStorage nor left behind:
      // a reload must not resurrect it.
      expect(localStorage.getItem(CURRENT_HOUSEHOLD_ID_KEY)).not.toBe('2');
      expect(localStorage.getItem(CURRENT_HOUSEHOLD_ID_KEY)).toBeNull();
      // The stale ME cache naming the revoked household is cleared too.
      expect(localStorage.getItem(ME_CACHE_KEY)).toBeNull();
    });

    // FIX D: a storage throw DURING revocation recovery (Safari private-mode
    // IndexedDB/localStorage can throw) must still resolve to a sane state
    // rather than leaving an unhandled rejection with `me` un-rescoped.
    it('resolves to the no-household state when storage throws mid-revocation recovery', async () => {
      setCurrentHouseholdId(1);
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL) => {
          const url = typeof input === 'string' ? input : input.toString();
          if (url === '/api/me') return jsonResponse(meResponse);
          if (url === '/api/rooms') return jsonResponse(roomsResponse);
          // A live 403 on chores drives ChoresView → onHouseholdRevoked →
          // handleHouseholdRevoked, whose cache teardown throws (below).
          if (url === '/api/chores') return forbiddenResponse();
          throw new Error(`Unhandled fetch: ${url}`);
        }),
      );
      // The first localStorage.removeItem during recovery (in
      // clearHouseholdScopedCaches) throws, simulating an ITP-constrained store.
      const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementationOnce(() => {
        throw new Error('storage unavailable');
      });

      try {
        render(<App />);
        // Recovery still lands on the no-household state instead of hanging or
        // rejecting unhandled.
        expect(await screen.findByTestId('no-household')).toBeInTheDocument();
      } finally {
        removeItemSpy.mockRestore();
      }
    });
  });

  // FIX 5: the resolved-401 cache fallback in useMe / useRooms.
  describe('resolved-401 cache fallback', () => {
    it('renders the cached household + room tabs when a mount-time /api/me resolves 401', async () => {
      localStorage.setItem(ME_CACHE_KEY, JSON.stringify(meResponse));
      localStorage.setItem(ROOMS_CACHE_KEY, JSON.stringify(roomsResponse.data));
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL) => {
          const url = typeof input === 'string' ? input : input.toString();
          // Everything resolves a 401 JSON body (evicted session), not a throw.
          if (url === '/api/me' || url === '/api/rooms' || url === '/api/chores') {
            return unauthorizedResponse();
          }
          throw new Error(`Unhandled fetch: ${url}`);
        }),
      );

      render(<App />);

      // The app renders from cache instead of blanking or losing its tabs.
      expect(await screen.findByRole('button', { name: 'Living Room' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Kitchen' })).toBeInTheDocument();
    });

    it('keeps cached room tabs when /api/rooms alone resolves 401 (me succeeds)', async () => {
      localStorage.setItem(ROOMS_CACHE_KEY, JSON.stringify(roomsResponse.data));
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL) => {
          const url = typeof input === 'string' ? input : input.toString();
          if (url === '/api/me') return jsonResponse(meResponse);
          if (url === '/api/chores') return jsonResponse({ success: true, data: [] });
          if (url === '/api/rooms') return unauthorizedResponse();
          throw new Error(`Unhandled fetch: ${url}`);
        }),
      );

      render(<App />);

      // useRooms falls back to the cache rather than clobbering the tabs empty.
      expect(await screen.findByRole('button', { name: 'Living Room' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Kitchen' })).toBeInTheDocument();
    });
  });
});
