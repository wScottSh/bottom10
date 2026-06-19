import { useState, useEffect } from 'react';
import { loadWpmTarget, saveWpmTarget, DEFAULT_WPM_TARGET, StorageLike } from '../utils/persistence';

export function usePersistedWpmTarget(storage?: StorageLike): [number, (wpm: number) => void] {
  // Initialize to the default so the first (hydration) render matches the server,
  // which has no storage. The persisted target is loaded after mount, below —
  // reading storage during the initializer would break hydration.
  const [wpmTarget, setWpmTarget] = useState<number>(DEFAULT_WPM_TARGET);

  useEffect(() => {
    setWpmTarget(loadWpmTarget(storage));
    // Load once on mount; storage identity is stable for the component's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setValue(wpm: number) {
    setWpmTarget(wpm);
    saveWpmTarget(wpm, storage);
  }

  return [wpmTarget, setValue];
}
