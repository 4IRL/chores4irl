import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChoreTimerBar from '../../components/chore/ChoreTimerBar';
import { makeChore } from '../fixtures/chore';

const day = new Date(2025, 0, 15, 12, 0, 0);

function swipe(bar: HTMLElement, fromX: number, toX: number) {
    fireEvent.mouseDown(bar, { clientX: fromX, clientY: 50 });
    fireEvent.mouseMove(bar, { clientX: (fromX + toX) / 2, clientY: 50 });
    fireEvent.mouseMove(bar, { clientX: toX, clientY: 50 });
    fireEvent.mouseUp(bar, { clientX: toX, clientY: 50 });
}

// jsdom reports 0 for layout, so the 25%-of-width confirm threshold is untestable
// without a width. Stub getBoundingClientRect on the measured wrapper (the bar's
// parentElement) to a fixed width so the threshold logic can be exercised.
const BAR_WIDTH = 400;
function stubBarWidth(bar: HTMLElement, width = BAR_WIDTH) {
    const measured = bar.parentElement as HTMLElement;
    measured.getBoundingClientRect = () =>
        ({ width, height: 64, top: 0, left: 0, right: width, bottom: 64, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
}

describe('ChoreTimerBar', () => {
    it('renders the delete button with correct aria-label', () => {
        render(
            <ChoreTimerBar
                chore={makeChore()}
                day={day}
                isSimulating={false}
                onComplete={vi.fn()}
                onDelete={vi.fn()}
            />
        );
        expect(screen.getByRole('button', { name: 'Delete chore' })).toBeInTheDocument();
    });

    it('calls onDelete with the correct chore id when delete button is clicked', async () => {
        const onDelete = vi.fn();
        const user = userEvent.setup();
        render(
            <ChoreTimerBar
                chore={makeChore({ id: 42 })}
                day={day}
                isSimulating={false}
                onComplete={vi.fn()}
                onDelete={onDelete}
            />
        );
        await user.click(screen.getByRole('button', { name: 'Delete chore' }));
        expect(onDelete).toHaveBeenCalledOnce();
        expect(onDelete).toHaveBeenCalledWith(42);
    });

    it('does not call onComplete when the delete button is clicked (stopPropagation)', async () => {
        const onComplete = vi.fn();
        const onDelete = vi.fn();
        const user = userEvent.setup();
        render(
            <ChoreTimerBar
                chore={makeChore()}
                day={day}
                isSimulating={false}
                onComplete={onComplete}
                onDelete={onDelete}
            />
        );
        await user.click(screen.getByRole('button', { name: 'Delete chore' }));
        expect(onComplete).not.toHaveBeenCalled();
        expect(onDelete).toHaveBeenCalledOnce();
    });

    it('renders the edit button with correct aria-label', () => {
        render(
            <ChoreTimerBar
                chore={makeChore()}
                day={day}
                isSimulating={false}
                onComplete={vi.fn()}
                onDelete={vi.fn()}
                onEdit={vi.fn()}
            />
        );
        expect(screen.getByRole('button', { name: 'Edit chore' })).toBeInTheDocument();
    });

    it('calls onEdit with the chore id when the edit button is clicked', async () => {
        const onEdit = vi.fn();
        const user = userEvent.setup();
        render(
            <ChoreTimerBar
                chore={makeChore({ id: 42 })}
                day={day}
                isSimulating={false}
                onComplete={vi.fn()}
                onDelete={vi.fn()}
                onEdit={onEdit}
            />
        );
        await user.click(screen.getByRole('button', { name: 'Edit chore' }));
        expect(onEdit).toHaveBeenCalledOnce();
        expect(onEdit).toHaveBeenCalledWith(42);
    });

    it('does not call onComplete when the edit button is clicked (stopPropagation)', async () => {
        const onComplete = vi.fn();
        const onEdit = vi.fn();
        const user = userEvent.setup();
        render(
            <ChoreTimerBar
                chore={makeChore()}
                day={day}
                isSimulating={false}
                onComplete={onComplete}
                onDelete={vi.fn()}
                onEdit={onEdit}
            />
        );
        await user.click(screen.getByRole('button', { name: 'Edit chore' }));
        expect(onComplete).not.toHaveBeenCalled();
        expect(onEdit).toHaveBeenCalledOnce();
    });

    it('updates displayed date when chore prop dateLastCompleted changes', () => {
        const chore = makeChore({ dateLastCompleted: new Date('2025-01-01T00:00:00.000Z') });
        const { rerender } = render(
            <ChoreTimerBar chore={chore} day={day} isSimulating={false} onComplete={vi.fn()} onDelete={vi.fn()} />
        );
        const updatedChore = { ...chore, dateLastCompleted: new Date(2025, 0, 14, 12, 0, 0) };
        rerender(
            <ChoreTimerBar chore={updatedChore} day={day} isSimulating={false} onComplete={vi.fn()} onDelete={vi.fn()} />
        );
        expect(screen.getByText('1 day ago')).toBeInTheDocument();
    });

    it('calls onComplete with the real current date when the chore bar is clicked', () => {
        const fixedNow = new Date(2025, 0, 15, 14, 0, 0);
        vi.useFakeTimers({ now: fixedNow });
        const onComplete = vi.fn();
        render(<ChoreTimerBar chore={makeChore()} day={new Date(2025, 0, 15)} isSimulating={false} onComplete={onComplete} onDelete={vi.fn()} />);
        fireEvent.click(screen.getByTestId('chore-bar'));
        expect(onComplete).toHaveBeenCalledWith(makeChore().id, fixedNow);
        vi.useRealTimers();
    });

    it('does not call onComplete when clicked in simulation mode', async () => {
        const onComplete = vi.fn();
        const user = userEvent.setup();
        render(
            <ChoreTimerBar
                chore={makeChore()}
                day={day}
                isSimulating={true}
                onComplete={onComplete}
                onDelete={vi.fn()}
            />
        );
        await user.click(screen.getByTestId('chore-bar'));
        expect(onComplete).not.toHaveBeenCalled();
    });

    it('still calls onDelete when delete button is clicked in simulation mode', async () => {
        const onDelete = vi.fn();
        const user = userEvent.setup();
        render(
            <ChoreTimerBar
                chore={makeChore({ id: 7 })}
                day={day}
                isSimulating={true}
                onComplete={vi.fn()}
                onDelete={onDelete}
            />
        );
        await user.click(screen.getByRole('button', { name: 'Delete chore' }));
        expect(onDelete).toHaveBeenCalledOnce();
        expect(onDelete).toHaveBeenCalledWith(7);
    });

    it('exposes an sr-only "Overdue" cue when overdue', () => {
        const chore = makeChore({
            frequency: 7,
            dateLastCompleted: new Date(2024, 11, 31, 12, 0, 0),
        });
        render(
            <ChoreTimerBar chore={chore} day={day} isSimulating={false} onComplete={vi.fn()} onDelete={vi.fn()} />
        );
        expect(screen.getByText('Overdue')).toBeInTheDocument();
    });

    it('has no overdue cue when not overdue', () => {
        const chore = makeChore({
            frequency: 7,
            dateLastCompleted: new Date(2025, 0, 13, 12, 0, 0),
        });
        render(
            <ChoreTimerBar chore={chore} day={day} isSimulating={false} onComplete={vi.fn()} onDelete={vi.fn()} />
        );
        expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
    });

    it('has no overdue cue at the exact-due-date boundary (daysSince === frequency)', () => {
        const chore = makeChore({
            frequency: 7,
            dateLastCompleted: new Date(2025, 0, 8, 12, 0, 0),
        });
        render(
            <ChoreTimerBar chore={chore} day={day} isSimulating={false} onComplete={vi.fn()} onDelete={vi.fn()} />
        );
        expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
    });

    it('calls onEdit (not onDelete/onComplete) when the bar is swiped left past 25% width', () => {
        const onComplete = vi.fn();
        const onDelete = vi.fn();
        const onEdit = vi.fn();
        render(
            <ChoreTimerBar
                chore={makeChore({ id: 42 })}
                day={day}
                isSimulating={false}
                onComplete={onComplete}
                onDelete={onDelete}
                onEdit={onEdit}
            />
        );
        const bar = screen.getByTestId('chore-bar');
        stubBarWidth(bar);
        // 350 -> 100 == 250px left, well past 25% of 400 (= 100px).
        swipe(bar, 350, 100);
        expect(onEdit).toHaveBeenCalledOnce();
        expect(onEdit).toHaveBeenCalledWith(42);
        expect(onDelete).not.toHaveBeenCalled();
        expect(onComplete).not.toHaveBeenCalled();
    });

    it('calls onDelete (not onEdit/onComplete) when the bar is swiped right past 25% width', () => {
        const onComplete = vi.fn();
        const onDelete = vi.fn();
        const onEdit = vi.fn();
        render(
            <ChoreTimerBar
                chore={makeChore({ id: 42 })}
                day={day}
                isSimulating={false}
                onComplete={onComplete}
                onDelete={onDelete}
                onEdit={onEdit}
            />
        );
        const bar = screen.getByTestId('chore-bar');
        stubBarWidth(bar);
        // 50 -> 300 == 250px right, well past 25% of 400 (= 100px).
        swipe(bar, 50, 300);
        expect(onDelete).toHaveBeenCalledOnce();
        expect(onDelete).toHaveBeenCalledWith(42);
        expect(onEdit).not.toHaveBeenCalled();
        expect(onComplete).not.toHaveBeenCalled();
    });

    it('does NOT fire the action when a swipe stays below 25% of the bar width', () => {
        const onComplete = vi.fn();
        const onDelete = vi.fn();
        const onEdit = vi.fn();
        render(
            <ChoreTimerBar
                chore={makeChore({ id: 42 })}
                day={day}
                isSimulating={false}
                onComplete={onComplete}
                onDelete={onDelete}
                onEdit={onEdit}
            />
        );
        const bar = screen.getByTestId('chore-bar');
        stubBarWidth(bar); // width 400 -> threshold 100px
        // 70px left swipe: past the 50px gesture delta but below the 100px confirm threshold.
        swipe(bar, 200, 130);
        expect(onEdit).not.toHaveBeenCalled();
        expect(onDelete).not.toHaveBeenCalled();
    });

    it('suppresses the trailing click after a swipe so the chore is not completed', () => {
        const onComplete = vi.fn();
        const onDelete = vi.fn();
        render(
            <ChoreTimerBar
                chore={makeChore()}
                day={day}
                isSimulating={false}
                onComplete={onComplete}
                onDelete={onDelete}
                onEdit={vi.fn()}
            />
        );
        const bar = screen.getByTestId('chore-bar');
        stubBarWidth(bar);
        swipe(bar, 350, 100);
        fireEvent.click(bar);
        expect(onComplete).not.toHaveBeenCalled();
    });

    it('does not fire swipe callbacks while simulating', () => {
        const onDelete = vi.fn();
        const onEdit = vi.fn();
        render(
            <ChoreTimerBar
                chore={makeChore()}
                day={day}
                isSimulating={true}
                onComplete={vi.fn()}
                onDelete={onDelete}
                onEdit={onEdit}
            />
        );
        const bar = screen.getByTestId('chore-bar');
        stubBarWidth(bar);
        swipe(bar, 350, 100);
        swipe(bar, 50, 300);
        expect(onDelete).not.toHaveBeenCalled();
        expect(onEdit).not.toHaveBeenCalled();
    });

    it('treats a sub-threshold drag as a tap that completes the chore', () => {
        const onComplete = vi.fn();
        const onDelete = vi.fn();
        const onEdit = vi.fn();
        render(
            <ChoreTimerBar
                chore={makeChore()}
                day={day}
                isSimulating={false}
                onComplete={onComplete}
                onDelete={onDelete}
                onEdit={onEdit}
            />
        );
        const bar = screen.getByTestId('chore-bar');
        stubBarWidth(bar);
        swipe(bar, 200, 180);
        fireEvent.click(bar);
        expect(onDelete).not.toHaveBeenCalled();
        expect(onEdit).not.toHaveBeenCalled();
        expect(onComplete).toHaveBeenCalledOnce();
    });

    it('reveals a yellow edit (pencil) action layer while swiping left', () => {
        const { container } = render(
            <ChoreTimerBar
                chore={makeChore()}
                day={day}
                isSimulating={false}
                onComplete={vi.fn()}
                onDelete={vi.fn()}
                onEdit={vi.fn()}
            />
        );
        const bar = screen.getByTestId('chore-bar');
        stubBarWidth(bar);
        // Begin a left swipe but do not release, so the reveal state is observable.
        fireEvent.mouseDown(bar, { clientX: 350, clientY: 50 });
        fireEvent.mouseMove(bar, { clientX: 250, clientY: 50 });
        fireEvent.mouseMove(bar, { clientX: 150, clientY: 50 });
        // Yellow edit background is active and the pencil icon is fully shown:
        // the 100px swipe reaches the 25%-of-400px threshold, so opacity is 1.
        const bg = container.querySelector('.bg-yellow-400') as HTMLElement;
        expect(bg).toBeTruthy();
        expect(bg.style.opacity).toBe('1');
        const pencil = container.querySelector('.lucide-pencil');
        expect(pencil).toBeTruthy();
        expect((pencil?.closest('span') as HTMLElement)?.style.opacity).toBe('1');
    });

    it('reveals a red delete (trash) action layer while swiping right', () => {
        const { container } = render(
            <ChoreTimerBar
                chore={makeChore()}
                day={day}
                isSimulating={false}
                onComplete={vi.fn()}
                onDelete={vi.fn()}
                onEdit={vi.fn()}
            />
        );
        const bar = screen.getByTestId('chore-bar');
        stubBarWidth(bar);
        fireEvent.mouseDown(bar, { clientX: 50, clientY: 50 });
        fireEvent.mouseMove(bar, { clientX: 150, clientY: 50 });
        fireEvent.mouseMove(bar, { clientX: 250, clientY: 50 });
        const bg = container.querySelector('.bg-red-600') as HTMLElement;
        expect(bg).toBeTruthy();
        expect(bg.style.opacity).toBe('1');
        const trash = container.querySelector('.lucide-trash-2');
        expect(trash).toBeTruthy();
        expect((trash?.closest('span') as HTMLElement)?.style.opacity).toBe('1');
    });

    it('fades the reveal background in proportionally to swipe distance', () => {
        const { container } = render(
            <ChoreTimerBar
                chore={makeChore()}
                day={day}
                isSimulating={false}
                onComplete={vi.fn()}
                onDelete={vi.fn()}
                onEdit={vi.fn()}
            />
        );
        const bar = screen.getByTestId('chore-bar');
        stubBarWidth(bar); // width 400 -> threshold 100px
        // Swipe right only 50px: halfway to the 100px confirm threshold, so the
        // red background should be half opaque, not yet fully red.
        fireEvent.mouseDown(bar, { clientX: 50, clientY: 50 });
        fireEvent.mouseMove(bar, { clientX: 100, clientY: 50 });
        const bg = container.querySelector('.bg-red-600') as HTMLElement;
        expect(bg).toBeTruthy();
        expect(Number(bg.style.opacity)).toBeCloseTo(0.5, 5);
    });

    it('is shorter than the old fixed height', () => {
        render(
            <ChoreTimerBar
                chore={makeChore()}
                day={day}
                isSimulating={false}
                onComplete={vi.fn()}
                onDelete={vi.fn()}
            />
        );
        const bar = screen.getByTestId('chore-bar');
        expect(bar).toHaveClass('h-20');
        expect(bar).not.toHaveClass('h-36');
    });

    it('does not display the room on the bar', () => {
        render(
            <ChoreTimerBar
                chore={makeChore({ room: 'Kitchen' })}
                day={day}
                isSimulating={false}
                onComplete={vi.fn()}
                onDelete={vi.fn()}
            />
        );
        expect(screen.queryByText('Kitchen')).toBeNull();
        expect(screen.queryByText(/Kitchen ·/)).toBeNull();
    });

    it('displays the frequency centered', () => {
        render(
            <ChoreTimerBar
                chore={makeChore({ frequency: 7 })}
                day={day}
                isSimulating={false}
                onComplete={vi.fn()}
                onDelete={vi.fn()}
            />
        );
        expect(screen.getByText('Every 7 days')).toBeInTheDocument();
    });

    it('applies the touch-pan-y class to the chore bar', () => {
        render(
            <ChoreTimerBar
                chore={makeChore()}
                day={day}
                isSimulating={false}
                onComplete={vi.fn()}
                onDelete={vi.fn()}
            />
        );
        expect(screen.getByTestId('chore-bar')).toHaveClass('touch-pan-y');
    });
});
