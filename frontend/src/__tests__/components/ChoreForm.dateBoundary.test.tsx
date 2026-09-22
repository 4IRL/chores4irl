import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChoreForm from '../../components/form/ChoreForm';
import ChoreTimerBar from '../../components/chore/ChoreTimerBar';
import { makeChore } from '../fixtures/chore';
import type { Chore } from '@customTypes/SharedTypes';

// Fills the add form and submits it; returns the payload handed to onSubmit.
// Every Date fixture in this file is built inside the `it` body: the describe.each
// callback runs at collection time, before beforeAll has set TZ, so a describe-scope
// `new Date(...)` would be built in the host zone.
async function submitAddForm(typedDate: string): Promise<Omit<Chore, 'id'>> {
    const onSubmit = vi.fn();
    render(<ChoreForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Name'), 'Sweep');
    await user.type(screen.getByLabelText('Room'), 'Kitchen');
    await user.clear(screen.getByLabelText('Last Completed'));
    await user.type(screen.getByLabelText('Last Completed'), typedDate);
    await user.type(screen.getByLabelText('Duration (minutes)'), '10');
    await user.type(screen.getByLabelText('Frequency (days)'), '7');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledOnce();
    return onSubmit.mock.calls[0][0] as Omit<Chore, 'id'>;
}

describe.each([['America/New_York'], ['Asia/Tokyo']])('ChoreForm date boundary under TZ=%s (F21)', (tz) => {
    // Node re-reads process.env.TZ on the next Date call (runtime TZ re-read since Node 13;
    // verified locally on 22 and 24; CI runs Node 20 with no TZ env) and the forks pool
    // isolates the assignment per file.
    let previousTz: string | undefined;

    beforeAll(() => {
        previousTz = process.env.TZ;
        process.env.TZ = tz;
    });

    afterAll(() => {
        if (previousTz === undefined) delete process.env.TZ;
        else process.env.TZ = previousTz;
    });

    it('the TZ pin is in effect (guards against a silently vacuous run)', () => {
        // New York is UTC-4 on 2025-03-31 (DST from Mar 9); Tokyo is UTC+9 year-round.
        expect(new Date(2025, 2, 31).getTimezoneOffset()).toBe(tz === 'Asia/Tokyo' ? -540 : 240);
    });

    it('Case A: submit emits local midnight of the typed day', async () => {
        const payload = await submitAddForm('2025-03-31');

        expect(payload.dateLastCompleted.getFullYear()).toBe(2025);
        expect(payload.dateLastCompleted.getMonth()).toBe(2);
        expect(payload.dateLastCompleted.getDate()).toBe(31);
        expect(payload.dateLastCompleted.getHours()).toBe(0);
        expect(payload.dateLastCompleted.getMinutes()).toBe(0);
    });

    it('Case B: edit pre-fills the local calendar day of an evening instant', () => {
        render(
            <ChoreForm
                mode="edit"
                initialChore={makeChore({ dateLastCompleted: new Date(2025, 2, 31, 21, 30, 0) })}
                onSubmit={vi.fn()}
                onCancel={vi.fn()}
            />,
        );

        expect(screen.getByLabelText('Last Completed')).toHaveValue('2025-03-31');
    });

    it('Case B2: edit pre-fills the local calendar day of a morning instant', () => {
        render(
            <ChoreForm
                mode="edit"
                initialChore={makeChore({ dateLastCompleted: new Date(2025, 2, 31, 3, 0, 0) })}
                onSubmit={vi.fn()}
                onCancel={vi.fn()}
            />,
        );

        expect(screen.getByLabelText('Last Completed')).toHaveValue('2025-03-31');
    });

    it('Case C: an untouched edit round-trips the calendar day and collapses to local midnight', async () => {
        const onSubmit = vi.fn();
        render(
            <ChoreForm
                mode="edit"
                initialChore={makeChore({ dateLastCompleted: new Date(2025, 2, 31, 21, 30, 0) })}
                onSubmit={onSubmit}
                onCancel={vi.fn()}
            />,
        );
        const user = userEvent.setup();

        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        expect(onSubmit).toHaveBeenCalledOnce();
        const payload = onSubmit.mock.calls[0][0] as Omit<Chore, 'id'>;
        expect(payload.dateLastCompleted.getFullYear()).toBe(2025);
        expect(payload.dateLastCompleted.getMonth()).toBe(2);
        expect(payload.dateLastCompleted.getDate()).toBe(31);
        expect(payload.dateLastCompleted.getHours()).toBe(0);
        expect(payload.dateLastCompleted.getMinutes()).toBe(0);
    });

    it('Case D: a chore added through the form reads "0 days ago" on its own day', async () => {
        const payload = await submitAddForm('2025-03-31');

        render(
            <ChoreTimerBar
                chore={{ id: 1, ...payload }}
                day={new Date(2025, 2, 31, 12, 0, 0)}
                isSimulating={false}
                onComplete={vi.fn()}
                onDelete={vi.fn()}
                onEdit={vi.fn()}
            />,
        );

        expect(screen.getByText('0 days ago')).toBeInTheDocument();
    });
});
