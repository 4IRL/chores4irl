import { X } from 'lucide-react';

type ClearButtonProps = {
    /** Accessible name for the button (used as aria-label); must be a non-empty, descriptive string, e.g. "Clear Search". */
    label: string;
    onClear: () => void;
    anchor?: 'center' | 'top';
};

export default function ClearButton({ label, onClear, anchor = 'center' }: ClearButtonProps) {
    return (
        <button
            type="button"
            onClick={() => onClear()}
            aria-label={label}
            className={`absolute right-3 min-w-[44px] min-h-[44px] p-1 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center ${anchor === 'top' ? 'top-0' : 'top-1/2 -translate-y-1/2'}`}
        >
            <X className="w-4 h-4" aria-hidden="true" />
        </button>
    );
}
