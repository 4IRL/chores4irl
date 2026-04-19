import { useEffect, useMemo, useRef, useState } from 'react';
import { useMidnightClock } from './hooks/useMidnightClock';
import { useRoomFilter } from './hooks/useRoomFilter';
import { orderChores } from './utils/choreSort';
import NavBar from './components/nav/NavBar';
import ChoreList from './components/chore/ChoreList';
import AddChoreButton from './components/form/AddChoreButton';
import AddChoreForm from './components/form/AddChoreForm';
import { fetchAllChores, addChore, completeChore, removeChore } from './services/choreApi';
import type { Chore } from '@customTypes/SharedTypes';

export default function App() {
    const day = useMidnightClock();
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
                setSortedIds(orderChores(chores, day).map(c => c.id));
                setLoading(false);
            })
            .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : 'Failed to load chores');
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        if (choreDataRef.current.length > 0) {
            setSortedIds(orderChores(choreDataRef.current, day).map(c => c.id));
        }
    }, [day]);

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
            <div className="mx-auto p-4 bg-gray-900 min-h-screen">
                {error && (
                    <div className="mb-4 p-3 bg-red-700 text-white rounded-lg text-sm flex justify-between items-center">
                        <span>{error}</span>
                        <button onClick={() => setError(null)} className="ml-4 underline">Dismiss</button>
                    </div>
                )}

                <NavBar rooms={uniqueRooms} selectedRoom={selectedRoom} onSelect={setSelectedRoom} />

                <div className="text-s text-white mb-2">
                    {day.toDateString()}
                </div>

                <ChoreList chores={orderedChores} day={day} onComplete={handleCompleteChore} onDelete={handleDeleteChore} />

                <div className="mt-6 flex justify-center">
                    {showForm ? (
                        <AddChoreForm
                            onSubmit={handleAddChore}
                            onCancel={() => setShowForm(false)}
                        />
                    ) : (
                        <AddChoreButton onClick={() => setShowForm(true)} />
                    )}
                </div>
            </div>
        </div>
    );
}
