// Status-bucketed quota sort.
//
// Every chore is classified red / orange / green by the same `classifyStatus`
// that colours its bar, so colour and order cannot disagree. Chores are ranked
// inside their bucket, then the first SORT_FOLD slots are filled by quota
// (red 4, orange 2, green 2). Badly overdue reds (weighted overdue >=
// SORT_PRESSURE_THRESHOLD) each take one extra slot, drawn from orange first
// and then green; unused slots cascade to the next bucket. The remainder
// follows the fold in red, orange, green order.
//
// `urgency` weights the red rank and the pressure count only; it never changes
// a chore's bucket. The sort is pure and runs on every render of ChoresView
// (there is no reconcile step), over whatever list it is given, so the fold
// applies to the visible (room- and search-filtered) subset.
import { differenceInDays, startOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { Chore } from '@customTypes/SharedTypes';
import {
  SORT_BASE_QUOTA,
  SORT_FOLD,
  SORT_PRESSURE_THRESHOLD,
  SORT_URGENCY_MULTIPLIER,
  type ChoreStatus,
} from '@assets/constants';
import { classifyStatus, remainingRatioOf } from './choreBarMath';

// Calendar-day flooring is timezone-dependent (an instant near midnight can
// fall on different days depending which zone reads it), so both timestamps
// must be interpreted in the same zone — the household's — rather than
// whichever timezone the viewer's own device happens to be set to.
export function daysSinceInZone(today: Date, dateLastCompleted: Date, timezone: string): number {
  return differenceInDays(
    startOfDay(toZonedTime(today, timezone)),
    startOfDay(toZonedTime(dateLastCompleted, timezone)),
  );
}

type Ranked = { chore: Chore; daysSince: number; weightedOverdue: number };

function weightedOverdueOf(chore: Chore, daysSince: number): number {
  if (chore.frequency <= 0) return 0;
  const multiplier = SORT_URGENCY_MULTIPLIER[chore.urgency ?? 'medium'];
  return ((daysSince - chore.frequency) / chore.frequency) * multiplier;
}

export function orderChores(chores: Chore[], today: Date, timezone: string): Chore[] {
  const buckets: Record<ChoreStatus, Ranked[]> = { red: [], orange: [], green: [] };
  for (const chore of chores) {
    const daysSince = daysSinceInZone(today, chore.dateLastCompleted, timezone);
    const status = classifyStatus(daysSince, chore.frequency);
    buckets[status].push({ chore, daysSince, weightedOverdue: weightedOverdueOf(chore, daysSince) });
  }

  // Array.prototype.sort is stable, so equal keys keep input order.
  buckets.red.sort((a, b) => b.weightedOverdue - a.weightedOverdue || b.chore.duration - a.chore.duration);
  buckets.orange.sort(
    (a, b) =>
      remainingRatioOf(a.daysSince, a.chore.frequency) - remainingRatioOf(b.daysSince, b.chore.frequency),
  );
  buckets.green.sort((a, b) => a.daysSince - b.daysSince);

  const pressure = buckets.red.filter((r) => r.weightedOverdue >= SORT_PRESSURE_THRESHOLD).length;
  const redQuota = Math.min(SORT_FOLD, SORT_BASE_QUOTA.red + pressure);
  const extra = redQuota - SORT_BASE_QUOTA.red;
  const orangeQuota = Math.max(0, SORT_BASE_QUOTA.orange - extra);
  const greenQuota = Math.max(0, SORT_BASE_QUOTA.green - Math.max(0, extra - SORT_BASE_QUOTA.orange));

  const take: Record<ChoreStatus, number> = {
    red: Math.min(buckets.red.length, redQuota),
    orange: Math.min(buckets.orange.length, orangeQuota),
    green: Math.min(buckets.green.length, greenQuota),
  };

  // Spare slots (a bucket had fewer chores than its quota) go red, orange, green.
  let spare = SORT_FOLD - (take.red + take.orange + take.green);
  for (const status of ['red', 'orange', 'green'] as const) {
    if (spare <= 0) break;
    const add = Math.min(spare, buckets[status].length - take[status]);
    take[status] += add;
    spare -= add;
  }

  const fold: Chore[] = [];
  const tail: Chore[] = [];
  for (const status of ['red', 'orange', 'green'] as const) {
    const ranked = buckets[status].map((r) => r.chore);
    fold.push(...ranked.slice(0, take[status]));
    tail.push(...ranked.slice(take[status]));
  }
  return [...fold, ...tail];
}
