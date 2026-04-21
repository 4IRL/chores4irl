import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReturnToTodayButton from '../../components/nav/ReturnToTodayButton';

describe('ReturnToTodayButton', () => {
    it('is not rendered when dayOffset === 0', () => {
        render(<ReturnToTodayButton dayOffset={0} onReset={vi.fn()} />);
        expect(screen.queryByRole('button', { name: /return to today/i })).toBeNull();
    });

    it('is rendered when dayOffset > 0', () => {
        render(<ReturnToTodayButton dayOffset={1} onReset={vi.fn()} />);
        expect(screen.getByRole('button', { name: /return to today/i })).toBeInTheDocument();
    });

    it('clicking invokes onReset with no args', async () => {
        const onReset = vi.fn();
        const user = userEvent.setup();
        render(<ReturnToTodayButton dayOffset={3} onReset={onReset} />);
        await user.click(screen.getByRole('button', { name: /return to today/i }));
        expect(onReset).toHaveBeenCalledOnce();
        expect(onReset).toHaveBeenCalledWith();
    });
});
