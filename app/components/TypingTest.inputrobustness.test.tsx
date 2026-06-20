// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';

// Deterministic word set so the DOM-level input behavior is reproducible.
vi.mock('../utils/wordGeneration', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/wordGeneration')>();
  return { ...actual, generateWordSet: () => ['cat', 'dog'] };
});

import TypingTest from './TypingTest';

function setValue(input: HTMLInputElement, value: string) {
  fireEvent.change(input, { target: { value } });
}
function typeChar(input: HTMLInputElement, char: string) {
  setValue(input, input.value + char);
}
function pressBackspace(input: HTMLInputElement) {
  if (input.value.length === 0) return; // real browsers fire no event on empty
  setValue(input, input.value.slice(0, -1));
}
function isErrored(c: HTMLElement): boolean {
  return (c.querySelector('.word.current')?.className ?? '').includes('error');
}
function currentIndex(c: HTMLElement): number {
  return Array.from(c.querySelectorAll('.word')).findIndex(w => w.className.includes('current'));
}

describe('TypingTest input robustness (DOM seam)', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('Bug 1: a stray letter after a complete word blocks space from advancing', () => {
    const { container } = render(<TypingTest />);
    const input = container.querySelector('input') as HTMLInputElement;

    for (const ch of 'cat') typeChar(input, ch);
    expect(currentIndex(container)).toBe(0);

    typeChar(input, 'x'); // stray letter -> word reds
    expect(isErrored(container)).toBe(true);

    typeChar(input, ' '); // space must NOT advance an errored word
    expect(currentIndex(container)).toBe(0);
    expect(isErrored(container)).toBe(true);
  });

  it('Bug 2: a mid-word typo is kept and ONE backspace restores the correct prefix', () => {
    const { container } = render(<TypingTest />);
    const input = container.querySelector('input') as HTMLInputElement;

    typeChar(input, 'c');
    typeChar(input, 'a');
    typeChar(input, 'z'); // wrong 3rd char (expected 't')
    expect(input.value).toBe('caz'); // the typo is kept, not swallowed
    expect(isErrored(container)).toBe(true);

    pressBackspace(input); // a single backspace
    expect(input.value).toBe('ca'); // back exactly one char, not thrown to the start
    expect(isErrored(container)).toBe(false); // correct prefix -> no longer red
  });

  it('pasting the correct word is accepted, not marked wrong', () => {
    const { container } = render(<TypingTest />);
    const input = container.querySelector('input') as HTMLInputElement;
    setValue(input, 'cat'); // paste / chord the whole word
    expect(isErrored(container)).toBe(false);
    expect(input.value).toBe('cat');
  });

  it('an atomic "word + space" paste does not instantly complete the word', () => {
    const { container } = render(<TypingTest />);
    const input = container.querySelector('input') as HTMLInputElement;
    setValue(input, 'cat '); // would have cheat-completed under the old code
    expect(currentIndex(container)).toBe(0);
    expect(input.value).toBe('cat'); // space stripped, content landed, awaiting a real space
  });

  it('select-all then replace with a wrong char is validated as wrong', () => {
    const { container } = render(<TypingTest />);
    const input = container.querySelector('input') as HTMLInputElement;
    for (const ch of 'cat') typeChar(input, ch);
    setValue(input, 'x'); // select-all + type 'x'
    expect(isErrored(container)).toBe(true);
  });

  it('the controlled input never diverges: its value tracks session state exactly', () => {
    const { container } = render(<TypingTest />);
    const input = container.querySelector('input') as HTMLInputElement;
    typeChar(input, 'c');
    typeChar(input, 'a');
    typeChar(input, 'z'); // errored
    typeChar(input, 'q'); // keep typing while errored
    // Field shows exactly what the session holds — capped at word + extras, no phantom buffer.
    expect(input.value).toBe('cazq');
    expect(isErrored(container)).toBe(true);
  });

  it('a full clean run still completes and starts a fresh test', () => {
    const { container } = render(<TypingTest />);
    const input = container.querySelector('input') as HTMLInputElement;
    setValue(input, 'cat');   // type word 1 (starts clock)
    setValue(input, 'cat ');  // space advances
    expect(currentIndex(container)).toBe(1);
    setValue(input, 'dog');
    setValue(input, 'dog ');  // completes last word -> restart
    // After the last word a new set loads; we are back to a fresh first word.
    expect(currentIndex(container)).toBe(0);
  });
});
