import { describe, it, expect } from 'vitest';
import { applyKeystroke, TypingSessionState } from './typingSession';

// Regression matrix for the input edge cases found during the "edge case roundup".
// The reducer re-derives state from the full input string, so multi-character
// deltas (paste / IME / autocorrect / select-replace / chords) are handled, not
// just one-character-at-a-time keystrokes.

const base: TypingSessionState = {
  currentInput: '',
  currentWordIndex: 0,
  currentCharIndex: 0,
  hasError: false,
  isWordErrored: false,
  testStarted: false,
  wordStartTimestamp: null,
};
const words = ['cat', 'dog'];
const apply = (state: TypingSessionState, value: string, ts = 1000) =>
  applyKeystroke(state, value, words, ts);

describe('Class A — multi-character input (paste / IME / chord / select-replace)', () => {
  it('A1: pasting the correct whole word is accepted, not errored', () => {
    const { state } = apply(base, 'cat');
    expect(state.currentInput).toBe('cat');
    expect(state.isWordErrored).toBe(false);
    expect(state.currentCharIndex).toBe(3);
  });

  it('A1b: pasting a correct prefix is accepted, not errored', () => {
    const { state } = apply(base, 'ca');
    expect(state.currentInput).toBe('ca');
    expect(state.isWordErrored).toBe(false);
  });

  it('A2: a multi-char delta validates the whole string, not just the last char', () => {
    // From "c", an autocorrect swaps in "cot" — the wrong middle char must be caught.
    const start = apply(base, 'c').state;
    const { state } = apply(start, 'cot', 1100);
    expect(state.currentInput).toBe('cot');
    expect(state.isWordErrored).toBe(true);
  });

  it('A3: select-all-and-replace is validated (not misread as a backspace)', () => {
    const full = { ...base, currentInput: 'cat', currentCharIndex: 3, wordStartTimestamp: 500 };
    const { state } = apply(full, 'x');
    expect(state.currentInput).toBe('x');
    expect(state.isWordErrored).toBe(true); // 'x' is wrong, must not look correct
  });

  it('A4: cursor index matches the stored input on a multi-char wrong insert', () => {
    const { state } = apply(base, 'xyz');
    expect(state.currentInput).toBe('xyz');
    expect(state.currentCharIndex).toBe(3); // no cursor/input desync
  });

  it('caps the stored input so a stuck key / huge paste cannot grow unbounded', () => {
    const { state } = apply(base, 'x'.repeat(100));
    expect(state.currentInput.length).toBeLessThanOrEqual('cat'.length + 8);
    expect(state.isWordErrored).toBe(true);
  });
});

describe('Class B — space / word advance', () => {
  it('B1 (Bug 1): space does NOT complete a word that has an over-typed error', () => {
    // Fully type "cat", then a stray extra letter reds it.
    const typed = { ...base, currentInput: 'cat', currentCharIndex: 3, wordStartTimestamp: 500 };
    const errored = apply(typed, 'catx', 1100).state;
    expect(errored.isWordErrored).toBe(true);
    // Pressing space must not advance — the error has to be corrected first.
    const { state, completedWord } = apply(errored, 'catx ', 1200);
    expect(state.currentWordIndex).toBe(0);
    expect(completedWord).toBeNull();
  });

  it('space advances only on an exact, error-free match', () => {
    const typed = { ...base, currentInput: 'cat', currentCharIndex: 3, wordStartTimestamp: 500 };
    const { state, completedWord } = apply(typed, 'cat ', 1200);
    expect(state.currentWordIndex).toBe(1);
    expect(completedWord).toEqual({ word: 'cat', elapsed: 700 });
  });

  it('B2: an atomic "word + space" paste lands the word and starts the clock, then completes', () => {
    // First event: "cat " arrives atomically with no prior typing — no instant completion.
    const landed = apply(base, 'cat ', 1000);
    expect(landed.completedWord).toBeNull();
    expect(landed.state.currentInput).toBe('cat');
    expect(landed.state.wordStartTimestamp).toBe(1000);
    // Next space completes it with a real (non-zero) elapsed time.
    const done = apply(landed.state, 'cat ', 1300);
    expect(done.completedWord).toEqual({ word: 'cat', elapsed: 300 });
  });

  it('a leading space on an empty word is ignored', () => {
    const { state, completedWord } = apply(base, ' ');
    expect(state.currentInput).toBe('');
    expect(state.currentWordIndex).toBe(0);
    expect(completedWord).toBeNull();
  });
});

describe('Class C — consistent error / backspace model', () => {
  it('a wrong first char and a wrong mid char are handled the same way (both stored)', () => {
    const firstWrong = apply(base, 'x').state;
    expect(firstWrong.currentInput).toBe('x');
    expect(firstWrong.isWordErrored).toBe(true);

    const midWrong = apply({ ...base, currentInput: 'ca', currentCharIndex: 2 }, 'caz').state;
    expect(midWrong.currentInput).toBe('caz');
    expect(midWrong.isWordErrored).toBe(true);
  });

  it('backspacing the typo restores the correct prefix without losing correct letters', () => {
    let state = apply(base, 'ca').state;                 // correct so far
    state = apply(state, 'caz', 1100).state;             // typo -> red, stored
    expect(state.isWordErrored).toBe(true);
    state = apply(state, 'ca', 1200).state;              // one backspace
    expect(state.currentInput).toBe('ca');
    expect(state.isWordErrored).toBe(false);             // correct prefix again, not red
  });
});

describe('Class D — timing', () => {
  it('preserves wordStartTimestamp across backspaces (fumbling counts)', () => {
    let state = apply(base, 'c', 1000).state;
    expect(state.wordStartTimestamp).toBe(1000);
    state = apply(state, '', 1200).state; // backspace to empty
    expect(state.wordStartTimestamp).toBe(1000);
  });

  it('never emits a completion with zero elapsed time', () => {
    // The only way to reach currentInput === word with a null clock is an atomic
    // paste; the reducer refuses to complete it, so elapsed 0 can never be recorded.
    const state = { ...base, currentInput: 'cat', currentCharIndex: 3, wordStartTimestamp: null };
    const { completedWord } = apply(state, 'cat ', 1500);
    expect(completedWord).toBeNull();
  });
});
