import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusCountStrip from '../../components/nav/StatusCountStrip';
import { STATUS_BAR_COLOR } from '@assets/constants';

const SEGMENT_TEST_IDS = [
    'status-count-done-today',
    'status-count-due-soon',
    'status-count-overdue',
];

const fillOf = (testId: string) => screen.getByTestId(testId).firstElementChild as HTMLElement;
const labelOf = (testId: string) => screen.getByTestId(testId).querySelector('span');

describe('StatusCountStrip', () => {
    it('sizes each segment proportionally to its count, in done → due soon → overdue order', () => {
        render(<StatusCountStrip counts={{ doneToday: 3, dueSoon: 2, overdue: 5 }} />);
        const strip = screen.getByTestId('status-count-strip');

        const expected = [
            { testId: 'status-count-done-today', count: '3' },
            { testId: 'status-count-due-soon', count: '2' },
            { testId: 'status-count-overdue', count: '5' },
        ];
        for (const { testId, count } of expected) {
            const segment = screen.getByTestId(testId);
            expect(segment.style.flexGrow).toBe(count);
            expect(segment.style.flexBasis).toMatch(/^0(px)?$/);
            expect(segment.textContent).toBe(count);
        }

        const childTestIds = Array.from(strip.children).map(child =>
            child.getAttribute('data-testid'),
        );
        expect(childTestIds).toEqual(SEGMENT_TEST_IDS);
    });

    it('collapses a zero-count segment to nothing but keeps it mounted so its width can animate', () => {
        render(<StatusCountStrip counts={{ doneToday: 0, dueSoon: 4, overdue: 1 }} />);
        const collapsed = screen.getByTestId('status-count-done-today');
        expect(collapsed.style.flexGrow).toBe('0');
        expect(collapsed.className).toContain('min-w-0');
        expect(collapsed.className).not.toContain('min-w-5');
        expect(collapsed.textContent).toBe('');
        expect(screen.getByTestId('status-count-due-soon').textContent).toBe('4');
        expect(screen.getByTestId('status-count-overdue').textContent).toBe('1');
    });

    it('renders a full green 0 when every count is zero', () => {
        render(<StatusCountStrip counts={{ doneToday: 0, dueSoon: 0, overdue: 0 }} />);
        const doneToday = screen.getByTestId('status-count-done-today');
        expect(doneToday.textContent).toBe('0');
        expect(doneToday.style.flexGrow).toBe('1');
        expect(fillOf('status-count-done-today').className).toContain(STATUS_BAR_COLOR.green);
        for (const testId of ['status-count-due-soon', 'status-count-overdue']) {
            expect(screen.getByTestId(testId).style.flexGrow).toBe('0');
            expect(screen.getByTestId(testId).textContent).toBe('');
        }
    });

    it('renders every non-zero label bold and white, and gives its segment a minimum width', () => {
        render(<StatusCountStrip counts={{ doneToday: 3, dueSoon: 2, overdue: 5 }} />);
        for (const testId of SEGMENT_TEST_IDS) {
            const label = labelOf(testId);
            expect(label?.className).toContain('font-bold');
            expect(label?.className).toContain('text-white');
            expect(screen.getByTestId(testId).className).toContain('min-w-5');
        }
    });

    it('exposes all three counts as an accessible label and title', () => {
        const label = '3 done today · 2 due soon · 5 overdue';
        render(<StatusCountStrip counts={{ doneToday: 3, dueSoon: 2, overdue: 5 }} />);
        const strip = screen.getByRole('img', { name: label });
        expect(strip.getAttribute('title')).toBe(label);
    });

    it('includes zeros in the accessible label of an all-zero board', () => {
        const label = '0 done today · 0 due soon · 0 overdue';
        render(<StatusCountStrip counts={{ doneToday: 0, dueSoon: 0, overdue: 0 }} />);
        const strip = screen.getByRole('img', { name: label });
        expect(strip.getAttribute('title')).toBe(label);
    });

    it('matches the timer bar: same colour tokens at opacity-50 over the bg-gray-800 track, labels at full opacity', () => {
        render(<StatusCountStrip counts={{ doneToday: 3, dueSoon: 2, overdue: 5 }} />);
        expect(fillOf('status-count-done-today').className).toContain(STATUS_BAR_COLOR.green);
        expect(fillOf('status-count-due-soon').className).toContain(STATUS_BAR_COLOR.orange);
        expect(fillOf('status-count-overdue').className).toContain(STATUS_BAR_COLOR.red);
        for (const testId of SEGMENT_TEST_IDS) {
            expect(fillOf(testId).className).toContain('opacity-50');
            expect(labelOf(testId)?.className).not.toContain('opacity-');
        }
        expect(screen.getByTestId('status-count-strip').className).toContain('bg-gray-800');
    });

    it('animates segment widths with the same transition as the timer bar fill', () => {
        render(<StatusCountStrip counts={{ doneToday: 3, dueSoon: 2, overdue: 5 }} />);
        for (const testId of SEGMENT_TEST_IDS) {
            const className = screen.getByTestId(testId).className;
            expect(className).toContain('transition-all');
            expect(className).toContain('duration-300');
            expect(className).toContain('ease-in-out');
        }
    });

    it('keeps the same element across a count change so the width transitions instead of remounting', () => {
        const { rerender } = render(
            <StatusCountStrip counts={{ doneToday: 0, dueSoon: 0, overdue: 2 }} />,
        );
        const doneToday = screen.getByTestId('status-count-done-today');
        rerender(<StatusCountStrip counts={{ doneToday: 1, dueSoon: 0, overdue: 1 }} />);
        expect(screen.getByTestId('status-count-done-today')).toBe(doneToday);
        expect(doneToday.style.flexGrow).toBe('1');
        expect(doneToday.textContent).toBe('1');
    });

    it('stays out of the scroll-region, chore-bar and button selectors', () => {
        render(<StatusCountStrip counts={{ doneToday: 3, dueSoon: 2, overdue: 5 }} />);
        const className = screen.getByTestId('status-count-strip').className;
        expect(className).toContain('flex-shrink-0');
        expect(className).not.toContain('overflow-y-auto');
        // e2e picks chore bars with `.bg-gray-800.rounded-full`; the strip must never carry both.
        expect(className).not.toContain('rounded-full');
        expect(screen.queryAllByRole('button')).toHaveLength(0);
    });

    it('insets itself with mx-4 instead of w-full, since the app column no longer pads horizontally (F22)', () => {
        render(<StatusCountStrip counts={{ doneToday: 3, dueSoon: 2, overdue: 5 }} />);
        const className = screen.getByTestId('status-count-strip').className;
        expect(className).toContain('mx-4');
        expect(className).not.toMatch(/\bw-full\b/);
    });
});
