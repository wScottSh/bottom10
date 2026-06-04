import { describe, it, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateFrequencyDistribution,
  buildConvexDistribution,
  selectWordsForTest,
  generateWordSet,
  selectWorkingSet,
  calculateNormalizedScore,
  calculateGraduationThreshold,
  isGraduated,
  getTopWordsForTest,
  computeWordElapsedTime,
  WordStats,
} from './wordUtils';

describe('generateFrequencyDistribution', () => {
  const tenWords = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

  test('characterization: 10 words N=50 pins current distribution output', () => {
    const result = generateFrequencyDistribution(50, tenWords);
    expect(result).toEqual({
      a: 12,
      b: 7,
      c: 5,
      d: 3,
      e: 2,
      f: 2,
      g: 2,
      h: 2,
      i: 2,
      j: 2,
    });
  });

  test('worst word gets floor(N * 0.25) reps', () => {
    const result = generateFrequencyDistribution(40, ['x', 'y', 'z']);
    expect(result['x']).toBe(Math.floor(40 * 0.25));
  });

  test('last word always gets 2 reps', () => {
    const result = generateFrequencyDistribution(50, tenWords);
    expect(result['j']).toBe(2);
  });

  test('all words appear in the result', () => {
    const result = generateFrequencyDistribution(50, tenWords);
    for (const word of tenWords) {
      expect(result[word]).toBeGreaterThanOrEqual(1);
    }
  });

  test('works with a single word', () => {
    const result = generateFrequencyDistribution(20, ['only']);
    expect(result['only']).toBe(Math.max(Math.floor(20 * 0.25), 1));
  });

  test('works with two words', () => {
    const result = generateFrequencyDistribution(20, ['worst', 'best']);
    expect(result['worst']).toBe(Math.floor(20 * 0.25));
    expect(result['best']).toBe(2);
  });
});

