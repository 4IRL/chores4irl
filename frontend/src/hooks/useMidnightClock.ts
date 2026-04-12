import { useState, useEffect } from 'react';
import { startOfDay, addDays } from 'date-fns';

export function useMidnightClock(): Date {
    const [now, setNow] = useState<Date>(new Date());

    useEffect(() => {
        const nextMidnight = startOfDay(addDays(now, 1));
        const msUntilMidnight = nextMidnight.getTime() - Date.now();
        const timer = setTimeout(() => {
            setNow(new Date());
        }, msUntilMidnight);
        return () => clearTimeout(timer);
    }, [now]);

    return now;
}
