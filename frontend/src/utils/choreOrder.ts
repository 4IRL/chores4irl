import type { Chore } from '@customTypes/SharedTypes';
import { orderChores } from './choreSort';

/** Ordered chore ids for the full list, as `orderChores` would produce them. */
export function snapshotOrder(chores: Chore[], today: Date, timezone: string): number[] {
  return orderChores(chores, today, timezone).map((c) => c.id);
}

/**
 * Sorts chores by their index in `sortedIds`; chores not in `sortedIds` follow,
 * keeping input order. Returns a new array and never drops or duplicates chores.
 */
export function applyOrder<T extends { id: number }>(chores: T[], sortedIds: number[]): T[] {
  const indexById = new Map<number, number>();
  sortedIds.forEach((id, index) => {
    if (!indexById.has(id)) indexById.set(id, index);
  });
  const known: [number, T][] = [];
  const unknown: T[] = [];
  for (const chore of chores) {
    const index = indexById.get(chore.id);
    if (index !== undefined) known.push([index, chore]);
    else unknown.push(chore);
  }
  known.sort((a, b) => a[0] - b[0]);
  return [...known.map(([, chore]) => chore), ...unknown];
}
