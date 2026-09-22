import { describe, it, expect } from 'vitest';
import { formatFormDate, parseFormDate } from '@utils/formDate';

// These hold in any zone — both helpers work in local time — so no TZ pinning here.
describe('formDate helpers (F21)', () => {
    it('parseFormDate returns local midnight of the typed day', () => {
        expect(parseFormDate('2025-03-31')).toEqual(new Date(2025, 2, 31));
    });

    it('formatFormDate returns the local calendar date of an evening instant', () => {
        expect(formatFormDate(new Date(2025, 2, 31, 23, 59))).toBe('2025-03-31');
    });

    it('round-trips a form value through parse and format', () => {
        expect(formatFormDate(parseFormDate('2025-03-31'))).toBe('2025-03-31');
    });

    it('parseFormDate of an empty string is Invalid Date (the field stays required)', () => {
        expect(Number.isNaN(parseFormDate('').getTime())).toBe(true);
    });
});
