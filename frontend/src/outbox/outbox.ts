import type { ApiResponse } from '@customTypes/SharedTypes';

const STORAGE_KEY = 'outbox-v1';

export type ChorePayload = {
  name: string;
  roomId: number;
  dateLastCompleted: string;
  duration: number;
  frequency: number;
  urgency?: 'low' | 'medium' | 'high';
};

export type OutboxEntry =
  | { id: string; type: 'create'; payload: ChorePayload; tempId: number; createdAt: string }
  | {
      id: string;
      type: 'edit';
      payload: ChorePayload;
      choreId: number;
      baseVersion: number;
      createdAt: string;
    }
  | {
      id: string;
      type: 'complete';
      payload: { dateLastCompleted: string };
      choreId: number;
      createdAt: string;
    }
  | { id: string; type: 'delete'; choreId: number; createdAt: string };

export type NewOutboxEntry =
  | Omit<Extract<OutboxEntry, { type: 'create' }>, 'id' | 'createdAt'>
  | Omit<Extract<OutboxEntry, { type: 'edit' }>, 'id' | 'createdAt'>
  | Omit<Extract<OutboxEntry, { type: 'complete' }>, 'id' | 'createdAt'>
  | Omit<Extract<OutboxEntry, { type: 'delete' }>, 'id' | 'createdAt'>;

export type FlushOutcome = 'success' | 'conflict' | 'dropped-not-found' | 'error';

export type FlushResult = {
  entry: OutboxEntry;
  outcome: FlushOutcome;
  data?: unknown;
  /** HTTP status when the result came from a response; absent when the fetch threw. */
  status?: number;
};

const RETRYABLE_4XX = new Set([401, 403, 408, 429]);

// A 4xx other than the retryable ones is a permanent rejection: drop it so it cannot block the queue.
export function isPermanentRejection(status: number): boolean {
  return status >= 400 && status < 500 && !RETRYABLE_4XX.has(status);
}

export type Outbox = {
  append: (entry: NewOutboxEntry) => OutboxEntry;
  getEntries: () => OutboxEntry[];
  flush: () => Promise<FlushResult[]>;
  subscribe: (listener: () => void) => () => void;
  subscribeResults: (listener: (results: FlushResult[]) => void) => () => void;
  dispose: () => void;
};

function toRequest(entry: OutboxEntry): { url: string; init: RequestInit } {
  const jsonHeaders = { 'Content-Type': 'application/json' };
  switch (entry.type) {
    case 'create':
      return {
        url: '/api/chores',
        init: {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify({ ...entry.payload, clientId: entry.id }),
        },
      };
    case 'edit':
      return {
        url: `/api/chores/${entry.choreId}`,
        init: {
          method: 'PUT',
          headers: jsonHeaders,
          body: JSON.stringify({ ...entry.payload, version: entry.baseVersion }),
        },
      };
    case 'complete':
      return {
        url: `/api/chores/${entry.choreId}/complete`,
        init: { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(entry.payload) },
      };
    case 'delete':
      return { url: `/api/chores/${entry.choreId}`, init: { method: 'DELETE' } };
  }
}

function loadEntries(): OutboxEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OutboxEntry[]) : [];
  } catch {
    return [];
  }
}

export function createOutbox(fetchImpl: typeof fetch = fetch): Outbox {
  let entries: OutboxEntry[] = loadEntries();
  const listeners = new Set<() => void>();
  const resultListeners = new Set<(results: FlushResult[]) => void>();

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function notify() {
    listeners.forEach((listener) => listener());
  }

  function removeEntry(id: string) {
    entries = entries.filter((e) => e.id !== id);
    persist();
    notify();
  }

  function append(partial: NewOutboxEntry): OutboxEntry {
    const entry = {
      ...partial,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    } as OutboxEntry;
    entries = [...entries, entry];
    persist();
    notify();
    return entry;
  }

  async function flush(): Promise<FlushResult[]> {
    const results: FlushResult[] = [];
    for (const entry of [...entries]) {
      const { url, init } = toRequest(entry);
      let res: Response;
      try {
        res = await fetchImpl(url, init);
      } catch {
        results.push({ entry, outcome: 'error' });
        break;
      }

      const status = res.status;
      if (status === 409) {
        results.push({ entry, outcome: 'conflict', status });
        removeEntry(entry.id);
        continue;
      }
      if (status === 404 && entry.type === 'delete') {
        results.push({ entry, outcome: 'dropped-not-found', status });
        removeEntry(entry.id);
        continue;
      }
      if (!res.ok) {
        results.push({ entry, outcome: 'error', status });
        if (isPermanentRejection(status)) {
          removeEntry(entry.id);
          continue;
        }
        break;
      }

      let body: ApiResponse<unknown>;
      try {
        body = (await res.json()) as ApiResponse<unknown>;
      } catch {
        results.push({ entry, outcome: 'error', status });
        break;
      }
      results.push({ entry, outcome: 'success', data: body?.data, status });
      removeEntry(entry.id);
    }
    if (results.length > 0) {
      resultListeners.forEach((listener) => listener(results));
    }
    return results;
  }

  function getEntries() {
    return entries;
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function subscribeResults(listener: (results: FlushResult[]) => void) {
    resultListeners.add(listener);
    return () => resultListeners.delete(listener);
  }

  const handleOnline = () => {
    void flush();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    if (navigator.onLine && entries.length > 0) {
      void flush();
    }
  }

  function dispose() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline);
    }
  }

  return { append, getEntries, flush, subscribe, subscribeResults, dispose };
}

export const outbox = createOutbox();
