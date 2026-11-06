import { useRef, useState, useMemo } from 'react';
import { useSwipeable } from 'react-swipeable';
import type { SwipeEventData } from 'react-swipeable';
import { Pencil, Trash2 } from 'lucide-react';
import type { Chore, SwipeStyle } from '@customTypes/SharedTypes';
import { computeBar } from '@utils/choreBarMath';
import { daysSinceInZone } from '@utils/choreSort';
import { useIsTouchDevice } from '../../hooks/useIsTouchDevice';
import ConfirmDialog from '../common/ConfirmDialog';
import ProgressBar from './ProgressBar';
import ChoreInfo from './ChoreInfo';
import CompletionInfo from './CompletionInfo';

type ChoreTimerBarProps = {
  chore: Chore;
  day: Date;
  householdTimezone: string;
  isSimulating: boolean;
  swipeStyle: SwipeStyle;
  onComplete: (id: number, date: Date) => void;
  onDelete: (id: number) => void;
  onEdit?: (id: number) => void;
};

// How far the row must be dragged before a swipe "commits" to opening the
// action buttons underneath, rather than springing back to closed.
const SWIPE_TRIGGER_DISTANCE = 120;
// Android commits after a quarter of the bar's width, capped at the iOS distance.
const ANDROID_SWIPE_WIDTH_FRACTION = 0.25;

// Fails closed to the old fixed distance for any unmeasurable width (jsdom,
// detached or hidden bars), so a swipe can never commit at threshold 0.
export function androidSwipeThreshold(barWidth: number): number {
  if (!Number.isFinite(barWidth) || barWidth <= 0) return SWIPE_TRIGGER_DISTANCE;
  return Math.min(barWidth * ANDROID_SWIPE_WIDTH_FRACTION, SWIPE_TRIGGER_DISTANCE);
}
// How far the row stays parked once opened — enough room for both circular
// buttons (h-12/w-12) side by side with a gap, or just one if there's no
// edit handler. Matches iOS Messages' floating circular swipe actions.
const OPEN_OFFSET_BOTH = 150;
const OPEN_OFFSET_DELETE_ONLY = 80;

