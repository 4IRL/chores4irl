import type { Chore } from '@customTypes/SharedTypes';

import ChoreTimerBar from './ChoreTimerBar';

type ChoreListProps = {
  chores: Chore[];
  today: Date;
  // onClick: (id: number) => void;
};

const ChoreList = ({ chores, today }: ChoreListProps) => {
  return (
    <div className="space-y-3">
      {chores.map(chore => (
        <div key={chore.id}>
          <ChoreTimerBar
            chore={chore}
            today={today}
            // onClick={onClick}
          />
        </div>
      ))}
    </div>
  );
}

export default ChoreList;