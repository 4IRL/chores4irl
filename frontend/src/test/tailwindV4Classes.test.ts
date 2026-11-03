import { describe, it, expect } from 'vitest';

const V3_OPACITY = /\b(bg|text|border|ring|divide|placeholder)-opacity-[\d[]/;

// Every non-test source file under frontend/src, loaded as raw text.
const sources = import.meta.glob(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('Tailwind v4 class guard', () => {
  it('scans source files', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(10);
  });

  it('has no Tailwind v3-only *-opacity-N utilities in frontend/src', () => {
    const offenders: string[] = [];
    for (const [file, text] of Object.entries(sources)) {
      const match = V3_OPACITY.exec(text);
      if (match) offenders.push(`${file}: ${match[0]}`);
    }
    expect(offenders).toEqual([]);
  });
});
