import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusCountStrip from '../../components/nav/StatusCountStrip';
import { STATUS_BAR_COLOR } from '@assets/constants';

const SEGMENT_TEST_IDS = [
    'status-count-done-today',
    'status-count-due-soon',
    'status-count-overdue',
];

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

    it('omits a segment whose count is zero', () => {
        render(<StatusCountStrip counts={{ doneToday: 0, dueSoon: 4, overdue: 1 }} />);
        expect(screen.queryByTestId('status-count-done-today')).toBeNull();
        expect(screen.getByTestId('status-count-due-soon')).toBeInTheDocument();
        expect(screen.getByTestId('status-count-overdue')).toBeInTheDocument();
    });

    it('renders a single full green 0 segment when every count is zero', () => {
        render(<StatusCountStrip counts={{ doneToday: 0, dueSoon: 0, overdue: 0 }} />);
        const strip = screen.getByTestId('status-count-strip');
        expect(strip.children).toHaveLength(1);

        const segment = screen.getByTestId('status-count-done-today');
        expect(strip.children[0]).toBe(segment);
        expect(segment.textContent).toBe('0');
        expect(segment.style.flexGrow).toBe('1');
        expect(segment.className).toContain(STATUS_BAR_COLOR.green);
        expect(screen.queryByTestId('status-count-due-soon')).toBeNull();
        expect(screen.queryByTestId('status-count-overdue')).toBeNull();
    });

    it('renders every segment label bold and white with a minimum width', () => {
        render(<StatusCountStrip counts={{ doneToday: 3, dueSoon: 2, overdue: 5 }} />);
        for (const testId of SEGMENT_TEST_IDS) {
            const className = screen.getByTestId(testId).className;
            expect(className).toContain('font-bold');
            expect(className).toContain('text-white');
            expect(className).toContain('min-w-5');
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

    it('uses the same colour tokens as the timer bar, at full opacity', () => {
        render(<StatusCountStrip counts={{ doneToday: 3, dueSoon: 2, overdue: 5 }} />);
        expect(screen.getByTestId('status-count-done-today').className).toContain(
            STATUS_BAR_COLOR.green,
        );
        expect(screen.getByTestId('status-count-due-soon').className).toContain(
            STATUS_BAR_COLOR.orange,
        );
        expect(screen.getByTestId('status-count-overdue').className).toContain(
            STATUS_BAR_COLOR.red,
        );
        for (const testId of SEGMENT_TEST_IDS) {
            expect(screen.getByTestId(testId).className).not.toContain('opacity-');
        }
    });

    it('stays out of the scroll-region, chore-bar and button selectors', () => {
        render(<StatusCountStrip counts={{ doneToday: 3, dueSoon: 2, overdue: 5 }} />);
        const className = screen.getByTestId('status-count-strip').className;
        expect(className).toContain('flex-shrink-0');
        expect(className).not.toContain('overflow-y-auto');
        expect(className).not.toContain('rounded-full');
        expect(className).not.toContain('bg-gray-800');
        expect(screen.queryAllByRole('button')).toHaveLength(0);
    });
});
