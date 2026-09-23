import type { Chore } from '@customTypes/SharedTypes';

export type ChoreStatus = 'red' | 'orange' | 'green';

type StatusColor = { threshold: number; status: Exclude<ChoreStatus, 'red'> };

// The single status → bar-fill map. Bare colour, with no opacity utility baked in
// (same rule as BarMathResult.barColor — the renderer applies opacity itself).
export const STATUS_BAR_COLOR: Record<ChoreStatus, string> = {
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    green: 'bg-green-500',
};

// Thresholds are minimum remaining-ratio values (exclusive lower bound).
// Listed descending so the first match wins. Red is deliberately absent: it is
// reserved for overdue chores and applied directly in classifyStatus
// (utils/choreBarMath.ts), so a chore that is merely due (remainingRatio === 0)
// stays orange.
// Invariant: the last entry's threshold must stay -Infinity — classifyStatus's
// `?? statusColors[statusColors.length - 1]` fallback relies on it always
// matching. Removing it, or changing its value away from -Infinity, lets
// `.find()` return undefined for low ratios and the fallback silently pick
// whatever entry is now last.
export const statusColors: StatusColor[] = [
    { threshold: 0.375,     status: 'green' },  // remainingRatio > 0.375
    { threshold: -Infinity, status: 'orange' }, // remainingRatio ≤ 0.375, not yet overdue
];

// Sort tunables for orderChores (F16) — first guesses; re-tune on the Pi via the
// day simulator and record the final values here.

// Chores visible above the fold on the kiosk (≈ one unscrolled screen of h-20 bars).
export const SORT_FOLD = 8;
// Base fold split per status; must sum to SORT_FOLD.
export const SORT_BASE_QUOTA: Record<ChoreStatus, number> = { red: 4, orange: 2, green: 2 };
// A red chore counts toward escalation pressure once its urgency-weighted
// overdueRatio reaches this (1 = at least 2× its frequency has elapsed).
export const SORT_PRESSURE_THRESHOLD = 1;
// Sort-only weighting of a red chore's overdueRatio (bar colour ignores urgency); unset urgency uses `medium`.
export const SORT_URGENCY_MULTIPLIER: Record<NonNullable<Chore['urgency']>, number> = { low: 0.75, medium: 1, high: 1.5 };
