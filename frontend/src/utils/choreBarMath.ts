import { statusColors } from '@assets/constants';

export type BarMathResult = {
    isOverdue: boolean;
    remainingRatio: number;
    barWidth: number;
    barColor: string;
};

export function computeBar(daysSince: number, frequency: number): BarMathResult {
    const isOverdue = frequency > 0 && daysSince > frequency;
    const remainingRatio = frequency > 0 ? (frequency - daysSince) / frequency : 1;

    let barWidth: number;
    if (frequency === 0) {
        barWidth = 100;
    } else if (!isOverdue) {
        barWidth = Math.max(remainingRatio, 0) * 100;
    } else {
        const daysOverdue = daysSince - frequency;
        const growthRatio = (daysOverdue * 2) / frequency;
        barWidth = Math.min(growthRatio, 1) * 100;
    }

    let barColor: string;
    if (isOverdue) {
        barColor = 'bg-red-500 bg-opacity-50';
    } else {
        const match = statusColors.find(s => remainingRatio > s.threshold);
        barColor = (match ?? statusColors[statusColors.length - 1]).color + ' bg-opacity-50';
    }

    return { isOverdue, remainingRatio, barWidth, barColor };
}
