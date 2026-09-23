import { STATUS_BAR_COLOR } from '@assets/constants';
import type { ChoreStatus } from '@assets/constants';
import type { StatusCounts } from '@utils/choreStatusCounts';

type StatusCountStripProps = { counts: StatusCounts };

// Colours are looked up in STATUS_BAR_COLOR so the strip always matches the timer bar.
const SEGMENTS: { key: keyof StatusCounts; testId: string; status: ChoreStatus }[] = [
    { key: 'doneToday', testId: 'status-count-done-today', status: 'green' },
    { key: 'dueSoon', testId: 'status-count-due-soon', status: 'orange' },
    { key: 'overdue', testId: 'status-count-overdue', status: 'red' },
];

// F17: segment widths come from flexGrow = count (flexBasis 0), so they are proportional;
// min-w-5 keeps a bold 2-digit label legible on a tiny segment, and flexbox shares the
// remaining width among the others in proportion. Segments render the STATUS_BAR_COLOR
// hues at full opacity (unlike the timer bar) for white-text contrast.
export default function StatusCountStrip({ counts }: StatusCountStripProps) {
    const label = `${counts.doneToday} done today · ${counts.dueSoon} due soon · ${counts.overdue} overdue`;
    const total = counts.doneToday + counts.dueSoon + counts.overdue;
    const shown =
        total === 0
            ? [{ ...SEGMENTS[0], count: 0, grow: 1 }]
            : SEGMENTS.filter(segment => counts[segment.key] > 0).map(segment => ({
                  ...segment,
                  count: counts[segment.key],
                  grow: counts[segment.key],
              }));

    return (
        <div
            data-testid="status-count-strip"
            role="img"
            aria-label={label}
            title={label}
            className="flex flex-shrink-0 w-full h-5 mt-2 rounded-sm overflow-hidden"
        >
            {shown.map(segment => (
                <div
                    key={segment.key}
                    data-testid={segment.testId}
                    className={`${STATUS_BAR_COLOR[segment.status]} min-w-5 flex items-center justify-center text-xs font-bold text-white leading-none`}
                    style={{ flexGrow: segment.grow, flexBasis: 0 }}
                >
                    {segment.count}
                </div>
            ))}
        </div>
    );
}
