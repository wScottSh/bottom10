'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import wordList from '../data/wordList';
import Sidebar from './Sidebar';
import GraduatedSidebar from './GraduatedSidebar';
import WpmParticles, { WpmParticlesHandle } from './WpmParticles';
import { generateWordSet, computeWpmParticle, applySessionToStats, TypedWord, WordStats } from '../utils/wordUtils';
import { CompletedWordOutcome } from '../utils/typingSession';
import { resetAppData } from '../utils/persistence';
import { usePersistedWpmTarget } from '../hooks/usePersistedWpmTarget';
import { usePersistedWordStats } from '../hooks/usePersistedWordStats';
import { useTypingSession } from '../hooks/useTypingSession';

function createInitialWordStats(): Record<string, WordStats> {
  return wordList.reduce((acc, word) => ({
    ...acc,
    [word]: { word, time: 0, attempts: 0, lastScore: 0 }
  }), {} as Record<string, WordStats>);
}

const INITIAL_WORD_STATS = createInitialWordStats();

export default function TypingTest() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [globalWordStats, setGlobalWordStats] = usePersistedWordStats(INITIAL_WORD_STATS);
  const [wpmTarget, setWpmTarget] = usePersistedWpmTarget();

  const [isGraduatedSidebarOpen, setIsGraduatedSidebarOpen] = useState(true);
  const [words, setWords] = useState<string[]>([]);
  const { session, applyKeystroke, reset: resetSession } = useTypingSession();
  const [correctWords, setCorrectWords] = useState<number>(0);
  const [testEnded, setTestEnded] = useState<boolean>(false);
  const [typedWordsData, setTypedWordsData] = useState<TypedWord[]>([]);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wordsContainerRef = useRef<HTMLDivElement>(null);
  const wordSpanRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const wpmParticlesRef = useRef<WpmParticlesHandle>(null);
  const [wordCount, setWordCount] = useState<number>(50);

  // Load a freshly generated word set and reset all per-test state.
  const startTestWithWords = useCallback((newWords: string[]) => {
    if (newWords.length === 0) return;
    setWords(newWords);
    setCorrectWords(0);
    setTypedWordsData([]);
    setTestEnded(false);
    resetSession();
    inputRef.current?.focus();
  }, []);

  const startNewTest = useCallback(() => {
    startTestWithWords(generateWordSet(wordCount, globalWordStats, wordList));
  }, [wordCount, globalWordStats, startTestWithWords]);

  useEffect(() => {
    startNewTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (testEnded && e.key === 'Enter') {
        startNewTest();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [testEnded, startNewTest]);

  // Consumes a completed-word outcome from the reducer: measures the word span's
  // bounding rect and spawns a WPM particle. Timing is owned by the reducer.
  const recordCompletedWord = (outcome: CompletedWordOutcome, wordIndex: number) => {
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

    setTypedWordsData(prev => [
      ...prev,
      { word: outcome.word, time: outcome.elapsed, errors: 0 }
    ]);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (testEnded) return;

    const value = e.target.value;
    const currentWord = words[session.currentWordIndex];
    const timestamp = Date.now();

    if (!currentWord) {
      finishTest();
      return;
    }

    const isLastWord = session.currentWordIndex + 1 === words.length;
    const wordIndex = session.currentWordIndex;

    const completedWord = applyKeystroke(value, words, timestamp);

    if (completedWord) {
      recordCompletedWord(completedWord, wordIndex);
      // Finishing the last word ends the test; startTestWithWords resets all state.
      if (isLastWord) {
        finishTest();
        return;
      }
      setCorrectWords(correctWords + 1);
    }
  };

  const finishTest = () => {
    const updatedStats = applySessionToStats(globalWordStats, typedWordsData, wpmTarget);
    const newWords = generateWordSet(wordCount, updatedStats, wordList);

    setGlobalWordStats(updatedStats);
    startTestWithWords(newWords);
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
    startTestWithWords(generateWordSet(wordCount, freshStats, wordList));
  };

  return (
    <>
      {renderHeader()}
      <Sidebar
        isOpen={isSidebarOpen}
        wordStats={globalWordStats}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onWpmChange={handleWpmChange}
        wpmTarget={wpmTarget}
      />
      <GraduatedSidebar
        isOpen={isGraduatedSidebarOpen}
        wordStats={globalWordStats}
        toggleSidebar={() => setIsGraduatedSidebarOpen(!isGraduatedSidebarOpen)}
      />
      <div className={`flex-1 min-h-screen flex items-center transition-all duration-300
        ${isSidebarOpen ? 'ml-64' : ''}
        ${isGraduatedSidebarOpen ? 'mr-64' : ''}`}
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
            className="w-full px-8 relative text-2xl min-h-[120px] leading-relaxed"
          >
            <WpmParticles ref={wpmParticlesRef} />
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
