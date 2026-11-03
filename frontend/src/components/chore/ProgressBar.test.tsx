import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ProgressBar from './ProgressBar';

afterEach(cleanup);

describe('ProgressBar', () => {
  it('renders the fill translucent with the passed colour and width', () => {
    render(<ProgressBar width={42} color="bg-yellow-500" />);
    const bar = screen.getByTestId('progress-bar');
    expect(bar).toHaveClass('opacity-50');
    expect(bar).toHaveClass('bg-yellow-500');
    expect(Array.from(bar.classList).some((c) => /^bg-opacity-/.test(c))).toBe(false);
    expect(bar.style.width).toBe('42%');
  });
});
