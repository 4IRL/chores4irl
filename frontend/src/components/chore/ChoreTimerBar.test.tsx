import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChoreTimerBar, { androidSwipeThreshold } from './ChoreTimerBar';
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

  describe('swipe threshold as a fraction of bar width', () => {
    function stubBarWidth(width: number) {
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: HTMLElement,
      ) {
        return { width: this.dataset.testid === 'chore-bar' ? width : 0 } as DOMRect;
      });
    }

    function renderBar(swipeStyle: 'android' | 'ios', onEdit = vi.fn()) {
      stubPointer(true);
      render(
        <ChoreTimerBar
          chore={chore}
          day={new Date('2026-07-01T00:00:00.000Z')}
          householdTimezone="UTC"
          isSimulating={false}
          swipeStyle={swipeStyle}
          onComplete={vi.fn()}
          onDelete={vi.fn()}
          onEdit={onEdit}
        />,
      );
      return screen.getByTestId('chore-bar');
    }

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('width 320: a 90px right swipe opens the confirm dialog', async () => {
      stubBarWidth(320);
      dragBar(renderBar('android'), 0, 90);
      expect(await screen.findByTestId('confirm-dialog-backdrop')).toBeInTheDocument();
    });

    it('width 320: a 70px right swipe does not', () => {
      stubBarWidth(320);
      dragBar(renderBar('android'), 0, 70);
      expect(screen.queryByTestId('confirm-dialog-backdrop')).not.toBeInTheDocument();
    });

    it('width 1024: a 100px right swipe commits nothing, a 130px one commits', async () => {
      stubBarWidth(1024);
      dragBar(renderBar('android'), 0, 100);
      expect(screen.queryByTestId('confirm-dialog-backdrop')).not.toBeInTheDocument();
      dragBar(screen.getByTestId('chore-bar'), 0, 130);
      expect(await screen.findByTestId('confirm-dialog-backdrop')).toBeInTheDocument();
    });

    it('width 320: a 90px left swipe calls onEdit, a 70px one does not', () => {
      stubBarWidth(320);
      const onEdit = vi.fn();
      const bar = renderBar('android', onEdit);
      dragBar(bar, 200, 130);
      expect(onEdit).not.toHaveBeenCalled();
      dragBar(bar, 200, 110);
      expect(onEdit).toHaveBeenCalledWith(1);
    });

    it('width 320: zone opacity progress uses the measured threshold (40 / 80)', () => {
      stubBarWidth(320);
      const bar = renderBar('android');
      const zones = screen.getByTestId('android-swipe-zones');
      const deleteZone = zones.children[0] as HTMLElement;
      const editZone = zones.children[1] as HTMLElement;

      fireEvent.mouseDown(bar, { clientX: 0, clientY: 0 });
      fireEvent.mouseMove(document, { clientX: 8, clientY: 0 });
      fireEvent.mouseMove(document, { clientX: 40, clientY: 0 });
      expect(deleteZone.style.opacity).toBe('0.5');
      fireEvent.mouseUp(document, { clientX: 40, clientY: 0 });

      fireEvent.mouseDown(bar, { clientX: 200, clientY: 0 });
      fireEvent.mouseMove(document, { clientX: 192, clientY: 0 });
      fireEvent.mouseMove(document, { clientX: 160, clientY: 0 });
      expect(editZone.style.opacity).toBe('0.5');
      fireEvent.mouseUp(document, { clientX: 160, clientY: 0 });
    });

    it('iOS at width 320: a 90px left swipe does not reveal the buttons', () => {
      stubBarWidth(320);
      const bar = renderBar('ios');
      dragBar(bar, 200, 110);
      expect(screen.getByTestId('delete-icon-preview')).toBeDisabled();
    });
  });

  describe('androidSwipeThreshold', () => {
    it.each([0, -5, NaN, Infinity])('falls back to 120 for %s', (w) => {
      expect(androidSwipeThreshold(w)).toBe(120);
    });

    it.each([
      [200, 50],
      [480, 120],
      [1024, 120],
    ])('width %i gives %i', (w, expected) => {
      expect(androidSwipeThreshold(w)).toBe(expected);
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
