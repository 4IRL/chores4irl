type StatusColor = { threshold: number; color: string };

// Thresholds are minimum remaining-ratio values (exclusive lower bound).
// Listed descending so the first match wins. Red is deliberately absent: it is
// reserved for overdue chores and applied directly in computeBar, so a chore
// that is merely due (remainingRatio === 0) stays orange.
export const statusColors: StatusColor[] = [
    { threshold: 0.375,     color: 'bg-green-500' },  // remainingRatio > 0.375
    { threshold: -Infinity, color: 'bg-orange-500' }, // remainingRatio ≤ 0.375, not yet overdue
];
