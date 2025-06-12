import type { Chore } from '@customTypes/SharedTypes';

import ChoreTimerBar from './ChoreTimerBar';

type ChoreListProps = {
  chores: Chore[];
  onClick: (id: number) => void;
};

const ChoreList = ({ chores, onClick }: ChoreListProps) => {
  return (
    <div className="space-y-3">
      {chores.map(chore => (
        <div key={chore.id}>
          <ChoreTimerBar
            chore={chore}
            onClick={onClick}
          />
        </div>
      ))}
    </div>
  );
}

export default ChoreList;