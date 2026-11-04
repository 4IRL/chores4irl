import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ChoreTimerBar from '../components/chore/ChoreTimerBar';
import type { Chore } from '@customTypes/SharedTypes';
import { formatFormDate, parseFormDate } from './formDate';

const baseChore: Chore = {
  id: 1,
  name: 'Vacuum',
  details: null,
  roomId: 1,
  dateLastCompleted: new Date('2026-06-01T00:00:00.000Z'),
  duration: 20,
  frequency: 7,
};

// Each `now` has a UTC date that differs from the zone's local date (except UTC).
const cases: { tz: string; now: Date; expected: string }[] = [
  { tz: 'America/Los_Angeles', now: new Date('2026-01-02T03:00:00Z'), expected: '2026-01-01' },
  { tz: 'UTC', now: new Date('2026-01-02T03:00:00Z'), expected: '2026-01-02' },
  { tz: 'Australia/Brisbane', now: new Date('2026-01-01T20:00:00Z'), expected: '2026-01-02' },
];

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe.each([
  { label: 'spring-forward', value: '2026-03-08' },
  { label: 'fall-back', value: '2026-11-01' },
  { label: 'day after spring-forward', value: '2026-03-09' },
  { label: 'day after fall-back', value: '2026-11-02' },
])('formDate round-trip on a DST $label day ($value)', ({ value }) => {
  it('round-trips format(parse(v)) === v in America/Los_Angeles', () => {
    expect(formatFormDate(parseFormDate(value, 'America/Los_Angeles'), 'America/Los_Angeles')).toBe(value);
  });
});

describe.each(cases)('formDate in $tz', ({ tz, now, expected }) => {
  it('formats the household-local date', () => {
    expect(formatFormDate(now, tz)).toBe(expected);
  });

  it('parses a form value the timer bar renders as 0 days ago', () => {
    render(
      <ChoreTimerBar
        chore={{ ...baseChore, dateLastCompleted: parseFormDate(formatFormDate(now, tz), tz) }}
        day={now}
        householdTimezone={tz}
        isSimulating={false}
        swipeStyle="ios"
        onComplete={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByText('0 days ago')).toBeInTheDocument();
  });

  it('round-trips format(parse(v)) === v', () => {
    expect(formatFormDate(parseFormDate(expected, tz), tz)).toBe(expected);
  });
});
