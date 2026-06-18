// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, cleanup, screen } from '@testing-library/react';
import React from 'react';
import TypingTest from './TypingTest';

function typeChar(input: HTMLInputElement, char: string) {
  fireEvent.change(input, { target: { value: input.value + char } });
}

function currentWordText(container: HTMLElement): string {
  const span = container.querySelector('.word.current');
  if (!span) throw new Error('no current word rendered');
  // Strip the trailing space / non-breaking space added by the trailing char span
  return (span.textContent ?? '').replace(/[ \u00A0]/g, '');
}

function completedWordCount(container: HTMLElement): number {
  return container.querySelectorAll('.word.completed').length;
}

describe('WPM target editor in TypingTest', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('changing WPM target does not reset the live test', () => {
    const { container } = render(<TypingTest />);
    const input = container.querySelector('input') as HTMLInputElement;

    // Type the first word correctly then advance with space
    const firstWord = currentWordText(container);
    for (const char of firstWord) {
      typeChar(input, char);
    }
    fireEvent.change(input, { target: { value: firstWord + ' ' } });

    // One word should now be marked completed
    expect(completedWordCount(container)).toBe(1);

    // Change WPM via the Sidebar editor
    fireEvent.click(screen.getByText(/\d+ wpm/));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: 'set' }));

    // Test must NOT have reset — completed word count must still be 1
    expect(completedWordCount(container)).toBe(1);
  });

  it('new WPM target is persisted to localStorage on submit', () => {
    render(<TypingTest />);

    fireEvent.click(screen.getByText(/\d+ wpm/));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '75' } });
    fireEvent.click(screen.getByRole('button', { name: 'set' }));

    const stored = JSON.parse(window.localStorage.getItem('bottom10_data') ?? '{}');
    expect(stored.wpmTarget).toBe(75);
  });

  it('Sidebar displays updated WPM target immediately after change', () => {
    render(<TypingTest />);

    fireEvent.click(screen.getByText(/\d+ wpm/));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: 'set' }));

    expect(screen.getByText('90 wpm')).toBeTruthy();
  });
});
