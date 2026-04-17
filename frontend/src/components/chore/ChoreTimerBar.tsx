import { useMemo } from 'react';
import { differenceInDays, startOfDay } from 'date-fns';
import type { Chore } from '@customTypes/SharedTypes';
import { statusColors } from '@assets/constants';
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

function getStatusColor(remainingRatio: number, isOverdue: boolean): string {
    if (isOverdue) return 'bg-red-500 bg-opacity-50';
    const match = statusColors.find(s => remainingRatio > s.threshold);
    return (match ?? statusColors[statusColors.length - 1]).color + ' bg-opacity-50';
}

export default function ChoreTimerBar({ chore, day, onComplete, onDelete }: ChoreTimerBarProps) {
    const daysSince = useMemo(
        () => differenceInDays(startOfDay(day), startOfDay(chore.dateLastCompleted)),
        [day, chore.dateLastCompleted]
    );

    const isOverdue = daysSince > chore.frequency;
    const remainingRatio = (chore.frequency - daysSince) / chore.frequency; // can go negative when overdue

    let barWidth: number;
    let isUrgent = false;
    if (!isOverdue) {
        barWidth = Math.max(remainingRatio, 0) * 100;
    } else {
        const daysOverdue = daysSince - chore.frequency;
        const growthRatio = (daysOverdue * 2) / chore.frequency;
        barWidth = Math.min(growthRatio, 1) * 100;
        isUrgent = growthRatio >= 1;
    }

    const barColor = getStatusColor(remainingRatio, isOverdue);

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
