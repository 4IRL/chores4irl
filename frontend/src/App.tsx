import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Outlet, useOutletContext, useNavigate } from 'react-router-dom';
import type { Room, SwipeStyle } from '@customTypes/SharedTypes';
import NavBar from './components/nav/NavBar';
import AdminPanel from './components/admin/AdminPanel';
import ChoresView from './components/chore/ChoresView';
import StatusBanner from './components/common/StatusBanner';
import { apiFetch, setCurrentHouseholdId } from './utils/api';
import { clearChoresCache } from './cache/choresCache';

type Membership = {
  householdId: number;
  householdName: string;
  householdTimezone: string;
};

type Me = {
  id: number;
  email: string;
  timezone: string;
  isAdmin: boolean;
  swipeStyle: SwipeStyle;
  memberships: Membership[];
  currentHouseholdId: number;
};

type ApiResponse<T> = { success: boolean; data?: T; error?: string };

const ROOMS_CACHE_KEY = 'rooms-cache-v1';
const ME_CACHE_KEY = 'me-cache-v1';

// The household-scoped caches that must be dropped when the viewer is removed
// from the currently-active household (a 403 from any household-scoped route),
// so the revoked household's private data can never be re-rendered from cache.
async function clearHouseholdScopedCaches(): Promise<void> {
  localStorage.removeItem(ROOMS_CACHE_KEY);
  await clearChoresCache();
}

function useRooms(onHouseholdRevoked: () => void) {
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    apiFetch('/api/rooms')
      .then((res) => {
        if (res.status === 403) {
          // 403 (not 401): still authenticated, but removed from the active
          // household. Drop the revoked rooms cache and let App re-resolve
          // /api/me + re-scope us — do NOT restore this household's stale tabs.
          localStorage.removeItem(ROOMS_CACHE_KEY);
          setRooms([]);
          onHouseholdRevoked();
          return null;
        }
        if (!res.ok) {
          // A resolved non-ok (e.g. an evicted session → 401 with a JSON error
          // body) would otherwise parse to `data ?? [] = []` and clobber the
          // cached rooms with an empty list. Fall back to cache instead.
          const cached = localStorage.getItem(ROOMS_CACHE_KEY);
          if (cached) setRooms(JSON.parse(cached) as Room[]);
          return null;
        }
        return res.json() as Promise<ApiResponse<Room[]>>;
      })
      .then((body) => {
        if (!body) return;
        const fetched = body.data ?? [];
        localStorage.setItem(ROOMS_CACHE_KEY, JSON.stringify(fetched));
        setRooms(fetched);
      })
      .catch(() => {
        // Mirrors useMe's cache fallback below — without this, a single
        // transient failure on first load left room tabs permanently empty
        // for that page life (only chores/me had a fallback, so refresh was
        // the only recovery).
        const cached = localStorage.getItem(ROOMS_CACHE_KEY);
        if (cached) setRooms(JSON.parse(cached) as Room[]);
      });
    // onHouseholdRevoked is stable-at-mount from useMe; depending on it would
    // needlessly re-fetch rooms on every App render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { rooms, setRooms };
}

