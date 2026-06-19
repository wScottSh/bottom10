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
