import { useCallback, useEffect, useRef, useState } from 'react';
import { Settings } from 'lucide-react';
import type { Chore, Room, SwipeStyle } from '@customTypes/SharedTypes';
import { useMidnightClock } from '../../hooks/useMidnightClock';
import { useRoomFilter } from '../../hooks/useRoomFilter';
import { useChoreSearch } from '../../hooks/useChoreSearch';
import { useIsTouchDevice } from '../../hooks/useIsTouchDevice';
import { useScrollPastThreshold } from '../../hooks/useScrollPastThreshold';
import ChoreSearchInput from './ChoreSearchInput';
import ScrollToTopButton from './ScrollToTopButton';
import StatusCountStrip from '../nav/StatusCountStrip';
import { applyOrder, snapshotOrder } from '@utils/choreOrder';
import { choreStatusCounts } from '@utils/choreStatusCounts';
import ChoreList from './ChoreList';
import ChoreFormModal from '../form/ChoreFormModal';
import ConfirmDialog from '../common/ConfirmDialog';
import SettingsModal from '../settings/SettingsModal';
import StatusBanner from '../common/StatusBanner';
import Toast, { type ToastAction, type ToastState } from '../common/Toast';
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
import { prefersReducedMotion } from '@utils/prefersReducedMotion';
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
  // Lifted into App's Layout so the query survives /admin navigation.
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
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
const UNDONE_MESSAGE = 'Undone';
const UNDO_CONFLICT_MESSAGE = "Can't undo — someone changed it";
const RESTORE_NOT_FOUND_MESSAGE = "Couldn't restore — that chore no longer exists";
const UNDO_FAILED_MESSAGE = "Couldn't undo. Please try again.";
const REDONE_MESSAGE = 'Redone';
const REDO_CONFLICT_MESSAGE = "Can't redo — someone changed it";
const REDO_FAILED_MESSAGE = "Couldn't redo. Please try again.";
const UNDO_STILL_SYNCING_MESSAGE = "Can't undo yet — still syncing";
const OFFLINE_MESSAGE = "Saved offline — will sync when you're back online";
const FLUSH_SUCCESS_MESSAGE = 'Offline changes synced';
const FLUSH_DROPPED_REFRESHED_MESSAGE = "Some offline changes couldn't be synced. The list was refreshed.";
const FLUSH_DROPPED_MESSAGE = "Some offline changes couldn't be synced.";
const FLUSH_MIXED_REFRESHED_MESSAGE =
  "Some offline changes couldn't be synced and the list was refreshed. Others haven't synced yet and will retry.";
const FLUSH_MIXED_MESSAGE =
  "Some offline changes couldn't be synced. Others haven't synced yet and will retry.";
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

type UndoKind = 'complete' | 'edit' | 'delete';

// The single remembered action. A ref (like toastRef) so async callbacks never read a stale closure.
type UndoRecord = {
  kind: UndoKind;
  choreId: number;
  beforePayload: ChorePayload;
  afterPayload: ChorePayload;
  // Version for the next versioned PUT; null for delete and for a cancelled offline entry.
  currentVersion: number | null;
  outboxEntryId: string | null;
  // True only after an offline-queued entry was cancelled by Undo (Redo then re-runs the original action).
  cancelled: boolean;
  phase: 'undo' | 'redo';
  toastId: number;
  inFlight: boolean;
};

// Only the editable fields: toChorePayload spreads its input, so a full row would leak id/version.
function toEditablePayload(c: Omit<Chore, 'id'>): ChorePayload {
  return toChorePayload({
    name: c.name,
    roomId: c.roomId,
    dateLastCompleted: c.dateLastCompleted,
    duration: c.duration,
    frequency: c.frequency,
    urgency: c.urgency,
  });
}

function rowFromPayload(row: ChoreWithVersion, p: ChorePayload): ChoreWithVersion {
  return {
    ...row,
    name: p.name,
    roomId: p.roomId,
    dateLastCompleted: new Date(p.dateLastCompleted),
    duration: p.duration,
    frequency: p.frequency,
    urgency: p.urgency,
  };
}

// Row to re-insert for Undo of a delete. `version` is the pre-delete version (valid for an offline
// cancel, where the server never saw the delete); an online restore response replaces it.
function deletedRow(id: number, p: ChorePayload, version: number): ChoreWithVersion {
  return rowFromPayload({ id, version } as ChoreWithVersion, p);
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
  successTone?: ToastTone;
  successAction?: ToastState['action'];
  // Called only when the success toast was actually shown (a standing error toast can suppress it).
  onToastShown?: () => void;
  notFoundMessage?: string;
  // Evaluated at response time before every toast; false skips that toast (data callbacks still run).
  isToastAllowed?: () => boolean;
};

