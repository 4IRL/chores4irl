import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgressBar from '../../components/chore/ProgressBar';

describe('ProgressBar', () => {
    it('renders without crashing with width and color props', () => {
        const { container } = render(<ProgressBar width={75} color="bg-green-500" />);
        const bar = container.firstChild as HTMLElement;
        expect(bar).toBeInTheDocument();
        expect(bar.style.width).toBe('75%');
        expect(bar.className).toContain('bg-green-500');
    });

    // TODO: replace isUrgent checks with check for OverdueBadge visibility 
    // it('does not render the Urgent label when isUrgent is omitted', () => {
    //     render(<ProgressBar width={50} color="bg-orange-500" />);
    //     expect(screen.queryByText('Urgent')).not.toBeInTheDocument();
    // });

    // it('does not render the Urgent label when isUrgent is false', () => {
    //     render(<ProgressBar width={50} color="bg-red-500" />);
    //     expect(screen.queryByText('Urgent')).not.toBeInTheDocument();
    // });

    // it('renders the Urgent label inside the bar when isUrgent is true', () => {
    //     render(<ProgressBar width={100} color="bg-red-500" />);
    //     expect(screen.getByText('Urgent')).toBeInTheDocument();
    // });
});
