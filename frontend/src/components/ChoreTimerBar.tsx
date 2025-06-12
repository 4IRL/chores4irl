import { useMemo } from 'react';
import { differenceInDays } from 'date-fns';

import type { Chore } from '@customTypes/SharedTypes';

type ChoreTimerBarProps = {
  chore: Chore;
  onClick: (id: number) => void;
};

const ChoreTimerBar = ({ chore, onClick }: ChoreTimerBarProps) => {
  // Get progress bar color based on percentage (always 50% transparent)
  const getProgressColor = (percentage: number) => {
    if (percentage < 50) return 'bg-green-500 bg-opacity-50';
    if (percentage < 85) return 'bg-yellow-500 bg-opacity-50';
    return 'bg-red-500 bg-opacity-50';
  };

  const progressBarColor: string = getProgressColor(chore.progress);

  const daysSince = useMemo(() => {
    const lastCompleted = new Date(chore.dateLastCompleted);
    const today = new Date();

    // Clear time for accurate diff
    lastCompleted.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    return differenceInDays(today, lastCompleted);
  }, [chore.dateLastCompleted]);

  return (
    <div
      className="relative h-24 w-full bg-gray-800 rounded-full shadow cursor-pointer overflow-hidden"
      onClick={() => onClick(chore.id)}
    >
      <div
        className={`absolute left-0 top-0 h-full ${progressBarColor} rounded-full transition-all duration-300 ease-in-out`}
        style={{ width: `${chore.progress}%` }}
      ></div>

      <div className="absolute inset-0 px-4 flex items-center justify-between">

        <div className="font-medium text-white">
          {chore.name}
          <div className="text-xs text-white text-opacity-80">
            Every {chore.frequency} days
          </div>
        </div>

        {chore.progress >= 100 &&
          <div className="text-white bg-red-600 px-2 py-0.5 font-medium rounded-full">
            Overdue
          </div>
        }

        <div className="font-medium text-white ">
          <div className="text-xs text-white text-opacity-80">Last Completed: </div>
          {chore.dateLastCompleted.toDateString()}

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