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

describe('Sidebar untouched section', () => {
  // 15 words; WORKING_SET_SIZE=10 → 5 untouched when stats are empty
  const allWords = ['the', 'of', 'and', 'a', 'to', 'in', 'is', 'you', 'that', 'it', 'he', 'was', 'for', 'on', 'are'];

  const renderSidebar = (wordStats: Record<string, WordStats> = {}, words = allWords) =>
    render(
      <Sidebar
        isOpen={true}
        wordStats={wordStats}
        allWords={words}
        toggleSidebar={() => {}}
        onWpmChange={() => {}}
        wpmTarget={75}
      />
    );

  it('shows untouched count', () => {
    renderSidebar();
    // 5 untouched words (indices 10-14 in allWords)
    expect(screen.getByText(/5 untouched/i)).toBeTruthy();
  });

  it('shows next-up peek words in allWords order by default', () => {
    renderSidebar();
    // indices 10, 11, 12 in allWords not in working set: 'he', 'was', 'for'
    expect(screen.getByText('he')).toBeTruthy();
    expect(screen.getByText('was')).toBeTruthy();
    expect(screen.getByText('for')).toBeTruthy();
  });

  it('does not show words beyond the peek by default (collapsed)', () => {
    renderSidebar();
    // 'on' and 'are' are at indices 13,14 — beyond peek of 3
    expect(screen.queryByText('on')).toBeNull();
    expect(screen.queryByText('are')).toBeNull();
  });

  it('has a connector hint that words enter when a slot frees', () => {
    renderSidebar();
    expect(screen.getByText(/slot frees/i)).toBeTruthy();
  });

  it('expands to show more untouched words when expand button is clicked', () => {
    renderSidebar();
    fireEvent.click(screen.getByTestId('untouched-expand'));
    expect(screen.getByText('on')).toBeTruthy();
    expect(screen.getByText('are')).toBeTruthy();
  });

  it('collapses back to peek after clicking collapse button', () => {
    renderSidebar();
    fireEvent.click(screen.getByTestId('untouched-expand'));
    fireEvent.click(screen.getByTestId('untouched-collapse'));
    expect(screen.queryByText('on')).toBeNull();
    expect(screen.queryByText('are')).toBeNull();
  });

  it('count excludes untouched words already in the working set (padding)', () => {
    // With 2 scored words, 8 untouched get padded into working set → 5 remain untouched
    const wordStats = {
      the: makeStats({ lastScore: 200 }),
      of:  makeStats({ lastScore: 300 }),
    };
    renderSidebar(wordStats);
    // WORKING_SET_SIZE=10, 2 scored + 8 padded = 10 in working set → 5 left untouched
    expect(screen.getByText(/5 untouched/i)).toBeTruthy();
  });

  it('hides the untouched section entirely when count is 0', () => {
    // All words in working set (only 5 words total, WORKING_SET_SIZE=10)
    const fiveWords = ['the', 'of', 'and', 'a', 'to'];
    renderSidebar({}, fiveWords);
    expect(screen.queryByText(/untouched/i)).toBeNull();
  });
});

describe('Sidebar collapsed state', () => {
  const allWords = ['the', 'of', 'and'];

  it('hides pipeline content when isOpen is false', () => {
    render(
      <Sidebar
        isOpen={false}
        wordStats={{}}
        allWords={allWords}
        toggleSidebar={() => {}}
        onWpmChange={() => {}}
        wpmTarget={75}
      />
    );
    expect(screen.queryByText('Current ten')).toBeNull();
  });

  it('still renders the toggle button when closed', () => {
    render(
      <Sidebar
        isOpen={false}
        wordStats={{}}
        allWords={allWords}
        toggleSidebar={() => {}}
        onWpmChange={() => {}}
        wpmTarget={75}
      />
    );
    expect(screen.getByText('→')).toBeTruthy();
  });
});

