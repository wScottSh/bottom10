import { describe, it, test, expect } from 'vitest';
import {
  computeWordElapsedTime,
  computeWordTimingFromEvents,
  computeWpmParticle,
  applySessionToStats,
  compareByScore,
  KeystrokeEvent,
  WordStats,
} from './wordUtils';
import { scoreFromElapsed, wpmFromScore, graduationThreshold } from './score';
import { isGraduated } from './graduation';

describe('normalized scoring seam', () => {
  test('graduation threshold equals ms-per-char at target WPM', () => {
    // At 60 WPM, avgCharsPerWord=5: 60000 / (60 * 5) = 200 ms/char
    expect(graduationThreshold(60)).toBe(200);
    // At 40 WPM: 60000 / (40 * 5) = 300 ms/char
    expect(graduationThreshold(40)).toBe(300);
  });

  test('short and long words typed at equal cadence receive equal normalized scores', () => {
    const cadenceMs = 100; // 100 ms per character
    const shortWord = 'hi';  // length 2
    const longWord = 'hello'; // length 5

    const shortScore = scoreFromElapsed(cadenceMs * shortWord.length, shortWord.length);
    const longScore = scoreFromElapsed(cadenceMs * longWord.length, longWord.length);

    expect(shortScore).toBe(cadenceMs);
    expect(longScore).toBe(cadenceMs);
    expect(shortScore).toBe(longScore);
  });

  test('fast short word score is below graduation threshold', () => {
    // At 60 WPM, threshold = 200 ms/char
    const wpmTarget = 60;
    const threshold = graduationThreshold(wpmTarget);

    // "hi" typed at 80 ms/char => total time 160ms
    const fastShortWordTime = 80 * 'hi'.length;
    const score = scoreFromElapsed(fastShortWordTime, 'hi'.length);

    expect(score).toBeLessThan(threshold);
    // Durable graduation requires 2 consecutive sub-threshold tests; one alone is not enough.
    const stats: WordStats = { word: 'hi', time: fastShortWordTime, attempts: 1, lastScore: score, consecutiveSubThreshold: 1 };
    expect(isGraduated(stats)).toBe(false);
    const statsGraduated: WordStats = { ...stats, consecutiveSubThreshold: 2 };
    expect(isGraduated(statsGraduated)).toBe(true);
  });
});

describe('graduationThreshold (score module)', () => {
  it('returns correct threshold for 60 wpm', () => {
    expect(graduationThreshold(60)).toBe(200);
  });

  it('returns correct threshold for 120 wpm', () => {
    expect(graduationThreshold(120)).toBe(100);
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
    const threshold = graduationThreshold(wpmTarget); // 200 ms/char

    // "hi" typed at 80ms/char: elapsed = 160ms, score = 80ms/char < threshold
    const elapsed = computeWordElapsedTime(0, 160);
    const score = scoreFromElapsed(elapsed, 'hi'.length);

    expect(score).toBeLessThan(threshold);
    // After two consecutive sub-threshold tests the word is durably graduated
    const graduatedStats: WordStats = { word: 'hi', time: elapsed, attempts: 2, lastScore: score, consecutiveSubThreshold: 2 };
    expect(isGraduated(graduatedStats)).toBe(true);

    // With old switch-cost-inflated timing (500ms inter-word gap added), score is above threshold
    const oldElapsed = elapsed + 500;
    const oldScore = scoreFromElapsed(oldElapsed, 'hi'.length);
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
    const scoreNoPause = scoreFromElapsed(elapsedNoPause, word.length);

    // Long pause (2 s) before first character
    const pauseMs = 2000;
    const elapsedWithPause = computeWordElapsedTime(pauseMs, pauseMs + cadenceMs * word.length);
    const scoreWithPause = scoreFromElapsed(elapsedWithPause, word.length);

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
    const threshold = graduationThreshold(wpmTarget); // 200 ms/char

    // "hi" typed at 80ms/char (160ms total) but with a 500ms pre-word pause
    const events = [ev('h', 500), ev('i', 580), ev(' ', 660)];
    const elapsed = computeWordTimingFromEvents(events); // 660 - 500 = 160
    const score = scoreFromElapsed(elapsed, 'hi'.length);
    expect(score).toBeLessThan(threshold); // 80 < 200 → can graduate

    // Old approach measured from t=0: elapsed = 660, score = 330 > threshold
    const oldScore = scoreFromElapsed(660, 'hi'.length);
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


describe('wpmFromScore (score module)', () => {
  // lastScore = avgTime_ms / wordLength; wpm = 12000 / lastScore
  it('converts 300 ms/char to 40 wpm', () => {
    expect(wpmFromScore(300)).toBe(40);
  });

  it('converts 200 ms/char to 60 wpm', () => {
    expect(wpmFromScore(200)).toBe(60);
  });

  it('converts 120 ms/char to 100 wpm', () => {
    expect(wpmFromScore(120)).toBe(100);
  });

  it('rounds to the nearest integer', () => {
    // 12000 / 250 = 48 exactly
    expect(wpmFromScore(250)).toBe(48);
    // 12000 / 350 ≈ 34.28 → rounds to 34
    expect(wpmFromScore(350)).toBe(34);
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
    const expected = wpmFromScore(scoreFromElapsed(elapsed, wordLength));
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
    expect(result['hi'].lastScore).toBe(scoreFromElapsed(400, 2));
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

  test('first session: prevScore is not set (neutral — no prior to compare against)', () => {
    const stats = baseStats(['hi']);
    const typedWords = [{ word: 'hi', time: 400, errors: 0 }];
    const result = applySessionToStats(stats, typedWords, wpmTarget);
    expect(result['hi'].prevScore).toBeUndefined();
  });

  test('second session: prevScore captures the old lastScore before the update', () => {
    const stats: Record<string, WordStats> = {
      hi: { word: 'hi', time: 400, attempts: 1, lastScore: 200, consecutiveSubThreshold: 0 },
    };
    const typedWords = [{ word: 'hi', time: 600, errors: 0 }];
    const result = applySessionToStats(stats, typedWords, wpmTarget);
    // prevScore is the old lastScore (200), not the new one (250)
    expect(result['hi'].prevScore).toBe(200);
    expect(result['hi'].lastScore).toBe(250);
  });

  test('prevScore is not set for words not typed in the session', () => {
    const stats = baseStats(['the', 'and']);
    const typedWords = [{ word: 'the', time: 300, errors: 0 }];
    const result = applySessionToStats(stats, typedWords, wpmTarget);
    expect(result['and'].prevScore).toBeUndefined();
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
