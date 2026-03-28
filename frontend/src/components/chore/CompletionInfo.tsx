type CompletionInfoProps = {
    date: Date;
    daysSince: number;
};

export default function CompletionInfo({ date, daysSince }: CompletionInfoProps) {
    return (
        <div className="font-medium text-white text-right">
            <div className="text-xs text-white text-opacity-80">Last Completed:</div>
            {date.toDateString()}
            <div className="text-white text-sm font-bold">
                {daysSince} {daysSince === 1 ? 'day' : 'days'} ago
            </div>
        </div>
    );
}
