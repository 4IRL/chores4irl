import type { Chore } from '@customTypes/SharedTypes';

export const makeChore = (overrides: Partial<Chore> = {}): Chore => ({
    id: 1,
    name: 'Sweep',
    room: 'Kitchen',
    dateLastCompleted: new Date('2025-01-01T00:00:00.000Z'),
    duration: 10,
    frequency: 7,
    ...overrides,
});

export function localNoon(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
}
