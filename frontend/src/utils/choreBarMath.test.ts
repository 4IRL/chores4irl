import { describe, it, expect } from 'vitest';
import { computeBar } from './choreBarMath';

describe('computeBar', () => {
  it('returns bg-green-500 when more than half the time remains', () => {
    expect(computeBar(1, 10).barColor).toBe('bg-green-500');
  });

  it('returns bg-yellow-500 when between 20% and 50% remains', () => {
    expect(computeBar(6, 10).barColor).toBe('bg-yellow-500');
  });

  it('returns bg-orange-500 when under 20% remains but not overdue', () => {
    expect(computeBar(9, 10).barColor).toBe('bg-orange-500');
  });

  it('returns bg-red-500 when overdue', () => {
    const result = computeBar(12, 10);
    expect(result.isOverdue).toBe(true);
    expect(result.barColor).toBe('bg-red-500');
  });

  it('returns bg-yellow-500 when exactly 50% remains', () => {
    expect(computeBar(5, 10).barColor).toBe('bg-yellow-500');
  });

  it('returns bg-orange-500 when exactly 20% remains', () => {
    expect(computeBar(8, 10).barColor).toBe('bg-orange-500');
  });

  it('is not overdue on the due day (daysSince === frequency) and has no bar left', () => {
    const result = computeBar(10, 10);
    expect(result.isOverdue).toBe(false);
    expect(result.barWidth).toBe(0);
    expect(result.barColor).toBe('bg-red-500');
  });

  it('returns bg-green-500 with full width when frequency is 0', () => {
    const result = computeBar(5, 0);
    expect(result.barColor).toBe('bg-green-500');
    expect(result.barWidth).toBe(100);
  });
});
