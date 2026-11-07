import { STATUS_BAR_COLOR, STATUS_THRESHOLDS, type ChoreStatus } from '@assets/constants';

export type BarMathResult = {
  isOverdue: boolean;
  remainingRatio: number;
  barWidth: number;
  barColor: string;
};

export function remainingRatioOf(daysSince: number, frequency: number): number {
  return frequency > 0 ? (frequency - daysSince) / frequency : 1;
}

export function classifyStatus(daysSince: number, frequency: number): ChoreStatus {
  if (frequency > 0 && daysSince > frequency) return 'red';
  const remainingRatio = remainingRatioOf(daysSince, frequency);
  const match = STATUS_THRESHOLDS.find((s) => remainingRatio > s.threshold);
  return (match ?? STATUS_THRESHOLDS[STATUS_THRESHOLDS.length - 1]).status;
}

export function computeBar(daysSince: number, frequency: number): BarMathResult {
  const status = classifyStatus(daysSince, frequency);
  const isOverdue = status === 'red';
  const remainingRatio = remainingRatioOf(daysSince, frequency);

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

  return { isOverdue, remainingRatio, barWidth, barColor: STATUS_BAR_COLOR[status] };
}
