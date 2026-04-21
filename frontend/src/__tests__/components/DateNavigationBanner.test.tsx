import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import DateNavigationBanner from '../../components/nav/DateNavigationBanner';

describe('DateNavigationBanner', () => {
    it('renders the provided day as a large centered heading', () => {
        render(
            <DateNavigationBanner
                simulatedDate={new Date(2025, 0, 15)}
                dayOffset={0}
                onPrev={vi.fn()}
                onNext={vi.fn()}
                onReset={vi.fn()}
            />
        );
        const heading = screen.getByRole('heading', { level: 1 });
        expect(heading).toHaveTextContent('Wed Jan 15 2025');
        expect(heading.className).toMatch(/text-center/);
        expect(heading.className).toMatch(/text-(2xl|3xl|4xl|5xl|6xl)/);
    });

    it('shows forward arrow and hides back arrow and reset when dayOffset === 0', () => {
        render(
            <DateNavigationBanner
                simulatedDate={new Date(2025, 0, 15)}
                dayOffset={0}
                onPrev={vi.fn()}
                onNext={vi.fn()}
                onReset={vi.fn()}
            />
        );
        expect(screen.getByRole('button', { name: 'Next day' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Previous day' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Reset to today' })).toBeNull();
    });

    it('shows back arrow and reset when dayOffset > 0', () => {
        render(
            <DateNavigationBanner
                simulatedDate={new Date(2025, 0, 17)}
                dayOffset={2}
                onPrev={vi.fn()}
                onNext={vi.fn()}
                onReset={vi.fn()}
            />
        );
        expect(screen.getByRole('button', { name: 'Next day' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Previous day' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Reset to today' })).toBeInTheDocument();
    });

    it('clicking next invokes onNext', async () => {
        const onNext = vi.fn();
        const user = userEvent.setup();
        render(
            <DateNavigationBanner
                simulatedDate={new Date(2025, 0, 15)}
                dayOffset={0}
                onPrev={vi.fn()}
                onNext={onNext}
                onReset={vi.fn()}
            />
        );
        await user.click(screen.getByRole('button', { name: 'Next day' }));
        expect(onNext).toHaveBeenCalledOnce();
        expect(onNext).toHaveBeenCalledWith();
    });

    it('clicking previous invokes onPrev', async () => {
        const onPrev = vi.fn();
        const user = userEvent.setup();
        render(
            <DateNavigationBanner
                simulatedDate={new Date(2025, 0, 16)}
                dayOffset={1}
                onPrev={onPrev}
                onNext={vi.fn()}
                onReset={vi.fn()}
            />
        );
        await user.click(screen.getByRole('button', { name: 'Previous day' }));
        expect(onPrev).toHaveBeenCalledOnce();
        expect(onPrev).toHaveBeenCalledWith();
    });

    it('clicking reset invokes onReset', async () => {
        const onReset = vi.fn();
        const user = userEvent.setup();
        render(
            <DateNavigationBanner
                simulatedDate={new Date(2025, 0, 18)}
                dayOffset={3}
                onPrev={vi.fn()}
                onNext={vi.fn()}
                onReset={onReset}
            />
        );
        await user.click(screen.getByRole('button', { name: 'Reset to today' }));
        expect(onReset).toHaveBeenCalledOnce();
        expect(onReset).toHaveBeenCalledWith();
    });

    it('applies slide-in-right class to the heading after clicking Next', async () => {
        const user = userEvent.setup();
        function Harness() {
            const [offset, setOffset] = useState(0);
            const base = new Date(2025, 0, 15);
            const simulated = new Date(base);
            simulated.setDate(base.getDate() + offset);
            return (
                <DateNavigationBanner
                    simulatedDate={simulated}
                    dayOffset={offset}
                    onPrev={() => setOffset((o) => Math.max(0, o - 1))}
                    onNext={() => setOffset((o) => o + 1)}
                    onReset={() => setOffset(0)}
                />
            );
        }
        render(<Harness />);
        await user.click(screen.getByRole('button', { name: 'Next day' }));
        const heading = screen.getByRole('heading', { level: 1 });
        expect(heading.className).toMatch(/slide-in-right/);
    });

    it('omits previous button when dayOffset === 0 even if onPrev is provided', () => {
        const onPrev = vi.fn();
        render(
            <DateNavigationBanner
                simulatedDate={new Date(2025, 0, 15)}
                dayOffset={0}
                onPrev={onPrev}
                onNext={vi.fn()}
                onReset={vi.fn()}
            />
        );
        expect(screen.queryByRole('button', { name: 'Previous day' })).toBeNull();
    });
});
