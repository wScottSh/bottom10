import { describe, it, expect } from 'vitest';
import { selectActiveWordRows, selectGraduatedWordRows, buildLifecycleView } from './wordSelection';
import { WordStats } from './wordUtils';
import { getTopWordsForTest, WORKING_SET_SIZE } from './wordGeneration';

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

describe('selectGraduatedWordRows', () => {
  it('returns empty array for empty stats', () => {
    expect(selectGraduatedWordRows({})).toEqual([]);
  });

  it('returns only graduated words', () => {
    const wordStats = {
      active: makeStats({ lastScore: 200, consecutiveSubThreshold: 0 }),
      graduated: makeStats({ lastScore: 100, consecutiveSubThreshold: 2 }),
    };
    const rows = selectGraduatedWordRows(wordStats);
    expect(rows.map(r => r.word)).toEqual(['graduated']);
  });

  it('sorts graduated words ascending by lastScore (best/lowest Score first)', () => {
    const wordStats = {
      slow: makeStats({ lastScore: 300, consecutiveSubThreshold: 2 }),
      fast: makeStats({ lastScore: 120, consecutiveSubThreshold: 2 }),
      medium: makeStats({ lastScore: 200, consecutiveSubThreshold: 2 }),
    };
    const rows = selectGraduatedWordRows(wordStats);
    expect(rows.map(r => r.word)).toEqual(['fast', 'medium', 'slow']);
  });

  it('sets wpm from lastScore for each graduated word', () => {
    const wordStats = {
      word: makeStats({ lastScore: 200, consecutiveSubThreshold: 2 }), // 60 wpm
    };
    const rows = selectGraduatedWordRows(wordStats);
    expect(rows[0].wpm).toBe(60);
  });

  it('excludes non-graduated words', () => {
    const wordStats = {
      candidate: makeStats({ lastScore: 100, consecutiveSubThreshold: 1 }),
      active: makeStats({ lastScore: 150, consecutiveSubThreshold: 0 }),
    };
    expect(selectGraduatedWordRows(wordStats)).toEqual([]);
  });
});

