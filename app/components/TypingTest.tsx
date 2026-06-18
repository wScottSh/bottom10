'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import wordList from '../data/wordList';
import Sidebar from './Sidebar';
import GraduatedSidebar from './GraduatedSidebar';
import WpmParticles, { WpmParticlesHandle } from './WpmParticles';
import { generateWordSet, calculateNormalizedScore, computeWordTimingFromEvents, computeWpmParticle, KeystrokeEvent, updateGraduationCounter, WordStats } from '../utils/wordUtils';
import { loadWordStats, saveWordStats, loadWpmTarget, resetAppData } from '../utils/persistence';

function createInitialWordStats(): Record<string, WordStats> {
  return wordList.reduce((acc, word) => ({
    ...acc,
    [word]: { word, time: 0, attempts: 0, lastScore: 0 }
  }), {} as Record<string, WordStats>);
}

export default function TypingTest() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [globalWordStats, setGlobalWordStats] = useState(createInitialWordStats);

  const [isGraduatedSidebarOpen, setIsGraduatedSidebarOpen] = useState(true);
  const [words, setWords] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [correctWords, setCorrectWords] = useState<number>(0);
  const [testEnded, setTestEnded] = useState<boolean>(false);
  // Accumulates keystroke events for the current word; cleared on word advance.
  // Passed to computeWordTimingFromEvents which owns the first-char timing decision.
  const wordEventsRef = useRef<KeystrokeEvent[]>([]);
  const [typedWordsData, setTypedWordsData] = useState<
    { word: string; time: number; errors: number }[]
  >([]);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wordsContainerRef = useRef<HTMLDivElement>(null);
  const wordSpanRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const wpmParticlesRef = useRef<WpmParticlesHandle>(null);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [isWordErrored, setIsWordErrored] = useState(false);
  const [testStarted, setTestStarted] = useState(false);
  const [wordCount, setWordCount] = useState<number>(50);

  // Load a freshly generated word set and reset all per-test state.
  const startTestWithWords = useCallback((newWords: string[]) => {
    if (newWords.length === 0) return;
    setWords(newWords);
    setCurrentWordIndex(0);
    setCurrentCharIndex(0);
    setCorrectWords(0);
    setCurrentInput('');
    setTypedWordsData([]);
    setTestEnded(false);
    wordEventsRef.current = [];
    setTestStarted(false);
    setHasError(false);
    setIsWordErrored(false);
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

  useEffect(() => {
    const savedStats = loadWordStats();
    if (Object.keys(savedStats).length > 0) {
      setGlobalWordStats(savedStats);
    }
  }, []);

  // Records timing/error data for a completed word and spawns a WPM particle.
  // The word span's bounding rect is measured synchronously here — before the
  // re-render advances currentWordIndex — so the coordinates are stable.
  const recordCompletedWord = (currentWord: string, timestamp: number, wordIndex: number) => {
    wordEventsRef.current.push({ key: ' ', timestamp });
    const elapsed = computeWordTimingFromEvents(wordEventsRef.current);

    const wordSpan = wordSpanRefs.current[wordIndex];
    const container = wordsContainerRef.current;
    if (wordSpan && container && wpmParticlesRef.current) {
      const wordRect = wordSpan.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const x = wordRect.left - containerRect.left + wordRect.width / 2;
      const y = wordRect.top - containerRect.top;
      const { wpm, isFast } = computeWpmParticle(elapsed, currentWord.length, loadWpmTarget());
      wpmParticlesRef.current.spawn(x, y, wpm, isFast);
    }

    setTypedWordsData(prev => [
      ...prev,
      { word: currentWord, time: elapsed, errors: isWordErrored ? 1 : 0 }
    ]);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (testEnded) return;

    const value = e.target.value;
    const currentWord = words[currentWordIndex];
    const timestamp = Date.now();

    if (!currentWord) {
      finishTest();
      return;
    }

    if (value.endsWith(' ')) {
      if (value.trim() === currentWord) {
        recordCompletedWord(currentWord, timestamp, currentWordIndex);

        if (currentWordIndex + 1 === words.length) {
          finishTest();
        } else {
          setCorrectWords(correctWords + 1);
          setCurrentWordIndex(currentWordIndex + 1);
          setCurrentInput('');
          setCurrentCharIndex(0);
          wordEventsRef.current = []; // reset for next word; timer starts on its first char
          setHasError(false);
          setIsWordErrored(false);
        }
      }
      return;
    }

    if (!testStarted && value.length === 1) {
      setTestStarted(true);
    }

    // Accumulate event before error/backspace checks so the first-char timestamp
    // is captured even when that character is incorrect. The timing decision
    // (which event starts the clock) is delegated to computeWordTimingFromEvents.
    if (value.length > currentInput.length) {
      wordEventsRef.current.push({ key: value[value.length - 1], timestamp });
    } else if (value.length < currentInput.length) {
      wordEventsRef.current.push({ key: 'Backspace', timestamp });
    }

    if (value.length < currentInput.length) {
      setCurrentInput(value);
      setCurrentCharIndex(value.length);
      setHasError(false);
      if (value.length === 0) {
        setIsWordErrored(false);
      }
      return;
    }

    if (isWordErrored) return;

    const newChar = value[value.length - 1];
    const expectedChar = currentWord[currentInput.length];

    if (newChar !== expectedChar) {
      setHasError(true);
      const canRecoverByDeleting = currentInput.length > 0;
      if (canRecoverByDeleting) setIsWordErrored(true);
      return;
    }

    setCurrentInput(value);
    setCurrentCharIndex(value.length);

    const isLastWord = currentWordIndex + 1 === words.length;
    const wordComplete = value === currentWord;

    if (isLastWord && wordComplete) {
      recordCompletedWord(currentWord, timestamp, currentWordIndex);
      finishTest();
      return;
    }

    if (hasError && value === currentWord.slice(0, value.length)) {
      setHasError(false);
    }
  };

  const finishTest = () => {
    const wpmTarget = loadWpmTarget();
    const updatedStats = calculateNewStats(wpmTarget);
    const newWords = generateWordSet(wordCount, updatedStats, wordList);

    saveWordStats(updatedStats);
    setGlobalWordStats(updatedStats);
    startTestWithWords(newWords);
  };

  const calculateNewStats = (wpmTarget: number) => {
    const updatedStats = { ...globalWordStats };

    const wordGroups = typedWordsData.reduce((acc, { word, time }) => {
      if (!acc[word]) {
        acc[word] = { totalTime: 0, count: 0 };
      }
      acc[word].totalTime += time;
      acc[word].count += 1;
      return acc;
    }, {} as Record<string, { totalTime: number; count: number; }>);

    Object.entries(wordGroups).forEach(([word, { totalTime, count }]) => {
      const avgTime = totalTime / count;
      const normalizedScore = calculateNormalizedScore(avgTime, word.length);

      const withNewScore: WordStats = {
        ...updatedStats[word],
        time: avgTime,
        attempts: (updatedStats[word]?.attempts || 0) + 1,
        lastScore: normalizedScore,
      };
      updatedStats[word] = updateGraduationCounter(withNewScore, wpmTarget);
    });

    return updatedStats;
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

  const handleWpmChange = () => {
    startNewTest();
  };

  // Class for a word span: the current word turns red once it's errored,
  // already-typed words are marked completed, and upcoming words get nothing.
  const getWordClassName = (wordIndex: number) => {
    if (wordIndex === currentWordIndex) {
      return isWordErrored ? 'current error' : 'current';
    }
    return wordIndex < currentWordIndex ? 'completed' : '';
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
              {testStarted ? 'Typing...' : 'Type to start'}
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
                  if (wordIndex === currentWordIndex) {
                    if (!isWordErrored && charIndex < currentCharIndex) charClass = 'char-correct';
                    else if (charIndex === currentCharIndex && hasError) charClass = 'char-error';
                  }
                  return (
                    <span
                      key={charIndex}
                      className={`char relative pb-[0.3em] ${charClass}`}
                    >
                      {char}
                      {wordIndex === currentWordIndex &&
                      charIndex === currentCharIndex && (
                        <span className="absolute left-0 bottom-[0.15em] w-full h-[2px] bg-[#e2b714] transition-all duration-[50ms] ease-out" />
                      )}
                    </span>
                  );
                })}
                <span className="char relative pb-[0.3em]">
                  {'\u00A0'}
                  {wordIndex === currentWordIndex && 
                  word.length === currentCharIndex && (
                    <span className="absolute left-0 bottom-[0.15em] w-full h-[2px] bg-[#e2b714] transition-all duration-[50ms] ease-out" />
                  )}
                </span>{/* Remove whitespace here */}
              </span>
            ))}{/* Remove whitespace here */}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={currentInput}
            onChange={handleInput}
            className="opacity-0 absolute"
            autoFocus
          />
        </div>
      </div>
    </>
  );
}