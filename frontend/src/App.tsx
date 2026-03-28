import { useMemo, useState } from 'react';
import { database } from '@assets/database';
import { useTimeSimulation } from './hooks/useTimeSimulation';
import { useRoomFilter } from './hooks/useRoomFilter';
import { useChoreSort } from './hooks/useChoreSort';
import NavBar from './components/nav/NavBar';
import ChoreList from './components/chore/ChoreList';
import AddChoreButton from './components/form/AddChoreButton';
import AddChoreForm from './components/form/AddChoreForm';
import type { Chore } from '@customTypes/SharedTypes';

export default function App() {
    const day = useTimeSimulation();
    const [selectedRoom, setSelectedRoom] = useState<string>('all');
    const [showForm, setShowForm] = useState<boolean>(false);
    const [choreData, setChoreData] = useState<Chore[]>(database);

    const uniqueRooms = useMemo(
        () => Array.from(new Set(choreData.map(c => c.room))),
        [choreData]
    );

    const filteredChores = useRoomFilter(choreData, selectedRoom);
    const orderedChores = useChoreSort(filteredChores, day);

    function handleAddChore(newChore: Omit<Chore, 'id'>) {
        const id = choreData.length > 0 ? Math.max(...choreData.map(c => c.id)) + 1 : 1;
        setChoreData(prev => [...prev, { ...newChore, id }]);
        setShowForm(false);
    }

    return (
        <div className="App">
            <div className="mx-auto p-4 bg-gray-900 min-h-screen">
                <NavBar rooms={uniqueRooms} selectedRoom={selectedRoom} onSelect={setSelectedRoom} />

                <div className="text-s text-white mb-2">
                    {day.toDateString()}
                </div>

                <ChoreList chores={orderedChores} day={day} />

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
