import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChoreTimerBar from './ChoreTimerBar';
import type { Chore } from '@customTypes/SharedTypes';

const chore: Chore = {
  id: 1,
  name: 'Vacuum',
  details: null,
  roomId: 1,
  dateLastCompleted: new Date('2026-06-01T00:00:00.000Z'),
  duration: 20,
  frequency: 7,
};

function stubPointer(coarse: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === '(pointer: coarse)' ? coarse : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}

function dragBar(bar: HTMLElement, fromX: number, toX: number) {
  fireEvent.mouseDown(bar, { clientX: fromX, clientY: 0 });
  fireEvent.mouseMove(document, { clientX: fromX + (toX - fromX) * 0.2, clientY: 0 });
  fireEvent.mouseMove(document, { clientX: toX, clientY: 0 });
  fireEvent.mouseUp(document, { clientX: toX, clientY: 0 });
}

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe('ChoreTimerBar', () => {
  it('computes "days ago" using the household timezone\'s day boundary, not the runtime default', () => {
    // Completed 23:30 UTC on Jan 1; "day" is 02:00 UTC on Jan 2 — only 2.5
    // hours later, but straddling the UTC midnight boundary.
    const straddlingChore: Chore = {
      ...chore,
      dateLastCompleted: new Date('2026-01-01T23:30:00.000Z'),
    };

    const { rerender } = render(
      <ChoreTimerBar
        chore={straddlingChore}
        day={new Date('2026-01-02T02:00:00.000Z')}
        householdTimezone="UTC"
        isSimulating={false}
        swipeStyle="ios"
        onComplete={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByText('1 day ago')).toBeInTheDocument();

    // Pacific/Kiritimati (UTC+14): both instants land on the same local
    // calendar day, so it's still "today" — 0 days ago.
    rerender(
      <ChoreTimerBar
        chore={straddlingChore}
        day={new Date('2026-01-02T02:00:00.000Z')}
        householdTimezone="Pacific/Kiritimati"
        isSimulating={false}
        swipeStyle="ios"
        onComplete={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByText('0 days ago')).toBeInTheDocument();
  });

  it('still completes the chore on a tap of the bar itself', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(
      <ChoreTimerBar
        chore={chore}
        day={new Date('2026-07-01T00:00:00.000Z')}
        householdTimezone="UTC"
        isSimulating={false}
        swipeStyle="ios"
        onComplete={onComplete}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId('chore-bar'));

    expect(onComplete).toHaveBeenCalledWith(1, expect.any(Date));
  });

  describe('android swipe style', () => {
    it('renders the android delete/edit swipe zones on a touch pointer, not the iOS preview buttons', () => {
      stubPointer(true);
      render(
        <ChoreTimerBar
          chore={chore}
          day={new Date('2026-07-01T00:00:00.000Z')}
          householdTimezone="UTC"
          isSimulating={false}
          swipeStyle="android"
          onComplete={vi.fn()}
          onDelete={vi.fn()}
          onEdit={vi.fn()}
        />,
      );

      expect(screen.getByTestId('android-swipe-zones')).toBeInTheDocument();
      expect(screen.queryByTestId('edit-icon-preview')).not.toBeInTheDocument();
      expect(screen.queryByTestId('delete-icon-preview')).not.toBeInTheDocument();
    });

    it('swiping right past the threshold opens a delete confirmation instead of deleting immediately', async () => {
      stubPointer(true);
      const user = userEvent.setup();
      const onDelete = vi.fn();
      render(
        <ChoreTimerBar
          chore={chore}
          day={new Date('2026-07-01T00:00:00.000Z')}
          householdTimezone="UTC"
          isSimulating={false}
          swipeStyle="android"
          onComplete={vi.fn()}
          onDelete={onDelete}
          onEdit={vi.fn()}
        />,
      );

      dragBar(screen.getByTestId('chore-bar'), 0, 140);

      expect(onDelete).not.toHaveBeenCalled();
      expect(await screen.findByTestId('confirm-dialog-backdrop')).toBeInTheDocument();

      await user.click(screen.getByTestId('confirm-dialog-confirm'));
      expect(onDelete).toHaveBeenCalledWith(1);
    });

    it('canceling the delete confirmation leaves the chore intact', async () => {
      stubPointer(true);
      const user = userEvent.setup();
      const onDelete = vi.fn();
      render(
        <ChoreTimerBar
          chore={chore}
          day={new Date('2026-07-01T00:00:00.000Z')}
          householdTimezone="UTC"
          isSimulating={false}
          swipeStyle="android"
          onComplete={vi.fn()}
          onDelete={onDelete}
          onEdit={vi.fn()}
        />,
      );

      dragBar(screen.getByTestId('chore-bar'), 0, 140);
      await screen.findByTestId('confirm-dialog-backdrop');

      await user.click(screen.getByTestId('confirm-dialog-cancel'));

      expect(onDelete).not.toHaveBeenCalled();
      expect(screen.queryByTestId('confirm-dialog-backdrop')).not.toBeInTheDocument();
    });

    it('swiping left past the threshold calls onEdit directly, with no confirmation step', () => {
      stubPointer(true);
      const onEdit = vi.fn();
      render(
        <ChoreTimerBar
          chore={chore}
          day={new Date('2026-07-01T00:00:00.000Z')}
          householdTimezone="UTC"
          isSimulating={false}
          swipeStyle="android"
          onComplete={vi.fn()}
          onDelete={vi.fn()}
          onEdit={onEdit}
        />,
      );

      dragBar(screen.getByTestId('chore-bar'), 200, 60);

      expect(onEdit).toHaveBeenCalledWith(1);
      expect(screen.queryByTestId('confirm-dialog-backdrop')).not.toBeInTheDocument();
    });

    it('a short swipe that never crosses the threshold commits nothing', () => {
      stubPointer(true);
      const onDelete = vi.fn();
      const onEdit = vi.fn();
      render(
        <ChoreTimerBar
          chore={chore}
          day={new Date('2026-07-01T00:00:00.000Z')}
          householdTimezone="UTC"
          isSimulating={false}
          swipeStyle="android"
          onComplete={vi.fn()}
          onDelete={onDelete}
          onEdit={onEdit}
        />,
      );

      dragBar(screen.getByTestId('chore-bar'), 0, 40);

      expect(onDelete).not.toHaveBeenCalled();
      expect(onEdit).not.toHaveBeenCalled();
      expect(screen.queryByTestId('confirm-dialog-backdrop')).not.toBeInTheDocument();
    });
  });

  it('renders a translucent fill and a v4 fade on the frequency label', () => {
    render(
      <ChoreTimerBar
        chore={chore}
        day={new Date('2026-07-01T00:00:00.000Z')}
        householdTimezone="UTC"
        isSimulating={false}
        swipeStyle="ios"
        onComplete={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    const fill = screen.getByTestId('progress-bar');
    expect(fill).toHaveClass('opacity-50');
    expect(Array.from(fill.classList).some((c) => /^bg-opacity-/.test(c))).toBe(false);

    const label = screen.getByText('Every 7 days');
    expect(label).toHaveClass('text-white/80');
    expect(label).not.toHaveClass('text-opacity-80');
  });
});
