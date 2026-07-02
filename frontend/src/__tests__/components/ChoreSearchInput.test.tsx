import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChoreSearchInput from '../../components/chore/ChoreSearchInput';

describe('ChoreSearchInput', () => {
    it('renders the search input with the exact placeholder', () => {
        render(<ChoreSearchInput value="" onChange={vi.fn()} />);
        expect(screen.getByPlaceholderText('Search for a chore')).toBeInTheDocument();
    });

    it('renders the magnifying-glass (Search) icon', () => {
        const { container } = render(<ChoreSearchInput value="" onChange={vi.fn()} />);
        // lucide-react renders an <svg> with the lucide-search class
        const icon = container.querySelector('svg.lucide-search');
        expect(icon).not.toBeNull();
    });

    it('reflects the controlled value', () => {
        render(<ChoreSearchInput value="mop" onChange={vi.fn()} />);
        expect(screen.getByPlaceholderText('Search for a chore')).toHaveValue('mop');
    });

    it('fires onChange with the typed character', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(<ChoreSearchInput value="" onChange={onChange} />);

        await user.type(screen.getByPlaceholderText('Search for a chore'), 'a');

        expect(onChange).toHaveBeenCalledWith('a');
    });
});
