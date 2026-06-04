export interface WordStats {
  word: string;
  time: number;
  attempts: number;
  lastScore: number;
  consecutiveSubThreshold?: number;
}

export const calculateNormalizedScore = (avgTime: number, wordLength: number): number => {
  return avgTime / wordLength;
};

// Returns the time spent typing a word: completion minus the first-keystroke
// timestamp. Measuring from the first character (rather than from when the
// previous word was submitted) excludes the inter-word "switch cost" pause.
// Returns 0 when the word has no recorded first keystroke.
export const computeWordElapsedTime = (
  firstKeystrokeTimestamp: number | null,
  completionTimestamp: number
): number => {
  if (firstKeystrokeTimestamp === null) return 0;
  return completionTimestamp - firstKeystrokeTimestamp;
};

export interface KeystrokeEvent {
  key: string;
  timestamp: number;
}

// Pure helper: given a scripted sequence of timestamped keystroke events for a word,
// returns the word's elapsed typing time from the first character to the completing
// space. The inter-word switch gap is excluded by construction — the clock starts on
// the first character, not when the previous word was submitted. Backspacing does not
// reset that start timestamp; fumbling is counted as genuine difficulty.
export const computeWordTimingFromEvents = (events: KeystrokeEvent[]): number => {
  let firstKeystrokeTimestamp: number | null = null;

  for (const { key, timestamp } of events) {
    if (key === 'Backspace') continue; // never resets the start timestamp
    if (key === ' ') {
      return computeWordElapsedTime(firstKeystrokeTimestamp, timestamp);
    }
    if (firstKeystrokeTimestamp === null) {
      firstKeystrokeTimestamp = timestamp; // first character — right or wrong — starts the clock
    }
  }

  return 0;
};

// Converts a stored lastScore (ms/char) to WPM for display. This is the inverse of
// calculateGraduationThreshold: both treat a word as a 5-char standard word.
export const scoreToWpm = (lastScore: number): number => {
  const totalTimeInMilliseconds = 60000;
  const avgCharsPerWord = 5;
  return Math.round(totalTimeInMilliseconds / avgCharsPerWord / lastScore);
};

export const calculateGraduationThreshold = (wpm: number): number => {
  const totalTimeInMilliseconds = 60000;
  const avgCharsPerWord = 5;
  return totalTimeInMilliseconds / (wpm * avgCharsPerWord);
};

// Consecutive sub-threshold tests a word must accumulate before it graduates.
const GRADUATION_STREAK = 2;

// A word is graduated once it has been confirmed sub-threshold on GRADUATION_STREAK
// consecutive tests. Graduation is a durable, stored property (consecutiveSubThreshold) —
// it does not depend on the current wpm target at read time; only updateGraduationCounter does.
export const isGraduated = (stats: WordStats): boolean => {
  return (stats.consecutiveSubThreshold ?? 0) >= GRADUATION_STREAK;
};

// Increments the consecutive-sub-threshold counter when the word's lastScore is under the
// graduation threshold, or resets it to 0 when the word is at/over threshold.
// Graduation fires once the counter reaches GRADUATION_STREAK (checked via isGraduated).
export const updateGraduationCounter = (stats: WordStats, wpm: number): WordStats => {
  const threshold = calculateGraduationThreshold(wpm);
  const subThreshold = stats.lastScore > 0 && stats.lastScore < threshold;
  return {
    ...stats,
    consecutiveSubThreshold: subThreshold ? (stats.consecutiveSubThreshold ?? 0) + 1 : 0,
  };
};

// Number of distinct words in a test's working set: the worst non-graduated
// words are repeated across the test rather than drawing many unique words.
export const WORKING_SET_SIZE = 10;

export const getTopWordsForTest = (wordStats: Record<string, WordStats>) => {
  // Select non-graduated words, then sort worst (highest score) first; unscored (score 0) come after scored words
  const candidates = Object.entries(wordStats)
    .filter(([, stats]) => !isGraduated(stats))
    .map(([word, stats]) => ({
      word,
      score: stats.lastScore || 0
    }));

  const sortedCandidates = [...candidates].sort((a, b) => {
    if (a.score === 0 && b.score !== 0) return 1;  // Unscored goes after scored
    if (a.score !== 0 && b.score === 0) return -1;
    return b.score - a.score;  // Higher scores (worse) first
  });

  return sortedCandidates.slice(0, WORKING_SET_SIZE).map(entry => entry.word);
};

