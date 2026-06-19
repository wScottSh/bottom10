import type { WordStats } from './wordUtils';
import { graduationThreshold } from './score';

// Consecutive sub-threshold tests a word must accumulate before it graduates.
export const GRADUATION_STREAK = 2;

// A word is graduated once it has been confirmed sub-threshold on GRADUATION_STREAK
// consecutive tests. Graduation is a durable, stored property (consecutiveSubThreshold) —
// it does not depend on the current wpm target at read time; only updateGraduationCounter does.
export const isGraduated = (stats: WordStats): boolean =>
  (stats.consecutiveSubThreshold ?? 0) >= GRADUATION_STREAK;

// A word is a graduation candidate when it has one sub-threshold result and needs
// one more to graduate (consecutiveSubThreshold === GRADUATION_STREAK - 1).
export const isGraduationCandidate = (stats: WordStats): boolean =>
  (stats.consecutiveSubThreshold ?? 0) === GRADUATION_STREAK - 1;

// Increments the consecutive-sub-threshold counter when the word's lastScore is under the
// graduation threshold, or resets it to 0 when the word is at/over threshold.
// Graduation fires once the counter reaches GRADUATION_STREAK (checked via isGraduated).
export const updateGraduationCounter = (stats: WordStats, wpm: number): WordStats => {
  const threshold = graduationThreshold(wpm);
  const subThreshold = stats.lastScore > 0 && stats.lastScore < threshold;
  return {
    ...stats,
    consecutiveSubThreshold: subThreshold ? (stats.consecutiveSubThreshold ?? 0) + 1 : 0,
  };
};
