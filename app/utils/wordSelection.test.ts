import { describe, it, expect } from 'vitest';
import { selectActiveWordRows } from './wordSelection';
import { WordStats } from './wordUtils';

const makeStats = (overrides: Partial<WordStats> = {}): WordStats => ({
  word: '',
  time: 0,
  attempts: 0,
  lastScore: 0,
  consecutiveSubThreshold: 0,
  ...overrides,
});

describe('selectActiveWordRows', () => {
  it('returns empty array for empty stats', () => {
    expect(selectActiveWordRows({})).toEqual([]);
  });

  it('returns scored words sorted ascending by lastScore (fastest first)', () => {
    const wordStats = {
      slow: makeStats({ lastScore: 300 }),   // 40 wpm
      fast: makeStats({ lastScore: 120 }),   // 100 wpm
      medium: makeStats({ lastScore: 200 }), // 60 wpm
    };
    const rows = selectActiveWordRows(wordStats);
    expect(rows.map(r => r.word)).toEqual(['fast', 'medium', 'slow']);
  });

  it('places unscored words after scored words', () => {
    const wordStats = {
      unscored: makeStats({ lastScore: 0 }),
      scored: makeStats({ lastScore: 200 }),
    };
    const rows = selectActiveWordRows(wordStats);
    expect(rows.map(r => r.word)).toEqual(['scored', 'unscored']);
  });

  it('places multiple unscored words after all scored words', () => {
    const wordStats = {
      a: makeStats({ lastScore: 0 }),
      b: makeStats({ lastScore: 300 }),
      c: makeStats({ lastScore: 0 }),
      d: makeStats({ lastScore: 120 }),
    };
    const rows = selectActiveWordRows(wordStats);
    expect(rows.slice(0, 2).map(r => r.word)).toEqual(['d', 'b']);
    expect(rows.slice(2).map(r => r.word).sort()).toEqual(['a', 'c']);
  });

  it('sets wpm to the rounded wpm for scored words', () => {
    const wordStats = { fast: makeStats({ lastScore: 200 }) }; // 60 wpm
    const rows = selectActiveWordRows(wordStats);
    expect(rows[0].wpm).toBe(60);
  });

  it('sets wpm to null for unscored words', () => {
    const wordStats = { new: makeStats({ lastScore: 0 }) };
    const rows = selectActiveWordRows(wordStats);
    expect(rows[0].wpm).toBeNull();
  });

  it('marks graduation candidates with isCandidate: true', () => {
    // GRADUATION_STREAK = 2, so consecutiveSubThreshold === 1 is a candidate
    const wordStats = {
      candidate: makeStats({ lastScore: 100, consecutiveSubThreshold: 1 }),
      ordinary: makeStats({ lastScore: 200, consecutiveSubThreshold: 0 }),
    };
    const rows = selectActiveWordRows(wordStats);
    const candidateRow = rows.find(r => r.word === 'candidate');
    const ordinaryRow = rows.find(r => r.word === 'ordinary');
    expect(candidateRow?.isCandidate).toBe(true);
    expect(ordinaryRow?.isCandidate).toBe(false);
  });

  it('excludes graduated words (consecutiveSubThreshold >= 2)', () => {
    const wordStats = {
      graduated: makeStats({ lastScore: 100, consecutiveSubThreshold: 2 }),
      active: makeStats({ lastScore: 200, consecutiveSubThreshold: 0 }),
    };
    const rows = selectActiveWordRows(wordStats);
    expect(rows.map(r => r.word)).toEqual(['active']);
  });
});
