import type { Chore, SwipeStyle } from '@customTypes/SharedTypes';
import ChoreTimerBar from './ChoreTimerBar';

type ChoreListProps = {
  chores: Chore[];
  day: Date;
  householdTimezone: string;
  isSimulating: boolean;
  swipeStyle: SwipeStyle;
  onComplete: (id: number, date: Date) => void;
  onDelete: (id: number) => void;
  onEdit?: (id: number) => void;
  onDialogOpenChange?: (open: boolean) => void;
};

export default function ChoreList({
  chores,
  day,
  householdTimezone,
  isSimulating,
  swipeStyle,
  onComplete,
  onDelete,
  onEdit,
  onDialogOpenChange,
}: ChoreListProps) {
  if (chores.length === 0) {
    return (
      <div>
        <p className="text-gray-400 text-center py-8">No chores yet — tap + Add Chore to get started.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3 pb-4">
      {chores.map((chore) => (
        <div key={chore.id}>
          <ChoreTimerBar
            chore={chore}
            day={day}
            householdTimezone={householdTimezone}
            isSimulating={isSimulating}
            swipeStyle={swipeStyle}
            onComplete={onComplete}
            onDelete={onDelete}
            onEdit={onEdit}
            onDialogOpenChange={onDialogOpenChange}
          />
        </div>
      ))}
    </div>
  );
}
