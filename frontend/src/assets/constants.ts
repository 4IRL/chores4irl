export const days: string[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const mealTypes: string[] = ['Breakfast', 'Lunch', 'Dinner'];
export const massUnits = ['g', 'lbm', 'ozm'] as const;
export const volumeUnits = ['cm^3', 'mL', 'gal', 'cup', 'fl oz', 'tbsp', 'tsp', 'ea'] as const;

export const statusColors: Object[] = [
    {
        benchmark: 0.65,
        color: 'bg-green-500',
    },
    {
        benchmark: 0.85,
        color: 'bg-yellow-500',
    },
    {
        benchmark: 1,
        color: 'bg-red-500 ',
    }
];