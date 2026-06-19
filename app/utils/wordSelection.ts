import { WordStats, isGraduated, isGraduationCandidate } from './wordUtils';
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
    .sort(([, a], [, b]) => {
      if (!a.lastScore && b.lastScore) return 1;
      if (a.lastScore && !b.lastScore) return -1;
      if (!a.lastScore && !b.lastScore) return 0;
      return a.lastScore - b.lastScore;
    })
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
    .sort(([, a], [, b]) => a.lastScore - b.lastScore)
    .map(([word, stats]) => ({
      word,
      wpm: wpmFromScore(stats.lastScore),
    }));
};
