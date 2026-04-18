type StatusColor = { threshold: number; color: string };

// Thresholds are minimum remaining-ratio values (exclusive lower bound).
// Listed descending so the first match wins.
export const statusColors: StatusColor[] = [
    { threshold: 0.5,       color: 'bg-green-500' },  // remainingRatio > 0.5
    { threshold: 0.25,      color: 'bg-orange-500' }, // remainingRatio > 0.25
    { threshold: -Infinity, color: 'bg-red-500' },    // remainingRatio ≤ 0.25 (fallback)
];
