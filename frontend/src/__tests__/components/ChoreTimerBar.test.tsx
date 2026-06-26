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

    it('renders the OverdueBadge when the chore is overdue', () => {
        const chore = makeChore({
            frequency: 7,
            dateLastCompleted: new Date(2024, 11, 31, 12, 0, 0),
        });
        render(
            <ChoreTimerBar chore={chore} day={day} isSimulating={false} onComplete={vi.fn()} onDelete={vi.fn()} />
        );
        expect(screen.getByText('Overdue')).toBeInTheDocument();
    });

    it('does not render the OverdueBadge when the chore is not overdue', () => {
        const chore = makeChore({
            frequency: 7,
            dateLastCompleted: new Date(2025, 0, 13, 12, 0, 0),
        });
        render(
            <ChoreTimerBar chore={chore} day={day} isSimulating={false} onComplete={vi.fn()} onDelete={vi.fn()} />
        );
        expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
    });

    it('does not render the OverdueBadge at the exact-due-date boundary (daysSince === frequency)', () => {
        const chore = makeChore({
            frequency: 7,
            dateLastCompleted: new Date(2025, 0, 8, 12, 0, 0),
        });
        render(
            <ChoreTimerBar chore={chore} day={day} isSimulating={false} onComplete={vi.fn()} onDelete={vi.fn()} />
        );
        expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
    });

    it('calls onDelete (not onComplete) when the bar is swiped left', () => {
        const onComplete = vi.fn();
        const onDelete = vi.fn();
        render(
            <ChoreTimerBar
                chore={makeChore({ id: 42 })}
                day={day}
                isSimulating={false}
                onComplete={onComplete}
                onDelete={onDelete}
                onEdit={vi.fn()}
            />
        );
        swipe(screen.getByTestId('chore-bar'), 200, 120);
        expect(onDelete).toHaveBeenCalledOnce();
        expect(onDelete).toHaveBeenCalledWith(42);
        expect(onComplete).not.toHaveBeenCalled();
    });

    it('calls onEdit (not onComplete) when the bar is swiped right', () => {
        const onComplete = vi.fn();
        const onEdit = vi.fn();
        render(
            <ChoreTimerBar
                chore={makeChore({ id: 42 })}
                day={day}
                isSimulating={false}
                onComplete={onComplete}
                onDelete={vi.fn()}
                onEdit={onEdit}
            />
        );
        swipe(screen.getByTestId('chore-bar'), 120, 220);
        expect(onEdit).toHaveBeenCalledOnce();
        expect(onEdit).toHaveBeenCalledWith(42);
        expect(onComplete).not.toHaveBeenCalled();
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
        swipe(bar, 200, 120);
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
        swipe(bar, 200, 120);
        swipe(bar, 120, 220);
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
        swipe(bar, 200, 180);
        fireEvent.click(bar);
        expect(onDelete).not.toHaveBeenCalled();
        expect(onEdit).not.toHaveBeenCalled();
        expect(onComplete).toHaveBeenCalledOnce();
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
