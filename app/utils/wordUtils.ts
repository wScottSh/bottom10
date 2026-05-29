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
