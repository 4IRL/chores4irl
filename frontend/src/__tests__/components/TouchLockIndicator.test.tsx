import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TouchLockIndicator from '../../components/common/TouchLockIndicator';

describe('TouchLockIndicator', () => {
    it('shows the closed-padlock icon when isLocked is true', () => {
        render(<TouchLockIndicator isLocked={true} />);

        const indicator = screen.getByTestId('touch-lock-indicator');
        expect(indicator).toBeInTheDocument();
        expect(screen.getByTestId('touch-lock-icon-closed')).toBeInTheDocument();
        expect(screen.queryByTestId('touch-lock-icon-open')).not.toBeInTheDocument();
    });

    it('shows the open-padlock icon when isLocked is false', () => {
        render(<TouchLockIndicator isLocked={false} />);

        expect(screen.getByTestId('touch-lock-icon-open')).toBeInTheDocument();
        expect(screen.queryByTestId('touch-lock-icon-closed')).not.toBeInTheDocument();
    });

    it('is decorative and non-interactive', () => {
        render(<TouchLockIndicator isLocked={true} />);

        const indicator = screen.getByTestId('touch-lock-indicator');
        expect(indicator).toHaveAttribute('aria-hidden', 'true');
        expect(indicator).toHaveClass('pointer-events-none');
    });
});
