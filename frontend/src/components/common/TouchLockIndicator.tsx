import { LockKeyhole, LockKeyholeOpen } from 'lucide-react';

type TouchLockIndicatorProps = {
    isLocked: boolean;
    onLock: () => void;
    onUnlock: () => void;
    raised?: boolean;
};

// F20: the indicator is the kiosk-level lock/unlock control (the state control
// F15 raises to the pi-kiosk shell). Its top-left corner position is the accident
// guard, so a single tap toggles: it locks immediately when unlocked and unlocks
// when locked, with no overlay animation needed to unlock. `z-40` keeps it under
// the `z-50` modal backdrops, so a corner tap with a modal open cancels the modal
// and never toggles the lock (DD-5). `raised` lifts it to `z-[95]` (above the
// `z-[90]` lock overlay, under the `z-[100]` blank) while a guarded-attempt padlock
// shows, so a corner tap unlocks instead of being swallowed as a far tap (DD-22).
export default function TouchLockIndicator({ isLocked, onLock, onUnlock, raised = false }: TouchLockIndicatorProps) {
    return (
        <button
            type="button"
            onClick={isLocked ? onUnlock : onLock}
            aria-label={isLocked ? 'Unlock screen' : 'Lock screen'}
            data-testid="touch-lock-indicator"
            className={`fixed top-2 left-2 ${raised ? 'z-[95]' : 'z-40'} flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400`}
        >
            {isLocked ? (
                <LockKeyhole className="w-5 h-5 text-gray-300" aria-hidden="true" data-testid="touch-lock-icon-closed" />
            ) : (
                <LockKeyholeOpen className="w-5 h-5 text-gray-300" aria-hidden="true" data-testid="touch-lock-icon-open" />
            )}
        </button>
    );
}
