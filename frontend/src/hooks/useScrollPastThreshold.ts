import { useEffect, useState } from 'react';

export function useScrollPastThreshold(threshold = 80): boolean {
  const [past, setPast] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : window.scrollY > threshold,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // setState bails out when the boolean is unchanged, so scrolls that do not
    // cross the threshold cause no re-render.
    const update = () => setPast(window.scrollY > threshold);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [threshold]);

  return past;
}
