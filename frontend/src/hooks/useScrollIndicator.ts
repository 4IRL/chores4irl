import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

/** How long the thumb stays visible after the last `scroll` event before it fades out. */
export const IDLE_FADE_MS = 1000;

/** Smallest thumb height, so a very long list still shows a grabbable-looking indicator (never taller than its track). */
export const MIN_THUMB_PX = 24;

export type ThumbGeometry = { height: number; top: number };

/**
 * Thumb height and top offset (px, relative to the scroller's box) for an overlay scrollbar whose
 * track is the scroller's height minus `trackInsetTopPx` and `trackInsetBottomPx`. Returns `null`
 * when the element does not overflow or the track has no room.
 */
export function computeThumbGeometry(
    scrollTop: number,
    scrollHeight: number,
    clientHeight: number,
    trackInsetTopPx = 0,
    trackInsetBottomPx = 0,
): ThumbGeometry | null {
    const track = clientHeight - trackInsetTopPx - trackInsetBottomPx;
    if (scrollHeight <= clientHeight || track <= 0) return null;
    // The track bound wins over MIN_THUMB_PX, so the thumb never leaves its track.
    const height = Math.min(Math.max((track * clientHeight) / scrollHeight, MIN_THUMB_PX), track);
    const scrollRatio = Math.min(Math.max(scrollTop / (scrollHeight - clientHeight), 0), 1);
    return { height, top: trackInsetTopPx + scrollRatio * (track - height) };
}

function sameGeometry(previous: ThumbGeometry | null, next: ThumbGeometry | null): boolean {
    if (previous === null || next === null) return previous === next;
    return previous.height === next.height && previous.top === next.top;
}

/**
 * Overlay-scrollbar state for `ref.current`: the thumb geometry (re-measured on mount, on every
 * `scroll` and, where `ResizeObserver` exists, whenever the scroller or one of its children present
 * at attach time resizes) and whether the thumb is showing. It shows only on `scroll` (never on
 * mount) and hides `IDLE_FADE_MS` after the last scroll event. The element must be mounted by the
 * time the caller's effects run (render the caller alongside, after, the scroller).
 */
export function useScrollIndicator(
    ref: RefObject<HTMLElement | null>,
    trackInsetTopPx = 0,
    trackInsetBottomPx = 0,
): { geometry: ThumbGeometry | null; isVisible: boolean } {
    const [geometry, setGeometry] = useState<ThumbGeometry | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const scrollElement = ref.current;
        if (!scrollElement) {
            setGeometry(null);
            return;
        }

        const measure = () => {
            const next = computeThumbGeometry(
                scrollElement.scrollTop,
                scrollElement.scrollHeight,
                scrollElement.clientHeight,
                trackInsetTopPx,
                trackInsetBottomPx,
            );
            setGeometry((previous) => (sameGeometry(previous, next) ? previous : next));
        };
        measure();

        let idleTimer: ReturnType<typeof setTimeout> | undefined;
        const onScroll = () => {
            measure();
            setIsVisible(true);
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => setIsVisible(false), IDLE_FADE_MS);
        };
        scrollElement.addEventListener('scroll', onScroll, { passive: true });

        // jsdom (and very old browsers) lack ResizeObserver; geometry then updates on scroll only.
        let resizeObserver: ResizeObserver | undefined;
        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(measure);
            resizeObserver.observe(scrollElement);
            for (const child of Array.from(scrollElement.children)) resizeObserver.observe(child);
        }

        return () => {
            scrollElement.removeEventListener('scroll', onScroll);
            clearTimeout(idleTimer);
            resizeObserver?.disconnect();
        };
    }, [ref, trackInsetTopPx, trackInsetBottomPx]);

    return { geometry, isVisible };
}
