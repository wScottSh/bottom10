// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';

vi.mock('../data/wordList', () => ({ default: ['ab'] }));
vi.mock('../utils/wordGeneration', () => ({
  generateWordSet: () => ['ab'],
  getTopWordsForTest: () => [],
  WORKING_SET_SIZE: 10,
}));

import { vi } from 'vitest';
import TypingTest from './TypingTest';

function getKeyboardStrip(container: HTMLElement): Element | null {
  return container.querySelector('.keyboard-layout-strip');
}

function getShowLayoutCheckbox(container: HTMLElement): HTMLInputElement | null {
  return container.querySelector('input[type="checkbox"][data-testid="show-keyboard-layout"]');
}

function openSettings(container: HTMLElement) {
  const btn = Array.from(container.querySelectorAll('button')).find(b =>
    b.textContent?.includes('Settings')
  );
  if (!btn) throw new Error('Settings button not found');
  fireEvent.click(btn);
}

describe('keyboard layout toggle in Settings', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('keyboard layout strip is hidden by default', () => {
    const { container } = render(<TypingTest />);
    expect(getKeyboardStrip(container)).toBeNull();
  });

  it('Settings panel contains a Show keyboard layout checkbox', () => {
    const { container } = render(<TypingTest />);
    openSettings(container);
    expect(getShowLayoutCheckbox(container)).not.toBeNull();
  });

  it('checkbox is unchecked by default', () => {
    const { container } = render(<TypingTest />);
    openSettings(container);
    const checkbox = getShowLayoutCheckbox(container) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it('checking the box shows the keyboard layout strip', () => {
    const { container } = render(<TypingTest />);
    openSettings(container);
    const checkbox = getShowLayoutCheckbox(container) as HTMLInputElement;

    fireEvent.click(checkbox);

    expect(getKeyboardStrip(container)).not.toBeNull();
  });

  it('unchecking the box hides the keyboard layout strip', () => {
    const { container } = render(<TypingTest />);
    openSettings(container);
    const checkbox = getShowLayoutCheckbox(container) as HTMLInputElement;

    fireEvent.click(checkbox);
    expect(getKeyboardStrip(container)).not.toBeNull();

    fireEvent.click(checkbox);
    expect(getKeyboardStrip(container)).toBeNull();
  });
});
