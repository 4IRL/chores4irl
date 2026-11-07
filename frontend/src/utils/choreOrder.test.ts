import { describe, expect, it } from 'vitest';
import { applyOrder, snapshotOrder } from './choreOrder';
import { orderChores } from './choreSort';
import { TODAY, daysAgo, makeChore } from '../test/fixtures/chore';

const TZ = 'UTC';

const chores = [
  makeChore({ id: 1, roomId: 1, dateLastCompleted: daysAgo(1), frequency: 7 }),
  makeChore({ id: 2, roomId: 2, dateLastCompleted: daysAgo(30), frequency: 7 }),
  makeChore({ id: 3, roomId: 1, dateLastCompleted: daysAgo(10), frequency: 7 }),
  makeChore({ id: 4, roomId: 2, dateLastCompleted: daysAgo(0), frequency: 7 }),
];

describe('snapshotOrder', () => {
  it('returns the hand-derived order: reds by weighted overdue, then greens by days since', () => {
    // Ids 2 (30d / 7) and 3 (10d / 7) are red, most overdue first; ids 4 (0d) and 1 (1d)
    // are not overdue and sort by fewest days since completion.
    expect(snapshotOrder(chores, TODAY, TZ)).toEqual([2, 3, 4, 1]);
  });

  it('equals the order orderChores produces', () => {
    expect(snapshotOrder(chores, TODAY, TZ)).toEqual(orderChores(chores, TODAY, TZ).map((c) => c.id));
  });
});

describe('applyOrder', () => {
  it('keeps snapshotted chores in snapshot order regardless of input order or dates', () => {
    const result = applyOrder([...chores].reverse(), [3, 1, 4, 2]);
    expect(result.map((c) => c.id)).toEqual([3, 1, 4, 2]);
  });

  it('places unknown chores after known ones in input order', () => {
    const result = applyOrder(chores, [4, 2]);
    expect(result.map((c) => c.id)).toEqual([4, 2, 1, 3]);
  });

  it('yields a filtered subset in global snapshot order', () => {
    const ids = snapshotOrder(chores, TODAY, TZ);
    const room1 = chores.filter((c) => c.roomId === 1).reverse();
    expect(applyOrder(room1, ids).map((c) => c.id)).toEqual(
      ids.filter((id) => room1.some((c) => c.id === id)),
    );
  });

  it('tolerates dangling ids without throwing or adding rows', () => {
    const result = applyOrder(chores, [99, 3, 98]);
    expect(result.map((c) => c.id)).toEqual([3, 1, 2, 4]);
  });

  it('returns a new array for empty and non-empty sortedIds', () => {
    expect(applyOrder(chores, [])).not.toBe(chores);
    expect(applyOrder(chores, [4, 3])).not.toBe(chores);
  });

  it('returns an empty array for empty chores', () => {
    expect(applyOrder([], [1, 2, 3])).toEqual([]);
  });

  it('uses the first index when sortedIds has duplicate ids', () => {
    const result = applyOrder(chores, [2, 1, 2, 3]);
    expect(result.map((c) => c.id)).toEqual([2, 1, 3, 4]);
  });

  it('does not mutate the input array', () => {
    const input = [...chores];
    applyOrder(input, [4, 3, 2, 1]);
    expect(input.map((c) => c.id)).toEqual([1, 2, 3, 4]);
  });
});
