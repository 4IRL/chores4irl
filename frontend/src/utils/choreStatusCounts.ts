// F17 status-count strip tally. Counts via classifyStatus (Standing invariant 15),
// so the strip, the timer bar and the sort never disagree about a chore's status.
import { differenceInDays, startOfDay } from 'date-fns';
import type { Chore } from '@customTypes/SharedTypes';
import { classifyStatus } from '@utils/choreBarMath';

export type StatusCounts = { doneToday: number; dueSoon: number; overdue: number };

// Done today is checked first; otherwise red → overdue, orange → due soon, and
// green-not-today (including a completion after the displayed day) gets no segment.
export function countStatuses(chores: Chore[], day: Date): StatusCounts {
    let doneToday = 0;
    let dueSoon = 0;
    let overdue = 0;
    for (const chore of chores) {
        // Same expression ChoreTimerBar and choreSort use, so strip, bar and sort agree.
        const daysSince = differenceInDays(startOfDay(day), startOfDay(chore.dateLastCompleted));
        if (daysSince === 0) {
            doneToday++;
        } else {
            const status = classifyStatus(daysSince, chore.frequency);
            if (status === 'red') overdue++;
            else if (status === 'orange') dueSoon++;
        }
    }
    return { doneToday, dueSoon, overdue };
}
