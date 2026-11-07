// How far the row must be dragged before a swipe "commits" to opening the
// action buttons underneath, rather than springing back to closed.
export const SWIPE_TRIGGER_DISTANCE = 120;
// Android commits after a quarter of the bar's width, capped at the iOS distance.
const ANDROID_SWIPE_WIDTH_FRACTION = 0.25;

// Fails closed to the old fixed distance for any unmeasurable width (jsdom,
// detached or hidden bars), so a swipe can never commit at threshold 0.
export function androidSwipeThreshold(barWidth: number): number {
  if (!Number.isFinite(barWidth) || barWidth <= 0) return SWIPE_TRIGGER_DISTANCE;
  return Math.min(barWidth * ANDROID_SWIPE_WIDTH_FRACTION, SWIPE_TRIGGER_DISTANCE);
}
