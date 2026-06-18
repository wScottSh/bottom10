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
  isGraduationCandidate,
  updateGraduationCounter,
  getTopWordsForTest,
  computeWordElapsedTime,
  computeWordTimingFromEvents,
  scoreToWpm,
  computeWpmParticle,
  dedupeAdjacent,
  KeystrokeEvent,
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
    const result = selectWordsForTest(wordStats, 30, allWords);
    // getTopWordsForTest returns 10 unscored words; distribution is built over them
    expect(result.length).toBeGreaterThan(0);
    // Worst word (first of top-10 unscored) gets floor(30*0.25)=7 reps
    expect(result.filter(w => w === result[0]).length).toBeGreaterThanOrEqual(1);
  });

  test('returns repeated words list when scored words are present', () => {
    // Build stats with 3 scored words above graduation threshold (not graduated)
    const wordStats: Record<string, WordStats> = {};
    for (const w of allWords) {
      wordStats[w] = { word: w, time: 0, attempts: 0, lastScore: 0 };
    }
    // Score first 3 words above threshold (slow - not graduated)
    wordStats['the'] = { word: 'the', time: 500, attempts: 1, lastScore: 500 };
    wordStats['of'] = { word: 'of', time: 400, attempts: 1, lastScore: 400 };
    wordStats['and'] = { word: 'and', time: 350, attempts: 1, lastScore: 350 };

    const result = selectWordsForTest(wordStats, 30, allWords);
    // Should return a repeated word list (non-empty array built from frequency distribution)
    expect(result.length).toBeGreaterThan(0);
    // The worst word ('the' with score 500) should appear multiple times
    const theCount = result.filter(w => w === 'the').length;
    expect(theCount).toBeGreaterThan(1);
  });

  test('excludes graduated words from selection', () => {
    const wordStats: Record<string, WordStats> = {};
    for (const w of allWords) {
      wordStats[w] = { word: w, time: 0, attempts: 0, lastScore: 0 };
    }
    // Graduated: score < threshold (300ms at 40 wpm) AND consecutiveSubThreshold >= 2
    wordStats['the'] = { word: 'the', time: 100, attempts: 1, lastScore: 100, consecutiveSubThreshold: 2 };
    wordStats['of'] = { word: 'of', time: 200, attempts: 1, lastScore: 200, consecutiveSubThreshold: 2 };
    // Non-graduated (above threshold)
    wordStats['and'] = { word: 'and', time: 400, attempts: 1, lastScore: 400 };

    const result = selectWordsForTest(wordStats, 30, allWords);
    expect(result).not.toContain('the');
    expect(result).not.toContain('of');
  });

  test('pure: no React, localStorage, or DOM access — receives all inputs explicitly', () => {
    // This test verifies the function signature takes explicit args and returns plain data
    const wordStats: Record<string, WordStats> = {};
    for (const w of allWords) {
      wordStats[w] = { word: w, time: 0, attempts: 0, lastScore: 0 };
    }
    const result = selectWordsForTest(wordStats, 10, allWords);
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

  test('fast short word score is below graduation threshold', () => {
    // At 60 WPM, threshold = 200 ms/char
    const wpmTarget = 60;
    const threshold = calculateGraduationThreshold(wpmTarget);

    // "hi" typed at 80 ms/char => total time 160ms
    const fastShortWordTime = 80 * 'hi'.length;
    const score = calculateNormalizedScore(fastShortWordTime, 'hi'.length);

    expect(score).toBeLessThan(threshold);
    // Durable graduation requires 2 consecutive sub-threshold tests; one alone is not enough.
    const stats: WordStats = { word: 'hi', time: fastShortWordTime, attempts: 1, lastScore: score, consecutiveSubThreshold: 1 };
    expect(isGraduated(stats)).toBe(false);
    const statsGraduated: WordStats = { ...stats, consecutiveSubThreshold: 2 };
    expect(isGraduated(statsGraduated)).toBe(true);
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

      getTopWordsForTest(wordStats);

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('produces no console.log output with an empty word list', () => {
      getTopWordsForTest({});
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('produces no console.log output when all words are graduated', () => {
      const threshold = calculateGraduationThreshold(60); // ~200ms
      const wordStats: Record<string, WordStats> = {
        the: { word: 'the', time: 100, attempts: 5, lastScore: threshold - 1 },
      };

      getTopWordsForTest(wordStats);

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
    const mkStats = (lastScore: number, consecutiveSubThreshold = 0): WordStats =>
      ({ word: 'hi', time: lastScore, attempts: 1, lastScore, consecutiveSubThreshold });

    it('returns false for unscored word (consecutiveSubThreshold=0)', () => {
      expect(isGraduated(mkStats(0))).toBe(false);
    });

    it('returns false after a single sub-threshold test (counter=1, not yet durable)', () => {
      const threshold = calculateGraduationThreshold(60); // 200ms
      expect(isGraduated(mkStats(threshold - 1, 1))).toBe(false);
    });

    it('returns true after two consecutive sub-threshold tests (counter=2)', () => {
      const threshold = calculateGraduationThreshold(60);
      expect(isGraduated(mkStats(threshold - 1, 2))).toBe(true);
    });

    it('returns false when score equals threshold', () => {
      const threshold = calculateGraduationThreshold(60);
      expect(isGraduated(mkStats(threshold, 0))).toBe(false);
    });

    it('returns false when score exceeds threshold (slow word)', () => {
      const threshold = calculateGraduationThreshold(60);
      expect(isGraduated(mkStats(threshold + 100, 0))).toBe(false);
    });

    it('defaults missing consecutiveSubThreshold to 0 (pre-existing records not graduated)', () => {
      const stats = { word: 'hi', time: 100, attempts: 1, lastScore: 100 } as WordStats;
      expect(isGraduated(stats)).toBe(false);
    });
  });

  describe('isGraduationCandidate', () => {
    const mkStats = (consecutiveSubThreshold: number): WordStats =>
      ({ word: 'hi', time: 100, attempts: 1, lastScore: 100, consecutiveSubThreshold });

    it('returns true when consecutiveSubThreshold is exactly 1', () => {
      expect(isGraduationCandidate(mkStats(1))).toBe(true);
    });

    it('returns false when consecutiveSubThreshold is 0', () => {
      expect(isGraduationCandidate(mkStats(0))).toBe(false);
    });

    it('returns false when consecutiveSubThreshold is 2 (already graduated)', () => {
      expect(isGraduationCandidate(mkStats(2))).toBe(false);
    });

    it('returns false when consecutiveSubThreshold is missing (legacy stats)', () => {
      const stats = { word: 'hi', time: 100, attempts: 1, lastScore: 100 } as WordStats;
      expect(isGraduationCandidate(stats)).toBe(false);
    });
  });

  describe('getTopWordsForTest - selection logic', () => {
    it('returns at most 10 words', () => {
      const wordStats: Record<string, WordStats> = {};
      for (let i = 0; i < 20; i++) {
        wordStats[`word${i}`] = { word: `word${i}`, time: 500, attempts: 1, lastScore: 500 + i };
      }

      const result = getTopWordsForTest(wordStats);

      expect(result.length).toBeLessThanOrEqual(10);
    });

    it('excludes graduated words', () => {
      const threshold = calculateGraduationThreshold(60); // 200ms
      const wordStats: Record<string, WordStats> = {
        fast: { word: 'fast', time: 100, attempts: 5, lastScore: threshold - 1, consecutiveSubThreshold: 2 }, // graduated
        slow: { word: 'slow', time: 500, attempts: 5, lastScore: 500, consecutiveSubThreshold: 0 },           // not graduated
      };

      const result = getTopWordsForTest(wordStats);

      expect(result).not.toContain('fast');
      expect(result).toContain('slow');
    });

    it('sorts worst (highest score) first, unscored words last', () => {
      const wordStats: Record<string, WordStats> = {
        worst: { word: 'worst', time: 600, attempts: 3, lastScore: 600 },
        bad: { word: 'bad', time: 400, attempts: 3, lastScore: 400 },
        unscored: { word: 'unscored', time: 0, attempts: 0, lastScore: 0 },
      };

      const result = getTopWordsForTest(wordStats);

      expect(result[0]).toBe('worst');
      expect(result[1]).toBe('bad');
      expect(result[2]).toBe('unscored');
    });

    it('returns empty array when stats is empty', () => {
      const result = getTopWordsForTest({});
      expect(result).toEqual([]);
    });

    it('returns empty array when all words are graduated', () => {
      const threshold = calculateGraduationThreshold(60); // 200ms
      const wordStats: Record<string, WordStats> = {
        a: { word: 'a', time: 100, attempts: 5, lastScore: threshold - 1, consecutiveSubThreshold: 2 },
        b: { word: 'b', time: 80, attempts: 5, lastScore: threshold - 50, consecutiveSubThreshold: 2 },
        c: { word: 'c', time: 60, attempts: 5, lastScore: threshold - 80, consecutiveSubThreshold: 3 },
      };

      const result = getTopWordsForTest(wordStats);

      expect(result).toEqual([]);
    });

    it('returns all unscored words (up to 10) when no words have been scored yet', () => {
      const wordStats: Record<string, WordStats> = {};
      for (let i = 0; i < 15; i++) {
        wordStats[`word${i}`] = { word: `word${i}`, time: 0, attempts: 0, lastScore: 0 };
      }

      const result = getTopWordsForTest(wordStats);

      expect(result.length).toBe(10);
      // All returned words should be unscored (from the stats)
      for (const w of result) {
        expect(wordStats[w].lastScore).toBe(0);
      }
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

  test('fast short word score is sub-threshold with first-keystroke timing but not with switch-cost-inflated timing', () => {
    const wpmTarget = 60;
    const threshold = calculateGraduationThreshold(wpmTarget); // 200 ms/char

    // "hi" typed at 80ms/char: elapsed = 160ms, score = 80ms/char < threshold
    const elapsed = computeWordElapsedTime(0, 160);
    const score = calculateNormalizedScore(elapsed, 'hi'.length);

    expect(score).toBeLessThan(threshold);
    // After two consecutive sub-threshold tests the word is durably graduated
    const graduatedStats: WordStats = { word: 'hi', time: elapsed, attempts: 2, lastScore: score, consecutiveSubThreshold: 2 };
    expect(isGraduated(graduatedStats)).toBe(true);

    // With old switch-cost-inflated timing (500ms inter-word gap added), score is above threshold
    const oldElapsed = elapsed + 500;
    const oldScore = calculateNormalizedScore(oldElapsed, 'hi'.length);
    expect(oldScore).toBeGreaterThanOrEqual(threshold);
  });

  test('returns 0 when there is no recorded first keystroke', () => {
    expect(computeWordElapsedTime(null, 100)).toBe(0);
  });

  test('first-char timer stands when user backspaces to empty and retypes', () => {
    // Original first char at t=100; user backspaces and retypes, completing at t=400.
    // Elapsed is measured from the first char (t=100), not from the retype.
    expect(computeWordElapsedTime(100, 400)).toBe(300); // 400 - 100
  });

  test('score is identical regardless of how long the user paused before starting the word', () => {
    // User story #5: a hesitation between words must not penalize the word that follows.
    const cadenceMs = 100; // 100ms per character
    const word = 'hi';     // length 2

    // No pause: started immediately
    const elapsedNoPause = computeWordElapsedTime(0, cadenceMs * word.length);
    const scoreNoPause = calculateNormalizedScore(elapsedNoPause, word.length);

    // Long pause (2 s) before first character
    const pauseMs = 2000;
    const elapsedWithPause = computeWordElapsedTime(pauseMs, pauseMs + cadenceMs * word.length);
    const scoreWithPause = calculateNormalizedScore(elapsedWithPause, word.length);

    expect(scoreNoPause).toBe(cadenceMs);
    expect(scoreWithPause).toBe(cadenceMs);
    expect(scoreNoPause).toBe(scoreWithPause);
  });

  test('first and non-first words in a test produce equal scores at equal cadence', () => {
    // User story #6: every word is measured consistently regardless of position.
    const cadenceMs = 80;
    const word = 'abc'; // length 3

    // First word (t=0 arbitrary start)
    const firstWordStart = 1000;
    const firstWordElapsed = computeWordElapsedTime(firstWordStart, firstWordStart + cadenceMs * word.length);

    // Second word — user paused 500ms between words
    const secondWordStart = firstWordStart + cadenceMs * word.length + 500;
    const secondWordElapsed = computeWordElapsedTime(secondWordStart, secondWordStart + cadenceMs * word.length);

    expect(firstWordElapsed).toBe(cadenceMs * word.length);
    expect(secondWordElapsed).toBe(cadenceMs * word.length);
    expect(firstWordElapsed).toBe(secondWordElapsed);
  });
});

describe('computeWordTimingFromEvents', () => {
  const ev = (key: string, timestamp: number): KeystrokeEvent => ({ key, timestamp });

  test('returns elapsed from first keystroke to space completion', () => {
    const events = [ev('h', 500), ev('i', 600), ev(' ', 700)];
    expect(computeWordTimingFromEvents(events)).toBe(200); // 700 - 500
  });

  test('regression: scripted sequence with deliberate pre-word pause — switch cost excluded', () => {
    // First character arrives 500ms after the previous word's space (t=0).
    // The sequence contains the gap via timestamps; the helper excludes it by
    // starting the clock at the first character (t=500), not at t=0.
    const prevWordSpaceTs = 0;
    const events = [
      ev('h', 500),  // first char — 500ms after previous word's space
      ev('i', 600),
      ev(' ', 700),  // completion
    ];
    const elapsed = computeWordTimingFromEvents(events);
    expect(elapsed).toBe(200);                              // 700 - 500
    expect(elapsed).toBeLessThan(700 - prevWordSpaceTs);   // excludes the 500ms gap
  });

  test('fast short word score is sub-threshold with sequence timing; switch-cost-inflated score is above', () => {
    const wpmTarget = 60;
    const threshold = calculateGraduationThreshold(wpmTarget); // 200 ms/char

    // "hi" typed at 80ms/char (160ms total) but with a 500ms pre-word pause
    const events = [ev('h', 500), ev('i', 580), ev(' ', 660)];
    const elapsed = computeWordTimingFromEvents(events); // 660 - 500 = 160
    const score = calculateNormalizedScore(elapsed, 'hi'.length);
    expect(score).toBeLessThan(threshold); // 80 < 200 → can graduate

    // Old approach measured from t=0: elapsed = 660, score = 330 > threshold
    const oldScore = calculateNormalizedScore(660, 'hi'.length);
    expect(oldScore).toBeGreaterThan(threshold);
  });

  test('backspacing to empty and retyping does not reset the start timestamp', () => {
    // First char at t=100, backspace to empty at t=200, retype starting at t=300
    const events = [
      ev('h', 100),
      ev('Backspace', 200),  // input back to empty; timer NOT reset
      ev('h', 300),          // retype — timer still anchored at t=100
      ev('i', 350),
      ev(' ', 400),
    ];
    expect(computeWordTimingFromEvents(events)).toBe(300); // 400 - 100
  });

  test('timer starts on first character even when that character is incorrect', () => {
    // Wrong first char at t=100 (criterion: incorrect chars still begin the attempt)
    const events = [
      ev('x', 100),          // wrong char — still starts the timer
      ev('Backspace', 200),
      ev('h', 300),          // correct retype
      ev('i', 400),
      ev(' ', 500),
    ];
    expect(computeWordTimingFromEvents(events)).toBe(400); // 500 - 100
  });

  test('returns 0 for an empty event sequence', () => {
    expect(computeWordTimingFromEvents([])).toBe(0);
  });

  test('returns 0 when no completion space is present', () => {
    const events = [ev('h', 100), ev('i', 200)];
    expect(computeWordTimingFromEvents(events)).toBe(0);
  });
});

describe('selectWorkingSet', () => {
  const frequencyWords = ['the', 'of', 'and', 'to', 'in', 'a', 'is', 'that', 'for', 'it',
    'as', 'was', 'with', 'be', 'by'];

  test('with no scored words, returns first maxSize untouched words in frequency order', () => {
    const result = selectWorkingSet({}, frequencyWords, 10);
    expect(result).toEqual(frequencyWords.slice(0, 10));
  });

  test('with no scored words and fewer words than maxSize, returns all available', () => {
    const result = selectWorkingSet({}, ['the', 'of', 'and'], 10);
    expect(result).toEqual(['the', 'of', 'and']);
  });

  test('scored non-graduated words fill first slots worst-first, untouched fill remainder', () => {
    const wordStats: Record<string, WordStats> = {
      the: { word: 'the', time: 500, attempts: 1, lastScore: 500 },
      of:  { word: 'of',  time: 400, attempts: 1, lastScore: 400 },
    };
    const result = selectWorkingSet(wordStats, frequencyWords, 10);
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
    // threshold at 40wpm = 300ms; lastScore: 100 < 300 and consecutiveSubThreshold: 2 => graduated
    const wordStats: Record<string, WordStats> = {
      the: { word: 'the', time: 100, attempts: 1, lastScore: 100, consecutiveSubThreshold: 2 }, // graduated
      of:  { word: 'of',  time: 500, attempts: 1, lastScore: 500, consecutiveSubThreshold: 0 }, // active
    };
    const result = selectWorkingSet(wordStats, frequencyWords, 10);
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
    const result = selectWorkingSet(wordStats, frequencyWords, 10);
    // 'the' is active — must appear in the result
    expect(result).toContain('the');
    // it occupies the first (worst-first) slot
    expect(result[0]).toBe('the');
  });

  test('with fewer than maxSize non-graduated words, fills from untouched without error', () => {
    const wordStats: Record<string, WordStats> = {
      the: { word: 'the', time: 500, attempts: 1, lastScore: 500 },
    };
    const result = selectWorkingSet(wordStats, frequencyWords, 10);
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
    const result = selectWorkingSet(wordStats, allWords, 10);
    expect(result.length).toBe(10);
  });

  test('selects the worst (highest score) active words when capped at maxSize', () => {
    const wordStats: Record<string, WordStats> = {};
    for (let i = 0; i < 15; i++) {
      const w = `word${i}`;
      wordStats[w] = { word: w, time: 500 + i, attempts: 1, lastScore: 500 + i };
    }
    const allWords = Object.keys(wordStats);
    const result = selectWorkingSet(wordStats, allWords, 10);
    // worst word (word14, score 514) must be in result
    expect(result).toContain('word14');
    // best word (word0, score 500) is 15th-worst — should be excluded
    expect(result).not.toContain('word0');
  });

  test('untouched words are drawn in English-frequency (allWords) order', () => {
    // No active words — all 10 slots filled from allWords in order
    const result = selectWorkingSet({}, frequencyWords, 5);
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

    const result = generateWordSet(10, stats, allWords);

    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('the');
  });

  test('uses provided stats immediately (no stale closure)', () => {
    const allWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it'];

    const updatedStats = makeStats(allWords, {
      the: { time: 1000, attempts: 1, lastScore: 1000 }
    });

    // calling with freshly-computed updatedStats must reflect the new score immediately
    const result = generateWordSet(10, updatedStats, allWords);

    expect(result).toContain('the');
  });

  test('excludes graduated words', () => {
    const allWords = ['the', 'be', 'to', 'of', 'and'];
    // wpmTarget=40 => threshold = 300ms; lastScore=100 < 300 and consecutiveSubThreshold=2 => graduated
    const stats = makeStats(allWords, {
      the: { time: 100, attempts: 5, lastScore: 100, consecutiveSubThreshold: 2 }
    });

    for (let i = 0; i < 5; i++) {
      const result = generateWordSet(10, stats, allWords);
      expect(result).not.toContain('the');
    }
  });

  test('returns words when all are unscored', () => {
    const allWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it'];
    const stats = makeStats(allWords);

    const result = generateWordSet(10, stats, allWords);

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

    const result = generateWordSet(50, stats, allWords);
    expect(result.length).toBe(50);
  });

  test('produced list length equals requested count exactly when all words are unscored', () => {
    // allWords has enough entries to fill count; none have been scored yet
    const allWords = Array.from({ length: 60 }, (_, i) => `word${i}`);
    const stats = makeStats(allWords);  // all 60 words with lastScore: 0

    const result = generateWordSet(50, stats, allWords);
    expect(result.length).toBe(50);
  });

  test('first test draws words from allWords in frequency (slice) order before shuffle', () => {
    // Verify the pool comes from allWords (frequency-ordered), not an arbitrary subset.
    // We use a small count so we can check membership precisely.
    const allWords = ['freq1', 'freq2', 'freq3', 'freq4', 'freq5',
                      'freq6', 'freq7', 'freq8', 'freq9', 'freq10'];
    const stats = makeStats(allWords);  // all unscored

    const result = generateWordSet(5, stats, allWords);
    expect(result.length).toBe(5);
    // Every returned word must be in allWords
    for (const w of result) {
      expect(allWords).toContain(w);
    }
  });

  test('first test uses only top 10 frequency-ordered words, repeated to fill count', () => {
    // When all words are unscored and there are more than 10, only the top 10
    // frequency-ordered words should appear (repeated) — not 50 unique words.
    const allWords = Array.from({ length: 60 }, (_, i) => `word${i}`);
    const stats = makeStats(allWords);  // all 60 words unscored

    const result = generateWordSet(50, stats, allWords);
    expect(result.length).toBe(50);

    const uniqueWords = new Set(result);
    expect(uniqueWords.size).toBeLessThanOrEqual(10);

    const top10 = new Set(allWords.slice(0, 10));
    for (const w of uniqueWords) {
      expect(top10.has(w)).toBe(true);
    }
  });

  test('first test with no stats uses only top 10 frequency-ordered words, repeated to fill count', () => {
    // Edge case: empty wordStats (truly first ever session, no pre-populated stats).
    const allWords = Array.from({ length: 60 }, (_, i) => `word${i}`);

    const result = generateWordSet(50, {}, allWords);
    expect(result.length).toBe(50);

    const uniqueWords = new Set(result);
    expect(uniqueWords.size).toBeLessThanOrEqual(10);

    const top10 = new Set(allWords.slice(0, 10));
    for (const w of uniqueWords) {
      expect(top10.has(w)).toBe(true);
    }
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

describe('updateGraduationCounter', () => {
  const wpm = 40; // threshold = 60000 / (40 * 5) = 300ms

  const mkStats = (lastScore: number, consecutiveSubThreshold = 0): WordStats =>
    ({ word: 'hi', time: lastScore, attempts: 1, lastScore, consecutiveSubThreshold });

  test('increments counter when score is below threshold', () => {
    const stats = mkStats(100, 0); // 100 < 300
    const updated = updateGraduationCounter(stats, wpm);
    expect(updated.consecutiveSubThreshold).toBe(1);
  });

  test('resets counter to 0 when score equals threshold', () => {
    const stats = mkStats(300, 1); // 300 = threshold
    const updated = updateGraduationCounter(stats, wpm);
    expect(updated.consecutiveSubThreshold).toBe(0);
  });

  test('resets counter to 0 when score exceeds threshold', () => {
    const stats = mkStats(500, 1); // 500 > 300
    const updated = updateGraduationCounter(stats, wpm);
    expect(updated.consecutiveSubThreshold).toBe(0);
  });

  test('a single sub-threshold test does not graduate the word', () => {
    const stats = mkStats(100, 0);
    const updated = updateGraduationCounter(stats, wpm);
    expect(isGraduated(updated)).toBe(false);
  });

  test('two consecutive sub-threshold tests graduate the word', () => {
    const stats = mkStats(100, 1); // counter already at 1
    const updated = updateGraduationCounter(stats, wpm);
    expect(updated.consecutiveSubThreshold).toBe(2);
    expect(isGraduated(updated)).toBe(true);
  });

  test('at-threshold result resets accumulated progress', () => {
    const stats = mkStats(300, 1); // was 1 away from graduating
    const updated = updateGraduationCounter(stats, wpm);
    expect(updated.consecutiveSubThreshold).toBe(0);
    expect(isGraduated(updated)).toBe(false);
  });

  test('preserves other WordStats fields unchanged', () => {
    const stats: WordStats = { word: 'hello', time: 250, attempts: 5, lastScore: 100, consecutiveSubThreshold: 0 };
    const updated = updateGraduationCounter(stats, wpm);
    expect(updated.word).toBe('hello');
    expect(updated.time).toBe(250);
    expect(updated.attempts).toBe(5);
    expect(updated.lastScore).toBe(100);
  });

  test('defaults missing consecutiveSubThreshold to 0 (localStorage migration)', () => {
    const stats = { word: 'hi', time: 100, attempts: 1, lastScore: 100 } as WordStats;
    const updated = updateGraduationCounter(stats, wpm);
    expect(updated.consecutiveSubThreshold).toBe(1); // treated as 0, then incremented
  });
});

describe('scoreToWpm', () => {
  // lastScore = avgTime_ms / wordLength; wpm = 12000 / lastScore
  it('converts 300 ms/char to 40 wpm', () => {
    expect(scoreToWpm(300)).toBe(40);
  });

  it('converts 200 ms/char to 60 wpm', () => {
    expect(scoreToWpm(200)).toBe(60);
  });

  it('converts 120 ms/char to 100 wpm', () => {
    expect(scoreToWpm(120)).toBe(100);
  });

  it('rounds to the nearest integer', () => {
    // 12000 / 250 = 48 exactly
    expect(scoreToWpm(250)).toBe(48);
    // 12000 / 350 ≈ 34.28 → rounds to 34
    expect(scoreToWpm(350)).toBe(34);
  });
});

describe('dedupeAdjacent', () => {
  const hasAdjacentDupe = (arr: string[]) =>
    arr.some((w, i) => i > 0 && w === arr[i - 1]);

  it('returns the same array reference (in-place mutation)', () => {
    const arr = ['a', 'a', 'b'];
    const result = dedupeAdjacent(arr);
    expect(result).toBe(arr);
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
    const arr = ['a', 'a', 'a', 'a'];
    expect(() => dedupeAdjacent(arr)).not.toThrow();
    // Can't eliminate all duplicates when one word dominates — that's acceptable
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

describe('generateWordSet — no adjacent duplicates', () => {
  const hasAdjacentDupe = (arr: string[]) =>
    arr.some((w, i) => i > 0 && w === arr[i - 1]);

  it('produced list has no adjacent identical words (scored path)', () => {
    const allWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it'];
    const stats: Record<string, WordStats> = {};
    for (const w of allWords) {
      stats[w] = { word: w, time: 500, attempts: 3, lastScore: 500 };
    }
    for (let i = 0; i < 10; i++) {
      const result = generateWordSet(30, stats, allWords);
      expect(hasAdjacentDupe(result)).toBe(false);
    }
  });

  it('produced list has no adjacent identical words (unscored / first-session path)', () => {
    const allWords = Array.from({ length: 10 }, (_, i) => `word${i}`);
    for (let i = 0; i < 10; i++) {
      const result = generateWordSet(30, {}, allWords);
      expect(hasAdjacentDupe(result)).toBe(false);
    }
  });
});

describe('computeWpmParticle', () => {
  // wpmTarget=50 → graduation threshold = 60000/(50*5) = 240 ms/char
  const WPM_TARGET = 50;

  it('fast completion: returns isFast=true when wpm > target', () => {
    // elapsed=1000ms, len=5 → score=200ms/char → wpm=60
    const { wpm, isFast } = computeWpmParticle(1000, 5, WPM_TARGET);
    expect(wpm).toBe(60);
    expect(isFast).toBe(true);
  });

  it('slow completion: returns isFast=false when wpm < target', () => {
    // elapsed=2000ms, len=5 → score=400ms/char → wpm=30
    const { wpm, isFast } = computeWpmParticle(2000, 5, WPM_TARGET);
    expect(wpm).toBe(30);
    expect(isFast).toBe(false);
  });

  it('exactly at target: returns isFast=true (equal counts as green)', () => {
    // elapsed=1200ms, len=5 → score=240ms/char → wpm=50 (exactly target)
    const { wpm, isFast } = computeWpmParticle(1200, 5, WPM_TARGET);
    expect(wpm).toBe(50);
    expect(isFast).toBe(true);
  });

  it('wpm value is always an integer', () => {
    // elapsed=700ms, len=3 → score=233.33ms/char → raw wpm≈51.43 → rounds to 51
    const { wpm } = computeWpmParticle(700, 3, WPM_TARGET);
    expect(Number.isInteger(wpm)).toBe(true);
    expect(wpm).toBe(51);
  });

  it('wpm agrees with the scoring pipeline for representative inputs', () => {
    const elapsed = 800;
    const wordLength = 4;
    const expected = scoreToWpm(calculateNormalizedScore(elapsed, wordLength));
    const { wpm } = computeWpmParticle(elapsed, wordLength, WPM_TARGET);
    expect(wpm).toBe(expected);
  });
});
