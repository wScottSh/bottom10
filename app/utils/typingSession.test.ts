import { describe, it, expect } from 'vitest';
import { applyKeystroke, isAwaitingFinish, TypingSessionState } from './typingSession';

const base: TypingSessionState = {
  currentInput: '',
  currentWordIndex: 0,
  currentCharIndex: 0,
  hasError: false,
  isWordErrored: false,
  testStarted: false,
  wordStartTimestamp: null,
};

const words = ['hello', 'world'];

describe('applyKeystroke — correct character entry', () => {
  it('advances currentInput and currentCharIndex on correct first char', () => {
    const { state: next } = applyKeystroke(base, 'h', words, 1000);
    expect(next.currentInput).toBe('h');
    expect(next.currentCharIndex).toBe(1);
  });

  it('advances through multiple correct characters', () => {
    const state = { ...base, currentInput: 'hel', currentCharIndex: 3 };
    const { state: next } = applyKeystroke(state, 'hell', words, 1000);
    expect(next.currentInput).toBe('hell');
    expect(next.currentCharIndex).toBe(4);
  });

  it('sets testStarted on first correct character', () => {
    const { state: next } = applyKeystroke(base, 'h', words, 1000);
    expect(next.testStarted).toBe(true);
  });

  it('does not change testStarted after it is already set', () => {
    const state = { ...base, currentInput: 'h', currentCharIndex: 1, testStarted: true };
    const { state: next } = applyKeystroke(state, 'he', words, 1000);
    expect(next.testStarted).toBe(true);
  });

  it('clears a stray hasError when a correct char is typed (no active lock)', () => {
    const state = { ...base, hasError: true, isWordErrored: false };
    const { state: next } = applyKeystroke(state, 'h', words, 1000);
    expect(next.hasError).toBe(false);
    expect(next.currentInput).toBe('h');
  });

  it('sets hasError, isWordErrored, and stores the wrong first char', () => {
    const { state: next } = applyKeystroke(base, 'x', words, 1000);
    expect(next.hasError).toBe(true);
    expect(next.isWordErrored).toBe(true);
    // The wrong char is stored so a real Backspace can later fire and clear it (issue #27).
    expect(next.currentInput).toBe('x');
    // Cursor reflects the stored character — the input string is the source of truth.
    expect(next.currentCharIndex).toBe(1);
  });

  it('sets testStarted when wrong first character is typed', () => {
    const { state: next } = applyKeystroke(base, 'x', words, 1000);
    expect(next.testStarted).toBe(true);
  });

  it('sets hasError and isWordErrored for a wrong mid-word character, storing it', () => {
    const state = { ...base, currentInput: 'h', currentCharIndex: 1 };
    const { state: next } = applyKeystroke(state, 'hx', words, 1000);
    expect(next.hasError).toBe(true);
    expect(next.isWordErrored).toBe(true);
    // The wrong char is kept (not swallowed) so Backspace removes exactly what was typed.
    expect(next.currentInput).toBe('hx');
    expect(next.currentCharIndex).toBe(2);
  });

  it('does not block input while errored — error is re-derived from the typed string', () => {
    const state = { ...base, currentInput: 'hx', currentCharIndex: 2, hasError: true, isWordErrored: true };
    const { state: next } = applyKeystroke(state, 'hxy', words, 1000);
    // Input keeps growing; the word stays errored because 'hxy' is not a prefix of 'hello'.
    expect(next.currentInput).toBe('hxy');
    expect(next.isWordErrored).toBe(true);
  });
});

