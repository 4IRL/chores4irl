import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FormField from '../../components/form/FormField';

describe('FormField', () => {
    it('does not render a clear button when clearable is omitted', () => {
        render(<FormField name="name" label="Name" value="abc" onChange={vi.fn()} />);
        expect(screen.queryByRole('button', { name: 'Clear Name' })).toBeNull();
    });

    it('does not render a clear button when clearable is true but value is empty', () => {
        render(<FormField name="name" label="Name" value="" onChange={vi.fn()} clearable />);
        expect(screen.queryByRole('button', { name: 'Clear Name' })).toBeNull();
    });

    it('renders a clear button and clears when clearable and non-empty', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(<FormField name="name" label="Name" value="abc" onChange={onChange} clearable />);

        const clearButton = screen.getByRole('button', { name: 'Clear Name' });
        await user.click(clearButton);

        expect(onChange).toHaveBeenCalledWith('name', '');
        expect(clearButton.className).toContain('top-0');
        expect(clearButton.className).not.toContain('top-1/2');
    });

    it('clicking clear returns focus to the field', async () => {
        const user = userEvent.setup();
        render(<FormField name="name" label="Name" value="abc" onChange={vi.fn()} clearable />);

        const clearButton = screen.getByRole('button', { name: 'Clear Name' });
        await user.click(clearButton);

        expect(screen.getByLabelText('Name')).toHaveFocus();
    });
});
