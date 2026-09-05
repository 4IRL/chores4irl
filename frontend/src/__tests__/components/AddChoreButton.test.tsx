import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AddChoreButton from '../../components/form/AddChoreButton';

describe('AddChoreButton', () => {
    it('renders a translucent blue button', () => {
        render(<AddChoreButton onClick={vi.fn()} />);
        const button = screen.getByRole('button', { name: /add task/i });
        expect(button.className).toContain('bg-blue-500/50');
        // Tailwind v4 dropped bg-opacity-*; it compiles to nothing and leaves the
        // button fully opaque, so guard against the dead v3 utility creeping back in.
        expect(button.className).not.toContain('bg-opacity-50');
    });
});
