import { describe, it, expect } from 'vitest';
import type { Chore } from '@customTypes/SharedTypes';
import { subDays } from 'date-fns';
import { orderChores } from '@utils/choreSort';
import { computeBar } from '@utils/choreBarMath';
import { SORT_FOLD, SORT_BASE_QUOTA } from '@assets/constants';
import type { ChoreStatus } from '@assets/constants';
import { makeChore, localNoon } from '../fixtures/chore';

const TODAY = localNoon('2025-03-01');

// subDays keeps TODAY's local noon, so daysSince round-trips exactly through
// differenceInDays(startOfDay(...)) in every timezone.
const due = (id: number, daysSince: number, frequency: number, extra: Partial<Chore> = {}) =>
    makeChore({ id, frequency, dateLastCompleted: subDays(TODAY, daysSince), ...extra });

const orderedIds = (chores: Chore[]) => orderChores(chores, TODAY).map(c => c.id);

// Fixture recipe for boards given only by counts. Ids encode the bucket, and each
// bucket's ids are listed in its expected rank order:
//   pressured red   1..6   due(id, 10 + k, 5)   weighted (5 + k)/5 ≥ 1, k = 5..0
//   non-pressured   11..20 due(id, 20 + k, 20)  raw k/20 (0.05–0.5),    k = 10..1
//   orange          21..27 due(id, 10 + k, 16)  remaining (6 − k)/16,   k = 6..0
//   green           31..40 due(id, k, 30)       daysSince k,            k = 0..9
type BoardSpec = { pressured?: number; red?: number; orange?: number; green?: number };
type Board = {
    byId: Map<number, Chore>;
    statusOf: Map<number, ChoreStatus>;
    red: number[];
    orange: number[];
    green: number[];
};

function makeBoard({ pressured = 0, red = 0, orange = 0, green = 0 }: BoardSpec): Board {
    const byId = new Map<number, Chore>();
    const statusOf = new Map<number, ChoreStatus>();
    const add = (chore: Chore, status: ChoreStatus) => {
        byId.set(chore.id, chore);
        statusOf.set(chore.id, status);
        return chore.id;
    };
    const redIds: number[] = [];
    for (let rank = 0; rank < pressured; rank++) {
        redIds.push(add(due(1 + rank, 10 + (pressured - 1 - rank), 5), 'red'));
    }
    for (let rank = 0; rank < red; rank++) {
        redIds.push(add(due(11 + rank, 20 + (red - rank), 20), 'red'));
    }
    const orangeIds: number[] = [];
    for (let rank = 0; rank < orange; rank++) {
        orangeIds.push(add(due(21 + rank, 10 + (6 - rank), 16), 'orange'));
    }
    const greenIds: number[] = [];
    for (let rank = 0; rank < green; rank++) {
        greenIds.push(add(due(31 + rank, rank, 30), 'green'));
    }
    return { byId, statusOf, red: redIds, orange: orangeIds, green: greenIds };
}

// Orders the board's chores supplied in the reverse of `expected`, so a sort that
// ignored the rank key (and just kept input order) would fail.
function orderReversed(board: Board, expected: number[]): number[] {
    const input = [...expected].reverse().map(id => board.byId.get(id) as Chore);
    return orderedIds(input);
}

function countStatuses(ids: number[], statusOf: Map<number, ChoreStatus>): Record<ChoreStatus, number> {
    const counts: Record<ChoreStatus, number> = { red: 0, orange: 0, green: 0 };
    for (const id of ids) counts[statusOf.get(id) as ChoreStatus] += 1;
    return counts;
}

