import React from 'react';

import { Chore } from 'types/index'

type ChoreTimerBarProps = {
  task: Chore;
  onClick: (id: number) => void;
};

const ChoreTimerBar = ({ task, onClick }: ChoreTimerBarProps) => {


  return (
    <div
      key={task.id}
      className="relative h-16 w-full bg-gray-800 rounded-full shadow cursor-pointer overflow-hidden"
      onClick={() => onClick(task.id)}
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
}

export default ChoreTimerBar;