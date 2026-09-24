import type { RefObject } from 'react';
import { useScrollIndicator } from '../../hooks/useScrollIndicator';

/** Thumb width in px (inline style). */
export const THUMB_WIDTH_PX = 4;

/** Gap in px between the thumb and the frame's right edge (inline style). */
export const THUMB_EDGE_INSET_PX = 2;

/** Fade-in length in ms; must equal the `duration-150` class in VISIBLE_CLASSES. */
export const FADE_IN_MS = 150;

/** Fade-out length in ms; must equal the `duration-400` class in HIDDEN_CLASSES. */
export const FADE_OUT_MS = 400;

// Tailwind needs literal class strings, so the fade durations live here as
// classes and FADE_IN_MS / FADE_OUT_MS document them.
const VISIBLE_CLASSES = 'opacity-100 duration-150';
const HIDDEN_CLASSES = 'opacity-0 duration-400';

type OverlayScrollbarProps = {
    scrollRegionRef: RefObject<HTMLElement | null>;
    trackInsetTopPx?: number;
    trackInsetBottomPx?: number;
};

// Indicator-only overlay thumb for a scroller whose native scrollbar is hidden
// (.scrollbar-none). Render it in a positioned frame beside (never inside) the
// scroller, after it in the DOM: with no z-index it paints above the scroller
// by DOM order. It starts at opacity-0, so mounting causes no flash; it shows
// only on a scroll event and fades after the hook's idle timeout. It is never
// bg-gray-800, because e2e locates chore bars by `.bg-gray-800.rounded-full`.
export default function OverlayScrollbar({ scrollRegionRef, trackInsetTopPx = 0, trackInsetBottomPx = 0 }: OverlayScrollbarProps) {
    const { geometry, isVisible } = useScrollIndicator(scrollRegionRef, trackInsetTopPx, trackInsetBottomPx);
    if (geometry === null) return null;

    return (
        <div
            data-testid="overlay-scrollbar"
            aria-hidden="true"
            className={`pointer-events-none absolute rounded-full bg-gray-300/50 transition-opacity motion-reduce:transition-none ${isVisible ? VISIBLE_CLASSES : HIDDEN_CLASSES}`}
            style={{ top: geometry.top, height: geometry.height, width: THUMB_WIDTH_PX, right: THUMB_EDGE_INSET_PX }}
        />
    );
}
