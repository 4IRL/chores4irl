import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

/** True while `ref.current.scrollTop` is strictly greater than `thresholdPx`. The element must be mounted by the time the caller's effects run (render the caller alongside, after, the scroller). */
export function useScrollPastThreshold(ref: RefObject<HTMLElement | null>, thresholdPx: number): boolean {
    const [isPast, setIsPast] = useState(false);

    useEffect(() => {
        const scrollElement = ref.current;
        if (!scrollElement) {
            setIsPast(false);
            return;
        }
        const update = () => setIsPast(scrollElement.scrollTop > thresholdPx);
        update();
        scrollElement.addEventListener('scroll', update, { passive: true });
        return () => scrollElement.removeEventListener('scroll', update);
    }, [ref, thresholdPx]);

    return isPast;
}
