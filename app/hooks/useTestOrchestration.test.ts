// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTestOrchestration } from './useTestOrchestration';
import { createControllableClock } from '../utils/clock';

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
