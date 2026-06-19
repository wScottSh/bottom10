// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistedWpmTarget } from './usePersistedWpmTarget';
import { createInMemoryStorage, STORAGE_KEY } from '../utils/persistence';

describe('usePersistedWpmTarget', () => {
  it('loads WPM target from storage on mount', () => {
    const storage = createInMemoryStorage({
      [STORAGE_KEY]: JSON.stringify({ version: 1, wordStats: {}, wpmTarget: 70 }),
    });
    const { result } = renderHook(() => usePersistedWpmTarget(storage));
    expect(result.current[0]).toBe(70);
  });

  it('falls back to the default when storage is empty', () => {
    const storage = createInMemoryStorage();
    const { result } = renderHook(() => usePersistedWpmTarget(storage));
    expect(result.current[0]).toBe(40);
  });

  it('saves WPM target to storage when setValue is called', () => {
    const storage = createInMemoryStorage();
    const { result } = renderHook(() => usePersistedWpmTarget(storage));
    act(() => {
      result.current[1](85);
    });
    const stored = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.wpmTarget).toBe(85);
  });

  it('reflects the new value in the hook after setValue', () => {
    const storage = createInMemoryStorage();
    const { result } = renderHook(() => usePersistedWpmTarget(storage));
    act(() => {
      result.current[1](60);
    });
    expect(result.current[0]).toBe(60);
  });
});
