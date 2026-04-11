import type { Chore } from '@customTypes/SharedTypes';
import ChoreTimerBar from './ChoreTimerBar';

type ChoreListProps = {
    chores: Chore[];
    day: Date;
    onComplete: (id: number, date: Date) => void;
    onDelete: (id: number) => void;
};

export default function ChoreList({ chores, day, onComplete, onDelete }: ChoreListProps) {
    return (
        <div className="space-y-3">
            {chores.map(chore => (
                <div key={chore.id}>
                    <ChoreTimerBar chore={chore} day={day} onComplete={onComplete} onDelete={onDelete} />
                </div>
            ))}
        </div>
    );
}
