type ChoreInfoProps = {
    name: string;
    room: string;
    frequency: number;
};

export default function ChoreInfo({ name, room, frequency }: ChoreInfoProps) {
    return (
        <div className="font-medium text-white">
            {name}
            <div className="text-xs text-white text-opacity-80">
                {room} · Every {frequency} days
            </div>
        </div>
    );
}
