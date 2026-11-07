import { describe, it, expect } from 'vitest';
import { choreStatusCounts } from './choreStatusCounts';

const TZ = 'America/Los_Angeles';
// 2026-11-07 12:00 in Los Angeles (UTC-8 after DST ends)
const TODAY = new Date('2026-11-07T20:00:00Z');

function daysAgo(n: number): Date {
  return new Date(TODAY.getTime() - n * 24 * 60 * 60 * 1000);
}

describe('choreStatusCounts', () => {
  it('returns all zeros for an empty list', () => {
    expect(choreStatusCounts([], TODAY, TZ)).toEqual({ done: 0, dueSoon: 0, overdue: 0 });
  });

  it('counts a chore completed today only as done', () => {
    const counts = choreStatusCounts([{ dateLastCompleted: daysAgo(0), frequency: 10 }], TODAY, TZ);
    expect(counts).toEqual({ done: 1, dueSoon: 0, overdue: 0 });
  });

  it('does not count a green chore completed earlier', () => {
    const counts = choreStatusCounts([{ dateLastCompleted: daysAgo(1), frequency: 10 }], TODAY, TZ);
    expect(counts).toEqual({ done: 0, dueSoon: 0, overdue: 0 });
  });

  it('counts orange as due soon, including the due day itself', () => {
    const counts = choreStatusCounts(
      [
        { dateLastCompleted: daysAgo(5), frequency: 8 },
        { dateLastCompleted: daysAgo(10), frequency: 10 },
      ],
      TODAY,
      TZ,
    );
    expect(counts).toEqual({ done: 0, dueSoon: 2, overdue: 0 });
  });

  it('counts red as overdue one day past due', () => {
    const counts = choreStatusCounts([{ dateLastCompleted: daysAgo(11), frequency: 10 }], TODAY, TZ);
    expect(counts).toEqual({ done: 0, dueSoon: 0, overdue: 1 });
  });

  it('uses the household timezone for the day boundary', () => {
    // 2026-11-07T07:30Z is 2026-11-06 23:30 in Los Angeles: yesterday there, same UTC day as now.
    const utcSameDay = new Date('2026-11-07T07:30:00Z');
    const counts = choreStatusCounts([{ dateLastCompleted: utcSameDay, frequency: 10 }], TODAY, TZ);
    expect(counts.done).toBe(0);
  });

  it('counts as done when the UTC dates differ but the household day is the same', () => {
    // now = 2026-11-07 19:00 PST (Nov 8 UTC); completed 2026-11-07 01:00 PST (Nov 7 UTC): same LA day.
    const now = new Date('2026-11-08T03:00:00Z');
    const completed = new Date('2026-11-07T09:00:00Z');
    expect(choreStatusCounts([{ dateLastCompleted: completed, frequency: 10 }], now, TZ).done).toBe(1);
  });

  it('counts calendar days across the fall-back DST change, not 24h blocks', () => {
    // now = 2026-11-02 00:30 PST; completed 2026-11-01 01:30 PDT -> one calendar day ago, frequency 1 (orange).
    const now = new Date('2026-11-02T08:30:00Z');
    const completed = new Date('2026-11-01T08:30:00Z');
    const counts = choreStatusCounts([{ dateLastCompleted: completed, frequency: 1 }], now, TZ);
    expect(counts).toEqual({ done: 0, dueSoon: 1, overdue: 0 });
  });

  it('does not count a frequency 0 chore completed earlier', () => {
    const counts = choreStatusCounts([{ dateLastCompleted: daysAgo(30), frequency: 0 }], TODAY, TZ);
    expect(counts).toEqual({ done: 0, dueSoon: 0, overdue: 0 });
  });

  it('counts across a mixed list', () => {
    const counts = choreStatusCounts(
      [
        { dateLastCompleted: daysAgo(0), frequency: 3 },
        { dateLastCompleted: daysAgo(3), frequency: 3 },
        { dateLastCompleted: daysAgo(9), frequency: 3 },
        { dateLastCompleted: daysAgo(1), frequency: 30 },
      ],
      TODAY,
      TZ,
    );
    expect(counts).toEqual({ done: 1, dueSoon: 1, overdue: 1 });
  });
});
