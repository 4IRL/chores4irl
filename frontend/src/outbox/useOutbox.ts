import { useEffect, useSyncExternalStore } from 'react';
import { outbox as defaultOutbox, type FlushResult, type Outbox } from './outbox';

export function useOutbox(
  instance: Outbox = defaultOutbox,
  onFlushResults?: (results: FlushResult[]) => void,
) {
  const entries = useSyncExternalStore(instance.subscribe, instance.getEntries, instance.getEntries);

  useEffect(() => {
    if (!onFlushResults) return undefined;
    return instance.subscribeResults(onFlushResults);
  }, [instance, onFlushResults]);

  return { entries, append: instance.append, remove: instance.remove, flush: instance.flush };
}
