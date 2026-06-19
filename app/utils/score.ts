export const CHARS_PER_WORD = 5;
export const MS_PER_MINUTE = 60000;

// Converts a word's elapsed typing time and length to a normalized Score (ms/char).
// Lower is faster. This is the fundamental stored unit for a word's difficulty.
export const scoreFromElapsed = (elapsed: number, wordLength: number): number =>
  elapsed / wordLength;

// Converts a Score (ms/char) to WPM for display, using the 5-character standard-word
// convention so any word's score is comparable to the WPM target.
export const wpmFromScore = (score: number): number =>
  Math.round(MS_PER_MINUTE / CHARS_PER_WORD / score);

// Returns the per-character time (ms/char) implied by the given WPM target.
// A word's score falls "sub-threshold" (and progresses toward graduation) when it
// is strictly less than this value.
export const graduationThreshold = (wpmTarget: number): number =>
  MS_PER_MINUTE / (wpmTarget * CHARS_PER_WORD);

// Returns true when elapsed / length converts to a WPM that meets or beats the target.
// Equal-to-target counts as fast (the same bar that drives graduation and the green particle).
export const meetsTarget = (elapsed: number, length: number, wpmTarget: number): boolean =>
  wpmFromScore(scoreFromElapsed(elapsed, length)) >= wpmTarget;
