// Live refresh triggers for ChoresView (see ARCHITECTURE.md "Live refresh"). A trigger (visible
// edge, window focus, poll tick) calls the injected `refresh` only when the page is visible and
// online, no hold is held, the outbox is not flushing and has no queued entries, and no refresh is
// already in flight (single-flight). A gated trigger is remembered and runs once when the last
// hold releases, a flush ends or the queue changes. The apply-time epoch lets `refresh` drop a
// result that lands after a hold was taken (it returns 'deferred', and the hook re-pulls).
import { useEffect, useRef, useState } from 'react';
import type { Outbox } from '../outbox/outbox';

export const LIVE_REFRESH_INTERVAL_MS = 30_000;

export type RefreshResult = 'done' | 'deferred';

type RefreshOutbox = Pick<Outbox, 'isFlushing' | 'subscribeFlushing' | 'getEntries' | 'subscribe'>;

type RefreshControls = {
  trigger: () => void;
  runPending: () => void;
  acquireHold: () => void;
  releaseHold: () => void;
};

export function useChoreRefresh(options: {
  refresh: (ctx: { isUnchanged: () => boolean }) => Promise<RefreshResult>;
  intervalMs: number;
  outbox: RefreshOutbox;
}): { acquireHold: () => void; releaseHold: () => void } {
  const { refresh, intervalMs, outbox } = options;

  const refreshRef = useRef(refresh);
  const outboxRef = useRef(outbox);
  useEffect(() => {
    refreshRef.current = refresh;
    outboxRef.current = outbox;
  });
  const holdCountRef = useRef(0);
  const epochRef = useRef(0);
  const pendingRef = useRef(false);
  const inFlightRef = useRef(false);
  const disposedRef = useRef(false);

  // Built once and reading only refs, so the functions are stable and need no dependency arrays.
  const [controls] = useState<RefreshControls>(() => {
    function gated(): boolean {
      return (
        holdCountRef.current > 0 ||
        outboxRef.current.isFlushing() ||
        outboxRef.current.getEntries().length > 0
      );
    }

    function settle() {
      inFlightRef.current = false;
      runPending();
    }

    function trigger() {
      if (disposedRef.current) return;
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      if (gated()) {
        pendingRef.current = true;
        return;
      }
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      const epoch = epochRef.current;
      let pull: Promise<RefreshResult>;
      try {
        pull = refreshRef.current({
          isUnchanged: () => epochRef.current === epoch && holdCountRef.current === 0,
        });
      } catch {
        settle();
        return;
      }
      pull.then((result) => {
        if (result === 'deferred') pendingRef.current = true;
        settle();
      }, settle);
    }

    // A pending trigger waits out an in-flight refresh (it re-runs from settle), so a gate that
    // clears mid-flight still gets its re-pull.
    function runPending() {
      if (pendingRef.current && !gated() && !inFlightRef.current) {
        pendingRef.current = false;
        trigger();
      }
    }

    function acquireHold() {
      holdCountRef.current += 1;
      epochRef.current += 1;
    }

    function releaseHold() {
      holdCountRef.current = Math.max(0, holdCountRef.current - 1);
      runPending();
    }

    return { trigger, runPending, acquireHold, releaseHold };
  });

  useEffect(() => {
    const { trigger, runPending } = controls;
    disposedRef.current = false;
    let pollId: ReturnType<typeof setInterval> | undefined;

    function startPoll() {
      if (intervalMs > 0 && document.visibilityState === 'visible') {
        pollId = setInterval(trigger, intervalMs);
      }
    }

    function stopPoll() {
      if (pollId !== undefined) {
        clearInterval(pollId);
        pollId = undefined;
      }
    }

    function handleVisibilityChange() {
      stopPoll();
      if (document.visibilityState === 'visible') {
        trigger();
        startPoll();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', trigger);
    const unsubscribeFlushing = outbox.subscribeFlushing(runPending);
    const unsubscribeEntries = outbox.subscribe(runPending);
    startPoll();

    return () => {
      disposedRef.current = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', trigger);
      stopPoll();
      unsubscribeFlushing();
      unsubscribeEntries();
    };
  }, [intervalMs, outbox, controls]);

  return { acquireHold: controls.acquireHold, releaseHold: controls.releaseHold };
}
