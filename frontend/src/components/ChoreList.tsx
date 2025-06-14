import type { Chore } from '@customTypes/SharedTypes';

import ChoreTimerBar from './ChoreTimerBar';

type ChoreListProps = {
  chores: Chore[];
  day: Date;
  // onClick: (id: number) => void;
};

const ChoreList = ({ chores, day }: ChoreListProps) => {
  return (
    <div className="space-y-3">
      {chores.map(chore => (
        <div key={chore.id}>
          <ChoreTimerBar
            chore={chore}
            day={day}
            // onClick={onClick}
          />
        </div>
      ))}
    </div>
  );
}

export default ChoreList;