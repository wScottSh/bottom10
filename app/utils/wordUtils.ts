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
  const graduationThreshold = calculateGraduationThreshold(wpm);
  console.log('Graduation threshold:', graduationThreshold); // Debug logging
  
  // First get all words that are either unscored or above graduation threshold
  const eligibleWords = Object.entries(wordStats)
    .filter(([word, stats]) => {
      const isUnscored = !stats.lastScore;
      const isAboveThreshold = stats.lastScore >= graduationThreshold;
      
      // Debug logging
      if (stats.lastScore) {
        console.log(`${word}: score=${stats.lastScore}, graduated=${!isAboveThreshold}`);
      }
      
      return isUnscored || isAboveThreshold;
    })
    .map(([word, stats]) => ({
      word,
      score: stats.lastScore || 0
    }));

  // Sort with scored words first, worst performers at the top
  const sortedWords = eligibleWords.sort((a, b) => {
    if (!a.score && b.score) return 1;  // Unscored goes after scored
    if (a.score && !b.score) return -1;
    return b.score - a.score;  // Higher scores (worse) first
  });

  return sortedWords.slice(0, 10).map(entry => entry.word);
};