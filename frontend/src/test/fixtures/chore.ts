import type { Chore } from '@customTypes/SharedTypes';

export const MS_PER_DAY = 86_400_000;

// Noon UTC: far from any day boundary, so subtracting whole days in UTC (which
// has no DST) gives an exact `daysSince` in any process timezone.
export const TODAY = new Date('2026-07-01T12:00:00.000Z');

export function daysAgo(n: number): Date {
  return new Date(TODAY.getTime() - n * MS_PER_DAY);
}

export function makeChore(overrides: Partial<Chore> = {}): Chore {
  return {
    id: 1,
    name: 'Test',
    roomId: 1,
    dateLastCompleted: new Date('2026-01-01T23:30:00.000Z'),
    duration: 10,
    frequency: 2,
    ...overrides,
  };
}
