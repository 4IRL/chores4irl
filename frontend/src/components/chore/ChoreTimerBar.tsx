import { useMemo } from 'react';
import { differenceInDays, startOfDay } from 'date-fns';
import type { Chore } from '@customTypes/SharedTypes';
import { computeBar } from '@utils/choreBarMath';
import ProgressBar from './ProgressBar';
import ChoreInfo from './ChoreInfo';
import CompletionInfo from './CompletionInfo';
import OverdueBadge from './OverdueBadge';

type ChoreTimerBarProps = {
    chore: Chore;
    day: Date;
    onComplete: (id: number, date: Date) => void;
    onDelete: (id: number) => void;
};

export default function ChoreTimerBar({ chore, day, onComplete, onDelete }: ChoreTimerBarProps) {
    const daysSince = useMemo(
        () => differenceInDays(startOfDay(day), startOfDay(chore.dateLastCompleted)),
        [day, chore.dateLastCompleted]
    );

    const { isOverdue, barWidth, isUrgent, barColor } = computeBar(daysSince, chore.frequency);

    function resetTask() {
        onComplete(chore.id, new Date());
    }

    return (
        <div
            data-testid="chore-bar"
            className="relative h-24 w-full bg-gray-800 rounded-full shadow cursor-pointer overflow-hidden"
            onClick={resetTask}
        >
            <ProgressBar width={barWidth} color={barColor} isUrgent={isUrgent} />
            <div className="absolute inset-0 px-4 flex items-center justify-between">
                <div className="font-medium text-white">{chore.id}</div>
                <ChoreInfo name={chore.name} room={chore.room} frequency={chore.frequency} />
                {isOverdue && <OverdueBadge />}
                <CompletionInfo date={chore.dateLastCompleted} daysSince={daysSince} />
                {/* TODO: replace with swipe-to-delete — touch target intentionally below 44px until then */}
                <button
                    className="ml-2 px-3 py-1 bg-red-600 bg-opacity-80 hover:bg-red-500 text-white text-sm rounded-full"
                    onClick={e => { e.stopPropagation(); onDelete(chore.id); }}
                    aria-label="Delete chore"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}
