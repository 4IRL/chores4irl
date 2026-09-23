import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import { ArrowUp } from 'lucide-react';
import { useScrollPastThreshold } from '../../hooks/useScrollPastThreshold';

/** Scroll distance (px) past which the button shows: one `h-20` chore bar. */
export const SCROLL_TO_TOP_THRESHOLD_PX = 80;

/** Opacity fade length in ms; must equal the `duration-500` class on the button. The button stays tappable until a fade-out of this length has ended. */
export const FADE_MS = 500;

// bottom-40 (10 rem) = the F5 deck's ~5 rem footprint (py-4 + the 44 px
// button ≈ 81 px) + its 4 rem -top-16 frosted overhang: the same 10 rem that
// scroll-pb-40 declares and Toast uses (Standing invariants 12 & 14). right-4
// is 1 rem in from the frame's right edge; the frame currently sits inside the
// column's px-4, so today the button rests 1 rem inside the bars' right edge
// (2 rem from the screen). Once F22 makes the frame full-bleed it lands 1 rem
// from the screen edge, aligned with the bars' re-applied inset, with no F22
// change needed. Tailwind needs literal class strings, so this constant is the
// class string, not a number.
const OFFSET_CLASSES = 'bottom-40 right-4';

type ScrollToTopButtonProps = {
    scrollRegionRef: RefObject<HTMLDivElement | null>;
};

export default function ScrollToTopButton({ scrollRegionRef }: ScrollToTopButtonProps) {
    const isVisible = useScrollPastThreshold(scrollRegionRef, SCROLL_TO_TOP_THRESHOLD_PX);

    // Two-phase visibility: `isVisible` drives the opacity at once, while the
    // non-interactive state (pointer-events-none, inert, aria-hidden,
    // tabIndex -1) lands only after the FADE_MS fade-out. A tap on the
    // still-visible, fading button therefore hits the button (a harmless
    // second scroll-to-top) instead of falling through to, and completing,
    // the chore bar beneath. Starts false: the boot view (scrollTop 0) has no
    // fade, so it has no tappable window.
    const [isInteractive, setIsInteractive] = useState(false);
    useEffect(() => {
        if (isVisible) {
            setIsInteractive(true);
            return;
        }
        const timer = setTimeout(() => setIsInteractive(false), FADE_MS);
        return () => clearTimeout(timer);
    }, [isVisible]);

    const handleClick = () => {
        const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        scrollRegionRef.current?.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    };

    // Positioned against the scroll region's frame, never inside
    // .overflow-y-auto; no z-index (later in DOM than the scroller, so it
    // paints above it). inert once non-interactive drops focus from a
    // just-tapped button and blocks keyboard activation. duration-500 ≈
    // Chromium's smooth-scroll duration for a long list; visibility flips
    // only when the scroll crosses 80 px near its end, so the fade-out trails
    // the scroll by up to ~0.5 s. The fade is kept under reduced motion; only
    // the scroll becomes instant.
    return (
        <button
            type="button"
            data-testid="scroll-to-top"
            aria-label="Scroll to top"
            aria-hidden={isInteractive ? undefined : true}
            tabIndex={isInteractive ? 0 : -1}
            inert={!isInteractive}
            onClick={handleClick}
            className={`absolute ${OFFSET_CLASSES} flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-gray-700/70 text-white shadow-lg transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}${isInteractive ? '' : ' pointer-events-none'}`}
        >
            <ArrowUp className="w-5 h-5" aria-hidden="true" />
        </button>
    );
}
