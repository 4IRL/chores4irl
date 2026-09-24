import type { Chore } from '@customTypes/SharedTypes';
import ChoreTimerBar, { type LockGuardProps } from './ChoreTimerBar';

type ChoreListProps = {
    chores: Chore[];
    day: Date;
    isSimulating: boolean;
    onComplete: (id: number, date: Date) => void;
    onDelete: (id: number) => void;
    onEdit?: (id: number) => void;
} & LockGuardProps;

export default function ChoreList({
    // F20: the lock props stay bundled in a rest object and are spread through
    // whole, so the isLocked/onGuardedAttempt coupling (LockGuardProps) survives
    // the hop to each bar; destructuring them apart would lose the correlation.
    chores, day, isSimulating, onComplete, onDelete, onEdit, ...lockGuard
}: ChoreListProps) {
    if (chores.length === 0) {
        return (
            <div className="px-4">
                <p className="text-gray-400 text-center py-8">
                    No chores yet — tap + Add Task to get started.
                </p>
            </div>
        );
    }
    return (
        <div className="space-y-3 pb-4 px-4">
            {chores.map(chore => (
                <div key={chore.id}>
                    <ChoreTimerBar
                        chore={chore}
                        day={day}
                        isSimulating={isSimulating}
                        onComplete={onComplete}
                        onDelete={onDelete}
                        onEdit={onEdit}
                        {...lockGuard}
                    />
                </div>
            ))}
        </div>
    );
}
