import { describe, it, expect } from 'vitest';
import { androidSwipeThreshold } from './swipeThreshold';

describe('androidSwipeThreshold', () => {
  it.each([0, -5, NaN, Infinity])('falls back to 120 for %s', (width) => {
    expect(androidSwipeThreshold(width)).toBe(120);
  });

  it.each([
    [200, 50],
    [480, 120],
    [1024, 120],
  ])('width %i gives %i', (width, expected) => {
    expect(androidSwipeThreshold(width)).toBe(expected);
  });
});
