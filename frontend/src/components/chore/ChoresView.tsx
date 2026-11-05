import { useEffect, useRef, useState } from 'react';
import { Settings } from 'lucide-react';
import type { Chore, Room, SwipeStyle } from '@customTypes/SharedTypes';
import { useMidnightClock } from '../../hooks/useMidnightClock';
import { useRoomFilter } from '../../hooks/useRoomFilter';
import { orderChores } from '@utils/choreSort';
import ChoreList from './ChoreList';
import ChoreFormModal from '../form/ChoreFormModal';
import ConfirmDialog from '../common/ConfirmDialog';
import SettingsModal from '../settings/SettingsModal';
import StatusBanner from '../common/StatusBanner';
import Toast, { type ToastState } from '../common/Toast';
import { useOutbox } from '../../outbox/useOutbox';
import {
  isPermanentRejection,
  outbox as defaultOutbox,
  type ChorePayload,
  type FlushResult,
  type Outbox,
  type OutboxEntry,
} from '../../outbox/outbox';
import { readChoresCache, writeChoresCache, clearChoresCache } from '../../cache/choresCache';
import { apiFetch } from '../../utils/api';
import { getDeviceTimezone } from '@utils/deviceTimezone';
import { cityLabel, utcOffsetLabel } from '@utils/timezones';

type ChoreWire = Omit<Chore, 'dateLastCompleted'> & { dateLastCompleted: string; version: number };
type ChoreWithVersion = Chore & { version: number };

type ApiResponse<T> = { success: boolean; data?: T; error?: string };

function wireToChore(wire: ChoreWire): ChoreWithVersion {
  return { ...wire, dateLastCompleted: new Date(wire.dateLastCompleted) };
}

type ChoresViewProps = {
  householdTimezone: string;
  outbox?: Outbox;
  selectedRoom?: string;
  rooms: Room[];
  swipeStyle: SwipeStyle;
  onSwipeStyleChange: (swipeStyle: SwipeStyle) => void;
  // Called when a household-scoped request comes back 403 (the viewer was
  // removed from the currently-active household). Lets App re-resolve /api/me
  // and re-scope to a household the user is actually in, rather than this view
  // continuing to render the revoked household's private data.
  onHouseholdRevoked?: () => void;
};

function toChorePayload(input: Omit<Chore, 'id'>): ChorePayload {
  return { ...input, dateLastCompleted: input.dateLastCompleted.toISOString() };
}

function pendingCreateToChore(entry: Extract<OutboxEntry, { type: 'create' }>): ChoreWithVersion {
  return {
    ...entry.payload,
    id: entry.tempId,
    dateLastCompleted: new Date(entry.payload.dateLastCompleted),
    version: 0,
  };
}

function mergePendingCreates(chores: ChoreWithVersion[], entries: OutboxEntry[]): ChoreWithVersion[] {
  const existingIds = new Set(chores.map((c) => c.id));
  const pending = entries
    .filter((e) => e.type === 'create' && !existingIds.has(e.tempId))
    .map((e) => pendingCreateToChore(e as Extract<OutboxEntry, { type: 'create' }>));
  return pending.length > 0 ? [...chores, ...pending] : chores;
}

// True when focus currently sits on the stale banner container or its Retry
// button — the two elements that get removed on a tone/action change or a
// successful reconnect, so focus must be handed off before they go away.
function isBannerFocused(): boolean {
  const testid = (document.activeElement as HTMLElement | null)?.getAttribute('data-testid');
  return testid === 'status-banner' || testid === 'status-banner-action';
}

type ToastTone = ToastState['tone'];

const NOT_FOUND_MESSAGE = 'That chore no longer exists.';
const OFFLINE_MESSAGE = "Saved offline — will sync when you're back online";
const FLUSH_SUCCESS_MESSAGE = 'Offline changes synced';
const FLUSH_DROPPED_REFRESHED_MESSAGE = "Some offline changes couldn't be synced. The list was refreshed.";
const FLUSH_DROPPED_MESSAGE = "Some offline changes couldn't be synced.";
const FLUSH_KEPT_MESSAGE =
  "Some offline changes haven't synced yet. They'll sync next time you're online or reopen the app.";

