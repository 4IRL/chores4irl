import React, { useState } from 'react';
import CleaningTaskTracker from './components/CleaningTaskTracker';
// import ChoreTimerBar from './components/ChoreTimerBar';

import { Chore } from '@types/index';

function App() {
  // State variables
const [chores, setChores] = useState<Chore[]>([]);

  // Reset task timer
  const resetTask = (id: number) => {
    setChores(chores.map(chore => 
      chore.id === id ? { ...chore, daysSince: 0, progress: 0 } : chore
    ));
  };

  return (
    <div className="App">
      <CleaningTaskTracker/>
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
    </div>
  );
}

export default App;