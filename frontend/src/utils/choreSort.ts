import { differenceInDays, startOfDay } from 'date-fns';
import type { Chore } from '@customTypes/SharedTypes';

export function calcDurationWeightedScore(chore: Chore, today: Date): number {
    const daysSince = differenceInDays(startOfDay(today), startOfDay(chore.dateLastCompleted));
    const percentOverdue = daysSince / chore.frequency;
    return chore.duration * percentOverdue;
}

function orderSubList(chores: Chore[], today: Date): Chore[] {
    return [...chores].sort((a, b) =>
        calcDurationWeightedScore(b, today) - calcDurationWeightedScore(a, today)
    );
}

export function orderChores(chores: Chore[], today: Date): Chore[] {
    const shortTerm = chores.filter(c => !c.longTermTask);
    const longTerm = chores.filter(c => c.longTermTask);
    return [...orderSubList(shortTerm, today), ...orderSubList(longTerm, today)];
}
