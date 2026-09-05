type StatusColor = { threshold: number; color: string };

// Thresholds are minimum remaining-ratio values (exclusive lower bound).
// Listed descending so the first match wins. Red is deliberately absent: it is
// reserved for overdue chores and applied directly in computeBar, so a chore
// that is merely due (remainingRatio === 0) stays orange.
// Invariant: the last entry's threshold must stay -Infinity — computeBar's
// `?? statusColors[statusColors.length - 1]` fallback relies on it always
// matching. Removing it, or changing its value away from -Infinity, lets
// `.find()` return undefined for low ratios and the fallback silently pick
// whatever entry is now last.
export const statusColors: StatusColor[] = [
    { threshold: 0.375,     color: 'bg-green-500' },  // remainingRatio > 0.375
    { threshold: -Infinity, color: 'bg-orange-500' }, // remainingRatio ≤ 0.375, not yet overdue
];
