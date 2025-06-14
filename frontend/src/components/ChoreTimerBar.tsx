import { useMemo, useState } from 'react';
import { differenceInDays, startOfDay } from 'date-fns';

import type { Chore } from '@customTypes/SharedTypes';
import { statusColors } from '../assets/constants';

type StatusColor = { benchmark: number; color: string };

type ChoreTimerBarProps = {
  chore: Chore;
  day: Date;
  // onClick: (id: number) => void;
};

const ChoreTimerBar = ({ chore, day }: ChoreTimerBarProps) => {
  // Simulation of days passing
  const [dateLastCompleted, setDateLastCompleted] = useState(chore.dateLastCompleted);

  const daysSince = useMemo(() => {
    return differenceInDays(startOfDay(day), startOfDay(dateLastCompleted));
  }, [day, dateLastCompleted]);

  const status = daysSince / chore.frequency;
  const barWidth = Math.min(status, 1) * 100;
  const getStatusColor = (percentage: number) => {
    // Find the first status color that matches or exceeds the percentage
    return (statusColors as StatusColor[]).find(
      (status) => status.benchmark >= percentage
    )?.color
      // Otherwise, return the last color in the array
      || (statusColors as StatusColor[])[statusColors.length - 1].color;
  };

  const statusBarColor: string = getStatusColor(status) + ' bg-opacity-50';

  // Reset chore timer
  // This may need to bubble back up. I want the chores to resort after clicks
  const resetTask = () => {
    setDateLastCompleted(day)
  };

  return (
    <div
      className="relative h-24 w-full bg-gray-800 rounded-full shadow cursor-pointer overflow-hidden"
      onClick={() => resetTask()}
    >
      <div
        className={`absolute left-0 top-0 h-full ${statusBarColor} rounded-full transition-all duration-300 ease-in-out`}
        style={{ width: status === 0 ? "100%" : `${barWidth}%` }}
      ></div>

      <div className="absolute inset-0 px-4 flex items-center justify-between">

        <div className="font-medium text-white">
          {chore.id}
        </div>
        <div className="font-medium text-white">
          {chore.name}
          <div className="text-xs text-white text-opacity-80">
            Every {chore.frequency} days
          </div>
        </div>

        {status > 1 &&
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