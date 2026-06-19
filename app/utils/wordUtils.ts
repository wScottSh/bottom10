import { scoreFromElapsed, wpmFromScore, graduationThreshold, meetsTarget } from './score';
import { updateGraduationCounter } from './graduation';

export interface WordStats {
  word: string;
  time: number;
  attempts: number;
  lastScore: number;
  consecutiveSubThreshold?: number;
}

export const calculateNormalizedScore = (avgTime: number, wordLength: number): number =>
  scoreFromElapsed(avgTime, wordLength);

// Returns the time spent typing a word: completion minus the first-keystroke
// timestamp. Measuring from the first character (rather than from when the
// previous word was submitted) excludes the inter-word "switch cost" pause.
// Returns 0 when the word has no recorded first keystroke.
export const computeWordElapsedTime = (
  firstKeystrokeTimestamp: number | null,
  completionTimestamp: number
): number => {
  if (firstKeystrokeTimestamp === null) return 0;
  return completionTimestamp - firstKeystrokeTimestamp;
};

export interface KeystrokeEvent {
  key: string;
  timestamp: number;
}

// One word as completed during a test: the word, its elapsed typing time, and
// whether it was typed with an error. Accumulated across a session, then folded
// into the durable stats by applySessionToStats.
export interface TypedWord {
  word: string;
  time: number;
  errors: number;
}

// Pure helper: given a scripted sequence of timestamped keystroke events for a word,
// returns the word's elapsed typing time from the first character to the completing
// space. The inter-word switch gap is excluded by construction — the clock starts on
// the first character, not when the previous word was submitted. Backspacing does not
// reset that start timestamp; fumbling is counted as genuine difficulty.
export const computeWordTimingFromEvents = (events: KeystrokeEvent[]): number => {
  let firstKeystrokeTimestamp: number | null = null;

  for (const { key, timestamp } of events) {
    if (key === 'Backspace') continue; // never resets the start timestamp
    if (key === ' ') {
      return computeWordElapsedTime(firstKeystrokeTimestamp, timestamp);
    }
    if (firstKeystrokeTimestamp === null) {
      firstKeystrokeTimestamp = timestamp; // first character — right or wrong — starts the clock
    }
  }

  return 0;
};

// Converts a stored lastScore (ms/char) to WPM for display. This is the inverse of
// calculateGraduationThreshold: both treat a word as a 5-char standard word.
export const scoreToWpm = (lastScore: number): number => wpmFromScore(lastScore);

// Pure decision function for WPM particles: computes the per-word WPM for a single
// completion and determines whether it met the WPM target (green) or fell short (red).
// Uses the same scoring pipeline as the stored stats so the particle and sidebar can
// never disagree. Equal-to-target counts as fast (the same bar that drives graduation).
export const computeWpmParticle = (
  elapsed: number,
  wordLength: number,
  wpmTarget: number
): { wpm: number; isFast: boolean } => {
  const wpm = scoreToWpm(calculateNormalizedScore(elapsed, wordLength));
  return { wpm, isFast: meetsTarget(elapsed, wordLength, wpmTarget) };
};

export const calculateGraduationThreshold = (wpm: number): number =>
  graduationThreshold(wpm);

// Applies a finished session's typed words to the durable stats map.
// Groups repeated words and averages their times; bumps attempts once per word group;
// runs the graduation counter. Does not mutate the input stats object.
export const applySessionToStats = (
  stats: Record<string, WordStats>,
  typedWords: TypedWord[],
  wpmTarget: number
): Record<string, WordStats> => {
  const updatedStats = { ...stats };

  const wordGroups = typedWords.reduce((acc, { word, time }) => {
    if (!acc[word]) acc[word] = { totalTime: 0, count: 0 };
    acc[word].totalTime += time;
    acc[word].count += 1;
    return acc;
  }, {} as Record<string, { totalTime: number; count: number }>);

  Object.entries(wordGroups).forEach(([word, { totalTime, count }]) => {
    const avgTime = totalTime / count;
    const sessionScore = calculateNormalizedScore(avgTime, word.length);
    const prevAttempts = updatedStats[word]?.attempts || 0;
    const prevLastScore = updatedStats[word]?.lastScore || 0;
    // Running mean of per-session scores. With prevAttempts === 0 this reduces to
    // sessionScore, so the first session needs no special case.
    const cumulativeScore = (prevLastScore * prevAttempts + sessionScore) / (prevAttempts + 1);
    const withNewScore: WordStats = {
      ...updatedStats[word],
      time: avgTime,
      attempts: prevAttempts + 1,
      lastScore: cumulativeScore,
    };
    updatedStats[word] = updateGraduationCounter(withNewScore, wpmTarget);
  });

  return updatedStats;
};

// The canonical Score comparator: unscored words (score === 0) always rank after
// scored words; among scored words, ascending (lower score = faster = better = first).
// Both sidebar selection and working-set selection reuse this tiebreak;
// the working set reverses the scored ordering but delegates the 0-check here.
export const compareByScore = (scoreA: number, scoreB: number): number => {
  if (!scoreA && scoreB) return 1;
  if (scoreA && !scoreB) return -1;
  if (!scoreA && !scoreB) return 0;
  return scoreA - scoreB;
};
