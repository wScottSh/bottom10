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
  return Object.entries(wordStats)
    .map(([word, stats]) => ({
      word,
      score: stats.lastScore || 0,  // Changed from Infinity to 0
      isGraduated: isGraduated(stats.lastScore, wpm)
    }))
    .filter(entry => !entry.isGraduated)
    .sort((a, b) => {
      // First prioritize scored vs unscored
      if (!a.score && b.score) return 1;  // Unscored goes after scored
      if (a.score && !b.score) return -1;
      if (!a.score && !b.score) return 0;
      // Then sort by score (higher = worse performance)
      return b.score - a.score;
    })
    .slice(0, 10)
    .map(entry => entry.word);
};