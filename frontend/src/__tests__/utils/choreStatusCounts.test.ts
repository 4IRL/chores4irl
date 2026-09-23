import { describe, it, expect } from 'vitest';
import type { Chore } from '@customTypes/SharedTypes';
import { addDays, subDays } from 'date-fns';
import { countStatuses } from '@utils/choreStatusCounts';
import { makeChore, localNoon } from '../fixtures/chore';

const TODAY = localNoon('2025-03-01');

// subDays keeps TODAY's local noon, so daysSince round-trips exactly through
// differenceInDays(startOfDay(...)) in every timezone.
const due = (id: number, daysSince: number, frequency: number, extra: Partial<Chore> = {}): Chore =>
    makeChore({ id, frequency, dateLastCompleted: subDays(TODAY, daysSince), ...extra });

describe('countStatuses', () => {
    it('tallies a mixed board into done today / due soon / overdue', () => {
        const board = [
            due(1, 0, 7), // done today
            due(2, 5, 7), // orange (ratio 2/7)
            due(3, 7, 7), // orange (ratio 0 — due today, not overdue)
            due(4, 9, 7), // red
            due(5, 20, 7), // red
            due(6, 1, 7), // green, not today — no segment
        ];
        expect(countStatuses(board, TODAY)).toEqual({ doneToday: 1, dueSoon: 2, overdue: 2 });
    });

    it('counts a morning board with nothing done yet', () => {
        const board = [due(1, 5, 7), due(2, 9, 7), due(3, 1, 7)];
        expect(countStatuses(board, TODAY)).toEqual({ doneToday: 0, dueSoon: 1, overdue: 1 });
    });

    it('counts nothing for an all-green board with none done today', () => {
        const board = [due(1, 1, 7), due(2, 2, 30)];
        expect(countStatuses(board, TODAY)).toEqual({ doneToday: 0, dueSoon: 0, overdue: 0 });
    });

    it('returns all zeros for an empty list', () => {
        expect(countStatuses([], TODAY)).toEqual({ doneToday: 0, dueSoon: 0, overdue: 0 });
    });

    it('counts a chore completed earlier on the displayed day as done today', () => {
        const earlierToday = makeChore({ id: 1, frequency: 7, dateLastCompleted: new Date(2025, 2, 1, 8, 0) });
        expect(countStatuses([earlierToday], TODAY)).toEqual({ doneToday: 1, dueSoon: 0, overdue: 0 });

        const yesterday = makeChore({ id: 1, frequency: 7, dateLastCompleted: subDays(TODAY, 1) });
        expect(countStatuses([yesterday], TODAY)).toEqual({ doneToday: 0, dueSoon: 0, overdue: 0 });
    });

    it('gives no segment to a completion after the displayed day', () => {
        const future = makeChore({ id: 1, frequency: 7, dateLastCompleted: addDays(TODAY, 1) });
        expect(countStatuses([future], TODAY)).toEqual({ doneToday: 0, dueSoon: 0, overdue: 0 });
    });

    it('takes status from classifyStatus (frequency 0 is green)', () => {
        expect(countStatuses([due(1, 3, 0)], TODAY)).toEqual({ doneToday: 0, dueSoon: 0, overdue: 0 });
    });

    it('counts exactly what it is given — room and search narrowing is the caller\'s', () => {
        const board = [
            due(1, 0, 7, { room: 'Kitchen', name: 'Sweep' }),
            due(2, 9, 7, { room: 'Kitchen', name: 'Mop' }),
            due(3, 9, 7, { room: 'Bathroom', name: 'Scrub' }),
        ];
        const kitchen = board.filter(chore => chore.room === 'Kitchen');
        expect(countStatuses(kitchen, TODAY)).toEqual({ doneToday: 1, dueSoon: 0, overdue: 1 });

        const kitchenMop = kitchen.filter(chore => chore.name.toLowerCase().includes('mop'));
        expect(countStatuses(kitchenMop, TODAY)).toEqual({ doneToday: 0, dueSoon: 0, overdue: 1 });
    });
});