// Returns the working set: worst non-graduated words up to maxSize, with remaining
// slots filled from untouched words (never scored) in English-frequency order.
// A scored, non-graduated word stays sticky until it graduates — it never returns
// to the untouched pool.
export const selectWorkingSet = (
  wordStats: Record<string, WordStats>,
  allWords: string[],
  maxSize: number = WORKING_SET_SIZE
): string[] => {
  const scored = Object.entries(wordStats).filter(([, stats]) => stats.lastScore > 0);

  // Active: scored words not yet graduated, worst (highest score) first
  const active = scored
    .filter(([, stats]) => !isGraduated(stats))
    .sort((a, b) => b[1].lastScore - a[1].lastScore)
    .map(([word]) => word)
    .slice(0, maxSize);

  if (active.length >= maxSize) return active;

  // Fill remaining slots from untouched words (never scored) in frequency order
  const scoredWords = new Set(scored.map(([word]) => word));
  const slotsLeft = maxSize - active.length;
  const untouched = allWords.filter(w => !scoredWords.has(w)).slice(0, slotsLeft);

  return [...active, ...untouched];
};

export const shuffleArray = (array: string[]): string[] => {
  return [...array].sort(() => Math.random() - 0.5);
};

// Builds a convex score-weighted distribution of N reps across scored words.
// entries must be sorted worst-first (highest score first); all scores must be > 0.
// Each word's share is proportional to shape(t) = t² where
// t = (score − bestScore) / (worstScore − bestScore), so worst→t=1, best→t=0.
// The best word (t=0) gets only the floor (2 reps). The worst word always gets the
// most reps, naturally satisfying monotonicity. Floor relaxes when N is too small.
// Total is exactly N via the largest-remainder method.
export const buildConvexDistribution = (
  n: number,
  entries: Array<{ word: string; score: number }>
): Record<string, number> => {
  const k = entries.length;
  if (k === 0) return {};
  if (k === 1) return { [entries[0].word]: n };

  // Floor per word; relax when N is too small to give everyone FLOOR reps
  const FLOOR = 2;
  const floor = Math.min(FLOOR, Math.floor(n / k));
  const remaining = n - k * floor;

  const worstScore = entries[0].score;
  const bestScore = entries[k - 1].score;
  const range = worstScore - bestScore;

  // Start everyone at floor; distribute remaining proportionally via shape(t)
  const alloc: number[] = new Array(k).fill(floor);

  if (remaining > 0 && range > 0) {
    const shapes = entries.map(e => {
      const t = Math.max(0, Math.min(1, (e.score - bestScore) / range));
      return t * t;
    });
    const shapeSum = shapes.reduce((a, b) => a + b, 0);

    if (shapeSum > 0) {
      // Largest-remainder method so the extras sum exactly to `remaining`
      const ideals = shapes.map(s => (s / shapeSum) * remaining);
      const floors = ideals.map(Math.floor);
      const deficit = remaining - floors.reduce((a, b) => a + b, 0);
      const fracs = ideals.map((ideal, i) => ({ i, frac: ideal - Math.floor(ideal) }));
      fracs.sort((a, b) => b.frac - a.frac);
      for (let j = 0; j < deficit; j++) floors[fracs[j].i]++;
      for (let i = 0; i < k; i++) alloc[i] += floors[i];
    } else {
      alloc[0] += remaining;
    }
  } else if (remaining > 0) {
    // All tied (range = 0): push remaining to worst
    alloc[0] += remaining;
  }

  // Floating-point safety: push any residual to worst (should always be 0)
  const total = alloc.reduce((a, b) => a + b, 0);
  alloc[0] += n - total;

  const result: Record<string, number> = {};
  for (let i = 0; i < k; i++) result[entries[i].word] = alloc[i];
  return result;
};

// Minimum reps each unscored word contributes to a generated test.
const UNSCORED_WORD_REPS = 2;

// Distributes `count` reps across the selected words: scored words get a convex
// score-weighted share (worst words most), unscored words get a flat floor each.
const buildWordDistribution = (
  selectedWords: string[],
  wordStats: Record<string, WordStats>,
  count: number
): Record<string, number> => {
  const isScored = (word: string) => (wordStats[word]?.lastScore ?? 0) > 0;
  const scoredWords = selectedWords.filter(isScored);
  const unscoredWords = selectedWords.filter(word => !isScored(word));

  const scoredBudget = count - unscoredWords.length * UNSCORED_WORD_REPS;
  const scoredEntries = scoredWords.map(word => ({ word, score: wordStats[word].lastScore }));

  const dist: Record<string, number> = scoredEntries.length > 0
    ? buildConvexDistribution(Math.max(scoredBudget, scoredEntries.length), scoredEntries)
    : {};
  for (const word of unscoredWords) dist[word] = UNSCORED_WORD_REPS;
  return dist;
};

