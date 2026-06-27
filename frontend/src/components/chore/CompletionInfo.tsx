type CompletionInfoProps = {
    date: Date;
    daysSince: number;
};

export default function CompletionInfo({ date, daysSince }: CompletionInfoProps) {
    return (
        <div className="text-white text-right text-xs min-w-0">
            <span className="sr-only">Last Completed: </span>
            {date.toDateString()}
            <div className="text-white text-sm font-bold">
                {daysSince} {daysSince === 1 ? 'day' : 'days'} ago
            </div>
        </div>
    );
}
