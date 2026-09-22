import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChoreForm from '../../components/form/ChoreForm';
import { makeChore, localNoon } from '../fixtures/chore';

describe('ChoreForm', () => {
    it('add mode renders the Add heading and empty Name', () => {
        render(<ChoreForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

        expect(screen.getByText('Add New Chore')).toBeInTheDocument();
        expect(screen.getByLabelText('Name')).toHaveValue('');
    });

    it('edit mode pre-populates all fields from initialChore', () => {
        render(
            <ChoreForm
                mode="edit"
                initialChore={makeChore({
                    id: 7,
                    name: 'Mop',
                    room: 'Kitchen',
                    dateLastCompleted: localNoon('2025-03-31'),
                    duration: 45,
                    frequency: 7,
                    urgency: 'low',
                })}
                onSubmit={vi.fn()}
                onCancel={vi.fn()}
            />,
        );

        expect(screen.getByLabelText('Name')).toHaveValue('Mop');
        expect(screen.getByLabelText('Room')).toHaveValue('Kitchen');
        expect(screen.getByLabelText('Last Completed')).toHaveValue('2025-03-31');
        expect(screen.getByLabelText('Duration (minutes)')).toHaveValue(45);
        expect(screen.getByLabelText('Frequency (days)')).toHaveValue(7);
        expect(screen.getByRole('combobox', { name: 'Urgency' })).toHaveValue('low');
        expect(screen.getByText('Edit Chore')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
    });

    it('edit submit emits the edited Omit<Chore,\'id\'> payload, preserving unchanged optional fields', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        render(
            <ChoreForm
                mode="edit"
                initialChore={makeChore({
                    id: 7,
                    name: 'Mop',
                    room: 'Kitchen',
                    dateLastCompleted: localNoon('2025-03-31'),
                    duration: 45,
                    frequency: 7,
                    urgency: 'low',
                })}
                onSubmit={onSubmit}
                onCancel={vi.fn()}
            />,
        );

        await user.clear(screen.getByLabelText('Name'));
        await user.type(screen.getByLabelText('Name'), 'Mopped');
        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        expect(onSubmit).toHaveBeenCalledOnce();
        const payload = onSubmit.mock.calls[0][0];
        expect(payload.name).toBe('Mopped');
        expect(payload.room).toBe('Kitchen');
        expect(payload.dateLastCompleted).toBeInstanceOf(Date);
        expect(payload.dateLastCompleted.getFullYear()).toBe(2025);
        expect(payload.dateLastCompleted.getMonth()).toBe(2);
        expect(payload.dateLastCompleted.getDate()).toBe(31);
        expect(payload.duration).toBe(45);
        expect(payload.frequency).toBe(7);
        expect(payload.urgency).toBe('low');
        expect(payload).not.toHaveProperty('id');
        expect(payload).not.toHaveProperty('details');
        expect(payload).not.toHaveProperty('longTermTask');
    });

    it('no longer renders a Details field or a Long-term task checkbox (F4)', () => {
        const assertAbsent = () => {
            expect(screen.queryByLabelText('Details')).toBeNull();
            expect(screen.queryByLabelText('Long-term task')).toBeNull();
            expect(screen.queryByRole('checkbox')).toBeNull();
        };
        const { unmount } = render(<ChoreForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
        assertAbsent();
        unmount();
        render(<ChoreForm mode="edit" initialChore={makeChore({ id: 7, urgency: 'low' })} onSubmit={vi.fn()} onCancel={vi.fn()} />);
        assertAbsent();
    });
});

describe('ChoreForm room datalist', () => {
    it('renders a datalist option for each room passed via the rooms prop', () => {
        const { container } = render(
            <ChoreForm rooms={['Kitchen', 'Bathroom', 'Garage']} onSubmit={vi.fn()} onCancel={vi.fn()} />,
        );

        const roomInput = screen.getByLabelText('Room');
        expect(roomInput).toHaveAttribute('list', 'room-options');

        const datalist = container.querySelector('#room-options');
        expect(datalist).not.toBeNull();
        const options = datalist!.querySelectorAll('option');
        expect(Array.from(options).map(o => o.getAttribute('value'))).toEqual([
            'Kitchen',
            'Bathroom',
            'Garage',
        ]);
    });

    it('renders an empty datalist when no rooms are provided', () => {
        const { container } = render(<ChoreForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
        const datalist = container.querySelector('#room-options');
        expect(datalist).not.toBeNull();
        expect(datalist!.querySelectorAll('option')).toHaveLength(0);
    });

    it('accepts a brand-new free-text room and emits it unchanged in the submit payload', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        render(<ChoreForm rooms={['Kitchen', 'Bathroom']} onSubmit={onSubmit} onCancel={vi.fn()} />);

        await user.type(screen.getByLabelText('Name'), 'Dust');
        await user.type(screen.getByLabelText('Room'), 'Attic Loft');
        await user.type(screen.getByLabelText('Last Completed'), '2025-03-31');
        await user.type(screen.getByLabelText('Duration (minutes)'), '15');
        await user.type(screen.getByLabelText('Frequency (days)'), '30');
        await user.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSubmit).toHaveBeenCalledOnce();
        expect(onSubmit.mock.calls[0][0].room).toBe('Attic Loft');
    });

    it('flows a selected existing room through unchanged in the submit payload', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        render(<ChoreForm rooms={['Kitchen', 'Bathroom']} onSubmit={onSubmit} onCancel={vi.fn()} />);

        await user.type(screen.getByLabelText('Name'), 'Wipe');
        await user.type(screen.getByLabelText('Room'), 'Bathroom');
        await user.type(screen.getByLabelText('Last Completed'), '2025-03-31');
        await user.type(screen.getByLabelText('Duration (minutes)'), '5');
        await user.type(screen.getByLabelText('Frequency (days)'), '3');
        await user.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSubmit).toHaveBeenCalledOnce();
        expect(onSubmit.mock.calls[0][0].room).toBe('Bathroom');
    });
});

