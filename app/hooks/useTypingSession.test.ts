// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTypingSession } from './useTypingSession';
import { createControllableClock } from '../utils/clock';
import { computeWpmParticle } from '../utils/wordUtils';

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
  it('stores a wrong mid-word char and keeps the word errored as typing continues', () => {
    const { result } = renderHook(() => useTypingSession());

    act(() => { result.current.applyKeystroke('h', words, 1000); });
    act(() => { result.current.applyKeystroke('hx', words, 1100); });

    expect(result.current.session.isWordErrored).toBe(true);
    // The wrong char is kept (not swallowed) so Backspace removes exactly what was typed.
    expect(result.current.session.currentInput).toBe('hx');

    // Input is not blocked while errored; it keeps growing and stays red.
    act(() => { result.current.applyKeystroke('hxz', words, 1200); });
    expect(result.current.session.currentInput).toBe('hxz');
    expect(result.current.session.isWordErrored).toBe(true);
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

describe('useTypingSession — clock injection', () => {
  it('uses injected clock when no explicit timestamp is given', () => {
    const clock = createControllableClock(1000);
    const { result } = renderHook(() => useTypingSession({ clock }));

    act(() => { result.current.applyKeystroke('h', words); });
    act(() => { result.current.applyKeystroke('he', words); });
    act(() => { result.current.applyKeystroke('hel', words); });
    act(() => { result.current.applyKeystroke('hell', words); });
    act(() => { result.current.applyKeystroke('hello', words); });

    clock.setNow(1500);
    let outcome: ReturnType<typeof result.current.applyKeystroke>;
    act(() => { outcome = result.current.applyKeystroke('hello ', words); });

    expect(outcome!).toEqual({ word: 'hello', elapsed: 500 });
  });

  it('records elapsed time from injected clock and classifies fast/slow particle without mocking globals', () => {
    // 'go' typed in 500ms at 40 wpm target:
    // normalizedScore = elapsed / wordLength = 500/2 = 250 ms/char
    // wpmFromScore(250) = 60000 / (250 * 5) = 48 wpm > 40 → isFast = true
    const clock = createControllableClock(1000);
    const shortWords = ['go', 'up'];
    const WPM_TARGET = 40;
    const { result } = renderHook(() => useTypingSession({ clock }));

    act(() => { result.current.applyKeystroke('g', shortWords); });
    clock.setNow(1500);

    let outcome: ReturnType<typeof result.current.applyKeystroke>;
    act(() => { outcome = result.current.applyKeystroke('go ', shortWords); });

    expect(outcome!.elapsed).toBe(500);
    const { isFast } = computeWpmParticle(outcome!.elapsed, outcome!.word.length, WPM_TARGET);
    expect(isFast).toBe(true);
  });

  it('classifies slow typing as isFast=false with injected clock', () => {
    // 'go' typed in 5000ms at 40 wpm target:
    // normalizedScore = 5000/2 = 2500 ms/char
    // wpmFromScore(2500) = 60000 / (2500 * 5) = 4.8 wpm < 40 → isFast = false
    const clock = createControllableClock(1000);
    const shortWords = ['go', 'up'];
    const WPM_TARGET = 40;
    const { result } = renderHook(() => useTypingSession({ clock }));

    act(() => { result.current.applyKeystroke('g', shortWords); });
    clock.setNow(6000);

    let outcome: ReturnType<typeof result.current.applyKeystroke>;
    act(() => { outcome = result.current.applyKeystroke('go ', shortWords); });

    expect(outcome!.elapsed).toBe(5000);
    const { isFast } = computeWpmParticle(outcome!.elapsed, outcome!.word.length, WPM_TARGET);
    expect(isFast).toBe(false);
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
