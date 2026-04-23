import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type DateNavigationBannerProps = {
    simulatedDate: Date;
    dayOffset: number;
    onPrev: () => void;
    onNext: () => void;
};

export default function DateNavigationBanner({
    simulatedDate,
    dayOffset,
    onPrev,
    onNext,
}: DateNavigationBannerProps) {
    const prevDayOffsetRef = useRef(dayOffset);
    const prevHidden = dayOffset === 0;

    let slideClass = '';
    if (dayOffset < prevDayOffsetRef.current) slideClass = 'slide-in-left';
    else if (dayOffset > prevDayOffsetRef.current) slideClass = 'slide-in-right';

    useEffect(() => {
        prevDayOffsetRef.current = dayOffset;
    }, [dayOffset]);

    return (
        <div className="flex items-center justify-center gap-3 my-3 flex-shrink-0 text-white relative">
            <button
                type="button"
                onClick={onPrev}
                aria-label="Previous day"
                tabIndex={prevHidden ? -1 : undefined}
                className={`p-2 rounded-full hover:bg-gray-700 min-w-[44px] min-h-[44px] flex items-center justify-center ${prevHidden ? 'invisible' : ''}`}
            >
                <ChevronLeft className="w-6 h-6" aria-hidden="true" />
            </button>
            <div className="overflow-hidden min-w-0 flex-1 max-w-xs sm:max-w-sm">
                <h1
                    key={simulatedDate.toDateString()}
                    className={`text-center text-2xl sm:text-3xl font-semibold tracking-wide ${slideClass}`}
                >
                    {simulatedDate.toDateString()}
                </h1>
            </div>
            <button
                type="button"
                onClick={onNext}
                aria-label="Next day"
                className="p-2 rounded-full hover:bg-gray-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
                <ChevronRight className="w-6 h-6" aria-hidden="true" />
            </button>
        </div>
    );
}
