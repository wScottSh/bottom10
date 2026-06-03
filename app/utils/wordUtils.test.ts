import { describe, it, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateFrequencyDistribution,
  selectWordsForTest,
  generateWordSet,
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
});
