import { describe, it, expect } from 'vitest';
import { isGraduated, isGraduationCandidate, updateGraduationCounter, detectGraduations } from './graduation';
import type { WordStats } from './wordUtils';

const mkStats = (lastScore: number, consecutiveSubThreshold = 0): WordStats => ({
  word: 'hi',
  time: lastScore,
  attempts: 1,
  lastScore,
  consecutiveSubThreshold,
});

describe('isGraduated', () => {
  it('returns false when the counter is 0 (never sub-threshold)', () => {
    expect(isGraduated(mkStats(100, 0))).toBe(false);
  });

  it('returns false before reaching the streak threshold (counter=1)', () => {
    expect(isGraduated(mkStats(100, 1))).toBe(false);
  });

  it('returns true once the streak threshold is reached (counter=2)', () => {
    expect(isGraduated(mkStats(100, 2))).toBe(true);
  });

  it('returns true for any counter above the threshold', () => {
    expect(isGraduated(mkStats(100, 3))).toBe(true);
  });

  it('returns false when consecutiveSubThreshold is missing (legacy record)', () => {
    const stats = { word: 'hi', time: 100, attempts: 1, lastScore: 100 } as WordStats;
    expect(isGraduated(stats)).toBe(false);
  });
});

describe('isGraduationCandidate', () => {
  it('returns true when one more sub-threshold result would graduate the word (counter=1)', () => {
    expect(isGraduationCandidate(mkStats(100, 1))).toBe(true);
  });

  it('returns false when counter is 0 (not close to graduating)', () => {
    expect(isGraduationCandidate(mkStats(100, 0))).toBe(false);
  });

  it('returns false when already graduated (counter=2)', () => {
    expect(isGraduationCandidate(mkStats(100, 2))).toBe(false);
  });

  it('returns false when consecutiveSubThreshold is missing (legacy record)', () => {
    const stats = { word: 'hi', time: 100, attempts: 1, lastScore: 100 } as WordStats;
    expect(isGraduationCandidate(stats)).toBe(false);
  });
});

describe('updateGraduationCounter — graduate after streak', () => {
  const wpm = 60; // threshold = 200 ms/char

  it('increments the counter but does not graduate on a single sub-threshold result', () => {
    const stats = mkStats(150, 0); // 150 < 200 — sub-threshold
    const updated = updateGraduationCounter(stats, wpm);
    expect(updated.consecutiveSubThreshold).toBe(1);
    expect(isGraduated(updated)).toBe(false);
  });

  it('graduates a word after two consecutive sub-threshold results', () => {
    const stats = mkStats(150, 1); // already one sub-threshold — one more graduates
    const updated = updateGraduationCounter(stats, wpm);
    expect(updated.consecutiveSubThreshold).toBe(2);
    expect(isGraduated(updated)).toBe(true);
  });

  it('treats a missing counter as 0, then increments it (legacy record migration)', () => {
    const stats = { word: 'hi', time: 100, attempts: 1, lastScore: 150 } as WordStats;
    const updated = updateGraduationCounter(stats, wpm);
    expect(updated.consecutiveSubThreshold).toBe(1);
  });

  it('preserves other stats fields unchanged', () => {
    const stats = mkStats(150, 0);
    const updated = updateGraduationCounter(stats, wpm);
    expect(updated.lastScore).toBe(stats.lastScore);
    expect(updated.attempts).toBe(stats.attempts);
    expect(updated.word).toBe(stats.word);
    expect(updated.time).toBe(stats.time);
  });
});

describe('updateGraduationCounter — reset on regression', () => {
  const wpm = 60; // threshold = 200 ms/char

  it('resets counter to 0 when lastScore equals the threshold', () => {
    const stats = mkStats(200, 1); // exactly at threshold — not sub-threshold
    const updated = updateGraduationCounter(stats, wpm);
    expect(updated.consecutiveSubThreshold).toBe(0);
  });

  it('resets counter to 0 when lastScore exceeds the threshold (regression)', () => {
    const stats = mkStats(300, 1); // 300 > 200 — regression
    const updated = updateGraduationCounter(stats, wpm);
    expect(updated.consecutiveSubThreshold).toBe(0);
    expect(isGraduated(updated)).toBe(false);
  });

  it('does not count a zero lastScore as sub-threshold (unscored word)', () => {
    const stats = mkStats(0, 0);
    const updated = updateGraduationCounter(stats, wpm);
    expect(updated.consecutiveSubThreshold).toBe(0);
  });
});

describe('detectGraduations', () => {
  const mkGraduated = (lastScore: number): WordStats => mkStats(lastScore, 2); // consecutiveSubThreshold=2
  const mkCandidate = (lastScore: number): WordStats => mkStats(lastScore, 1);

  it('returns words whose graduated status flipped false→true', () => {
    const prev: Record<string, WordStats> = {
      go: mkCandidate(100), // not yet graduated
    };
    const next: Record<string, WordStats> = {
      go: mkGraduated(100), // now graduated
    };
    expect(detectGraduations(prev, next)).toEqual(['go']);
  });

  it('returns empty array when nothing graduated', () => {
    const prev: Record<string, WordStats> = {
      go: mkStats(100, 0),
    };
    const next: Record<string, WordStats> = {
      go: mkStats(100, 1),
    };
    expect(detectGraduations(prev, next)).toEqual([]);
  });

  it('reports all words that simultaneously graduated', () => {
    const prev: Record<string, WordStats> = {
      go: mkCandidate(100),
      up: mkCandidate(150),
    };
    const next: Record<string, WordStats> = {
      go: mkGraduated(100),
      up: mkGraduated(150),
    };
    const result = detectGraduations(prev, next);
    expect(result).toContain('go');
    expect(result).toContain('up');
    expect(result).toHaveLength(2);
  });

  it('does not re-report a word already graduated in the prior snapshot', () => {
    const prev: Record<string, WordStats> = {
      go: mkGraduated(100), // already graduated before
    };
    const next: Record<string, WordStats> = {
      go: mkGraduated(100), // still graduated
    };
    expect(detectGraduations(prev, next)).toEqual([]);
  });

  it('does not report a word that only reached candidate status', () => {
    const prev: Record<string, WordStats> = {
      go: mkStats(100, 0),
    };
    const next: Record<string, WordStats> = {
      go: mkCandidate(100), // one pip — not yet graduated
    };
    expect(detectGraduations(prev, next)).toEqual([]);
  });
});
