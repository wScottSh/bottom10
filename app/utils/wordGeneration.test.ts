import { describe, it, test, expect } from 'vitest';
import {
  buildConvexDistribution,
  generateWordSet,
  getTopWordsForTest,
  dedupeAdjacent,
  WORKING_SET_SIZE,
} from './wordGeneration';
import { WordStats, calculateGraduationThreshold } from './wordUtils';
import { isGraduated } from './graduation';

// Shared helper: builds a WordStats map from a word list with optional per-word overrides.
const makeStats = (words: string[], overrides: Record<string, Partial<WordStats>> = {}): Record<string, WordStats> => {
  const stats: Record<string, WordStats> = {};
  for (const w of words) {
    stats[w] = { word: w, time: 0, attempts: 0, lastScore: 0, ...overrides[w] };
  }
  return stats;
};

describe('getTopWordsForTest', () => {
  it('returns at most WORKING_SET_SIZE words', () => {
    const wordStats: Record<string, WordStats> = {};
    for (let i = 0; i < 20; i++) {
      wordStats[`word${i}`] = { word: `word${i}`, time: 500, attempts: 1, lastScore: 500 + i };
    }
    expect(getTopWordsForTest(wordStats).length).toBeLessThanOrEqual(WORKING_SET_SIZE);
  });

  it('excludes graduated words', () => {
    const threshold = calculateGraduationThreshold(60);
    const wordStats: Record<string, WordStats> = {
      fast: { word: 'fast', time: 100, attempts: 5, lastScore: threshold - 1, consecutiveSubThreshold: 2 },
      slow: { word: 'slow', time: 500, attempts: 5, lastScore: 500, consecutiveSubThreshold: 0 },
    };
    const result = getTopWordsForTest(wordStats);
    expect(result).not.toContain('fast');
    expect(result).toContain('slow');
  });

  it('sorts worst (highest score) first, unscored words last', () => {
    const wordStats: Record<string, WordStats> = {
      worst: { word: 'worst', time: 600, attempts: 3, lastScore: 600 },
      bad:   { word: 'bad',   time: 400, attempts: 3, lastScore: 400 },
      unscored: { word: 'unscored', time: 0, attempts: 0, lastScore: 0 },
    };
    const result = getTopWordsForTest(wordStats);
    expect(result[0]).toBe('worst');
    expect(result[1]).toBe('bad');
    expect(result[2]).toBe('unscored');
  });

  it('returns empty array when stats is empty', () => {
    expect(getTopWordsForTest({})).toEqual([]);
  });

  it('returns empty array when all words are graduated', () => {
    const threshold = calculateGraduationThreshold(60);
    const wordStats: Record<string, WordStats> = {
      a: { word: 'a', time: 100, attempts: 5, lastScore: threshold - 1, consecutiveSubThreshold: 2 },
      b: { word: 'b', time: 80,  attempts: 5, lastScore: threshold - 50, consecutiveSubThreshold: 2 },
    };
    expect(getTopWordsForTest(wordStats)).toEqual([]);
  });

  it('returns all unscored words (up to WORKING_SET_SIZE) when no words have been scored yet', () => {
    const wordStats: Record<string, WordStats> = {};
    for (let i = 0; i < 15; i++) {
      wordStats[`word${i}`] = { word: `word${i}`, time: 0, attempts: 0, lastScore: 0 };
    }
    const result = getTopWordsForTest(wordStats);
    expect(result.length).toBe(WORKING_SET_SIZE);
    for (const w of result) expect(wordStats[w].lastScore).toBe(0);
  });
});

