import { useState } from 'react';
import { loadWordStats, saveWordStats, StorageLike } from '../utils/persistence';
import { WordStats } from '../utils/wordUtils';

export function usePersistedWordStats(
  initialStats: Record<string, WordStats>,
  storage?: StorageLike
): [Record<string, WordStats>, (stats: Record<string, WordStats>) => void] {
  const [wordStats, setWordStats] = useState<Record<string, WordStats>>(() => {
    const saved = loadWordStats(storage);
    return Object.keys(saved).length > 0 ? saved : initialStats;
  });

  function setValue(stats: Record<string, WordStats>) {
    setWordStats(stats);
    saveWordStats(stats, storage);
  }

  return [wordStats, setValue];
}
