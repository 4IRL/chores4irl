import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays } from 'date-fns';
import { useMidnightClock } from './hooks/useMidnightClock';
import { useRoomFilter } from './hooks/useRoomFilter';
import { useChoreEvents } from './hooks/useChoreEvents';
import { useScreenBlank } from './hooks/useScreenBlank';
import { useTouchLock } from './hooks/useTouchLock';
import { orderChores } from './utils/choreSort';
import { countStatuses } from './utils/choreStatusCounts';
import NavBar from './components/nav/NavBar';
import StatusCountStrip from './components/nav/StatusCountStrip';
import DateNavigationBanner from './components/nav/DateNavigationBanner';
import ReturnToTodayButton from './components/nav/ReturnToTodayButton';
import ChoreList from './components/chore/ChoreList';
import ChoreSearchInput from './components/chore/ChoreSearchInput';
import AddChoreButton from './components/form/AddChoreButton';
import ChoreFormModal from './components/form/ChoreFormModal';
import ConfirmDialog from './components/common/ConfirmDialog';
import OverlayScrollbar from './components/common/OverlayScrollbar';
import ScreenBlankOverlay from './components/common/ScreenBlankOverlay';
import ScrollToTopButton from './components/common/ScrollToTopButton';
import Toast from './components/common/Toast';
import TouchLockIndicator from './components/common/TouchLockIndicator';
import TouchLockOverlay, { CLOSING_SETTLE_MS, type TapPoint } from './components/common/TouchLockOverlay';
import { fetchAllChores, addChore, completeChore, removeChore, updateChore } from './services/choreApi';
import type { Chore } from '@customTypes/SharedTypes';

type ToastState = { id: number; tone: 'success' | 'error'; message: string };

// F22: the list thumb's track stops this far above the frame bottom, so at the end of
// its travel the thumb's bottom meets the bottom of the last chore bar: the Add Task
// deck's 80 px (py-4 + the 48 px button) plus ChoreList's pb-4 (16 px), measured in
// Chromium at 1280×600, 600×1024 and 600×700. Re-check it if the deck's height or the
// list's bottom padding changes (Standing invariant 12); e2e/overlay-scrollbar.spec.ts
// pins the alignment.
const LIST_THUMB_BOTTOM_INSET_PX = 96;

