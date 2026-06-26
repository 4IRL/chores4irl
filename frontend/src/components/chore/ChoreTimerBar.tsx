import { useMemo, useRef } from 'react';
import { useSwipeable } from 'react-swipeable';
import { differenceInDays, startOfDay } from 'date-fns';
import type { Chore } from '@customTypes/SharedTypes';
import { computeBar } from '@utils/choreBarMath';
import ProgressBar from './ProgressBar';
import ChoreInfo from './ChoreInfo';
import CompletionInfo from './CompletionInfo';

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
            className={`relative h-20 sm:h-16 w-full bg-gray-800 rounded-full shadow overflow-hidden touch-pan-y ${isSimulating ? 'cursor-not-allowed opacity-60 pointer-events-none' : 'cursor-pointer'}`}
            onClick={resetTask}
        >
            <ProgressBar width={barWidth} color={barColor} />
            <div className="absolute inset-0 px-4 grid grid-cols-3 items-center gap-2">
                <ChoreInfo name={chore.name} />
                <div className="text-xs text-white text-opacity-80 text-center">Every {chore.frequency} days</div>
                <CompletionInfo date={chore.dateLastCompleted} daysSince={daysSince} />
            </div>

            {isOverdue && <span className="sr-only">Overdue</span>}

            {/* Swipe is the primary delete/edit affordance (F5); these sr-only buttons are the keyboard/AT fallback. */}
            {onEdit && (
                <button
                    type="button"
                    className="sr-only focus:not-sr-only focus:absolute focus:right-12 focus:top-1/2 focus:-translate-y-1/2 focus:z-10 focus:px-3 focus:py-1 focus:bg-indigo-600 focus:text-white focus:text-sm focus:rounded-full"
                    onClick={e => { e.stopPropagation(); onEdit(chore.id); }}
                    aria-label="Edit chore"
                >
                    Edit chore
                </button>
            )}
            <button
                type="button"
                className="sr-only focus:not-sr-only focus:absolute focus:right-3 focus:top-1/2 focus:-translate-y-1/2 focus:z-10 focus:px-3 focus:py-1 focus:bg-red-600 focus:text-white focus:text-sm focus:rounded-full"
                onClick={e => { e.stopPropagation(); onDelete(chore.id); }}
                aria-label="Delete chore"
            >
                Delete chore
            </button>
        </div>
    );
}
