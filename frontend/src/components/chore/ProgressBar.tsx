type ProgressBarProps = {
    width: number;
    color: string;
};

export default function ProgressBar({ width, color }: ProgressBarProps) {
    return (
        <div
            className={`absolute left-0 top-0 h-full rounded-full transition-all duration-300 ease-in-out flex items-center justify-center ${color}`}
            style={{ width: `${width}%` }}
        >
        </div>
    );
}
