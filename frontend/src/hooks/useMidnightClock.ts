import { useState, useEffect } from 'react';
import { startOfDay, addDays } from 'date-fns';

export function useMidnightClock(): Date {
    const [now, setNow] = useState<Date>(new Date());

    useEffect(() => {
        const nowMs = Date.now();
        const nextMidnight = startOfDay(addDays(nowMs, 1));
        const msUntilMidnight = nextMidnight.getTime() - nowMs;
        const timer = setTimeout(() => {
            setNow(new Date());
        }, msUntilMidnight);
        return () => clearTimeout(timer);
    }, [now]);

    return now;
}
