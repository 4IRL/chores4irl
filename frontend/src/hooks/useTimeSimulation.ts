import { useState, useEffect } from 'react';
import { addDays } from 'date-fns';

const SIM_SECONDS_PER_DAY = 20;

export function useTimeSimulation(): Date {
    const [day, setDay] = useState<Date>(new Date());

    useEffect(() => {
        const timer = setTimeout(() => {
            setDay(prev => addDays(prev, 1));
        }, SIM_SECONDS_PER_DAY * 1000);

        return () => clearTimeout(timer);
    }, [day]);

    return day;
}