describe('generateWordSet', () => {
  test('includes worst-scoring word when it has high lastScore', () => {
    const allWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it'];
    const stats = makeStats(allWords, { the: { time: 1000, attempts: 3, lastScore: 1000 } });
    const result = generateWordSet(10, stats, allWords);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('the');
  });

  test('uses provided stats immediately (no stale closure)', () => {
    const allWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it'];
    const updatedStats = makeStats(allWords, { the: { time: 1000, attempts: 1, lastScore: 1000 } });
    expect(generateWordSet(10, updatedStats, allWords)).toContain('the');
  });

  test('excludes graduated words', () => {
    const allWords = ['the', 'be', 'to', 'of', 'and'];
    const stats = makeStats(allWords, {
      the: { time: 100, attempts: 5, lastScore: 100, consecutiveSubThreshold: 2 },
    });
    for (let i = 0; i < 5; i++) {
      expect(generateWordSet(10, stats, allWords)).not.toContain('the');
    }
  });

  test('returns words when all are unscored', () => {
    const allWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it'];
    const result = generateWordSet(10, makeStats(allWords), allWords);
    expect(result.length).toBeGreaterThan(0);
  });

  test('produced list length equals requested count exactly when scored words are present', () => {
    const allWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it'];
    const stats = makeStats(allWords, {
      the:  { lastScore: 900 }, be:   { lastScore: 700 }, to:   { lastScore: 620 },
      of:   { lastScore: 560 }, and:  { lastScore: 500 }, a:    { lastScore: 460 },
      in:   { lastScore: 420 }, that: { lastScore: 380 }, have: { lastScore: 340 },
      it:   { lastScore: 310 },
    });
    expect(generateWordSet(50, stats, allWords).length).toBe(50);
  });

  test('produced list length equals requested count exactly when all words are unscored', () => {
    const allWords = Array.from({ length: 60 }, (_, i) => `word${i}`);
    expect(generateWordSet(50, makeStats(allWords), allWords).length).toBe(50);
  });

  test('first test draws words from allWords in frequency (slice) order before shuffle', () => {
    const allWords = ['freq1', 'freq2', 'freq3', 'freq4', 'freq5',
                      'freq6', 'freq7', 'freq8', 'freq9', 'freq10'];
    const result = generateWordSet(5, makeStats(allWords), allWords);
    expect(result.length).toBe(5);
    for (const w of result) expect(allWords).toContain(w);
  });

  test('first test uses only top 10 frequency-ordered words, repeated to fill count', () => {
    const allWords = Array.from({ length: 60 }, (_, i) => `word${i}`);
    const result = generateWordSet(50, makeStats(allWords), allWords);
    expect(result.length).toBe(50);
    const uniqueWords = new Set(result);
    expect(uniqueWords.size).toBeLessThanOrEqual(10);
    const top10 = new Set(allWords.slice(0, 10));
    for (const w of uniqueWords) expect(top10.has(w)).toBe(true);
  });

  test('first test with no stats uses only top 10 frequency-ordered words, repeated to fill count', () => {
    const allWords = Array.from({ length: 60 }, (_, i) => `word${i}`);
    const result = generateWordSet(50, {}, allWords);
    expect(result.length).toBe(50);
    const uniqueWords = new Set(result);
    expect(uniqueWords.size).toBeLessThanOrEqual(10);
    const top10 = new Set(allWords.slice(0, 10));
    for (const w of uniqueWords) expect(top10.has(w)).toBe(true);
  });

  test('fully-graduated pool returns empty array', () => {
    const allWords = ['the', 'be', 'to', 'of', 'and'];
    const stats = makeStats(allWords, {
      the: { lastScore: 100, consecutiveSubThreshold: 2 },
      be:  { lastScore: 100, consecutiveSubThreshold: 2 },
      to:  { lastScore: 100, consecutiveSubThreshold: 2 },
      of:  { lastScore: 100, consecutiveSubThreshold: 2 },
      and: { lastScore: 100, consecutiveSubThreshold: 2 },
    });
    expect(generateWordSet(50, stats, allWords)).toEqual([]);
  });

  test('mixed scored/unscored: unscored words appear exactly 2 times each', () => {
    const allWords = ['the', 'be', 'to', 'of', 'and'];
    const stats = makeStats(allWords, {
      the: { lastScore: 800 }, be: { lastScore: 600 }, to: { lastScore: 400 },
    });
    const result = generateWordSet(50, stats, allWords);
    expect(result.filter(w => w === 'of').length).toBe(2);
    expect(result.filter(w => w === 'and').length).toBe(2);
  });

  test('mixed scored/unscored: worst-scoring word gets more reps than best-scoring word', () => {
    const allWords = ['the', 'be', 'to', 'of', 'and'];
    const stats = makeStats(allWords, {
      the: { lastScore: 800 }, be: { lastScore: 600 }, to: { lastScore: 400 },
    });
    const result = generateWordSet(50, stats, allWords);
    expect(result.filter(w => w === 'the').length).toBeGreaterThan(result.filter(w => w === 'to').length);
  });

  test('working set caps at WORKING_SET_SIZE even when more active scored words exist', () => {
    const allWords = Array.from({ length: 15 }, (_, i) => `word${i}`);
    const overrides: Record<string, Partial<WordStats>> = {};
    for (let i = 0; i < 15; i++) overrides[`word${i}`] = { lastScore: 300 + i * 10 };
    const result = generateWordSet(50, makeStats(allWords, overrides), allWords);
    const unique = new Set(result);
    expect(unique.size).toBeLessThanOrEqual(10);
    expect(unique.has('word14')).toBe(true);
    expect(unique.has('word0')).toBe(false);
  });

  test('graduated word slot is filled by untouched words from allWords frequency order', () => {
    const allWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it'];
    const stats = makeStats(allWords, {
      the: { lastScore: 100, consecutiveSubThreshold: 2 },
      be:  { lastScore: 800 },
    });
    const result = generateWordSet(50, stats, allWords);
    expect(result).not.toContain('the');
    expect(result).toContain('be');
    const untouched = ['to', 'of', 'and', 'a', 'in', 'that', 'have', 'it'];
    expect(untouched.some(w => result.includes(w))).toBe(true);
  });
});