describe('ChoreForm clear-✕ (F14)', () => {
    it('Name field shows a clear-✕ once typed and clears only Name on click', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        const onCancel = vi.fn();
        render(<ChoreForm onSubmit={onSubmit} onCancel={onCancel} />);

        await user.type(screen.getByLabelText('Name'), 'Sweep');
        await user.type(screen.getByLabelText('Room'), 'Kitchen');

        const clearName = screen.getByRole('button', { name: 'Clear Name' });
        expect(clearName.className).toContain('top-0');
        expect(clearName.className).not.toContain('top-1/2');

        await user.click(clearName);

        expect(screen.getByLabelText('Name')).toHaveValue('');
        expect(screen.getByLabelText('Room')).toHaveValue('Kitchen');
        expect(onSubmit).not.toHaveBeenCalled();
        expect(onCancel).not.toHaveBeenCalled();
    });

    it('Room field shows a clear-✕ once typed and clears only Room on click', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        const onCancel = vi.fn();
        render(<ChoreForm onSubmit={onSubmit} onCancel={onCancel} />);

        await user.type(screen.getByLabelText('Room'), 'Kitchen');
        await user.type(screen.getByLabelText('Name'), 'Sweep');

        const clearRoom = screen.getByRole('button', { name: 'Clear Room' });
        expect(clearRoom.className).toContain('top-0');
        expect(clearRoom.className).not.toContain('top-1/2');

        await user.click(clearRoom);

        expect(screen.getByLabelText('Room')).toHaveValue('');
        expect(screen.getByLabelText('Name')).toHaveValue('Sweep');
        expect(onSubmit).not.toHaveBeenCalled();
        expect(onCancel).not.toHaveBeenCalled();
    });

    it('clear-✕ is present immediately on mount in edit mode, with no typing', () => {
        render(
            <ChoreForm
                mode="edit"
                initialChore={makeChore({ id: 7, name: 'Mop', room: 'Kitchen' })}
                onSubmit={vi.fn()}
                onCancel={vi.fn()}
            />,
        );

        expect(screen.getByRole('button', { name: 'Clear Name' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Clear Room' })).toBeInTheDocument();
    });

    it('clicking clear returns focus to the Room field', async () => {
        const user = userEvent.setup();
        render(<ChoreForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

        await user.type(screen.getByLabelText('Room'), 'Kitchen');
        await user.click(screen.getByRole('button', { name: 'Clear Room' }));

        expect(screen.getByLabelText('Room')).toHaveFocus();
    });
});
