import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

// The chore form's `yyyy-MM-dd` value must be read and written in the
// household's timezone, the same zone the timer bar and sort count days in
// (see `daysSinceInZone`). Using UTC or the viewer's device zone would shift
// the day for households away from that zone.
export function formatFormDate(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
}

export function parseFormDate(value: string, timezone: string): Date {
  return fromZonedTime(`${value}T00:00`, timezone);
}
