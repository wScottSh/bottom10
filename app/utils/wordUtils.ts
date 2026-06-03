export interface WordStats {
  word: string;
  time: number;
  attempts: number;
  lastScore: number;
}

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
    .filter(([word, stats]) => !isGraduated(stats.lastScore, wpm))
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
      const portion = Math.floor(
        ((remainingSlots - 2) * (bottomWords.length - index)) /
        ((bottomWords.length * (bottomWords.length - 1)) / 2)
      );
      frequencies[word] = Math.max(portion, 2);
      remainingSlots -= portion;
    }
  });

  return frequencies;
};

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
