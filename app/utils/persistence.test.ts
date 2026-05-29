import test from 'node:test';
import assert from 'node:assert/strict';
import { loadWordStats, saveWordStats, loadWpmTarget, saveWpmTarget, CURRENT_VERSION, loadAppData, createInMemoryStorage as createMockStorage } from './persistence';

test('loadWordStats returns empty object for missing data', () => {
  const storage = createMockStorage();
  const stats = loadWordStats(storage);
  assert.deepStrictEqual(stats, {});
});

test('saveWordStats and loadWordStats roundtrip valid data', () => {
  const storage = createMockStorage();
  const testStats = {
    'the': { word: 'the', time: 100, attempts: 5, lastScore: 20 }
  };
  saveWordStats(testStats, storage);
  const loaded = loadWordStats(storage);
  assert.deepStrictEqual(loaded, testStats);
  // also check stored data has version
  const raw = storage.getItem('bottom10_data');
  assert.ok(raw);
  const parsed = JSON.parse(raw!);
  assert.strictEqual(parsed.version, CURRENT_VERSION);
  assert.deepStrictEqual(parsed.wordStats, testStats);
});

test('loadWpmTarget returns default 40 when missing', () => {
  const storage = createMockStorage();
  const wpm = loadWpmTarget(storage);
  assert.strictEqual(wpm, 40);
});

test('saveWpmTarget and load roundtrips', () => {
  const storage = createMockStorage();
  saveWpmTarget(65, storage);
  assert.strictEqual(loadWpmTarget(storage), 65);
});

test('loadAppData is safe on corrupt JSON', () => {
  const storage = createMockStorage({ 'bottom10_data': 'not-json-at-all{' });
  const data = loadAppData(storage);
  assert.strictEqual(data.version, CURRENT_VERSION);
  assert.deepStrictEqual(data.wordStats, {});
  assert.strictEqual(data.wpmTarget, 40);
});

test('handles legacy data migration from wordStats/wpmTarget keys', () => {
  const legacyStore = createMockStorage({
    'wordStats': JSON.stringify({ 'hello': { word: 'hello', time: 50, attempts: 1, lastScore: 10 } }),
    'wpmTarget': '55'
  });
  const data = loadAppData(legacyStore);
  assert.strictEqual(data.version, CURRENT_VERSION);
  assert.ok(data.wordStats['hello']);
  assert.strictEqual(data.wpmTarget, 55);
  // after load, should have migrated to new key
  const newRaw = legacyStore.getItem('bottom10_data');
  assert.ok(newRaw);
});
