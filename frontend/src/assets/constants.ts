import type { Chore } from '@customTypes/SharedTypes';

export type ChoreStatus = 'red' | 'orange' | 'green';

export const STATUS_BAR_COLOR: Record<ChoreStatus, string> = {
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  green: 'bg-green-500',
};

// The last threshold must stay -Infinity so every non-red ratio matches.
export const STATUS_THRESHOLDS: { threshold: number; status: ChoreStatus }[] = [
  { threshold: 0.375, status: 'green' },
  { threshold: -Infinity, status: 'orange' },
];

export const SORT_FOLD = 8;
export const SORT_BASE_QUOTA: Record<ChoreStatus, number> = { red: 4, orange: 2, green: 2 };
export const SORT_PRESSURE_THRESHOLD = 1;
export const SORT_URGENCY_MULTIPLIER: Record<NonNullable<Chore['urgency']>, number> = {
  low: 0.75,
  medium: 1,
  high: 1.5,
};