describe('generateWordSet — no adjacent duplicates', () => {
  const hasAdjacentDupe = (arr: string[]) => arr.some((w, i) => i > 0 && w === arr[i - 1]);

  it('produced list has no adjacent identical words (scored path)', () => {
    const allWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it'];
    const stats: Record<string, WordStats> = {};
    for (const w of allWords) stats[w] = { word: w, time: 500, attempts: 3, lastScore: 500 };
    for (let i = 0; i < 10; i++) {
      expect(hasAdjacentDupe(generateWordSet(30, stats, allWords))).toBe(false);
    }
  });

  it('produced list has no adjacent identical words (unscored / first-session path)', () => {
    const allWords = Array.from({ length: 10 }, (_, i) => `word${i}`);
    for (let i = 0; i < 10; i++) {
      expect(hasAdjacentDupe(generateWordSet(30, {}, allWords))).toBe(false);
    }
  });
});

describe('buildConvexDistribution', () => {
  const mkEntries = (scores: number[]) =>
    scores.map((score, i) => ({ word: String.fromCharCode(97 + i), score }));
  const prdEntries = mkEntries([900, 700, 620, 560, 500, 460, 420, 380, 340, 310]);

  test('produced word list totals exactly N — PRD worked example', () => {
    const dist = buildConvexDistribution(50, prdEntries);
    expect(Object.values(dist).reduce((a, b) => a + b, 0)).toBe(50);
  });

  test('produced word list totals exactly N across a range of N', () => {
    for (const n of [20, 30, 40, 50, 75, 100]) {
      const dist = buildConvexDistribution(n, prdEntries);
      expect(Object.values(dist).reduce((a, b) => a + b, 0)).toBe(n);
    }
  });

  test('worst word receives at least floor(0.25 * N) reps', () => {
    expect(buildConvexDistribution(50, prdEntries)['a']).toBeGreaterThanOrEqual(Math.floor(0.25 * 50));
  });

  test('best word receives exactly 2 reps (the floor)', () => {
    expect(buildConvexDistribution(50, prdEntries)['j']).toBe(2);
  });

  test('rep counts are monotonic non-increasing from worst to best', () => {
    const dist = buildConvexDistribution(50, prdEntries);
    const reps = prdEntries.map(e => dist[e.word]);
    for (let i = 1; i < reps.length; i++) expect(reps[i]).toBeLessThanOrEqual(reps[i - 1]);
  });

  test('single word receives all N reps', () => {
    expect(buildConvexDistribution(20, [{ word: 'only', score: 500 }])['only']).toBe(20);
  });

  test('two words: best gets 2 reps, worst absorbs the rest', () => {
    const dist = buildConvexDistribution(20, mkEntries([900, 310]));
    expect(dist['b']).toBe(2);
    expect(dist['a'] + dist['b']).toBe(20);
  });

  test('near-as-bad second word gets substantially more reps than the best word', () => {
    const entries = mkEntries([900, 870, 310]);
    const dist = buildConvexDistribution(50, entries);
    expect(dist['b']).toBeGreaterThan(dist['c'] + 2);
    expect(dist['a']).toBeGreaterThanOrEqual(dist['b']);
  });

  test('near-tied scores still yield a valid full-length test', () => {
    const entries = mkEntries([500, 499, 498, 497, 496]);
    const dist = buildConvexDistribution(30, entries);
    expect(Object.values(dist).reduce((a, b) => a + b, 0)).toBe(30);
  });

  test('fewer scored words (3) produce exactly N reps', () => {
    const dist = buildConvexDistribution(50, mkEntries([900, 600, 310]));
    expect(Object.values(dist).reduce((a, b) => a + b, 0)).toBe(50);
    expect(dist['c']).toBe(2);
  });

  test('small N degrades gracefully — no error, total equals N', () => {
    const dist = buildConvexDistribution(8, mkEntries([900, 700, 500, 400, 310]));
    expect(Object.values(dist).reduce((a, b) => a + b, 0)).toBe(8);
  });

  test('all-tied scores still produce a valid full-length test', () => {
    const dist = buildConvexDistribution(20, mkEntries([500, 500, 500, 500]));
    expect(Object.values(dist).reduce((a, b) => a + b, 0)).toBe(20);
  });

  test('empty entries returns empty result', () => {
    expect(Object.keys(buildConvexDistribution(50, [])).length).toBe(0);
  });
});

