import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import ScrollToTopButton from './ScrollToTopButton';

function getButton() {
  return screen.getByLabelText('Scroll to top');
}

function expectNotInteractive(button: HTMLElement) {
  expect(button).toHaveAttribute('aria-hidden', 'true');
  expect(button).toHaveAttribute('inert');
  expect(button).toHaveClass('pointer-events-none');
  expect(button).toHaveAttribute('tabindex', '-1');
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('ScrollToTopButton', () => {
  it('is hidden and non-interactive when not visible', () => {
    render(<ScrollToTopButton visible={false} onActivate={vi.fn()} />);
    const button = getButton();
    expectNotInteractive(button);
    expect(button).toHaveClass('opacity-0', 'invisible');
  });

  it('fades in at once but stays non-interactive until 500ms', () => {
    const onActivate = vi.fn();
    render(<ScrollToTopButton visible onActivate={onActivate} />);
    const button = getButton();
    expect(button).toHaveClass('opacity-100', 'visible');
    expectNotInteractive(button);
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expectNotInteractive(button);
    fireEvent.click(button);
    expect(onActivate).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(button).not.toHaveAttribute('aria-hidden');
    expect(button).not.toHaveAttribute('inert');
    expect(button).toHaveClass('pointer-events-auto');
    fireEvent.click(button);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('becomes non-interactive immediately when visible flips to false', () => {
    const { rerender } = render(<ScrollToTopButton visible onActivate={vi.fn()} />);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(getButton()).not.toHaveAttribute('inert');
    rerender(<ScrollToTopButton visible={false} onActivate={vi.fn()} />);
    expectNotInteractive(getButton());
    expect(getButton()).toHaveClass('opacity-0', 'invisible');
  });

  it('is interactive at once under reduced motion', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' })),
    );
    render(<ScrollToTopButton visible onActivate={vi.fn()} />);
    expect(getButton()).not.toHaveAttribute('inert');
    expect(getButton()).toHaveClass('pointer-events-auto');
  });

  it('clears the pending timer when visible flips true->false->true', () => {
    const { rerender } = render(<ScrollToTopButton visible onActivate={vi.fn()} />);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    rerender(<ScrollToTopButton visible={false} onActivate={vi.fn()} />);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender(<ScrollToTopButton visible onActivate={vi.fn()} />);
    // 400ms since the first true, but only 0ms since the second: must not be interactive.
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expectNotInteractive(getButton());
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(getButton()).not.toHaveAttribute('inert');
  });

  it('stays non-interactive under reduced motion when not visible', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' })),
    );
    render(<ScrollToTopButton visible={false} onActivate={vi.fn()} />);
    expectNotInteractive(getButton());
  });

  it('has the expected static attributes', () => {
    render(<ScrollToTopButton visible onActivate={vi.fn()} />);
    const button = getButton();
    expect(button).toHaveAttribute('title', 'Scroll to top');
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass('right-4', 'z-30');
  });

  it('renders without matchMedia defined', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(() => render(<ScrollToTopButton visible onActivate={vi.fn()} />)).not.toThrow();
  });

  it('calls onRelinquishFocus when the focused button becomes non-interactive', () => {
    const onRelinquishFocus = vi.fn();
    const { rerender } = render(
      <ScrollToTopButton visible onActivate={vi.fn()} onRelinquishFocus={onRelinquishFocus} />,
    );
    act(() => {
      vi.advanceTimersByTime(500);
    });
    act(() => getButton().focus());
    expect(getButton()).toHaveFocus();
    rerender(
      <ScrollToTopButton visible={false} onActivate={vi.fn()} onRelinquishFocus={onRelinquishFocus} />,
    );
    expect(onRelinquishFocus).toHaveBeenCalledTimes(1);
  });

  it('does not call onRelinquishFocus when the button is not focused', () => {
    const onRelinquishFocus = vi.fn();
    const { rerender } = render(
      <ScrollToTopButton visible onActivate={vi.fn()} onRelinquishFocus={onRelinquishFocus} />,
    );
    act(() => {
      vi.advanceTimersByTime(500);
    });
    rerender(
      <ScrollToTopButton visible={false} onActivate={vi.fn()} onRelinquishFocus={onRelinquishFocus} />,
    );
    expect(onRelinquishFocus).not.toHaveBeenCalled();
  });
});
