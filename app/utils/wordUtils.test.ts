import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWordSet } from './wordUtils';
import type { WordStats } from './wordUtils';

const makeStats = (words: string[], overrides: Record<string, Partial<WordStats>> = {}): Record<string, WordStats> => {
  const stats: Record<string, WordStats> = {};
  for (const w of words) {
    stats[w] = { word: w, time: 0, attempts: 0, lastScore: 0, ...overrides[w] };
  }
  return stats;
};

test('generateWordSet includes worst-scoring word when it has high lastScore', () => {
  const allWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it'];
  const stats = makeStats(allWords, {
    the: { time: 1000, attempts: 3, lastScore: 1000 }
  });

  const result = generateWordSet(10, 40, stats, allWords);

  assert.ok(result.length > 0, 'should return words');
  assert.ok(result.includes('the'), 'worst-scoring word should be in result');
});

test('generateWordSet uses provided stats immediately (no stale closure)', () => {
  const allWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it'];

  const updatedStats = makeStats(allWords, {
    the: { time: 1000, attempts: 1, lastScore: 1000 }
  });

  // calling with freshly-computed updatedStats must reflect the new score immediately
  const result = generateWordSet(10, 40, updatedStats, allWords);

  assert.ok(result.includes('the'), 'updated stats should produce word set including worst scorer');
});

test('generateWordSet excludes graduated words', () => {
  const allWords = ['the', 'be', 'to', 'of', 'and'];
  // wpmTarget=40 => threshold = 60000/(40*5) = 300ms; lastScore=100 < 300 & > 0 => graduated
  const stats = makeStats(allWords, {
    the: { time: 100, attempts: 5, lastScore: 100 }
  });

  for (let i = 0; i < 5; i++) {
    const result = generateWordSet(10, 40, stats, allWords);
    assert.ok(!result.includes('the'), 'graduated word should not appear in result');
  }
});

test('generateWordSet returns words when all are unscored', () => {
  const allWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it'];
  const stats = makeStats(allWords);

  const result = generateWordSet(10, 40, stats, allWords);

  assert.ok(result.length > 0, 'should return words even when all unscored');
});
