import { useRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ScrollToTopButton, { SCROLL_TO_TOP_THRESHOLD_PX, FADE_MS } from '../../components/common/ScrollToTopButton';

// Renders the scroller before the button so the ref is attached by the time
// the button's effects run, mirroring App.
function Harness() {
    const ref = useRef<HTMLDivElement>(null);
    return (
        <>
            <div data-testid="scroller" ref={ref} />
            <ScrollToTopButton scrollRegionRef={ref} />
        </>
    );
}

function scrollScrollerTo(scrollTop: number) {
    const scroller = screen.getByTestId('scroller');
    scroller.scrollTop = scrollTop;
    fireEvent.scroll(scroller);
}

function expectNonInteractive(button: HTMLElement) {
    expect(button).toHaveAttribute('aria-hidden', 'true');
    expect(button.tabIndex).toBe(-1);
    expect(button).toHaveAttribute('inert');
    expect(button.className).toContain('pointer-events-none');
}

function expectInteractive(button: HTMLElement) {
    expect(button).not.toHaveAttribute('aria-hidden');
    expect(button.tabIndex).toBe(0);
    expect(button).not.toHaveAttribute('inert');
    expect(button.className).not.toContain('pointer-events-none');
}

describe('ScrollToTopButton (F18)', () => {
    beforeEach(() => {
        Element.prototype.scrollTo = vi.fn();
    });

    afterEach(() => {
        delete (Element.prototype as Partial<Element>).scrollTo;
        vi.unstubAllGlobals();
    });

    it('is hidden and non-interactive at mount (scrollTop 0), with no fade window', () => {
        vi.useFakeTimers();
        try {
            render(<Harness />);

            const button = screen.getByTestId('scroll-to-top');
            expect(button.className).toContain('opacity-0');
            expectNonInteractive(button);
            expect(button).toHaveAttribute('aria-label', 'Scroll to top');
            expect(button).toHaveAttribute('type', 'button');
        } finally {
            vi.useRealTimers();
        }
    });

    it('becomes visible and interactive past the threshold', () => {
        render(<Harness />);

        scrollScrollerTo(SCROLL_TO_TOP_THRESHOLD_PX + 1);

        const button = screen.getByTestId('scroll-to-top');
        expect(button.className).toContain('opacity-100');
        expectInteractive(button);
        expect(screen.getByRole('button', { name: 'Scroll to top' })).toBe(button);
    });

    it('fades out at once but stays interactive until FADE_MS has elapsed', () => {
        vi.useFakeTimers();
        try {
            render(<Harness />);
            scrollScrollerTo(SCROLL_TO_TOP_THRESHOLD_PX + 1);
            scrollScrollerTo(0);

            const button = screen.getByTestId('scroll-to-top');
            expect(button.className).toContain('opacity-0');
            expect(button.className).not.toContain('opacity-100');
            expectInteractive(button);

            act(() => {
                vi.advanceTimersByTime(FADE_MS - 1);
            });
            expectInteractive(button);

            act(() => {
                vi.advanceTimersByTime(1);
            });
            expectNonInteractive(button);
        } finally {
            vi.useRealTimers();
        }
    });

    it('a re-show during the fade-out cancels the pending non-interactive timer', () => {
        vi.useFakeTimers();
        try {
            render(<Harness />);
            scrollScrollerTo(SCROLL_TO_TOP_THRESHOLD_PX + 1);
            scrollScrollerTo(0);

            act(() => {
                vi.advanceTimersByTime(FADE_MS - 1);
            });
            expect(vi.getTimerCount()).toBe(1);

            scrollScrollerTo(SCROLL_TO_TOP_THRESHOLD_PX + 1);
            expect(vi.getTimerCount()).toBe(0);

            act(() => {
                vi.advanceTimersByTime(FADE_MS);
            });
            const button = screen.getByTestId('scroll-to-top');
            expect(button.className).toContain('opacity-100');
            expectInteractive(button);
        } finally {
            vi.useRealTimers();
        }
    });

    it('clears the pending fade timer on unmount', () => {
        vi.useFakeTimers();
        try {
            const { unmount } = render(<Harness />);
            scrollScrollerTo(SCROLL_TO_TOP_THRESHOLD_PX + 1);
            scrollScrollerTo(0);
            expect(vi.getTimerCount()).toBe(1);

            unmount();
            expect(vi.getTimerCount()).toBe(0);
        } finally {
            vi.useRealTimers();
        }
    });

    it('click scrolls the region smoothly to the top when matchMedia is undefined', () => {
        render(<Harness />);
        scrollScrollerTo(SCROLL_TO_TOP_THRESHOLD_PX + 1);

        fireEvent.click(screen.getByTestId('scroll-to-top'));

        const scrollToMock = vi.mocked(Element.prototype.scrollTo);
        expect(scrollToMock).toHaveBeenCalledTimes(1);
        expect(scrollToMock).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
        expect(scrollToMock.mock.contexts[0]).toBe(screen.getByTestId('scroller'));
    });

    it('click scrolls instantly under prefers-reduced-motion: reduce', () => {
        vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)', media: query })));
        render(<Harness />);
        scrollScrollerTo(SCROLL_TO_TOP_THRESHOLD_PX + 1);

        fireEvent.click(screen.getByTestId('scroll-to-top'));

        const scrollToMock = vi.mocked(Element.prototype.scrollTo);
        expect(scrollToMock).toHaveBeenCalledTimes(1);
        expect(scrollToMock).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
        expect(scrollToMock.mock.contexts[0]).toBe(screen.getByTestId('scroller'));
    });

    it('click scrolls smoothly when reduced motion is not requested', () => {
        vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: false, media: query })));
        render(<Harness />);
        scrollScrollerTo(SCROLL_TO_TOP_THRESHOLD_PX + 1);

        fireEvent.click(screen.getByTestId('scroll-to-top'));

        const scrollToMock = vi.mocked(Element.prototype.scrollTo);
        expect(scrollToMock).toHaveBeenCalledTimes(1);
        expect(scrollToMock).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
        expect(scrollToMock.mock.contexts[0]).toBe(screen.getByTestId('scroller'));
    });

    it('is absolutely positioned bottom-right with a 44 px touch target, a 500 ms fade and no z-index', () => {
        render(<Harness />);

        const { className } = screen.getByTestId('scroll-to-top');
        for (const token of ['absolute', 'right-4', 'bottom-40', 'rounded-full', 'transition-opacity', 'duration-500', 'min-h-[44px]', 'min-w-[44px]']) {
            expect(className).toContain(token);
        }
        expect(className).not.toMatch(/\bz-/);
    });
});
