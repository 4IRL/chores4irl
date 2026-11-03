import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FormField from './FormField';

function StatefulField({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <FormField name="name" label="Name" value={value} onChange={(_n, v) => setValue(v)} clearable />;
}

describe('FormField clearable', () => {
  it('renders no clear button and no .relative wrapper without clearable', () => {
    const { container } = render(<FormField name="name" label="Name" value="abc" onChange={vi.fn()} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(container.querySelector('.relative')).toBeNull();
  });

  it('renders no clear button when clearable and the value is empty', () => {
    render(<FormField name="name" label="Name" value="" onChange={vi.fn()} clearable />);

    expect(screen.queryByRole('button', { name: 'Clear Name' })).not.toBeInTheDocument();
  });

  it('clears the value and refocuses the input when the clear button is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FormField name="name" label="Name" value="abc" onChange={onChange} clearable />);

    await user.click(screen.getByRole('button', { name: 'Clear Name' }));

    expect(onChange).toHaveBeenCalledWith('name', '');
    expect(screen.getByLabelText('Name', { exact: true })).toHaveFocus();
  });

  it.each(['number', 'date'] as const)('renders no clear button for type=%s', (type) => {
    render(<FormField name="f" label="Field" value="5" onChange={vi.fn()} type={type} clearable />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('keeps the same focused input element when the first character is typed', async () => {
    const user = userEvent.setup();
    render(<StatefulField />);
    const input = screen.getByLabelText('Name', { exact: true });

    await user.click(input);
    await user.type(input, 'a');

    expect(screen.getByLabelText('Name', { exact: true })).toBe(input);
    expect(input).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Clear Name' })).toBeInTheDocument();
  });
});