export default function App() {
    const realToday = useMidnightClock();
    const { isBlanked, wake } = useScreenBlank();
    const { isLocked, arm, lock } = useTouchLock();
    const closingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // F20: a guarded attempt (a blocked tap/swipe/sr-only Edit/Delete on a chore
    // bar while locked) mounts TouchLockOverlay seeded at that point. The id keys
    // the overlay so each new attempt remounts it fresh (full opacity, new window).
    const [lockAttempt, setLockAttempt] = useState<{ id: number; point: TapPoint } | null>(null);
    const lockAttemptIdRef = useRef<number>(0);
    const [dayOffset, setDayOffset] = useState<number>(0);
    const simulatedDate = useMemo(() => addDays(realToday, dayOffset), [realToday, dayOffset]);
    const isSimulating = dayOffset > 0;
    const [selectedRoom, setSelectedRoom] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [showForm, setShowForm] = useState<boolean>(false);
    const [choreData, setChoreData] = useState<Chore[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [toast, setToast] = useState<ToastState | null>(null);
    const toastIdRef = useRef<number>(0);
    const [sortedIds, setSortedIds] = useState<number[]>([]);
    const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const choreDataRef = useRef<Chore[]>(choreData);
    choreDataRef.current = choreData;
    // Kept current for callbacks that run outside React's render flow (SSE re-pull,
    // which needs the live simulated date to order newly-seen chores).
    const simulatedDateRef = useRef<Date>(simulatedDate);
    simulatedDateRef.current = simulatedDate;
    // True while a mutation's network round-trip is in flight; gates event-driven
    // re-pulls so a stale signal can't clobber an optimistic write mid-flight.
    const isMutatingRef = useRef<boolean>(false);
    // Set when a "chores changed" signal arrives while the re-pull is gated; the
    // deferred refresh runs once the gate clears.
    const pendingRefreshRef = useRef<boolean>(false);
    // The single ref on the .overflow-y-auto scroller, shared by F18 (read and
    // scroll to top), F19 (reset on lock) and F22 (overlay thumb). Never add a
    // second ref on that element.
    const scrollRegionRef = useRef<HTMLDivElement>(null);

    // F21: one toast at a time — a new one replaces the current. The id keys
    // the element so an identical message remounts it and restarts its timer.
    const showToast = useCallback((tone: ToastState['tone'], message: string) => {
        toastIdRef.current += 1;
        setToast({ id: toastIdRef.current, tone, message });
    }, []);
    const dismissToast = useCallback(() => setToast(null), []);

    // Re-pulls clobber local state, so defer them while a write is in flight or a
    // form/dialog is open (those hold un-committed user input or optimistic values).
    const isRepullGated = useCallback(
        () => isMutatingRef.current || showForm || editingId !== null || pendingDeleteId !== null,
        [showForm, editingId, pendingDeleteId]
    );

    // Apply a freshly-fetched list, reconciling display order: keep the order of
    // ids still present, append newly-seen ids (sorted), drop ids that vanished.
    const reconcileChores = useCallback((fetched: Chore[]) => {
        setChoreData(fetched);
        setSortedIds(prev => {
            const fetchedIds = new Set(fetched.map(chore => chore.id));
            const kept = prev.filter(id => fetchedIds.has(id));
            const keptIds = new Set(kept);
            const newOnes = fetched.filter(chore => !keptIds.has(chore.id));
            const appended = orderChores(newOnes, simulatedDateRef.current).map(chore => chore.id);
            return [...kept, ...appended];
        });
    }, []);

    // Re-pull the current truth from the server. The initial load owns the
    // loading/error UI; event-driven re-pulls swallow transient blips so a flaky
    // refresh never blanks a working screen.
    const loadChores = useCallback((initial = false) =>
        fetchAllChores()
            .then(chores => {
                reconcileChores(chores);
                if (initial) setLoading(false);
            })
            .catch((err: unknown) => {
                if (initial) {
                    showToast('error', err instanceof Error ? err.message : 'Failed to load chores');
                    setLoading(false);
                }
            }),
        [reconcileChores, showToast]
    );

    // Run a deferred re-pull if one is pending and the gate has cleared. Called
    // after each mutation settles and whenever a form/dialog closes.
    const flushPendingRefresh = useCallback(() => {
        if (pendingRefreshRef.current && !isRepullGated()) {
            pendingRefreshRef.current = false;
            void loadChores();
        }
    }, [isRepullGated, loadChores]);

    // A "chores changed" signal from another device: re-pull now if safe, else
    // defer until the gate clears so we never clobber an open form or in-flight write.
    const handleRemoteChange = useCallback(() => {
        if (isRepullGated()) {
            pendingRefreshRef.current = true;
        } else {
            void loadChores();
        }
    }, [isRepullGated, loadChores]);

    useChoreEvents(handleRemoteChange);

    useEffect(() => {
        void loadChores(true);
        // Run once on mount; loadChores is stable across renders.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // A form/dialog closing can clear the gate — flush any deferred refresh.
    useEffect(() => {
        flushPendingRefresh();
    }, [showForm, editingId, pendingDeleteId, flushPendingRefresh]);

    // Blanking begins: close any open confirm-dialog/form so nothing stays
    // keyboard-reachable in a createPortal layer behind the blank's inert gate.
    // A lock engaging (idle or manual) closes them too, as abandonment (Open risk
    // (b)) — the F20 lock is no longer inert, it guards in the bars. Both drop any
    // stale guarded attempt, so its padlock never reappears after a wake.
    useEffect(() => {
        if (isBlanked || isLocked) {
            setPendingDeleteId(null);
            setEditingId(null);
            setShowForm(false);
            setLockAttempt(null);
        }
    }, [isBlanked, isLocked]);

    // F19: the lock engaging returns the view to the boot state — top of the
    // list, every room, no search, today — so the next person at the kiosk
    // meets the canonical view. Lock-only (never on blank or unlock); the
    // scroll is instant because the lock engages on idle expiry, when nobody is
    // watching the board.
    // F20 note: once useTouchLock exposes an idle-expiry tick, re-key this to
    // also re-run on each tick while locked and on a manual lock, first closing
    // an Add modal left open under the lock (META-PLAN F19 "Amended by F20").
    useEffect(() => {
        if (!isLocked) return;
        if (scrollRegionRef.current) scrollRegionRef.current.scrollTop = 0;
        setSelectedRoom('all');
        setSearchQuery('');
        setDayOffset(0);
    }, [isLocked]);

    // Clear any pending close-animation hand-off timer on unmount.
    useEffect(() => {
        return () => {
            if (closingTimerRef.current) clearTimeout(closingTimerRef.current);
        };
    }, []);

    useEffect(() => {
        if (choreDataRef.current.length > 0) {
            setSortedIds(orderChores(choreDataRef.current, simulatedDate).map(c => c.id));
        }
    }, [simulatedDate]);

    const uniqueRooms = useMemo(
        () => Array.from(new Set(choreData.map(chore => chore.room))),
        [choreData]
    );

    const pendingChore = pendingDeleteId !== null ? choreData.find(c => c.id === pendingDeleteId) : undefined;
    const editingChore = editingId !== null ? choreData.find(c => c.id === editingId) : undefined;

    const filteredChores = useRoomFilter(choreData, selectedRoom);
    // View-only substring filter on chore name, composed with the room filter (AND).
    // Derived from filteredChores; never mutates choreData or sortedIds.
    const searchFilteredChores = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (query === '') return filteredChores;
        return filteredChores.filter(c => c.name.toLowerCase().includes(query));
    }, [filteredChores, searchQuery]);
    // F17: live tally of the visible list for the displayed day — from choreData, never sortedIds.
    const statusCounts = useMemo(
        () => countStatuses(searchFilteredChores, simulatedDate),
        [searchFilteredChores, simulatedDate]
    );
    const orderedChores = useMemo(() => {
        const choreMap = new Map(searchFilteredChores.map(c => [c.id, c]));
        return sortedIds
            .map(id => choreMap.get(id))
            .filter((c): c is Chore => c !== undefined);
    }, [sortedIds, searchFilteredChores]);

    async function handleAddChore(newChore: Omit<Chore, 'id'>) {
        isMutatingRef.current = true;
        try {
            const created = await addChore(newChore);
            showToast('success', `Added "${created.name}"`);
            setChoreData(prev => [...prev, created]);
            setSortedIds(prev => [...prev, created.id]);
            setShowForm(false);
        } catch (err) {
            showToast('error', err instanceof Error ? err.message : 'Failed to add chore');
        } finally {
            isMutatingRef.current = false;
            flushPendingRefresh();
        }
    }

    async function handleDeleteChore(id: number): Promise<void> {
        const deletedChore = choreData.find(chore => chore.id === id);
        if (!deletedChore) return;
        const prevSortedIds = sortedIds;
        setChoreData(curr => curr.filter(chore => chore.id !== id));
        setSortedIds(prev => prev.filter(sortedId => sortedId !== id));
        isMutatingRef.current = true;
        try {
            await removeChore(id);
            showToast('success', `Deleted "${deletedChore.name}"`);
        } catch (err) {
            setChoreData(curr => curr.some(chore => chore.id === id) ? curr : [...curr, deletedChore]);
            setSortedIds(prevSortedIds);
            showToast('error', err instanceof Error ? err.message : 'Failed to delete chore');
        } finally {
            isMutatingRef.current = false;
            flushPendingRefresh();
        }
    }

    function handleRequestDelete(id: number) {
        setPendingDeleteId(id);
    }

    function handleCancelDelete() {
        setPendingDeleteId(null);
    }

    function handleConfirmDelete() {
        const id = pendingDeleteId;
        setPendingDeleteId(null);
        if (id !== null) void handleDeleteChore(id);
    }

    async function handleCompleteChore(id: number, date: Date): Promise<void> {
        if (isSimulating) return;
        const originalChore = choreData.find(chore => chore.id === id);
        if (!originalChore) return;
        setChoreData(curr =>
            curr.map(chore => chore.id === id ? { ...chore, dateLastCompleted: date } : chore)
        );
        isMutatingRef.current = true;
        try {
            const updated = await completeChore(id, date);
            // F21: no success toast for a bar tap (scope is the three form-driven
            // mutations), but a successful retry must retire a standing failure —
            // META-PLAN: the next successful mutation replaces it.
            setToast(prev => (prev?.tone === 'error' ? null : prev));
            setChoreData(curr => curr.map(chore => chore.id === id ? updated : chore));
        } catch (err) {
            setChoreData(curr => curr.map(chore => chore.id === id ? originalChore : chore));
            showToast('error', err instanceof Error ? err.message : 'Failed to mark chore complete');
        } finally {
            isMutatingRef.current = false;
            flushPendingRefresh();
        }
    }

    function handleRequestEdit(id: number) {
        setShowForm(false);
        setEditingId(id);
    }

    function handleCancelEdit() {
        setEditingId(null);
    }

    async function handleEditChore(id: number, edited: Omit<Chore, 'id'>): Promise<void> {
        const originalChore = choreData.find(chore => chore.id === id);
        if (!originalChore) return;
        setChoreData(curr => curr.map(chore => chore.id === id ? { ...originalChore, ...edited } : chore));
        setEditingId(null);
        isMutatingRef.current = true;
        try {
            const updated = await updateChore(id, edited);
            showToast('success', `Saved "${updated.name}"`);
            setChoreData(curr => curr.map(chore => chore.id === id ? updated : chore));
        } catch (err) {
            setChoreData(curr => curr.map(chore => chore.id === id ? originalChore : chore));
            showToast('error', err instanceof Error ? err.message : 'Failed to update chore');
        } finally {
            isMutatingRef.current = false;
            flushPendingRefresh();
        }
    }

    // F20: a chore bar reports a destructive attempt made while locked; show the
    // padlock seeded with it as the first tap of the unlock double-tap.
    const handleGuardedAttempt = (point: TapPoint) => {
        lockAttemptIdRef.current += 1;
        setLockAttempt({ id: lockAttemptIdRef.current, point });
    };

    // A qualifying double-tap unlocks immediately, but the overlay's own
    // 'opening'-phase animation still needs to finish visually — lockAttempt
    // stays set for CLOSING_SETTLE_MS so TouchLockOverlay stays mounted for that
    // (the CLOSING_SETTLE_MS handshake). A stale timer clears whatever attempt is
    // current when it fires; that is non-destructive (DD-4).
    const handleArm = () => {
        arm();
        if (closingTimerRef.current) clearTimeout(closingTimerRef.current);
        closingTimerRef.current = setTimeout(() => setLockAttempt(null), CLOSING_SETTLE_MS);
    };

    // DD-3: unlocking from the corner indicator also drops a pending attempt's
    // padlock at once (there is no opening animation to wait for).
    const handleIndicatorUnlock = () => {
        arm();
        setLockAttempt(null);
    };

    if (loading) {
        return (
            // The root gate is blank-only: under F20 the lock no longer makes the
            // app inert, it guards destructive actions in the chore bars (there
            // are none here, so no attempt overlay either).
            <div className="App" inert={isBlanked}>
                <TouchLockIndicator isLocked={isLocked} onLock={lock} onUnlock={arm} />
                <div className="mx-auto px-4 bg-gray-900 h-screen flex items-center justify-center">
                    <div className="text-white text-lg">Loading chores...</div>
                </div>
                {isBlanked && <ScreenBlankOverlay onWake={wake} />}
            </div>
        );
    }

    return (
        // The root gate is blank-only: under F20 the lock no longer makes the app
        // inert, it guards destructive actions in the chore bars.
        <div className="App h-full flex flex-col overflow-hidden" inert={isBlanked}>
            <TouchLockIndicator
                isLocked={isLocked}
                onLock={lock}
                onUnlock={handleIndicatorUnlock}
                raised={lockAttempt !== null}
            />
            <div className="flex flex-col h-full overflow-hidden bg-gray-900 pt-4">
                <NavBar rooms={uniqueRooms} selectedRoom={selectedRoom} onSelect={setSelectedRoom} />
                <StatusCountStrip counts={statusCounts} />
                <DateNavigationBanner
                    simulatedDate={simulatedDate}
                    dayOffset={dayOffset}
                    onPrev={() => setDayOffset(o => Math.max(0, o - 1))}
                    onNext={() => setDayOffset(o => o + 1)}
                />
                <ReturnToTodayButton dayOffset={dayOffset} onReset={() => setDayOffset(0)} />
                <ChoreSearchInput value={searchQuery} onChange={setSearchQuery} />
                {/* F18: the positioned frame the scroll-to-top button and F22's overlay
                    thumb anchor against, so they neither scroll away with the list nor
                    become sticky children of the deck's region. One frame only; the
                    scroller inside keeps its exact class string (F22 adds only
                    scrollbar-none). The thumb reads the same single scrollRegionRef and
                    sits before the button so the button stays the frame's last child; its
                    track stops LIST_THUMB_BOTTOM_INSET_PX above the frame bottom, level
                    with the last bar at full scroll. Neither has a z-index: both paint
                    over the frost by DOM order. */}
                <div data-testid="scroll-region-frame" className="relative flex-1 min-h-0 flex flex-col">
                    <div ref={scrollRegionRef} className="flex-1 overflow-y-auto min-h-0 flex flex-col scroll-pb-40 scrollbar-none">
                        <ChoreList chores={orderedChores} day={simulatedDate} isSimulating={isSimulating} isLocked={isLocked} onGuardedAttempt={handleGuardedAttempt} onComplete={handleCompleteChore} onDelete={handleRequestDelete} onEdit={handleRequestEdit} />
                        {/* F5: sticky frosted deck — mt-auto pins it to the bottom when the list is
                            short; sticky keeps it pinned while a long list scrolls beneath the blur.
                            The tint + blur live on a backing layer that reaches 4rem above the deck
                            and is masked transparent→opaque over that overhang, so the frost fades in
                            over the list instead of ending at a hard edge; the button sits above the
                            backing (positioned, later in DOM) and stays fully opaque.
                            scroll-pb-40 tells scrollIntoView/focus that the deck's footprint plus the
                            fade overhang is obscured, so bars are never scrolled to rest under it. */}
                        <div
                            data-testid="add-task-deck"
                            className="sticky bottom-0 mt-auto flex-shrink-0 flex justify-center py-4"
                        >
                            <div
                                aria-hidden="true"
                                data-testid="add-task-deck-backing"
                                className="pointer-events-none absolute inset-x-0 -top-16 bottom-0 bg-gray-900/60 backdrop-blur-sm [mask-image:linear-gradient(to_bottom,transparent,black_4rem)]"
                            />
                            <div className="relative">
                                <AddChoreButton onClick={() => { setEditingId(null); setShowForm(true); }} />
                            </div>
                        </div>
                    </div>
                    <OverlayScrollbar scrollRegionRef={scrollRegionRef} trackInsetBottomPx={LIST_THUMB_BOTTOM_INSET_PX} />
                    <ScrollToTopButton scrollRegionRef={scrollRegionRef} />
                </div>
            </div>
            {/* F21: inline (not portaled) so the root's inert covers it while blanked,
                like the strip it replaces; fixed, so DOM position is layout-neutral. */}
            {toast && <Toast key={toast.id} tone={toast.tone} message={toast.message} onDismiss={dismissToast} />}
            {showForm && (
                <ChoreFormModal
                    rooms={uniqueRooms}
                    defaultRoom={selectedRoom === 'all' ? '' : selectedRoom}
                    onSubmit={handleAddChore}
                    onCancel={() => setShowForm(false)}
                />
            )}
            {/* DD-14: the edit modal and ConfirmDialog are gated on !isLocked — the
                force-close effect clears their state one passive-effect after the lock
                commits, and with the root no longer inert that gap would leave them
                clickable. The Add form stays allowed while locked. */}
            {!showForm && !isLocked && editingChore && (
                <ChoreFormModal
                    mode="edit"
                    initialChore={editingChore}
                    rooms={uniqueRooms}
                    onSubmit={edited => handleEditChore(editingChore.id, edited)}
                    onCancel={handleCancelEdit}
                />
            )}
            {pendingChore && !isLocked && (
                <ConfirmDialog
                    message={`Delete "${pendingChore.name}"? This can't be undone.`}
                    onConfirm={handleConfirmDelete}
                    onCancel={handleCancelDelete}
                />
            )}
            {isBlanked && <ScreenBlankOverlay onWake={wake} />}
            {lockAttempt && !isBlanked && (
                <TouchLockOverlay
                    key={lockAttempt.id}
                    firstTap={lockAttempt.point}
                    onArm={handleArm}
                    onDismiss={() => setLockAttempt(null)}
                />
            )}
        </div>
    );
}
