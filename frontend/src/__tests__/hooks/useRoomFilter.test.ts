import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRoomFilter } from '../../hooks/useRoomFilter';
import type { Chore } from '@customTypes/SharedTypes';

const makeChore = (id: number, room: string): Chore => ({
    id, name: 'Test', room,
    dateLastCompleted: new Date('2025-01-01T00:00:00.000Z'),
    duration: 10, frequency: 7,
});

const chores = [makeChore(1, 'Kitchen'), makeChore(2, 'Bedroom'), makeChore(3, 'Kitchen')];

describe('useRoomFilter', () => {
    it('returns all chores when selectedRoom is "all"', () => {
        const { result } = renderHook(() => useRoomFilter(chores, 'all'));
        expect(result.current).toHaveLength(3);
    });

    it('filters to matching room', () => {
        const { result } = renderHook(() => useRoomFilter(chores, 'Kitchen'));
        expect(result.current).toHaveLength(2);
        expect(result.current.every(c => c.room === 'Kitchen')).toBe(true);
    });

    it('returns empty array when no chores match', () => {
        const { result } = renderHook(() => useRoomFilter(chores, 'Basement'));
        expect(result.current).toHaveLength(0);
    });
});
