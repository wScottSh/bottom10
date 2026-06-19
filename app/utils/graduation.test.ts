import { describe, it, expect } from 'vitest';
import { isGraduated, isGraduationCandidate, updateGraduationCounter } from './graduation';
import type { WordStats } from './wordUtils';

const mkStats = (lastScore: number, consecutiveSubThreshold = 0): WordStats => ({
  word: 'hi',
  time: lastScore,
  attempts: 1,
  lastScore,
  consecutiveSubThreshold,
});

describe('isGraduated', () => {
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

  it('increments counter when lastScore is under threshold', () => {
    const stats = mkStats(150, 0); // 150 < 200 — sub-threshold
    const updated = updateGraduationCounter(stats, wpm);
    expect(updated.consecutiveSubThreshold).toBe(1);
  });

  it('graduates a word after two consecutive sub-threshold results', () => {
    const stats = mkStats(150, 1); // already one sub-threshold — one more graduates
    const updated = updateGraduationCounter(stats, wpm);
    expect(isGraduated(updated)).toBe(true);
  });

  it('preserves other stats fields unchanged', () => {
    const stats = mkStats(150, 0);
    const updated = updateGraduationCounter(stats, wpm);
    expect(updated.lastScore).toBe(stats.lastScore);
    expect(updated.attempts).toBe(stats.attempts);
    expect(updated.word).toBe(stats.word);
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
