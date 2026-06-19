// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import React from 'react';
import { FADE_IN } from '../utils/juiceConfig';

vi.mock('../data/wordList', () => ({ default: ['ab'] }));
vi.mock('../utils/wordGeneration', () => ({
  generateWordSet: () => ['ab'],
  getTopWordsForTest: () => [],
  WORKING_SET_SIZE: 10,
}));

import TypingTest from './TypingTest';

function typeChar(input: HTMLInputElement, char: string) {
  fireEvent.change(input, { target: { value: input.value + char } });
}

function wordsField(container: HTMLElement): HTMLElement {
  const el = container.querySelector('[data-testid="words-field"]');
  if (!el) throw new Error('words-field not found');
  return el as HTMLElement;
}

describe('next-test fade-in on completion', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('applies words-fade-in class to the words field immediately after test completion', () => {
    const { container } = render(<TypingTest />);
    const input = container.querySelector('input') as HTMLInputElement;

    // Word is 'ab' — type it correctly so isAwaitingFinish becomes true
    typeChar(input, 'a');
    typeChar(input, 'b');

    // Finishing space completes the test
    fireEvent.change(input, { target: { value: 'ab ' } });

    expect(wordsField(container).classList.contains('words-fade-in')).toBe(true);
  });

  it('removes words-fade-in class after the fade-in duration', () => {
    vi.useFakeTimers();

    const { container } = render(<TypingTest />);
    const input = container.querySelector('input') as HTMLInputElement;

    typeChar(input, 'a');
    typeChar(input, 'b');
    fireEvent.change(input, { target: { value: 'ab ' } });

    expect(wordsField(container).classList.contains('words-fade-in')).toBe(true);

    act(() => { vi.advanceTimersByTime(FADE_IN.durationMs); });

    expect(wordsField(container).classList.contains('words-fade-in')).toBe(false);
  });
});
