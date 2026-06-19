import { describe, it, expect } from 'vitest';
import { shakeIntensity } from './shake';

describe('shakeIntensity', () => {
  it('returns 0 at the first word (wordIndex=0)', () => {
    expect(shakeIntensity(0, 10)).toBe(0);
  });

  it('returns 1 at the last word (wordIndex=wordCount-1)', () => {
    expect(shakeIntensity(9, 10)).toBe(1);
  });

  it('is linear — grows proportionally with wordIndex', () => {
    const count = 10;
    for (let i = 0; i < count; i++) {
      expect(shakeIntensity(i, count)).toBeCloseTo(i / (count - 1));
    }
  });

  it('returns 0.5 at the midpoint', () => {
    expect(shakeIntensity(5, 11)).toBeCloseTo(0.5);
  });

  it('clamps to 0 for negative wordIndex', () => {
    expect(shakeIntensity(-1, 10)).toBe(0);
  });

  it('clamps to 1 for wordIndex beyond the last word', () => {
    expect(shakeIntensity(10, 10)).toBe(1);
  });

  it('returns 0 when wordCount is 1 (single-word test has no ramp)', () => {
    expect(shakeIntensity(0, 1)).toBe(0);
  });

  it('returns 0 when wordCount is 0', () => {
    expect(shakeIntensity(0, 0)).toBe(0);
  });
});
