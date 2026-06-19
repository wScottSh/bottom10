// Central tunables for end-of-test juice effects. CSS-driven values are mirrored
// as CSS custom properties in globals.css so keyframes can reference them.

export const TENSION_SHAKE = {
  // Peak translation amplitude per axis at full intensity (in pixels).
  maxTranslatePx: 3.5,
  // Peak rotation amplitude at full intensity (in degrees).
  maxRotateDeg: 2.5,
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
