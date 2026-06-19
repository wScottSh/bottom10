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

// Spreads each word's repeats as evenly as possible across the whole test,
// randomized, with no two identical words adjacent. Replaces the old
// shuffle-then-greedy-resort, which clustered the two most-frequent words into a
// "for of for of" back-and-forth.
//
// Stratified placement: a word that occurs c times is dropped into c equal bands
// spanning [0, 1) — its j-th copy lands at (j + random()) / c, one copy per band,
// jittered within the band. Sorting every copy by this key interleaves all words
// evenly while keeping the order random. A final local-swap pass (dedupeAdjacent)
// repairs the rare residual adjacency without disturbing the even spacing.
// Words that occur once collapse to key = random(), so an all-distinct list is
// simply given a uniform shuffle.
export const spreadEvenly = (words: string[]): string[] => {
  if (words.length <= 1) return [...words];

  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);

  const keyed: Array<{ word: string; key: number }> = [];
  for (const [word, count] of freq) {
    for (let j = 0; j < count; j++) {
      keyed.push({ word, key: (j + Math.random()) / count });
    }
  }
  keyed.sort((a, b) => a.key - b.key);

  return dedupeAdjacent(keyed.map(k => k.word));
};

// Removes adjacent duplicates in-place while disturbing the incoming order as
// little as possible. At each output slot it normally takes the earliest
// not-yet-placed word that differs from the one just placed — so a list that is
// already evenly spread stays that way. The exception keeps it *complete*: the
// moment some word's remaining count reaches ceil(slotsLeft / 2) it can only fit
// if placed on every remaining other slot, so that word is force-placed ahead of
// order. This yields a dupe-free ordering whenever one exists (no word claims
// more than ceil(n/2) slots) and gives up gracefully — emitting leftover
// repeats — only when the input is genuinely unsatisfiable.
export const dedupeAdjacent = (array: string[]): string[] => {
  const n = array.length;
  if (n <= 1) return array;

  const remaining = new Map<string, number>();
  for (const w of array) remaining.set(w, (remaining.get(w) ?? 0) + 1);
  const pool = [...array];

  const result: string[] = [];
  let prev = '';
  while (pool.length > 0) {
    let critical = '';
    let criticalCount = 0;
    for (const [word, count] of remaining) {
      if (word !== prev && count > criticalCount) {
        critical = word;
        criticalCount = count;
      }
    }

    let idx: number;
    if (critical && criticalCount >= Math.ceil(pool.length / 2)) {
      idx = pool.indexOf(critical);
    } else {
      idx = pool.findIndex(w => w !== prev);
      if (idx === -1) idx = 0; // only copies of prev remain — unsatisfiable, give up
    }

    prev = pool[idx];
    result.push(prev);
    remaining.set(prev, remaining.get(prev)! - 1);
    pool.splice(idx, 1);
  }

  for (let i = 0; i < n; i++) array[i] = result[i];
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
    wordsForTest = initialSet.length === 0
      ? []
      : Array.from({ length: count }, (_, i) => initialSet[i % initialSet.length]);
  } else {
    wordsForTest = expandDistribution(buildWordDistribution(selectedWords, wordStats, count));
  }

  if (wordsForTest.length === 0) {
    // last-resort padding: a random count-sized subset of any non-graduated words.
    return spreadEvenly(filterNonGraduated(allWords, wordStats)).slice(0, count);
  }

  return spreadEvenly(wordsForTest);
};
