import { describe, it, expect } from 'vitest';

// Pure math extracted from ChoreTimerBar.tsx — tested without React rendering.
function computeBar(daysSince: number, frequency: number) {
    const isOverdue = daysSince > frequency;
    const remainingRatio = (frequency - daysSince) / frequency;

    let barWidth: number;
    let isUrgent = false;
    if (!isOverdue) {
        barWidth = Math.max(remainingRatio, 0) * 100;
    } else {
        const daysOverdue = daysSince - frequency;
        const growthRatio = (daysOverdue * 2) / frequency;
        barWidth = Math.min(growthRatio, 1) * 100;
        isUrgent = growthRatio >= 1;
    }

    // Color logic mirrors getStatusColor in ChoreTimerBar.tsx
    let barColor: string;
    if (isOverdue) {
        barColor = 'bg-red-500 bg-opacity-50';
    } else if (remainingRatio > 0.5) {
        barColor = 'bg-green-500 bg-opacity-50';
    } else if (remainingRatio > 0.25) {
        barColor = 'bg-orange-500 bg-opacity-50';
    } else {
        barColor = 'bg-red-500 bg-opacity-50';
    }

    return { barWidth, barColor, isUrgent };
}

describe('ChoreTimerBar bar math', () => {
    it('day 0 of a 10-day chore → barWidth = 100, green, not urgent', () => {
        const result = computeBar(0, 10);
        expect(result.barWidth).toBe(100);
        expect(result.barColor).toContain('green');
        expect(result.isUrgent).toBe(false);
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

    it('2 days overdue on a 10-day chore → barWidth = 40, red, not urgent', () => {
        const result = computeBar(12, 10);
        expect(result.barWidth).toBe(40);
        expect(result.barColor).toContain('red');
        expect(result.isUrgent).toBe(false);
    });

    it('5 days overdue on a 10-day chore → barWidth = 100, red, urgent', () => {
        const result = computeBar(15, 10);
        expect(result.barWidth).toBe(100);
        expect(result.barColor).toContain('red');
        expect(result.isUrgent).toBe(true);
    });
});
