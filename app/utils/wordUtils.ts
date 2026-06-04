export interface WordStats {
  word: string;
  time: number;
  attempts: number;
  lastScore: number;
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

export const calculateGraduationThreshold = (wpm: number): number => {
  const totalTimeInMilliseconds = 60000;
  const avgCharsPerWord = 5;
  return totalTimeInMilliseconds / (wpm * avgCharsPerWord);
};

export const isGraduated = (score: number, wpm: number): boolean => {
  return score > 0 && score < calculateGraduationThreshold(wpm);
};

export const getTopWordsForTest = (wordStats: Record<string, WordStats>, wpm: number) => {
  // Select non-graduated words, then sort worst (highest score) first; unscored (score 0) come after scored words
  const candidates = Object.entries(wordStats)
    .filter(([, stats]) => !isGraduated(stats.lastScore, wpm))
    .map(([word, stats]) => ({
      word,
      score: stats.lastScore || 0
    }));

  const sortedCandidates = [...candidates].sort((a, b) => {
    if (a.score === 0 && b.score !== 0) return 1;  // Unscored goes after scored
    if (a.score !== 0 && b.score === 0) return -1;
    return b.score - a.score;  // Higher scores (worse) first
  });

  return sortedCandidates.slice(0, 10).map(entry => entry.word);
};

// Returns the working set: worst non-graduated words up to maxSize, with remaining
// slots filled from untouched words (never scored) in English-frequency order.
// A scored, non-graduated word stays sticky until it graduates — it never returns
// to the untouched pool.
export const selectWorkingSet = (
  wordStats: Record<string, WordStats>,
  wpmTarget: number,
  allWords: string[],
  maxSize: number = 10
): string[] => {
  // Active: scored (lastScore > 0) and not yet graduated
  const active = Object.entries(wordStats)
    .filter(([, stats]) => stats.lastScore > 0 && !isGraduated(stats.lastScore, wpmTarget))
    .sort((a, b) => b[1].lastScore - a[1].lastScore) // worst first
    .map(([word]) => word)
    .slice(0, maxSize);

  if (active.length >= maxSize) return active;

  // Fill remaining slots from untouched words (never scored) in frequency order
  const scoredWords = new Set(
    Object.entries(wordStats)
      .filter(([, stats]) => stats.lastScore > 0)
      .map(([word]) => word)
  );
  const slotsLeft = maxSize - active.length;
  const untouched = allWords.filter(w => !scoredWords.has(w)).slice(0, slotsLeft);

  return [...active, ...untouched];
};

export const shuffleArray = (array: string[]): string[] => {
  return [...array].sort(() => Math.random() - 0.5);
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

export const selectWordsForTest = (
  wordStats: Record<string, WordStats>,
  wpmTarget: number,
  count: number,
  allWords: string[]
): string[] => {
  // getTopWordsForTest already excludes graduated words, so pass wordStats directly.
  const selectedWords = getTopWordsForTest(wordStats, wpmTarget);

  if (selectedWords.length === 0) {
    // No scored, non-graduated words yet — fall back to the unscored words.
    return allWords.filter(word => !wordStats[word]?.lastScore);
  }

  const frequencies = generateFrequencyDistribution(count, selectedWords);
  const repeatedWords: string[] = [];
  Object.entries(frequencies).forEach(([word, freq]) => {
    for (let i = 0; i < freq; i++) {
      repeatedWords.push(word);
    }
  });

  if (repeatedWords.length === 0) {
    return allWords.filter(word => !isGraduated(wordStats[word]?.lastScore ?? 0, wpmTarget));
  }

  return repeatedWords;
};

// Builds the shuffled, count-sized word set for the next test. Pure: callers pass
// freshly-computed stats so the next set deterministically reflects the just-finished
// session (no stale closure / timing race).
export const generateWordSet = (
  count: number,
  wpmTarget: number,
  wordStats: Record<string, WordStats>,
  allWords: string[]
): string[] => {
  // getTopWordsForTest already filters out graduated words, so pass the full stats.
  const selectedWords = getTopWordsForTest(wordStats, wpmTarget);

  let wordsForTest: string[];
  if (selectedWords.length === 0) {
    // No scored-but-not-graduated words yet: fall back to untyped words.
    const unscoredWords = allWords.filter(word => {
      const stats = wordStats[word];
      return !stats || !stats.lastScore;
    });
    wordsForTest = shuffleArray(unscoredWords).slice(0, count);
  } else {
    const frequencies = generateFrequencyDistribution(count, selectedWords);
    const repeatedWords: string[] = [];
    Object.entries(frequencies).forEach(([word, freq]) => {
      for (let i = 0; i < freq; i++) {
        repeatedWords.push(word);
      }
    });
    wordsForTest = shuffleArray(repeatedWords);
  }

  if (wordsForTest.length === 0) {
    // Last resort: any word that hasn't graduated.
    const nonGraduatedWords = allWords.filter(word => {
      const stats = wordStats[word];
      return !stats || !isGraduated(stats.lastScore, wpmTarget);
    });
    wordsForTest = shuffleArray(nonGraduatedWords).slice(0, count);
  }

  return wordsForTest;
};
