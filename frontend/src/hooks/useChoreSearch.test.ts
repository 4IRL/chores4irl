import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Chore } from '@customTypes/SharedTypes';
import { useChoreSearch } from './useChoreSearch';

const chore = (id: number, name: string): Chore => ({
  id,
  name,
  roomId: 1,
  dateLastCompleted: new Date('2026-06-01T00:00:00.000Z'),
  duration: 5,
  frequency: 1,
});

const chores = [chore(1, 'Vacuum Stairs'), chore(2, 'Dishes'), chore(3, 'Wipe counters')];

describe('useChoreSearch', () => {
  it('matches case-insensitively', () => {
    const { result } = renderHook(() => useChoreSearch(chores, 'DISH'));
    expect(result.current.map((c) => c.id)).toEqual([2]);
  });

  it('trims the query', () => {
    const { result } = renderHook(() => useChoreSearch(chores, '  dishes  '));
    expect(result.current.map((c) => c.id)).toEqual([2]);
  });

  it('matches a substring in the middle of a name', () => {
    const { result } = renderHook(() => useChoreSearch(chores, 'cuum st'));
    expect(result.current.map((c) => c.id)).toEqual([1]);
  });

  it('returns the same array reference for empty and whitespace-only queries', () => {
    expect(renderHook(() => useChoreSearch(chores, '')).result.current).toBe(chores);
    expect(renderHook(() => useChoreSearch(chores, '   ')).result.current).toBe(chores);
  });

  it('returns [] when nothing matches', () => {
    const { result } = renderHook(() => useChoreSearch(chores, 'zzz'));
    expect(result.current).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const input = [...chores];
    renderHook(() => useChoreSearch(input, 'dish'));
    expect(input).toEqual(chores);
  });
});
