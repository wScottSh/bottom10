// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import Sidebar from './Sidebar';
import { WordStats } from '../utils/wordUtils';

const makeStats = (overrides: Partial<WordStats> = {}): WordStats => ({
  word: '',
  time: 0,
  attempts: 0,
  lastScore: 0,
  consecutiveSubThreshold: 0,
  ...overrides,
});

describe('Sidebar current ten', () => {
  const allWords = ['the', 'of', 'and', 'a', 'to', 'in', 'is', 'you', 'that', 'it', 'he'];

  it('is labeled "Current ten"', () => {
    render(
      <Sidebar
        isOpen={true}
        wordStats={{}}
        allWords={allWords}
        toggleSidebar={() => {}}
        onWpmChange={() => {}}
        wpmTarget={75}
      />
    );
    expect(screen.getByText('Current ten')).toBeTruthy();
  });

  it('displays worst-first (highest score at top)', () => {
    const wordStats = {
      the: makeStats({ lastScore: 120 }),  // 100 wpm — best
      of:  makeStats({ lastScore: 300 }),  // 40 wpm  — worst
      and: makeStats({ lastScore: 200 }),  // 60 wpm  — medium
    };
    const { container } = render(
      <Sidebar
        isOpen={true}
        wordStats={wordStats}
        allWords={allWords}
        toggleSidebar={() => {}}
        onWpmChange={() => {}}
        wpmTarget={75}
      />
    );
    // Each li has a <div><span>word</span>...</div>; read the first span of each li
    const wordSpans = Array.from(container.querySelectorAll('li span:first-child'));
    const renderedWords = wordSpans.map(s => s.textContent?.trim());
    const ofIdx  = renderedWords.indexOf('of');
    const andIdx = renderedWords.indexOf('and');
    const theIdx = renderedWords.indexOf('the');
    expect(ofIdx).toBeGreaterThanOrEqual(0);
    expect(ofIdx).toBeLessThan(andIdx);
    expect(andIdx).toBeLessThan(theIdx);
  });

  it('does not render an <hr> divider after the 10th row', () => {
    const wordStats: Record<string, WordStats> = {};
    // Create 12 scored words to trigger the old divider
    ['w1','w2','w3','w4','w5','w6','w7','w8','w9','w10','w11','w12'].forEach((w, i) => {
      wordStats[w] = makeStats({ lastScore: (i + 1) * 50 });
    });
    const { container } = render(
      <Sidebar
        isOpen={true}
        wordStats={wordStats}
        allWords={Object.keys(wordStats)}
        toggleSidebar={() => {}}
        onWpmChange={() => {}}
        wpmTarget={75}
      />
    );
    expect(container.querySelector('hr')).toBeNull();
  });
});

describe('Sidebar graduation progress', () => {
  const renderWithWord = (statsOverrides: Partial<WordStats>, wpmTarget = 75) =>
    render(
      <Sidebar
        isOpen={true}
        wordStats={{ the: makeStats(statsOverrides) }}
        allWords={['the']}
        toggleSidebar={() => {}}
        onWpmChange={() => {}}
        wpmTarget={wpmTarget}
      />
    );

  it('shows one filled pip for consecutiveSubThreshold=1', () => {
    const { container } = renderWithWord({ lastScore: 150, consecutiveSubThreshold: 1 });
    expect(container.querySelectorAll('[data-testid="pip-filled"]').length).toBe(1);
    expect(container.querySelectorAll('[data-testid="pip-empty"]').length).toBe(1);
  });

  it('shows no filled pips for consecutiveSubThreshold=0', () => {
    const { container } = renderWithWord({ lastScore: 150, consecutiveSubThreshold: 0 });
    expect(container.querySelectorAll('[data-testid="pip-filled"]').length).toBe(0);
    expect(container.querySelectorAll('[data-testid="pip-empty"]').length).toBe(2);
  });

  it('applies distinct candidate highlight when one test from graduating', () => {
    // consecutiveSubThreshold === GRADUATION_STREAK - 1 → isCandidate=true
    const { container } = renderWithWord({ lastScore: 150, consecutiveSubThreshold: 1 });
    const wordSpan = container.querySelector('li span:first-child');
    expect(wordSpan?.className).toContain('cyan');
  });

  it('does not render wpm bar for unscored word (lastScore=0)', () => {
    const { container } = renderWithWord({ lastScore: 0 });
    expect(container.querySelector('[data-testid="wpm-bar"]')).toBeNull();
  });

  it('renders wpm bar for scored word', () => {
    const { container } = renderWithWord({ lastScore: 150 });
    expect(container.querySelector('[data-testid="wpm-bar"]')).not.toBeNull();
  });
});

describe('Sidebar wpmTarget prop', () => {
  const allWords = ['the', 'of', 'and'];

  it('displays the wpmTarget prop value', () => {
    render(
      <Sidebar
        isOpen={true}
        wordStats={{}}
        allWords={allWords}
        toggleSidebar={() => {}}
        onWpmChange={() => {}}
        wpmTarget={75}
      />
    );
    expect(screen.getByText('75 wpm')).toBeTruthy();
  });

  it('displays a different wpmTarget when the prop changes', () => {
    const { rerender } = render(
      <Sidebar
        isOpen={true}
        wordStats={{}}
        allWords={allWords}
        toggleSidebar={() => {}}
        onWpmChange={() => {}}
        wpmTarget={40}
      />
    );
    expect(screen.getByText('40 wpm')).toBeTruthy();

    rerender(
      <Sidebar
        isOpen={true}
        wordStats={{}}
        allWords={allWords}
        toggleSidebar={() => {}}
        onWpmChange={() => {}}
        wpmTarget={80}
      />
    );
    expect(screen.getByText('80 wpm')).toBeTruthy();
  });

  it('calls onWpmChange with the submitted value when the user edits WPM', () => {
    const onWpmChange = vi.fn();
    render(
      <Sidebar
        isOpen={true}
        wordStats={{}}
        allWords={allWords}
        toggleSidebar={() => {}}
        onWpmChange={onWpmChange}
        wpmTarget={40}
      />
    );

    fireEvent.click(screen.getByText('40 wpm'));
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '60' } });
    fireEvent.click(screen.getByText('set'));

    expect(onWpmChange).toHaveBeenCalledWith(60);
  });
});
