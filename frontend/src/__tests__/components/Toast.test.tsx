import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Toast, { SUCCESS_TOAST_MS } from '../../components/common/Toast';

describe('Toast (F21)', () => {
    it('renders the message with role="status" and aria-live="polite"', () => {
        render(<Toast tone="success" message={'Added "Mop"'} onDismiss={vi.fn()} />);

        const pill = screen.getByRole('status');
        expect(pill).toHaveTextContent('Added "Mop"');
        expect(pill).toHaveAttribute('aria-live', 'polite');
        expect(pill).toHaveAttribute('data-testid', 'toast');
        expect(pill).toHaveAttribute('data-tone', 'success');
    });

    it('success tone is green and has no dismiss control', () => {
        render(<Toast tone="success" message={'Added "Mop"'} onDismiss={vi.fn()} />);

        expect(screen.getByRole('status').className).toContain('bg-green-600');
        expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
    });

    it('success auto-dismisses after SUCCESS_TOAST_MS', () => {
        vi.useFakeTimers();
        try {
            const onDismiss = vi.fn();
            render(<Toast tone="success" message={'Added "Mop"'} onDismiss={onDismiss} />);

            act(() => {
                vi.advanceTimersByTime(SUCCESS_TOAST_MS - 1);
            });
            expect(onDismiss).not.toHaveBeenCalled();

            act(() => {
                vi.advanceTimersByTime(1);
            });
            expect(onDismiss).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it('error tone is red, never auto-dismisses, and dismisses on the ✕ or a tap on the pill', () => {
        vi.useFakeTimers();
        try {
            const onDismiss = vi.fn();
            render(<Toast tone="error" message="Add failed" onDismiss={onDismiss} />);

            const pill = screen.getByRole('status');
            expect(pill.className).toContain('bg-red-700');
            expect(pill).toHaveAttribute('data-tone', 'error');

            act(() => {
                vi.advanceTimersByTime(SUCCESS_TOAST_MS * 2);
            });
            expect(onDismiss).not.toHaveBeenCalled();

            fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
            expect(onDismiss).toHaveBeenCalledTimes(1);

            fireEvent.click(screen.getByRole('status'));
            expect(onDismiss).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });

    it('clears the pending success timer on unmount', () => {
        vi.useFakeTimers();
        try {
            const onDismiss = vi.fn();
            const { unmount } = render(
                <Toast tone="success" message={'Added "Mop"'} onDismiss={onDismiss} />,
            );

            unmount();
            act(() => {
                vi.advanceTimersByTime(SUCCESS_TOAST_MS + 1);
            });
            expect(onDismiss).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });

    it('sits in a click-through fixed frame at bottom-centre above the deck clearance and under the lock/blank layers', () => {
        const { unmount } = render(
            <Toast tone="success" message={'Added "Mop"'} onDismiss={vi.fn()} />,
        );

        const frame = screen.getByRole('status').parentElement;
        expect(frame).not.toBeNull();
        for (const frameClass of ['fixed', 'inset-x-4', 'bottom-40', 'z-[80]', 'flex', 'justify-center', 'pointer-events-none']) {
            expect(frame!.className).toContain(frameClass);
        }

        const successPill = screen.getByRole('status');
        expect(successPill.className).toContain('max-w-full');
        expect(successPill.className).toContain('min-w-0');
        expect(successPill.className).toContain('rounded-full');
        expect(successPill.className).not.toContain('overflow-y-auto');
        expect(successPill.className).not.toContain('pointer-events-auto');
        expect(successPill.className).not.toContain('cursor-pointer');

        const span = screen.getByRole('status').querySelector('span');
        expect(span).not.toBeNull();
        expect(span!.className).toContain('truncate');
        expect(span!.className).toContain('min-w-0');

        unmount();
        render(<Toast tone="error" message="Add failed" onDismiss={vi.fn()} />);

        const errorPill = screen.getByRole('status');
        expect(errorPill.className).toContain('pointer-events-auto');
        expect(errorPill.className).toContain('cursor-pointer');
        expect(screen.getByRole('button', { name: 'Dismiss' }).className).toContain('pointer-events-auto');
    });

    it('a success pill body click does nothing', () => {
        const onDismiss = vi.fn();
        render(<Toast tone="success" message={'Added "Mop"'} onDismiss={onDismiss} />);

        fireEvent.click(screen.getByRole('status'));
        expect(onDismiss).not.toHaveBeenCalled();
    });
});
