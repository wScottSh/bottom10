// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistedWordStats } from './usePersistedWordStats';
import { createInMemoryStorage, STORAGE_KEY } from '../utils/persistence';
import { WordStats } from '../utils/wordUtils';

const INITIAL: Record<string, WordStats> = {
  hello: { word: 'hello', time: 0, attempts: 0, lastScore: 0 },
};

const SAVED_STATS: Record<string, WordStats> = {
  hello: { word: 'hello', time: 200, attempts: 3, lastScore: 0.5 },
};

describe('usePersistedWordStats', () => {
  it('loads word stats from storage on mount', () => {
    const storage = createInMemoryStorage({
      [STORAGE_KEY]: JSON.stringify({ version: 1, wordStats: SAVED_STATS, wpmTarget: 40 }),
    });
    const { result } = renderHook(() => usePersistedWordStats(INITIAL, storage));
    expect(result.current[0]).toEqual(SAVED_STATS);
  });

  // Hydration safety: the first render must equal the server render (which has no
  // storage and so uses initialStats), otherwise React throws a hydration mismatch.
  // Stored stats are applied only after mount, on a later render.
  it('returns initial stats on the first render, then converges to stored stats', () => {
    const storage = createInMemoryStorage({
      [STORAGE_KEY]: JSON.stringify({ version: 1, wordStats: SAVED_STATS, wpmTarget: 40 }),
    });
    const renders: Record<string, WordStats>[] = [];
    const { result } = renderHook(() => {
      const value = usePersistedWordStats(INITIAL, storage);
      renders.push(value[0]);
      return value;
    });
    expect(renders[0]).toEqual(INITIAL);
    expect(result.current[0]).toEqual(SAVED_STATS);
  });

  it('falls back to initial stats when storage is empty', () => {
    const storage = createInMemoryStorage();
    const { result } = renderHook(() => usePersistedWordStats(INITIAL, storage));
    expect(result.current[0]).toEqual(INITIAL);
  });

  it('saves word stats to storage when setValue is called', () => {
    const storage = createInMemoryStorage();
    const { result } = renderHook(() => usePersistedWordStats(INITIAL, storage));
    const newStats = { hello: { word: 'hello', time: 150, attempts: 1, lastScore: 0.3 } };
    act(() => {
      result.current[1](newStats);
    });
    const stored = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.wordStats).toEqual(newStats);
  });

  it('reflects new stats in the hook after setValue', () => {
    const storage = createInMemoryStorage();
    const { result } = renderHook(() => usePersistedWordStats(INITIAL, storage));
    const newStats = { hello: { word: 'hello', time: 150, attempts: 1, lastScore: 0.3 } };
    act(() => {
      result.current[1](newStats);
    });
    expect(result.current[0]).toEqual(newStats);
  });
});
