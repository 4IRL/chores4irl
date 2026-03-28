import { useEffect, useMemo, useState } from 'react';
import { useTimeSimulation } from './hooks/useTimeSimulation';
import { useRoomFilter } from './hooks/useRoomFilter';
import { useChoreSort } from './hooks/useChoreSort';
import NavBar from './components/nav/NavBar';
import ChoreList from './components/chore/ChoreList';
import AddChoreButton from './components/form/AddChoreButton';
import AddChoreForm from './components/form/AddChoreForm';
import { fetchAllChores, addChore, completeChore } from './services/choreApi';
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
        () => Array.from(new Set(choreData.map(c => c.room))),
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

    async function handleCompleteChore(id: number, date: Date) {
        setChoreData(prev =>
            prev.map(c => c.id === id ? { ...c, dateLastCompleted: date } : c)
        );
        try {
            await completeChore(id, date);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save completion');
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

                <ChoreList chores={orderedChores} day={day} onComplete={handleCompleteChore} />

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
