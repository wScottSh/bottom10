import { describe, it, expect } from 'vitest';
import { applyKeystroke, TypingSessionState } from './typingSession';

const base: TypingSessionState = {
  currentInput: '',
  currentWordIndex: 0,
  currentCharIndex: 0,
  hasError: false,
  isWordErrored: false,
  testStarted: false,
};

const words = ['hello', 'world'];

describe('applyKeystroke — correct character entry', () => {
  it('advances currentInput and currentCharIndex on correct first char', () => {
    const next = applyKeystroke(base, 'h', words);
    expect(next.currentInput).toBe('h');
    expect(next.currentCharIndex).toBe(1);
  });

  it('advances through multiple correct characters', () => {
    const state = { ...base, currentInput: 'hel', currentCharIndex: 3 };
    const next = applyKeystroke(state, 'hell', words);
    expect(next.currentInput).toBe('hell');
    expect(next.currentCharIndex).toBe(4);
  });

  it('sets testStarted on first correct character', () => {
    const next = applyKeystroke(base, 'h', words);
    expect(next.testStarted).toBe(true);
  });

  it('does not change testStarted after it is already set', () => {
    const state = { ...base, currentInput: 'h', currentCharIndex: 1, testStarted: true };
    const next = applyKeystroke(state, 'he', words);
    expect(next.testStarted).toBe(true);
  });

  it('clears hasError when correct char is typed after a wrong first-char error', () => {
    const state = { ...base, hasError: true, isWordErrored: false };
    const next = applyKeystroke(state, 'h', words);
    expect(next.hasError).toBe(false);
    expect(next.currentInput).toBe('h');
  });

  it('sets hasError for a wrong first character, does not latch isWordErrored', () => {
    const next = applyKeystroke(base, 'x', words);
    expect(next.hasError).toBe(true);
    expect(next.isWordErrored).toBe(false);
    expect(next.currentInput).toBe('');
    expect(next.currentCharIndex).toBe(0);
  });

  it('sets testStarted when wrong first character is typed', () => {
    const next = applyKeystroke(base, 'x', words);
    expect(next.testStarted).toBe(true);
  });

  it('sets hasError and latches isWordErrored for a wrong mid-word character', () => {
    const state = { ...base, currentInput: 'h', currentCharIndex: 1 };
    const next = applyKeystroke(state, 'hx', words);
    expect(next.hasError).toBe(true);
    expect(next.isWordErrored).toBe(true);
    expect(next.currentInput).toBe('h');
    expect(next.currentCharIndex).toBe(1);
  });

  it('returns state unchanged when word is errored (isWordErrored)', () => {
    const state = { ...base, currentInput: 'h', currentCharIndex: 1, isWordErrored: true };
    const next = applyKeystroke(state, 'hx', words);
    expect(next).toBe(state);
  });
});

describe('applyKeystroke — backspace recovery', () => {
  it('backspace clears hasError and shrinks currentInput', () => {
    const state = { ...base, currentInput: 'h', currentCharIndex: 1, hasError: true };
    const next = applyKeystroke(state, '', words);
    expect(next.currentInput).toBe('');
    expect(next.currentCharIndex).toBe(0);
    expect(next.hasError).toBe(false);
  });

  it('backspace to empty clears isWordErrored', () => {
    const state = { ...base, currentInput: 'h', currentCharIndex: 1, hasError: true, isWordErrored: true };
    const next = applyKeystroke(state, '', words);
    expect(next.isWordErrored).toBe(false);
  });

  it('backspace mid-word keeps isWordErrored until empty', () => {
    const state = { ...base, currentInput: 'he', currentCharIndex: 2, hasError: true, isWordErrored: true };
    const next = applyKeystroke(state, 'h', words);
    expect(next.currentInput).toBe('h');
    expect(next.isWordErrored).toBe(true);
    expect(next.hasError).toBe(false);
  });

  it('recovers from wrong first char without backspace (stuck-word scenario 1)', () => {
    // Wrong first char: hasError set, currentInput stays empty, no isWordErrored latch.
    let state = applyKeystroke(base, 'x', words);
    expect(state.hasError).toBe(true);
    expect(state.isWordErrored).toBe(false);
    expect(state.currentInput).toBe('');
    // Correct first char clears the error and advances input.
    state = applyKeystroke(state, 'h', words);
    expect(state.currentInput).toBe('h');
    expect(state.hasError).toBe(false);
  });

  it('recovers from wrong mid-word char after backspacing to empty (stuck-word scenario 2)', () => {
    // Type first char correctly.
    let state = applyKeystroke(base, 'h', words);
    // Wrong second char latches isWordErrored.
    state = applyKeystroke(state, 'hx', words);
    expect(state.isWordErrored).toBe(true);
    expect(state.currentInput).toBe('h');
    // Blocked by isWordErrored — returns same reference.
    expect(applyKeystroke(state, 'hxz', words)).toBe(state);
    // Backspace down to empty clears isWordErrored.
    state = applyKeystroke(state, '', words);
    expect(state.currentInput).toBe('');
    expect(state.isWordErrored).toBe(false);
    // Can now type correct first char again.
    state = applyKeystroke(state, 'h', words);
    expect(state.currentInput).toBe('h');
    expect(state.hasError).toBe(false);
  });
});

describe('applyKeystroke — space word advance', () => {
  it('advances to next word on space after correct word', () => {
    const state = { ...base, currentInput: 'hello', currentCharIndex: 5 };
    const next = applyKeystroke(state, 'hello ', words);
    expect(next.currentWordIndex).toBe(1);
    expect(next.currentInput).toBe('');
    expect(next.currentCharIndex).toBe(0);
    expect(next.hasError).toBe(false);
    expect(next.isWordErrored).toBe(false);
  });

  it('returns state unchanged when space is pressed with wrong word', () => {
    const state = { ...base, currentInput: 'hell', currentCharIndex: 4 };
    const next = applyKeystroke(state, 'hell ', words);
    expect(next).toBe(state);
  });

  it('returns state unchanged when no current word exists', () => {
    const state = { ...base, currentWordIndex: 99 };
    const next = applyKeystroke(state, 'x', words);
    expect(next).toBe(state);
  });
});