// A flush result is a failure when it is a conflict, or an error that carries an HTTP status
// (a status-less error is a network throw and is silent). "Dropped" means the outbox removed it.
function isDroppedFailure(result: FlushResult): boolean {
  if (result.outcome === 'conflict') return true;
  return result.outcome === 'error' && result.status !== undefined && isPermanentRejection(result.status);
}

function isKeptFailure(result: FlushResult): boolean {
  return result.outcome === 'error' && result.status !== undefined && !isPermanentRejection(result.status);
}

type MutateOptions<T> = {
  optimisticApply: () => void;
  request: () => Promise<Response>;
  onSuccess: (data: T) => void;
  onRollback: () => void;
  onConflict?: () => void;
  onNetworkFailure?: () => void;
  // Only passed for a real (server) id: a 404 means the chore is already gone.
  onNotFound?: () => void;
  notFoundAsSuccess?: boolean;
  successMessage: string;
  errorMessage: string;
  showToast: (tone: ToastTone, message: string) => void;
};

async function mutate<T>({
  optimisticApply,
  request,
  onSuccess,
  onRollback,
  onConflict,
  onNetworkFailure,
  onNotFound,
  notFoundAsSuccess,
  successMessage,
  errorMessage,
  showToast,
}: MutateOptions<T>) {
  optimisticApply();
  let res: Response;
  try {
    res = await request();
  } catch {
    onNetworkFailure?.();
    return;
  }
  if (res.status === 409) {
    onConflict?.();
    return;
  }
  if (res.status === 404 && notFoundAsSuccess) {
    onSuccess(null as T);
    showToast('success', successMessage);
    return;
  }
  if (res.status === 404 && onNotFound) {
    onNotFound();
    showToast('error', NOT_FOUND_MESSAGE);
    return;
  }
  let body: ApiResponse<T> | null;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    body = null;
  }
  if (res.ok && body?.success && body.data !== undefined) {
    onSuccess(body.data);
    showToast('success', successMessage);
    return;
  }
  onRollback();
  showToast('error', errorMessage);
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

