import { useEffect, useState } from 'react';

import ChoreTimerBar from './components/ChoreTimerBar';
import AddChoreButton from './components/AddChoreButton';

import { data } from './assets/database';

// Until then...
interface Chore {
    id: number,
    name: string, 
    frequency: number,  
    daysSince: number, 
    progress: number, 
    duration: number, 
}


function App() {
  // const [chores, setChores] = useState<Chore[]>([]);
  const startDate: Date = new Date("2025-06-10");

  // State variables
  const [tasks, setTasks] = useState(data);
  // Simulation of +1 day passed
  const [day, setDay] = useState(startDate);


  // Simulate time passage (only for demo purposes)
  useEffect(() => {
    const timer = setTimeout(() => {
      const nextDate = new Date(day);
      nextDate.setDate(nextDate.getDate() + 1);
      setDay(nextDate);

      // const incrementedTasks = tasks.map(task => {
      //   const newDaysSince = task.daysSince + 1;
      //   const newProgress = Math.min((newDaysSince / task.frequency) * 100, 100);
      //   return { ...task, daysSince: newDaysSince, progress: newProgress };
      // })
      // const orderedTasks = sortChores(incrementedTasks)

      // setTasks(orderedTasks);
      setTasks(tasks.map(task => {
        const newDaysSince = task.daysSince + 1;
        const newProgress = Math.min((newDaysSince / task.frequency) * 100, 100);
        return { ...task, daysSince: newDaysSince, progress: newProgress };
      }));

    }, 120000);

    return () => clearTimeout(timer);
  }, [tasks]);

  // Reset task timer
  const resetTask = (id: number) => {
    setTasks(tasks.map(task =>
      task.id === id ? { ...task, daysSince: 0, progress: 0 } : task
    ));
  };

  function getChorePriority(chore: Chore, alpha = 0.7): number {
    // Normalize both fields to the same scale (e.g., 0 to 1)
    const normalizedDuration = chore.duration;
    const normalizedDaysSince = chore.daysSince;

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
  // Sorts tasks by lastAssigned date value in Meal Object. TODO: update `...tasks` with database input
  const sortedTasks = [...tasks].sort((a, b) => {
    return new Date(a.duration).getDate() / (1 + new Date(b.daysSince).getDate());
  });

  return (
    <div className="App">
      <div className="mx-auto p-4 bg-gray-900 min-h-screen">

        {/* Hidden simulation status for debugging */}
        <div className="text-s text-white mb-2">
          {day.toDateString()}
        </div>

        <div className="space-y-3">
          {tasks.map(task => (
            <div
              key={task.id}>
              <ChoreTimerBar
                task={task}
                onClick={resetTask}
              />
            </div>
          )
          )}
        </div>

        <div className="mt-6 flex justify-center">
          <AddChoreButton />
        </div>
      </div>
    </div>
  );
}

export default App;