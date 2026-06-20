// Central tunables for end-of-test juice effects. CSS-driven values are mirrored
// as CSS custom properties in globals.css so keyframes can reference them.

export const TENSION_SHAKE = {
  // Peak translation amplitude per axis at full intensity (in pixels).
  maxTranslatePx: 1.225,
  // Peak rotation amplitude at full intensity (in degrees).
  maxRotateDeg: 0.875,
  // Base jitter cycle duration (in milliseconds).
  jitterDurationMs: 160,
} as const;

export const FINISH_PROMPT = {
  // Duration of one full pulse cycle (in/out), in milliseconds.
  pulseDurationMs: 2000,
  // Keyframe timing function for the pulse ease.
  pulseEasing: 'ease-in-out',
  // Scale at the peak of the pulse (full-motion only).
  pulseScale: 1.08,
  // Opacity at the trough of the pulse (both full-motion and reduced-motion).
  pulseOpacityMin: 0.55,
} as const;

export const FADE_IN = {
  // Duration of the next-test fade-in (opacity 0→1) on test completion (milliseconds).
  durationMs: 180,
} as const;

export const DETONATION = {
  // Base outward fling distance per letter (pixels).
  velocityPx: 700,
  // Random ± spread added to the base velocity (pixels).
  velocitySpreadPx: 250,
  // Max rotation per letter at end of animation (degrees). Each letter gets ±maxSpinDeg.
  maxSpinDeg: 720,
  // Duration of the explosion animation (milliseconds).
  durationMs: 600,
  // Duration of the whole-field screen-shake punch on the word container (milliseconds).
  punchDurationMs: 120,
} as const;
