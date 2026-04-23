import { describe, it, expect } from 'vitest';
import { computeBar } from '@utils/choreBarMath';

describe('ChoreTimerBar bar math', () => {
    it('day 0 of a 10-day chore → barWidth = 100, green', () => {
        const result = computeBar(0, 10);
        expect(result.barWidth).toBe(100);
        expect(result.barColor).toContain('green');
    });

    it('day 3 of a 10-day chore → barWidth ≈ 70, green', () => {
        const result = computeBar(3, 10);
        expect(result.barWidth).toBeCloseTo(70);
        expect(result.barColor).toContain('green');
    });

    it('day 5 of a 10-day chore → barWidth = 50, orange', () => {
        const result = computeBar(5, 10);
        expect(result.barWidth).toBe(50);
        expect(result.barColor).toContain('orange');
    });

    it('day 9 of a 10-day chore → barWidth = 10, red (pre-due)', () => {
        const result = computeBar(9, 10);
        expect(result.barWidth).toBe(10);
        expect(result.barColor).toContain('red');
    });

    it('2 days overdue on a 10-day chore (daysSince=12) → barWidth = 40, red, overdue', () => {
        const result = computeBar(12, 10);
        expect(result.barWidth).toBe(40);
        expect(result.barColor).toContain('red');
        expect(result.isOverdue).toBe(true);
    });

    it('4 days overdue on a 10-day chore (daysSince=14) → barWidth = 80, red, overdue', () => {
        const result = computeBar(14, 10);
        expect(result.barWidth).toBeCloseTo(80);
        expect(result.barColor).toContain('red');
    });

    it('5 days overdue on a 10-day chore → barWidth = 100, red, overdue', () => {
        const result = computeBar(15, 10);
        expect(result.barWidth).toBe(100);
        expect(result.barColor).toContain('red');
    });

    it('daysSince === frequency → barWidth = 0, red', () => {
        const result = computeBar(10, 10);
        expect(result.barWidth).toBe(0);
        expect(result.barColor).toContain('red');
        expect(result.isOverdue).toBe(false);
    });

    it('frequency=0 → barWidth = 100, green', () => {
        const result = computeBar(5, 0);
        expect(result.barWidth).toBe(100);
        expect(result.barColor).toContain('green');
    });
});
