import { Search } from 'lucide-react';

type ChoreSearchInputProps = {
    value: string;
    onChange: (value: string) => void;
};

export default function ChoreSearchInput({ value, onChange }: ChoreSearchInputProps) {
    return (
        <div className="flex-shrink-0 mb-3">
            <div className="relative">
                <Search
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                    aria-hidden="true"
                />
                <input
                    type="text"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder="Search for a chore"
                    aria-label="Search for a chore"
                    className="w-full bg-gray-800 text-white placeholder-gray-400 rounded-lg border border-gray-700 pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                />
            </div>
        </div>
    );
}
