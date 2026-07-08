import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScreenBlankOverlay from '../../components/common/ScreenBlankOverlay';

describe('ScreenBlankOverlay', () => {
    it('renders a full-viewport element with the expected testid, role, and aria-label', () => {
        render(<ScreenBlankOverlay onWake={vi.fn()} />);

        const overlay = screen.getByTestId('screen-blank-overlay');
        expect(overlay).toBeInTheDocument();
        expect(overlay).toHaveAttribute('role', 'button');
        expect(overlay).toHaveAttribute('aria-label');
    });

    it('calls onWake exactly once when clicked', async () => {
        const user = userEvent.setup();
        const onWake = vi.fn();
        render(<ScreenBlankOverlay onWake={onWake} />);

        await user.click(screen.getByTestId('screen-blank-overlay'));

        expect(onWake).toHaveBeenCalledOnce();
    });

    it('calls onWake exactly once when Enter is pressed while focused', () => {
        const onWake = vi.fn();
        render(<ScreenBlankOverlay onWake={onWake} />);

        fireEvent.keyDown(screen.getByTestId('screen-blank-overlay'), { key: 'Enter' });

        expect(onWake).toHaveBeenCalledOnce();
    });

    it('calls onWake exactly once when Space is pressed while focused', () => {
        const onWake = vi.fn();
        render(<ScreenBlankOverlay onWake={onWake} />);

        fireEvent.keyDown(screen.getByTestId('screen-blank-overlay'), { key: ' ' });

        expect(onWake).toHaveBeenCalledOnce();
    });

    it('does not call onWake when a non-activation key is pressed', () => {
        const onWake = vi.fn();
        render(<ScreenBlankOverlay onWake={onWake} />);

        fireEvent.keyDown(screen.getByTestId('screen-blank-overlay'), { key: 'a' });

        expect(onWake).not.toHaveBeenCalled();
    });
});