describe('applyKeystroke — backspace recovery', () => {
  it('backspace clears hasError and shrinks currentInput', () => {
    const state = { ...base, currentInput: 'h', currentCharIndex: 1, hasError: true };
    const { state: next } = applyKeystroke(state, '', words, 1000);
    expect(next.currentInput).toBe('');
    expect(next.currentCharIndex).toBe(0);
    expect(next.hasError).toBe(false);
  });

  it('backspace to empty clears isWordErrored', () => {
    const state = { ...base, currentInput: 'h', currentCharIndex: 1, hasError: true, isWordErrored: true };
    const { state: next } = applyKeystroke(state, '', words, 1000);
    expect(next.isWordErrored).toBe(false);
  });

  it('backspace to a correct prefix clears the error and keeps the correct letters', () => {
    const state = { ...base, currentInput: 'hx', currentCharIndex: 2, hasError: true, isWordErrored: true };
    const { state: next } = applyKeystroke(state, 'h', words, 1000);
    expect(next.currentInput).toBe('h');
    // 'h' is a correct prefix of 'hello', so the word is no longer errored.
    expect(next.isWordErrored).toBe(false);
    expect(next.hasError).toBe(false);
  });

  it('recovers from wrong first char via backspace (stuck-word scenario 1)', () => {
    // Wrong first char: error shown, the rejected char stored so Backspace can fire.
    let state = applyKeystroke(base, 'x', words, 100).state;
    expect(state.hasError).toBe(true);
    expect(state.isWordErrored).toBe(true);
    expect(state.currentInput).toBe('x');
    // Typing while errored is allowed (input is the source of truth); still red.
    state = applyKeystroke(state, 'xh', words, 150).state;
    expect(state.currentInput).toBe('xh');
    expect(state.isWordErrored).toBe(true);
    // Backspace to empty clears the error — never stuck.
    state = applyKeystroke(state, '', words, 200).state;
    expect(state.currentInput).toBe('');
    expect(state.isWordErrored).toBe(false);
    // Now the correct first char registers.
    state = applyKeystroke(state, 'h', words, 300).state;
    expect(state.currentInput).toBe('h');
    expect(state.hasError).toBe(false);
  });

  it('recovers from a wrong mid-word char by backspacing just the typo (scenario 2)', () => {
    // Type first char correctly.
    let state = applyKeystroke(base, 'h', words, 100).state;
    // Wrong second char is stored and reds the word.
    state = applyKeystroke(state, 'hx', words, 200).state;
    expect(state.isWordErrored).toBe(true);
    expect(state.currentInput).toBe('hx');
    // ONE backspace removes exactly the typo and restores the correct prefix — not red.
    state = applyKeystroke(state, 'h', words, 300).state;
    expect(state.currentInput).toBe('h');
    expect(state.isWordErrored).toBe(false);
    // Typing continues from where you were — never thrown back to the start.
    state = applyKeystroke(state, 'he', words, 400).state;
    expect(state.currentInput).toBe('he');
    expect(state.hasError).toBe(false);
  });
});

describe('applyKeystroke — space word advance', () => {
  it('advances to next word on space after correct word', () => {
    const state = { ...base, currentInput: 'hello', currentCharIndex: 5, wordStartTimestamp: 500 };
    const { state: next } = applyKeystroke(state, 'hello ', words, 1000);
    expect(next.currentWordIndex).toBe(1);
    expect(next.currentInput).toBe('');
    expect(next.currentCharIndex).toBe(0);
    expect(next.hasError).toBe(false);
    expect(next.isWordErrored).toBe(false);
  });

  it('ignores the space and does not advance when the word is incomplete', () => {
    const state = { ...base, currentInput: 'hell', currentCharIndex: 4, wordStartTimestamp: 500 };
    const { state: next, completedWord } = applyKeystroke(state, 'hell ', words, 1000);
    expect(next.currentWordIndex).toBe(0);
    // The space is never stored as content; the typed prefix is kept.
    expect(next.currentInput).toBe('hell');
    expect(completedWord).toBeNull();
  });

  it('returns state unchanged when no current word exists', () => {
    const state = { ...base, currentWordIndex: 99 };
    const { state: next } = applyKeystroke(state, 'x', words, 1000);
    expect(next).toBe(state);
  });
});

