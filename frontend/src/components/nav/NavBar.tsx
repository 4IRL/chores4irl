import RoomTab from './RoomTab';

type NavBarProps = {
    rooms: string[];
    selectedRoom: string;
    onSelect: (room: string) => void;
};

export default function NavBar({ rooms, selectedRoom, onSelect }: NavBarProps) {
    // F20: the 56 px left gutter (pl-14) keeps the tabs clear of the fixed 44 px lock
    // button at top-2 left-2 (8–52 px), which would otherwise catch taps meant for *All*;
    // the divider (border-b) stays full-bleed.
    return (
        <div id="NavBar" className="border-b border-gray-700 flex-shrink-0 pl-14 pr-4">
            <div className="container mx-auto flex space-x-1 overflow-x-auto scrollbar-none">
                <RoomTab label="All" value="all" isActive={selectedRoom === 'all'} onClick={onSelect} />
                {rooms.map(room => (
                    <RoomTab key={room} label={room} value={room} isActive={selectedRoom === room} onClick={onSelect} />
                ))}
            </div>
        </div>
    );
}
