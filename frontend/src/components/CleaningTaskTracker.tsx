import React, { useState, useEffect } from 'react';

const CleaningTaskTrackerPreview = () => {
  // Sample data with simulation of +1 day passed
  const [simulationDays, setSimulationDays] = useState(1);
  const [tasks, setTasks] = useState([
    { id: 1, name: 'Vacuum Floors', frequency: 7, daysSince: 6, progress: (6/7)*100 },
    { id: 2, name: 'Change Bedsheets', frequency: 7, daysSince: 7, progress: 100 },
    { id: 3, name: 'Change Towels', frequency: 3, daysSince: 3, progress: 100 },
    { id: 4, name: 'Sweep Floors', frequency: 2, daysSince: 2, progress: 100 },
    { id: 5, name: 'Mop Floors', frequency: 7, daysSince: 5, progress: (5/7)*100 },
    { id: 6, name: 'Clean Bathroom', frequency: 7, daysSince: 8, progress: 100 }
  ]);

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

  // Get progress bar color based on percentage (always 50% transparent)
  const getProgressColor = (percentage: number) => {
    if (percentage < 50) return 'bg-green-500 bg-opacity-50';
    if (percentage < 85) return 'bg-yellow-500 bg-opacity-50';
    return 'bg-red-500 bg-opacity-50';
  };


  return (
    <div className="max-w-md mx-auto p-4 bg-gray-900 min-h-screen">
      {/* Hidden simulation status for debugging */}
      <div className="text-xs text-gray-600 mb-2">Simulation: +{simulationDays} virtual days</div>
      
      <div className="space-y-3">
        {tasks.map(task => {
          const progressBarColor = getProgressColor(task.progress);
          
          return (
            <div 
              key={task.id} 
              className="relative h-16 w-full bg-gray-800 rounded-full shadow cursor-pointer overflow-hidden"
              onClick={() => resetTask(task.id)}
            >
              <div 
                className={`absolute left-0 top-0 h-full ${progressBarColor} rounded-full transition-all duration-300 ease-in-out`} 
                style={{ width: `${task.progress}%` }}
              ></div>
              
              <div className="absolute inset-0 px-4 flex items-center justify-between">
                <div className="font-medium text-white z-10">
                  {task.name}
                  <div className="text-xs text-white text-opacity-80">Every {task.frequency} days</div>
                </div>
                
                <div className="flex flex-col items-end z-10">
                  <div className="text-white text-sm font-bold">
                    {task.daysSince} {task.daysSince === 1 ? 'day' : 'days'}
                  </div>
                  {task.progress >= 100 && 
                    <div className="text-white bg-red-600 px-2 py-0.5 text-xs rounded-full">
                      Overdue
                    </div>
                  }
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex justify-center">
        <button className="bg-blue-500 hover:bg-blue-600 bg-opacity-50 text-white font-medium py-2 px-4 rounded-full">
          + Add Task
        </button>
      </div>
    </div>
  );
};

export default CleaningTaskTrackerPreview;