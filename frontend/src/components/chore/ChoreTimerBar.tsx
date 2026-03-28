import { useMemo, useState } from 'react';
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
};

function getStatusColor(status: number): string {
    const match = statusColors.find(s => s.benchmark >= status);
    return (match ?? statusColors[statusColors.length - 1]).color + ' bg-opacity-50';
}

export default function ChoreTimerBar({ chore, day, onComplete }: ChoreTimerBarProps) {
    const [dateLastCompleted, setDateLastCompleted] = useState(chore.dateLastCompleted);

    const daysSince = useMemo(
        () => differenceInDays(startOfDay(day), startOfDay(dateLastCompleted)),
        [day, dateLastCompleted]
    );

    const status = daysSince / chore.frequency;
    const barWidth = Math.min(status, 1) * 100;
    const barColor = getStatusColor(status);

    function resetTask() {
        setDateLastCompleted(day);
        onComplete(chore.id, day);
    }

    return (
        <div
            className="relative h-24 w-full bg-gray-800 rounded-full shadow cursor-pointer overflow-hidden"
            onClick={resetTask}
        >
            <ProgressBar width={status === 0 ? 100 : barWidth} color={barColor} />
            <div className="absolute inset-0 px-4 flex items-center justify-between">
                <div className="font-medium text-white">{chore.id}</div>
                <ChoreInfo name={chore.name} room={chore.room} frequency={chore.frequency} />
                {status > 1 && <OverdueBadge />}
                <CompletionInfo date={dateLastCompleted} daysSince={daysSince} />
            </div>
        </div>
    );
}
