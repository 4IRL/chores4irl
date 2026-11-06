import { describe, it, expect } from 'vitest';
import { classifyStatus, computeBar } from './choreBarMath';

describe('classifyStatus', () => {
  it('is orange at exactly 0.375 remaining', () => {
    expect(classifyStatus(5, 8)).toBe('orange');
  });

  it('is green just above 0.375 remaining', () => {
    expect(classifyStatus(624, 1000)).toBe('green');
  });

  it('is orange on the due day', () => {
    expect(classifyStatus(10, 10)).toBe('orange');
  });

  it('is red one day over', () => {
    expect(classifyStatus(11, 10)).toBe('red');
  });

  it('is green for frequency 0 at any daysSince', () => {
    expect(classifyStatus(0, 0)).toBe('green');
    expect(classifyStatus(100, 0)).toBe('green');
  });
});

describe('computeBar', () => {
  it('returns bg-green-500 when plenty of time remains', () => {
    expect(computeBar(1, 10).barColor).toBe('bg-green-500');
  });

  it('returns bg-green-500 when remaining ratio is 0.4 (above 0.375)', () => {
    expect(computeBar(6, 10).barColor).toBe('bg-green-500');
  });

  it('returns bg-green-500 when remaining ratio is just above 0.375', () => {
    expect(computeBar(624, 1000).barColor).toBe('bg-green-500');
  });

  it('returns bg-orange-500 when remaining ratio is exactly 0.375', () => {
    expect(computeBar(5, 8).barColor).toBe('bg-orange-500');
  });

  it('returns bg-orange-500 when little time remains but not overdue', () => {
    expect(computeBar(9, 10).barColor).toBe('bg-orange-500');
  });

  it('returns bg-red-500 when overdue', () => {
    const result = computeBar(12, 10);
    expect(result.isOverdue).toBe(true);
    expect(result.barColor).toBe('bg-red-500');
  });

  it('is orange (not red) and empty on the due day (daysSince === frequency)', () => {
    const result = computeBar(10, 10);
    expect(result.isOverdue).toBe(false);
    expect(result.barWidth).toBe(0);
    expect(result.barColor).toBe('bg-orange-500');
  });

  it('is red with width 20 the day after the due date', () => {
    const result = computeBar(11, 10);
    expect(result.isOverdue).toBe(true);
    expect(result.barColor).toBe('bg-red-500');
    expect(result.barWidth).toBe(20);
  });

  it('returns bg-green-500 with full width when frequency is 0', () => {
    const result = computeBar(5, 0);
    expect(result.barColor).toBe('bg-green-500');
    expect(result.barWidth).toBe(100);
  });
});
