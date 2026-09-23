import { differenceInDays, startOfDay } from 'date-fns';
import type { Chore } from '@customTypes/SharedTypes';
import { classifyStatus } from '@utils/choreBarMath';
import { SORT_FOLD, SORT_BASE_QUOTA, SORT_PRESSURE_THRESHOLD, SORT_URGENCY_MULTIPLIER } from '@assets/constants';
import type { ChoreStatus } from '@assets/constants';

// Status-bucketed quota sort (F16). Each chore is bucketed by the colour its bar
// shows (classifyStatus), ranked within its bucket, and the first SORT_FOLD slots
// are filled per SORT_BASE_QUOTA — escalated toward red by badly-overdue chores,
// with unused slots donated red → orange → green; the rest follow in bucket order.
//
// The full order is computed by App.tsx's reconcileChores on first load (every id
// is newly seen) and recomputed by the simulatedDate effect at midnight /
// day-simulation steps. Later re-pulls sort only newly-seen ids and append them
// after the kept order (a quota-fill on that subset is intentional and harmless) —
// completing or editing a chore never re-sorts.

type Entry = { chore: Chore; key: number };

const STATUS_ORDER: ChoreStatus[] = ['red', 'orange', 'green'];

// Same expression ChoreTimerBar uses, so the sort and the bar agree on status.
function daysSinceCompleted(chore: Chore, today: Date): number {
    return differenceInDays(startOfDay(today), startOfDay(chore.dateLastCompleted));
}

// Only called for red chores, so frequency > 0.
function weightedOverdue(chore: Chore, daysSince: number): number {
    const overdueRatio = (daysSince - chore.frequency) / chore.frequency;
    return overdueRatio * SORT_URGENCY_MULTIPLIER[chore.urgency ?? 'medium'];
}

// Rank key per bucket: red → weighted overdue (desc), orange → remainingRatio
// (asc, closest to due first), green → daysSince (asc, most recently completed first).
function rankKey(chore: Chore, daysSince: number, status: ChoreStatus): number {
    if (status === 'red') return weightedOverdue(chore, daysSince);
    if (status === 'orange') return (chore.frequency - daysSince) / chore.frequency;
    return daysSince;
}

function foldQuota(pressure: number): Record<ChoreStatus, number> {
    const redQuota = Math.min(SORT_FOLD, SORT_BASE_QUOTA.red + pressure);
    const extra = redQuota - SORT_BASE_QUOTA.red;
    return {
        red: redQuota,
        orange: Math.max(0, SORT_BASE_QUOTA.orange - extra),
        green: Math.max(0, SORT_BASE_QUOTA.green - Math.max(0, extra - SORT_BASE_QUOTA.orange)),
    };
}

export function orderChores(chores: Chore[], today: Date): Chore[] {
    const buckets: Record<ChoreStatus, Entry[]> = { red: [], orange: [], green: [] };
    for (const chore of chores) {
        const daysSince = daysSinceCompleted(chore, today);
        const status = classifyStatus(daysSince, chore.frequency);
        buckets[status].push({ chore, key: rankKey(chore, daysSince, status) });
    }
    // Array.prototype.sort is stable, so equal keys keep input order.
    buckets.red.sort((a, b) => b.key - a.key || b.chore.duration - a.chore.duration);
    buckets.orange.sort((a, b) => a.key - b.key);
    buckets.green.sort((a, b) => a.key - b.key);

    const pressure = buckets.red.filter(entry => entry.key >= SORT_PRESSURE_THRESHOLD).length;
    const quota = foldQuota(pressure);
    const take: Record<ChoreStatus, number> = {
        red: Math.min(buckets.red.length, quota.red),
        orange: Math.min(buckets.orange.length, quota.orange),
        green: Math.min(buckets.green.length, quota.green),
    };

    let spare = SORT_FOLD - STATUS_ORDER.reduce((sum, status) => sum + take[status], 0);
    for (const status of STATUS_ORDER) {
        const add = Math.min(spare, buckets[status].length - take[status]);
        take[status] += add;
        spare -= add;
    }

    const fold = STATUS_ORDER.flatMap(status => buckets[status].slice(0, take[status]));
    const tail = STATUS_ORDER.flatMap(status => buckets[status].slice(take[status]));
    return [...fold, ...tail].map(entry => entry.chore);
}
