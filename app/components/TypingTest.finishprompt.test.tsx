// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';

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

function finishPrompt(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[aria-label="Press space to finish"]');
}

describe('FinishPrompt — gated last word', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('is not visible before the last word is fully typed', () => {
    const { container } = render(<TypingTest />);
    expect(finishPrompt(container)).toBeNull();
  });

  it('is not visible while the last word is only partially typed', () => {
    const { container } = render(<TypingTest />);
    const input = container.querySelector('input') as HTMLInputElement;

    typeChar(input, 'a');

    expect(finishPrompt(container)).toBeNull();
  });

  it('appears once the last word is fully and correctly typed', () => {
    const { container } = render(<TypingTest />);
    const input = container.querySelector('input') as HTMLInputElement;

    typeChar(input, 'a');
    typeChar(input, 'b');

    expect(finishPrompt(container)).not.toBeNull();
  });

  it('does not advance on the last character — space is required', () => {
    const { container } = render(<TypingTest />);
    const input = container.querySelector('input') as HTMLInputElement;

    typeChar(input, 'a');
    typeChar(input, 'b');

    // Still on the only word — no completed words yet.
    expect(container.querySelectorAll('.word.completed').length).toBe(0);
    expect(container.querySelector('.word.current')).not.toBeNull();
  });

  it('disappears once space is pressed to complete the test', () => {
    const { container } = render(<TypingTest />);
    const input = container.querySelector('input') as HTMLInputElement;

    typeChar(input, 'a');
    typeChar(input, 'b');
    expect(finishPrompt(container)).not.toBeNull();

    fireEvent.change(input, { target: { value: 'ab ' } });

    expect(finishPrompt(container)).toBeNull();
  });
});
