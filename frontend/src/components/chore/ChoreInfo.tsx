type ChoreInfoProps = {
    name: string;
};

export default function ChoreInfo({ name }: ChoreInfoProps) {
    return (
        <div className="font-medium text-white truncate min-w-0 text-left">{name}</div>
    );
}
