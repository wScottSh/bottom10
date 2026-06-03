'use client';

import React, { useState, useRef, useEffect } from 'react';
import wordList from '../data/wordList';
import Sidebar from './Sidebar';
import GraduatedSidebar from './GraduatedSidebar';
import { generateWordSet, calculateNormalizedScore } from '../utils/wordUtils';
import { loadWordStats, saveWordStats, loadWpmTarget } from '../utils/persistence';

export default function TypingTest() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [globalWordStats, setGlobalWordStats] = useState(() => {
    return wordList.reduce((acc, word) => ({
      ...acc,
      [word]: { word, time: 0, attempts: 0, lastScore: 0 }
    }), {});
  });

  const [isGraduatedSidebarOpen, setIsGraduatedSidebarOpen] = useState(true);
  const [allWords, setAllWords] = useState<string[]>(wordList);
  const [words, setWords] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [correctWords, setCorrectWords] = useState<number>(0);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [testEnded, setTestEnded] = useState<boolean>(false);
  const [typedWordStartTime, setTypedWordStartTime] = useState<number>(Date.now());
  const [typedWordsData, setTypedWordsData] = useState<
    { word: string; time: number; errors: number }[]
  >([]);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wordsContainerRef = useRef<HTMLDivElement>(null);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [isWordErrored, setIsWordErrored] = useState(false);
  const [testStarted, setTestStarted] = useState(false);
  const [wordCount, setWordCount] = useState<number>(50);

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
  }, [testEnded]);

  useEffect(() => {
    const savedStats = loadWordStats();
    if (Object.keys(savedStats).length > 0) {
      setGlobalWordStats(savedStats);
    }
  }, []);


  // Load a freshly generated word set and reset all per-test state.
  const startTestWithWords = (newWords: string[]) => {
    if (newWords.length === 0) return;
    setWords(newWords);
    setCurrentWordIndex(0);
    setCorrectWords(0);
    setCurrentInput('');
    setTypedWordsData([]);
    setTestEnded(false);
    setStartTime(Date.now());
    setTypedWordStartTime(Date.now());
    setTestStarted(false);
    setHasError(false);
    setIsWordErrored(false);
    inputRef.current?.focus();
  };

  const startNewTest = () => {
    const wpmTarget = loadWpmTarget();
    startTestWithWords(generateWordSet(wordCount, wpmTarget, globalWordStats, allWords));
  };


  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (testEnded) return;
    
    const value = e.target.value;
    const currentWord = words[currentWordIndex];

    if (!currentWord) {
      finishTest();
      return;
    }

    if (value.endsWith(' ')) {
      if (value.trim() === currentWord) {
        setTypedWordsData(prev => [
          ...prev,
          { 
            word: currentWord, 
            time: Date.now() - typedWordStartTime, 
            errors: isWordErrored ? 1 : 0 
          }
        ]);
        
        if (currentWordIndex + 1 === words.length) {
          finishTest();
        } else {
          setCorrectWords(correctWords + 1);
          setCurrentWordIndex(currentWordIndex + 1);
          setCurrentInput('');
          setCurrentCharIndex(0);
          setTypedWordStartTime(Date.now());
          setHasError(false);
          setIsWordErrored(false);
        }
      }
      return;
    }

    if (!testStarted && value.length === 1) {
      setTestStarted(true);
      setTypedWordStartTime(Date.now());
    }

    if (value.length < currentInput.length) {
      setCurrentInput(value);
      setCurrentCharIndex(value.length);
      if (value.length === 0) {
        setHasError(false);
        setIsWordErrored(false);
      }
      return;
    }

    const newChar = value[value.length - 1];
    const expectedChar = currentWord[currentInput.length];

    if (newChar !== expectedChar) {
      setHasError(true);
      setIsWordErrored(true);
      setCurrentInput(value.slice(0, currentCharIndex + 1));
      return;
    }

    setCurrentInput(value);
    setCurrentCharIndex(value.length);
    if (hasError && value === currentWord.slice(0, value.length)) {
      setHasError(false);
    }
  };

  const finishTest = () => {
    const updatedStats = calculateNewStats();
    const wpmTarget = loadWpmTarget();
    const newWords = generateWordSet(wordCount, wpmTarget, updatedStats, allWords);

    saveWordStats(updatedStats);
    setGlobalWordStats(updatedStats);
    startTestWithWords(newWords);
  };

  const calculateNewStats = () => {
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
      
      updatedStats[word] = {
        ...updatedStats[word],
        time: avgTime,
        attempts: (updatedStats[word]?.attempts || 0) + 1,
        lastScore: normalizedScore
      };
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

  const handleWpmChange = (newWpm: number) => {
    startNewTest();
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
        wpmTarget={loadWpmTarget()}
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
            </div>
          )}
          <div 
            ref={wordsContainerRef}
            className="w-full px-8 relative text-2xl min-h-[120px] leading-relaxed"
          >
            {words.map((word, wordIndex) => (
              <span
                key={wordIndex}
                className={`word ${
                  wordIndex === currentWordIndex 
                    ? isWordErrored ? 'error' : 'current' 
                    : wordIndex < currentWordIndex ? 'completed' : ''
                }`}
              >
                {word.split('').map((char, charIndex) => (
                  <span 
                    key={charIndex} 
                    className="char relative pb-[0.3em]"
                  >
                    {char}
                    {wordIndex === currentWordIndex && 
                    charIndex === currentCharIndex && (
                      <span className="absolute left-0 bottom-[0.15em] w-full h-[2px] bg-[#e2b714] transition-all duration-[50ms] ease-out" />
                    )}
                  </span>
                ))}
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