type StatusColor = { benchmark: number; color: string };

export const statusColors: StatusColor[] = [
    { benchmark: 0.65, color: 'bg-green-500' },
    { benchmark: 0.85, color: 'bg-yellow-500' },
    { benchmark: 1,    color: 'bg-red-500' },
];
