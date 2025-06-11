// TODO: make `@types` reference definition in tsconfig.base.json work so both frontend and backend can share common custom TypeScript type `Chore`
// {
//   "compilerOptions": {
//     "paths": {
//       "@types/*": [
//         "types/*"
//       ]
//     }
//   }
// }
// import { Chore } from '@types/index';
// import type { Chore } from '@types/index';

// Until then...
interface Chore {
    id: number,
    name: string, // name of task
    frequency: number, // task should be completed at a frequency equal to this number of days 
    daysSince: number, // number of days since last completed
    progress: number, // percentage til overdue
    duration: number, // estimate of task duration til completion minutes
}

// Sample data, TODO: pull from Express
export const data: Chore[] = [
    {
        id: 1,
        name: 'Vacuum Floors',
        frequency: 7,
        daysSince: 6,
        progress: (6 / 7) * 100,
        duration: 20
    },
    {
        id: 2,
        name: 'Change Bedsheets',
        frequency: 7,
        daysSince: 7,
        progress: 100,
        duration: 10
    },
    {
        id: 3,
        name: 'Change Towels',
        frequency: 3,
        daysSince: 3,
        progress: 100,
        duration: 2
    },
    {
        id: 4,
        name: 'Sweep Floors',
        frequency: 2,
        daysSince: 2,
        progress: 100,
        duration: 3
    },
    {
        id: 5,
        name: 'Mop Floors',
        frequency: 7,
        daysSince: 5,
        progress: (5 / 7) * 100,
        duration: 45
    },
    {
        id: 6,
        name: 'Clean Bathroom',
        frequency: 7,
        daysSince: 8,
        progress: 100,
        duration: 60
    }
];