async function runMutation<T>(
  showToast: (tone: ToastTone, message: string, action?: ToastState['action']) => boolean,
  {
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
    successTone,
    successAction,
    onToastShown,
    notFoundMessage,
    isToastAllowed,
  }: MutateOptions<T>,
) {
  const toastAllowed = () => isToastAllowed?.() ?? true;
  optimisticApply();
  let res: Response;
  try {
    res = await request();
  } catch {
    onNetworkFailure?.();
    return;
  }
  // With no conflict handler a 409 is an ordinary failure: fall through to rollback + error toast.
  if (res.status === 409 && onConflict) {
    onConflict();
    return;
  }
  if (res.status === 404 && notFoundAsSuccess) {
    onSuccess(null as T);
    if (toastAllowed()) showToast(successTone ?? 'success', successMessage);
    return;
  }
  if (res.status === 404 && onNotFound) {
    onNotFound();
    if (toastAllowed()) showToast('error', notFoundMessage ?? NOT_FOUND_MESSAGE);
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
    if (toastAllowed() && showToast(successTone ?? 'success', successMessage, successAction)) {
      onToastShown?.();
    }
    return;
  }
  onRollback();
  if (toastAllowed()) showToast('error', errorMessage);
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
  searchQuery,
  onSearchQueryChange,
}: ChoresViewProps) {
  const today = useMidnightClock(householdTimezone);
  // Chore due dates/ordering run entirely on the household's clock (not the
  // viewer's device), so a member whose device disagrees with it should know
  // why a chore might look due/overdue at a time that doesn't match their
  // own local clock.
  const deviceTimezone = getDeviceTimezone();
  const timezoneMismatch = deviceTimezone !== householdTimezone;
  const [chores, setChores] = useState<ChoreWithVersion[]>([]);
  // False until a list has been applied (and again after a 403 clear): the count strip stays
  // hidden so it never shows a false "0" while loading.
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [conflictChoreId, setConflictChoreId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const modalOpen = isAddOpen || editingId != null || isSettingsOpen || conflictChoreId != null;
  const toastIdRef = useRef(0);
  // Mirrors the current toast synchronously: showToast runs from async
  // callbacks that close over stale renders, so precedence reads this ref.
  const toastRef = useRef<ToastState | null>(null);
  // The single remembered undoable action (see ARCHITECTURE.md). Invalidation rules live in clearUndo callers.
  const undoRef = useRef<UndoRecord | null>(null);
  // Mirrors undoRef.current?.inFlight (a ref change alone does not re-render) so the toast can hold.
  const [undoInFlight, setUndoInFlight] = useState(false);
  // Assigned after every render so the toast button never calls a closure captured at arming time.
  const undoStepRef = useRef<(step: 'undo' | 'redo') => void>(() => {});
  // Pre-delete version per deleted chore id, so an offline-cancelled delete re-inserts a usable version.
  const deletedVersionsRef = useRef(new Map<number, number>());
  const versionBeforeDelete = (id: number) => deletedVersionsRef.current.get(id) ?? 0;
  useEffect(() => {
    undoStepRef.current = applyUndoStep;
  });
  // Keyboard shortcut for the toast's Undo/Redo. Reads refs/latest flags at event time so the listener is
  // registered once; the same applyUndoStep path (single-flight) as the button runs.
  const modalOpenRef = useRef(modalOpen);
  useEffect(() => {
    modalOpenRef.current = modalOpen;
  });
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (typeof event.key !== 'string') return; // autofill / IME-synthesized events can lack a key
      if (event.repeat || event.isComposing) return;
      if (event.altKey) return;
      if (event.ctrlKey === event.metaKey) return; // exactly one of Ctrl / Cmd
      const key = event.key.toLowerCase();
      let step: 'undo' | 'redo' | null = null;
      if (key === 'z') step = event.shiftKey ? 'redo' : 'undo';
      else if (key === 'y' && event.ctrlKey && !event.metaKey && !event.shiftKey) step = 'redo';
      if (step === null) return;
      const record = undoRef.current;
      if (!record || record.phase !== step || record.inFlight) return;
      if (modalOpenRef.current) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const target = event.target;
      if (target instanceof Element) {
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.closest('[contenteditable]:not([contenteditable="false"])')
        )
          return;
      }
      event.preventDefault();
      undoStepRef.current(step);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
  const undoAction: ToastAction = {
    label: 'Undo',
    testId: 'feedback-toast-undo',
    onClick: () => undoStepRef.current('undo'),
  };
  const redoAction: ToastAction = {
    label: 'Redo',
    testId: 'feedback-toast-redo',
    onClick: () => undoStepRef.current('redo'),
  };

  function handleFlushResults(results: FlushResult[]) {
    // A flush that removed the armed queued entry (success, conflict, dropped, permanent error) ends Undo
    // now, before any toast, so the action disappears even when the toast that follows is async.
    const armedId = undoRef.current?.outboxEntryId;
    if (
      armedId &&
      results.some((r) => r.entry.id === armedId) &&
      !activeOutbox.getEntries().some((e) => e.id === armedId)
    ) {
      clearUndo();
    }

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
      // One refetch per pass, however many entries were dropped. A mixed pass gets one combined toast.
      void refetchChores().then((refreshed) => {
        if (kept) {
          showToast('error', refreshed ? FLUSH_MIXED_REFRESHED_MESSAGE : FLUSH_MIXED_MESSAGE);
        } else {
          showToast('error', refreshed ? FLUSH_DROPPED_REFRESHED_MESSAGE : FLUSH_DROPPED_MESSAGE);
        }
      });
    } else if (kept) {
      showToast('error', FLUSH_KEPT_MESSAGE);
    } else if (results.some((r) => r.outcome === 'success')) {
      showToast('success', FLUSH_SUCCESS_MESSAGE);
    }
  }

  const { append } = useOutbox(outboxProp, handleFlushResults);
  const activeOutbox = outboxProp ?? defaultOutbox;

  const [isStale, setIsStale] = useState(false);

  // Stable order: the list is sorted once into `orderSnapshot` and only re-sorted on first load,
  // a stale-to-fresh load (snapshot taken from the cache), midnight / timezone change (via `key`),
  // or the first list after a 403 clear. Derived during render so the first paint is ordered.
  const [orderSnapshot, setOrderSnapshot] = useState<{
    key: string;
    ids: number[];
    stale: boolean;
  } | null>(null);
  const [prevIsStale, setPrevIsStale] = useState(false);
  const snapshotKey = `${today.getTime()}|${householdTimezone}`;
  const staleToFresh = prevIsStale && !isStale && orderSnapshot?.stale === true;
  if (prevIsStale !== isStale) setPrevIsStale(isStale);
  if (orderSnapshot === null || orderSnapshot.key !== snapshotKey || staleToFresh) {
    // Temp-id (pending create) chores have negative ids and are never snapshotted.
    const realChores = chores.filter((c) => c.id > 0);
    if (realChores.length > 0) {
      setOrderSnapshot({
        key: snapshotKey,
        ids: snapshotOrder(realChores, today, householdTimezone),
        stale: isStale,
      });
    }
  }
  // Seeded from navigator.onLine at init so an offline page load renders the
  // offline banner (Retry hidden) at mount, not only after a transition event.
  const [online, setOnline] = useState(() => navigator.onLine);
  // Stable focus anchor that survives the banner's removal on reconnect.
  const addChoreRef = useRef<HTMLButtonElement>(null);
  const focusTargetRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const isTouch = useIsTouchDevice();
  const pastThreshold = useScrollPastThreshold(80);
  // Falls back to local state when App does not lift the query (e.g. tests).
  const [localQuery, setLocalQuery] = useState('');
  const query = searchQuery ?? localQuery;
  const setQuery = onSearchQueryChange ?? setLocalQuery;
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
    if (
      testid === 'feedback-toast-dismiss' ||
      testid === 'feedback-toast-undo' ||
      testid === 'feedback-toast-redo'
    ) {
      addChoreRef.current?.focus();
    }
  }

  // Drops the undo record and strips the action from the standing toast (same id; Toast restarts its
  // timer at the plain 4/6 s duration). Safe to call with nothing armed.
  function clearUndo() {
    setUndoInFlight(false);
    const standing = toastRef.current;
    if (undoRef.current === null && !standing?.action) return;
    releaseToastFocus();
    undoRef.current = null;
    if (standing?.action) {
      const stripped: ToastState = {
        id: standing.id,
        tone: standing.tone,
        message: standing.message,
      };
      toastRef.current = stripped;
      setToast(stripped);
    }
  }

  // Clears the record only if it is still the one that was current when `toastId` was captured.
  function clearUndoIfCurrent(toastId: number | undefined) {
    if (toastId !== undefined && undoRef.current?.toastId === toastId) clearUndo();
  }

  // Returns true when the toast was shown, false when a standing error toast suppressed it.
  function showToast(tone: ToastTone, message: string, action?: ToastAction): boolean {
    const current = toastRef.current;
    if (tone === 'neutral' && current?.tone === 'error') return false;
    clearUndo();
    releaseToastFocus();
    toastIdRef.current += 1;
    const next: ToastState = { id: toastIdRef.current, tone, message, ...(action && { action }) };
    toastRef.current = next;
    setToast(next);
    return true;
  }

  function mutate<T>(options: MutateOptions<T>) {
    return runMutation(showToast, options);
  }

  function dismissToast() {
    clearUndo();
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
  // `forToastId` is the undo record the caller saw when it started; the record is cleared only if it is
  // still that one, so a record armed after the fetch began survives. No id never clears.
  function applyMergedList(list: ChoreWithVersion[], forToastId?: number) {
    clearUndoIfCurrent(forToastId);
    const merged = mergePendingCreates(list, activeOutbox.getEntries());
    setChores(merged);
    setHasLoaded(true);
    return merged;
  }

  async function renderFromCache(isCurrent: () => boolean = () => true, forToastId?: number) {
    const cached = await readChoresCache<ChoreWire[]>();
    if (!isCurrent()) return;
    applyMergedList((cached ?? []).map(wireToChore), forToastId);
    setIsStale(true);
  }

  // Re-fetches the list without touching the cache or isStale. Resolves true when a fresh network
  // list was applied, false on a cache fallback or the 403 revocation path.
  async function refetchChores(forToastId: number | undefined = undoRef.current?.toastId): Promise<boolean> {
    try {
      const res = await apiFetch('/api/chores');
      if (res.status === 403) {
        // Removed from the active household: same handling as load().
        await clearChoresCache();
        clearUndoIfCurrent(forToastId);
        setChores([]);
        setHasLoaded(false);
        setOrderSnapshot(null);
        setIsStale(false);
        onHouseholdRevoked?.();
        return false;
      }
      if (!res.ok) {
        await renderFromCache(undefined, forToastId);
        return false;
      }
      const body = (await res.json()) as ApiResponse<ChoreWire[]>;
      const merged = applyMergedList((body.data ?? []).map(wireToChore), forToastId);
      const present = new Set(merged.map((c) => c.id));
      setEditingId((cur) => (cur != null && !present.has(cur) ? null : cur));
      setConflictChoreId((cur) => (cur != null && !present.has(cur) ? null : cur));
      return true;
    } catch {
      await renderFromCache(undefined, forToastId);
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
      // The undo record this load started under: only that record may be cleared by its result.
      const startToastId = undoRef.current?.toastId;
      if (!navigator.onLine) {
        await renderFromCache(isCurrent, startToastId);
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
            clearUndoIfCurrent(startToastId);
            setChores([]);
            setHasLoaded(false);
            setOrderSnapshot(null);
            setIsStale(false);
            onHouseholdRevoked?.();
          }
          return false;
        }
        if (!res.ok) {
          // A resolved non-ok (e.g. an evicted Access cookie → 401) must be
          // treated exactly like a thrown/offline error: fall back to cache and
          // flag stale, rather than parsing an error body into an empty list.
          await renderFromCache(isCurrent, startToastId);
          return true;
        }
        const body = (await res.json()) as ApiResponse<ChoreWire[]>;
        const data = body.data ?? [];
        if (!isCurrent()) return false;
        onBeforeFresh?.();
        applyMergedList(data.map(wireToChore), startToastId);
        setIsStale(false);
        await writeChoresCache(data);
        return false;
      } catch {
        await renderFromCache(isCurrent, startToastId);
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

  // Arms the record for the toast that was just shown (call only after showToast returned true).
  function armUndo(
    fields: Pick<
      UndoRecord,
      'kind' | 'choreId' | 'beforePayload' | 'afterPayload' | 'currentVersion' | 'outboxEntryId'
    >,
  ) {
    undoRef.current = {
      ...fields,
      cancelled: false,
      phase: 'undo',
      toastId: toastIdRef.current,
      inFlight: false,
    };
  }

  // Undo and Redo share this path. Single-flight and identity-guarded: a completion whose record
  // was cleared or replaced meanwhile applies data effects only and shows no toast.
  function applyUndoStep(step: 'undo' | 'redo') {
    const record = undoRef.current;
    if (!record || record.phase !== step || record.inFlight) return;
    const isUndo = step === 'undo';
    const id = record.choreId;
    // The payload this step writes: Undo restores the pre-action state, Redo re-applies the post-action one.
    const target = isUndo ? record.beforePayload : record.afterPayload;
    const before = record.beforePayload;
    const toastId = record.toastId;
    const doneMessage = isUndo ? UNDONE_MESSAGE : REDONE_MESSAGE;
    const conflictMessage = isUndo ? UNDO_CONFLICT_MESSAGE : REDO_CONFLICT_MESSAGE;
    const failedMessage = isUndo ? UNDO_FAILED_MESSAGE : REDO_FAILED_MESSAGE;
    const nextAction = isUndo ? redoAction : undoAction;

    if (!isUndo && record.cancelled) {
      // The original action never reached the server (cancelled while queued): re-run it through the
      // normal handler, which clears this record synchronously (single-flight) and arms a fresh one.
      const after = record.afterPayload;
      if (record.kind === 'complete') handleComplete(id, new Date(after.dateLastCompleted));
      else if (record.kind === 'delete') handleDelete(id);
      else applyEdit(id, { ...after, dateLastCompleted: new Date(after.dateLastCompleted) });
      return;
    }

    if (isUndo && record.outboxEntryId !== null) {
      // Still queued offline: cancel the entry instead of sending anything.
      if (!activeOutbox.remove(record.outboxEntryId)) {
        showToast('error', UNDO_STILL_SYNCING_MESSAGE);
        return;
      }
      if (record.kind === 'delete') {
        // Re-insert the removed row locally (its id is still in the order snapshot).
        setChores((prev) =>
          prev.some((c) => c.id === id) ? prev : [...prev, deletedRow(id, before, versionBeforeDelete(id))],
        );
      } else {
        setChores((prev) => prev.map((c) => (c.id === id ? rowFromPayload(c, before) : c)));
      }
      if (showToast('neutral', UNDONE_MESSAGE, redoAction)) {
        undoRef.current = {
          ...record,
          phase: 'redo',
          currentVersion: null,
          outboxEntryId: null,
          cancelled: true,
          inFlight: false,
          toastId: toastIdRef.current,
        };
      } else {
        clearUndo();
      }
      return;
    }

    if (record.kind === 'delete') {
      if (isUndo) undoDelete(record);
      else redoDelete(record);
      return;
    }
    if (record.currentVersion === null) return;
    const version = record.currentVersion;
    const { isCurrent, markShown, settle } = beginUndoStep(record);
    const previousRow = chores.find((c) => c.id === id);
    let newVersion: number | null = null;

    const staleRefetch = () => void refetchChores(toastId);

    settle(
      mutate<ChoreWire>({
        optimisticApply: () =>
          setChores((prev) => prev.map((c) => (c.id === id ? rowFromPayload(c, target) : c))),
        request: () =>
          apiFetch(`/api/chores/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...target, version }),
          }),
        onSuccess: (data) => {
          newVersion = data.version;
          setChores((prev) => prev.map((c) => (c.id === id ? wireToChore(data) : c)));
        },
        onToastShown: () => {
          markShown();
          if (newVersion === null) return;
          undoRef.current = {
            ...record,
            phase: isUndo ? 'redo' : 'undo',
            currentVersion: newVersion,
            cancelled: false,
            inFlight: false,
            toastId: toastIdRef.current,
          };
        },
        onRollback: () => {
          if (!isCurrent()) {
            staleRefetch();
            return;
          }
          if (previousRow) setChores((prev) => prev.map((c) => (c.id === id ? previousRow : c)));
        },
        onNotFound: () => removeChoreLocal(id),
        onConflict: () => {
          if (isCurrent()) showToast('error', conflictMessage);
          staleRefetch();
        },
        onNetworkFailure: () => {
          if (!isCurrent()) {
            staleRefetch();
            return;
          }
          if (previousRow) setChores((prev) => prev.map((c) => (c.id === id ? previousRow : c)));
          showToast('error', failedMessage);
        },
        isToastAllowed: isCurrent,
        successTone: 'neutral',
        successMessage: doneMessage,
        successAction: nextAction,
        notFoundMessage: NOT_FOUND_MESSAGE,
        errorMessage: failedMessage,
      }),
    );
  }

  // Marks the record in flight (single-flight) and returns the identity guard plus the shared completion
  // plumbing: markShown from onToastShown, settle on the mutate promise (a success whose toast was
  // suppressed must not leave the record behind).
  function beginUndoStep(record: UndoRecord) {
    const toastId = record.toastId;
    undoRef.current = { ...record, inFlight: true };
    setUndoInFlight(true);
    let shown = false;
    return {
      isCurrent: () => undoRef.current?.toastId === toastId,
      markShown: () => {
        shown = true;
      },
      settle: (done: Promise<unknown>) =>
        void done.then(() => {
          if (!shown) clearUndoIfCurrent(toastId);
        }),
    };
  }

  // Online Undo of a delete: restore the soft-deleted chore (same id), then swap the placeholder row.
  function undoDelete(record: UndoRecord) {
    const id = record.choreId;
    const { isCurrent, markShown, settle } = beginUndoStep(record);
    const dropOptimisticRow = () => setChores((prev) => prev.filter((c) => c.id !== id));

    settle(
      mutate<ChoreWire>({
        optimisticApply: () =>
          setChores((prev) =>
            prev.some((c) => c.id === id)
              ? prev
              : [...prev, deletedRow(id, record.beforePayload, versionBeforeDelete(id))],
          ),
        request: () => apiFetch(`/api/chores/${id}/restore`, { method: 'PATCH' }),
        onSuccess: (data) => {
          const server = wireToChore(data);
          // A stale completion (the user acted again meanwhile) may only replace a row that is still there.
          setChores((prev) =>
            prev.some((c) => c.id === id)
              ? prev.map((c) => (c.id === id ? server : c))
              : isCurrent()
                ? [...prev, server]
                : prev,
          );
        },
        onToastShown: () => {
          markShown();
          // Redo of a delete is a version-less DELETE, so no version is stored.
          undoRef.current = {
            ...record,
            phase: 'redo',
            currentVersion: null,
            cancelled: false,
            inFlight: false,
            toastId: toastIdRef.current,
          };
        },
        onRollback: dropOptimisticRow,
        onNotFound: () => removeChoreLocal(id),
        onNetworkFailure: () => {
          dropOptimisticRow();
          if (isCurrent()) showToast('error', UNDO_FAILED_MESSAGE);
        },
        isToastAllowed: isCurrent,
        successTone: 'neutral',
        successMessage: UNDONE_MESSAGE,
        successAction: redoAction,
        notFoundMessage: RESTORE_NOT_FOUND_MESSAGE,
        errorMessage: UNDO_FAILED_MESSAGE,
      }),
    );
  }

  // Online Redo of a delete: DELETE again (version-less). A 404 means it is already gone: success, no Undo.
  function redoDelete(record: UndoRecord) {
    const id = record.choreId;
    const toastId = record.toastId;
    const { isCurrent, markShown, settle } = beginUndoStep(record);
    const previousRow = chores.find((c) => c.id === id);

    settle(
      mutate<null>({
        optimisticApply: () => setChores((prev) => prev.filter((c) => c.id !== id)),
        request: () => apiFetch(`/api/chores/${id}`, { method: 'DELETE' }),
        onSuccess: () => {},
        onToastShown: () => {
          markShown();
          undoRef.current = {
            ...record,
            phase: 'undo',
            currentVersion: null,
            cancelled: false,
            inFlight: false,
            toastId: toastIdRef.current,
          };
        },
        // A stale failure (the user acted again meanwhile) must not resurrect an old row: refetch instead.
        onRollback: () => {
          if (!isCurrent()) {
            void refetchChores(toastId);
            return;
          }
          if (previousRow)
            setChores((prev) => (prev.some((c) => c.id === id) ? prev : [...prev, previousRow]));
        },
        onNetworkFailure: () => {
          if (!isCurrent()) {
            void refetchChores(toastId);
            return;
          }
          if (previousRow)
            setChores((prev) => (prev.some((c) => c.id === id) ? prev : [...prev, previousRow]));
          showToast('error', REDO_FAILED_MESSAGE);
        },
        notFoundAsSuccess: true,
        isToastAllowed: isCurrent,
        successTone: 'neutral',
        successMessage: REDONE_MESSAGE,
        successAction: undoAction,
        errorMessage: REDO_FAILED_MESSAGE,
      }),
    );
  }

  function handleComplete(id: number, date: Date) {
    const payload = { dateLastCompleted: date.toISOString() };
    const originalRow = chores.find((c) => c.id === id);
    const original = originalRow?.dateLastCompleted;
    // Never offer Undo for an unsaved (temp-id) chore.
    const beforePayload = originalRow && id > 0 ? toEditablePayload(originalRow) : null;
    let serverRow: ChoreWithVersion | null = null;
    clearUndo();
    mutate<ChoreWire>({
      optimisticApply: () =>
        setChores((prev) => prev.map((c) => (c.id === id ? { ...c, dateLastCompleted: date } : c))),
      request: () =>
        apiFetch(`/api/chores/${id}/complete`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
      onSuccess: (data) => {
        serverRow = wireToChore(data);
        setChores((prev) => prev.map((c) => (c.id === id ? wireToChore(data) : c)));
      },
      // Redo re-applies what the server stored: /complete is forward-only and may keep a later date.
      successAction: beforePayload ? undoAction : undefined,
      onToastShown: () => {
        if (!beforePayload || !serverRow) return;
        armUndo({
          kind: 'complete',
          choreId: id,
          beforePayload,
          afterPayload: toEditablePayload(serverRow),
          currentVersion: serverRow.version,
          outboxEntryId: null,
        });
      },
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
        const entry = append({ type: 'complete', choreId: id, payload });
        const shown = showToast('neutral', OFFLINE_MESSAGE, beforePayload ? undoAction : undefined);
        if (shown && beforePayload && originalRow) {
          armUndo({
            kind: 'complete',
            choreId: id,
            beforePayload,
            afterPayload: toEditablePayload({ ...originalRow, dateLastCompleted: date }),
            currentVersion: null,
            outboxEntryId: entry.id,
          });
        }
      },
      successMessage: 'Chore completed',
      errorMessage: "Couldn't mark the chore complete. Please try again.",
    });
  }

  function handleDelete(id: number) {
    const removed = chores.find((c) => c.id === id);
    // Never offer Undo for an unsaved (temp-id) chore.
    const beforePayload = removed && id > 0 ? toEditablePayload(removed) : null;
    if (removed && beforePayload) deletedVersionsRef.current.set(id, removed.version);
    clearUndo();
    mutate<null>({
      optimisticApply: () => setChores((prev) => prev.filter((c) => c.id !== id)),
      request: () => apiFetch(`/api/chores/${id}`, { method: 'DELETE' }),
      onSuccess: () => {},
      successAction: beforePayload ? undoAction : undefined,
      onToastShown: () => {
        if (!beforePayload) return;
        armUndo({
          kind: 'delete',
          choreId: id,
          beforePayload,
          afterPayload: beforePayload,
          currentVersion: null,
          outboxEntryId: null,
        });
      },
      onRollback: () => {
        if (!removed) return;
        setChores((prev) => (prev.some((c) => c.id === id) ? prev : [...prev, removed]));
      },
      notFoundAsSuccess: id > 0,
      onNetworkFailure: () => {
        const entry = append({ type: 'delete', choreId: id });
        const shown = showToast('neutral', OFFLINE_MESSAGE, beforePayload ? undoAction : undefined);
        if (shown && beforePayload) {
          armUndo({
            kind: 'delete',
            choreId: id,
            beforePayload,
            afterPayload: beforePayload,
            currentVersion: null,
            outboxEntryId: entry.id,
          });
        }
      },
      successMessage: 'Chore deleted',
      errorMessage: "Couldn't delete the chore. Please try again.",
    });
  }

  function handleAddSubmit(input: Omit<Chore, 'id'>) {
    const tempId = -Date.now();
    const payload = toChorePayload(input);
    clearUndo();
    setIsAddOpen(false);
    setQuery('');
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
    });
  }

  function handleEditSubmit(input: Omit<Chore, 'id'>) {
    const id = editingId;
    if (id == null) return;
    applyEdit(id, input);
  }

  // The edit itself, independent of the modal: also used by Redo after an offline cancel (no editingId).
  function applyEdit(id: number, input: Omit<Chore, 'id'>) {
    clearUndo();
    const existing = chores.find((c) => c.id === id);
    const beforePayload = existing && id > 0 ? toEditablePayload(existing) : null;
    let newVersion: number | null = null;
    const baseVersion = existing?.version ?? 1;
    const payload = toChorePayload(input);
    // Fields this edit actually changes, with their pre-edit values.
    const changed: [keyof typeof input, unknown][] = [];
    if (existing) {
      for (const key of Object.keys(input) as (keyof typeof input)[]) {
        const before = existing[key];
        const after = input[key];
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
      onSuccess: (data) => {
        newVersion = data.version;
        setChores((prev) => prev.map((c) => (c.id === id ? wireToChore(data) : c)));
      },
      successAction: beforePayload ? undoAction : undefined,
      onToastShown: () => {
        if (!beforePayload || newVersion === null) return;
        armUndo({
          kind: 'edit',
          choreId: id,
          beforePayload,
          afterPayload: payload,
          currentVersion: newVersion,
          outboxEntryId: null,
        });
      },
      onRollback: () =>
        setChores((prev) =>
          prev.map((c) => {
            if (c.id !== id) return c;
            const revert: Partial<Omit<Chore, 'id'>> = {};
            for (const [key, before] of changed) {
              if (sameValue(c[key], input[key])) Object.assign(revert, { [key]: before });
            }
            return { ...c, ...revert };
          }),
        ),
      onNotFound: id > 0 ? () => removeChoreLocal(id) : undefined,
      onConflict: () => setConflictChoreId(id),
      onNetworkFailure: () => {
        const entry = append({ type: 'edit', choreId: id, baseVersion, payload });
        const shown = showToast('neutral', OFFLINE_MESSAGE, beforePayload ? undoAction : undefined);
        if (shown && beforePayload) {
          armUndo({
            kind: 'edit',
            choreId: id,
            beforePayload,
            afterPayload: payload,
            currentVersion: null,
            outboxEntryId: entry.id,
          });
        }
      },
      successMessage: 'Changes saved',
      errorMessage: "Couldn't save your changes. Please try again.",
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
  const searchedChores = useChoreSearch(visibleChores, query);
  const statusCounts = choreStatusCounts(searchedChores, today, householdTimezone);
  const showStrip = hasLoaded && !(isStale && chores.length === 0);
  const trimmedQuery = query.trim();
  const searchDisabled = isStale && chores.length === 0;
  // A disabled focused input does not reliably fire blur, so drop the stale focus flag when it disables.
  // Derive-during-render reset (React-supported) rather than an effect.
  if (searchDisabled && isSearchFocused) setIsSearchFocused(false);
  // Only a touch soft keyboard rides over the results, so only touch devices hide the deck.
  const deckHidden = isTouch && isSearchFocused && !searchDisabled;
  const noMatchMessage = `No chores match “${trimmedQuery}”${selectedRoom !== 'all' ? ' in this room' : ''}.`;
  let searchStatus = '';
  if (trimmedQuery !== '' && chores.length > 0) {
    searchStatus =
      searchedChores.length > 0
        ? `${searchedChores.length} of ${visibleChores.length} chores`
        : noMatchMessage;
  }

  const focusSentinel = useCallback(() => focusTargetRef.current?.focus({ preventScroll: true }), []);
  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    focusSentinel();
  };

  return (
    <div ref={rootRef} className="flex-1 flex flex-col">
      <div
        ref={focusTargetRef}
        data-testid="focus-target"
        tabIndex={-1}
        className="h-0 w-0 overflow-hidden outline-none"
      />
      {showStrip && <StatusCountStrip counts={statusCounts} />}
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
        <div className="flex items-center gap-2 mb-3">
          <ChoreSearchInput
            ref={searchInputRef}
            value={query}
            onChange={setQuery}
            disabled={searchDisabled}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            onClearWhileDisabled={focusSentinel}
          />
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Settings"
            title="Settings"
            className="h-11 w-11 flex-none flex items-center justify-center rounded-lg bg-gray-700 hover:bg-gray-600 text-white"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>
      {/* Search result announcer: always mounted, a sibling of (not inside) the list's
          aria-live container below so list re-renders never double-announce. */}
      <div role="status" aria-live="polite" className="sr-only">
        {searchStatus}
      </div>
      {/* Stable aria-live region (DD5): the container stays mounted at all times
          and only its children swap, so a transition between the can't-load
          block / benign-empty-room state / populated list is announced to
          screen readers independently of the StatusBanner's own role="status". */}
      {/* pb-4 only: the in-flow sticky Add Chore deck below keeps the last bar above it. */}
      <div aria-live="polite" className="flex-1 pb-4">
        {isStale && chores.length === 0 ? (
          <div data-testid="chores-unavailable" className="text-center py-8">
            <h3 className="text-amber-300 text-base font-semibold mb-2">Can't load your chores right now.</h3>
            <p className="text-gray-400 text-sm max-w-sm mx-auto">
              {online
                ? "We couldn't reach the server and there's no saved copy on this device. Check your connection, or tap Retry above to sign in again."
                : "We couldn't reach the server and there's no saved copy on this device. Check your connection — we'll reconnect automatically once you're back online."}
            </p>
          </div>
        ) : trimmedQuery !== '' && chores.length > 0 && searchedChores.length === 0 ? (
          <div data-testid="chores-no-match" className="text-center">
            <p className="text-gray-400 text-center py-8 break-words">{noMatchMessage}</p>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQuery('');
                searchInputRef.current?.focus();
              }}
              className="min-h-[44px] px-4 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm"
            >
              Show all chores
            </button>
          </div>
        ) : chores.length > 0 && visibleChores.length === 0 ? (
          <p data-testid="chores-empty-room" className="text-gray-400 text-center py-8">
            No chores in this room.
          </p>
        ) : (
          <ChoreList
            chores={applyOrder(searchedChores, orderSnapshot?.ids ?? [])}
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
      {/* Sticky bottom deck: always mounted (addChoreRef must stay valid). On touch devices it is
          invisible (not hidden) while the search box is focused so it stays in flow and nothing shifts. */}
      <div
        data-testid="add-chore-deck"
        className={`sticky bottom-0 z-20 pointer-events-none -mx-4 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-6${deckHidden ? ' invisible' : ''}`}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none backdrop-blur-md bg-gradient-to-t from-gray-900/90 via-gray-900/70 to-transparent deck-fade"
        />
        <div className="relative pointer-events-auto flex justify-center">
          <button
            ref={addChoreRef}
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg min-h-[44px] w-full max-w-sm focus-visible:outline-2 focus-visible:outline-indigo-400"
          >
            + Add Chore
          </button>
        </div>
      </div>
      <ScrollToTopButton
        visible={pastThreshold && !deckHidden}
        onActivate={handleScrollToTop}
        onRelinquishFocus={focusSentinel}
      />
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
      <Toast toast={toast} onDismiss={dismissToast} paused={modalOpen} holding={undoInFlight} />
    </div>
  );
}
