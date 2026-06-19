import { describe, it, expect } from 'vitest';
import { scoreFromElapsed, wpmFromScore } from './score';

describe('Score module', () => {
  describe('scoreFromElapsed', () => {
    it('returns ms-per-char (elapsed / wordLength)', () => {
      expect(scoreFromElapsed(1000, 5)).toBe(200);
      expect(scoreFromElapsed(400, 2)).toBe(200);
    });

    it('normalizes so words of equal cadence get equal scores regardless of length', () => {
      const msPerChar = 100;
      expect(scoreFromElapsed(msPerChar * 2, 2)).toBe(msPerChar);
      expect(scoreFromElapsed(msPerChar * 7, 7)).toBe(msPerChar);
      expect(scoreFromElapsed(msPerChar * 2, 2)).toBe(scoreFromElapsed(msPerChar * 7, 7));
    });
  });

  describe('wpmFromScore', () => {
    it('converts 200 ms/char to 60 wpm', () => {
      expect(wpmFromScore(200)).toBe(60);
    });

    it('converts 300 ms/char to 40 wpm', () => {
      expect(wpmFromScore(300)).toBe(40);
    });

    it('converts 120 ms/char to 100 wpm', () => {
      expect(wpmFromScore(120)).toBe(100);
    });

    it('returns an integer (rounds)', () => {
      expect(Number.isInteger(wpmFromScore(233))).toBe(true);
    });
  });

  describe('Score↔WPM round trip', () => {
    it('wpmFromScore(scoreFromElapsed(1000, 5)) == 60', () => {
      expect(wpmFromScore(scoreFromElapsed(1000, 5))).toBe(60);
    });

    it('same cadence on short and long words produces the same WPM', () => {
      const msPerChar = 200; // 60 wpm
      const wpmShort = wpmFromScore(scoreFromElapsed(msPerChar * 2, 2));
      const wpmLong = wpmFromScore(scoreFromElapsed(msPerChar * 7, 7));
      expect(wpmShort).toBe(wpmLong);
      expect(wpmShort).toBe(60);
    });

    it('inverse: wpmFromScore at the graduation threshold reproduces the target wpm', () => {
      // At 60 wpm, threshold = 60000/(60*5) = 200 ms/char; wpmFromScore(200) should equal 60
      const target = 60;
      const threshold = 60000 / (target * 5);
      expect(wpmFromScore(threshold)).toBe(target);
    });
  });
});
