import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AddChoreButton from '../../components/form/AddChoreButton';

describe('AddChoreButton', () => {
    it('renders an opaque blue button', () => {
        render(<AddChoreButton onClick={vi.fn()} />);
        const button = screen.getByRole('button', { name: /add task/i });
        // F5: the deck is the translucent layer; the button itself is fully opaque.
        expect(button.className).toMatch(/(^|\s)bg-blue-500(\s|$)/);
        expect(button.className).not.toContain('bg-blue-500/');
        // Tailwind v4 dropped bg-opacity-*; it compiles to nothing and leaves the
        // button fully opaque, so guard against the dead v3 utility creeping back in.
        expect(button.className).not.toContain('bg-opacity-50');
    });
});