describe('orderChores', () => {
    it('1. returns an empty array for empty input', () => {
        expect(orderChores([], TODAY)).toEqual([]);
    });

    it('2. orders a board smaller than SORT_FOLD as all reds, then oranges, then greens', () => {
        const chores = [
            due(5, 1, 30),  // green
            due(3, 6, 8),   // orange, remaining 0.25
            due(2, 8, 7),   // red, ratio 1/7
            due(6, 2, 30),  // green
            due(1, 9, 7),   // red, ratio 2/7
            due(4, 7, 8),   // orange, remaining 0.125
        ];
        expect(orderedIds(chores)).toEqual([1, 2, 4, 3, 5, 6]);
    });

    it('3. buckets every chore by the colour computeBar paints it', () => {
        const spec: Record<number, { daysSince: number; frequency: number }> = {
            1: { daysSince: 4, frequency: 8 },  // green (remaining 0.5)
            2: { daysSince: 5, frequency: 8 },  // orange (remaining exactly 0.375)
            3: { daysSince: 8, frequency: 8 },  // orange (due, remaining 0)
            4: { daysSince: 9, frequency: 8 },  // red (ratio 0.125)
            5: { daysSince: 30, frequency: 0 }, // green (frequency 0)
            6: { daysSince: 1, frequency: 1 },  // orange (due, remaining 0)
            7: { daysSince: 2, frequency: 1 },  // red (ratio 1)
        };
        const input = [5, 2, 3, 1, 6, 4, 7].map(id => due(id, spec[id].daysSince, spec[id].frequency));
        const result = orderedIds(input);
        expect(result.map(id => computeBar(spec[id].daysSince, spec[id].frequency).barColor)).toEqual([
            'bg-red-500', 'bg-red-500',
            'bg-orange-500', 'bg-orange-500', 'bg-orange-500',
            'bg-green-500', 'bg-green-500',
        ]);
        // red by ratio desc; orange 3/6 tie at remaining 0 keeps input order, then 2; green by daysSince asc
        expect(result).toEqual([7, 4, 3, 6, 2, 1, 5]);
    });

    it('4. ranks a 10-day-overdue 2-min chore above a green 60-min chore', () => {
        const green60 = due(1, 3, 7, { duration: 60 });
        const red2 = due(2, 13, 3, { duration: 2 });
        expect(orderedIds([green60, red2])).toEqual([2, 1]);
    });

    it('5. ranks reds by overdueRatio regardless of duration, then by duration on a tie', () => {
        const long = due(2, 6, 4, { duration: 90 }); // ratio 0.5
        const short = due(1, 9, 3, { duration: 2 }); // ratio 2
        expect(orderedIds([long, short])).toEqual([1, 2]);

        const shortTied = due(3, 10, 5, { duration: 5 });  // ratio 1
        const longTied = due(4, 10, 5, { duration: 30 });  // ratio 1
        expect(orderedIds([shortTied, longTied])).toEqual([4, 3]);
    });

    it('6. ranks oranges by remainingRatio ascending (closest to due first)', () => {
        const chores = [
            due(1, 5, 8), // remaining 0.375
            due(3, 6, 8), // remaining 0.25
            due(2, 7, 8), // remaining 0.125
        ];
        expect(orderedIds(chores)).toEqual([2, 3, 1]);
    });

    it('7. ranks greens most-recently-completed first', () => {
        const chores = [due(3, 6, 30), due(1, 0, 30), due(2, 3, 30)];
        expect(orderedIds(chores)).toEqual([1, 2, 3]);
    });

    it('8. fills the fold 4 red / 2 orange / 2 green, then the rest in bucket order', () => {
        const board = makeBoard({ red: 6, orange: 4, green: 4 });
        const { red, orange, green } = board;
        const expected = [
            ...red.slice(0, 4), ...orange.slice(0, 2), ...green.slice(0, 2),
            ...red.slice(4), ...orange.slice(2), ...green.slice(2),
        ];
        const result = orderReversed(board, expected);
        expect(countStatuses(result.slice(0, SORT_FOLD), board.statusOf)).toEqual({ red: 4, orange: 2, green: 2 });
        expect(result).toEqual(expected);
    });

    it('9a. donates unused red slots to orange when red runs short', () => {
        const board = makeBoard({ red: 1, orange: 5, green: 5 });
        const { red, orange, green } = board;
        const expected = [...red, ...orange, ...green.slice(0, 2), ...green.slice(2)];
        const result = orderReversed(board, expected);
        expect(countStatuses(result.slice(0, SORT_FOLD), board.statusOf)).toEqual({ red: 1, orange: 5, green: 2 });
        expect(result).toEqual(expected);
    });

    it('9b. donates an empty orange bucket\'s slots to red', () => {
        const board = makeBoard({ red: 6, green: 3 });
        const { red, green } = board;
        const expected = [...red, ...green.slice(0, 2), ...green.slice(2)];
        const result = orderReversed(board, expected);
        expect(countStatuses(result.slice(0, SORT_FOLD), board.statusOf)).toEqual({ red: 6, orange: 0, green: 2 });
        expect(result).toEqual(expected);
    });

    it('10a. four pressured reds escalate the whole fold to red', () => {
        const board = makeBoard({ pressured: 4, red: 4, orange: 2, green: 2 });
        const { red, orange, green } = board;
        const expected = [...red, ...orange, ...green];
        const result = orderReversed(board, expected);
        expect(countStatuses(result.slice(0, SORT_FOLD), board.statusOf)).toEqual({ red: 8, orange: 0, green: 0 });
        expect(result).toEqual(expected);
    });

    it('10b. two pressured reds drain the orange quota first', () => {
        const board = makeBoard({ pressured: 2, red: 6, orange: 2, green: 2 });
        const { red, orange, green } = board;
        const expected = [...red.slice(0, 6), ...green, ...red.slice(6), ...orange];
        const result = orderReversed(board, expected);
        expect(countStatuses(result.slice(0, SORT_FOLD), board.statusOf)).toEqual({ red: 6, orange: 0, green: 2 });
        expect(result).toEqual(expected);
    });

    it('11a. pressure 3 partially reduces the green quota', () => {
        const board = makeBoard({ pressured: 3, red: 5, orange: 2, green: 2 });
        const { red, orange, green } = board;
        const expected = [...red.slice(0, 7), green[0], red[7], ...orange, green[1]];
        const result = orderReversed(board, expected);
        expect(countStatuses(result.slice(0, SORT_FOLD), board.statusOf)).toEqual({ red: 7, orange: 0, green: 1 });
        expect(result).toEqual(expected);
    });

    it('11b. the pressure threshold is inclusive', () => {
        // One medium red at f5/d10 = weighted exactly 1 → pressure 1 → 5r/1o/2g.
        const board = makeBoard({ pressured: 1, red: 4, orange: 2, green: 2 });
        const { red, orange, green } = board;
        const expected = [...red, orange[0], ...green, orange[1]];
        const result = orderReversed(board, expected);
        expect(countStatuses(result.slice(0, SORT_FOLD), board.statusOf)).toEqual({ red: 5, orange: 1, green: 2 });
        expect(result).toEqual(expected);

        // Replace it with f10/d19 (weighted 0.9) → pressure 0 → 4r/2o/2g.
        board.byId.set(1, due(1, 19, 10));
        const expectedBelow = [...red.slice(0, 4), ...orange, ...green, red[4]];
        const resultBelow = orderReversed(board, expectedBelow);
        expect(countStatuses(resultBelow.slice(0, SORT_FOLD), board.statusOf)).toEqual({ red: 4, orange: 2, green: 2 });
        expect(resultBelow).toEqual(expectedBelow);
    });

    it('11c. pressure beyond fold capacity fills the fold with reds and loses no chore', () => {
        const board = makeBoard({ pressured: 6, red: 4, orange: 2, green: 2 });
        const { red, orange, green } = board;
        const expected = [...red, ...orange, ...green];
        const result = orderReversed(board, expected);
        expect(countStatuses(result.slice(0, SORT_FOLD), board.statusOf)).toEqual({ red: 8, orange: 0, green: 0 });
        expect(result).toEqual(expected);
        expect(result).toHaveLength(14);
        expect(new Set(result)).toEqual(new Set(board.byId.keys()));
    });

    it('12. pours every fold slot into the only bucket on an all-one-bucket board', () => {
        const greens = makeBoard({ green: 10 });
        expect(orderReversed(greens, greens.green)).toEqual(greens.green);

        const reds = makeBoard({ red: 10 });
        expect(orderReversed(reds, reds.red)).toEqual(reds.red);
    });

    it('13. urgency flips rank between reds', () => {
        const low = due(1, 9, 5, { urgency: 'low' });   // raw 0.8
        const high = due(2, 9, 5, { urgency: 'high' }); // raw 0.8
        expect(orderedIds([low, high])).toEqual([2, 1]);

        const lowFar = due(3, 10, 5, { urgency: 'low' });   // raw 1.0 → weighted 0.75
        const highNear = due(4, 8, 5, { urgency: 'high' }); // raw 0.6 → weighted 0.9
        expect(orderedIds([lowFar, highNear])).toEqual([4, 3]);
    });

    it('14. urgency flips escalation pressure', () => {
        const statusOf = new Map<number, ChoreStatus>([
            [1, 'red'], [2, 'red'], [3, 'red'], [4, 'red'], [5, 'red'],
            [21, 'orange'], [22, 'orange'], [31, 'green'], [32, 'green'],
        ]);
        const boardWith = (urgency: Chore['urgency']) => [
            due(32, 1, 30), due(31, 0, 30), due(22, 11, 16), due(21, 12, 16),
            due(1, 6, 5), due(2, 6, 5), due(3, 6, 5), due(4, 6, 5), // raw 0.2
            due(5, 9, 5, { urgency }),                              // raw 0.8
        ];

        const high = orderedIds(boardWith('high')); // weighted 1.2 → pressure 1
        expect(countStatuses(high.slice(0, SORT_FOLD), statusOf)).toEqual({ red: 5, orange: 1, green: 2 });
        expect(high[0]).toBe(5);
        expect(high[SORT_FOLD]).toBe(22);

        const low = orderedIds(boardWith('low')); // weighted 0.6 → pressure 0
        expect(countStatuses(low.slice(0, SORT_FOLD), statusOf)).toEqual({ red: 4, orange: 2, green: 2 });
        expect(low[0]).toBe(5);
        expect(statusOf.get(low[SORT_FOLD])).toBe('red');
    });

    it('15. treats unset urgency as medium', () => {
        // X at f5/d10 (raw exactly 1.0), Y medium at f5/d11 (raw 1.2) → pressure 2 → 6r/0o/2g.
        const expected = [2, 1, 11, 12, 13, 14, 31, 32, 21, 22];
        const boardWith = (xExtra: Partial<Chore>) => {
            const byId = new Map<number, Chore>([
                [1, due(1, 10, 5, xExtra)],
                [2, due(2, 11, 5, { urgency: 'medium' })],
                [11, due(11, 24, 20)], [12, due(12, 23, 20)], [13, due(13, 22, 20)], [14, due(14, 21, 20)],
                [21, due(21, 16, 16)], [22, due(22, 15, 16)],
                [31, due(31, 0, 30)], [32, due(32, 1, 30)],
            ]);
            return [...expected].reverse().map(id => byId.get(id) as Chore);
        };
        expect(orderedIds(boardWith({}))).toEqual(expected);
        expect(orderedIds(boardWith({ urgency: 'medium' }))).toEqual(expected);
    });

    it('16. keeps input order for chores with identical rank keys in every bucket', () => {
        const chores = [
            due(3, 8, 5), due(1, 8, 5), due(2, 8, 5),    // red, tied
            due(6, 6, 8), due(4, 6, 8), due(5, 6, 8),    // orange, tied
            due(9, 2, 30), due(7, 2, 30), due(8, 2, 30), // green, tied
        ];
        expect(orderedIds(chores)).toEqual([3, 1, 2, 6, 4, 5, 9, 7, 8]);
    });

    it('17. places frequency-0 chores in green, never red, without NaN', () => {
        const chores = [due(1, 0, 0), due(2, 100, 0), due(4, 6, 8), due(3, 8, 7)];
        expect(() => orderChores(chores, TODAY)).not.toThrow();
        // red 3, orange 4, then both frequency-0 chores in green by daysSince ascending
        expect(orderedIds(chores)).toEqual([3, 4, 1, 2]);
    });

    it('18. ignores a legacy longTermTask flag', () => {
        const weekly = due(1, 5, 7);    // orange
        const quarterly = due(2, 380, 90); // red
        // cast: longTermTask is no longer on the Chore type; keeps this stale-key test compiling
        const flagged = { ...quarterly, longTermTask: true } as unknown as Chore;
        expect(orderedIds([weekly, flagged])).toEqual(orderedIds([weekly, quarterly]));
        expect(orderedIds([weekly, flagged])).toEqual([2, 1]);
    });

    it('19. a small board stays plain bucket order even with pressure', () => {
        // Pressure 1 cuts the orange quota to 1, but donation still pulls the second
        // orange into the fold ahead of the greens.
        const chores = [
            due(6, 2, 30), due(5, 1, 30), // green
            due(3, 6, 8), due(4, 7, 8),   // orange, remaining 0.25 / 0.125
            due(2, 12, 10),               // red, raw 0.2
            due(1, 10, 5),                // red, weighted 1.0 → pressure 1
        ];
        expect(orderedIds(chores)).toEqual([1, 2, 4, 3, 5, 6]);
    });

    it('20. the base quotas sum to SORT_FOLD', () => {
        expect(SORT_BASE_QUOTA.red + SORT_BASE_QUOTA.orange + SORT_BASE_QUOTA.green).toBe(SORT_FOLD);
    });
});
