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
// remaining width among the others in proportion. All three segments stay mounted — a
// zero count collapses to flexGrow 0 / min-w-0 — so a count change animates the widths with
// the timer bar fill's own transition. Each segment paints like the bar: the STATUS_BAR_COLOR
// hue at opacity-50 over the bg-gray-800 track, with the label on top at full opacity.
export default function StatusCountStrip({ counts }: StatusCountStripProps) {
    const label = `${counts.doneToday} done today · ${counts.dueSoon} due soon · ${counts.overdue} overdue`;
    const allZero = counts.doneToday + counts.dueSoon + counts.overdue === 0;

    return (
        <div
            data-testid="status-count-strip"
            role="img"
            aria-label={label}
            title={label}
            className="flex flex-shrink-0 w-full h-5 mt-2 rounded-sm overflow-hidden bg-gray-800"
        >
            {SEGMENTS.map((segment, index) => {
                const count = counts[segment.key];
                // All-zero board: the done-today segment fills the strip and reads 0.
                const showsZero = allZero && index === 0;
                const visible = count > 0 || showsZero;
                return (
                    <div
                        key={segment.key}
                        data-testid={segment.testId}
                        className={`relative ${visible ? 'min-w-5' : 'min-w-0'} flex items-center justify-center transition-all duration-300 ease-in-out`}
                        style={{ flexGrow: showsZero ? 1 : count, flexBasis: 0 }}
                    >
                        <div className={`absolute inset-0 ${STATUS_BAR_COLOR[segment.status]} opacity-50`} />
                        {visible && (
                            <span className="relative text-xs font-bold text-white leading-none">
                                {count}
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
