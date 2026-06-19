// Linear ramp from 0 at the first word to 1 at the last word, clamped to [0, 1].
// Progress is driven by word position, not characters or elapsed time.
export function shakeIntensity(wordIndex: number, wordCount: number): number {
  if (wordCount <= 1) return 0;
  return Math.max(0, Math.min(1, wordIndex / (wordCount - 1)));
}
