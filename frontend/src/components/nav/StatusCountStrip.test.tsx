import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import StatusCountStrip from './StatusCountStrip';

afterEach(cleanup);

describe('StatusCountStrip', () => {
  it('labels the counts in one sentence', () => {
    render(<StatusCountStrip counts={{ done: 3, dueSoon: 1, overdue: 2 }} />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', '3 done today · 1 due soon · 2 overdue');
  });

  it('hides every segment from assistive tech and adds no live region', () => {
    const { container } = render(<StatusCountStrip counts={{ done: 3, dueSoon: 1, overdue: 2 }} />);
    const segments = screen.getByRole('img').children;
    expect(segments).toHaveLength(3);
    for (const segment of Array.from(segments)) expect(segment).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('[aria-live], [role="status"], [role="alert"]')).toBeNull();
  });

  it('sizes segments by count with a min-width on non-zero ones', () => {
    render(<StatusCountStrip counts={{ done: 3, dueSoon: 0, overdue: 2 }} />);
    expect(screen.getByTestId('status-count-segment-done').style.flex).toBe('3 1 0%');
    expect(screen.getByTestId('status-count-segment-done')).toHaveClass('min-w-6', 'bg-green-500/50');
    expect(screen.getByTestId('status-count-segment-overdue').style.flex).toBe('2 1 0%');
    const zero = screen.getByTestId('status-count-segment-due-soon');
    expect(zero.style.flex).toBe('0 1 0%');
    expect(zero).not.toHaveClass('min-w-6');
    expect(zero).toBeEmptyDOMElement();
  });

  it('renders one full green 0 segment when every count is zero', () => {
    render(<StatusCountStrip counts={{ done: 0, dueSoon: 0, overdue: 0 }} />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', '0 done today · 0 due soon · 0 overdue');
    expect(screen.getByRole('img').children).toHaveLength(1);
    const only = screen.getByTestId('status-count-segment-empty');
    expect(only).toHaveTextContent('0');
    expect(only).toHaveClass('bg-green-500/50');
  });

  it('is sticky on phones and static from sm up', () => {
    render(<StatusCountStrip counts={{ done: 1, dueSoon: 0, overdue: 0 }} />);
    expect(screen.getByTestId('status-count-strip')).toHaveClass('sticky', 'top-0', 'z-[15]', 'sm:static');
  });
});