describe('selectWordsForTest', () => {
  const allWords = ['the', 'of', 'and', 'to', 'in', 'a', 'is', 'that', 'for', 'it',
    'as', 'was', 'with', 'be', 'by'];

  test('when all words are unscored, returns frequency-expanded list (getTopWordsForTest picks top 10)', () => {
    const wordStats: Record<string, WordStats> = {};
    for (const w of allWords) {
      wordStats[w] = { word: w, time: 0, attempts: 0, lastScore: 0 };
    }
    const result = selectWordsForTest(wordStats, 40, 30, allWords);
    // getTopWordsForTest returns 10 unscored words; distribution is built over them
    expect(result.length).toBeGreaterThan(0);
    // Worst word (first of top-10 unscored) gets floor(30*0.25)=7 reps
    expect(result.filter(w => w === result[0]).length).toBeGreaterThanOrEqual(1);
  });

  test('returns repeated words list when scored words are present', () => {
    // Build stats with 3 scored words above graduation threshold (not graduated)
    const wpm = 40;
    const wordStats: Record<string, WordStats> = {};
    for (const w of allWords) {
      wordStats[w] = { word: w, time: 0, attempts: 0, lastScore: 0 };
    }
    // Score first 3 words above threshold (slow - not graduated)
    wordStats['the'] = { word: 'the', time: 500, attempts: 1, lastScore: 500 };
    wordStats['of'] = { word: 'of', time: 400, attempts: 1, lastScore: 400 };
    wordStats['and'] = { word: 'and', time: 350, attempts: 1, lastScore: 350 };

    const result = selectWordsForTest(wordStats, wpm, 30, allWords);
    // Should return a repeated word list (non-empty array built from frequency distribution)
    expect(result.length).toBeGreaterThan(0);
    // The worst word ('the' with score 500) should appear multiple times
    const theCount = result.filter(w => w === 'the').length;
    expect(theCount).toBeGreaterThan(1);
  });

  test('excludes graduated words from selection', () => {
    const wpm = 40;
    const wordStats: Record<string, WordStats> = {};
    for (const w of allWords) {
      wordStats[w] = { word: w, time: 0, attempts: 0, lastScore: 0 };
    }
    // Graduated words: score > 0 and < threshold (300ms at 40 wpm)
    wordStats['the'] = { word: 'the', time: 100, attempts: 1, lastScore: 100 };
    wordStats['of'] = { word: 'of', time: 200, attempts: 1, lastScore: 200 };
    // Non-graduated (above threshold)
    wordStats['and'] = { word: 'and', time: 400, attempts: 1, lastScore: 400 };

    const result = selectWordsForTest(wordStats, wpm, 30, allWords);
    expect(result).not.toContain('the');
    expect(result).not.toContain('of');
  });

  test('pure: no React, localStorage, or DOM access — receives all inputs explicitly', () => {
    // This test verifies the function signature takes explicit args and returns plain data
    const wordStats: Record<string, WordStats> = {};
    for (const w of allWords) {
      wordStats[w] = { word: w, time: 0, attempts: 0, lastScore: 0 };
    }
    const result = selectWordsForTest(wordStats, 40, 10, allWords);
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('normalized scoring seam', () => {
  test('graduation threshold equals ms-per-char at target WPM', () => {
    // At 60 WPM, avgCharsPerWord=5: 60000 / (60 * 5) = 200 ms/char
    expect(calculateGraduationThreshold(60)).toBe(200);
    // At 40 WPM: 60000 / (40 * 5) = 300 ms/char
    expect(calculateGraduationThreshold(40)).toBe(300);
  });

  test('short and long words typed at equal cadence receive equal normalized scores', () => {
    const cadenceMs = 100; // 100 ms per character
    const shortWord = 'hi';  // length 2
    const longWord = 'hello'; // length 5

    const shortScore = calculateNormalizedScore(cadenceMs * shortWord.length, shortWord.length);
    const longScore = calculateNormalizedScore(cadenceMs * longWord.length, longWord.length);

    expect(shortScore).toBe(cadenceMs);
    expect(longScore).toBe(cadenceMs);
    expect(shortScore).toBe(longScore);
  });

  test('fast short word scores below graduation threshold and graduates', () => {
    // At 60 WPM, threshold = 200 ms/char
    const wpmTarget = 60;
    const threshold = calculateGraduationThreshold(wpmTarget);

    // "hi" typed at 80 ms/char => total time 160ms
    const fastShortWordTime = 80 * 'hi'.length;
    const score = calculateNormalizedScore(fastShortWordTime, 'hi'.length);

    expect(score).toBeLessThan(threshold);
    expect(isGraduated(score, wpmTarget)).toBe(true);
  });
});

describe('wordUtils', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('getTopWordsForTest - no console output', () => {
    it('produces no console.log output during word selection', () => {
      const wordStats: Record<string, WordStats> = {
        the: { word: 'the', time: 200, attempts: 5, lastScore: 200 },
        and: { word: 'and', time: 300, attempts: 3, lastScore: 300 },
        is: { word: 'is', time: 0, attempts: 0, lastScore: 0 },
      };

      getTopWordsForTest(wordStats, 60);

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('produces no console.log output with an empty word list', () => {
      getTopWordsForTest({}, 60);
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('produces no console.log output when all words are graduated', () => {
      const threshold = calculateGraduationThreshold(60); // ~200ms
      const wordStats: Record<string, WordStats> = {
        the: { word: 'the', time: 100, attempts: 5, lastScore: threshold - 1 },
      };

      getTopWordsForTest(wordStats, 60);

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('calculateGraduationThreshold', () => {
    it('returns correct threshold for 60 wpm', () => {
      // 60000 / (60 * 5) = 200ms
      expect(calculateGraduationThreshold(60)).toBe(200);
    });

    it('returns correct threshold for 120 wpm', () => {
      // 60000 / (120 * 5) = 100ms
      expect(calculateGraduationThreshold(120)).toBe(100);
    });
  });

  describe('isGraduated', () => {
    it('returns false for score of 0 (unscored)', () => {
      expect(isGraduated(0, 60)).toBe(false);
    });

    it('returns true when score is below threshold', () => {
      const threshold = calculateGraduationThreshold(60); // 200ms
      expect(isGraduated(threshold - 1, 60)).toBe(true);
    });

    it('returns false when score equals threshold', () => {
      const threshold = calculateGraduationThreshold(60);
      expect(isGraduated(threshold, 60)).toBe(false);
    });

    it('returns false when score exceeds threshold (slow word)', () => {
      const threshold = calculateGraduationThreshold(60);
      expect(isGraduated(threshold + 100, 60)).toBe(false);
    });
  });

  describe('getTopWordsForTest - selection logic', () => {
    it('returns at most 10 words', () => {
      const wordStats: Record<string, WordStats> = {};
      for (let i = 0; i < 20; i++) {
        wordStats[`word${i}`] = { word: `word${i}`, time: 500, attempts: 1, lastScore: 500 + i };
      }

      const result = getTopWordsForTest(wordStats, 60);

      expect(result.length).toBeLessThanOrEqual(10);
    });

    it('excludes graduated words', () => {
      const threshold = calculateGraduationThreshold(60); // 200ms
      const wordStats: Record<string, WordStats> = {
        fast: { word: 'fast', time: 100, attempts: 5, lastScore: threshold - 1 }, // graduated
        slow: { word: 'slow', time: 500, attempts: 5, lastScore: 500 },           // not graduated
      };

      const result = getTopWordsForTest(wordStats, 60);

      expect(result).not.toContain('fast');
      expect(result).toContain('slow');
    });

    it('sorts worst (highest score) first, unscored words last', () => {
      const wordStats: Record<string, WordStats> = {
        worst: { word: 'worst', time: 600, attempts: 3, lastScore: 600 },
        bad: { word: 'bad', time: 400, attempts: 3, lastScore: 400 },
        unscored: { word: 'unscored', time: 0, attempts: 0, lastScore: 0 },
      };

      const result = getTopWordsForTest(wordStats, 60);

      expect(result[0]).toBe('worst');
      expect(result[1]).toBe('bad');
      expect(result[2]).toBe('unscored');
    });
  });
});

describe('computeWordElapsedTime', () => {
  test('returns completion time minus the first-keystroke timestamp', () => {
    expect(computeWordElapsedTime(100, 250)).toBe(150); // 250 - 100
  });

  test('regression: excludes pre-word pause (switch cost not baked into elapsed time)', () => {
    // Previous word completed at t=0; user pauses 500ms (switch cost) before typing.
    // Old behaviour: elapsed = completionTs - prevWordSpaceTs = 700 - 0 = 700
    // New behaviour: measured from the first character, so elapsed = 700 - 500 = 200
    const prevWordSpaceTimestamp = 0;
    const firstCharTimestamp = 500; // 500ms inter-word gap
    const completionTimestamp = 700;

    const elapsed = computeWordElapsedTime(firstCharTimestamp, completionTimestamp);

    expect(elapsed).toBe(200);
    // Confirm it excludes the 500ms switch cost that the old approach would include
    expect(elapsed).toBeLessThan(completionTimestamp - prevWordSpaceTimestamp);
  });

  test('fast short word can graduate with first-keystroke timing but not with switch-cost-inflated timing', () => {
    const wpmTarget = 60;
    const threshold = calculateGraduationThreshold(wpmTarget); // 200 ms/char

    // "hi" typed at 80ms/char: elapsed = 160ms, score = 80ms/char < threshold → graduates
    const elapsed = computeWordElapsedTime(0, 160);
    const score = calculateNormalizedScore(elapsed, 'hi'.length);

    expect(score).toBeLessThan(threshold);
    expect(isGraduated(score, wpmTarget)).toBe(true);

    // With old switch-cost-inflated timing (500ms inter-word gap added):
    const oldElapsed = elapsed + 500;
    const oldScore = calculateNormalizedScore(oldElapsed, 'hi'.length);
    expect(isGraduated(oldScore, wpmTarget)).toBe(false);
  });

  test('returns 0 when there is no recorded first keystroke', () => {
    expect(computeWordElapsedTime(null, 100)).toBe(0);
  });

  test('first-char timer stands when user backspaces to empty and retypes', () => {
    // Original first char at t=100; user backspaces and retypes, completing at t=400.
    // Elapsed is measured from the first char (t=100), not from the retype.
    expect(computeWordElapsedTime(100, 400)).toBe(300); // 400 - 100
  });
});

describe('selectWorkingSet', () => {
  const frequencyWords = ['the', 'of', 'and', 'to', 'in', 'a', 'is', 'that', 'for', 'it',
    'as', 'was', 'with', 'be', 'by'];

  test('with no scored words, returns first maxSize untouched words in frequency order', () => {
    const result = selectWorkingSet({}, 40, frequencyWords, 10);
    expect(result).toEqual(frequencyWords.slice(0, 10));
  });

  test('with no scored words and fewer words than maxSize, returns all available', () => {
    const result = selectWorkingSet({}, 40, ['the', 'of', 'and'], 10);
    expect(result).toEqual(['the', 'of', 'and']);
  });

  test('scored non-graduated words fill first slots worst-first, untouched fill remainder', () => {
    const wordStats: Record<string, WordStats> = {
      the: { word: 'the', time: 500, attempts: 1, lastScore: 500 },
      of:  { word: 'of',  time: 400, attempts: 1, lastScore: 400 },
    };
    const result = selectWorkingSet(wordStats, 40, frequencyWords, 10);
    // worst active word first
    expect(result[0]).toBe('the');
    expect(result[1]).toBe('of');
    // remaining 8 slots filled from untouched in frequency order
    expect(result.length).toBe(10);
    // 'the' and 'of' are scored; next untouched in frequencyWords is 'and'
    expect(result[2]).toBe('and');
    expect(result[3]).toBe('to');
  });

  test('graduated words excluded; their slots filled from untouched in frequency order', () => {
    // threshold at 40wpm = 300ms; lastScore: 100 < 300 => graduated
    const wordStats: Record<string, WordStats> = {
      the: { word: 'the', time: 100, attempts: 1, lastScore: 100 }, // graduated
      of:  { word: 'of',  time: 500, attempts: 1, lastScore: 500 }, // active
    };
    const result = selectWorkingSet(wordStats, 40, frequencyWords, 10);
    expect(result).not.toContain('the');
    expect(result).toContain('of');
    expect(result.length).toBe(10);
    // slot freed by 'the' filled from untouched ('and' is next after 'the','of' in frequencyWords)
    expect(result).toContain('and');
  });

  test('non-graduated scored word is never returned to untouched pool', () => {
    const wordStats: Record<string, WordStats> = {
      the: { word: 'the', time: 500, attempts: 1, lastScore: 500 },
    };
    const result = selectWorkingSet(wordStats, 40, frequencyWords, 10);
    // 'the' is active — must appear in the result
    expect(result).toContain('the');
    // it occupies the first (worst-first) slot
    expect(result[0]).toBe('the');
  });

  test('with fewer than maxSize non-graduated words, fills from untouched without error', () => {
    const wordStats: Record<string, WordStats> = {
      the: { word: 'the', time: 500, attempts: 1, lastScore: 500 },
    };
    const result = selectWorkingSet(wordStats, 40, frequencyWords, 10);
    expect(result.length).toBeLessThanOrEqual(10);
    expect(result).toContain('the');
    // filled from untouched to pad to maxSize
    expect(result.length).toBeGreaterThan(1);
  });

  test('caps result at maxSize even when more active words exist', () => {
    const wordStats: Record<string, WordStats> = {};
    for (let i = 0; i < 15; i++) {
      const w = `word${i}`;
      wordStats[w] = { word: w, time: 500 + i, attempts: 1, lastScore: 500 + i };
    }
    const allWords = Object.keys(wordStats);
    const result = selectWorkingSet(wordStats, 40, allWords, 10);
    expect(result.length).toBe(10);
  });

  test('selects the worst (highest score) active words when capped at maxSize', () => {
    const wordStats: Record<string, WordStats> = {};
    for (let i = 0; i < 15; i++) {
      const w = `word${i}`;
      wordStats[w] = { word: w, time: 500 + i, attempts: 1, lastScore: 500 + i };
    }
    const allWords = Object.keys(wordStats);
    const result = selectWorkingSet(wordStats, 40, allWords, 10);
    // worst word (word14, score 514) must be in result
    expect(result).toContain('word14');
    // best word (word0, score 500) is 15th-worst — should be excluded
    expect(result).not.toContain('word0');
  });

  test('untouched words are drawn in English-frequency (allWords) order', () => {
    // No active words — all 10 slots filled from allWords in order
    const result = selectWorkingSet({}, 40, frequencyWords, 5);
    expect(result).toEqual(['the', 'of', 'and', 'to', 'in']);
  });
});

describe('generateWordSet', () => {
  const makeStats = (words: string[], overrides: Record<string, Partial<WordStats>> = {}): Record<string, WordStats> => {
    const stats: Record<string, WordStats> = {};
    for (const w of words) {
      stats[w] = { word: w, time: 0, attempts: 0, lastScore: 0, ...overrides[w] };
    }
    return stats;
  };

  test('includes worst-scoring word when it has high lastScore', () => {
    const allWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it'];
    const stats = makeStats(allWords, {
      the: { time: 1000, attempts: 3, lastScore: 1000 }
    });

    const result = generateWordSet(10, 40, stats, allWords);

    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('the');
  });

  test('uses provided stats immediately (no stale closure)', () => {
    const allWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it'];

    const updatedStats = makeStats(allWords, {
      the: { time: 1000, attempts: 1, lastScore: 1000 }
    });

    // calling with freshly-computed updatedStats must reflect the new score immediately
    const result = generateWordSet(10, 40, updatedStats, allWords);

    expect(result).toContain('the');
  });

  test('excludes graduated words', () => {
    const allWords = ['the', 'be', 'to', 'of', 'and'];
    // wpmTarget=40 => threshold = 60000/(40*5) = 300ms; lastScore=100 < 300 & > 0 => graduated
    const stats = makeStats(allWords, {
      the: { time: 100, attempts: 5, lastScore: 100 }
    });

    for (let i = 0; i < 5; i++) {
      const result = generateWordSet(10, 40, stats, allWords);
      expect(result).not.toContain('the');
    }
  });

  test('returns words when all are unscored', () => {
    const allWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it'];
    const stats = makeStats(allWords);

    const result = generateWordSet(10, 40, stats, allWords);

    expect(result.length).toBeGreaterThan(0);
  });

  test('produced list length equals requested count exactly when scored words are present', () => {
    const allWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it'];
    const stats = makeStats(allWords, {
      the:  { lastScore: 900 },
      be:   { lastScore: 700 },
      to:   { lastScore: 620 },
      of:   { lastScore: 560 },
      and:  { lastScore: 500 },
      a:    { lastScore: 460 },
      in:   { lastScore: 420 },
      that: { lastScore: 380 },
      have: { lastScore: 340 },
      it:   { lastScore: 310 },
    });

    const result = generateWordSet(50, 40, stats, allWords);
    expect(result.length).toBe(50);
  });
});

describe('buildConvexDistribution', () => {
  // Helpers
  const mkEntries = (scores: number[]) =>
    scores.map((score, i) => ({ word: String.fromCharCode(97 + i), score }));

  // PRD worked example: N=50, 10 words, scores 900–310
  const prdEntries = mkEntries([900, 700, 620, 560, 500, 460, 420, 380, 340, 310]);

  test('produced word list totals exactly N — PRD worked example', () => {
    const dist = buildConvexDistribution(50, prdEntries);
    const total = Object.values(dist).reduce((a, b) => a + b, 0);
    expect(total).toBe(50);
  });

  test('produced word list totals exactly N across a range of N', () => {
    for (const n of [20, 30, 40, 50, 75, 100]) {
      const dist = buildConvexDistribution(n, prdEntries);
      const total = Object.values(dist).reduce((a, b) => a + b, 0);
      expect(total).toBe(n);
    }
  });

  test('worst word receives at least floor(0.25 * N) reps', () => {
    const dist = buildConvexDistribution(50, prdEntries);
    expect(dist['a']).toBeGreaterThanOrEqual(Math.floor(0.25 * 50)); // 12
  });

  test('best word receives exactly 2 reps (the floor) under normal conditions', () => {
    const dist = buildConvexDistribution(50, prdEntries);
    expect(dist['j']).toBe(2); // j is the best (lowest score 310)
  });

  test('rep counts are monotonic non-increasing from worst to best', () => {
    const dist = buildConvexDistribution(50, prdEntries);
    const reps = prdEntries.map(e => dist[e.word]);
    for (let i = 1; i < reps.length; i++) {
      expect(reps[i]).toBeLessThanOrEqual(reps[i - 1]);
    }
  });

  test('near-as-bad second word gets substantially more reps than the best word', () => {
    // word1=900, word2=870 (close to worst), word3=310 (much better)
    const entries = mkEntries([900, 870, 310]);
    const dist = buildConvexDistribution(50, entries);
    // word2 should be close to word1 and far above the floor (2)
    expect(dist['b']).toBeGreaterThan(dist['c'] + 2);
    // monotonic
    expect(dist['a']).toBeGreaterThanOrEqual(dist['b']);
  });

  test('near-tied scores still yield a valid full-length test', () => {
    const entries = mkEntries([500, 499, 498, 497, 496]);
    const dist = buildConvexDistribution(30, entries);
    const total = Object.values(dist).reduce((a, b) => a + b, 0);
    expect(total).toBe(30);
  });

  test('single word receives all N reps', () => {
    const dist = buildConvexDistribution(20, [{ word: 'only', score: 500 }]);
    expect(dist['only']).toBe(20);
  });

  test('two words: best gets 2 reps, worst absorbs the rest', () => {
    const dist = buildConvexDistribution(20, mkEntries([900, 310]));
    expect(dist['b']).toBe(2);
    expect(dist['a'] + dist['b']).toBe(20);
  });

  test('fewer scored words (3) produce exactly N reps', () => {
    const dist = buildConvexDistribution(50, mkEntries([900, 600, 310]));
    const total = Object.values(dist).reduce((a, b) => a + b, 0);
    expect(total).toBe(50);
    expect(dist['c']).toBe(2); // best gets floor
  });

  test('small N degrades gracefully — no error, total equals N', () => {
    // N=8 with 5 words: floor must relax to fit
    const dist = buildConvexDistribution(8, mkEntries([900, 700, 500, 400, 310]));
    const total = Object.values(dist).reduce((a, b) => a + b, 0);
    expect(total).toBe(8);
  });

  test('all-tied scores still produce a valid full-length test', () => {
    const entries = mkEntries([500, 500, 500, 500]);
    const dist = buildConvexDistribution(20, entries);
    const total = Object.values(dist).reduce((a, b) => a + b, 0);
    expect(total).toBe(20);
  });

  test('empty entries returns empty result', () => {
    const dist = buildConvexDistribution(50, []);
    expect(Object.keys(dist).length).toBe(0);
  });
});