// Expands a { word: repCount } map into a flat list with each word repeated.
const expandDistribution = (dist: Record<string, number>): string[] => {
  const repeatedWords: string[] = [];
  Object.entries(dist).forEach(([word, freq]) => {
    for (let i = 0; i < freq; i++) repeatedWords.push(word);
  });
  return repeatedWords;
};

export const generateFrequencyDistribution = (wordCount: number, bottomWords: string[]): Record<string, number> => {
  const worstWordCount = Math.max(Math.floor(wordCount * 0.25), 1);
  const remainingCount = wordCount - worstWordCount;

  const frequencies: Record<string, number> = {};
  let remainingSlots = remainingCount;

  bottomWords.forEach((word, index) => {
    if (index === 0) {
      frequencies[word] = worstWordCount;
    } else if (index === bottomWords.length - 1) {
      frequencies[word] = 2;
    } else {
      const portion = Math.floor((remainingSlots - 2) * (bottomWords.length - index) /
        (bottomWords.length * (bottomWords.length - 1) / 2));
      frequencies[word] = Math.max(portion, 2);
      remainingSlots -= portion;
    }
  });

  return frequencies;
};

// All words that have not graduated yet, including those never scored.
const filterNonGraduated = (
  allWords: string[],
  wordStats: Record<string, WordStats>
): string[] =>
  allWords.filter(word => {
    const stats = wordStats[word];
    return !stats || !isGraduated(stats);
  });

// All words that have never been scored (no stats, or a lastScore of 0).
const filterUnscored = (
  allWords: string[],
  wordStats: Record<string, WordStats>
): string[] =>
  allWords.filter(word => !wordStats[word]?.lastScore);

export const selectWordsForTest = (
  wordStats: Record<string, WordStats>,
  count: number,
  allWords: string[]
): string[] => {
  const selectedWords = getTopWordsForTest(wordStats);

  if (selectedWords.length === 0) {
    return filterUnscored(allWords, wordStats);
  }

  const hasScoredWord = selectedWords.some(word => (wordStats[word]?.lastScore ?? 0) > 0);
  if (!hasScoredWord) {
    return filterNonGraduated(allWords, wordStats);
  }

  const repeatedWords = expandDistribution(buildWordDistribution(selectedWords, wordStats, count));

  return repeatedWords.length === 0
    ? filterNonGraduated(allWords, wordStats)
    : repeatedWords;
};

// Builds the shuffled, count-sized word set for the next test. Pure: callers pass
// freshly-computed stats so the next set deterministically reflects the just-finished
// session (no stale closure / timing race).
export const generateWordSet = (
  count: number,
  wordStats: Record<string, WordStats>,
  allWords: string[]
): string[] => {
  // getTopWordsForTest already filters out graduated words, so pass the full stats.
  const selectedWords = getTopWordsForTest(wordStats);

  const hasScoredWord = selectedWords.some(word => (wordStats[word]?.lastScore ?? 0) > 0);

  let wordsForTest: string[];
  if (selectedWords.length === 0 || !hasScoredWord) {
    // No scored words yet (first session or all-unscored working set): take the
    // top frequency-ordered words and repeat them to fill count slots. This mirrors
    // the scored path (a working set repeated across count) rather than pulling
    // count unique words on the very first test. Leave empty when there are no
    // unscored words so the last-resort fallback below takes over.
    const unscoredWords = filterUnscored(allWords, wordStats);
    const initialSet = unscoredWords.slice(0, WORKING_SET_SIZE);
    const repeatedInitial = initialSet.length === 0
      ? []
      : Array.from({ length: count }, (_, i) => initialSet[i % initialSet.length]);
    wordsForTest = shuffleArray(repeatedInitial);
  } else {
    const repeatedWords = expandDistribution(buildWordDistribution(selectedWords, wordStats, count));
    wordsForTest = shuffleArray(repeatedWords);
  }

  if (wordsForTest.length === 0) {
    // Last resort: any word that hasn't graduated.
    wordsForTest = shuffleArray(filterNonGraduated(allWords, wordStats)).slice(0, count);
  }

  return wordsForTest;
};
