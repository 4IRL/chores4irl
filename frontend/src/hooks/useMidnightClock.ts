import { useState, useEffect, useRef } from 'react';
import { startOfDay, addDays } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

export function useMidnightClock(timezone: string): Date {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const nowMs = Date.now();
    const zonedNow = toZonedTime(nowMs, timezone);
    const nextZonedMidnight = startOfDay(addDays(zonedNow, 1));
    const nextMidnightUtc = fromZonedTime(nextZonedMidnight, timezone);
    const msUntilMidnight = nextMidnightUtc.getTime() - nowMs;
    const timer = setTimeout(() => {
      setNow(new Date());
    }, msUntilMidnight);
    return () => clearTimeout(timer);
  }, [now, timezone]);

  const lastTimezone = useRef(timezone);
  useEffect(() => {
    if (lastTimezone.current === timezone) return;
    lastTimezone.current = timezone;
    const id = setTimeout(() => setNow(new Date()), 0);
    return () => clearTimeout(id);
  }, [timezone]);

  return now;
}