describe('Sidebar movement indicators', () => {
  const renderWithStats = (wordStats: Record<string, WordStats>) =>
    render(
      <Sidebar
        isOpen={true}
        wordStats={wordStats}
        allWords={['the']}
        toggleSidebar={() => {}}
        onWpmChange={() => {}}
        wpmTarget={75}
      />
    );

  it('shows ↑ indicator when word improved (lastScore < prevScore)', () => {
    const { container } = renderWithStats({
      the: makeStats({ lastScore: 150, prevScore: 200 }),
    });
    const indicator = container.querySelector('[data-testid="movement-up"]');
    expect(indicator).not.toBeNull();
    expect(indicator?.textContent).toBe('↑');
  });

  it('shows ↓ indicator when word regressed (lastScore > prevScore)', () => {
    const { container } = renderWithStats({
      the: makeStats({ lastScore: 250, prevScore: 200 }),
    });
    const indicator = container.querySelector('[data-testid="movement-down"]');
    expect(indicator).not.toBeNull();
    expect(indicator?.textContent).toBe('↓');
  });

  it('shows no movement indicator when no prevScore (first attempt)', () => {
    const { container } = renderWithStats({
      the: makeStats({ lastScore: 200 }),
    });
    expect(container.querySelector('[data-testid="movement-up"]')).toBeNull();
    expect(container.querySelector('[data-testid="movement-down"]')).toBeNull();
  });

  it('shows no movement indicator for unscored (untouched) words', () => {
    const { container } = renderWithStats({
      the: makeStats({ lastScore: 0 }),
    });
    expect(container.querySelector('[data-testid="movement-up"]')).toBeNull();
    expect(container.querySelector('[data-testid="movement-down"]')).toBeNull();
  });
});

describe('Sidebar graduated section', () => {
  // allWords has 10 words so the working set fills with untouched when some are graduated
  const allWords = ['the', 'of', 'and', 'a', 'to', 'in', 'is', 'you', 'that', 'it'];

  const makeGraduated = (lastScore: number): Partial<WordStats> => ({
    lastScore,
    consecutiveSubThreshold: 2, // GRADUATION_STREAK = 2
  });

  const renderSidebar = (wordStats: Record<string, WordStats> = {}) =>
    render(
      <Sidebar
        isOpen={true}
        wordStats={wordStats}
        allWords={allWords}
        toggleSidebar={() => {}}
        onWpmChange={() => {}}
        wpmTarget={75}
      />
    );

  it('shows graduated count when words are graduated', () => {
    const wordStats = {
      the: makeStats(makeGraduated(120)),
      of:  makeStats(makeGraduated(200)),
    };
    renderSidebar(wordStats);
    expect(screen.getByText(/2 graduated/i)).toBeTruthy();
  });

  it('hides the graduated section entirely when no words are graduated', () => {
    renderSidebar({});
    expect(screen.queryByText(/graduated/i)).toBeNull();
  });

  it('shows peek words (best-first) in collapsed state', () => {
    const wordStats = {
      the: makeStats(makeGraduated(100)), // best (lowest score)
      of:  makeStats(makeGraduated(120)),
      and: makeStats(makeGraduated(140)),
      a:   makeStats(makeGraduated(160)),
      to:  makeStats(makeGraduated(180)), // worst
    };
    renderSidebar(wordStats);
    // 'the' is the best (lowest score), should appear in peek
    expect(screen.getByText('the')).toBeTruthy();
  });

  it('does not show words beyond GRADUATED_PEEK by default (collapsed)', () => {
    const wordStats = {
      the: makeStats(makeGraduated(100)),
      of:  makeStats(makeGraduated(120)),
      and: makeStats(makeGraduated(140)),
      a:   makeStats(makeGraduated(160)),
      to:  makeStats(makeGraduated(180)),
    };
    renderSidebar(wordStats);
    // 'a' and 'to' are beyond GRADUATED_PEEK=3 in best-first order
    expect(screen.queryByText('a')).toBeNull();
    expect(screen.queryByText('to')).toBeNull();
  });

  it('has a connector hint indicating words graduate at target pace', () => {
    const wordStats = {
      the: makeStats(makeGraduated(120)),
    };
    renderSidebar(wordStats);
    expect(screen.getByText(/target pace/i)).toBeTruthy();
  });

  it('expands to show all graduated words when expand button is clicked', () => {
    const wordStats = {
      the: makeStats(makeGraduated(100)),
      of:  makeStats(makeGraduated(120)),
      and: makeStats(makeGraduated(140)),
      a:   makeStats(makeGraduated(160)),
      to:  makeStats(makeGraduated(180)),
    };
    renderSidebar(wordStats);
    fireEvent.click(screen.getByTestId('graduated-expand'));
    expect(screen.getByText('a')).toBeTruthy();
    expect(screen.getByText('to')).toBeTruthy();
  });

  it('collapses back to peek after clicking collapse button', () => {
    const wordStats = {
      the: makeStats(makeGraduated(100)),
      of:  makeStats(makeGraduated(120)),
      and: makeStats(makeGraduated(140)),
      a:   makeStats(makeGraduated(160)),
      to:  makeStats(makeGraduated(180)),
    };
    renderSidebar(wordStats);
    fireEvent.click(screen.getByTestId('graduated-expand'));
    fireEvent.click(screen.getByTestId('graduated-collapse'));
    expect(screen.queryByText('a')).toBeNull();
    expect(screen.queryByText('to')).toBeNull();
  });
});
