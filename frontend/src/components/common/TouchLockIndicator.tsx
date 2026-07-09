import { LockKeyhole, LockKeyholeOpen } from 'lucide-react';

type TouchLockIndicatorProps = {
    isLocked: boolean;
};

export default function TouchLockIndicator({ isLocked }: TouchLockIndicatorProps) {
    return (
        <div
            className="fixed top-2 left-2 z-[80] pointer-events-none"
            aria-hidden="true"
            data-testid="touch-lock-indicator"
        >
            {isLocked ? (
                <LockKeyhole className="w-5 h-5 text-gray-300" data-testid="touch-lock-icon-closed" />
            ) : (
                <LockKeyholeOpen className="w-5 h-5 text-gray-300" data-testid="touch-lock-icon-open" />
            )}
        </div>
    );
}
