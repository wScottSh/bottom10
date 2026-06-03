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
  const graduationThreshold = calculateGraduationThreshold(wpmTarget);

  const nonGraduatedWordStats = Object.entries(wordStats)
    .filter(([, stats]) => !(stats.lastScore > 0 && stats.lastScore < graduationThreshold))
    .reduce((acc, [word, stats]) => ({ ...acc, [word]: stats }), {} as Record<string, WordStats>);

  const selectedWords = getTopWordsForTest(nonGraduatedWordStats, wpmTarget);

  if (selectedWords.length === 0) {
    return allWords.filter(word => {
      const stats = wordStats[word];
      const isUnscored = !stats?.lastScore;
      const isGrad = stats?.lastScore > 0 && stats?.lastScore < graduationThreshold;
      return isUnscored && !isGrad;
    });
  }

  const frequencies = generateFrequencyDistribution(count, selectedWords);
  const repeatedWords: string[] = [];
  Object.entries(frequencies).forEach(([word, freq]) => {
    for (let i = 0; i < freq; i++) {
      repeatedWords.push(word);
    }
  });

  if (repeatedWords.length === 0) {
    return allWords.filter(word => {
      const stats = wordStats[word];
      return !(stats?.lastScore > 0 && stats?.lastScore < graduationThreshold);
    });
  }

  return repeatedWords;
};
