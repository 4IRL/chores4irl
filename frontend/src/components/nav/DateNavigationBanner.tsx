import { useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

type DateNavigationBannerProps = {
    simulatedDate: Date;
    dayOffset: number;
    onPrev: () => void;
    onNext: () => void;
    onReset: () => void;
};

export default function DateNavigationBanner({
    simulatedDate,
    dayOffset,
    onPrev,
    onNext,
    onReset,
}: DateNavigationBannerProps) {
    const [slideClass, setSlideClass] = useState<string>('');

    return (
        <div className="flex items-center justify-center gap-3 my-3 flex-shrink-0 text-white relative">
            {dayOffset > 0 && (
                <button
                    type="button"
                    onClick={() => {
                        setSlideClass('slide-in-left');
                        onReset();
                    }}
                    aria-label="Reset to today"
                    className="absolute left-0 p-2 rounded-full hover:bg-gray-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                    <RotateCcw className="w-6 h-6" aria-hidden="true" />
                </button>
            )}
            {dayOffset > 0 && (
                <button
                    type="button"
                    onClick={() => {
                        setSlideClass('slide-in-left');
                        onPrev();
                    }}
                    aria-label="Previous day"
                    className="p-2 rounded-full hover:bg-gray-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                    <ChevronLeft className="w-6 h-6" aria-hidden="true" />
                </button>
            )}
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
                onClick={() => {
                    setSlideClass('slide-in-right');
                    onNext();
                }}
                aria-label="Next day"
                className="p-2 rounded-full hover:bg-gray-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
                <ChevronRight className="w-6 h-6" aria-hidden="true" />
            </button>
        </div>
    );
}
