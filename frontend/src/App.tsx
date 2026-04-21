import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays } from 'date-fns';
import { useMidnightClock } from './hooks/useMidnightClock';
import { useRoomFilter } from './hooks/useRoomFilter';
import { orderChores } from './utils/choreSort';
import NavBar from './components/nav/NavBar';
import DateNavigationBanner from './components/nav/DateNavigationBanner';
import ChoreList from './components/chore/ChoreList';
import AddChoreButton from './components/form/AddChoreButton';
import ChoreFormModal from './components/form/ChoreFormModal';
import { fetchAllChores, addChore, completeChore, removeChore } from './services/choreApi';
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
    const choreDataRef = useRef<Chore[]>(choreData);
    choreDataRef.current = choreData;

    useEffect(() => {
        fetchAllChores()
            .then(chores => {
                setChoreData(chores);
                setSortedIds(orderChores(chores, simulatedDate).map(c => c.id));
                setLoading(false);
            })
            .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : 'Failed to load chores');
                setLoading(false);
            });
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

    const filteredChores = useRoomFilter(choreData, selectedRoom);
    const orderedChores = useMemo(() => {
        const choreMap = new Map(filteredChores.map(c => [c.id, c]));
        return sortedIds
            .map(id => choreMap.get(id))
            .filter((c): c is Chore => c !== undefined);
    }, [sortedIds, filteredChores]);

    async function handleAddChore(newChore: Omit<Chore, 'id'>) {
        try {
            const created = await addChore(newChore);
            setChoreData(prev => [...prev, created]);
            setSortedIds(prev => [...prev, created.id]);
            setShowForm(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add chore');
        }
    }

    async function handleDeleteChore(id: number): Promise<void> {
        const deletedChore = choreData.find(chore => chore.id === id);
        if (!deletedChore) return;
        const prevSortedIds = sortedIds;
        setChoreData(curr => curr.filter(chore => chore.id !== id));
        setSortedIds(prev => prev.filter(sortedId => sortedId !== id));
        try {
            await removeChore(id);
        } catch (err) {
            setChoreData(curr => curr.some(chore => chore.id === id) ? curr : [...curr, deletedChore]);
            setSortedIds(prevSortedIds);
            setError(err instanceof Error ? err.message : 'Failed to delete chore');
        }
    }

    async function handleCompleteChore(id: number, date: Date): Promise<void> {
        if (isSimulating) return;
        const originalChore = choreData.find(chore => chore.id === id);
        if (!originalChore) return;
        setChoreData(curr =>
            curr.map(chore => chore.id === id ? { ...chore, dateLastCompleted: date } : chore)
        );
        try {
            const updated = await completeChore(id, date);
            setChoreData(curr => curr.map(chore => chore.id === id ? updated : chore));
        } catch (err) {
            setChoreData(curr => curr.map(chore => chore.id === id ? originalChore : chore));
            setError(err instanceof Error ? err.message : 'Failed to mark chore complete');
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
                    onReset={() => setDayOffset(0)}
                />
                <div className="flex-1 overflow-y-auto min-h-0">
                    <ChoreList chores={orderedChores} day={simulatedDate} onComplete={handleCompleteChore} onDelete={handleDeleteChore} />
                </div>
                <div className="flex-shrink-0 py-4 flex justify-center border-t border-gray-700">
                    <AddChoreButton onClick={() => setShowForm(true)} />
                </div>
            </div>
            {showForm && <ChoreFormModal onSubmit={handleAddChore} onCancel={() => setShowForm(false)} />}
        </div>
    );
}
