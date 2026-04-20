type AddChoreButtonProps = {
    onClick: () => void;
};

export default function AddChoreButton({ onClick }: AddChoreButtonProps) {
    return (
        <button
            className="bg-blue-500 hover:bg-blue-600 bg-opacity-50 text-white font-medium py-3 min-h-[44px] px-6 rounded-full"
            onClick={onClick}
        >
            + Add Task
        </button>
    );
}
