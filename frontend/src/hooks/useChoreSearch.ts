import { useMemo } from 'react';
import type { Chore } from '@customTypes/SharedTypes';

export function useChoreSearch(chores: Chore[], query: string): Chore[] {
  const needle = query.trim().toLowerCase();
  return useMemo(() => {
    if (needle === '') return chores;
    return chores.filter((c) => c.name.toLowerCase().includes(needle));
  }, [chores, needle]);
}
