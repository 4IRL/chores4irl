import { differenceInDays, startOfDay } from 'date-fns';
import type { Chore } from '@customTypes/SharedTypes';

export function calcDurationWeightedScore(chore: Chore, today: Date): number {
    const daysSince = differenceInDays(startOfDay(today), startOfDay(chore.dateLastCompleted));
    const percentOverdue = daysSince / chore.frequency;
    return chore.duration * percentOverdue;
}

export function orderChores(chores: Chore[], today: Date): Chore[] {
    return [...chores].sort((a, b) =>
        calcDurationWeightedScore(b, today) - calcDurationWeightedScore(a, today)
    );
}
