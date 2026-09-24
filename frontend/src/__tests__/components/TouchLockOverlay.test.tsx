import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import TouchLockOverlay, { CLOSING_SETTLE_MS } from '../../components/common/TouchLockOverlay';

// F20: App mounts the overlay only on a guarded attempt (a blocked tap/swipe on a
// chore bar), seeded with that attempt as the first tap of the unlock double-tap.
describe('TouchLockOverlay', () => {
    let onArm: ReturnType<typeof vi.fn<() => void>>;
    let onDismiss: ReturnType<typeof vi.fn<() => void>>;

    beforeEach(() => {
        vi.useFakeTimers();
        onArm = vi.fn<() => void>();
        onDismiss = vi.fn<() => void>();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const renderSeeded = (firstTap = { x: 100, y: 100 }) =>
        render(<TouchLockOverlay firstTap={firstTap} onArm={onArm} onDismiss={onDismiss} />);

    it('renders a full-viewport element with the expected testid, role and label', () => {
        renderSeeded();

        const overlay = screen.getByTestId('touch-lock-overlay');
        expect(overlay).toBeInTheDocument();
        expect(overlay).toHaveAttribute('role', 'button');
        expect(overlay).toHaveAttribute('aria-label', 'Tap twice to unlock');
        expect(overlay).toHaveClass('fixed', 'inset-0');
    });

    it('mounts in awaiting-second-tap: shows the centred closed padlock immediately and has focus', () => {
        renderSeeded();

        const overlay = screen.getByTestId('touch-lock-overlay');
        const centered = screen.getByTestId('touch-lock-padlock-centered');
        expect(within(centered).getByTestId('touch-lock-icon-closed')).toBeInTheDocument();
        expect(document.activeElement).toBe(overlay);
        expect(onArm).not.toHaveBeenCalled();
    });

    it('fades when SECOND_TAP_WINDOW_MS elapses with no qualifying tap, then calls onDismiss once after CLOSING_SETTLE_MS, and never onArm', () => {
        renderSeeded();
        const overlay = screen.getByTestId('touch-lock-overlay');

        act(() => {
            vi.advanceTimersByTime(1500);
        });

        expect(overlay.className).toContain('opacity-0');
        expect(overlay.className).toContain('pointer-events-none');
        expect(onDismiss).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(CLOSING_SETTLE_MS);
        });

        expect(onDismiss).toHaveBeenCalledOnce();
        expect(onArm).not.toHaveBeenCalled();
    });

    it('a qualifying tap calls onArm once, shows the open icon, keeps swallowing taps through the opening animation and emits nothing more', () => {
        renderSeeded();
        const overlay = screen.getByTestId('touch-lock-overlay');

        // hypot(30, 40) === 50
        fireEvent.click(overlay, { clientX: 130, clientY: 140 });

        expect(onArm).toHaveBeenCalledOnce();
        const centered = screen.getByTestId('touch-lock-padlock-centered');
        expect(within(centered).getByTestId('touch-lock-icon-open')).toBeInTheDocument();
        // DD-21: the root stays hit-testable in 'opening'.
        expect(overlay.className).not.toContain('pointer-events-none');
        expect(overlay.className).not.toContain('opacity-0');

        fireEvent.click(overlay, { clientX: 130, clientY: 140 });
        expect(onArm).toHaveBeenCalledOnce();
        expect(within(centered).getByTestId('touch-lock-icon-open')).toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(10_000);
        });

        expect(onArm).toHaveBeenCalledOnce();
        expect(onDismiss).not.toHaveBeenCalled();
        expect(screen.getByTestId('touch-lock-overlay')).toBeInTheDocument();
    });

    it('treats a tap more than 60px away as a new first tap and restarts the window', () => {
        renderSeeded();
        const overlay = screen.getByTestId('touch-lock-overlay');

        act(() => {
            vi.advanceTimersByTime(1000);
        });
        fireEvent.click(overlay, { clientX: 300, clientY: 300 });
        expect(onArm).not.toHaveBeenCalled();

        // The fade now starts 1500 ms after the re-seed, not after mount.
        act(() => {
            vi.advanceTimersByTime(1499);
        });
        expect(overlay.className).not.toContain('pointer-events-none');
        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(overlay.className).toContain('pointer-events-none');
        act(() => {
            vi.advanceTimersByTime(CLOSING_SETTLE_MS - 1);
        });
        expect(onDismiss).not.toHaveBeenCalled();
        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(onDismiss).toHaveBeenCalledOnce();
        expect(onArm).not.toHaveBeenCalled();
    });

    it('a tap near the re-seeded first tap qualifies', () => {
        renderSeeded();
        const overlay = screen.getByTestId('touch-lock-overlay');

        fireEvent.click(overlay, { clientX: 300, clientY: 300 });
        expect(onArm).not.toHaveBeenCalled();
        fireEvent.click(overlay, { clientX: 310, clientY: 305 });

        expect(onArm).toHaveBeenCalledOnce();
    });

    it('qualifies a second tap at exactly the max distance boundary (60px)', () => {
        renderSeeded();

        // hypot(36, 48) === 60
        fireEvent.click(screen.getByTestId('touch-lock-overlay'), { clientX: 136, clientY: 148 });

        expect(onArm).toHaveBeenCalledOnce();
    });

    it('qualifies a second tap at 1499 ms', () => {
        renderSeeded();

        act(() => {
            vi.advanceTimersByTime(1499);
        });
        fireEvent.click(screen.getByTestId('touch-lock-overlay'), { clientX: 100, clientY: 100 });

        expect(onArm).toHaveBeenCalledOnce();
    });

    it('is fading at exactly 1500 ms and ignores a tap after that (no onArm, no re-seed)', () => {
        renderSeeded();
        const overlay = screen.getByTestId('touch-lock-overlay');

        act(() => {
            vi.advanceTimersByTime(1500);
        });
        expect(overlay.className).toContain('pointer-events-none');
        expect(overlay.className).toContain('opacity-0');
        expect(onDismiss).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(1);
        });
        fireEvent.click(overlay, { clientX: 100, clientY: 100 });
        expect(onArm).not.toHaveBeenCalled();

        // No re-seed: onDismiss still fires once, at 1900 ms after mount.
        act(() => {
            vi.advanceTimersByTime(CLOSING_SETTLE_MS - 1);
        });
        expect(onDismiss).toHaveBeenCalledOnce();
        act(() => {
            vi.advanceTimersByTime(5000);
        });
        expect(onDismiss).toHaveBeenCalledOnce();
        expect(onArm).not.toHaveBeenCalled();
    });

    it('qualifies a single Enter press after a keyboard-originated attempt', () => {
        renderSeeded({ x: 0, y: 0 });

        fireEvent.keyDown(screen.getByTestId('touch-lock-overlay'), { key: 'Enter' });

        expect(onArm).toHaveBeenCalledOnce();
    });

    it('qualifies a single Space press after a keyboard-originated attempt', () => {
        renderSeeded({ x: 0, y: 0 });

        fireEvent.keyDown(screen.getByTestId('touch-lock-overlay'), { key: ' ' });

        expect(onArm).toHaveBeenCalledOnce();
    });

    it('ignores auto-repeated key presses, so a held key cannot unlock', () => {
        renderSeeded({ x: 0, y: 0 });

        fireEvent.keyDown(screen.getByTestId('touch-lock-overlay'), { key: 'Enter', repeat: true });

        expect(onArm).not.toHaveBeenCalled();
    });

    it('does not qualify Enter after a pointer seed; it becomes a new first tap', () => {
        renderSeeded();
        const overlay = screen.getByTestId('touch-lock-overlay');

        // Enter registers (0, 0), 141 px from the (100, 100) seed.
        fireEvent.keyDown(overlay, { key: 'Enter' });
        expect(onArm).not.toHaveBeenCalled();

        fireEvent.keyDown(overlay, { key: 'Enter' });
        expect(onArm).toHaveBeenCalledOnce();
    });

    it('ignores further taps/key presses once phase is opening, so onArm is not re-invoked and phase does not regress', () => {
        renderSeeded();
        const overlay = screen.getByTestId('touch-lock-overlay');

        fireEvent.click(overlay, { clientX: 110, clientY: 105 });
        expect(onArm).toHaveBeenCalledOnce();

        // registerTap's 'opening' early return is what discards keys landing
        // during the CLOSING_SETTLE_MS grace window: they must not regress phase
        // back to 'awaiting-second-tap' or re-invoke onArm.
        fireEvent.keyDown(overlay, { key: 'Enter' });
        fireEvent.keyDown(overlay, { key: 'Enter' });

        expect(onArm).toHaveBeenCalledOnce();
        const centered = screen.getByTestId('touch-lock-padlock-centered');
        expect(within(centered).getByTestId('touch-lock-icon-open')).toBeInTheDocument();
    });

    it('ignores further clicks once phase is opening, so onArm is not re-invoked and phase does not regress', () => {
        renderSeeded();
        const overlay = screen.getByTestId('touch-lock-overlay');

        fireEvent.click(overlay, { clientX: 110, clientY: 105 });
        expect(onArm).toHaveBeenCalledOnce();

        // DD-21: the root is hit-testable in 'opening', so in a real browser too
        // these taps reach registerTap, and its 'opening' early return is what
        // discards them. The qualifying tap above nulled firstTapRef, so a single
        // follow-up click would harmlessly re-seed even without the guard — it
        // takes a second follow-up click to prove the `phase === 'opening'` guard
        // (not firstTapRef state) is what prevents a second onArm() call.
        fireEvent.click(overlay, { clientX: 100, clientY: 100 });
        fireEvent.click(overlay, { clientX: 110, clientY: 105 });

        expect(onArm).toHaveBeenCalledOnce();
        const centered = screen.getByTestId('touch-lock-padlock-centered');
        expect(within(centered).getByTestId('touch-lock-icon-open')).toBeInTheDocument();
    });

    it('restores focus to the previously focused element on unmount', () => {
        const Harness = ({ show }: { show: boolean }) => (
            <>
                <button>Before</button>
                {show && <TouchLockOverlay firstTap={{ x: 100, y: 100 }} onArm={onArm} onDismiss={onDismiss} />}
            </>
        );
        const { rerender } = render(<Harness show={false} />);
        const before = screen.getByRole('button', { name: 'Before' });
        before.focus();

        rerender(<Harness show />);
        expect(document.activeElement).toBe(screen.getByTestId('touch-lock-overlay'));

        rerender(<Harness show={false} />);
        expect(document.activeElement).toBe(before);
    });

    it('does not steal focus if it moved elsewhere before unmount', () => {
        const Harness = ({ show }: { show: boolean }) => (
            <>
                <button>Before</button>
                <button>Elsewhere</button>
                {show && <TouchLockOverlay firstTap={{ x: 100, y: 100 }} onArm={onArm} onDismiss={onDismiss} />}
            </>
        );
        const { rerender } = render(<Harness show={false} />);
        screen.getByRole('button', { name: 'Before' }).focus();

        rerender(<Harness show />);
        expect(document.activeElement).toBe(screen.getByTestId('touch-lock-overlay'));

        const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });
        elsewhere.focus();
        rerender(<Harness show={false} />);
        expect(document.activeElement).toBe(elsewhere);
    });
});
