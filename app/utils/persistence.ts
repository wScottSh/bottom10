import { WordStats } from './wordUtils';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export const CURRENT_VERSION = 1;
const STORAGE_KEY = 'bottom10_data';
const LEGACY_WORD_STATS_KEY = 'wordStats';
const LEGACY_WPM_KEY = 'wpmTarget';
const DEFAULT_WPM_TARGET = 40;

export interface StoredData {
  version: number;
  wordStats: Record<string, WordStats>;
  wpmTarget: number;
}

function getDefaultData(): StoredData {
  return {
    version: CURRENT_VERSION,
    wordStats: {},
    wpmTarget: DEFAULT_WPM_TARGET,
  };
}

export function createInMemoryStorage(initial: Record<string, string> = {}): StorageLike {
  const store: Record<string, string> = { ...initial };
  return {
    getItem(key: string): string | null {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key: string, value: string): void {
      store[key] = value;
    },
    removeItem(key: string): void {
      delete store[key];
    },
  };
}

function getSafeStorage(provided?: StorageLike): StorageLike {
  if (provided) return provided;
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    return localStorage;
  }
  return createInMemoryStorage();
}

function migrateFromLegacy(storage: StorageLike): StoredData {
  try {
    const legacyStatsRaw = storage.getItem(LEGACY_WORD_STATS_KEY);
    const legacyWpmRaw = storage.getItem(LEGACY_WPM_KEY);
    if (!legacyStatsRaw && !legacyWpmRaw) {
      return getDefaultData();
    }
    let wordStats: Record<string, WordStats> = {};
    if (legacyStatsRaw) {
      try {
        const parsed = JSON.parse(legacyStatsRaw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          wordStats = parsed as Record<string, WordStats>;
        }
      } catch {}
    }
    let wpmTarget = DEFAULT_WPM_TARGET;
    if (legacyWpmRaw) {
      const parsedNum = parseInt(legacyWpmRaw, 10);
      if (!isNaN(parsedNum) && parsedNum > 0) {
        wpmTarget = parsedNum;
      }
    }
    const migrated: StoredData = {
      version: CURRENT_VERSION,
      wordStats,
      wpmTarget,
    };
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      storage.removeItem?.(LEGACY_WORD_STATS_KEY);
      storage.removeItem?.(LEGACY_WPM_KEY);
    } catch {}
    return migrated;
  } catch {
    return getDefaultData();
  }
}

export function loadAppData(storage?: StorageLike): StoredData {
  const safeStorage = getSafeStorage(storage);
  try {
    const raw = safeStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return migrateFromLegacy(safeStorage);
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return getDefaultData();
    }
    const p = parsed as { version?: unknown; wordStats?: unknown; wpmTarget?: unknown };
    let version = CURRENT_VERSION;
    if (typeof p.version === 'number') {
      version = p.version;
    }
    let wordStats: Record<string, WordStats> = {};
    if (p.wordStats && typeof p.wordStats === 'object' && !Array.isArray(p.wordStats)) {
      wordStats = p.wordStats as Record<string, WordStats>;
    }
    let wpmTarget = DEFAULT_WPM_TARGET;
    if (typeof p.wpmTarget === 'number' && p.wpmTarget > 0) {
      wpmTarget = p.wpmTarget;
    }
    return { version, wordStats, wpmTarget };
  } catch {
    return getDefaultData();
  }
}

export function saveAppData(partial: Partial<StoredData>, storage?: StorageLike): void {
  const safeStorage = getSafeStorage(storage);
  const current = loadAppData(safeStorage);
  const toSave: StoredData = {
    version: CURRENT_VERSION,
    wordStats: current.wordStats,
    wpmTarget: current.wpmTarget,
  };
  if (partial.wordStats !== undefined) {
    toSave.wordStats = partial.wordStats;
  }
  if (partial.wpmTarget !== undefined) {
    toSave.wpmTarget = partial.wpmTarget;
  }
  try {
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {}
}

export function resetAppData(storage?: StorageLike): void {
  const safeStorage = getSafeStorage(storage);
  try {
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(getDefaultData()));
  } catch {}
}

export function loadWordStats(storage?: StorageLike): Record<string, WordStats> {
  return loadAppData(storage).wordStats;
}

export function saveWordStats(stats: Record<string, WordStats>, storage?: StorageLike): void {
  saveAppData({ wordStats: stats }, storage);
}

export function loadWpmTarget(storage?: StorageLike): number {
  return loadAppData(storage).wpmTarget;
}

export function saveWpmTarget(target: number, storage?: StorageLike): void {
  if (typeof target !== 'number' || target <= 0) return;
  saveAppData({ wpmTarget: target }, storage);
}
