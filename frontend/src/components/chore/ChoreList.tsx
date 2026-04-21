import type { Chore } from '@customTypes/SharedTypes';
import ChoreTimerBar from './ChoreTimerBar';

type ChoreListProps = {
    chores: Chore[];
    day: Date;
    isSimulating: boolean;
    onComplete: (id: number, date: Date) => void;
    onDelete: (id: number) => void;
};

export default function ChoreList({ chores, day, isSimulating, onComplete, onDelete }: ChoreListProps) {
    if (chores.length === 0) {
        return (
            <div>
                <p className="text-gray-400 text-center py-8">
                    No chores yet — tap + Add Task to get started.
                </p>
            </div>
        );
    }
    return (
        <div className="space-y-3 pb-4">
            {chores.map(chore => (
                <div key={chore.id}>
                    <ChoreTimerBar
                        chore={chore}
                        day={day}
                        isSimulating={isSimulating}
                        onComplete={onComplete}
                        onDelete={onDelete}
                    />
                </div>
            ))}
        </div>
    );
}
