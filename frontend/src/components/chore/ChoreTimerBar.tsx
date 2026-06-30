import { useMemo, useRef, useState } from 'react';
import { useSwipeable } from 'react-swipeable';
import { differenceInDays, startOfDay } from 'date-fns';
import { Pencil, Trash2 } from 'lucide-react';
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

// The action only fires once the swipe travels past this fraction of the bar's
// own width (measured at runtime). Below it, the bar springs back with no action.
const CONFIRM_THRESHOLD = 0.25;

export default function ChoreTimerBar({ chore, day, isSimulating, onComplete, onDelete, onEdit }: ChoreTimerBarProps) {
    const daysSince = useMemo(
        () => differenceInDays(startOfDay(day), startOfDay(chore.dateLastCompleted)),
        [day, chore.dateLastCompleted]
    );

    const { isOverdue, barWidth, barColor } = computeBar(daysSince, chore.frequency);

    const swipingRef = useRef(false);
    const barRef = useRef<HTMLDivElement>(null);
    // Controlled horizontal offset of the bar so it translates to reveal the
    // action layer behind it. Positive = revealing the right-swipe (delete)
    // action on the left edge; negative = revealing the left-swipe (edit) action.
    const [offset, setOffset] = useState(0);

    function barWidthPx() {
        const el = barRef.current;
        if (!el) return 0;
        const rect = el.getBoundingClientRect();
        return rect.width || el.clientWidth || 0;
    }

    function pastThreshold(absX: number) {
        const width = barWidthPx();
        if (width <= 0) return false;
        return absX >= width * CONFIRM_THRESHOLD;
    }

    const swipeHandlers = useSwipeable({
        onSwiping: eventData => {
            if (isSimulating) return;
            // A real swipe gesture is underway: suppress the trailing click.
            swipingRef.current = true;
            setOffset(eventData.deltaX);
        },
        onSwiped: eventData => {
            setOffset(0);
            if (isSimulating) return;
            if (!pastThreshold(eventData.absX)) return;
            // Reversed vs F5: left -> edit, right -> delete.
            if (eventData.dir === 'Left') {
                if (onEdit) onEdit(chore.id);
            } else if (eventData.dir === 'Right') {
                onDelete(chore.id);
            }
        },
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

    // Reveal layer: which action is being uncovered depends on swipe direction.
    // Swiping left (offset < 0) uncovers the EDIT action on the right side;
    // swiping right (offset > 0) uncovers the DELETE action on the left side.
    const revealingEdit = offset < 0;
    const revealingDelete = offset > 0;

    return (
        <div ref={barRef} className="relative w-full rounded-full overflow-hidden">
            {/* Action-reveal layer sits BEHIND the bar so the resting bar fully covers it. */}
            <div className="absolute inset-0 flex items-center justify-between px-6 rounded-full" aria-hidden="true">
                <span className={revealingDelete ? 'opacity-100' : 'opacity-0'}>
                    <Trash2 className="h-6 w-6 text-white" strokeWidth={2} />
                </span>
                <span className={revealingEdit ? 'opacity-100' : 'opacity-0'}>
                    <Pencil className="h-6 w-6 text-white" strokeWidth={2} />
                </span>
            </div>
            {/* Background colour of the reveal layer follows the active direction. */}
            <div
                className={`absolute inset-0 rounded-full -z-10 ${revealingDelete ? 'bg-red-600' : revealingEdit ? 'bg-yellow-400' : 'bg-transparent'}`}
                aria-hidden="true"
            />

            <div
                {...swipeHandlers}
                data-testid="chore-bar"
                className={`relative h-20 sm:h-16 w-full bg-gray-800 rounded-full shadow overflow-hidden touch-pan-y transition-transform ${offset === 0 ? 'duration-200' : 'duration-0'} ${isSimulating ? 'cursor-not-allowed opacity-60 pointer-events-none' : 'cursor-pointer'}`}
                style={{ transform: `translateX(${offset}px)` }}
                onClick={resetTask}
            >
                <ProgressBar width={barWidth} color={barColor} />
                <div className="absolute inset-0 px-4 grid grid-cols-3 items-center gap-2">
                    <ChoreInfo name={chore.name} />
                    <div className="text-xs text-white text-opacity-80 text-center">Every {chore.frequency} days</div>
                    <CompletionInfo date={chore.dateLastCompleted} daysSince={daysSince} />
                </div>

                {isOverdue && <span className="sr-only">Overdue</span>}

                {/* Swipe is the primary delete/edit affordance; these sr-only buttons are the keyboard/AT fallback. */}
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
        </div>
    );
}
