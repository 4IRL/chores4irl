type ProgressBarProps = {
    width: number;
    color: string;
    isUrgent?: boolean;
};

export default function ProgressBar({ width, color, isUrgent }: ProgressBarProps) {
    return (
        <div
            className={`absolute left-0 top-0 h-full rounded-full transition-all duration-300 ease-in-out flex items-center justify-center ${color}`}
            style={{ width: `${width}%` }}
        >
            {isUrgent && (
                <span className="text-white text-xs font-bold tracking-wide uppercase">
                    Urgent
                </span>
            )}
        </div>
    );
}
