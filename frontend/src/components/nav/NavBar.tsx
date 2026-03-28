import RoomTab from './RoomTab';

type NavBarProps = {
    rooms: string[];
    selectedRoom: string;
    onSelect: (room: string) => void;
};

export default function NavBar({ rooms, selectedRoom, onSelect }: NavBarProps) {
    return (
        <div id="NavBar" className="border-b border-gray-700">
            <div className="container mx-auto flex space-x-1">
                <RoomTab label="All" value="all" isActive={selectedRoom === 'all'} onClick={onSelect} />
                {rooms.map(room => (
                    <RoomTab key={room} label={room} value={room} isActive={selectedRoom === room} onClick={onSelect} />
                ))}
            </div>
        </div>
    );
}
