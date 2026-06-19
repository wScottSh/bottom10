'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import wordList from '../data/wordList';
import Sidebar from './Sidebar';
import WpmParticles, { WpmParticlesHandle } from './WpmParticles';
import DetonationParticles, { DetonationHandle, DetonationLetter } from './DetonationParticles';
import FinishPrompt from './FinishPrompt';
import { computeWpmParticle, WordStats } from '../utils/wordUtils';
import { generateWordSet } from '../utils/wordGeneration';
import { CompletedWordOutcome, isAwaitingFinish } from '../utils/typingSession';
import { shakeIntensity } from '../utils/shake';
import { TENSION_SHAKE, DETONATION } from '../utils/juiceConfig';
import { resetAppData } from '../utils/persistence';
import { usePersistedProgress } from '../hooks/usePersistedProgress';
import { useTestOrchestration } from '../hooks/useTestOrchestration';
import { ClockLike, WALL_CLOCK } from '../utils/clock';

function createInitialWordStats(): Record<string, WordStats> {
  return wordList.reduce((acc, word) => ({
    ...acc,
    [word]: { word, time: 0, attempts: 0, lastScore: 0 }
  }), {} as Record<string, WordStats>);
}

const INITIAL_WORD_STATS = createInitialWordStats();

export default function TypingTest({ clock = WALL_CLOCK }: { clock?: ClockLike } = {}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { wordStats: globalWordStats, setWordStats: setGlobalWordStats, wpmTarget, setWpmTarget } = usePersistedProgress(INITIAL_WORD_STATS);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wordsContainerRef = useRef<HTMLDivElement>(null);
  const wordSpanRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const wpmParticlesRef = useRef<WpmParticlesHandle>(null);
  const detonationRef = useRef<DetonationHandle>(null);
  const [isPunching, setIsPunching] = useState(false);

  const {
    words,
    wordCount,
    setWordCount,
    session,
    handleKeystroke,
    startWithWords,
    newlyGraduated,
  } = useTestOrchestration({
    globalWordStats,
    setGlobalWordStats,
    wpmTarget,
    allWords: wordList,
    clock,
  });

  // Focus the hidden input whenever a new word set loads (mount and after every restart).
  useEffect(() => {
    if (words.length > 0) inputRef.current?.focus();
  }, [words]);

  // Collects the viewport position of each non-space .char span in the words container.
  const snapshotLetters = useCallback((): DetonationLetter[] => {
    const container = wordsContainerRef.current;
    if (!container) return [];
    return Array.from(container.querySelectorAll('.char'))
      .map(span => {
        const text = span.textContent ?? '';
        const rect = span.getBoundingClientRect();
        return { char: text, x: rect.left, y: rect.top };
      })
      .filter(l => l.char.trim() !== '');
  }, []);

  // Spawns a WPM particle above the word span for a completed word.
  const spawnParticle = (outcome: CompletedWordOutcome, wordIndex: number) => {
    const wordSpan = wordSpanRefs.current[wordIndex];
    const container = wordsContainerRef.current;
    if (wordSpan && container && wpmParticlesRef.current) {
      const wordRect = wordSpan.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const x = wordRect.left - containerRect.left + wordRect.width / 2;
      const y = wordRect.top - containerRect.top;
      const { wpm, isFast } = computeWpmParticle(outcome.elapsed, outcome.word.length, wpmTarget);
      wpmParticlesRef.current.spawn(x, y, wpm, isFast);
    }
  };

  const intensity = shakeIntensity(session.currentWordIndex, words.length);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const wordIndex = session.currentWordIndex;
    const newValue = e.target.value;

    // Snapshot and detonate when the finishing space is pressed.
    if (isAwaitingFinish(session, words) && newValue.endsWith(' ')) {
      const letters = snapshotLetters();
      detonationRef.current?.detonate(letters);
      if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        setIsPunching(true);
        setTimeout(() => setIsPunching(false), DETONATION.punchDurationMs + 50);
      }
    }

    const completed = handleKeystroke(newValue);
    if (completed) spawnParticle(completed, wordIndex);
  };

  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };

  const handleWordCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const count = parseInt(e.target.value);
    setWordCount(Math.max(10, Math.min(count, 200)));
  };

  const renderHeader = () => (
    <div className="fixed top-4 right-4 z-10">
      <button onClick={toggleSettings}>
        ⚙️ Settings
      </button>
    </div>
  );

  const handleWpmChange = (wpm: number) => {
    setWpmTarget(wpm);
  };

  // Class for a word span: the current word turns red once it's errored,
  // already-typed words are marked completed, and upcoming words get nothing.
  const getWordClassName = (wordIndex: number) => {
    if (wordIndex === session.currentWordIndex) {
      return session.isWordErrored ? 'current error' : 'current';
    }
    return wordIndex < session.currentWordIndex ? 'completed' : '';
  };

  const handleResetProgress = () => {
    resetAppData();
    const freshStats = createInitialWordStats();
    setGlobalWordStats(freshStats);
    startWithWords(generateWordSet(wordCount, freshStats, wordList));
  };

  return (
    <>
      {renderHeader()}
      <Sidebar
        isOpen={isSidebarOpen}
        wordStats={globalWordStats}
        allWords={wordList}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onWpmChange={handleWpmChange}
        wpmTarget={wpmTarget}
        newlyGraduated={newlyGraduated}
      />
      <div className={`flex-1 min-h-screen flex items-center transition-all duration-300
        ${isSidebarOpen ? 'ml-64' : ''}`}
      >
        <div className="flex flex-col items-center gap-4 w-full px-16" onClick={() => inputRef.current?.focus()}>
          <div className="flex items-center justify-between w-full px-8">
            <div className="text-xl">
              {session.testStarted ? 'Typing...' : 'Type to start'}
            </div>
            <button onClick={toggleSettings}>
              {showSettings ? 'Hide Settings' : 'Show Settings'}
            </button>
          </div>
          {showSettings && (
            <div className="mb-4 flex flex-col gap-2">
              <label>
                Words per test:
                <input
                  type="number"
                  value={wordCount}
                  onChange={handleWordCountChange}
                  min="10"
                  max="200"
                  className="ml-2 w-20 p-1 bg-gray-700 text-white rounded"
                />
              </label>
              <button
                onClick={handleResetProgress}
                className="mt-2 px-3 py-1 bg-red-700 hover:bg-red-600 text-white rounded text-sm"
              >
                Reset progress
              </button>
            </div>
          )}
          <div
            ref={wordsContainerRef}
            className={`w-full px-8 relative text-2xl min-h-[120px] leading-relaxed${isPunching ? ' detonation-punch-active' : ''}`}
            style={{
              '--shake-intensity': intensity,
              '--tension-shake-translate-max': `${TENSION_SHAKE.maxTranslatePx}px`,
              '--tension-shake-rotate-max': `${TENSION_SHAKE.maxRotateDeg}deg`,
              '--tension-shake-duration': `${TENSION_SHAKE.jitterDurationMs}ms`,
              '--det-punch-duration': `${DETONATION.punchDurationMs}ms`,
            } as React.CSSProperties}
          >
            <WpmParticles ref={wpmParticlesRef} />
            <DetonationParticles ref={detonationRef} />
            {words.map((word, wordIndex) => (
              <span
                key={wordIndex}
                ref={el => { wordSpanRefs.current[wordIndex] = el; }}
                className={`word ${getWordClassName(wordIndex)}`}
              >
                {word.split('').map((char, charIndex) => {
                  let charClass = '';
                  if (wordIndex === session.currentWordIndex) {
                    if (!session.isWordErrored && charIndex < session.currentCharIndex) charClass = 'char-correct';
                    else if (charIndex === session.currentCharIndex && session.hasError) charClass = 'char-error';
                  }
                  return (
                    <span
                      key={charIndex}
                      className={`char relative pb-[0.3em] ${charClass}`}
                    >
                      {char}
                      {wordIndex === session.currentWordIndex &&
                      charIndex === session.currentCharIndex && (
                        <span className="absolute left-0 bottom-[0.15em] w-full h-[2px] bg-[#e2b714] transition-all duration-[50ms] ease-out" />
                      )}
                    </span>
                  );
                })}
                <span className="char relative pb-[0.3em]">
                  {' '}
                  {wordIndex === session.currentWordIndex &&
                  word.length === session.currentCharIndex && (
                    <span className="absolute left-0 bottom-[0.15em] w-full h-[2px] bg-[#e2b714] transition-all duration-[50ms] ease-out" />
                  )}
                </span>{/* Remove whitespace here */}
              </span>
            ))}{/* Remove whitespace here */}
          </div>
          <FinishPrompt visible={isAwaitingFinish(session, words)} />
          <input
            ref={inputRef}
            type="text"
            value={session.currentInput}
            onChange={handleInput}
            className="opacity-0 absolute"
            autoFocus
          />
        </div>
      </div>
    </>
  );
}
