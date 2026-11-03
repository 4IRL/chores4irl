import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClearButton from './ClearButton';

describe('ClearButton', () => {
  it('is a type=button with an accessible name of "Clear <label>"', () => {
    render(<ClearButton label="Name" onClick={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'Clear Name' });
    expect(button).toHaveAttribute('type', 'button');
  });

  it('calls onClick once per click', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ClearButton label="Name" onClick={onClick} />);

    await user.click(screen.getByRole('button', { name: 'Clear Name' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
