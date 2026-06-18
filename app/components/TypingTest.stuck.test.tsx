// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import TypingTest from './TypingTest';

// Simulate ONE physical keystroke against the live DOM value. A real browser
// computes the next value from whatever is currently in the input (which, for a
// controlled input, reflects React's value restoration from the prior event),
// then fires a change. Reading input.value before each step is the whole point:
// it surfaces any drift between the DOM and React's currentInput state.
//
// Note: pressing Backspace on an empty field fires NO change event in a real
// browser. We model that faithfully by short-circuiting when there is nothing
// to delete — otherwise the test would be more forgiving than reality.
function pressKey(input: HTMLInputElement, key: string) {
  const cur = input.value;
  if (key === 'Backspace' && cur.length === 0) return; // browser: no event fires
  const next = key === 'Backspace' ? cur.slice(0, -1) : cur + key;
  fireEvent.change(input, { target: { value: next } });
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

  it('recovers after a typo on the FIRST character (the stuck-word case)', () => {
    const { container } = render(<TypingTest />);
    const input = container.querySelector('input') as HTMLInputElement;

    const word = currentWordText(container);

    // Typo on the very first character. The typed char is rejected (currentInput
    // stays empty) but the mistake is shown as an error on the first character.
    pressKey(input, wrongCharFor(word[0]));
    expect(container.querySelector('.char-error')).toBeTruthy();

    // The user mashes backspace to recover. On an empty field this fires no
    // events, so the word must NOT be permanently locked.
    for (let i = 0; i < 5; i++) pressKey(input, 'Backspace');

    // Recovery: typing the correct first character must be accepted and the word
    // must not be stuck in the errored/locked state.
    pressKey(input, word[0]);
    expect(input.value).toBe(word[0]);
    expect(isErrored(container)).toBe(false);
  });

  it('recovers after a typo mid-word followed by backspaces', () => {
    const { container } = render(<TypingTest />);
    const input = container.querySelector('input') as HTMLInputElement;

    const word = currentWordText(container);
    expect(word.length).toBeGreaterThanOrEqual(2);

    pressKey(input, word[0]);               // correct first char
    pressKey(input, wrongCharFor(word[1])); // typo on second char
    expect(isErrored(container)).toBe(true);

    // A few extra (rejected) chars, then backspace it all away.
    pressKey(input, 'z');
    pressKey(input, 'z');
    for (let i = 0; i < 8; i++) pressKey(input, 'Backspace');

    expect(input.value).toBe('');
    expect(isErrored(container)).toBe(false);
  });
});
