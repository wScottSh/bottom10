import { test, expect } from 'vitest';
import { loadWordStats, saveWordStats, loadWpmTarget, saveWpmTarget, CURRENT_VERSION, loadAppData, resetAppData, createInMemoryStorage as createMockStorage } from './persistence';

test('loadWordStats returns empty object for missing data', () => {
  const storage = createMockStorage();
  const stats = loadWordStats(storage);
  expect(stats).toEqual({});
});

test('saveWordStats and loadWordStats roundtrip valid data', () => {
  const storage = createMockStorage();
  const testStats = {
    'the': { word: 'the', time: 100, attempts: 5, lastScore: 20 }
  };
  saveWordStats(testStats, storage);
  const loaded = loadWordStats(storage);
  expect(loaded).toEqual(testStats);
  const raw = storage.getItem('bottom10_data');
  expect(raw).toBeTruthy();
  const parsed = JSON.parse(raw!);
  expect(parsed.version).toBe(CURRENT_VERSION);
  expect(parsed.wordStats).toEqual(testStats);
});

test('loadWpmTarget returns default 40 when missing', () => {
  const storage = createMockStorage();
  const wpm = loadWpmTarget(storage);
  expect(wpm).toBe(40);
});

test('saveWpmTarget and load roundtrips', () => {
  const storage = createMockStorage();
  saveWpmTarget(65, storage);
  expect(loadWpmTarget(storage)).toBe(65);
});

test('loadAppData is safe on corrupt JSON', () => {
  const storage = createMockStorage({ 'bottom10_data': 'not-json-at-all{' });
  const data = loadAppData(storage);
  expect(data.version).toBe(CURRENT_VERSION);
  expect(data.wordStats).toEqual({});
  expect(data.wpmTarget).toBe(40);
});

test('resetAppData clears wordStats and resets wpmTarget to default', () => {
  const storage = createMockStorage();
  saveWordStats({ 'the': { word: 'the', time: 100, attempts: 5, lastScore: 20 } }, storage);
  saveWpmTarget(80, storage);
  resetAppData(storage);
  const data = loadAppData(storage);
  expect(data.wordStats).toEqual({});
  expect(data.wpmTarget).toBe(40);
});

test('resetAppData works on empty storage without error', () => {
  const storage = createMockStorage();
  expect(() => resetAppData(storage)).not.toThrow();
  const data = loadAppData(storage);
  expect(data.wordStats).toEqual({});
  expect(data.wpmTarget).toBe(40);
});

test('handles legacy data migration from wordStats/wpmTarget keys', () => {
  const legacyStore = createMockStorage({
    'wordStats': JSON.stringify({ 'hello': { word: 'hello', time: 50, attempts: 1, lastScore: 10 } }),
    'wpmTarget': '55'
  });
  const data = loadAppData(legacyStore);
  expect(data.version).toBe(CURRENT_VERSION);
  expect(data.wordStats['hello']).toBeTruthy();
  expect(data.wpmTarget).toBe(55);
  const newRaw = legacyStore.getItem('bottom10_data');
  expect(newRaw).toBeTruthy();
});
