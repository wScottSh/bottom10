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
