import { describe, it, expect } from 'vitest';
import { calcDurationWeightedScore, orderChores } from '../../utils/choreSort';
import type { Chore } from '@customTypes/SharedTypes';

const makeChore = (overrides: Partial<Chore> = {}): Chore => ({
    id: 1,
    name: 'Test',
    room: 'Kitchen',
    dateLastCompleted: new Date('2025-01-01T00:00:00.000Z'),
    duration: 10,
    frequency: 7,
    ...overrides,
});

// Helper to create a local noon date for a given YYYY-MM-DD string (avoids DST edge cases)
function localNoon(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
}

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
    it('separates short-term from long-term chores', () => {
        const today = localNoon('2025-01-15');
        const shortTerm = makeChore({ id: 1, longTermTask: undefined,
            dateLastCompleted: localNoon('2025-01-01') });
        const longTerm = makeChore({ id: 2, longTermTask: true,
            dateLastCompleted: localNoon('2024-01-01') });
        const result = orderChores([longTerm, shortTerm], today);
        // short-term should come first regardless of score
        expect(result[0].id).toBe(1);
        expect(result[1].id).toBe(2);
    });

    it('sorts within each group by descending score', () => {
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