describe('dedupeAdjacent', () => {
  const hasAdjacentDupe = (arr: string[]) => arr.some((w, i) => i > 0 && w === arr[i - 1]);

  it('returns the same array reference (in-place mutation)', () => {
    const arr = ['a', 'a', 'b'];
    expect(dedupeAdjacent(arr)).toBe(arr);
  });

  it('removes adjacent duplicates from a simple sequence', () => {
    const arr = ['a', 'a', 'b', 'b', 'c'];
    dedupeAdjacent(arr);
    expect(hasAdjacentDupe(arr)).toBe(false);
  });

  it('leaves a list with no adjacent duplicates unchanged', () => {
    const arr = ['a', 'b', 'a', 'b'];
    const copy = [...arr];
    dedupeAdjacent(arr);
    expect(arr).toEqual(copy);
  });

  it('handles an empty array without throwing', () => {
    expect(() => dedupeAdjacent([])).not.toThrow();
  });

  it('handles a single-element array without throwing', () => {
    const arr = ['a'];
    dedupeAdjacent(arr);
    expect(arr).toEqual(['a']);
  });

  it('handles all-same array gracefully (gives up rather than looping forever)', () => {
    expect(() => dedupeAdjacent(['a', 'a', 'a', 'a'])).not.toThrow();
  });

  it('eliminates all adjacent duplicates when a valid arrangement exists', () => {
    const arr = ['x', 'x', 'x', 'y', 'y', 'z'];
    dedupeAdjacent(arr);
    expect(hasAdjacentDupe(arr)).toBe(false);
  });

  it('preserves all elements (no words added or removed)', () => {
    const arr = ['a', 'a', 'b', 'b', 'c', 'c'];
    const before = [...arr].sort();
    dedupeAdjacent(arr);
    expect([...arr].sort()).toEqual(before);
  });
});
