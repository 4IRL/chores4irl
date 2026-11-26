import { describe, it, expect } from 'vitest';
import { ntfyUsername, personTopic } from '../src/notifs-ids.js';

describe('notifs ids', () => {
  it('builds the per-user topic as chores4irl-{personHash}-all', () => {
    expect(personTopic('abc123hash')).toBe('chores4irl-abc123hash-all');
  });

  it('builds the per-person ntfy username as u_{personHash}', () => {
    expect(ntfyUsername('abc123hash')).toBe('u_abc123hash');
  });
});
