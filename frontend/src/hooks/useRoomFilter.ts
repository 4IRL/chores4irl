import { useMemo } from 'react';
import type { Chore } from '@customTypes/SharedTypes';

export function useRoomFilter(chores: Chore[], selectedRoom: string): Chore[] {
    return useMemo(() => {
        if (selectedRoom === 'all') return chores;
        return chores.filter(c => c.room === selectedRoom);
    }, [chores, selectedRoom]);
}
