import { describe, it, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildConvexDistribution,
  generateWordSet,
  calculateNormalizedScore,
  calculateGraduationThreshold,
  getTopWordsForTest,
  computeWordElapsedTime,
  computeWordTimingFromEvents,
  scoreToWpm,
  computeWpmParticle,
  dedupeAdjacent,
  applySessionToStats,
  compareByScore,
  KeystrokeEvent,
  WordStats,
} from './wordUtils';
// isGraduated is imported as a helper to assert graduation outcomes in the
// applySessionToStats / scoring tests below. Graduation's own unit tests live
// in graduation.test.ts.
import { isGraduated } from './graduation';

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

// Shared by the generateWordSet describe blocks below: builds a WordStats map
// from a word list, applying per-word overrides on top of unscored defaults.
const makeStats = (words: string[], overrides: Record<string, Partial<WordStats>> = {}): Record<string, WordStats> => {
  const stats: Record<string, WordStats> = {};
  for (const w of words) {
    stats[w] = { word: w, time: 0, attempts: 0, lastScore: 0, ...overrides[w] };
  }
  return stats;
};

describe('generateWordSet', () => {
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

describe('generateWordSet — working set selection and distribution (issue #32)', () => {
  test('fully-graduated pool: returns empty array when all words have graduated', () => {
    // lastScore=100 < threshold(40wpm)=300 AND consecutiveSubThreshold=2 => graduated
    const allWords = ['the', 'be', 'to', 'of', 'and'];
    const stats = makeStats(allWords, {
      the: { lastScore: 100, consecutiveSubThreshold: 2 },
      be:  { lastScore: 100, consecutiveSubThreshold: 2 },
      to:  { lastScore: 100, consecutiveSubThreshold: 2 },
      of:  { lastScore: 100, consecutiveSubThreshold: 2 },
      and: { lastScore: 100, consecutiveSubThreshold: 2 },
    });

    const result = generateWordSet(50, stats, allWords);
    expect(result).toEqual([]);
  });

  test('mixed scored/unscored: unscored words appear exactly 2 times each', () => {
    // 3 scored (not graduated) + 2 unscored in the working set
    const allWords = ['the', 'be', 'to', 'of', 'and'];
    const stats = makeStats(allWords, {
      the: { lastScore: 800 },
      be:  { lastScore: 600 },
      to:  { lastScore: 400 },
      // 'of' and 'and' remain unscored (lastScore: 0)
    });

    const result = generateWordSet(50, stats, allWords);

    expect(result.filter(w => w === 'of').length).toBe(2);
    expect(result.filter(w => w === 'and').length).toBe(2);
  });

  test('mixed scored/unscored: worst-scoring word gets more reps than best-scoring word', () => {
    const allWords = ['the', 'be', 'to', 'of', 'and'];
    const stats = makeStats(allWords, {
      the: { lastScore: 800 },  // worst
      be:  { lastScore: 600 },
      to:  { lastScore: 400 },  // best scored
      // 'of' and 'and' unscored
    });

    const result = generateWordSet(50, stats, allWords);

    const theCount = result.filter(w => w === 'the').length;
    const toCount = result.filter(w => w === 'to').length;
    expect(theCount).toBeGreaterThan(toCount);
  });

  test('working set caps at WORKING_SET_SIZE=10 even when more active scored words exist', () => {
    // 15 scored non-graduated words: only the worst 10 should appear
    const allWords = Array.from({ length: 15 }, (_, i) => `word${i}`);
    const overrides: Record<string, Partial<WordStats>> = {};
    for (let i = 0; i < 15; i++) {
      overrides[`word${i}`] = { lastScore: 300 + i * 10 };  // word14=440 (worst), word0=300 (best)
    }
    const stats = makeStats(allWords, overrides);

    const result = generateWordSet(50, stats, allWords);

    const uniqueWords = new Set(result);
    expect(uniqueWords.size).toBeLessThanOrEqual(10);
    expect(uniqueWords.has('word14')).toBe(true);   // worst must be included
    expect(uniqueWords.has('word0')).toBe(false);   // best of 15 is cut off
  });

  test('graduated word slot is filled by untouched words from allWords frequency order', () => {
    // 'the' is graduated; 'be' is active scored; rest are untouched
    const allWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it'];
    const stats = makeStats(allWords, {
      the: { lastScore: 100, consecutiveSubThreshold: 2 },  // graduated
      be:  { lastScore: 800 },  // active scored
    });

    const result = generateWordSet(50, stats, allWords);

    expect(result).not.toContain('the');
    expect(result).toContain('be');
    // Untouched words fill in for the graduated slot
    const untouched = ['to', 'of', 'and', 'a', 'in', 'that', 'have', 'it'];
    const hasUntouched = untouched.some(w => result.includes(w));
    expect(hasUntouched).toBe(true);
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

describe('applySessionToStats', () => {
  const wpmTarget = 40; // threshold = 300 ms/char

  const baseStats = (words: string[]): Record<string, WordStats> => {
    const stats: Record<string, WordStats> = {};
    for (const w of words) {
      stats[w] = { word: w, time: 0, attempts: 0, lastScore: 0 };
    }
    return stats;
  };

  test('increments attempts by 1 for each typed word', () => {
    const stats = baseStats(['the', 'and']);
    const typedWords = [
      { word: 'the', time: 500, errors: 0 },
    ];
    const result = applySessionToStats(stats, typedWords, wpmTarget);
    expect(result['the'].attempts).toBe(1);
    expect(result['and'].attempts).toBe(0); // untouched
  });

  test('averages time when the same word is typed multiple times in one session', () => {
    const stats = baseStats(['the']);
    const typedWords = [
      { word: 'the', time: 200, errors: 0 },
      { word: 'the', time: 400, errors: 0 },
    ];
    const result = applySessionToStats(stats, typedWords, wpmTarget);
    // avg = (200 + 400) / 2 = 300; attempts only incremented once (per word group)
    expect(result['the'].time).toBe(300);
    expect(result['the'].attempts).toBe(1);
  });

  test('updates lastScore to the normalized score of the averaged time', () => {
    const stats = baseStats(['hi']);
    const typedWords = [{ word: 'hi', time: 400, errors: 0 }]; // 400 / 2 = 200 ms/char
    const result = applySessionToStats(stats, typedWords, wpmTarget);
    expect(result['hi'].lastScore).toBe(calculateNormalizedScore(400, 2));
  });

  test('runs updateGraduationCounter: sub-threshold word increments consecutiveSubThreshold', () => {
    const stats = baseStats(['hi']);
    // wpmTarget=40 → threshold=300ms/char; 100ms/char is sub-threshold
    const typedWords = [{ word: 'hi', time: 100 * 2, errors: 0 }]; // 100 ms/char
    const result = applySessionToStats(stats, typedWords, wpmTarget);
    expect(result['hi'].consecutiveSubThreshold).toBe(1);
    expect(isGraduated(result['hi'])).toBe(false);
  });

  test('runs updateGraduationCounter: two consecutive sub-threshold results graduate the word', () => {
    const stats: Record<string, WordStats> = {
      hi: { word: 'hi', time: 100, attempts: 1, lastScore: 100, consecutiveSubThreshold: 1 },
    };
    const typedWords = [{ word: 'hi', time: 100 * 2, errors: 0 }]; // sub-threshold again
    const result = applySessionToStats(stats, typedWords, wpmTarget);
    expect(isGraduated(result['hi'])).toBe(true);
  });

  test('untouched word stays identical (same object values)', () => {
    const stats = baseStats(['the', 'and']);
    const typedWords = [{ word: 'the', time: 300, errors: 0 }];
    const result = applySessionToStats(stats, typedWords, wpmTarget);
    expect(result['and']).toEqual(stats['and']);
  });

  test('does not mutate the input stats object', () => {
    const stats = baseStats(['the']);
    const statsBefore = { ...stats, the: { ...stats['the'] } };
    const typedWords = [{ word: 'the', time: 500, errors: 0 }];
    applySessionToStats(stats, typedWords, wpmTarget);
    expect(stats['the']).toEqual(statsBefore['the']);
  });

  test('second session shifts lastScore toward new value rather than replacing it (cumulative average)', () => {
    // First session established a score of 200 ms/char for 2-char word 'hi'
    const stats: Record<string, WordStats> = {
      hi: { word: 'hi', time: 400, attempts: 1, lastScore: 200, consecutiveSubThreshold: 0 },
    };
    // Second session: 600ms total for 'hi' → session score = 600/2 = 300 ms/char
    const typedWords = [{ word: 'hi', time: 600, errors: 0 }];
    const result = applySessionToStats(stats, typedWords, wpmTarget);
    // Cumulative average: (200 * 1 + 300) / 2 = 250
    expect(result['hi'].lastScore).toBe(250);
    // Must not be the raw session score (300) — prior attempts must be weighted in
    expect(result['hi'].lastScore).not.toBe(300);
  });
});

describe('compareByScore', () => {
  it('places an unscored word (score=0) after a scored word', () => {
    expect(compareByScore(0, 100)).toBeGreaterThan(0);
    expect(compareByScore(100, 0)).toBeLessThan(0);
  });

  it('treats two unscored words as equal', () => {
    expect(compareByScore(0, 0)).toBe(0);
  });

  it('sorts scored words ascending — lower score (faster) ranks first', () => {
    expect(compareByScore(100, 200)).toBeLessThan(0);
    expect(compareByScore(200, 100)).toBeGreaterThan(0);
    expect(compareByScore(200, 200)).toBe(0);
  });
});
