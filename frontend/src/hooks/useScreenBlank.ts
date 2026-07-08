import { set, addDays, isBefore } from 'date-fns';

export const BLANK_START_HOUR = 21;
export const BLANK_END_HOUR = 6;

export function isWithinBlankWindow(date: Date): boolean {
    const hour = date.getHours();
    return hour >= BLANK_START_HOUR || hour < BLANK_END_HOUR;
}

export function nextBoundary(date: Date): Date {
    const todayEnd = set(date, { hours: BLANK_END_HOUR, minutes: 0, seconds: 0, milliseconds: 0 });
    const todayStart = set(date, { hours: BLANK_START_HOUR, minutes: 0, seconds: 0, milliseconds: 0 });
    if (isBefore(date, todayEnd)) return todayEnd;
    if (isBefore(date, todayStart)) return todayStart;
    return addDays(todayEnd, 1);
}