describe('applyKeystroke — word completion outcome', () => {
  it('emits completedWord on space after correct word with elapsed time', () => {
    const state = { ...base, currentInput: 'hello', currentCharIndex: 5, wordStartTimestamp: 1000 };
    const { state: next, completedWord } = applyKeystroke(state, 'hello ', words, 1500);
    expect(completedWord).toEqual({ word: 'hello', elapsed: 500 });
    expect(next.currentWordIndex).toBe(1);
    expect(next.wordStartTimestamp).toBeNull();
  });

  it('does NOT auto-complete the last word on its final character (space required)', () => {
    const state = { ...base, currentInput: 'worl', currentCharIndex: 4, currentWordIndex: 1, wordStartTimestamp: 2000 };
    const { completedWord } = applyKeystroke(state, 'world', words, 2600);
    expect(completedWord).toBeNull();
  });

  it('completes the last word via space when fully and correctly typed', () => {
    const state = { ...base, currentInput: 'world', currentCharIndex: 5, currentWordIndex: 1, wordStartTimestamp: 2000 };
    const { completedWord, state: next } = applyKeystroke(state, 'world ', words, 2600);
    expect(completedWord).toEqual({ word: 'world', elapsed: 600 });
    expect(next.currentWordIndex).toBe(2);
  });

  it('returns completedWord: null for non-completing character keystrokes', () => {
    const { completedWord } = applyKeystroke(base, 'h', words, 1000);
    expect(completedWord).toBeNull();
  });

  it('returns completedWord: null for wrong character keystrokes', () => {
    const { completedWord } = applyKeystroke(base, 'x', words, 1000);
    expect(completedWord).toBeNull();
  });

  it('returns completedWord: null for backspace', () => {
    const state = { ...base, currentInput: 'h', currentCharIndex: 1 };
    const { completedWord } = applyKeystroke(state, '', words, 1000);
    expect(completedWord).toBeNull();
  });

  it('returns completedWord: null for space on wrong/partial word', () => {
    const state = { ...base, currentInput: 'hell', currentCharIndex: 4 };
    const { completedWord } = applyKeystroke(state, 'hell ', words, 1000);
    expect(completedWord).toBeNull();
  });

  it('does NOT complete on space when the clock never started (atomic-paste guard)', () => {
    // currentInput equals the word but the per-word clock was never started — only
    // reachable by pasting/chording "word + space" in one event. Completing here would
    // post elapsed 0 (infinite WPM), so instead the content lands and the clock starts.
    const state = { ...base, currentInput: 'hello', currentCharIndex: 5, wordStartTimestamp: null };
    const { completedWord, state: next } = applyKeystroke(state, 'hello ', words, 1500);
    expect(completedWord).toBeNull();
    expect(next.currentWordIndex).toBe(0);
    expect(next.wordStartTimestamp).toBe(1500);
  });
});

describe('applyKeystroke — word timing (wordStartTimestamp)', () => {
  it('sets wordStartTimestamp on first correct char', () => {
    const { state: next } = applyKeystroke(base, 'h', words, 1000);
    expect(next.wordStartTimestamp).toBe(1000);
  });

  it('sets wordStartTimestamp on first wrong char (clock starts regardless)', () => {
    const { state: next } = applyKeystroke(base, 'x', words, 1000);
    expect(next.wordStartTimestamp).toBe(1000);
  });

  it('does not overwrite wordStartTimestamp on subsequent chars', () => {
    const state = { ...base, currentInput: 'h', currentCharIndex: 1, testStarted: true, wordStartTimestamp: 1000 };
    const { state: next } = applyKeystroke(state, 'he', words, 1200);
    expect(next.wordStartTimestamp).toBe(1000);
  });

  it('does not reset wordStartTimestamp on backspace', () => {
    const state = { ...base, currentInput: 'h', currentCharIndex: 1, testStarted: true, wordStartTimestamp: 1000 };
    const { state: next } = applyKeystroke(state, '', words, 1200);
    expect(next.wordStartTimestamp).toBe(1000);
  });

  it('resets wordStartTimestamp to null after word advance via space', () => {
    const state = { ...base, currentInput: 'hello', currentCharIndex: 5, testStarted: true, wordStartTimestamp: 1000 };
    const { state: next } = applyKeystroke(state, 'hello ', words, 1500);
    expect(next.wordStartTimestamp).toBeNull();
  });
});

describe('isAwaitingFinish', () => {
  it('returns true when last word is fully and correctly typed, not errored', () => {
    const state = { ...base, currentInput: 'world', currentCharIndex: 5, currentWordIndex: 1 };
    expect(isAwaitingFinish(state, words)).toBe(true);
  });

  it('returns false when on a non-last word', () => {
    const state = { ...base, currentInput: 'hello', currentCharIndex: 5, currentWordIndex: 0 };
    expect(isAwaitingFinish(state, words)).toBe(false);
  });

  it('returns false when the last word is only partially typed', () => {
    const state = { ...base, currentInput: 'wor', currentCharIndex: 3, currentWordIndex: 1 };
    expect(isAwaitingFinish(state, words)).toBe(false);
  });

  it('returns false when the last word is errored', () => {
    const state = { ...base, currentInput: 'world', currentCharIndex: 5, currentWordIndex: 1, isWordErrored: true };
    expect(isAwaitingFinish(state, words)).toBe(false);
  });

  it('returns false when words array is empty', () => {
    expect(isAwaitingFinish(base, [])).toBe(false);
  });

  it('returns false when current input is empty (not yet started last word)', () => {
    const state = { ...base, currentWordIndex: 1 };
    expect(isAwaitingFinish(state, words)).toBe(false);
  });
});
