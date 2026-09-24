import { useRef } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import OverlayScrollbar, {
    THUMB_WIDTH_PX,
    THUMB_EDGE_INSET_PX,
    FADE_IN_MS,
    FADE_OUT_MS,
} from '../../components/common/OverlayScrollbar';
import { IDLE_FADE_MS } from '../../hooks/useScrollIndicator';

type HarnessProps = { trackInsetTopPx?: number; trackInsetBottomPx?: number };

// Renders the scroller before the thumb so the ref is attached by the time
// the thumb's effects run, mirroring App.
function Harness(props: HarnessProps) {
    const ref = useRef<HTMLDivElement>(null);
    return (
        <>
            <div data-testid="scroller" ref={ref} />
            <OverlayScrollbar
                scrollRegionRef={ref}
                trackInsetTopPx={props.trackInsetTopPx}
                trackInsetBottomPx={props.trackInsetBottomPx}
            />
        </>
    );
}

// jsdom has no layout: stub the read-only metrics before rendering, since the
// hook measures on mount and on scroll only (no ResizeObserver in jsdom).
function stubMetrics(scrollHeight: number, clientHeight: number) {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(scrollHeight);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(clientHeight);
}

function scrollScrollerTo(scrollTop: number) {
    const scroller = screen.getByTestId('scroller');
    scroller.scrollTop = scrollTop;
    fireEvent.scroll(scroller);
}

describe('OverlayScrollbar (F22)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders nothing when the region is not scrollable', () => {
        stubMetrics(400, 400);
        render(<Harness />);

        expect(screen.queryByTestId('overlay-scrollbar')).toBeNull();
    });

    it('renders a hidden, non-interactive, z-index-free thumb with inline px geometry on mount', () => {
        stubMetrics(1000, 400);
        render(<Harness />);

        const thumb = screen.getByTestId('overlay-scrollbar');
        expect(thumb).toHaveAttribute('aria-hidden', 'true');
        expect(thumb).not.toHaveAttribute('role');
        for (const token of ['pointer-events-none', 'absolute', 'rounded-full', 'bg-gray-300/50', 'transition-opacity', 'motion-reduce:transition-none', 'opacity-0', 'duration-400']) {
            expect(thumb.className).toContain(token);
        }
        expect(thumb.className).not.toMatch(/\bz-/);
        expect(thumb.className).not.toContain('bg-gray-800');
        expect(thumb.style.height).toBe('160px');
        expect(thumb.style.top).toBe('0px');
        expect(thumb.style.width).toBe(`${THUMB_WIDTH_PX}px`);
        expect(thumb.style.right).toBe(`${THUMB_EDGE_INSET_PX}px`);
    });

    it('shows on scroll, tracks scrollTop, and fades out after IDLE_FADE_MS', () => {
        vi.useFakeTimers();
        try {
            stubMetrics(1000, 400);
            render(<Harness />);

            scrollScrollerTo(300);
            const thumb = screen.getByTestId('overlay-scrollbar');
            expect(thumb.className).toContain('opacity-100');
            expect(thumb.className).toContain('duration-150');
            expect(thumb.style.top).toBe('120px');

            act(() => {
                vi.advanceTimersByTime(IDLE_FADE_MS);
            });
            expect(thumb.className).toContain('opacity-0');
            expect(thumb.className).toContain('duration-400');
            expect(thumb.className).not.toContain('opacity-100');
        } finally {
            vi.useRealTimers();
        }
    });

    it('applies symmetric track insets (form-shaped)', () => {
        stubMetrics(1000, 400);
        render(<Harness trackInsetTopPx={12} trackInsetBottomPx={12} />);

        const thumb = screen.getByTestId('overlay-scrollbar');
        expect(thumb.style.top).toBe('12px');
        expect(thumb.style.height).toBe('150.4px');
    });

    it('stops the track at a bottom inset (list-shaped)', () => {
        stubMetrics(1000, 400);
        render(<Harness trackInsetBottomPx={160} />);

        const thumb = screen.getByTestId('overlay-scrollbar');
        expect(thumb.style.height).toBe('96px');
        expect(thumb.style.top).toBe('0px');

        scrollScrollerTo(600);
        expect(thumb.style.top).toBe('144px');
    });

    it('pins the fade constants to the duration class literals', () => {
        expect(FADE_IN_MS).toBe(150);
        expect(FADE_OUT_MS).toBe(400);
    });
});
