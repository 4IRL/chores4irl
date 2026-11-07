import type { StatusCounts } from '@utils/choreStatusCounts';

type StatusCountStripProps = { counts: StatusCounts };

type Segment = { key: string; count: number; fill: string };

const SEGMENT_BASE = 'flex items-center justify-center text-white text-xs font-semibold overflow-hidden';
const SEGMENT_TRANSITION = 'transition-[flex-grow] duration-300 ease-in-out motion-reduce:transition-none';

export default function StatusCountStrip({ counts }: StatusCountStripProps) {
  const { done, dueSoon, overdue } = counts;
  const label = `${done} done today · ${dueSoon} due soon · ${overdue} overdue`;
  const allZero = done === 0 && dueSoon === 0 && overdue === 0;

  const segments: Segment[] = allZero
    ? [{ key: 'empty', count: 0, fill: 'bg-green-500/50' }]
    : [
        { key: 'done', count: done, fill: 'bg-green-500/50' },
        { key: 'dueSoon', count: dueSoon, fill: 'bg-orange-500/50' },
        { key: 'overdue', count: overdue, fill: 'bg-red-500/50' },
      ];

  return (
    <div
      data-testid="status-count-strip"
      className="sticky top-0 z-[15] sm:static px-4 py-2 bg-gray-900/90 backdrop-blur-md"
    >
      <div role="img" aria-label={label} className="h-6 flex rounded-full overflow-hidden bg-gray-800">
        {segments.map(({ key, count, fill }) => {
          if (key === 'empty') {
            return (
              <div
                key={key}
                aria-hidden="true"
                data-testid="status-count-segment-empty"
                style={{ flex: '1 1 0%' }}
                className={`${SEGMENT_BASE} ${fill}`}
              >
                0
              </div>
            );
          }
          const nonZero = count > 0;
          return (
            <div
              key={key}
              aria-hidden="true"
              data-testid={`status-count-segment-${key}`}
              style={{ flex: nonZero ? `${count} 1 0%` : '0 1 0%' }}
              className={`${SEGMENT_BASE} ${SEGMENT_TRANSITION} ${fill}${nonZero ? ' min-w-6' : ''}`}
            >
              {nonZero ? count : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
