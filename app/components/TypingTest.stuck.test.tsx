// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import TypingTest from './TypingTest';

function typeChar(input: HTMLInputElement, char: string) {
  fireEvent.change(input, { target: { value: input.value + char } });
}

function pressBackspace(input: HTMLInputElement) {
  if (input.value.length === 0) return;
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

describe('stuck word after error + backspace (issue #27)', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('recovers after a typo on the first character (the stuck-word case)', () => {
    const { container } = render(<TypingTest />);
    const input = container.querySelector('input') as HTMLInputElement;

    const word = currentWordText(container);

    typeChar(input, wrongCharFor(word[0]));
    expect(input.value).toBe('');
    expect(container.querySelector('.char-error')).toBeTruthy();

    for (let i = 0; i < 5; i++) pressBackspace(input);

    typeChar(input, word[0]);
    expect(input.value).toBe(word[0]);
    expect(isErrored(container)).toBe(false);
  });

  it('recovers after a typo mid-word followed by backspaces', () => {
    const { container } = render(<TypingTest />);
    const input = container.querySelector('input') as HTMLInputElement;

    const word = currentWordText(container);
    expect(word.length).toBeGreaterThanOrEqual(2);

    typeChar(input, word[0]);
    typeChar(input, wrongCharFor(word[1]));
    expect(isErrored(container)).toBe(true);

    typeChar(input, 'z');
    typeChar(input, 'z');
    for (let i = 0; i < 8; i++) pressBackspace(input);

    expect(input.value).toBe('');
    expect(isErrored(container)).toBe(false);
  });
});