export default function ChoreTimerBar({
  chore,
  day,
  householdTimezone,
  isSimulating,
  swipeStyle,
  onComplete,
  onDelete,
  onEdit,
}: ChoreTimerBarProps) {
  const daysSince = useMemo(
    () => daysSinceInZone(day, chore.dateLastCompleted, householdTimezone),
    [day, chore.dateLastCompleted, householdTimezone],
  );

  const { isOverdue, barWidth, barColor } = computeBar(daysSince, chore.frequency);
  const openOffset = onEdit ? OPEN_OFFSET_BOTH : OPEN_OFFSET_DELETE_ONLY;
  // Swipe-to-reveal is a touch affordance — a mouse-driven drag doesn't read
  // as discoverable on desktop, so non-touch pointers get edit/delete as
  // small always-visible buttons instead (see the branch in the JSX below).
  const isTouch = useIsTouchDevice();

  // Swiping no longer performs delete/edit directly — a single left-swipe
  // reveals both real, pressable buttons together and holds the row open
  // (like iOS Mail), so a completed swipe gesture can't by itself delete
  // anything; a separate, deliberate tap on a revealed button is required.
  // Only one direction does anything now — edit lives next to delete
  // instead of behind its own opposite-direction swipe.
  const [isOpen, setIsOpen] = useState(false);
  // Android mode never leaves the row open — a right-swipe past the
  // threshold asks for confirmation here rather than deleting immediately,
  // since a full-speed swipe is otherwise indistinguishable from an
  // accidental one.
  const [pendingDelete, setPendingDelete] = useState(false);

  const swipingRef = useRef(false);
  const justCommittedRef = useRef(false);
  // Android commit distance, measured once per gesture in onSwipeStart.
  const swipeThresholdRef = useRef(SWIPE_TRIGGER_DISTANCE);
  const barRef = useRef<HTMLDivElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const androidDeleteZoneRef = useRef<HTMLDivElement>(null);
  const androidEditZoneRef = useRef<HTMLDivElement>(null);

  // Snaps to whichever state (open/closed) is passed in — used both to
  // commit a completed gesture and to revert an abandoned one back to
  // wherever it already was (open or closed), so the same function works
  // for both directions instead of always resetting to closed.
  function animateTo(nextOpen: boolean) {
    const el = barRef.current;
    if (el) {
      el.style.transition = 'transform 150ms ease-out';
      el.style.transform = nextOpen ? `translateX(-${openOffset}px)` : '';
    }
    for (const btn of [editButtonRef.current, deleteButtonRef.current]) {
      if (!btn) continue;
      btn.style.transition = 'opacity 150ms ease-out';
      btn.style.opacity = nextOpen ? '1' : '0';
    }
  }

  function commitOpen() {
    setIsOpen(true);
    animateTo(true);
  }

  function commitClose() {
    setIsOpen(false);
    animateTo(false);
  }

  // Android mode has no persistent "open" state — every swipe (committed or
  // abandoned) springs the row straight back to its resting position, since
  // the swipe itself either fires an action (edit) or asks for confirmation
  // (delete) rather than leaving buttons parked open.
  function springBackAndroid() {
    const el = barRef.current;
    if (el) {
      el.style.transition = 'transform 150ms ease-out';
      el.style.transform = '';
    }
    for (const zone of [androidDeleteZoneRef.current, androidEditZoneRef.current]) {
      if (!zone) continue;
      zone.style.transition = 'opacity 150ms ease-out';
      zone.style.opacity = '0';
    }
  }

  const { ref: attachSwipeRef, ...swipeHandlers } = useSwipeable({
    onSwipeStart: () => {
      const el = barRef.current;
      if (el) el.style.transition = 'none';
      if (swipeStyle === 'android') {
        swipeThresholdRef.current = androidSwipeThreshold(el ? el.getBoundingClientRect().width : 0);
      }
      for (const btn of [
        editButtonRef.current,
        deleteButtonRef.current,
        androidDeleteZoneRef.current,
        androidEditZoneRef.current,
      ]) {
        if (btn) btn.style.transition = 'none';
      }
    },
    onSwiping: ({ deltaX, dir }: SwipeEventData) => {
      const el = barRef.current;
      if (!el) return;
      if (swipeStyle === 'android') {
        // Each direction commits its own single action directly — no
        // reveal-then-tap step — so the preview only needs to track
        // finger position and fade in whichever zone is being dragged
        // toward, not hold a persisted open/closed state like iOS.
        const threshold = swipeThresholdRef.current;
        if (dir === 'Right') {
          const clamped = Math.max(0, Math.min(threshold, deltaX));
          el.style.transform = `translateX(${clamped}px)`;
          const progress = String(Math.min(1, clamped / threshold));
          if (androidDeleteZoneRef.current) androidDeleteZoneRef.current.style.opacity = progress;
          if (androidEditZoneRef.current) androidEditZoneRef.current.style.opacity = '0';
        } else if (dir === 'Left' && onEdit) {
          const clamped = Math.max(-threshold, Math.min(0, deltaX));
          el.style.transform = `translateX(${clamped}px)`;
          const progress = String(Math.min(1, Math.abs(clamped) / threshold));
          if (androidEditZoneRef.current) androidEditZoneRef.current.style.opacity = progress;
          if (androidDeleteZoneRef.current) androidDeleteZoneRef.current.style.opacity = '0';
        }
        return;
      }
      if (!isOpen) {
        // Closed: only a left-swipe previews opening.
        if (dir !== 'Left') return;
        const clamped = Math.max(-SWIPE_TRIGGER_DISTANCE, Math.min(0, deltaX));
        el.style.transform = `translateX(${clamped}px)`;
        const progress = Math.min(1, Math.abs(clamped) / SWIPE_TRIGGER_DISTANCE);
        if (deleteButtonRef.current) deleteButtonRef.current.style.opacity = String(progress);
        if (editButtonRef.current) editButtonRef.current.style.opacity = String(progress);
      } else {
        // Open: only a right-swipe (swiping back) previews closing. This is
        // a real gesture handled here, not a fallback onto the native click
        // that fires after release — that only happens reliably for mouse
        // input. Touch browsers suppress the synthetic click after an
        // actual drag, so relying on a tap-only close left iOS with no way
        // to swipe a row shut once opened.
        if (dir !== 'Right') return;
        const dragged = Math.max(0, Math.min(SWIPE_TRIGGER_DISTANCE, deltaX));
        const position = Math.min(0, -openOffset + dragged);
        el.style.transform = `translateX(${position}px)`;
        const remaining = String(1 - Math.min(1, dragged / SWIPE_TRIGGER_DISTANCE));
        if (deleteButtonRef.current) deleteButtonRef.current.style.opacity = remaining;
        if (editButtonRef.current) editButtonRef.current.style.opacity = remaining;
      }
    },
    onSwipedLeft: (data) => {
      if (swipeStyle === 'android') {
        // Always handled here, committed or not — android has no "open"
        // state to fall back into like iOS does below.
        swipingRef.current = true;
        justCommittedRef.current = true;
        springBackAndroid();
        if (data.absX >= swipeThresholdRef.current && onEdit && !isSimulating) {
          onEdit(chore.id);
        }
        return;
      }
      if (isOpen) return;
      // A native click still fires after this release regardless of drag
      // distance (mouse input synthesizes one unconditionally) — mark this
      // as a swipe *before* checking whether it was far enough to commit,
      // so that stray click can't fall through to tap-to-complete below.
      swipingRef.current = true;
      // react-swipeable's own `delta` (below) is intentionally tiny so the
      // drag tracks the finger in real time from the first few pixels —
      // whether that ends up committing to open is decided here instead,
      // against our own much larger SWIPE_TRIGGER_DISTANCE.
      if (data.absX < SWIPE_TRIGGER_DISTANCE) return;
      if (isSimulating) return;
      justCommittedRef.current = true;
      commitOpen();
    },
    onSwipedRight: (data) => {
      if (swipeStyle === 'android') {
        swipingRef.current = true;
        justCommittedRef.current = true;
        springBackAndroid();
        // Never deletes directly — a fast full-speed swipe is otherwise
        // indistinguishable from an accidental one, so this only opens the
        // confirm dialog; the actual delete happens on its confirm tap.
        if (data.absX >= swipeThresholdRef.current && !isSimulating) {
          setPendingDelete(true);
        }
        return;
      }
      if (!isOpen) return;
      // Same reasoning as onSwipedLeft above — mark as a swipe before the
      // distance check so a short "attempted close" can't fall through to
      // the stray click and close anyway.
      swipingRef.current = true;
      if (data.absX < SWIPE_TRIGGER_DISTANCE) return;
      justCommittedRef.current = true;
      commitClose();
    },
    onTouchStartOrOnMouseDown: () => {
      swipingRef.current = false;
    },
    onTouchEndOrOnMouseUp: () => {
      // onSwiped(Dir) and this both fire on the same release — skip the
      // reset this one time so it doesn't immediately undo the commit we
      // just made above.
      if (justCommittedRef.current) {
        justCommittedRef.current = false;
        return;
      }
      // Reached here without onSwipedLeft/onSwipedRight ever firing (e.g. a
      // mostly-vertical drag) — still need to clear any zone opacity onSwiping
      // may have already faded in.
      if (swipeStyle === 'android') {
        springBackAndroid();
        return;
      }
      // Gesture didn't cross the threshold — revert to wherever it already
      // was (open or closed), not always back to closed.
      animateTo(isOpen);
    },
    // Deliberately small (react-swipeable's own default) — this only gates
    // when a drag is recognized as a swipe at all, so onSwiping starts
    // firing almost immediately for true 1:1 finger tracking in both
    // directions. It used to be set to SWIPE_TRIGGER_DISTANCE itself, which
    // suppressed onSwiping entirely for the first 120px of every gesture —
    // the drag visually did nothing until crossing that threshold, then
    // jumped straight to the clamped end position. That's exactly what read
    // as "not reacting in real time" and "can't swipe back right after
    // lifting a finger" (a fresh gesture starts the 120px count over).
    delta: 10,
    trackMouse: true,
    // Passive touch listeners (the default when this is false) let iOS
    // Safari's own scroll/gesture recognizer claim the touch sequence before
    // onSwipedLeft/onSwipedRight ever fire — true forces a non-passive
    // listener so this element can actually win the gesture on iOS.
    preventScrollOnSwipe: true,
  });

  function handleBarClick() {
    if (isSimulating) return;
    if (swipingRef.current) {
      swipingRef.current = false;
      return;
    }
    if (isOpen) {
      commitClose();
      return;
    }
    onComplete(chore.id, new Date());
  }

  function handleDeleteTap(e: React.MouseEvent) {
    e.stopPropagation();
    if (isSimulating) return;
    commitClose();
    onDelete(chore.id);
  }

  function handleEditTap(e: React.MouseEvent) {
    e.stopPropagation();
    if (isSimulating || !onEdit) return;
    commitClose();
    onEdit(chore.id);
  }

  return (
    <>
      <div
        data-testid="chore-row"
        className={isTouch ? 'relative h-20 sm:h-16 w-full' : 'flex items-center gap-2 h-20 sm:h-16 w-full'}
      >
        {/* Background layer: floating circular buttons on the page's own
          background (no rectangular block behind them), matching iOS
          Messages' swipe actions — edit sits next to delete so a single
          left-swipe reveals both, rather than each living behind its own
          opposite-direction swipe. Fades in as a preview while dragging,
          then becomes real pressable buttons once the swipe commits and
          holds the row open — swiping alone never performs the action.
          Touch-only: on a mouse-primary pointer there's no discoverable way
          to trigger a drag gesture, so this layer (and the swipe handlers
          below) are skipped entirely in favor of the always-visible buttons
          rendered beside the bar further down. */}
        {isTouch && swipeStyle === 'android' && (
          <div className="absolute inset-0 rounded-full overflow-hidden" data-testid="android-swipe-zones">
            <div
              ref={androidDeleteZoneRef}
              className="absolute inset-0 bg-red-600 flex items-center pl-6"
              style={{ opacity: 0 }}
            >
              <Trash2 size={22} className="text-white" />
            </div>
            {onEdit && (
              <div
                ref={androidEditZoneRef}
                className="absolute inset-0 bg-indigo-600 flex items-center justify-end pr-6"
                style={{ opacity: 0 }}
              >
                <Pencil size={22} className="text-white" />
              </div>
            )}
          </div>
        )}
        {isTouch && swipeStyle === 'ios' && (
          <div className="absolute inset-0 flex items-center justify-end gap-3 px-3">
            {onEdit && (
              <button
                ref={editButtonRef}
                type="button"
                disabled={!isOpen}
                onClick={handleEditTap}
                aria-label="Confirm edit"
                data-testid="edit-icon-preview"
                className={`h-12 w-12 rounded-full flex items-center justify-center bg-indigo-600 text-white opacity-0 ${isOpen ? '' : 'pointer-events-none'}`}
              >
                <Pencil size={20} />
              </button>
            )}
            <button
              ref={deleteButtonRef}
              type="button"
              disabled={!isOpen}
              onClick={handleDeleteTap}
              aria-label="Confirm delete"
              data-testid="delete-icon-preview"
              className={`h-12 w-12 rounded-full flex items-center justify-center bg-red-600 text-white opacity-0 ${isOpen ? '' : 'pointer-events-none'}`}
            >
              <Trash2 size={20} />
            </button>
          </div>
        )}

        <div
          {...(isTouch ? swipeHandlers : {})}
          ref={(el) => {
            // Attaching react-swipeable's ref (even without the spread
            // handlers) wires up its own native, non-passive touch listener —
            // so this has to be skipped too, not just the handlers above, to
            // fully disable swipe on a non-touch pointer.
            if (isTouch) attachSwipeRef(el);
            barRef.current = el;
          }}
          data-testid="chore-bar"
          className={`relative h-full ${isTouch ? 'w-full' : 'flex-1 min-w-0'} bg-gray-800 rounded-full shadow overflow-hidden touch-pan-y ${isSimulating ? 'cursor-not-allowed opacity-60 pointer-events-none' : 'cursor-pointer'}`}
          onClick={handleBarClick}
        >
          <ProgressBar width={barWidth} color={barColor} />
          {/* Name gets the biggest share (2fr) since it's the only free-text,
            unbounded-length field here — "Every N days" and the completion
            date are both short, fixed-format strings that never needed as
            much room as an equal 3-way split gave them. */}
          <div className="absolute inset-0 px-4 grid grid-cols-[2fr_0.8fr_1.4fr] items-center gap-2">
            <ChoreInfo name={chore.name} />
            <div className="text-xs text-white/80 text-center">Every {chore.frequency} days</div>
            <CompletionInfo
              date={chore.dateLastCompleted}
              daysSince={daysSince}
              householdTimezone={householdTimezone}
            />
          </div>

          {isOverdue && <span className="sr-only">Overdue</span>}

          {/* Swipe is the primary delete/edit affordance on touch; these
            sr-only buttons are the keyboard/AT fallback. On non-touch,
            edit/delete are real always-visible buttons rendered beside the
            bar (below) instead — a hidden fallback here would be redundant. */}
          {isTouch && (
            <>
              {onEdit && (
                <button
                  type="button"
                  className="sr-only focus:not-sr-only focus:absolute focus:right-12 focus:top-1/2 focus:-translate-y-1/2 focus:z-10 focus:px-3 focus:py-1 focus:bg-indigo-600 focus:text-white focus:text-sm focus:rounded-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(chore.id);
                  }}
                  aria-label="Edit chore"
                >
                  Edit chore
                </button>
              )}
              <button
                type="button"
                className="sr-only focus:not-sr-only focus:absolute focus:right-3 focus:top-1/2 focus:-translate-y-1/2 focus:z-10 focus:px-3 focus:py-1 focus:bg-red-600 focus:text-white focus:text-sm focus:rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(chore.id);
                }}
                aria-label="Delete chore"
              >
                Delete chore
              </button>
            </>
          )}
        </div>

        {!isTouch && (
          <div
            className={`flex items-center gap-1.5 shrink-0 ${isSimulating ? 'opacity-60 pointer-events-none' : ''}`}
          >
            {onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(chore.id);
                }}
                aria-label="Edit chore"
                title="Edit chore"
                className="h-8 w-8 rounded-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                <Pencil size={15} />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(chore.id);
              }}
              aria-label="Delete chore"
              title="Delete chore"
              className="h-8 w-8 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-500 text-white"
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>
      {pendingDelete && (
        <ConfirmDialog
          message={`Delete "${chore.name}"?`}
          onConfirm={() => {
            setPendingDelete(false);
            onDelete(chore.id);
          }}
          onCancel={() => setPendingDelete(false)}
        />
      )}
    </>
  );
}
