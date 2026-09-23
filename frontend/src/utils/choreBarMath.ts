import { statusColors, STATUS_BAR_COLOR } from '@assets/constants';
import type { ChoreStatus } from '@assets/constants';

export type BarMathResult = {
    isOverdue: boolean;
    remainingRatio: number;
    barWidth: number;
    // Bare fill colour, with no opacity utility baked in — the renderer (ProgressBar)
    // applies opacity-50 itself. Concatenating one here is how the dead Tailwind v3
    // bg-opacity-50 crept in, so keep this a colour on its own.
    barColor: string;
};

// The one status classifier, shared by the timer bar (computeBar) and orderChores (F16).
// Thresholds live here and in statusColors — never duplicated in the sort.
export function classifyStatus(daysSince: number, frequency: number): ChoreStatus {
    if (frequency > 0 && daysSince > frequency) return 'red';
    const remainingRatio = frequency > 0 ? (frequency - daysSince) / frequency : 1;
    return (statusColors.find(s => remainingRatio > s.threshold) ?? statusColors[statusColors.length - 1]).status;
}

export function computeBar(daysSince: number, frequency: number): BarMathResult {
    const status = classifyStatus(daysSince, frequency);
    const isOverdue = status === 'red';
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

    const barColor = STATUS_BAR_COLOR[status];

    return { isOverdue, remainingRatio, barWidth, barColor };
}
