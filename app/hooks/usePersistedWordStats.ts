import { useState, useEffect } from 'react';
import { loadWordStats, saveWordStats, StorageLike } from '../utils/persistence';
import { WordStats } from '../utils/wordUtils';

export function usePersistedWordStats(
  initialStats: Record<string, WordStats>,
  storage?: StorageLike
): [Record<string, WordStats>, (stats: Record<string, WordStats>) => void] {
  // Initialize to initialStats so the first (hydration) render matches the server,
  // which has no storage. Persisted stats are loaded after mount, below — reading
  // storage during the initializer would diverge from the server and break hydration.
  const [wordStats, setWordStats] = useState<Record<string, WordStats>>(initialStats);

  useEffect(() => {
    const saved = loadWordStats(storage);
    if (Object.keys(saved).length > 0) {
      setWordStats(saved);
    }
    // Load once on mount; storage identity is stable for the component's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setValue(stats: Record<string, WordStats>) {
    setWordStats(stats);
    saveWordStats(stats, storage);
  }

  return [wordStats, setValue];
}
