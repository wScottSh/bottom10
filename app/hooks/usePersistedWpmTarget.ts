import { useState } from 'react';
import { loadWpmTarget, saveWpmTarget, StorageLike } from '../utils/persistence';

export function usePersistedWpmTarget(storage?: StorageLike): [number, (wpm: number) => void] {
  const [wpmTarget, setWpmTarget] = useState<number>(() => loadWpmTarget(storage));

  function setValue(wpm: number) {
    setWpmTarget(wpm);
    saveWpmTarget(wpm, storage);
  }

  return [wpmTarget, setValue];
}
