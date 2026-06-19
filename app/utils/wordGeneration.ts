import { WordStats, compareByScore } from './wordUtils';
import { isGraduated } from './graduation';

// Number of distinct words in a test's working set: the worst non-graduated
// words are repeated across the test rather than drawing many unique words.
export const WORKING_SET_SIZE = 10;

export const getTopWordsForTest = (wordStats: Record<string, WordStats>): string[] => {
  const candidates = Object.entries(wordStats)
    .filter(([, stats]) => !isGraduated(stats))
    .map(([word, stats]) => ({ word, score: stats.lastScore || 0 }));

  const sortedCandidates = [...candidates].sort((a, b) => {
    if (!a.score || !b.score) return compareByScore(a.score, b.score);
    return b.score - a.score;
  });

  return sortedCandidates.slice(0, WORKING_SET_SIZE).map(entry => entry.word);
};

export const shuffleArray = (array: string[]): string[] =>
  [...array].sort(() => Math.random() - 0.5);

// Rearranges arr in-place so no two adjacent elements are equal.
// Uses a greedy frequency-first strategy; gives up gracefully when one word
// dominates more than half the slots.
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
// t = (score − bestScore) / (worstScore − bestScore).
// Total is exactly N via the largest-remainder method.
export const buildConvexDistribution = (
  n: number,
  entries: Array<{ word: string; score: number }>
): Record<string, number> => {
  const k = entries.length;
  if (k === 0) return {};
  if (k === 1) return { [entries[0].word]: n };

  const FLOOR = 2;
  const floor = Math.min(FLOOR, Math.floor(n / k));
  const remaining = n - k * floor;

  const worstScore = entries[0].score;
  const bestScore = entries[k - 1].score;
  const range = worstScore - bestScore;

  const alloc: number[] = new Array(k).fill(floor);

  if (remaining > 0 && range > 0) {
    const shapes = entries.map(e => {
      const t = Math.max(0, Math.min(1, (e.score - bestScore) / range));
      return t * t;
    });
    const shapeSum = shapes.reduce((a, b) => a + b, 0);

    if (shapeSum > 0) {
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
    alloc[0] += remaining;
  }

  const total = alloc.reduce((a, b) => a + b, 0);
  alloc[0] += n - total;

  const result: Record<string, number> = {};
  for (let i = 0; i < k; i++) result[entries[i].word] = alloc[i];
  return result;
};

const UNSCORED_WORD_REPS = 2;

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

const expandDistribution = (dist: Record<string, number>): string[] => {
  const repeatedWords: string[] = [];
  Object.entries(dist).forEach(([word, freq]) => {
    for (let i = 0; i < freq; i++) repeatedWords.push(word);
  });
  return repeatedWords;
};

const filterNonGraduated = (allWords: string[], wordStats: Record<string, WordStats>): string[] =>
  allWords.filter(word => {
    const stats = wordStats[word];
    return !stats || !isGraduated(stats);
  });

const filterUnscored = (allWords: string[], wordStats: Record<string, WordStats>): string[] =>
  allWords.filter(word => !wordStats[word]?.lastScore);

// Builds the shuffled, count-sized word set for the next test. Pure: callers pass
// freshly-computed stats so the next set deterministically reflects the just-finished
// session (no stale closure / timing race).
export const generateWordSet = (
  count: number,
  wordStats: Record<string, WordStats>,
  allWords: string[]
): string[] => {
  const selectedWords = getTopWordsForTest(wordStats);
  const hasScoredWord = selectedWords.some(word => (wordStats[word]?.lastScore ?? 0) > 0);

  let wordsForTest: string[];
  if (selectedWords.length === 0 || !hasScoredWord) {
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
    wordsForTest = shuffleArray(filterNonGraduated(allWords, wordStats)).slice(0, count);
  }

  return dedupeAdjacent(wordsForTest);
};
