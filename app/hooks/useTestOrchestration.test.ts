// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTestOrchestration } from './useTestOrchestration';
import { createControllableClock } from '../utils/clock';
import type { WordStats } from '../utils/wordUtils';

// Two short words so tests can type through a full set quickly
const TWO_WORDS = ['go', 'up'];

function makeOpts(overrides: Partial<Parameters<typeof useTestOrchestration>[0]> = {}) {
  return {
    globalWordStats: {},
    setGlobalWordStats: vi.fn(),
    wpmTarget: 60,
    allWords: TWO_WORDS,
    wordCount: 2,
    ...overrides,
  };
}

// Helper: type every word in the session through the hook, then verify completion.
function typeAllWords(result: { current: ReturnType<typeof useTestOrchestration> }) {
  const words = [...result.current.words];
  let input = '';
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const isLast = i === words.length - 1;
    for (const ch of word) {
      input += ch;
      act(() => { result.current.handleKeystroke(input); });
    }
    if (!isLast) {
      act(() => { result.current.handleKeystroke(input + ' '); });
      input = '';
    }
  }
}

describe('useTestOrchestration — mount', () => {
  it('generates a word set on mount', () => {
    const { result } = renderHook(() => useTestOrchestration(makeOpts()));
    expect(result.current.words.length).toBeGreaterThan(0);
    expect(result.current.session.testStarted).toBe(false);
  });
});

describe('useTestOrchestration — restart after completion', () => {
  it('auto-restarts after all words are typed', () => {
    const clock = createControllableClock(1000);
    const setStats = vi.fn();

    const { result } = renderHook(() =>
      useTestOrchestration(makeOpts({ setGlobalWordStats: setStats, clock }))
    );

    const firstWords = [...result.current.words];
    expect(firstWords).toHaveLength(2);

    typeAllWords(result);

    // Stats updated once per finished session
    expect(setStats).toHaveBeenCalledOnce();
    // Session reset for the new test
    expect(result.current.session.testStarted).toBe(false);
    expect(result.current.session.currentWordIndex).toBe(0);
    // New word set generated
    expect(result.current.words).toHaveLength(2);
  });
});

describe('useTestOrchestration — Enter-to-restart', () => {
  it('restarts a fresh test when Enter is pressed', () => {
    const { result } = renderHook(() => useTestOrchestration(makeOpts()));

    // Begin typing to prove the session is live
    act(() => { result.current.handleKeystroke('g'); });
    expect(result.current.session.testStarted).toBe(true);

    // Enter should start a fresh test
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    });

    expect(result.current.session.testStarted).toBe(false);
    expect(result.current.session.currentWordIndex).toBe(0);
    expect(result.current.words.length).toBeGreaterThan(0);
  });

  it('does not restart on other keypresses', () => {
    const { result } = renderHook(() => useTestOrchestration(makeOpts()));

    act(() => { result.current.handleKeystroke('g'); });
    expect(result.current.session.testStarted).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    // Still typing — session unchanged
    expect(result.current.session.testStarted).toBe(true);
  });
});

describe('useTestOrchestration — stats folding on session completion', () => {
  it('folds typed-word timing into stats with correct attempts and scores', () => {
    const clock = createControllableClock(1000);
    const setStats = vi.fn();

    const { result } = renderHook(() =>
      useTestOrchestration(makeOpts({ setGlobalWordStats: setStats, clock }))
    );

    const words = [...result.current.words];
    expect(words).toHaveLength(2);
    const [first, second] = words;

    // Type first word starting at t=1000, finishing at t=1500 (500ms elapsed).
    act(() => { result.current.handleKeystroke(first[0]); });
    clock.setNow(1500);
    for (let i = 1; i < first.length; i++) {
      act(() => { result.current.handleKeystroke(first.slice(0, i + 1)); });
    }
    act(() => { result.current.handleKeystroke(first + ' '); });

    // Type second (last) word starting at t=2000, finishing at t=3000 (1000ms elapsed).
    clock.setNow(2000);
    act(() => { result.current.handleKeystroke(second[0]); });
    clock.setNow(3000);
    for (let i = 1; i < second.length; i++) {
      act(() => { result.current.handleKeystroke(second.slice(0, i + 1)); });
    }
    // Last word completes on its final character — no trailing space needed.

    expect(setStats).toHaveBeenCalledOnce();
    const updatedStats: Record<string, WordStats> = setStats.mock.calls[0][0];

    // Both words must have one recorded attempt and a non-zero score.
    expect(updatedStats[first].attempts).toBe(1);
    expect(updatedStats[first].lastScore).toBeGreaterThan(0);
    expect(updatedStats[second].attempts).toBe(1);
    expect(updatedStats[second].lastScore).toBeGreaterThan(0);

    // First word (500ms / 2 chars = 250 ms/char) is faster than second
    // (1000ms / 2 chars = 500 ms/char), so its stored score must be lower.
    expect(updatedStats[first].lastScore).toBeLessThan(updatedStats[second].lastScore);

    // The next set must have been generated from the fresh stats (session restarted).
    expect(result.current.session.testStarted).toBe(false);
    expect(result.current.words).toHaveLength(2);
  });
});
