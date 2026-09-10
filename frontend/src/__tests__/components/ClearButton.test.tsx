import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClearButton from '../../components/common/ClearButton';

describe('ClearButton', () => {
    it('renders a button with the given accessible name', () => {
        render(<ClearButton label="Clear Search" onClear={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Clear Search' })).toBeInTheDocument();
    });

    it('has type="button" so it never submits an enclosing form', () => {
        render(<ClearButton label="Clear Search" onClear={vi.fn()} />);
        const button = screen.getByRole('button', { name: 'Clear Search' }) as HTMLButtonElement;
        expect(button.type).toBe('button');
    });

    it('renders the lucide X icon, hidden from assistive tech', () => {
        const { container } = render(<ClearButton label="Clear Search" onClear={vi.fn()} />);
        const icon = container.querySelector('svg.lucide-x');
        expect(icon).not.toBeNull();
        expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('calls onClear exactly once with no arguments when clicked', async () => {
        const onClear = vi.fn();
        const user = userEvent.setup();
        render(<ClearButton label="Clear Search" onClear={onClear} />);

        await user.click(screen.getByRole('button', { name: 'Clear Search' }));

        expect(onClear).toHaveBeenCalledTimes(1);
        expect(onClear).toHaveBeenCalledWith();
    });

    it('has a 44x44px minimum touch target', () => {
        render(<ClearButton label="Clear Search" onClear={vi.fn()} />);
        const button = screen.getByRole('button', { name: 'Clear Search' });
        expect(button.className).toContain('min-w-[44px]');
        expect(button.className).toContain('min-h-[44px]');
    });

    it('defaults to vertically centered anchoring (no anchor prop)', () => {
        render(<ClearButton label="Clear Search" onClear={vi.fn()} />);
        const button = screen.getByRole('button', { name: 'Clear Search' });
        expect(button.className).toContain('top-1/2');
        expect(button.className).toContain('-translate-y-1/2');
    });

    it('anchors to the top edge when anchor="top"', () => {
        render(<ClearButton label="Clear Search" onClear={vi.fn()} anchor="top" />);
        const button = screen.getByRole('button', { name: 'Clear Search' });
        expect(button.className).toContain('top-0');
        expect(button.className).not.toContain('top-1/2');
        expect(button.className).not.toContain('-translate-y-1/2');
    });
});
