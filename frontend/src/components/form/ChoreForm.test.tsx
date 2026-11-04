import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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

describe('ChoreForm add-mode default Last Completed', () => {
  const START = new Date('2026-01-02T03:00:00Z');
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  const announcement = 'Last completed date updated to 2026-01-02';

  afterEach(() => {
    vi.useRealTimers();
  });

  function setupAdd(tz: string, mode: 'add' | 'edit' = 'add') {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(START);
    const onSubmit = vi.fn();
    const props = {
      rooms,
      onSubmit,
      onCancel: vi.fn(),
      mode,
      ...(mode === 'edit' ? { initialChore: makeChore(parseFormDate('2025-12-20', tz)) } : {}),
    };
    const view = render(<ChoreForm {...props} householdTimezone={tz} />);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    return { ...view, props, onSubmit, user };
  }

  function advance(ms: number) {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  }

  async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('Name'), 'Dust');
    await user.selectOptions(screen.getByLabelText('Room'), '1');
    await user.type(screen.getByLabelText('Duration (minutes)'), '10');
    await user.type(screen.getByLabelText('Frequency (days)'), '3');
  }

  async function submit(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Save' }));
  }

  async function typeDate(user: ReturnType<typeof userEvent.setup>, value: string) {
    const input = screen.getByLabelText('Last Completed');
    await user.clear(input);
    await user.type(input, value);
  }

  it('opens with the household today', () => {
    setupAdd(LA);
    expect(screen.getByLabelText('Last Completed')).toHaveValue('2026-01-01');
  });

  it('opens with the UTC date for a UTC household', () => {
    setupAdd('UTC');
    expect(screen.getByLabelText('Last Completed')).toHaveValue('2026-01-02');
  });

  it('submits the derived household today and resets to it', async () => {
    const { user, onSubmit } = setupAdd(LA);
    await fillRequired(user);
    await submit(user);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(submittedDate(onSubmit).getTime()).toBe(parseFormDate('2026-01-01', LA).getTime());
    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Last Completed')).toHaveValue('2026-01-01');
  });

  it('returns to household today after submitting a touched date', async () => {
    const { user, onSubmit } = setupAdd(LA);
    await typeDate(user, '2025-12-25');
    await fillRequired(user);
    await submit(user);
    expect(submittedDate(onSubmit).getTime()).toBe(parseFormDate('2025-12-25', LA).getTime());
    expect(screen.getByLabelText('Last Completed')).toHaveValue('2026-01-01');
  });

  it('follows the new today across midnight after a touched submit', async () => {
    const { user } = setupAdd(LA);
    await typeDate(user, '2025-12-25');
    await fillRequired(user);
    await submit(user);
    advance(SIX_HOURS);
    expect(screen.getByLabelText('Last Completed')).toHaveValue('2026-01-02');
  });

  it('keeps the chore date in edit mode, including across midnight', () => {
    setupAdd(LA, 'edit');
    expect(screen.getByLabelText('Last Completed')).toHaveValue('2025-12-20');
    advance(SIX_HOURS);
    expect(screen.getByLabelText('Last Completed')).toHaveValue('2025-12-20');
    expect(screen.queryByText(announcement)).toBeNull();
  });

  it('follows household midnight while untouched and announces it', () => {
    setupAdd(LA);
    expect(screen.queryByText(announcement)).toBeNull();
    advance(SIX_HOURS);
    expect(screen.getByLabelText('Last Completed')).toHaveValue('2026-01-02');
    expect(screen.getByText(announcement)).toBeInTheDocument();
  });

  it('preserves a touched date across midnight without announcing', async () => {
    const { user } = setupAdd(LA);
    await typeDate(user, '2025-12-25');
    advance(SIX_HOURS);
    expect(screen.getByLabelText('Last Completed')).toHaveValue('2025-12-25');
    expect(screen.queryByText(announcement)).toBeNull();
  });

  it('does not refill a cleared date after midnight', async () => {
    const { user } = setupAdd(LA);
    await user.clear(screen.getByLabelText('Last Completed'));
    advance(SIX_HOURS);
    expect(screen.getByLabelText('Last Completed')).toHaveValue('');
  });

  it('follows a timezone prop change while untouched and announces it', () => {
    const { rerender, props } = setupAdd(LA);
    expect(screen.getByLabelText('Last Completed')).toHaveValue('2026-01-01');
    rerender(<ChoreForm {...props} householdTimezone="UTC" />);
    advance(0);
    expect(screen.getByLabelText('Last Completed')).toHaveValue('2026-01-02');
    expect(screen.getByText(announcement)).toBeInTheDocument();
  });

  it('keeps a touched date on timezone change without announcing', async () => {
    const { rerender, props, user } = setupAdd(LA);
    await typeDate(user, '2025-12-25');
    rerender(<ChoreForm {...props} householdTimezone="UTC" />);
    advance(0);
    expect(screen.getByLabelText('Last Completed')).toHaveValue('2025-12-25');
    expect(screen.queryByText(announcement)).toBeNull();
  });

  it('leaves no timer behind after unmount', () => {
    // No shouldAdvanceTime here: it installs its own interval, which would skew the count.
    vi.useFakeTimers();
    const before = vi.getTimerCount();
    const { unmount } = render(
      <ChoreForm rooms={rooms} householdTimezone={LA} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(vi.getTimerCount()).toBeGreaterThan(before);
    unmount();
    // Flush React's own scheduler task (queued by unmount); the 0 ms advance cannot fire
    // the multi-hour midnight timer, so a leaked one would still be counted.
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(vi.getTimerCount()).toBe(before);
  });
});
