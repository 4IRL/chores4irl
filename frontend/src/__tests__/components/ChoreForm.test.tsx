import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChoreForm from '../../components/form/ChoreForm';
import { makeChore } from '../fixtures/chore';

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
                    details: 'wet',
                    room: 'Kitchen',
                    dateLastCompleted: new Date('2025-03-31T00:00:00.000Z'),
                    duration: 45,
                    frequency: 7,
                    urgency: 'low',
                    longTermTask: true,
                })}
                onSubmit={vi.fn()}
                onCancel={vi.fn()}
            />,
        );

        expect(screen.getByLabelText('Name')).toHaveValue('Mop');
        expect(screen.getByLabelText('Details')).toHaveValue('wet');
        expect(screen.getByLabelText('Room')).toHaveValue('Kitchen');
        expect(screen.getByLabelText('Last Completed')).toHaveValue('2025-03-31');
        expect(screen.getByLabelText('Duration (minutes)')).toHaveValue(45);
        expect(screen.getByLabelText('Frequency (days)')).toHaveValue(7);
        expect(screen.getByLabelText('Long-term task')).toBeChecked();
        expect(screen.getByRole('combobox')).toHaveValue('low');
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
                    details: 'wet',
                    room: 'Kitchen',
                    dateLastCompleted: new Date('2025-03-31T00:00:00.000Z'),
                    duration: 45,
                    frequency: 7,
                    urgency: 'low',
                    longTermTask: true,
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
        expect(payload.duration).toBe(45);
        expect(payload.frequency).toBe(7);
        expect(payload.details).toBe('wet');
        expect(payload.urgency).toBe('low');
        expect(payload.longTermTask).toBe(true);
        expect(payload).not.toHaveProperty('id');
    });
});
