import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { prefersReducedMotion } from '@utils/prefersReducedMotion';

const FADE_MS = 500;

interface ScrollToTopButtonProps {
  visible: boolean;
  onActivate: () => void;
  onRelinquishFocus?: () => void;
}

export default function ScrollToTopButton({
  visible,
  onActivate,
  onRelinquishFocus,
}: ScrollToTopButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const [fadedIn, setFadedIn] = useState(false);
  // Derive-during-render reset (React-supported): losing `visible` is non-interactive at once.
  if (!visible && fadedIn) setFadedIn(false);
  const reduceMotion = prefersReducedMotion();
  const interactive = visible && (fadedIn || reduceMotion);

  // Layout effect: runs right after the DOM commit that turned `visible` false, before the
  // browser's focus fixup drops focus from the now inert/hidden button, so focus is detectable.
  useLayoutEffect(() => {
    if (visible) return;
    if (document.activeElement === buttonRef.current) onRelinquishFocus?.();
  }, [visible, onRelinquishFocus]);

  useEffect(() => {
    if (!visible || reduceMotion) return;
    const timer = setTimeout(() => setFadedIn(true), FADE_MS);
    return () => clearTimeout(timer);
  }, [visible, reduceMotion]);

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label="Scroll to top"
      title="Scroll to top"
      onClick={interactive ? onActivate : undefined}
      tabIndex={interactive ? undefined : -1}
      aria-hidden={interactive ? undefined : true}
      inert={!interactive}
      className={`fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 h-11 w-11 rounded-full bg-gray-700 border border-gray-600 text-white flex items-center justify-center transition-[opacity,visibility] duration-500 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-indigo-400 ${
        visible ? 'opacity-100 visible' : 'opacity-0 invisible'
      } ${interactive ? 'pointer-events-auto' : 'pointer-events-none'}`}
    >
      <ArrowUp size={20} aria-hidden="true" />
    </button>
  );
}
