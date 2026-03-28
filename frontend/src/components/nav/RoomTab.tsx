type RoomTabProps = {
    label: string;
    value: string;
    isActive: boolean;
    onClick: (value: string) => void;
};

export default function RoomTab({ label, value, isActive, onClick }: RoomTabProps) {
    const activeClasses = 'border-b-2 border-indigo-500 text-indigo-400';
    const inactiveClasses = 'text-gray-400 hover:text-gray-200';

    return (
        <button
            className={`px-6 py-4 font-medium flex items-center ${isActive ? activeClasses : inactiveClasses}`}
            onClick={() => onClick(value)}
        >
            {label}
        </button>
    );
}
