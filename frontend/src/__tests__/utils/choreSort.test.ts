import { describe, it, expect } from 'vitest';
import type { Chore } from '@customTypes/SharedTypes';
import { calcDurationWeightedScore, orderChores } from '../../utils/choreSort';
import { makeChore, localNoon } from '../fixtures/chore';

describe('calcDurationWeightedScore', () => {
    it('returns 0 when completed today', () => {
        const today = localNoon('2025-01-01');
        const chore = makeChore({ dateLastCompleted: localNoon('2025-01-01') });
        expect(calcDurationWeightedScore(chore, today)).toBe(0);
    });

    it('returns duration * (daysSince / frequency)', () => {
        const today = localNoon('2025-01-08');
        // 7 days since completed, frequency 7 → percentOverdue = 1.0
        const chore = makeChore({ duration: 20, frequency: 7,
            dateLastCompleted: localNoon('2025-01-01') });
        expect(calcDurationWeightedScore(chore, today)).toBe(20);
    });

    it('gives higher score to more overdue chore', () => {
        const today = localNoon('2025-01-15');
        const recent = makeChore({ duration: 10, frequency: 7,
            dateLastCompleted: localNoon('2025-01-12') });
        const overdue = makeChore({ duration: 10, frequency: 7,
            dateLastCompleted: localNoon('2025-01-01') });
        expect(calcDurationWeightedScore(overdue, today))
            .toBeGreaterThan(calcDurationWeightedScore(recent, today));
    });
});

describe('orderChores', () => {
    it('ignores a legacy longTermTask flag and orders purely by descending duration-weighted score', () => {
        const today = localNoon('2025-01-15');
        // weekly: 5/7 * 10 ≈ 7.1; quarterly: 380/90 * 10 ≈ 42.2
        // cast: longTermTask leaves the Chore type in Step 4; keeps this stale-key test compiling
        const weekly = makeChore({ id: 1, duration: 10, frequency: 7,
            dateLastCompleted: localNoon('2025-01-10') });
        const quarterly = { ...makeChore({ id: 2, duration: 10, frequency: 90,
            dateLastCompleted: localNoon('2024-01-01') }), longTermTask: true } as unknown as Chore;
        expect(orderChores([weekly, quarterly], today).map(c => c.id)).toEqual([2, 1]);
    });

    it('sorts by descending score', () => {
        const today = localNoon('2025-01-15');
        const leastOverdue = makeChore({ id: 1, duration: 10, frequency: 7,
            dateLastCompleted: localNoon('2025-01-12') });
        const mostOverdue = makeChore({ id: 2, duration: 10, frequency: 7,
            dateLastCompleted: localNoon('2025-01-01') });
        const result = orderChores([leastOverdue, mostOverdue], today);
        expect(result[0].id).toBe(2);
        expect(result[1].id).toBe(1);
    });

    it('returns empty array for empty input', () => {
        expect(orderChores([], new Date())).toEqual([]);
    });
});
