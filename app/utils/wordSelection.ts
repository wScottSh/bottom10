import { WordStats, compareByScore } from './wordUtils';
import { getTopWordsForTest, WORKING_SET_SIZE } from './wordGeneration';
import { isGraduated, isGraduationCandidate } from './graduation';
import { wpmFromScore } from './score';

export interface ActiveWordRow {
  word: string;
  wpm: number | null;
  isCandidate: boolean;
}

export interface GraduatedWordRow {
  word: string;
  wpm: number;
}

export const selectActiveWordRows = (
  wordStats: Record<string, WordStats>
): ActiveWordRow[] => {
  return Object.entries(wordStats)
    .filter(([, stats]) => !isGraduated(stats))
    .sort(([, a], [, b]) => compareByScore(a.lastScore, b.lastScore))
    .map(([word, stats]) => ({
      word,
      wpm: stats.lastScore > 0 ? wpmFromScore(stats.lastScore) : null,
      isCandidate: isGraduationCandidate(stats),
    }));
};

export const selectGraduatedWordRows = (
  wordStats: Record<string, WordStats>
): GraduatedWordRow[] => {
  return Object.entries(wordStats)
    .filter(([, stats]) => isGraduated(stats))
    .sort(([, a], [, b]) => compareByScore(a.lastScore, b.lastScore))
    .map(([word, stats]) => ({
      word,
      wpm: wpmFromScore(stats.lastScore),
    }));
};

export type Movement = 'up' | 'down' | 'neutral';

export interface WorkingSetWord {
  word: string;
  wpm: number | null;
  streak: number;
  isCandidate: boolean;
  movement: Movement;
}

function computeMovement(lastScore: number, prevScore: number | undefined): Movement {
  if (!prevScore || !lastScore) return 'neutral';
  if (lastScore < prevScore) return 'up';
  if (lastScore > prevScore) return 'down';
  return 'neutral';
}

export interface LifecycleView {
  workingSet: WorkingSetWord[];
  untouched: { count: number; next: string[] };
  graduated: GraduatedWordRow[];
}

// Builds a snapshot of the word lifecycle for sidebar display.
// workingSet matches getTopWordsForTest's order (worst-first), padded with
// untouched words from allWords when fewer than WORKING_SET_SIZE have stats.
export const buildLifecycleView = (
  wordStats: Record<string, WordStats>,
  allWords: string[]
): LifecycleView => {
  const topWords = getTopWordsForTest(wordStats);

  // Pad with untouched words (not in wordStats at all) if needed
  const untouchedAll = allWords.filter(w => !wordStats[w]);
  const paddingNeeded = WORKING_SET_SIZE - topWords.length;
  const paddingWords = paddingNeeded > 0 ? untouchedAll.slice(0, paddingNeeded) : [];
  const workingSetWords = [...topWords, ...paddingWords];
  const workingSetWordSet = new Set(workingSetWords);

  const workingSet: WorkingSetWord[] = workingSetWords.map(word => {
    const stats = wordStats[word];
    return {
      word,
      wpm: stats && stats.lastScore > 0 ? wpmFromScore(stats.lastScore) : null,
      streak: stats?.consecutiveSubThreshold ?? 0,
      isCandidate: stats ? isGraduationCandidate(stats) : false,
      movement: computeMovement(stats?.lastScore ?? 0, stats?.prevScore),
    };
  });

  const remainingUntouched = allWords.filter(w => !wordStats[w] && !workingSetWordSet.has(w));

  return {
    workingSet,
    untouched: {
      count: remainingUntouched.length,
      next: remainingUntouched,
    },
    graduated: selectGraduatedWordRows(wordStats),
  };
};
