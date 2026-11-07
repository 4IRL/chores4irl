import type { Chore } from '@customTypes/SharedTypes';
import { classifyStatus } from './choreBarMath';
import { daysSinceInZone } from './choreSort';

export type StatusCounts = { done: number; dueSoon: number; overdue: number };

export function choreStatusCounts(
  chores: Pick<Chore, 'dateLastCompleted' | 'frequency'>[],
  today: Date,
  timezone: string,
): StatusCounts {
  const counts: StatusCounts = { done: 0, dueSoon: 0, overdue: 0 };
  for (const chore of chores) {
    const daysSince = daysSinceInZone(today, chore.dateLastCompleted, timezone);
    // Completed today is only "done": it must never also count as due soon.
    if (daysSince === 0) {
      counts.done += 1;
      continue;
    }
    const status = classifyStatus(daysSince, chore.frequency);
    if (status === 'red') counts.overdue += 1;
    else if (status === 'orange') counts.dueSoon += 1;
  }
  return counts;
}
