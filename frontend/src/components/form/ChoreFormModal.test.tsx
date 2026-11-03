import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Chore, Room } from '@customTypes/SharedTypes';
import ChoreFormModal from './ChoreFormModal';

const rooms: Room[] = [{ id: 1, householdId: 1, name: 'Kitchen' }];

const initialChore: Chore = {
  id: 7,
  name: 'Mop Floors',
  details: 'Use the blue bucket',
  roomId: 1,
  dateLastCompleted: new Date('2026-10-01T00:00:00Z'),
  duration: 20,
  frequency: 7,
};

function setup() {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(
    <ChoreFormModal
      mode="edit"
      initialChore={initialChore}
      rooms={rooms}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />,
  );
  return { onSubmit, onCancel, user: userEvent.setup() };
}

describe('ChoreFormModal clear buttons', () => {
  it('shows Clear Name and Clear Details on mount in edit mode', () => {
    setup();

    expect(screen.getByRole('button', { name: 'Clear Name' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear Details' })).toBeInTheDocument();
  });

  it('Clear Name empties only Name, focuses it, and neither submits nor cancels', async () => {
    const { user, onSubmit, onCancel } = setup();

    await user.click(screen.getByRole('button', { name: 'Clear Name' }));

    const name = screen.getByLabelText('Name', { exact: true });
    expect(name).toHaveValue('');
    expect(name).toHaveFocus();
    expect(screen.getByLabelText('Details')).toHaveValue('Use the blue bucket');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('Clear Details empties only Details, focuses it, and neither submits nor cancels', async () => {
    const { user, onSubmit, onCancel } = setup();

    await user.click(screen.getByRole('button', { name: 'Clear Details' }));

    const details = screen.getByLabelText('Details');
    expect(details).toHaveValue('');
    expect(details).toHaveFocus();
    expect(screen.getByLabelText('Name', { exact: true })).toHaveValue('Mop Floors');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('control: Save Changes on the same valid setup submits exactly once', async () => {
    const { user, onSubmit } = setup();

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('has no clear button for Last Completed, Duration or Frequency', () => {
    setup();

    expect(screen.queryByRole('button', { name: /^Clear (Last Completed|Duration|Frequency)/ })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Clear / })).toHaveLength(2);
  });
});
