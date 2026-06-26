import { useMemo, useRef } from 'react';
import { useSwipeable } from 'react-swipeable';
import { differenceInDays, startOfDay } from 'date-fns';
import { Pencil } from 'lucide-react';
import type { Chore } from '@customTypes/SharedTypes';
import { computeBar } from '@utils/choreBarMath';
import ProgressBar from './ProgressBar';
import ChoreInfo from './ChoreInfo';
import CompletionInfo from './CompletionInfo';
import OverdueBadge from './OverdueBadge';

type ChoreTimerBarProps = {
    chore: Chore;
    day: Date;
    isSimulating: boolean;
    onComplete: (id: number, date: Date) => void;
    onDelete: (id: number) => void;
    onEdit?: (id: number) => void;
};

export default function ChoreTimerBar({ chore, day, isSimulating, onComplete, onDelete, onEdit }: ChoreTimerBarProps) {
    const daysSince = useMemo(
        () => differenceInDays(startOfDay(day), startOfDay(chore.dateLastCompleted)),
        [day, chore.dateLastCompleted]
    );

    const { isOverdue, barWidth, barColor } = computeBar(daysSince, chore.frequency);

    const swipingRef = useRef(false);
    const swipeHandlers = useSwipeable({
        onSwipedLeft: () => { swipingRef.current = true; if (!isSimulating) onDelete(chore.id); },
        onSwipedRight: () => { swipingRef.current = true; if (!isSimulating && onEdit) onEdit(chore.id); },
        onTouchStartOrOnMouseDown: () => { swipingRef.current = false; },
        delta: 50,
        trackMouse: true,
        preventScrollOnSwipe: false,
    });

    function resetTask() {
        if (isSimulating) return;
        if (swipingRef.current) { swipingRef.current = false; return; }
        onComplete(chore.id, new Date());
    }

    return (
        <div
            {...swipeHandlers}
            data-testid="chore-bar"
            className={`relative h-36 sm:h-24 w-full bg-gray-800 rounded-full shadow overflow-hidden touch-pan-y ${isSimulating ? 'cursor-not-allowed opacity-60 pointer-events-none' : 'cursor-pointer'}`}
            onClick={resetTask}
        >
            <ProgressBar width={barWidth} color={barColor} />
            <div className="absolute inset-0 px-4 pr-20 flex flex-col justify-center gap-1 sm:flex-row sm:items-center sm:justify-between sm:pr-4">
                <ChoreInfo name={chore.name} room={chore.room} frequency={chore.frequency} />
                {isOverdue && (
                    <div className="absolute top-2 right-20 sm:static sm:order-2">
                        <OverdueBadge />
                    </div>
                )}
                <CompletionInfo date={chore.dateLastCompleted} daysSince={daysSince} />
            </div>

            {/* Swipe left = delete, swipe right = edit (F5). Interim ✕/pencil buttons retained until removed in F6 (#10). */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-auto">
                {onEdit && (
                    <button
                        className="p-1.5 bg-indigo-600 bg-opacity-80 hover:bg-indigo-500 text-white rounded-full"
                        onClick={e => { e.stopPropagation(); onEdit(chore.id); }}
                        aria-label="Edit chore"
                    >
                        <Pencil className="w-4 h-4" aria-hidden="true" />
                    </button>
                )}
                <button
                    className="px-3 py-1 bg-red-600 bg-opacity-80 hover:bg-red-500 text-white text-sm rounded-full"
                    onClick={e => { e.stopPropagation(); onDelete(chore.id); }}
                    aria-label="Delete chore"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}
