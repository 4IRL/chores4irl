import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChoreSearchInput from './ChoreSearchInput';

describe('ChoreSearchInput', () => {
  it('has search attributes and the exact accessible name', () => {
    render(<ChoreSearchInput value="" onChange={vi.fn()} />);
    const input = screen.getByRole('searchbox', { name: 'Search chores' });
    expect(input).toHaveAttribute('type', 'search');
    expect(input).toHaveAttribute('enterkeyhint', 'search');
  });

  it('shows Clear search only for a non-empty value and refocuses the input', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<ChoreSearchInput value="" onChange={onChange} />);
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
    rerender(<ChoreSearchInput value="abc" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onChange).toHaveBeenCalledWith('');
    expect(screen.getByLabelText('Search chores')).toHaveFocus();
  });

  it('Escape clears and keeps focus; Enter blurs', async () => {
    const onChange = vi.fn();
    render(<ChoreSearchInput value="abc" onChange={onChange} />);
    const input = screen.getByLabelText('Search chores');
    await userEvent.click(input);
    await userEvent.keyboard('{Escape}');
    expect(onChange).toHaveBeenCalledWith('');
    expect(input).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(input).not.toHaveFocus();
  });

  it('disables the input but keeps Clear search operable', async () => {
    const onChange = vi.fn();
    const onClearWhileDisabled = vi.fn();
    render(
      <ChoreSearchInput
        value="abc"
        onChange={onChange}
        disabled
        onClearWhileDisabled={onClearWhileDisabled}
      />,
    );
    expect(screen.getByLabelText('Search chores')).toBeDisabled();
    const clear = screen.getByRole('button', { name: 'Clear search' });
    expect(clear).toBeEnabled();
    await userEvent.click(clear);
    expect(onChange).toHaveBeenCalledWith('');
    expect(onClearWhileDisabled).toHaveBeenCalledTimes(1);
  });
});
