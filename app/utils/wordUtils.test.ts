import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateNormalizedScore, calculateGraduationThreshold, isGraduated } from './wordUtils';

test('graduation threshold equals ms-per-char at target WPM', () => {
  // At 60 WPM, avgCharsPerWord=5: 60000 / (60 * 5) = 200 ms/char
  assert.strictEqual(calculateGraduationThreshold(60), 200);
  // At 40 WPM: 60000 / (40 * 5) = 300 ms/char
  assert.strictEqual(calculateGraduationThreshold(40), 300);
});

test('short and long words typed at equal cadence receive equal normalized scores', () => {
  const cadenceMs = 100; // 100 ms per character
  const shortWord = 'hi';  // length 2
  const longWord = 'hello'; // length 5

  const shortScore = calculateNormalizedScore(cadenceMs * shortWord.length, shortWord.length);
  const longScore = calculateNormalizedScore(cadenceMs * longWord.length, longWord.length);

  assert.strictEqual(shortScore, cadenceMs);
  assert.strictEqual(longScore, cadenceMs);
  assert.strictEqual(shortScore, longScore);
});

test('fast short word scores below graduation threshold and graduates', () => {
  // At 60 WPM, threshold = 200 ms/char
  const wpmTarget = 60;
  const threshold = calculateGraduationThreshold(wpmTarget);

  // "hi" typed at 80 ms/char => total time 160ms
  const fastShortWordTime = 80 * 'hi'.length;
  const score = calculateNormalizedScore(fastShortWordTime, 'hi'.length);

  assert.ok(score < threshold, `score ${score} should be below threshold ${threshold}`);
  assert.ok(isGraduated(score, wpmTarget), 'fast short word should graduate');
});
