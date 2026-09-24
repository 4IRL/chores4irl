import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TouchLockIndicator from '../../components/common/TouchLockIndicator';

describe('TouchLockIndicator', () => {
    it('shows the closed-padlock icon when isLocked is true', () => {
        render(<TouchLockIndicator isLocked={true} onLock={vi.fn()} onUnlock={vi.fn()} />);

        const indicator = screen.getByTestId('touch-lock-indicator');
        expect(indicator).toBeInTheDocument();
        expect(screen.getByTestId('touch-lock-icon-closed')).toBeInTheDocument();
        expect(screen.queryByTestId('touch-lock-icon-open')).not.toBeInTheDocument();
    });

    it('shows the open-padlock icon when isLocked is false', () => {
        render(<TouchLockIndicator isLocked={false} onLock={vi.fn()} onUnlock={vi.fn()} />);

        expect(screen.getByTestId('touch-lock-icon-open')).toBeInTheDocument();
        expect(screen.queryByTestId('touch-lock-icon-closed')).not.toBeInTheDocument();
    });

    it('renders a button labelled "Lock screen" when unlocked and "Unlock screen" when locked', () => {
        const { rerender } = render(<TouchLockIndicator isLocked={false} onLock={vi.fn()} onUnlock={vi.fn()} />);

        const lockButton = screen.getByRole('button', { name: 'Lock screen' });
        expect(lockButton).toHaveAttribute('type', 'button');
        expect(screen.getByTestId('touch-lock-icon-open')).toHaveAttribute('aria-hidden', 'true');

        rerender(<TouchLockIndicator isLocked={true} onLock={vi.fn()} onUnlock={vi.fn()} />);

        const unlockButton = screen.getByRole('button', { name: 'Unlock screen' });
        expect(unlockButton).toHaveAttribute('type', 'button');
        expect(screen.getByTestId('touch-lock-icon-closed')).toHaveAttribute('aria-hidden', 'true');
    });

    it('has a ≥44px touch target and a visible focus ring', () => {
        render(<TouchLockIndicator isLocked={true} onLock={vi.fn()} onUnlock={vi.fn()} />);

        const button = screen.getByTestId('touch-lock-indicator');
        expect(button.className).toContain('min-h-[44px]');
        expect(button.className).toContain('min-w-[44px]');
        expect(button.className).toContain('focus-visible:ring-2');
        expect(button.className).not.toContain('pointer-events-none');
        expect(button).not.toHaveAttribute('aria-hidden');
    });

    it('sits below the z-50 modal backdrops', () => {
        render(<TouchLockIndicator isLocked={false} onLock={vi.fn()} onUnlock={vi.fn()} />);

        const button = screen.getByTestId('touch-lock-indicator');
        expect(button.className).toContain('z-40');
        expect(button.className).not.toContain('z-[80]');
        expect(button.className).not.toContain('z-[95]');
    });

    it('raised lifts it above the lock overlay', () => {
        const onLock = vi.fn();
        const onUnlock = vi.fn();
        render(<TouchLockIndicator isLocked={true} onLock={onLock} onUnlock={onUnlock} raised />);

        const button = screen.getByTestId('touch-lock-indicator');
        expect(button.className).toContain('z-[95]');
        expect(button.className).not.toContain('z-40');

        fireEvent.click(button);
        expect(onUnlock).toHaveBeenCalledOnce();
        expect(onLock).not.toHaveBeenCalled();
    });

    it('a single click while unlocked calls onLock only', () => {
        const onLock = vi.fn();
        const onUnlock = vi.fn();
        render(<TouchLockIndicator isLocked={false} onLock={onLock} onUnlock={onUnlock} />);

        fireEvent.click(screen.getByRole('button', { name: 'Lock screen' }));
        expect(onLock).toHaveBeenCalledOnce();
        expect(onUnlock).not.toHaveBeenCalled();
    });

    it('a single click while locked calls onUnlock only', () => {
        const onLock = vi.fn();
        const onUnlock = vi.fn();
        render(<TouchLockIndicator isLocked={true} onLock={onLock} onUnlock={onUnlock} />);

        fireEvent.click(screen.getByRole('button', { name: 'Unlock screen' }));
        expect(onUnlock).toHaveBeenCalledOnce();
        expect(onLock).not.toHaveBeenCalled();
    });
});
