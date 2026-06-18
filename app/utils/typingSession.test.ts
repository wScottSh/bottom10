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

  it('returns state unchanged for a wrong character', () => {
    const next = applyKeystroke(base, 'x', words);
    expect(next).toBe(base);
  });

  it('returns state unchanged when word is errored (isWordErrored)', () => {
    const state = { ...base, currentInput: 'h', currentCharIndex: 1, isWordErrored: true };
    const next = applyKeystroke(state, 'hx', words);
    expect(next).toBe(state);
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
