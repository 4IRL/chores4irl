import { useMemo } from 'react';
import type { Chore } from '@customTypes/SharedTypes';
import { orderChores } from '../utils/choreSort';

export function useChoreSort(chores: Chore[], day: Date): Chore[] {
    return useMemo(() => orderChores(chores, day), [chores, day]);
}
