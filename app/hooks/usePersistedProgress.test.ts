// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistedProgress } from './usePersistedProgress';
import { createInMemoryStorage, STORAGE_KEY, DEFAULT_WPM_TARGET } from '../utils/persistence';
import { WordStats } from '../utils/wordUtils';

const INITIAL: Record<string, WordStats> = {
  hello: { word: 'hello', time: 0, attempts: 0, lastScore: 0 },
};

const SAVED_STATS: Record<string, WordStats> = {
  hello: { word: 'hello', time: 200, attempts: 3, lastScore: 0.5 },
};

describe('usePersistedProgress', () => {
  it('loads both wordStats and wpmTarget from storage on mount', () => {
    const storage = createInMemoryStorage({
      [STORAGE_KEY]: JSON.stringify({ version: 1, wordStats: SAVED_STATS, wpmTarget: 70 }),
    });
    const { result } = renderHook(() => usePersistedProgress(INITIAL, storage));
    expect(result.current.wordStats).toEqual(SAVED_STATS);
    expect(result.current.wpmTarget).toBe(70);
  });

  // Hydration safety: the first render must equal the server render (no storage),
  // otherwise React throws a hydration mismatch.
  it('returns defaults on the first render, then converges to stored values', () => {
    const storage = createInMemoryStorage({
      [STORAGE_KEY]: JSON.stringify({ version: 1, wordStats: SAVED_STATS, wpmTarget: 70 }),
    });
    const statsRenders: Record<string, WordStats>[] = [];
    const wpmRenders: number[] = [];
    const { result } = renderHook(() => {
      const p = usePersistedProgress(INITIAL, storage);
      statsRenders.push(p.wordStats);
      wpmRenders.push(p.wpmTarget);
      return p;
    });
    expect(statsRenders[0]).toEqual(INITIAL);
    expect(wpmRenders[0]).toBe(DEFAULT_WPM_TARGET);
    expect(result.current.wordStats).toEqual(SAVED_STATS);
    expect(result.current.wpmTarget).toBe(70);
  });

  it('falls back to initial stats and default WPM when storage is empty', () => {
    const storage = createInMemoryStorage();
    const { result } = renderHook(() => usePersistedProgress(INITIAL, storage));
    expect(result.current.wordStats).toEqual(INITIAL);
    expect(result.current.wpmTarget).toBe(DEFAULT_WPM_TARGET);
  });

  it('falls back to defaults on corrupt storage', () => {
    const storage = createInMemoryStorage({
      [STORAGE_KEY]: 'not-valid-json{',
    });
    const { result } = renderHook(() => usePersistedProgress(INITIAL, storage));
    expect(result.current.wordStats).toEqual(INITIAL);
    expect(result.current.wpmTarget).toBe(DEFAULT_WPM_TARGET);
  });

  it('setWordStats updates state and persists without losing wpmTarget', () => {
    const storage = createInMemoryStorage({
      [STORAGE_KEY]: JSON.stringify({ version: 1, wordStats: SAVED_STATS, wpmTarget: 70 }),
    });
    const { result } = renderHook(() => usePersistedProgress(INITIAL, storage));
    const newStats = { world: { word: 'world', time: 100, attempts: 1, lastScore: 0.2 } };
    act(() => {
      result.current.setWordStats(newStats);
    });
    expect(result.current.wordStats).toEqual(newStats);
    const stored = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.wordStats).toEqual(newStats);
    expect(stored.wpmTarget).toBe(70);
  });

  it('setWpmTarget updates state and persists without losing wordStats', () => {
    const storage = createInMemoryStorage({
      [STORAGE_KEY]: JSON.stringify({ version: 1, wordStats: SAVED_STATS, wpmTarget: 70 }),
    });
    const { result } = renderHook(() => usePersistedProgress(INITIAL, storage));
    act(() => {
      result.current.setWpmTarget(85);
    });
    expect(result.current.wpmTarget).toBe(85);
    const stored = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.wpmTarget).toBe(85);
    expect(stored.wordStats).toEqual(SAVED_STATS);
  });

  it('loads the record exactly once on mount (not once per exposed value)', () => {
    const storage = createInMemoryStorage({
      [STORAGE_KEY]: JSON.stringify({ version: 1, wordStats: SAVED_STATS, wpmTarget: 70 }),
    });
    const spy = vi.spyOn(storage, 'getItem');
    renderHook(() => usePersistedProgress(INITIAL, storage));
    // One getItem call on mount (loadAppData), not two
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('loads persisted showKeyboardLayout from storage on mount', () => {
    const storage = createInMemoryStorage({
      [STORAGE_KEY]: JSON.stringify({ version: 1, wordStats: SAVED_STATS, wpmTarget: 70, showKeyboardLayout: true }),
    });
    const { result } = renderHook(() => usePersistedProgress(INITIAL, storage));
    expect(result.current.showKeyboardLayout).toBe(true);
  });

  it('showKeyboardLayout defaults to false when not in storage', () => {
    const storage = createInMemoryStorage({
      [STORAGE_KEY]: JSON.stringify({ version: 1, wordStats: SAVED_STATS, wpmTarget: 70 }),
    });
    const { result } = renderHook(() => usePersistedProgress(INITIAL, storage));
    expect(result.current.showKeyboardLayout).toBe(false);
  });

  it('setShowKeyboardLayout persists without clobbering wordStats or wpmTarget', () => {
    const storage = createInMemoryStorage({
      [STORAGE_KEY]: JSON.stringify({ version: 1, wordStats: SAVED_STATS, wpmTarget: 70, showKeyboardLayout: false }),
    });
    const { result } = renderHook(() => usePersistedProgress(INITIAL, storage));
    act(() => {
      result.current.setShowKeyboardLayout(true);
    });
    expect(result.current.showKeyboardLayout).toBe(true);
    const stored = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.showKeyboardLayout).toBe(true);
    expect(stored.wpmTarget).toBe(70);
    expect(stored.wordStats).toEqual(SAVED_STATS);
  });

  it('setWordStats does not clobber showKeyboardLayout', () => {
    const storage = createInMemoryStorage({
      [STORAGE_KEY]: JSON.stringify({ version: 1, wordStats: SAVED_STATS, wpmTarget: 70, showKeyboardLayout: true }),
    });
    const { result } = renderHook(() => usePersistedProgress(INITIAL, storage));
    const newStats = { world: { word: 'world', time: 100, attempts: 1, lastScore: 0.2 } };
    act(() => {
      result.current.setWordStats(newStats);
    });
    const stored = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.showKeyboardLayout).toBe(true);
  });
});
