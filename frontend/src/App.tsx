import React, { JSX, useEffect, useState } from 'react';
import { addDays, differenceInDays, startOfDay } from 'date-fns';

import NavBar from './components/NavBar';
import ChoreList from './components/ChoreList';
import AddChoreButton from './components/AddChoreButton';

import { choreData } from './assets/database';

import type { Chore } from '@customTypes/SharedTypes';
import { get } from 'http';


const App: React.FC = () => {

  const database = choreData as Chore[];
  const today: Date = new Date();
  const simTimeSecPerDay: number = 30; // Simulation time in seconds per day
  // TODO: reorder after some delay...if reorder per click, screen will be commonly red, making user feel bad that there are perpetually more chores to do. Leaving the green screen makes them feel like they are making progress. But at certain intervals, it would be nice to reorder the chores so that user can see the next chore that needs to be done.
  // const refreshOrderTimer: number = 1; // How often to refresh the order of chores in seconds

  // Extract unique categories from data
  const uniqueCategories = Array.from(
    new Set(database.flatMap(chore => chore.category.map(cat => cat.trim())))
  );

  // State Variables
  // 
  // Sample data, TODO: pull from Express
  // const [chores, setChores] = useState<Chore[]>([]);
  const [chores, setChores] = useState(database);
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [displayedChores, setDisplayedChores] = useState<(Chore[])>(chores);
  // Simulation of days passing
  const [day, setDay] = useState(today);
  // State for selected category, default to first unique category

  // Simulate time passage (only for demo purposes)
  useEffect(() => {
    const timer = setTimeout(() => {
      const nextDate = addDays(day, 1);
      setDay(nextDate);

      setChores(orderChores(chores));
    }, simTimeSecPerDay * 1000); // Convert seconds to milliseconds

    return () => {
      clearTimeout(timer);
    }
  }, [chores]);

  useEffect(() => {
  }, [chores]);

  function getChorePriority(chore: Chore, maxDuration: number, maxDaysSince: number): number {
    // Normalize both fields to the same scale (e.g., 0 to 1)
    const normalizedDuration: number = chore.duration / maxDuration;
    const normalizedDaysSince: number = differenceInDays(startOfDay(day), startOfDay(chore.dateLastCompleted)) / maxDaysSince;
    const urgencyScore: number = chore.urgency === 'high' ? 0 : chore.urgency === 'medium' ? 0.5 : 1;

    // Lower score = higher priority
    // alpha is the weight for duration, (1-alpha) for daysSince
    return 0.6 * normalizedDuration - 0.1 * normalizedDaysSince + 0.3 * urgencyScore;
  }

  function orderChores(chores: Chore[]): Chore[] {
    const choreDurations: number[] = chores.map(chore => chore.duration);
    const maxDuration: number = Math.max(...choreDurations);

    const choreDaysSince: number[] = chores.map(chore => differenceInDays(startOfDay(day), startOfDay(chore.dateLastCompleted)));
    const maxDaysSince: number = Math.max(...choreDaysSince);

    // Debugging priority score 
    console.log("Day:", day.toDateString());
    chores.map(chore => console.log(`${chore.name}: `, getChorePriority(chore, maxDuration, maxDaysSince)));

    return chores.slice().sort((a, b) => {
      const aScore = getChorePriority(a, maxDuration, maxDaysSince);
      const bScore = getChorePriority(b, maxDuration, maxDaysSince);
      return aScore - bScore;
    });
  }

  // Update displayedChores when chores or selectedCategory changes
  useEffect(() => {
    const filteredTasks: Chore[] = selectedCategory === 'all'
      ? chores
      : chores.filter(chore => chore.category.includes(selectedCategory));
    setDisplayedChores(filteredTasks);
  }, [chores, selectedCategory]);

  return (
    <div className="App">
      <div className="mx-auto p-4 bg-gray-900 min-h-screen">

        <NavBar categories={uniqueCategories} selectedCategory={selectedCategory} onClick={setSelectedCategory} />

        {/* Hidden simulation status for debugging */}
        <div className="text-s text-white mb-2">
          {day.toDateString()}
        </div>

        {/* Task list */}
        <ChoreList
          chores={displayedChores}
          day={day}
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