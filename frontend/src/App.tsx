import { useEffect, useState } from 'react';
import { addDays, differenceInDays } from 'date-fns';

import ChoreList from './components/ChoreList';
import AddChoreButton from './components/AddChoreButton';
import NavBar from './components/NavBar';

import { choreData } from './assets/database';

import type { Chore } from '@customTypes/SharedTypes';
import { data } from 'autoprefixer';


function App() {

  const database = choreData as Chore[];
  const today: Date = new Date();

  // Extract unique categories from data
  const uniqueCategories = Array.from(
    new Set(database.flatMap(chore => chore.category.map(cat => cat.trim())))
  );

  // State Variables
  // 
  // Sample data, TODO: pull from Express
  // const [chores, setChores] = useState<Chore[]>([]);
  const [chores, setChores] = useState(database);
  // Simulation of days passing
  const [day, setDay] = useState(today);
  // State for selected category, default to first unique category
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Simulate time passage (only for demo purposes)
  useEffect(() => {
    const timer = setTimeout(() => {
      const nextDate = addDays(day, 1);
      setDay(nextDate);

      setChores(sortChores(chores));
    }, 30000);

    return () => clearTimeout(timer);
  }, [chores]);

  function getChorePriority(chore: Chore, maxDuration: number, maxDaysSince: number, alpha: number): number {
    // Normalize both fields to the same scale (e.g., 0 to 1)
    const normalizedDuration: number = chore.duration / maxDuration;
    const normalizedDaysSince: number = differenceInDays(day, chore.dateLastCompleted) / maxDaysSince;

    // Lower score = higher priority
    // alpha is the weight for duration, (1-alpha) for daysSince
    return alpha * normalizedDuration - (1 - alpha) * normalizedDaysSince;
  }

  function sortChores(chores: Chore[], alpha = 0.7): Chore[] {
    const choreDurations: number[] = chores.map(chore => chore.duration);
    const maxDuration: number = Math.max(...choreDurations);

    const choreDaysSince: number[] = chores.map(chore => differenceInDays(day, chore.dateLastCompleted));
    const maxDaysSince: number = Math.max(...choreDaysSince);


    return chores.slice().sort((a, b) => {
      const aScore = getChorePriority(a, maxDuration, maxDaysSince, alpha);
      const bScore = getChorePriority(b, maxDuration, maxDaysSince, alpha);
      return aScore - bScore;
    });
  }

  // Sorts chores by lastAssigned date value in Meal Object. TODO: update `...chores` with database input
  const sortedTasks = [...chores].sort((a, b) => {
    return new Date(a.duration).getDate() / (1 + new Date(b.dateLastCompleted).getDate());
  });

  // Filter chores by chore.category
  const filteredTasks = database.filter(chore => chore.category.includes(selectedCategory) || selectedCategory === 'all');
  const handleFilterChange = (category: string) => {
    console.log(`Filtering by category: ${category}`);
    setSelectedCategory(category);
    setChores(filteredTasks);
    console.log({chores});
  }

  // Reset chore timer
  // const resetTask = () => {
  //   setChores(
  //     sortChores(
  //       chores.map(chore => (
  //         chore.id === id ? { ...chore, dateLastCompleted: day, progress: 0 } : chore
  //       ))
  //     )
  //   );
  // };

  return (
    <div className="App">
      <div className="mx-auto p-4 bg-gray-900 min-h-screen">

        <NavBar categories={uniqueCategories} selectedCategory={selectedCategory} onClick={handleFilterChange} />

        {/* Hidden simulation status for debugging */}
        <div className="text-s text-white mb-2">
          {day.toDateString()}
        </div>

        {/* Task list */}
        <ChoreList
          chores={chores}
          today={day}
        // onClick={resetTask} 
        />

        {/* Add Task button */}
        <div className="mt-6 flex justify-center">
          <AddChoreButton />
        </div>
      </div>
    </div>
  );
}

export default App;