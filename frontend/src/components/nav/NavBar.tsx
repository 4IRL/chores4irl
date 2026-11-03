import { NavLink, useLocation } from 'react-router-dom';
import type { Room } from '@customTypes/SharedTypes';
import RoomTab from './RoomTab';

type NavBarProps = {
  rooms: Room[];
  selectedRoom: string;
  onSelect: (room: string) => void;
  isAdmin?: boolean;
};

export default function NavBar({ rooms, selectedRoom, onSelect, isAdmin = false }: NavBarProps) {
  // Room tabs' active state is otherwise driven purely by selectedRoom,
  // which never resets on navigating away — so "All" stayed highlighted
  // even while on /admin. Room tabs are only ever actually active on Home.
  const isHome = useLocation().pathname === '/';

  return (
    <div id="NavBar" className="border-b border-gray-700 flex-shrink-0">
      <div className="container mx-auto flex items-center justify-between">
        {/* min-w-0 lets this flex child actually shrink below its content
            width — without it, overflow-x-auto never kicks in and the room
            tabs push the whole bar (including House) wider instead of
            scrolling. House sits outside this container entirely so it's
            never part of the scrolling region. */}
        <div className="flex items-center space-x-1 overflow-x-auto scrollbar-none scroll-fade-x min-w-0">
          <RoomTab label="All" value="all" isActive={isHome && selectedRoom === 'all'} onClick={onSelect} />
          {rooms.map((room) => (
            <RoomTab
              key={room.id}
              label={room.name}
              value={String(room.id)}
              isActive={isHome && selectedRoom === String(room.id)}
              onClick={onSelect}
            />
          ))}
        </div>
        {/* Open to every household member now, not admin-only — the label
            just reflects whether this viewer also has admin privileges. The
            all-users directory lives inside this page too, at the bottom,
            visible only to global admins — not a separate nav entry.
            Teal (not the indigo used for active room tabs/buttons elsewhere)
            marks this as a distinct, permanent app section rather than just
            another filter tab — same color family for every viewer,
            admin or not, active or not. flex-shrink-0 + living outside the
            scrollable sibling above keeps it always on-screen. */}
        <NavLink
          to="/admin"
          data-testid="admin-nav-link"
          className={({ isActive }) =>
            `flex-shrink-0 ml-2 px-4 sm:px-6 min-h-[44px] py-3 text-sm sm:text-base font-semibold flex items-center rounded-t-lg ${
              isActive
                ? 'bg-teal-800 text-teal-50 border-b-2 border-teal-300'
                : 'bg-teal-900/40 text-teal-300 hover:bg-teal-900/60 hover:text-teal-100'
            }`
          }
        >
          {isAdmin ? 'House / Admin' : 'House'}
        </NavLink>
      </div>
    </div>
  );
}
