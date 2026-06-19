// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import TypingTest from './TypingTest';

function typeChar(input: HTMLInputElement, char: string) {
  fireEvent.change(input, { target: { value: input.value + char } });
}

function pressBackspace(input: HTMLInputElement) {
  if (input.value.length === 0) return; // real browsers fire no event on empty
  fireEvent.change(input, { target: { value: input.value.slice(0, -1) } });
}

function currentWordText(container: HTMLElement): string {
  const span = container.querySelector('.word.current');
  if (!span) throw new Error('no current word rendered');
  return (span.textContent ?? '').replace(/ /g, '');
}

function isErrored(container: HTMLElement): boolean {
  return (container.querySelector('.word.current')?.className ?? '').includes('error');
}

function wrongCharFor(expected: string): string {
  return expected === 'z' ? 'q' : 'z';
}

describe('first-character typo reds the whole word and backspace recovers it', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('reds the WHOLE word when the first character is wrong', () => {
    const { container } = render(<TypingTest />);
    const input = container.querySelector('input') as HTMLInputElement;
    const word = currentWordText(container);

    typeChar(input, wrongCharFor(word[0]));

    expect(isErrored(container)).toBe(true);
  });

  it('backspace turns the word white and typable again', () => {
    const { container } = render(<TypingTest />);
    const input = container.querySelector('input') as HTMLInputElement;
    const word = currentWordText(container);

    typeChar(input, wrongCharFor(word[0]));
    expect(isErrored(container)).toBe(true);

    pressBackspace(input);
    expect(isErrored(container)).toBe(false);

    // …and the correct first char now registers.
    typeChar(input, word[0]);
    expect(input.value).toBe(word[0]);
    expect(isErrored(container)).toBe(false);
  });
});
