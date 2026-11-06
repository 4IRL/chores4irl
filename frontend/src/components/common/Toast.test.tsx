import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Toast, { type ToastState } from './Toast';

const success: ToastState = { id: 1, tone: 'success', message: 'Saved' };
const error: ToastState = { id: 2, tone: 'error', message: 'Failed' };
const neutral: ToastState = { id: 3, tone: 'neutral', message: 'Offline' };

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders success in the polite region without its own role and dismisses at 4000 ms', () => {
    const onDismiss = vi.fn();
    render(<Toast toast={success} onDismiss={onDismiss} />);
    const card = screen.getByTestId('feedback-toast');
    expect(card.parentElement).toHaveAttribute('aria-live', 'polite');
    expect(card).not.toHaveAttribute('role');
    advance(3900);
    expect(onDismiss).not.toHaveBeenCalled();
    advance(200);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders error in the alert region, never auto-dismisses, and the button dismisses once', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onDismiss = vi.fn();
    render(<Toast toast={error} onDismiss={onDismiss} />);
    expect(screen.getByTestId('feedback-toast').parentElement).toHaveAttribute('role', 'alert');
    advance(60000);
    expect(onDismiss).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('feedback-toast-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('neutral dismisses at 6000 ms, not 4000 ms, with distinct classes', () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<Toast toast={success} onDismiss={onDismiss} />);
    const successClass = screen.getByTestId('feedback-toast').className;
    rerender(<Toast toast={error} onDismiss={onDismiss} />);
    const errorClass = screen.getByTestId('feedback-toast').className;
    rerender(<Toast toast={neutral} onDismiss={onDismiss} />);
    const neutralClass = screen.getByTestId('feedback-toast').className;
    expect(neutralClass).not.toBe(successClass);
    expect(neutralClass).not.toBe(errorClass);
    advance(4100);
    expect(onDismiss).not.toHaveBeenCalled();
    advance(2000);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('remounts the card and restarts the timer for a new id; unmount clears the timer', () => {
    const onDismiss = vi.fn();
    const { rerender, unmount } = render(<Toast toast={success} onDismiss={onDismiss} />);
    const first = screen.getByTestId('feedback-toast');
    advance(3000);
    rerender(<Toast toast={{ ...success, id: 10 }} onDismiss={onDismiss} />);
    expect(screen.getByTestId('feedback-toast')).not.toBe(first);
    advance(3000);
    expect(onDismiss).not.toHaveBeenCalled();
    advance(1100);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    rerender(<Toast toast={{ ...success, id: 11 }} onDismiss={onDismiss} />);
    unmount();
    advance(10000);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('keeps the live regions mounted when toast is null', () => {
    const { container } = render(<Toast toast={null} onDismiss={vi.fn()} />);
    expect(screen.queryByTestId('feedback-toast')).not.toBeInTheDocument();
    expect(container.ownerDocument.body.querySelector('[aria-live="polite"]')).toBeInTheDocument();
    expect(container.ownerDocument.body.querySelector('[role="alert"]')).toBeInTheDocument();
  });

  it('wrapper is z-40 and offsets by the safe-area inset', () => {
    render(<Toast toast={success} onDismiss={vi.fn()} />);
    const wrapper = screen.getByTestId('feedback-toast').parentElement!.parentElement!;
    expect(wrapper.className).toContain('z-40');
    expect(wrapper.className).toContain('env(safe-area-inset-bottom)');
    expect(wrapper.className).toContain('5.5rem');
  });

  it('keeps a sticky error toast mounted while time passes (e.g. under a modal)', () => {
    render(<Toast toast={error} onDismiss={vi.fn()} />);
    advance(30000);
    expect(screen.getByTestId('feedback-toast')).toBeInTheDocument();
  });
});
