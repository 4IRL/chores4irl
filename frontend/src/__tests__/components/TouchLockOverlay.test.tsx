import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import TouchLockOverlay from '../../components/common/TouchLockOverlay';

describe('TouchLockOverlay', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders a full-viewport element with the expected testid and role', () => {
        render(<TouchLockOverlay onArm={vi.fn()} />);

        const overlay = screen.getByTestId('touch-lock-overlay');
        expect(overlay).toBeInTheDocument();
        expect(overlay).toHaveAttribute('role', 'button');
    });

    it('a single click does not call onArm and shows the centered closed padlock', () => {
        const onArm = vi.fn();
        render(<TouchLockOverlay onArm={onArm} />);
        const overlay = screen.getByTestId('touch-lock-overlay');

        fireEvent.click(overlay, { clientX: 100, clientY: 100 });

        expect(onArm).not.toHaveBeenCalled();
        const centered = screen.getByTestId('touch-lock-padlock-centered');
        expect(centered).toBeInTheDocument();
        expect(within(centered).getByTestId('touch-lock-icon-closed')).toBeInTheDocument();
    });

    it('reverts the centered padlock after the second-tap window elapses with no further tap', () => {
        const onArm = vi.fn();
        render(<TouchLockOverlay onArm={onArm} />);
        const overlay = screen.getByTestId('touch-lock-overlay');

        fireEvent.click(overlay, { clientX: 100, clientY: 100 });
        act(() => {
            vi.advanceTimersByTime(1500);
        });

        expect(screen.queryByTestId('touch-lock-padlock-centered')).not.toBeInTheDocument();
        expect(onArm).not.toHaveBeenCalled();
    });

    it('a qualifying second click within the window and within 60px calls onArm exactly once, shows the open icon, and makes the overlay pointer-events-none', () => {
        const onArm = vi.fn();
        render(<TouchLockOverlay onArm={onArm} />);
        const overlay = screen.getByTestId('touch-lock-overlay');

        fireEvent.click(overlay, { clientX: 100, clientY: 100 });
        fireEvent.click(overlay, { clientX: 110, clientY: 105 });

        expect(onArm).toHaveBeenCalledOnce();
        const centered = screen.getByTestId('touch-lock-padlock-centered');
        expect(within(centered).getByTestId('touch-lock-icon-open')).toBeInTheDocument();
        expect(overlay).toHaveClass('pointer-events-none');
    });

    it('treats a second click more than 60px away as a new first tap instead of a qualifying second tap', () => {
        const onArm = vi.fn();
        render(<TouchLockOverlay onArm={onArm} />);
        const overlay = screen.getByTestId('touch-lock-overlay');

        fireEvent.click(overlay, { clientX: 100, clientY: 100 });
        fireEvent.click(overlay, { clientX: 300, clientY: 300 });

        expect(onArm).not.toHaveBeenCalled();

        fireEvent.click(overlay, { clientX: 310, clientY: 305 });

        expect(onArm).toHaveBeenCalledOnce();
    });

    it('qualifies two Enter presses within the timing window as a double-tap', () => {
        const onArm = vi.fn();
        render(<TouchLockOverlay onArm={onArm} />);
        const overlay = screen.getByTestId('touch-lock-overlay');

        fireEvent.keyDown(overlay, { key: 'Enter' });
        fireEvent.keyDown(overlay, { key: 'Enter' });

        expect(onArm).toHaveBeenCalledOnce();
    });

    it('qualifies a second tap at exactly the max distance boundary (60px)', () => {
        const onArm = vi.fn();
        render(<TouchLockOverlay onArm={onArm} />);
        const overlay = screen.getByTestId('touch-lock-overlay');

        // hypot(36, 48) === 60
        fireEvent.click(overlay, { clientX: 100, clientY: 100 });
        fireEvent.click(overlay, { clientX: 136, clientY: 148 });

        expect(onArm).toHaveBeenCalledOnce();
    });

    it('qualifies a second tap fired at exactly the max time-window boundary (1500ms)', () => {
        const onArm = vi.fn();
        render(<TouchLockOverlay onArm={onArm} />);
        const overlay = screen.getByTestId('touch-lock-overlay');

        fireEvent.click(overlay, { clientX: 100, clientY: 100 });
        act(() => {
            vi.advanceTimersByTime(1500);
        });
        fireEvent.click(overlay, { clientX: 100, clientY: 100 });

        expect(onArm).toHaveBeenCalledOnce();
    });

    it('when justRelocked, shows the centered closed padlock and a backdrop immediately on mount, both disappearing after ~600ms', () => {
        render(<TouchLockOverlay onArm={vi.fn()} justRelocked />);

        const centered = screen.getByTestId('touch-lock-padlock-centered');
        expect(centered).toBeInTheDocument();
        expect(within(centered).getByTestId('touch-lock-icon-closed')).toBeInTheDocument();
        expect(screen.getByTestId('touch-lock-backdrop')).toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(600);
        });

        expect(screen.queryByTestId('touch-lock-padlock-centered')).not.toBeInTheDocument();
        expect(screen.queryByTestId('touch-lock-backdrop')).not.toBeInTheDocument();
    });

    it('ignores further taps/key presses once phase is opening, so onArm is not re-invoked and phase does not regress', () => {
        const onArm = vi.fn();
        render(<TouchLockOverlay onArm={onArm} />);
        const overlay = screen.getByTestId('touch-lock-overlay');

        fireEvent.click(overlay, { clientX: 100, clientY: 100 });
        fireEvent.click(overlay, { clientX: 110, clientY: 105 });
        expect(onArm).toHaveBeenCalledOnce();

        // A stray keyboard activation landing during the CLOSING_SETTLE_MS
        // grace window (pointer-events-none only blocks pointer input, not
        // keydown) must not regress phase back to 'awaiting-second-tap' or
        // re-invoke onArm.
        fireEvent.keyDown(overlay, { key: 'Enter' });
        fireEvent.keyDown(overlay, { key: 'Enter' });

        expect(onArm).toHaveBeenCalledOnce();
        const centered = screen.getByTestId('touch-lock-padlock-centered');
        expect(within(centered).getByTestId('touch-lock-icon-open')).toBeInTheDocument();
    });

    it('keeps rendering after a qualifying second tap; onArm is the only signal it emits', () => {
        const onArm = vi.fn();
        render(<TouchLockOverlay onArm={onArm} />);
        const overlay = screen.getByTestId('touch-lock-overlay');

        fireEvent.click(overlay, { clientX: 100, clientY: 100 });
        fireEvent.click(overlay, { clientX: 110, clientY: 105 });

        expect(onArm).toHaveBeenCalledOnce();
        expect(screen.getByTestId('touch-lock-overlay')).toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(10_000);
        });

        expect(onArm).toHaveBeenCalledOnce();
        expect(screen.getByTestId('touch-lock-overlay')).toBeInTheDocument();
    });
});
