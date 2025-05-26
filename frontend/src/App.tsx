import { useEffect, useState } from 'react';
import CleaningTaskTracker from './components/CleaningTaskTracker';
// import ChoreTimerBar from './components/ChoreTimerBar';
import AddChoreButton from './components/AddChoreButton';

// TODO: make `@types` reference definition in tsconfig.base.json work so both frontend and backend can share common custom TypeScript type `Chore`
// {
//   "compilerOptions": {
//     "paths": {
//       "@types/*": [
//         "types/*"
//       ]
//     }
//   }
// }
// import { Chore } from '@types/index';
import type { Chore } from '@types/index';

// Until then...
interface Chore {
  id: number,
  name: string,
  frequency: number,
  daysSince: number,
  progress: number
}

function App() {
  // const [chores, setChores] = useState<Chore[]>([]);
  // Sample data, TODO: pull from Express
  const data: Chore[] = [
    { id: 1, name: 'Vacuum Floors', frequency: 7, daysSince: 6, progress: (6 / 7) * 100 },
    { id: 2, name: 'Change Bedsheets', frequency: 7, daysSince: 7, progress: 100 },
    { id: 3, name: 'Change Towels', frequency: 3, daysSince: 3, progress: 100 },
    { id: 4, name: 'Sweep Floors', frequency: 2, daysSince: 2, progress: 100 },
    { id: 5, name: 'Mop Floors', frequency: 7, daysSince: 5, progress: (5 / 7) * 100 },
    { id: 6, name: 'Clean Bathroom', frequency: 7, daysSince: 8, progress: 100 }
  ];

  // State variables
  const [tasks, setTasks] = useState(data);
  // Simulation of +1 day passed
  const [simulationDays, setSimulationDays] = useState(1);

  // Simulate time passage (only for demo purposes)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSimulationDays(prev => prev + 1);
      setTasks(tasks.map(task => {
        const newDaysSince = task.daysSince + 1;
        const newProgress = Math.min((newDaysSince / task.frequency) * 100, 100);
        return { ...task, daysSince: newDaysSince, progress: newProgress };
      }));
    }, 15000);

    return () => clearTimeout(timer);
  }, [tasks]);

  // Reset task timer
  const resetTask = (id: number) => {
    setTasks(tasks.map(task =>
      task.id === id ? { ...task, daysSince: 0, progress: 0 } : task
    ));
  };

  return (
    <div className="App">
      <div className="max-w-md mx-auto p-4 bg-gray-900 min-h-screen">

        {/* Hidden simulation status for debugging */}
        <div className="text-xs text-gray-600 mb-2">Simulation: +{simulationDays} virtual days</div>

        <CleaningTaskTracker
          tasks={tasks}
          resetTask={resetTask}
        />
        {/* <div className="max-w-md mx-auto p-4 bg-gray-900 min-h-screen">

      <div className="space-y-3">
      {chores.map(chore: Chore => {
        <ChoreTimerBar chore={chore}/>
      }
      )}
      </div>
        <div className="mt-6 flex justify-center">
          <button className="bg-blue-500 hover:bg-blue-600 bg-opacity-50 text-white font-medium py-2 px-4 rounded-full">
            + Add Task
          </button>
        </div>
      </div> */}
        <div className="mt-6 flex justify-center">
          <AddChoreButton />
        </div>
      </div>
    </div>
  );
}

export default App;