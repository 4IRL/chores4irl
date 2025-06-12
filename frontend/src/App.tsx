import { useEffect, useState } from 'react';
import { differenceInDays } from 'date-fns';

import ChoreList from './components/ChoreList';
import AddChoreButton from './components/AddChoreButton';

import { data } from './assets/database';

import type { Chore } from '@customTypes/SharedTypes';


function App() {

  const today: Date = new Date();

  // Extract unique categories from data
  const uniqueCategories = Array.from(
    new Set(data.flatMap(chore => chore.category.map(cat => cat.trim())))
  );

  // State Variables
  // 
  // Sample data, TODO: pull from Express
  // const [chores, setChores] = useState<Chore[]>([]);
  const [chores, setChores] = useState(data);
  // Simulation of days passing
  const [day, setDay] = useState(today);
  // State for selected category, default to first unique category
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Simulate time passage (only for demo purposes)
  useEffect(() => {
    const timer = setTimeout(() => {
      const nextDate = new Date(day.getDate() + 1);
      setDay(nextDate);

      // const incrementedTasks = chores.map(chore => {
      //   const newDaysSince = chore.daysSince + 1;
      //   const newProgress = Math.min((newDaysSince / chore.frequency) * 100, 100);
      //   return { ...chore, daysSince: newDaysSince, progress: newProgress };
      // })
      // const orderedTasks = sortChores(incrementedTasks)

      // setChores(orderedTasks);
      setChores(
        sortChores(
          chores.map(chore => {
            const newDaysSince = differenceInDays(nextDate, chore.dateLastCompleted);
            const newProgress = Math.min((newDaysSince / chore.frequency) * 100, 100);
            return { ...chore, progress: newProgress };
          })
        )
      );
    }, 30000);

    return () => clearTimeout(timer);
  }, [chores]);

  // Reset chore timer
  const resetTask = (id: number) => {
    setChores(
      sortChores(
        chores.map(chore => (
          chore.id === id ? { ...chore, dateLastCompleted: day, progress: 0 } : chore
        ))
      )
    );
  };

  function getChorePriority(chore: Chore, alpha: number): number {
    // Normalize both fields to the same scale (e.g., 0 to 1)
    const normalizedDuration = chore.duration;
    const normalizedDaysSince = differenceInDays(new Date(day), chore.dateLastCompleted);

    // Lower score = higher priority
    // alpha is the weight for duration, (1-alpha) for daysSince
    return alpha * normalizedDuration - (1 - alpha) * normalizedDaysSince;
  }

  function sortChores(chores: Chore[], alpha = 0.7): Chore[] {
    return chores.slice().sort((a, b) => {
      const aScore = getChorePriority(a, alpha);
      const bScore = getChorePriority(b, alpha);
      return aScore - bScore;
    });
  }
  // Sorts chores by lastAssigned date value in Meal Object. TODO: update `...chores` with database input
  const sortedTasks = [...chores].sort((a, b) => {
    return new Date(a.duration).getDate() / (1 + new Date(b.dateLastCompleted).getDate());
  });

  return (
    <div className="App">
      <div className="mx-auto p-4 bg-gray-900 min-h-screen">

        {/* Hidden simulation status for debugging */}
        <div className="text-s text-white mb-2">
          {day.toDateString()}
        </div>

        {/* Task list */}
        <ChoreList
          chores={chores}
          onClick={resetTask} />

        {/* Add Task button */}
        <div className="mt-6 flex justify-center">
          <AddChoreButton />
        </div>
      </div>
    </div>
  );
}

export default App;