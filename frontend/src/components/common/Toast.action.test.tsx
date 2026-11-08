import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import Toast, { type ToastState } from './Toast';

function actionToast(overrides: Partial<ToastState> = {}, onClick = vi.fn()): ToastState {
  return {
    id: 1,
    tone: 'success',
    message: 'Completed',
    action: { label: 'Undo', testId: 'feedback-toast-undo', onClick },
    ...overrides,
  };
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function setHidden(value: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

describe('Toast with an action', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    setHidden(false);
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders the exact-name action, calls onClick, and shows Dismiss', () => {
    const onClick = vi.fn();
    const onDismiss = vi.fn();
    render(<Toast toast={actionToast({}, onClick)} onDismiss={onDismiss} />);
    const button = screen.getByRole('button', { name: 'Undo' });
    expect(button).toHaveTextContent(/^Undo$/);
    expect(button).not.toHaveAttribute('aria-label');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('feedback-toast-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses at 8000 ms for success and neutral, not before', () => {
    for (const tone of ['success', 'neutral'] as const) {
      const onDismiss = vi.fn();
      const { unmount } = render(<Toast toast={actionToast({ tone })} onDismiss={onDismiss} />);
      advance(7900);
      expect(onDismiss).not.toHaveBeenCalled();
      advance(200);
      expect(onDismiss).toHaveBeenCalledTimes(1);
      unmount();
    }
  });

  it('error tone never auto-dismisses and still renders Dismiss', () => {
    const onDismiss = vi.fn();
    render(<Toast toast={{ id: 2, tone: 'error', message: 'Failed' }} onDismiss={onDismiss} />);
    advance(60000);
    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByTestId('feedback-toast-dismiss')).toBeInTheDocument();
  });

  it('a no-action success or neutral toast renders no Dismiss and no hint', () => {
    render(<Toast toast={{ id: 3, tone: 'success', message: 'Saved' }} onDismiss={vi.fn()} />);
    expect(screen.queryByTestId('feedback-toast-dismiss')).not.toBeInTheDocument();
    expect(screen.queryByText(/Press Ctrl/)).not.toBeInTheDocument();
  });

  it('pauses on hover, restarts a full interval on leave', () => {
    const onDismiss = vi.fn();
    render(<Toast toast={actionToast()} onDismiss={onDismiss} />);
    const card = screen.getByTestId('feedback-toast');
    advance(1000);
    fireEvent.pointerEnter(card);
    advance(20000);
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.pointerLeave(card);
    advance(7900);
    expect(onDismiss).not.toHaveBeenCalled();
    advance(200);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('pauses on focus, restarts on blur, and moving focus within the card does not restart', () => {
    const onDismiss = vi.fn();
    render(<Toast toast={actionToast()} onDismiss={onDismiss} />);
    const action = screen.getByTestId('feedback-toast-undo');
    const dismiss = screen.getByTestId('feedback-toast-dismiss');
    act(() => action.focus());
    advance(10000);
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => dismiss.focus());
    advance(10000);
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => dismiss.blur());
    advance(7900);
    expect(onDismiss).not.toHaveBeenCalled();
    advance(200);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('the 30000 ms cap dismisses a hovered toast', () => {
    const onDismiss = vi.fn();
    render(<Toast toast={actionToast()} onDismiss={onDismiss} />);
    fireEvent.pointerEnter(screen.getByTestId('feedback-toast'));
    advance(29900);
    expect(onDismiss).not.toHaveBeenCalled();
    advance(200);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('the 30000 ms cap dismisses a focused toast', () => {
    const onDismiss = vi.fn();
    render(<Toast toast={actionToast()} onDismiss={onDismiss} />);
    act(() => screen.getByTestId('feedback-toast-undo').focus());
    advance(29900);
    expect(onDismiss).not.toHaveBeenCalled();
    advance(200);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('holding freezes the interval but the cap still dismisses; releasing restarts a full interval', () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<Toast toast={actionToast()} onDismiss={onDismiss} holding />);
    advance(20000);
    expect(onDismiss).not.toHaveBeenCalled();
    advance(9900);
    expect(onDismiss).not.toHaveBeenCalled();
    advance(200);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    const second = vi.fn();
    rerender(<Toast toast={actionToast({ id: 9 })} onDismiss={second} holding />);
    advance(8100);
    expect(second).not.toHaveBeenCalled();
    rerender(<Toast toast={actionToast({ id: 9 })} onDismiss={second} holding={false} />);
    advance(7900);
    expect(second).not.toHaveBeenCalled();
    advance(200);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('paused freezes both timers and resumes with a full interval; buttons are disabled meanwhile', () => {
    const onDismiss = vi.fn();
    const onClick = vi.fn();
    const toast = actionToast({}, onClick);
    const { rerender } = render(<Toast toast={toast} onDismiss={onDismiss} paused />);
    advance(40000);
    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByTestId('feedback-toast-undo')).toBeDisabled();
    expect(screen.getByTestId('feedback-toast-dismiss')).toBeDisabled();
    fireEvent.click(screen.getByTestId('feedback-toast-undo'));
    fireEvent.click(screen.getByTestId('feedback-toast-dismiss'));
    expect(onClick).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();

    rerender(<Toast toast={toast} onDismiss={onDismiss} paused={false} />);
    expect(screen.getByTestId('feedback-toast-undo')).toBeEnabled();
    expect(screen.getByTestId('feedback-toast-dismiss')).toBeEnabled();
    advance(7900);
    expect(onDismiss).not.toHaveBeenCalled();
    advance(200);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('a focused button disabled by a modal does not keep the toast held after the modal closes', () => {
    const onDismiss = vi.fn();
    const toast = actionToast();
    const { rerender } = render(<Toast toast={toast} onDismiss={onDismiss} />);
    act(() => screen.getByTestId('feedback-toast-undo').focus());
    rerender(<Toast toast={toast} onDismiss={onDismiss} paused />);
    rerender(<Toast toast={toast} onDismiss={onDismiss} paused={false} />);
    advance(7900);
    expect(onDismiss).not.toHaveBeenCalled();
    advance(200);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('a hidden tab freezes both timers and resumes with a full interval', () => {
    const onDismiss = vi.fn();
    render(<Toast toast={actionToast()} onDismiss={onDismiss} />);
    advance(2000);
    setHidden(true);
    advance(40000);
    expect(onDismiss).not.toHaveBeenCalled();
    setHidden(false);
    advance(7900);
    expect(onDismiss).not.toHaveBeenCalled();
    advance(200);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('a new toast id while hovered resets pause state and leaks no timer', () => {
    const onDismiss = vi.fn();
    const { rerender, unmount } = render(<Toast toast={actionToast()} onDismiss={onDismiss} />);
    fireEvent.pointerEnter(screen.getByTestId('feedback-toast'));
    advance(10000);
    rerender(<Toast toast={actionToast({ id: 5 })} onDismiss={onDismiss} />);
    advance(7900);
    expect(onDismiss).not.toHaveBeenCalled();
    advance(200);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    rerender(<Toast toast={actionToast({ id: 6 })} onDismiss={onDismiss} />);
    unmount();
    advance(60000);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['success', 4000],
    ['neutral', 6000],
  ] as const)(
    'stripping the action at 3000 ms restarts the plain %s interval and ignores a hover',
    (tone, plain) => {
      const onDismiss = vi.fn();
      const { rerender } = render(<Toast toast={actionToast({ tone })} onDismiss={onDismiss} />);
      fireEvent.pointerEnter(screen.getByTestId('feedback-toast'));
      advance(3000);
      rerender(<Toast toast={{ id: 1, tone, message: 'Completed' }} onDismiss={onDismiss} />);
      expect(screen.queryByTestId('feedback-toast-dismiss')).not.toBeInTheDocument();
      advance(plain - 100);
      expect(onDismiss).not.toHaveBeenCalled();
      advance(200);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    },
  );

  it('a card mounted under a resting pointer starts paused', () => {
    const matches = vi.spyOn(Element.prototype, 'matches').mockImplementation(function (
      this: Element,
      selector: string,
    ) {
      return selector === ':hover';
    });
    const onDismiss = vi.fn();
    render(<Toast toast={actionToast()} onDismiss={onDismiss} />);
    advance(8100);
    expect(onDismiss).not.toHaveBeenCalled();
    matches.mockRestore();
    fireEvent.pointerLeave(screen.getByTestId('feedback-toast'));
    advance(8100);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders one sr-only shortcut hint matching the action label', () => {
    const { rerender } = render(<Toast toast={actionToast()} onDismiss={vi.fn()} />);
    expect(screen.getAllByText('Press Ctrl+Z to undo')).toHaveLength(1);
    expect(screen.getByText('Press Ctrl+Z to undo')).toHaveClass('sr-only');
    rerender(
      <Toast
        toast={actionToast({
          action: { label: 'Redo', testId: 'feedback-toast-redo', onClick: vi.fn() },
        })}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getAllByText('Press Ctrl+Shift+Z to redo')).toHaveLength(1);
    expect(screen.queryByText('Press Ctrl+Z to undo')).not.toBeInTheDocument();
  });

  it('holding sets aria-disabled on the action and keeps focus; absent otherwise', () => {
    const { rerender } = render(<Toast toast={actionToast()} onDismiss={vi.fn()} />);
    const button = screen.getByTestId('feedback-toast-undo');
    expect(button).not.toHaveAttribute('aria-disabled');
    act(() => button.focus());
    rerender(<Toast toast={actionToast()} onDismiss={vi.fn()} holding />);
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    expect(document.activeElement).toBe(button);
  });
});
