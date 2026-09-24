import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act, cleanup } from '@testing-library/react';
import TouchLockOverlay, { CLOSING_SETTLE_MS } from '../../components/common/TouchLockOverlay';

// F20: App mounts the overlay only on a guarded attempt (a blocked tap/swipe on a
// chore bar), seeded with that attempt as the first tap of the unlock double-tap.
describe('TouchLockOverlay', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const renderSeeded = (firstTap = { x: 100, y: 100 }) => {
        const onArm = vi.fn();
        const onDismiss = vi.fn();
        render(<TouchLockOverlay firstTap={firstTap} onArm={onArm} onDismiss={onDismiss} />);
        return { onArm, onDismiss };
    };

    it('renders a full-viewport, non-blocking root with the expected testid, role and label', () => {
        renderSeeded();

        const overlay = screen.getByTestId('touch-lock-overlay');
        expect(overlay).toBeInTheDocument();
        expect(overlay).toHaveAttribute('role', 'button');
        expect(overlay).toHaveAttribute('aria-label', 'Tap twice to unlock');
        expect(overlay).toHaveClass('fixed', 'inset-0', 'pointer-events-none');
    });

    it('draws a 120 px hit circle centred on the seed, with the padlock in it', () => {
        renderSeeded({ x: 300, y: 200 });

        const hitArea = screen.getByTestId('touch-lock-hit-area');
        expect(hitArea).toHaveClass('rounded-full', 'pointer-events-auto');
        expect(hitArea.style.left).toBe('240px');
        expect(hitArea.style.top).toBe('140px');
        expect(hitArea.style.width).toBe('120px');
        expect(hitArea.style.height).toBe('120px');
        expect(within(hitArea).getByTestId('touch-lock-icon-closed')).toBeInTheDocument();
    });

    it('clamps the hit circle fully on-screen for a seed near an edge (e.g. a keyboard (0, 0) seed)', () => {
        renderSeeded({ x: 0, y: 0 });

        const hitArea = screen.getByTestId('touch-lock-hit-area');
        expect(hitArea.style.left).toBe('0px');
        expect(hitArea.style.top).toBe('0px');

        // jsdom's viewport is 1024 x 768.
        cleanup();
        renderSeeded({ x: 1020, y: 765 });
        const farCornerHitArea = screen.getByTestId('touch-lock-hit-area');
        expect(farCornerHitArea.style.left).toBe(`${1024 - 120}px`);
        expect(farCornerHitArea.style.top).toBe(`${768 - 120}px`);
    });

    it('mounts in awaiting-second-tap: shows the closed padlock immediately and has focus', () => {
        const { onArm } = renderSeeded();

        const overlay = screen.getByTestId('touch-lock-overlay');
        const hitArea = screen.getByTestId('touch-lock-hit-area');
        expect(within(hitArea).getByTestId('touch-lock-icon-closed')).toBeInTheDocument();
        expect(document.activeElement).toBe(overlay);
        expect(onArm).not.toHaveBeenCalled();
    });

    it('fades when SECOND_TAP_WINDOW_MS elapses with no qualifying tap, then calls onDismiss once after CLOSING_SETTLE_MS, and never onArm', () => {
        const { onArm, onDismiss } = renderSeeded();
        const overlay = screen.getByTestId('touch-lock-overlay');
        const hitArea = screen.getByTestId('touch-lock-hit-area');

        act(() => {
            vi.advanceTimersByTime(1500);
        });

        expect(overlay.className).toContain('opacity-0');
        expect(overlay.className).toContain('pointer-events-none');
        // DD-2: the fading circle passes taps through too.
        expect(hitArea.className).toContain('pointer-events-none');
        expect(hitArea.className).not.toContain('pointer-events-auto');
        expect(onDismiss).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(CLOSING_SETTLE_MS);
        });

        expect(onDismiss).toHaveBeenCalledOnce();
        expect(onArm).not.toHaveBeenCalled();
    });

    it('a qualifying tap calls onArm once, shows the open icon, keeps swallowing taps through the opening animation and emits nothing more', () => {
        const { onArm, onDismiss } = renderSeeded();
        const overlay = screen.getByTestId('touch-lock-overlay');
        const hitArea = screen.getByTestId('touch-lock-hit-area');

        // hypot(30, 40) === 50
        fireEvent.click(hitArea, { clientX: 130, clientY: 140 });

        expect(onArm).toHaveBeenCalledOnce();
        expect(within(hitArea).getByTestId('touch-lock-icon-open')).toBeInTheDocument();
        // DD-21: the hit circle stays hit-testable in 'opening'; the root never is.
        expect(hitArea.className).toContain('pointer-events-auto');
        expect(overlay.className).toContain('pointer-events-none');
        expect(overlay.className).not.toContain('opacity-0');

        fireEvent.click(hitArea, { clientX: 130, clientY: 140 });
        expect(onArm).toHaveBeenCalledOnce();
        expect(within(hitArea).getByTestId('touch-lock-icon-open')).toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(10_000);
        });

        expect(onArm).toHaveBeenCalledOnce();
        expect(onDismiss).not.toHaveBeenCalled();
        expect(screen.getByTestId('touch-lock-overlay')).toBeInTheDocument();
    });

    it('ignores a non-qualifying tap without re-seeding or restarting the window', () => {
        const { onArm, onDismiss } = renderSeeded();
        const hitArea = screen.getByTestId('touch-lock-hit-area');

        act(() => {
            vi.advanceTimersByTime(1000);
        });
        // A real browser never delivers a click this far from the circle's centre
        // (the root is pointer-events-none); registerTap's distance check is the
        // belt-and-braces guard, and a miss changes nothing.
        fireEvent.click(hitArea, { clientX: 300, clientY: 300 });
        expect(onArm).not.toHaveBeenCalled();

        // The fade still starts 1500 ms after mount, not after the miss.
        act(() => {
            vi.advanceTimersByTime(499);
        });
        expect(hitArea.className).toContain('pointer-events-auto');
        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(hitArea.className).toContain('pointer-events-none');

        // And a tap back at the seed after the miss is ignored too: it is fading.
        fireEvent.click(hitArea, { clientX: 100, clientY: 100 });
        act(() => {
            vi.advanceTimersByTime(CLOSING_SETTLE_MS);
        });
        expect(onDismiss).toHaveBeenCalledOnce();
        expect(onArm).not.toHaveBeenCalled();
    });

    it('measures a pointer tap against the clamped circle centre', () => {
        const { onArm } = renderSeeded({ x: 5, y: 5 });

        // The circle is clamped to centre (60, 60); a tap there is 78 px from the
        // raw seed but inside the circle, so it qualifies.
        fireEvent.click(screen.getByTestId('touch-lock-hit-area'), { clientX: 60, clientY: 60 });

        expect(onArm).toHaveBeenCalledOnce();
    });

    it('qualifies a second tap at exactly the max distance boundary (60px)', () => {
        const { onArm } = renderSeeded();

        // hypot(36, 48) === 60
        fireEvent.click(screen.getByTestId('touch-lock-hit-area'), { clientX: 136, clientY: 148 });

        expect(onArm).toHaveBeenCalledOnce();
    });

    it('qualifies a second tap at 1499 ms', () => {
        const { onArm } = renderSeeded();

        act(() => {
            vi.advanceTimersByTime(1499);
        });
        fireEvent.click(screen.getByTestId('touch-lock-hit-area'), { clientX: 100, clientY: 100 });

        expect(onArm).toHaveBeenCalledOnce();
    });

    it('is fading at exactly 1500 ms and ignores a tap after that (no onArm, no restart)', () => {
        const { onArm, onDismiss } = renderSeeded();
        const overlay = screen.getByTestId('touch-lock-overlay');
        const hitArea = screen.getByTestId('touch-lock-hit-area');

        act(() => {
            vi.advanceTimersByTime(1500);
        });
        expect(overlay.className).toContain('opacity-0');
        expect(hitArea.className).toContain('pointer-events-none');
        expect(onDismiss).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(1);
        });
        fireEvent.click(hitArea, { clientX: 100, clientY: 100 });
        expect(onArm).not.toHaveBeenCalled();

        // No restart: onDismiss still fires once, at 1900 ms after mount.
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
        const { onArm } = renderSeeded({ x: 0, y: 0 });

        fireEvent.keyDown(screen.getByTestId('touch-lock-overlay'), { key: 'Enter' });

        expect(onArm).toHaveBeenCalledOnce();
    });

    it('qualifies a single Space press after a keyboard-originated attempt', () => {
        const { onArm } = renderSeeded({ x: 0, y: 0 });

        fireEvent.keyDown(screen.getByTestId('touch-lock-overlay'), { key: ' ' });

        expect(onArm).toHaveBeenCalledOnce();
    });

    it('ignores auto-repeated key presses, so a held key cannot unlock', () => {
        const { onArm } = renderSeeded({ x: 0, y: 0 });

        fireEvent.keyDown(screen.getByTestId('touch-lock-overlay'), { key: 'Enter', repeat: true });

        expect(onArm).not.toHaveBeenCalled();
    });

    it('ignores Enter after a pointer seed: (0, 0) is far from it, and a miss never re-seeds', () => {
        const { onArm } = renderSeeded();
        const overlay = screen.getByTestId('touch-lock-overlay');

        // Enter registers (0, 0), 141 px from the (100, 100) seed; since the
        // post-PR amendment a miss no longer becomes a new first tap, so a
        // second Enter does not qualify either.
        fireEvent.keyDown(overlay, { key: 'Enter' });
        fireEvent.keyDown(overlay, { key: 'Enter' });

        expect(onArm).not.toHaveBeenCalled();
    });

    it('ignores further taps/key presses once phase is opening, so onArm is not re-invoked and phase does not regress', () => {
        const { onArm } = renderSeeded();
        const overlay = screen.getByTestId('touch-lock-overlay');
        const hitArea = screen.getByTestId('touch-lock-hit-area');

        fireEvent.click(hitArea, { clientX: 110, clientY: 105 });
        expect(onArm).toHaveBeenCalledOnce();

        // registerTap's 'opening' early return is what discards keys landing
        // during the CLOSING_SETTLE_MS grace window: they must not regress phase
        // back to 'awaiting-second-tap' or re-invoke onArm.
        fireEvent.keyDown(overlay, { key: 'Enter' });
        fireEvent.keyDown(overlay, { key: 'Enter' });

        expect(onArm).toHaveBeenCalledOnce();
        expect(within(hitArea).getByTestId('touch-lock-icon-open')).toBeInTheDocument();
    });

    it('ignores further clicks once phase is opening, so onArm is not re-invoked and phase does not regress', () => {
        const { onArm } = renderSeeded();
        const hitArea = screen.getByTestId('touch-lock-hit-area');

        fireEvent.click(hitArea, { clientX: 110, clientY: 105 });
        expect(onArm).toHaveBeenCalledOnce();

        // DD-21: the hit circle stays hit-testable in 'opening', so in a real
        // browser a rapid third tap on the same spot lands on it (instead of
        // completing the chore beneath) and registerTap discards it.
        fireEvent.click(hitArea, { clientX: 100, clientY: 100 });
        fireEvent.click(hitArea, { clientX: 110, clientY: 105 });

        expect(onArm).toHaveBeenCalledOnce();
        expect(hitArea.className).toContain('pointer-events-auto');
        expect(within(hitArea).getByTestId('touch-lock-icon-open')).toBeInTheDocument();
    });

    it('restores focus to the previously focused element on unmount', () => {
        const onArm = vi.fn();
        const onDismiss = vi.fn();
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
        const onArm = vi.fn();
        const onDismiss = vi.fn();
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