describe('buildLifecycleView', () => {
  const allWords = ['the', 'of', 'and', 'a', 'to', 'in', 'is', 'you', 'that', 'it', 'he', 'was', 'for', 'on'];

  it('pads working set from allWords when stats are empty, all remaining go to untouched', () => {
    const view = buildLifecycleView({}, allWords);
    // No scored words — working set is padded entirely from allWords
    expect(view.workingSet).toHaveLength(Math.min(WORKING_SET_SIZE, allWords.length));
    // Remaining allWords (beyond first WORKING_SET_SIZE) are untouched
    expect(view.untouched.count).toBe(Math.max(0, allWords.length - WORKING_SET_SIZE));
    expect(view.graduated).toEqual([]);
  });

  it('workingSet is worst-first (highest score at top), padded from allWords', () => {
    const wordStats: Record<string, WordStats> = {
      the: makeStats({ lastScore: 120 }),   // 100 wpm - best
      of:  makeStats({ lastScore: 300 }),   // 40 wpm  - worst
      and: makeStats({ lastScore: 200 }),   // 60 wpm  - medium
    };
    const { workingSet } = buildLifecycleView(wordStats, allWords);
    // First 3 slots: scored words worst-first
    expect(workingSet.slice(0, 3).map(r => r.word)).toEqual(['of', 'and', 'the']);
    // Remaining slots: untouched padding from allWords
    const usedWords = new Set(['the', 'of', 'and']);
    workingSet.slice(3).forEach(r => expect(usedWords.has(r.word)).toBe(false));
  });

  it('workingSet begins with getTopWordsForTest words in the same order', () => {
    const wordStats: Record<string, WordStats> = {
      the: makeStats({ lastScore: 120 }),
      of:  makeStats({ lastScore: 300 }),
      and: makeStats({ lastScore: 200 }),
      a:   makeStats({ lastScore: 250 }),
    };
    const top = getTopWordsForTest(wordStats);
    const { workingSet } = buildLifecycleView(wordStats, allWords);
    expect(workingSet.slice(0, top.length).map(r => r.word)).toEqual(top);
  });

  it('pads with untouched words when fewer than WORKING_SET_SIZE have stats', () => {
    // Only 3 words in stats; rest of allWords are untouched
    const wordStats: Record<string, WordStats> = {
      the: makeStats({ lastScore: 120 }),
      of:  makeStats({ lastScore: 300 }),
      and: makeStats({ lastScore: 200 }),
    };
    const { workingSet, untouched } = buildLifecycleView(wordStats, allWords);
    // Working set must be padded to min(WORKING_SET_SIZE, allWords-length)
    const expectedSize = Math.min(WORKING_SET_SIZE, allWords.length);
    expect(workingSet).toHaveLength(expectedSize);
    // First 3 are the scored words worst-first
    expect(workingSet.slice(0, 3).map(r => r.word)).toEqual(['of', 'and', 'the']);
    // Padded slots have wpm: null
    workingSet.slice(3).forEach(r => expect(r.wpm).toBeNull());
    // Untouched count excludes words in working set
    expect(untouched.count).toBe(allWords.length - expectedSize);
  });

  it('sets wpm from lastScore for scored words, null for unscored', () => {
    const wordStats: Record<string, WordStats> = {
      the: makeStats({ lastScore: 200 }), // 60 wpm
      of:  makeStats({ lastScore: 0 }),   // unscored
    };
    const { workingSet } = buildLifecycleView(wordStats, allWords);
    const theRow = workingSet.find(r => r.word === 'the');
    const ofRow  = workingSet.find(r => r.word === 'of');
    expect(theRow?.wpm).toBe(60);
    expect(ofRow?.wpm).toBeNull();
  });

  it('sets streak from consecutiveSubThreshold', () => {
    const wordStats: Record<string, WordStats> = {
      the: makeStats({ lastScore: 120, consecutiveSubThreshold: 1 }),
      of:  makeStats({ lastScore: 200, consecutiveSubThreshold: 0 }),
    };
    const { workingSet } = buildLifecycleView(wordStats, allWords);
    expect(workingSet.find(r => r.word === 'the')?.streak).toBe(1);
    expect(workingSet.find(r => r.word === 'of')?.streak).toBe(0);
  });

  it('marks graduation candidates (consecutiveSubThreshold === 1) with isCandidate: true', () => {
    const wordStats: Record<string, WordStats> = {
      candidate: makeStats({ lastScore: 100, consecutiveSubThreshold: 1 }),
      ordinary:  makeStats({ lastScore: 200, consecutiveSubThreshold: 0 }),
    };
    const allWithThese = ['candidate', 'ordinary', ...allWords];
    const { workingSet } = buildLifecycleView(wordStats, allWithThese);
    expect(workingSet.find(r => r.word === 'candidate')?.isCandidate).toBe(true);
    expect(workingSet.find(r => r.word === 'ordinary')?.isCandidate).toBe(false);
  });

  it('excludes graduated words from workingSet', () => {
    const wordStats: Record<string, WordStats> = {
      graduated: makeStats({ lastScore: 100, consecutiveSubThreshold: 2 }),
      active:    makeStats({ lastScore: 200, consecutiveSubThreshold: 0 }),
    };
    const { workingSet, graduated } = buildLifecycleView(wordStats, allWords);
    expect(workingSet.map(r => r.word)).not.toContain('graduated');
    expect(graduated.map(r => r.word)).toContain('graduated');
    expect(workingSet.map(r => r.word)).toContain('active');
  });

  it('untouched.next gives the first few untouched words not in working set', () => {
    // All allWords untouched, first WORKING_SET_SIZE go into workingSet (padding)
    const { untouched } = buildLifecycleView({}, allWords);
    // Working set takes first WORKING_SET_SIZE words (allWords order)
    const afterSet = allWords.slice(WORKING_SET_SIZE);
    expect(untouched.next).toEqual(afterSet.slice(0, 3));
  });

  it('untouched.count does not include working-set words or graduated words', () => {
    const wordStats: Record<string, WordStats> = {
      the: makeStats({ lastScore: 200 }),
      of:  makeStats({ lastScore: 100, consecutiveSubThreshold: 2 }), // graduated
    };
    const { untouched } = buildLifecycleView(wordStats, allWords);
    // 'the' is in working set, 'of' is graduated — rest of allWords are untouched
    const expectedUntouched = allWords.filter(w => w !== 'the' && w !== 'of');
    // Minus any that got padded into working set
    const view = buildLifecycleView(wordStats, allWords);
    const inWorkingSet = new Set(view.workingSet.map(r => r.word));
    const trueUntouched = allWords.filter(w => !wordStats[w] && !inWorkingSet.has(w));
    expect(untouched.count).toBe(trueUntouched.length);
  });
});