export default function ChoresView({
  householdTimezone,
  outbox: outboxProp,
  selectedRoom = 'all',
  rooms,
  swipeStyle,
  onSwipeStyleChange,
  onHouseholdRevoked,
}: ChoresViewProps) {
  const today = useMidnightClock(householdTimezone);
  // Chore due dates/ordering run entirely on the household's clock (not the
  // viewer's device), so a member whose device disagrees with it should know
  // why a chore might look due/overdue at a time that doesn't match their
  // own local clock.
  const deviceTimezone = getDeviceTimezone();
  const timezoneMismatch = deviceTimezone !== householdTimezone;
  const [chores, setChores] = useState<ChoreWithVersion[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [conflictChoreId, setConflictChoreId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastIdRef = useRef(0);
  // Mirrors the current toast synchronously: showToast runs from async
  // callbacks that close over stale renders, so precedence reads this ref.
  const toastRef = useRef<ToastState | null>(null);

  function handleFlushResults(results: FlushResult[]) {
    for (const result of results) {
      if (result.outcome !== 'success' || result.data === undefined) continue;
      const data = result.data as ChoreWire;
      const { entry } = result;
      if (entry.type === 'create') {
        setChores((prev) => prev.map((c) => (c.id === entry.tempId ? wireToChore(data) : c)));
      } else if (entry.type === 'edit' || entry.type === 'complete') {
        setChores((prev) => prev.map((c) => (c.id === entry.choreId ? wireToChore(data) : c)));
      }
    }

    const dropped = results.some(isDroppedFailure);
    const kept = results.some(isKeptFailure);
    if (dropped) {
      // One refetch per pass, however many entries were dropped.
      void refetchChores().then((refreshed) =>
        showToast('error', refreshed ? FLUSH_DROPPED_REFRESHED_MESSAGE : FLUSH_DROPPED_MESSAGE),
      );
    } else if (kept) {
      showToast('error', FLUSH_KEPT_MESSAGE);
    } else if (results.some((r) => r.outcome === 'success')) {
      showToast('success', FLUSH_SUCCESS_MESSAGE);
    }
  }

  const { append } = useOutbox(outboxProp, handleFlushResults);
  const activeOutbox = outboxProp ?? defaultOutbox;

  const [isStale, setIsStale] = useState(false);
  // Seeded from navigator.onLine at init so an offline page load renders the
  // offline banner (Retry hidden) at mount, not only after a transition event.
  const [online, setOnline] = useState(() => navigator.onLine);
  // Stable focus anchor that survives the banner's removal on reconnect.
  const addChoreRef = useRef<HTMLButtonElement>(null);
  // ChoresView's own root — focus hand-off must target THIS view's StatusBanner,
  // not a global `[data-testid="status-banner"]` that could match the App-level
  // switch-error banner when both are mounted at once.
  const rootRef = useRef<HTMLDivElement>(null);
  // Bumped on every online/offline event. A `load()` captures the generation
  // in flight and refuses to apply its (now stale) result if a newer
  // connectivity event has since fired — otherwise a connectivity flap could
  // let an in-flight online fetch win and leave the banner/online state
  // contradicting the most-recent real connectivity signal.
  const connectivityGenRef = useRef(0);

  function releaseToastFocus() {
    const testid = (document.activeElement as HTMLElement | null)?.getAttribute('data-testid');
    if (testid === 'feedback-toast-dismiss') addChoreRef.current?.focus();
  }

  function showToast(tone: ToastTone, message: string) {
    const current = toastRef.current;
    if (tone === 'neutral' && current?.tone === 'error') return;
    releaseToastFocus();
    toastIdRef.current += 1;
    const next: ToastState = { id: toastIdRef.current, tone, message };
    toastRef.current = next;
    setToast(next);
  }

  function dismissToast() {
    releaseToastFocus();
    toastRef.current = null;
    setToast(null);
  }

  function removeChoreLocal(id: number) {
    setChores((prev) => prev.filter((c) => c.id !== id));
    setEditingId((cur) => (cur === id ? null : cur));
    setConflictChoreId((cur) => (cur === id ? null : cur));
  }

  // Merges still-queued creates using the outbox's live entries, read at call time: the hook's
  // `entries` is stale inside the flush listener, the online handler and the mount-only effect.
  function applyMergedList(list: ChoreWithVersion[]) {
    const merged = mergePendingCreates(list, activeOutbox.getEntries());
    setChores(merged);
    return merged;
  }

  async function renderFromCache(isCurrent: () => boolean = () => true) {
    const cached = await readChoresCache<ChoreWire[]>();
    if (!isCurrent()) return;
    applyMergedList((cached ?? []).map(wireToChore));
    setIsStale(true);
  }

  // Re-fetches the list without touching the cache or isStale. Resolves true when a fresh network
  // list was applied, false on a cache fallback or the 403 revocation path.
  async function refetchChores(): Promise<boolean> {
    try {
      const res = await apiFetch('/api/chores');
      if (res.status === 403) {
        // Removed from the active household: same handling as load().
        await clearChoresCache();
        setChores([]);
        setIsStale(false);
        onHouseholdRevoked?.();
        return false;
      }
      if (!res.ok) {
        await renderFromCache();
        return false;
      }
      const body = (await res.json()) as ApiResponse<ChoreWire[]>;
      const merged = applyMergedList((body.data ?? []).map(wireToChore));
      const present = new Set(merged.map((c) => c.id));
      setEditingId((cur) => (cur != null && !present.has(cur) ? null : cur));
      setConflictChoreId((cur) => (cur != null && !present.has(cur) ? null : cur));
      return true;
    } catch {
      await renderFromCache();
      return false;
    }
  }

  useEffect(() => {
    // Returns true when it ended stale (rendered from cache), false when a fresh
    // network copy was applied. `onBeforeFresh` runs immediately before the
    // fresh state (and the isStale=false that unmounts the banner) is applied,
    // giving the reconnect handler a chance to hand focus off first.
    async function load(gen: number, onBeforeFresh?: () => void): Promise<boolean> {
      const isCurrent = () => connectivityGenRef.current === gen;
      if (!navigator.onLine) {
        await renderFromCache(isCurrent);
        return true;
      }
      try {
        const res = await apiFetch('/api/chores');
        if (res.status === 403) {
          // 403 (not 401): the session is valid but the viewer was removed from
          // the currently-scoped household. Do NOT fall back to this
          // household's cached private data — drop it and hand off to App to
          // re-resolve /api/me and re-scope us to a household we're actually in.
          // Gate the whole side-effecting block behind isCurrent() (like every
          // sibling branch): a superseded in-flight 403 must not wipe cache a
          // newer successful fetch just wrote, nor fire a spurious revocation
          // cascade over an authoritative newer result.
          if (isCurrent()) {
            await clearChoresCache();
            setChores([]);
            setIsStale(false);
            onHouseholdRevoked?.();
          }
          return false;
        }
        if (!res.ok) {
          // A resolved non-ok (e.g. an evicted Access cookie → 401) must be
          // treated exactly like a thrown/offline error: fall back to cache and
          // flag stale, rather than parsing an error body into an empty list.
          await renderFromCache(isCurrent);
          return true;
        }
        const body = (await res.json()) as ApiResponse<ChoreWire[]>;
        const data = body.data ?? [];
        if (!isCurrent()) return false;
        onBeforeFresh?.();
        applyMergedList(data.map(wireToChore));
        setIsStale(false);
        await writeChoresCache(data);
        return false;
      } catch {
        await renderFromCache(isCurrent);
        return true;
      }
    }

    // Single consolidated `online` handler (DD13): re-fetch FIRST, and only if
    // the re-fetch did not recover restore the amber Retry banner — so a
    // successful reconnect never flashes the amber banner on its way to
    // unmounting. If focus is parked on the banner/Retry when the whole banner
    // is about to unmount, move it to the always-mounted "+ Add Chore" button
    // before the banner goes away.
    async function handleOnline() {
      connectivityGenRef.current += 1;
      const gen = connectivityGenRef.current;
      const stillStale = await load(gen, () => {
        if (isBannerFocused()) addChoreRef.current?.focus();
      });
      // Only assert "back online but still stale" if no newer connectivity
      // event has superseded this handler in the meantime.
      if (stillStale && connectivityGenRef.current === gen) setOnline(true);
    }

    function handleOffline() {
      connectivityGenRef.current += 1;
      // Retry is about to be dropped but the (now gray) banner stays mounted —
      // if focus was on Retry, park it on the banner container instead of body.
      if (isBannerFocused()) {
        rootRef.current?.querySelector<HTMLElement>('[data-testid="status-banner"]')?.focus();
      }
      setOnline(false);
    }

    load(connectivityGenRef.current);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
    // Mount-only on purpose: pending creates are merged from the outbox's live entries at call
    // time (applyMergedList), so nothing here needs to re-run on an outbox change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleComplete(id: number, date: Date) {
    const payload = { dateLastCompleted: date.toISOString() };
    const original = chores.find((c) => c.id === id)?.dateLastCompleted;
    mutate<ChoreWire>({
      optimisticApply: () =>
        setChores((prev) => prev.map((c) => (c.id === id ? { ...c, dateLastCompleted: date } : c))),
      request: () =>
        apiFetch(`/api/chores/${id}/complete`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
      onSuccess: (data) => setChores((prev) => prev.map((c) => (c.id === id ? wireToChore(data) : c))),
      onRollback: () => {
        if (original === undefined) return;
        setChores((prev) =>
          prev.map((c) =>
            c.id === id && sameValue(c.dateLastCompleted, date) ? { ...c, dateLastCompleted: original } : c,
          ),
        );
      },
      onNotFound: id > 0 ? () => removeChoreLocal(id) : undefined,
      onNetworkFailure: () => {
        append({ type: 'complete', choreId: id, payload });
        showToast('neutral', OFFLINE_MESSAGE);
      },
      successMessage: 'Chore completed',
      errorMessage: "Couldn't mark the chore complete. Please try again.",
      showToast,
    });
  }

  function handleDelete(id: number) {
    const removed = chores.find((c) => c.id === id);
    mutate<null>({
      optimisticApply: () => setChores((prev) => prev.filter((c) => c.id !== id)),
      request: () => apiFetch(`/api/chores/${id}`, { method: 'DELETE' }),
      onSuccess: () => {},
      onRollback: () => {
        if (!removed) return;
        setChores((prev) => (prev.some((c) => c.id === id) ? prev : [...prev, removed]));
      },
      notFoundAsSuccess: id > 0,
      onNetworkFailure: () => {
        append({ type: 'delete', choreId: id });
        showToast('neutral', OFFLINE_MESSAGE);
      },
      successMessage: 'Chore deleted',
      errorMessage: "Couldn't delete the chore. Please try again.",
      showToast,
    });
  }

  function handleAddSubmit(input: Omit<Chore, 'id'>) {
    const tempId = -Date.now();
    const payload = toChorePayload(input);
    setIsAddOpen(false);
    mutate<ChoreWire>({
      optimisticApply: () => setChores((prev) => [...prev, { ...input, id: tempId, version: 0 }]),
      request: () =>
        apiFetch('/api/chores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
      onSuccess: (data) =>
        setChores((prev) => {
          const server = wireToChore(data);
          if (prev.some((c) => c.id === tempId)) return prev.map((c) => (c.id === tempId ? server : c));
          if (prev.some((c) => c.id === server.id)) return prev;
          return [...prev, server];
        }),
      onRollback: () => removeChoreLocal(tempId),
      onNetworkFailure: () => {
        append({ type: 'create', tempId, payload });
        showToast('neutral', OFFLINE_MESSAGE);
      },
      successMessage: 'Chore added',
      errorMessage: "Couldn't add the chore. Please try again.",
      showToast,
    });
  }

  function handleEditSubmit(input: Omit<Chore, 'id'>) {
    const id = editingId;
    if (id == null) return;
    const existing = chores.find((c) => c.id === id);
    const baseVersion = existing?.version ?? 1;
    const payload = toChorePayload(input);
    // Fields this edit actually changes, with their pre-edit values.
    const changed: [string, unknown][] = [];
    if (existing) {
      for (const key of Object.keys(input)) {
        const before = (existing as Record<string, unknown>)[key];
        const after = (input as Record<string, unknown>)[key];
        if (!sameValue(before, after)) changed.push([key, before]);
      }
    }
    setEditingId(null);
    mutate<ChoreWire>({
      optimisticApply: () => setChores((prev) => prev.map((c) => (c.id === id ? { ...c, ...input } : c))),
      request: () =>
        apiFetch(`/api/chores/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, version: baseVersion }),
        }),
      onSuccess: (data) => setChores((prev) => prev.map((c) => (c.id === id ? wireToChore(data) : c))),
      onRollback: () =>
        setChores((prev) =>
          prev.map((c) => {
            if (c.id !== id) return c;
            const restored: Record<string, unknown> = { ...c };
            for (const [key, before] of changed) {
              if (sameValue(restored[key], (input as Record<string, unknown>)[key])) restored[key] = before;
            }
            return restored as ChoreWithVersion;
          }),
        ),
      onNotFound: id > 0 ? () => removeChoreLocal(id) : undefined,
      onConflict: () => setConflictChoreId(id),
      onNetworkFailure: () => {
        append({ type: 'edit', choreId: id, baseVersion, payload });
        showToast('neutral', OFFLINE_MESSAGE);
      },
      successMessage: 'Changes saved',
      errorMessage: "Couldn't save your changes. Please try again.",
      showToast,
    });
  }

  async function handleDiscardConflict() {
    setConflictChoreId(null);
    await refetchChores();
  }

  function handleKeepEditing() {
    setEditingId(conflictChoreId);
    setConflictChoreId(null);
  }

  // A real top-level navigation to the Access-gated origin re-triggers the SSO
  // redirect that repopulates the session cookie. But `/` is NOT in the SW's
  // navigateFallbackDenylist, so while the service worker is active (the normal
  // returning-user case this fix targets) Workbox would answer the navigation
  // with the stale precached shell and never hit the network — Access would
  // never re-authenticate. So first tear the SW + caches down, THEN navigate:
  // with the SW gone the navigation reaches the network → Access re-auth, and
  // the SW simply re-installs after re-login (offline capability returns next
  // load). NOT react-router (client-only, never reaches Access) and NOT
  // location.reload() (the SW may still serve the cached shell).
  async function handleRetry() {
    // The teardown must NEVER block the recovery navigation: in the Safari/ITP/
    // private-browsing environment this targets, a storage/SW API call can
    // throw (or a registration/cache delete can reject). Swallow any such
    // failure via allSettled + try/finally so `window.location.assign('/')`
    // always runs — a Retry that silently does nothing is worse than the bug.
    try {
      const teardown: Promise<unknown>[] = [];
      if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        teardown.push(...registrations.map((registration) => registration.unregister()));
      }
      if (typeof caches !== 'undefined') {
        const keys = await caches.keys();
        teardown.push(...keys.map((key) => caches.delete(key)));
      }
      await Promise.allSettled(teardown);
    } finally {
      window.location.assign('/');
    }
  }

  const editingChore = chores.find((c) => c.id === editingId);

  const visibleChores = useRoomFilter(chores, selectedRoom);

  return (
    <div ref={rootRef}>
      {isStale &&
        (online ? (
          <StatusBanner
            tone="stale"
            message="Showing cached data. Your session may have expired — tap Retry to sign in."
            action={{ label: 'Retry', onClick: handleRetry }}
          />
        ) : (
          <StatusBanner
            tone="offline"
            message="You're offline — showing cached data. We'll reconnect automatically."
          />
        ))}
      <div className="p-4">
        {timezoneMismatch && (
          <span data-testid="timezone-mismatch-notice" className="block text-amber-400 text-xs mb-3">
            Your device is set to {cityLabel(deviceTimezone)} ({utcOffsetLabel(deviceTimezone)}), but this
            household runs on {cityLabel(householdTimezone)} ({utcOffsetLabel(householdTimezone)}) — due dates
            use the household's clock.
          </span>
        )}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Settings"
            title="Settings"
            className="h-9 w-9 flex items-center justify-center rounded-lg bg-gray-700 hover:bg-gray-600 text-white"
          >
            <Settings size={18} />
          </button>
          <button
            ref={addChoreRef}
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 px-4 rounded-lg"
          >
            + Add Chore
          </button>
        </div>
      </div>
      {/* Stable aria-live region (DD5): the container stays mounted at all times
          and only its children swap, so a transition between the can't-load
          block / benign-empty-room state / populated list is announced to
          screen readers independently of the StatusBanner's own role="status". */}
      <div aria-live="polite" className="pb-24">
        {isStale && chores.length === 0 ? (
          <div data-testid="chores-unavailable" className="text-center py-8">
            <h3 className="text-amber-300 text-base font-semibold mb-2">Can't load your chores right now.</h3>
            <p className="text-gray-400 text-sm max-w-sm mx-auto">
              {online
                ? "We couldn't reach the server and there's no saved copy on this device. Check your connection, or tap Retry above to sign in again."
                : "We couldn't reach the server and there's no saved copy on this device. Check your connection — we'll reconnect automatically once you're back online."}
            </p>
          </div>
        ) : chores.length > 0 && visibleChores.length === 0 ? (
          <p data-testid="chores-empty-room" className="text-gray-400 text-center py-8">
            No chores in this room.
          </p>
        ) : (
          <ChoreList
            chores={orderChores(visibleChores, today, householdTimezone)}
            day={today}
            householdTimezone={householdTimezone}
            isSimulating={false}
            swipeStyle={swipeStyle}
            onComplete={handleComplete}
            onDelete={handleDelete}
            onEdit={setEditingId}
          />
        )}
      </div>
      {isSettingsOpen && (
        <SettingsModal
          swipeStyle={swipeStyle}
          onSwipeStyleChange={onSwipeStyleChange}
          onCancel={() => setIsSettingsOpen(false)}
        />
      )}
      {isAddOpen && (
        <ChoreFormModal
          mode="add"
          defaultRoomId={selectedRoom}
          rooms={rooms}
          householdTimezone={householdTimezone}
          onSubmit={handleAddSubmit}
          onCancel={() => setIsAddOpen(false)}
        />
      )}
      {editingChore && (
        <ChoreFormModal
          mode="edit"
          rooms={rooms}
          initialChore={editingChore}
          householdTimezone={householdTimezone}
          onSubmit={handleEditSubmit}
          onCancel={() => setEditingId(null)}
        />
      )}
      {conflictChoreId != null && (
        <ConfirmDialog
          message="This chore was changed elsewhere."
          confirmLabel="Discard my changes"
          cancelLabel="Keep editing"
          onConfirm={handleDiscardConflict}
          onCancel={handleKeepEditing}
        />
      )}
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
