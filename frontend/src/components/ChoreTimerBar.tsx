import { useMemo, useState } from 'react';
import { differenceInDays } from 'date-fns';

import type { Chore } from '@customTypes/SharedTypes';

type ChoreTimerBarProps = {
  chore: Chore;
  today: Date;
  // onClick: (id: number) => void;
};

const ChoreTimerBar = ({ chore, today }: ChoreTimerBarProps) => {
  // Simulation of days passing
  const [dateLastCompleted, setDateLastCompleted] = useState(chore.dateLastCompleted);

  const daysSince = useMemo(() => {
    return differenceInDays(today, dateLastCompleted);
  }, [today, dateLastCompleted]);

  const progress = Math.min(daysSince / chore.frequency, 1) * 100;

  // Get progress bar color based on percentage (always 50% transparent)
  const getProgressColor = (percentage: number) => {
    if (percentage < 50) return 'bg-green-500 bg-opacity-50';
    if (percentage < 85) return 'bg-yellow-500 bg-opacity-50';
    return 'bg-red-500 bg-opacity-50';
  };

  const progressBarColor: string = getProgressColor(progress);

  // Reset chore timer
  // This may need to bubble back up. I want the chores to resort after clicks
  const resetTask = () => {
    setDateLastCompleted(today)
  };

  return (
    <div
      className="relative h-24 w-full bg-gray-800 rounded-full shadow cursor-pointer overflow-hidden"
      onClick={() => resetTask()}
    >
      <div
        className={`absolute left-0 top-0 h-full ${progressBarColor} rounded-full transition-all duration-300 ease-in-out`}
        style={{ width: `${progress}%` }}
      ></div>

      <div className="absolute inset-0 px-4 flex items-center justify-between">

        <div className="font-medium text-white">
          {chore.name}
          <div className="text-xs text-white text-opacity-80">
            Every {chore.frequency} days
          </div>
        </div>

        {progress >= 100 &&
          <div className="text-white bg-red-600 px-2 py-0.5 font-medium rounded-full">
            Overdue
          </div>
        }

        <div className="font-medium text-white ">
          <div className="text-xs text-white text-opacity-80">Last Completed: </div>
          {dateLastCompleted.toDateString()}

          <div className="text-xs text-white text-opacity-80">
            <div className="text-white text-sm font-bold">
              {daysSince} {daysSince === 1 ? 'day' : 'days'} ago
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChoreTimerBar;