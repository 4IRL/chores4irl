import React, { useEffect, useState } from 'react';
import { addDays, differenceInDays, startOfDay } from 'date-fns';

import NavBar from './components/NavBar';
import ChoreList from './components/ChoreList';
import AddChoreButton from './components/AddChoreButton';

import { database } from './assets/database';

import type { Chore } from '@customTypes/SharedTypes';


const App: React.FC = () => {
  const simTimeSecPerDay: number = 30; // Simulation time in seconds per day

  // CONSTANTS
  const choreData = database as Chore[];
  const today: Date = new Date();
  // Extract unique categories from data
  const uniqueCategories = Array.from(
    new Set(choreData.flatMap(chore => chore.category.map(cat => cat.trim())))
  );
  // TODO: reorder after some delay...if reorder per resetTask click, screen will commonly be overwhelming red, making user feel bad that there are perpetually more chores to do. Leaving the green screen makes them feel like they are making progress. But at certain intervals, it would be nice to reorder the chores so that user can see the next chore that needs to be done. #humanPsychologyProblems
  // const refreshOrderTimer: number = 1; // How often to refresh the order of chores in seconds

  // STATE VARIABLES

  // Sample data, TODO: pull from Express
  // State for selected category, default to 'all'
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  // State for displayed chores based on selected category
  // Initialize displayed chores with all chores
  const [displayedChores, setDisplayedChores] = useState<(Chore[])>(choreData);
  const [orderedChores, setOrderedChores] = useState<(Chore[])>(choreData);

  // Simulation of days passing
  const [day, setDay] = useState<Date>(today);

  // Simulate time passage (only for demo purposes)
  useEffect(() => {
    const timer = setTimeout(() => {
      const nextDate = addDays(day, 1);
      setDay(nextDate);
    }, simTimeSecPerDay * 1000); // Convert seconds to milliseconds

    return () => {
      clearTimeout(timer);
    }
  }, [day]);

  // Update displayedChores when chores or selectedCategory changes
  useEffect(() => {
    const filteredChores: Chore[] = selectedCategory === 'all'
      ? choreData
      : choreData.filter(choreData => choreData.category.includes(selectedCategory));
    setDisplayedChores(filteredChores);
  }, [choreData, selectedCategory]);

  


  // Update orderedChores when chores or day changes
  useEffect(() => {
    const orderedChores: Chore[] = orderChores(displayedChores, day);
    setOrderedChores(orderedChores);
  }, [displayedChores, day]);

  function orderChores(chores: Chore[], today: Date): Chore[] {
    const shortTermChores: Chore[] = chores.filter(chore => !chore.longTermTask)
    const longTermChores: Chore[] = chores.filter(chore => chore.longTermTask)

    return [...orderSubList(shortTermChores, today), ...orderSubList(longTermChores, today)]
  }

  function orderSubList(chores: Chore[], today: Date): Chore[] {
    return chores.sort((a, b) => {
      return calcDurationWeightedScore(b, today) - calcDurationWeightedScore(a, today);
    });
  }

  function calcDurationWeightedScore(chore: Chore, today: Date): number {
    const daysSince: number = differenceInDays(startOfDay(today), startOfDay(chore.dateLastCompleted));
    const percentOverdue: number = daysSince / chore.frequency;
    return chore.duration * percentOverdue;
  }

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
          chores={orderedChores}
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