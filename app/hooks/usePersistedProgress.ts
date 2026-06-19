import { useState, useEffect, useRef } from 'react';
import { loadAppData, CURRENT_VERSION, DEFAULT_WPM_TARGET, StorageLike, STORAGE_KEY, getSafeStorage } from '../utils/persistence';
import { WordStats } from '../utils/wordUtils';

interface ProgressState {
  wordStats: Record<string, WordStats>;
  wpmTarget: number;
}

export interface PersistedProgress {
  wordStats: Record<string, WordStats>;
  setWordStats: (stats: Record<string, WordStats>) => void;
  wpmTarget: number;
  setWpmTarget: (wpm: number) => void;
}

export function usePersistedProgress(
  initialStats: Record<string, WordStats>,
  storage?: StorageLike
): PersistedProgress {
  const [state, setState] = useState<ProgressState>({
    wordStats: initialStats,
    wpmTarget: DEFAULT_WPM_TARGET,
  });
  // Mirror of state so setters always see the current values without a stale closure.
  const stateRef = useRef<ProgressState>(state);

  useEffect(() => {
    const data = loadAppData(storage);
    const loaded: ProgressState = {
      wordStats: Object.keys(data.wordStats).length > 0 ? data.wordStats : initialStats,
      wpmTarget: data.wpmTarget,
    };
    stateRef.current = loaded;
    setState(loaded);
    // Load once on mount; storage identity is stable for the component's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const safeStorage = getSafeStorage(storage);

  function persist(next: ProgressState) {
    try {
      safeStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: CURRENT_VERSION,
        wordStats: next.wordStats,
        wpmTarget: next.wpmTarget,
      }));
    } catch {}
  }

  function setWordStats(stats: Record<string, WordStats>) {
    const next: ProgressState = { wordStats: stats, wpmTarget: stateRef.current.wpmTarget };
    stateRef.current = next;
    setState(next);
    persist(next);
  }

  function setWpmTarget(wpm: number) {
    if (typeof wpm !== 'number' || wpm <= 0) return;
    const next: ProgressState = { wordStats: stateRef.current.wordStats, wpmTarget: wpm };
    stateRef.current = next;
    setState(next);
    persist(next);
  }

  return {
    wordStats: state.wordStats,
    setWordStats,
    wpmTarget: state.wpmTarget,
    setWpmTarget,
  };
}
