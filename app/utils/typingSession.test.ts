import { describe, it, expect } from 'vitest';
import { applyKeystroke, TypingSessionState } from './typingSession';

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

  it('sets hasError, latches isWordErrored, and records the rejected first char', () => {
    const { state: next } = applyKeystroke(base, 'x', words, 1000);
    expect(next.hasError).toBe(true);
    expect(next.isWordErrored).toBe(true);
    // The wrong char is stored so a real Backspace can later fire and clear it.
    expect(next.currentInput).toBe('x');
    // Cursor does not advance over the rejected char.
    expect(next.currentCharIndex).toBe(0);
  });

  it('sets testStarted when wrong first character is typed', () => {
    const { state: next } = applyKeystroke(base, 'x', words, 1000);
    expect(next.testStarted).toBe(true);
  });

  it('sets hasError and latches isWordErrored for a wrong mid-word character', () => {
    const state = { ...base, currentInput: 'h', currentCharIndex: 1 };
    const { state: next } = applyKeystroke(state, 'hx', words, 1000);
    expect(next.hasError).toBe(true);
    expect(next.isWordErrored).toBe(true);
    expect(next.currentInput).toBe('h');
    expect(next.currentCharIndex).toBe(1);
  });

  it('returns state unchanged when word is errored (isWordErrored)', () => {
    const state = { ...base, currentInput: 'h', currentCharIndex: 1, isWordErrored: true };
    const { state: next } = applyKeystroke(state, 'hx', words, 1000);
    expect(next).toBe(state);
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

  it('backspace mid-word keeps isWordErrored until empty', () => {
    const state = { ...base, currentInput: 'he', currentCharIndex: 2, hasError: true, isWordErrored: true };
    const { state: next } = applyKeystroke(state, 'h', words, 1000);
    expect(next.currentInput).toBe('h');
    expect(next.isWordErrored).toBe(true);
    expect(next.hasError).toBe(false);
  });

  it('recovers from wrong first char via backspace (stuck-word scenario 1)', () => {
    // Wrong first char: error latched, rejected char stored so Backspace can fire.
    let state = applyKeystroke(base, 'x', words, 100).state;
    expect(state.hasError).toBe(true);
    expect(state.isWordErrored).toBe(true);
    expect(state.currentInput).toBe('x');
    // Locked until backspaced — typing the correct char is blocked (same ref).
    expect(applyKeystroke(state, 'xh', words, 150).state).toBe(state);
    // Backspace to empty clears the lock — never stuck.
    state = applyKeystroke(state, '', words, 200).state;
    expect(state.currentInput).toBe('');
    expect(state.isWordErrored).toBe(false);
    // Now the correct first char registers.
    state = applyKeystroke(state, 'h', words, 300).state;
    expect(state.currentInput).toBe('h');
    expect(state.hasError).toBe(false);
  });

  it('recovers from wrong mid-word char after backspacing to empty (stuck-word scenario 2)', () => {
    // Type first char correctly.
    let state = applyKeystroke(base, 'h', words, 100).state;
    // Wrong second char latches isWordErrored.
    state = applyKeystroke(state, 'hx', words, 200).state;
    expect(state.isWordErrored).toBe(true);
    expect(state.currentInput).toBe('h');
    // Blocked by isWordErrored — returns same reference.
    expect(applyKeystroke(state, 'hxz', words, 300).state).toBe(state);
    // Backspace down to empty clears isWordErrored.
    state = applyKeystroke(state, '', words, 400).state;
    expect(state.currentInput).toBe('');
    expect(state.isWordErrored).toBe(false);
    // Can now type correct first char again.
    state = applyKeystroke(state, 'h', words, 500).state;
    expect(state.currentInput).toBe('h');
    expect(state.hasError).toBe(false);
  });
});

describe('applyKeystroke — space word advance', () => {
  it('advances to next word on space after correct word', () => {
    const state = { ...base, currentInput: 'hello', currentCharIndex: 5 };
    const { state: next } = applyKeystroke(state, 'hello ', words, 1000);
    expect(next.currentWordIndex).toBe(1);
    expect(next.currentInput).toBe('');
    expect(next.currentCharIndex).toBe(0);
    expect(next.hasError).toBe(false);
    expect(next.isWordErrored).toBe(false);
  });

  it('returns state unchanged when space is pressed with wrong word', () => {
    const state = { ...base, currentInput: 'hell', currentCharIndex: 4 };
    const { state: next } = applyKeystroke(state, 'hell ', words, 1000);
    expect(next).toBe(state);
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

  it('emits completedWord on last-word direct completion (no space)', () => {
    const state = { ...base, currentInput: 'worl', currentCharIndex: 4, currentWordIndex: 1, wordStartTimestamp: 2000 };
    const { completedWord } = applyKeystroke(state, 'world', words, 2600);
    expect(completedWord).toEqual({ word: 'world', elapsed: 600 });
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

  it('elapsed is 0 when wordStartTimestamp is null on completion', () => {
    const state = { ...base, currentInput: 'hello', currentCharIndex: 5, wordStartTimestamp: null };
    const { completedWord } = applyKeystroke(state, 'hello ', words, 1500);
    expect(completedWord).toEqual({ word: 'hello', elapsed: 0 });
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
