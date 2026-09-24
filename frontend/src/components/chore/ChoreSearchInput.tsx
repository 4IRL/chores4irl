import { useRef } from 'react';
import { Search } from 'lucide-react';
import ClearButton from '../common/ClearButton';

type ChoreSearchInputProps = {
    value: string;
    onChange: (value: string) => void;
};

export default function ChoreSearchInput({ value, onChange }: ChoreSearchInputProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="flex-shrink-0 mb-3 px-4">
            <div className="relative">
                <Search
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                    aria-hidden="true"
                />
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder="Search for a chore"
                    aria-label="Search for a chore"
                    className="w-full bg-gray-800 text-white placeholder-gray-400 rounded-lg border border-gray-700 pl-9 pr-14 py-2 text-sm focus:outline-none focus:border-gray-500"
                />
                {value !== '' && (
                    <ClearButton
                        label="Clear Search"
                        onClear={() => {
                            onChange('');
                            inputRef.current?.focus();
                        }}
                    />
                )}
            </div>
        </div>
    );
}
