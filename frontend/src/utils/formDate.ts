import { format, parse } from 'date-fns';

const FORM_DATE_PATTERN = 'yyyy-MM-dd';

/**
 * Local midnight of the calendar day an <input type="date"> holds ('yyyy-MM-dd').
 * Never new Date(str): ECMAScript parses the date-only form as UTC midnight, which is
 * the previous local day anywhere behind UTC.
 */
export function parseFormDate(value: string): Date {
    return parse(value, FORM_DATE_PATTERN, new Date());
}

/**
 * Local calendar date of an instant, in the form an <input type="date"> accepts.
 * Never toISOString().slice(0, 10): that is the UTC date, a day off for evening instants.
 */
export function formatFormDate(date: Date): string {
    return format(date, FORM_DATE_PATTERN);
}
