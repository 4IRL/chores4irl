import { describe, it, expect } from 'vitest';
import { daysSinceInZone, orderChores } from './choreSort';
import { computeBar } from './choreBarMath';
import { SORT_BASE_QUOTA, SORT_FOLD, STATUS_BAR_COLOR, type ChoreStatus } from '@assets/constants';
import type { Chore } from '@customTypes/SharedTypes';
import { TODAY, daysAgo, makeChore } from '../test/fixtures/chore';

// Id ranges encode the intended bucket: 100s red, 200s orange, 300s green.
function red(id: number, weightedOverdue: number, overrides: Partial<Chore> = {}): Chore {
  // frequency 10: daysSince = 10 + 10 * weightedOverdue (medium urgency).
  return makeChore({
    id,
    frequency: 10,
    dateLastCompleted: daysAgo(10 + Math.round(weightedOverdue * 10)),
    ...overrides,
  });
}

function orange(id: number, daysSince: number, overrides: Partial<Chore> = {}): Chore {
  return makeChore({ id, frequency: 100, dateLastCompleted: daysAgo(daysSince), ...overrides });
}

// Same shape as orange(); the bucket comes from daysSince, so green is an alias.
const green = orange;

// n reds with weighted overdue below the pressure threshold, ranked id-ascending.
function mildReds(startId: number, n: number): Chore[] {
  return Array.from({ length: n }, (_, i) => red(startId + i, (n - i) / 10));
}

// n reds at or above the pressure threshold (>= 1.1), ranked id-ascending.
function highReds(startId: number, n: number): Chore[] {
  return Array.from({ length: n }, (_, i) => red(startId + i, 1 + (n - i) / 10));
}

// Orange: higher daysSince means closer to due, so it ranks first (id-ascending).
function oranges(startId: number, n: number): Chore[] {
  return Array.from({ length: n }, (_, i) => orange(startId + i, 99 - i));
}

// Green: lower daysSince means more recently completed, so it ranks first (id-ascending).
function greens(startId: number, n: number): Chore[] {
  return Array.from({ length: n }, (_, i) => green(startId + i, i + 1));
}

function range(start: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => start + i);
}

function ids(chores: Chore[]): number[] {
  return chores.map((c) => c.id);
}

function sorted(board: Chore[]): number[] {
  return ids(orderChores(board, TODAY, 'UTC'));
}

// Every distinct-key board must sort identically from the forward and the
// reversed input, so a sort that ignores the rank key (and just keeps input
// order) fails one of the two directions.
function sortedBothWays(board: Chore[]): number[] {
  const forward = sorted(board);
  expect(sorted([...board].reverse())).toEqual(forward);
  return forward;
}

