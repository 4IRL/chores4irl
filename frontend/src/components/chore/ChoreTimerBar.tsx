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
            className="relative h-36 sm:h-24 w-full bg-gray-800 rounded-full shadow cursor-pointer overflow-hidden"
            onClick={resetTask}
        >
            <ProgressBar width={barWidth} color={barColor} isUrgent={isUrgent} />
            {/* Text content + OverdueBadge: stacked on mobile, flat row on sm+ */}
            <div className="absolute inset-0 px-4 pr-12 flex flex-col justify-center gap-1 sm:flex-row sm:items-center sm:justify-between sm:pr-4">
                <ChoreInfo name={chore.name} room={chore.room} frequency={chore.frequency} />
                {isOverdue && (
                    <div className="absolute top-2 right-16 sm:static sm:order-2">
                        <OverdueBadge />
                    </div>
                )}
                <CompletionInfo date={chore.dateLastCompleted} daysSince={daysSince} />
            </div>

            {/* TODO: replace with swipe-to-delete — touch target intentionally below 44px until then */}
            <button
                className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 bg-red-600 bg-opacity-80 hover:bg-red-500 text-white text-sm rounded-full"
                onClick={e => { e.stopPropagation(); onDelete(chore.id); }}
                aria-label="Delete chore"
            >
                ✕
            </button>
        </div>
    );
}
