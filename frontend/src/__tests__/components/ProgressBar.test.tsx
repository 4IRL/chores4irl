import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ProgressBar from '../../components/chore/ProgressBar';

describe('ProgressBar', () => {
    it('renders without crashing with width and color props', () => {
        const { container } = render(<ProgressBar width={75} color="bg-green-500" />);
        const bar = container.firstChild as HTMLElement;
        expect(bar).toBeInTheDocument();
        expect(bar.style.width).toBe('75%');
        expect(bar.className).toContain('bg-green-500');
        // opacity-50, not the Tailwind v3 bg-opacity-50 — that utility was removed in v4
        // and compiled to nothing, leaving the fill fully opaque.
        expect(bar.className).toContain('opacity-50');
        expect(bar.className).not.toContain('bg-opacity-50');
    });
});