describe('orderChores', () => {
  it('returns an empty list for empty input', () => {
    expect(orderChores([], TODAY, 'UTC')).toEqual([]);
  });

  it('keeps a small board in plain bucket order (red, orange, green)', () => {
    const board = [green(300, 1), orange(200, 90), red(100, 0.5)];
    expect(sortedBothWays(board)).toEqual([100, 200, 300]);
  });

  it('does not mutate its input', () => {
    const board = [green(300, 1), orange(200, 90), red(100, 0.5)];
    const before = ids(board);
    orderChores(board, TODAY, 'UTC');
    expect(ids(board)).toEqual(before);
  });

  it('places each chore in the bucket that matches its computeBar colour', () => {
    const expected: Record<number, ChoreStatus> = {};
    const board = [...mildReds(100, 3), ...oranges(200, 3), ...greens(300, 3)];
    for (const c of board) expected[c.id] = c.id < 200 ? 'red' : c.id < 300 ? 'orange' : 'green';

    for (const chore of orderChores(board, TODAY, 'UTC')) {
      const daysSince = daysSinceInZone(TODAY, chore.dateLastCompleted, 'UTC');
      expect(computeBar(daysSince, chore.frequency).barColor).toBe(STATUS_BAR_COLOR[expected[chore.id]]);
    }
  });

  it('ranks a 10-day-overdue 2-minute chore above a green 60-minute chore', () => {
    const overdue = makeChore({ id: 1, frequency: 5, duration: 2, dateLastCompleted: daysAgo(15) });
    const fresh = makeChore({ id: 2, frequency: 30, duration: 60, dateLastCompleted: daysAgo(1) });
    expect(sortedBothWays([fresh, overdue])).toEqual([1, 2]);
  });

  it('ranks reds by overdue ratio, then by duration', () => {
    const worst = makeChore({ id: 1, frequency: 10, duration: 1, dateLastCompleted: daysAgo(30) }); // 2.0
    const tieLong = makeChore({ id: 2, frequency: 2, duration: 30, dateLastCompleted: daysAgo(3) }); // 0.5
    const tieShort = makeChore({ id: 3, frequency: 10, duration: 5, dateLastCompleted: daysAgo(15) }); // 0.5
    expect(sortedBothWays([tieShort, worst, tieLong])).toEqual([1, 2, 3]);
  });

  it('ranks oranges by remaining ratio ascending (closest to due first)', () => {
    expect(sortedBothWays(oranges(200, 4))).toEqual([200, 201, 202, 203]);
  });

  it('ranks greens most recently completed first', () => {
    expect(sortedBothWays(greens(300, 4))).toEqual([300, 301, 302, 303]);
  });

  it('fills the fold 4 red / 2 orange / 2 green, then the rest in bucket order', () => {
    const board = [...mildReds(100, 6), ...oranges(200, 4), ...greens(300, 4)];
    expect(sortedBothWays(board)).toEqual([
      ...range(100, 4),
      200,
      201,
      300,
      301,
      104,
      105,
      202,
      203,
      302,
      303,
    ]);
  });

  it('donates unused red slots to orange', () => {
    const board = [...mildReds(100, 2), ...oranges(200, 6), ...greens(300, 2)];
    // Fold: 2 red + 4 orange (2 own + 2 donated) + 2 green.
    expect(sortedBothWays(board)).toEqual([100, 101, ...range(200, 4), 300, 301, 204, 205]);
  });

  it('donates unused orange slots to red', () => {
    const board = [...mildReds(100, 6), ...oranges(200, 1), ...greens(300, 2)];
    // Fold: 5 red (4 own + 1 donated) + 1 orange + 2 green.
    expect(sortedBothWays(board)).toEqual([...range(100, 5), 200, 300, 301, 105]);
  });

  it('escalates the whole fold to red when pressure is 4', () => {
    const board = [...highReds(100, 4), ...mildReds(104, 4), ...oranges(200, 2), ...greens(300, 2)];
    expect(sortedBothWays(board)).toEqual([...range(100, 8), 200, 201, 300, 301]);
  });

  it('drains orange first when pressure is 2', () => {
    const board = [...highReds(100, 2), ...mildReds(102, 4), ...oranges(200, 4), ...greens(300, 4)];
    // Fold: 6 red + 0 orange + 2 green.
    expect(sortedBothWays(board)).toEqual([...range(100, 6), 300, 301, ...range(200, 4), 302, 303]);
  });

  it('reduces green when pressure is 3', () => {
    const board = [...highReds(100, 3), ...mildReds(103, 4), ...oranges(200, 4), ...greens(300, 4)];
    // Fold: 7 red + 0 orange + 1 green.
    expect(sortedBothWays(board)).toEqual([...range(100, 7), 300, ...range(200, 4), 301, 302, 303]);
  });

  it('counts a red at weighted overdue exactly 1 toward pressure, but not 0.9', () => {
    const base = [...mildReds(101, 4), ...oranges(200, 4), ...greens(300, 4)];
    const atThreshold = [red(100, 1), ...base];
    const belowThreshold = [red(100, 0.9), ...base];
    // Pressure 1: fold 5 red / 1 orange / 2 green.
    expect(sorted(atThreshold)).toEqual([...range(100, 5), 200, 300, 301, 201, 202, 203, 302, 303]);
    // No pressure: fold 4 red / 2 orange / 2 green.
    expect(sorted(belowThreshold)).toEqual([...range(100, 4), 200, 201, 300, 301, 104, 202, 203, 302, 303]);
  });

  it('loses no chore when pressure exceeds the fold capacity', () => {
    for (const reds of [6, 12]) {
      const board = [...highReds(100, reds), ...oranges(200, 2), ...greens(300, 2)];
      const result = sortedBothWays(board);
      expect([...result].sort((a, b) => a - b)).toEqual(ids(board).sort((a, b) => a - b));
      expect(result.slice(0, Math.min(reds, SORT_FOLD))).toEqual(range(100, Math.min(reds, SORT_FOLD)));
    }
  });

  it('handles boards with a single bucket', () => {
    expect(sortedBothWays(mildReds(100, 9))).toEqual(range(100, 9));
    expect(sortedBothWays(oranges(200, 10))).toEqual(range(200, 10));
    expect(sortedBothWays(greens(300, 10))).toEqual(range(300, 10));
  });

  it('lets urgency flip the rank between two reds with the same lateness', () => {
    const low = red(1, 0.3, { urgency: 'low' });
    const high = red(2, 0.3, { urgency: 'high' });
    expect(sortedBothWays([low, high])).toEqual([2, 1]);
  });

  it('lets urgency flip whether a red counts toward pressure', () => {
    // Weighted overdue 0.7: high -> 1.05 (pressure), low -> 0.525 (none).
    const rest = [...mildReds(101, 5), ...oranges(200, 4), ...greens(300, 4)];
    expect(sorted([red(100, 0.7, { urgency: 'high' }), ...rest])).toEqual([
      ...range(100, 5),
      200,
      300,
      301,
      105,
      201,
      202,
      203,
      302,
      303,
    ]);
    expect(sorted([red(100, 0.7, { urgency: 'low' }), ...rest])).toEqual([
      ...range(100, 4),
      200,
      201,
      300,
      301,
      104,
      105,
      202,
      203,
      302,
      303,
    ]);
  });

  it('treats unset urgency as medium', () => {
    // Unset (0.4) sits between low (0.375) and high (0.45), as medium would.
    const low = red(1, 0.5, { urgency: 'low' });
    const unset = red(2, 0.4);
    const high = red(3, 0.3, { urgency: 'high' }); // freq 10, 13 days: 0.3 * 1.5 = 0.45
    expect(sortedBothWays([low, unset, high])).toEqual([3, 2, 1]);
    const medium = red(2, 0.4, { urgency: 'medium' });
    expect(sortedBothWays([low, medium, high])).toEqual([3, 2, 1]);
  });

  it('never lets urgency change a chore bucket', () => {
    const freshHigh = green(300, 1, { urgency: 'high' });
    const overdueLow = red(100, 0.1, { urgency: 'low' });
    expect(sortedBothWays([freshHigh, overdueLow])).toEqual([100, 300]);
  });

  it('keeps input order for ties in every bucket', () => {
    const tiedReds = [2, 1, 3].map((id) => red(id, 0.5));
    const tiedOranges = [5, 4, 6].map((id) => orange(id, 90));
    const tiedGreens = [8, 7, 9].map((id) => green(id, 5));
    expect(sorted(tiedReds)).toEqual([2, 1, 3]);
    expect(sorted([...tiedReds].reverse())).toEqual([3, 1, 2]);
    expect(sorted(tiedOranges)).toEqual([5, 4, 6]);
    expect(sorted([...tiedOranges].reverse())).toEqual([6, 4, 5]);
    expect(sorted(tiedGreens)).toEqual([8, 7, 9]);
    expect(sorted([...tiedGreens].reverse())).toEqual([9, 7, 8]);
  });

  it('sorts a frequency-0 chore into green without throwing or emitting NaN', () => {
    const zero = makeChore({ id: 400, frequency: 0, dateLastCompleted: daysAgo(100) });
    const board = [zero, green(300, 1), red(100, 0.5)];
    const result = orderChores(board, TODAY, 'UTC');
    expect(ids(result)).toEqual([100, 300, 400]);
    expect(result).toHaveLength(3);
  });

  it('keeps a small board with pressure in plain bucket order', () => {
    const board = [green(300, 1), orange(200, 90), red(100, 2)];
    expect(sortedBothWays(board)).toEqual([100, 200, 300]);
  });

  it('has base quotas that sum to the fold size', () => {
    expect(SORT_BASE_QUOTA.red + SORT_BASE_QUOTA.orange + SORT_BASE_QUOTA.green).toBe(SORT_FOLD);
  });

  it('decides the bucket from the household timezone argument, not the process timezone', () => {
    // Same two instants, 2.5 hours apart, straddling the UTC day boundary.
    const today = new Date('2026-01-02T02:00:00.000Z');
    const straddler = makeChore({
      id: 1,
      frequency: 1,
      dateLastCompleted: new Date('2026-01-01T23:30:00.000Z'),
    });
    // 8 days since in both zones (orange, remaining ratio 0.2).
    const steady = makeChore({
      id: 2,
      frequency: 10,
      dateLastCompleted: new Date('2025-12-25T02:00:00.000Z'),
    });

    expect(daysSinceInZone(today, straddler.dateLastCompleted, 'UTC')).toBe(1);
    expect(daysSinceInZone(today, straddler.dateLastCompleted, 'Pacific/Kiritimati')).toBe(0);
    expect(daysSinceInZone(today, steady.dateLastCompleted, 'UTC')).toBe(8);
    expect(daysSinceInZone(today, steady.dateLastCompleted, 'Pacific/Kiritimati')).toBe(8);

    // UTC: straddler is orange with ratio 0 (due now), ahead of steady (ratio 0.2).
    expect(ids(orderChores([steady, straddler], today, 'UTC'))).toEqual([1, 2]);
    // Kiritimati: straddler is green, so the orange steady chore comes first.
    expect(ids(orderChores([straddler, steady], today, 'Pacific/Kiritimati'))).toEqual([2, 1]);
  });
});
