import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Chore, Room } from '@customTypes/SharedTypes';
import { parseFormDate } from '@utils/formDate';
import ChoreForm from './ChoreForm';

const rooms: Room[] = [{ id: 1, householdId: 1, name: 'Kitchen' }];
const LA = 'America/Los_Angeles';

function makeChore(dateLastCompleted: Date): Chore {
  return {
    id: 7,
    name: 'Mop Floors',
    details: null,
    roomId: 1,
    dateLastCompleted,
    duration: 20,
    frequency: 7,
  };
}

function setup(dateLastCompleted: Date, householdTimezone: string) {
  const onSubmit = vi.fn();
  render(
    <ChoreForm
      mode="edit"
      initialChore={makeChore(dateLastCompleted)}
      rooms={rooms}
      householdTimezone={householdTimezone}
      onSubmit={onSubmit}
      onCancel={vi.fn()}
    />,
  );
  return { onSubmit, user: userEvent.setup() };
}

function submittedDate(onSubmit: ReturnType<typeof vi.fn>): Date {
  return (onSubmit.mock.calls[0][0] as { dateLastCompleted: Date }).dateLastCompleted;
}

describe('ChoreForm household-timezone dates', () => {
  it('shows the previous day west of UTC', () => {
    setup(new Date('2026-10-01T00:00:00Z'), LA);
    expect(screen.getByLabelText('Last Completed')).toHaveValue('2026-09-30');
  });

  it('shows the same day in UTC', () => {
    setup(new Date('2026-10-01T00:00:00Z'), 'UTC');
    expect(screen.getByLabelText('Last Completed')).toHaveValue('2026-10-01');
  });

  it('round-trips a household-midnight instant unchanged', async () => {
    const midnight = parseFormDate('2026-10-01', LA);
    expect(midnight.toISOString()).toBe('2026-10-01T07:00:00.000Z');
    const { user, onSubmit } = setup(midnight, LA);
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(submittedDate(onSubmit).getTime()).toBe(midnight.getTime());
  });

  it('keeps an evening completion on the same household day', async () => {
    // 2026-10-01T20:30 in Los Angeles (PDT, UTC-7).
    const evening = new Date('2026-10-02T03:30:00Z');
    const { user, onSubmit } = setup(evening, LA);
    expect(screen.getByLabelText('Last Completed')).toHaveValue('2026-10-01');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(submittedDate(onSubmit).getTime()).toBe(parseFormDate('2026-10-01', LA).getTime());
  });

  it('submits a typed date as household-local midnight east of UTC', async () => {
    const tz = 'Australia/Brisbane';
    const { user, onSubmit } = setup(parseFormDate('2026-10-01', tz), tz);
    const input = screen.getByLabelText('Last Completed');
    await user.clear(input);
    await user.type(input, '2026-10-05');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(submittedDate(onSubmit).getTime()).toBe(parseFormDate('2026-10-05', tz).getTime());
  });
});
