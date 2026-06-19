// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTypingSession } from './useTypingSession';

const words = ['hello', 'world'];

describe('useTypingSession — word completion', () => {
  it('emits completedWord on space after typing the correct word', () => {
    const { result } = renderHook(() => useTypingSession());

    act(() => { result.current.applyKeystroke('h', words, 1000); });
    act(() => { result.current.applyKeystroke('he', words, 1100); });
    act(() => { result.current.applyKeystroke('hel', words, 1200); });
    act(() => { result.current.applyKeystroke('hell', words, 1300); });
    act(() => { result.current.applyKeystroke('hello', words, 1400); });

    let outcome: ReturnType<typeof result.current.applyKeystroke>;
    act(() => { outcome = result.current.applyKeystroke('hello ', words, 1500); });

    expect(outcome!).toEqual({ word: 'hello', elapsed: 500 });
    expect(result.current.session.currentWordIndex).toBe(1);
    expect(result.current.session.currentInput).toBe('');
    expect(result.current.session.testStarted).toBe(true);
  });

  it('advances session to next word after space completion', () => {
    const { result } = renderHook(() => useTypingSession());

    act(() => { result.current.applyKeystroke('h', words, 1000); });
    act(() => { result.current.applyKeystroke('he', words, 1100); });
    act(() => { result.current.applyKeystroke('hel', words, 1200); });
    act(() => { result.current.applyKeystroke('hell', words, 1300); });
    act(() => { result.current.applyKeystroke('hello', words, 1400); });
    act(() => { result.current.applyKeystroke('hello ', words, 1500); });

    expect(result.current.session.currentWordIndex).toBe(1);
    expect(result.current.session.wordStartTimestamp).toBeNull();
  });
});

describe('useTypingSession — error-latch and backspace recovery', () => {
  it('latches isWordErrored on wrong mid-word char and blocks further input', () => {
    const { result } = renderHook(() => useTypingSession());

    act(() => { result.current.applyKeystroke('h', words, 1000); });
    act(() => { result.current.applyKeystroke('hx', words, 1100); });

    expect(result.current.session.isWordErrored).toBe(true);
    expect(result.current.session.currentInput).toBe('h');

    act(() => { result.current.applyKeystroke('hxz', words, 1200); });
    expect(result.current.session.currentInput).toBe('h');
  });

  it('backspace to empty clears the error latch and allows correct typing', () => {
    const { result } = renderHook(() => useTypingSession());

    act(() => { result.current.applyKeystroke('h', words, 1000); });
    act(() => { result.current.applyKeystroke('hx', words, 1100); });
    expect(result.current.session.isWordErrored).toBe(true);

    act(() => { result.current.applyKeystroke('', words, 1200); });
    expect(result.current.session.isWordErrored).toBe(false);
    expect(result.current.session.currentInput).toBe('');

    act(() => { result.current.applyKeystroke('h', words, 1300); });
    expect(result.current.session.currentInput).toBe('h');
    expect(result.current.session.hasError).toBe(false);
  });
});

describe('useTypingSession — reset', () => {
  it('reset returns session to initial state', () => {
    const { result } = renderHook(() => useTypingSession());

    act(() => { result.current.applyKeystroke('h', words, 1000); });
    act(() => { result.current.applyKeystroke('he', words, 1100); });
    expect(result.current.session.currentInput).toBe('he');

    act(() => { result.current.reset(); });

    expect(result.current.session.currentInput).toBe('');
    expect(result.current.session.currentWordIndex).toBe(0);
    expect(result.current.session.testStarted).toBe(false);
    expect(result.current.session.hasError).toBe(false);
    expect(result.current.session.wordStartTimestamp).toBeNull();
  });
});
