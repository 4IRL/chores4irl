import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useChoreSort } from '../../hooks/useChoreSort';
import type { Chore } from '@customTypes/SharedTypes';

// Use local noon dates to avoid timezone-driven day boundary issues
function localNoon(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
}

const makeChore = (id: number, daysAgo: number, duration = 10, frequency = 7): Chore => {
    const d = localNoon('2025-01-15');
    d.setDate(d.getDate() - daysAgo);
    return { id, name: 'C', room: 'K', dateLastCompleted: d, duration, frequency };
};

describe('useChoreSort', () => {
    it('returns chores sorted by score descending', () => {
        const today = localNoon('2025-01-15');
        const low = makeChore(1, 1);   // completed yesterday → low score
        const high = makeChore(2, 10); // completed 10 days ago → high score
        const { result } = renderHook(() => useChoreSort([low, high], today));
        expect(result.current[0].id).toBe(2);
        expect(result.current[1].id).toBe(1);
    });

    it('returns empty array for empty input', () => {
        const { result } = renderHook(() => useChoreSort([], new Date()));
        expect(result.current).toEqual([]);
    });
});
