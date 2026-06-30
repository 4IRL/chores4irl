import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays } from 'date-fns';
import { useMidnightClock } from './hooks/useMidnightClock';
import { useRoomFilter } from './hooks/useRoomFilter';
import { useChoreEvents } from './hooks/useChoreEvents';
import { orderChores } from './utils/choreSort';
import NavBar from './components/nav/NavBar';
import DateNavigationBanner from './components/nav/DateNavigationBanner';
import ReturnToTodayButton from './components/nav/ReturnToTodayButton';
import ChoreList from './components/chore/ChoreList';
import AddChoreButton from './components/form/AddChoreButton';
import ChoreFormModal from './components/form/ChoreFormModal';
import ConfirmDialog from './components/common/ConfirmDialog';
import { fetchAllChores, addChore, completeChore, removeChore, updateChore } from './services/choreApi';
import type { Chore } from '@customTypes/SharedTypes';

export default function App() {
    const realToday = useMidnightClock();
    const [dayOffset, setDayOffset] = useState<number>(0);
    const simulatedDate = useMemo(() => addDays(realToday, dayOffset), [realToday, dayOffset]);
    const isSimulating = dayOffset > 0;
    const [selectedRoom, setSelectedRoom] = useState<string>('all');
    const [showForm, setShowForm] = useState<boolean>(false);
    const [choreData, setChoreData] = useState<Chore[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
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
                    setError(err instanceof Error ? err.message : 'Failed to load chores');
                    setLoading(false);
                }
            }),
        [reconcileChores]
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
    const orderedChores = useMemo(() => {
        const choreMap = new Map(filteredChores.map(c => [c.id, c]));
        return sortedIds
            .map(id => choreMap.get(id))
            .filter((c): c is Chore => c !== undefined);
    }, [sortedIds, filteredChores]);

    async function handleAddChore(newChore: Omit<Chore, 'id'>) {
        isMutatingRef.current = true;
        try {
            const created = await addChore(newChore);
            setChoreData(prev => [...prev, created]);
            setSortedIds(prev => [...prev, created.id]);
            setShowForm(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add chore');
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
        } catch (err) {
            setChoreData(curr => curr.some(chore => chore.id === id) ? curr : [...curr, deletedChore]);
            setSortedIds(prevSortedIds);
            setError(err instanceof Error ? err.message : 'Failed to delete chore');
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
            setChoreData(curr => curr.map(chore => chore.id === id ? updated : chore));
        } catch (err) {
            setChoreData(curr => curr.map(chore => chore.id === id ? originalChore : chore));
            setError(err instanceof Error ? err.message : 'Failed to mark chore complete');
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
            setChoreData(curr => curr.map(chore => chore.id === id ? updated : chore));
        } catch (err) {
            setChoreData(curr => curr.map(chore => chore.id === id ? originalChore : chore));
            setError(err instanceof Error ? err.message : 'Failed to update chore');
        } finally {
            isMutatingRef.current = false;
            flushPendingRefresh();
        }
    }

    if (loading) {
        return (
            <div className="App">
                <div className="mx-auto px-4 bg-gray-900 h-screen flex items-center justify-center">
                    <div className="text-white text-lg">Loading chores...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="App h-full flex flex-col overflow-hidden">
            <div className="flex flex-col h-full overflow-hidden bg-gray-900 px-4 pt-4">
                {error && (
                    <div className="mb-4 p-3 bg-red-700 text-white rounded-lg text-sm flex justify-between items-center flex-shrink-0">
                        <span>{error}</span>
                        <button onClick={() => setError(null)} className="ml-4 underline">Dismiss</button>
                    </div>
                )}
                <NavBar rooms={uniqueRooms} selectedRoom={selectedRoom} onSelect={setSelectedRoom} />
                <DateNavigationBanner
                    simulatedDate={simulatedDate}
                    dayOffset={dayOffset}
                    onPrev={() => setDayOffset(o => Math.max(0, o - 1))}
                    onNext={() => setDayOffset(o => o + 1)}
                />
                <ReturnToTodayButton dayOffset={dayOffset} onReset={() => setDayOffset(0)} />
                <div className="flex-1 overflow-y-auto min-h-0">
                    <ChoreList chores={orderedChores} day={simulatedDate} isSimulating={isSimulating} onComplete={handleCompleteChore} onDelete={handleRequestDelete} onEdit={handleRequestEdit} />
                </div>
                <div className="flex-shrink-0 py-4 flex justify-center border-t border-gray-700">
                    <AddChoreButton onClick={() => { setEditingId(null); setShowForm(true); }} />
                </div>
            </div>
            {showForm && <ChoreFormModal rooms={uniqueRooms} onSubmit={handleAddChore} onCancel={() => setShowForm(false)} />}
            {!showForm && editingChore && (
                <ChoreFormModal
                    mode="edit"
                    initialChore={editingChore}
                    rooms={uniqueRooms}
                    onSubmit={edited => handleEditChore(editingChore.id, edited)}
                    onCancel={handleCancelEdit}
                />
            )}
            {pendingChore && (
                <ConfirmDialog
                    message={`Delete "${pendingChore.name}"? This can't be undone.`}
                    onConfirm={handleConfirmDelete}
                    onCancel={handleCancelDelete}
                />
            )}
        </div>
    );
}
