import { useEffect, useMemo, useState } from 'react';
import { useTimeSimulation } from './hooks/useTimeSimulation';
import { useRoomFilter } from './hooks/useRoomFilter';
import { useChoreSort } from './hooks/useChoreSort';
import NavBar from './components/nav/NavBar';
import ChoreList from './components/chore/ChoreList';
import AddChoreButton from './components/form/AddChoreButton';
import AddChoreForm from './components/form/AddChoreForm';
import { fetchAllChores, addChore, completeChore, removeChore } from './services/choreApi';
import type { Chore } from '@customTypes/SharedTypes';

export default function App() {
    const day = useTimeSimulation();
    const [selectedRoom, setSelectedRoom] = useState<string>('all');
    const [showForm, setShowForm] = useState<boolean>(false);
    const [choreData, setChoreData] = useState<Chore[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchAllChores()
            .then(chores => {
                setChoreData(chores);
                setLoading(false);
            })
            .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : 'Failed to load chores');
                setLoading(false);
            });
    }, []);

    const uniqueRooms = useMemo(
        () => Array.from(new Set(choreData.map(chore => chore.room))),
        [choreData]
    );

    const filteredChores = useRoomFilter(choreData, selectedRoom);
    const orderedChores = useChoreSort(filteredChores, day);

    async function handleAddChore(newChore: Omit<Chore, 'id'>) {
        try {
            const created = await addChore(newChore);
            setChoreData(prev => [...prev, created]);
            setShowForm(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add chore');
        }
    }

    async function handleDeleteChore(id: number): Promise<void> {
        const deletedChore = choreData.find(chore => chore.id === id);
        if (!deletedChore) return;
        setChoreData(curr => curr.filter(chore => chore.id !== id));
        try {
            await removeChore(id);
        } catch (err) {
            setChoreData(curr => curr.some(chore => chore.id === id) ? curr : [...curr, deletedChore]);
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
                <div className="mx-auto p-4 bg-gray-900 min-h-screen flex items-center justify-center">
                    <div className="text-white text-lg">Loading chores...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="App">
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
