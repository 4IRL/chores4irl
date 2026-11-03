import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NavBar from './NavBar';

function renderNavBar(isAdmin: boolean) {
  return render(
    <MemoryRouter>
      <NavBar rooms={[]} selectedRoom="all" onSelect={() => {}} isAdmin={isAdmin} />
    </MemoryRouter>,
  );
}

describe('NavBar', () => {
  it('labels the House entry "House / Admin" when the current user is an admin', () => {
    renderNavBar(true);
    expect(screen.getByTestId('admin-nav-link')).toHaveTextContent('House / Admin');
  });

  it('labels the House entry just "House" when the current user is not an admin, but still shows it', () => {
    renderNavBar(false);
    expect(screen.getByTestId('admin-nav-link')).toHaveTextContent('House');
    expect(screen.getByTestId('admin-nav-link')).not.toHaveTextContent('Admin');
  });

  it('does not mark the Admin link as active while on another route', () => {
    renderNavBar(true);
    expect(screen.getByTestId('admin-nav-link')).not.toHaveClass('bg-teal-800');
  });

  it('marks the Admin link as active while on the Admin route', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <NavBar rooms={[]} selectedRoom="all" onSelect={() => {}} isAdmin={true} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('admin-nav-link')).toHaveClass('bg-teal-800');
  });

  it('uses the same distinct teal color family regardless of admin status', () => {
    const { rerender } = render(
      <MemoryRouter>
        <NavBar rooms={[]} selectedRoom="all" onSelect={() => {}} isAdmin={false} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('admin-nav-link')).toHaveClass('bg-teal-900/40');

    rerender(
      <MemoryRouter>
        <NavBar rooms={[]} selectedRoom="all" onSelect={() => {}} isAdmin={true} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('admin-nav-link')).toHaveClass('bg-teal-900/40');
  });

  it('does not leave "All" marked active while on the Admin route', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <NavBar rooms={[]} selectedRoom="all" onSelect={() => {}} isAdmin={true} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'All' })).not.toHaveClass('text-indigo-400');
  });

  it('marks "All" active on Home, independent of the Admin link', () => {
    renderNavBar(true);

    expect(screen.getByRole('button', { name: 'All' })).toHaveClass('text-indigo-400');
  });

  it('applies the scrollbar-none and scroll-fade-x utilities to the room-tabs strip', () => {
    renderNavBar(true);

    const roomTabsRegion = screen.getByRole('button', { name: 'All' }).closest('.overflow-x-auto');
    expect(roomTabsRegion).toHaveClass('scrollbar-none');
    expect(roomTabsRegion).toHaveClass('scroll-fade-x');
  });

  it('keeps the House link outside the scrollable room-tabs region, and never shrinks it', () => {
    renderNavBar(true);

    const roomTabsRegion = screen.getByRole('button', { name: 'All' }).closest('.overflow-x-auto');
    expect(roomTabsRegion).not.toBeNull();
    expect(roomTabsRegion).not.toContainElement(screen.getByTestId('admin-nav-link'));
    expect(screen.getByTestId('admin-nav-link')).toHaveClass('flex-shrink-0');
  });
});
