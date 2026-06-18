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

// One word as completed during a test: the word, its elapsed typing time, and
// whether it was typed with an error. Accumulated across a session, then folded
// into the durable stats by applySessionToStats.
export interface TypedWord {
  word: string;
  time: number;
  errors: number;
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

// Pure decision function for WPM particles: computes the per-word WPM for a single
// completion and determines whether it met the WPM target (green) or fell short (red).
// Uses the same scoring pipeline as the stored stats so the particle and sidebar can
// never disagree. Equal-to-target counts as fast (the same bar that drives graduation).
export const computeWpmParticle = (
  elapsed: number,
  wordLength: number,
  wpmTarget: number
): { wpm: number; isFast: boolean } => {
  const wpm = scoreToWpm(calculateNormalizedScore(elapsed, wordLength));
  return { wpm, isFast: wpm >= wpmTarget };
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

// A word is a graduation candidate when it has one sub-threshold result and needs
// one more to graduate (consecutiveSubThreshold === GRADUATION_STREAK - 1).
export const isGraduationCandidate = (stats: WordStats): boolean => {
  return (stats.consecutiveSubThreshold ?? 0) === GRADUATION_STREAK - 1;
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

// Applies a finished session's typed words to the durable stats map.
// Groups repeated words and averages their times; bumps attempts once per word group;
// runs the graduation counter. Does not mutate the input stats object.
export const applySessionToStats = (
  stats: Record<string, WordStats>,
  typedWords: TypedWord[],
  wpmTarget: number
): Record<string, WordStats> => {
  const updatedStats = { ...stats };

  const wordGroups = typedWords.reduce((acc, { word, time }) => {
    if (!acc[word]) acc[word] = { totalTime: 0, count: 0 };
    acc[word].totalTime += time;
    acc[word].count += 1;
    return acc;
  }, {} as Record<string, { totalTime: number; count: number }>);

  Object.entries(wordGroups).forEach(([word, { totalTime, count }]) => {
    const avgTime = totalTime / count;
    const sessionScore = calculateNormalizedScore(avgTime, word.length);
    const prevAttempts = updatedStats[word]?.attempts || 0;
    const prevLastScore = updatedStats[word]?.lastScore || 0;
    // Running mean of per-session scores. With prevAttempts === 0 this reduces to
    // sessionScore, so the first session needs no special case.
    const cumulativeScore = (prevLastScore * prevAttempts + sessionScore) / (prevAttempts + 1);
    const withNewScore: WordStats = {
      ...updatedStats[word],
      time: avgTime,
      attempts: prevAttempts + 1,
      lastScore: cumulativeScore,
    };
    updatedStats[word] = updateGraduationCounter(withNewScore, wpmTarget);
  });

  return updatedStats;
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

export const shuffleArray = (array: string[]): string[] => {
  return [...array].sort(() => Math.random() - 0.5);
};

// Rearranges arr in-place so no two adjacent elements are equal.
// Uses a greedy frequency-first strategy: always place the remaining word
// with the highest count that differs from the previous word. Gives up
// gracefully when one word dominates more than half the slots — a single
// run of identical words may survive in that edge case.
export const dedupeAdjacent = (array: string[]): string[] => {
  if (array.length <= 1) return array;

  const freq = new Map<string, number>();
  for (const w of array) freq.set(w, (freq.get(w) ?? 0) + 1);

  const result: string[] = [];
  let prev = '';

  while (result.length < array.length) {
    let bestWord = '';
    let bestCount = 0;
    for (const [word, count] of freq) {
      if (word !== prev && count > bestCount) {
        bestWord = word;
        bestCount = count;
      }
    }
    if (!bestWord) {
      // Only the previous word is left — take it, accepting one adjacent dupe.
      bestWord = freq.keys().next().value as string;
    }
    result.push(bestWord);
    prev = bestWord;
    const remaining = freq.get(bestWord)! - 1;
    if (remaining === 0) freq.delete(bestWord);
    else freq.set(bestWord, remaining);
  }

  for (let i = 0; i < result.length; i++) array[i] = result[i];
  return array;
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

  return dedupeAdjacent(wordsForTest);
};
