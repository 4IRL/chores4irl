import { RotateCcw } from 'lucide-react';

type ReturnToTodayButtonProps = {
    dayOffset: number;
    onReset: () => void;
};

export default function ReturnToTodayButton({
    dayOffset,
    onReset,
}: ReturnToTodayButtonProps) {
    if (dayOffset === 0) return null;

    return (
        <div className="flex justify-center flex-shrink-0 mt-2 slide-in-top">
            <button
                type="button"
                onClick={() => onReset()}
                className="inline-flex items-center gap-2 px-4 py-2 mb-4 rounded-full bg-gray-700 hover:bg-gray-600 text-white text-sm sm:text-base font-medium min-h-[44px]"
            >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                <span>Return to today</span>
            </button>
        </div>
    );
}