function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  // Set when an explicit household switch fails — surfaced as a banner so the
  // switch can never silently revert to the old household with no signal.
  const [switchError, setSwitchError] = useState(false);
  // Guards against overlapping revocation recoveries (both useRooms and
  // ChoresView can 403 at once and each calls onHouseholdRevoked).
  const revokingRef = useRef(false);

  // Resolves the /api/me response into a Me. `allowReresolve` gates the 403
  // recovery so the headerless retry can't loop. When it is false we are ON
  // that headerless revocation retry: a non-ok/thrown result there means the
  // just-revoked household was the user's ONLY membership (backend returns 401
  // for zero memberships), so we must NOT resurrect the stale cached identity —
  // which still names the revoked household — or applyMe would re-persist the
  // revoked id and leave the app silently stuck AND reload-proof.
  async function fetchMe(allowReresolve: boolean): Promise<Me | null> {
    let res: Response;
    try {
      res = await apiFetch('/api/me');
    } catch {
      if (!allowReresolve) {
        // Offline mid-revocation: drop the revoked cached Me and resolve to the
        // no-household state instead of re-adopting it.
        localStorage.removeItem(ME_CACHE_KEY);
        return null;
      }
      const cached = localStorage.getItem(ME_CACHE_KEY);
      return cached ? (JSON.parse(cached) as Me) : null;
    }
    if (res.ok) return (await res.json()) as Me;
    if (res.status === 403 && allowReresolve) {
      // Authenticated, but removed from the household the client is scoped to.
      // Drop the stale X-Household-Id + that household's private caches, then
      // re-resolve headerless so the backend re-scopes us to a household we're
      // actually in (200), or to the truly-gone case (401 → no-household state
      // below). Never fall back to the revoked household's cached identity.
      await clearHouseholdScopedCaches();
      setCurrentHouseholdId(null);
      return fetchMe(false);
    }
    if (!allowReresolve) {
      // Headerless revocation retry came back non-ok (401 → zero memberships):
      // the revoked household was the last one. Clear the stale ME cache and
      // resolve to the no-household state — never re-adopt the revoked id.
      localStorage.removeItem(ME_CACHE_KEY);
      return null;
    }
    // 401 / other non-ok on the ordinary mount path: an evicted session — a
    // resolved non-ok would otherwise yield null → a blank app. Fall back to
    // the cached copy, the same way the thrown/offline path above does.
    const cached = localStorage.getItem(ME_CACHE_KEY);
    return cached ? (JSON.parse(cached) as Me) : null;
  }

  function applyMe(fetched: Me | null): Me | null {
    if (fetched) {
      localStorage.setItem(ME_CACHE_KEY, JSON.stringify(fetched));
      // Keep apiFetch's outgoing X-Household-Id in sync with whatever the
      // backend actually resolved — matters on first-ever login (no household
      // pre-selected) and after a 403 re-resolve landed us in a new household.
      setCurrentHouseholdId(fetched.currentHouseholdId);
    }
    setMe(fetched);
    return fetched;
  }

  function load(): Promise<Me | null> {
    return fetchMe(true).then(applyMe);
  }

  // Called when a live (in-session) household-scoped request 403s. Runs the
  // same clear-caches + headerless re-resolve recovery load() does on mount,
  // which changes currentHouseholdId and remounts Layout onto a valid household.
  async function handleHouseholdRevoked(): Promise<void> {
    if (revokingRef.current) return;
    revokingRef.current = true;
    setLoading(true);
    try {
      await clearHouseholdScopedCaches();
      setCurrentHouseholdId(null);
      applyMe(await fetchMe(false));
    } catch {
      // A storage throw during recovery (Safari private-mode IndexedDB /
      // localStorage can throw — the exact environment this fix targets) must
      // still resolve to a sane, rendered state rather than an unhandled
      // rejection (callers fire this without awaiting/catching). Best-effort
      // drop the revoked identity, then fall through to the no-household state.
      try {
        localStorage.removeItem(ME_CACHE_KEY);
        setCurrentHouseholdId(null);
      } catch {
        // Storage is unavailable — nothing more we can clear; still resolve to
        // the no-household state below so `me` is never left un-rescoped.
      }
      applyMe(null);
    } finally {
      revokingRef.current = false;
      setLoading(false);
    }
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
    // Runs once on mount only — household switches are driven by
    // switchHousehold below, not by re-running this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateSwipeStyle(swipeStyle: SwipeStyle) {
    setMe((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, swipeStyle };
      localStorage.setItem(ME_CACHE_KEY, JSON.stringify(updated));
      return updated;
    });
  }

  function updateHouseholdTimezone(householdTimezone: string) {
    setMe((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        memberships: prev.memberships.map((m) =>
          m.householdId === prev.currentHouseholdId ? { ...m, householdTimezone } : m,
        ),
      };
      localStorage.setItem(ME_CACHE_KEY, JSON.stringify(updated));
      return updated;
    });
  }

  async function switchHousehold(householdId: number) {
    setSwitchError(false);
    const previousHouseholdId = me?.currentHouseholdId ?? null;
    setCurrentHouseholdId(householdId);
    setLoading(true);
    try {
      // A switch must NOT reuse the generic cache fallback: on failure that
      // would resolve the *old* cached Me and silently revert the switch with
      // no signal. Fetch directly and treat any non-ok/throw as an explicit
      // switch failure instead.
      const res = await apiFetch('/api/me');
      if (!res.ok) throw new Error(`Switch to household ${householdId} failed (${res.status})`);
      applyMe((await res.json()) as Me);
    } catch {
      // Restore the prior scope so the app stays usable, and surface the
      // failure — never a silent revert.
      setCurrentHouseholdId(previousHouseholdId);
      setSwitchError(true);
    } finally {
      setLoading(false);
    }
  }

  return {
    me,
    loading,
    switchError,
    dismissSwitchError: () => setSwitchError(false),
    updateHouseholdTimezone,
    updateSwipeStyle,
    switchHousehold,
    onHouseholdRevoked: handleHouseholdRevoked,
  };
}

type LayoutContext = {
  selectedRoom: string;
  rooms: Room[];
  onRoomsChange: (rooms: Room[]) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
};

type LayoutProps = {
  isAdmin: boolean;
  onHouseholdRevoked: () => void;
};

function Layout({ isAdmin, onHouseholdRevoked }: LayoutProps) {
  const { rooms, setRooms } = useRooms(onHouseholdRevoked);
  const [selectedRoom, setSelectedRoom] = useState('all');
  // Lives here (not in ChoresView) so it survives /admin navigation; never persisted.
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  // Room tabs are also the only way back to Home from any other page (e.g.
  // Admin) — there's no separate home/logo link, so selecting a room must
  // navigate, not just update the filter state.
  function handleSelectRoom(room: string) {
    setSelectedRoom(room);
    navigate('/');
  }

  return (
    <div className="flex flex-col min-h-dvh">
      <NavBar rooms={rooms} selectedRoom={selectedRoom} onSelect={handleSelectRoom} isAdmin={isAdmin} />
      <Outlet
        context={
          {
            selectedRoom,
            rooms,
            onRoomsChange: setRooms,
            searchQuery,
            onSearchQueryChange: setSearchQuery,
          } satisfies LayoutContext
        }
      />
    </div>
  );
}

function Home({
  me,
  currentMembership,
  onSwipeStyleChange,
  onHouseholdRevoked,
}: {
  me: Me | null;
  currentMembership: Membership | undefined;
  onSwipeStyleChange: (swipeStyle: SwipeStyle) => void;
  onHouseholdRevoked: () => void;
}) {
  const { selectedRoom, rooms, searchQuery, onSearchQueryChange } = useOutletContext<LayoutContext>();
  if (!me || !currentMembership) return null;
  return (
    <div className="flex-1 flex flex-col px-4 pt-4 pb-0">
      <ChoresView
        searchQuery={searchQuery}
        onSearchQueryChange={onSearchQueryChange}
        householdTimezone={currentMembership.householdTimezone}
        selectedRoom={selectedRoom}
        rooms={rooms}
        swipeStyle={me.swipeStyle}
        onSwipeStyleChange={onSwipeStyleChange}
        onHouseholdRevoked={onHouseholdRevoked}
      />
    </div>
  );
}

function AdminRoute({
  me,
  currentMembership,
  onHouseholdTimezoneChange,
  onSwitchHousehold,
}: {
  me: Me | null;
  currentMembership: Membership | undefined;
  onHouseholdTimezoneChange: (timezone: string) => void;
  onSwitchHousehold: (householdId: number) => void;
}) {
  const { rooms, onRoomsChange } = useOutletContext<LayoutContext>();
  if (!me || !currentMembership) return null;
  return (
    <AdminPanel
      rooms={rooms}
      onRoomsChange={onRoomsChange}
      householdId={currentMembership.householdId}
      householdName={currentMembership.householdName}
      householdTimezone={currentMembership.householdTimezone}
      onHouseholdTimezoneChange={onHouseholdTimezoneChange}
      isAdmin={me.isAdmin}
      memberships={me.memberships}
      currentHouseholdId={me.currentHouseholdId}
      currentUserId={me.id}
      onSwitchHousehold={onSwitchHousehold}
    />
  );
}

function App() {
  const {
    me,
    loading,
    switchError,
    dismissSwitchError,
    updateHouseholdTimezone,
    updateSwipeStyle,
    switchHousehold,
    onHouseholdRevoked,
  } = useMe();
  const currentMembership = me?.memberships.find((m) => m.householdId === me.currentHouseholdId);

  if (loading) return null;

  // `me` is null after loading only when the session resolved to zero
  // memberships — most importantly after the user's LAST household was revoked
  // and the headerless re-resolve returned 401. Render an explanation instead
  // of the blank screen Home/AdminRoute would otherwise show (both return null
  // when `me` is null).
  if (!me) {
    return (
      <div
        data-testid="no-household"
        className="min-h-screen flex items-center justify-center p-6 text-center"
      >
        <p className="text-gray-300 text-sm max-w-sm">
          You're not a member of any household. Please contact an admin, or sign in again.
        </p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      {switchError && (
        <StatusBanner
          tone="warning"
          testId="switch-error-banner"
          message="Couldn't switch households — please try again."
          action={{ label: 'Dismiss', onClick: dismissSwitchError }}
        />
      )}
      <Routes>
        <Route
          element={
            <Layout
              // Remounts Layout (and everything nested under it) on a
              // household switch, so each child's mount-time fetch naturally
              // reloads household-scoped data instead of needing bespoke
              // invalidation.
              key={me?.currentHouseholdId}
              isAdmin={me?.isAdmin ?? false}
              onHouseholdRevoked={onHouseholdRevoked}
            />
          }
        >
          <Route
            path="/"
            element={
              <Home
                me={me}
                currentMembership={currentMembership}
                onSwipeStyleChange={updateSwipeStyle}
                onHouseholdRevoked={onHouseholdRevoked}
              />
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute
                me={me}
                currentMembership={currentMembership}
                onHouseholdTimezoneChange={updateHouseholdTimezone}
                onSwitchHousehold={switchHousehold}
              />
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
