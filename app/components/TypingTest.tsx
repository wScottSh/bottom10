'use client';

import React, { useState, useRef, useEffect } from 'react';
import wordList from '../data/wordList';
import Sidebar from './Sidebar';
import { WordStats, getTopWordsForTest, calculateGraduationThreshold } from '../utils/wordUtils';

interface WordData {
  totalTime: number;
  attempts: number;
  errors: number;
}

export default function TypingTest() {
  // Add interface for word performance data
  interface WordPerformance {
    word: string;
    time: number;
    normalizedScore: number;
    errors: number;
  }

  // Add new state for sidebar and global word stats
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);  // Changed to true
  const [globalWordStats, setGlobalWordStats] = useState(() => {
    // Initialize with empty stats for all words
    return wordList.reduce((acc, word) => ({
      ...acc,
      [word]: { word, time: 0, attempts: 0, lastScore: 0 }
    }), {});
  });

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
  const [isWordErrored, setIsWordErrored] = useState(false);  // Track if word has had an error
  const [testStarted, setTestStarted] = useState(false);
  const [wordCount, setWordCount] = useState<number>(50);

  useEffect(() => {
    startNewTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add new useEffect for keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (testEnded && e.key === 'Enter') {
        startNewTest();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [testEnded]); // Only re-add listener if testEnded changes

  useEffect(() => {
    // Load saved stats on mount
    const savedStats = localStorage.getItem('wordStats');
    if (savedStats) {
      setGlobalWordStats(JSON.parse(savedStats));
    }
  }, []);

  // Remove these functions as they're now in wordUtils:
  // - calculateGraduationThreshold
  // - getTopWordsForTest

  const generateWordSet = (count: number, wpmTarget: number) => {
    const selectedWords = getTopWordsForTest(globalWordStats, wpmTarget);
    if (selectedWords.length === 0) return shuffleArray(wordList.slice(0, count));
    
    const frequencies = generateFrequencyDistribution(count, selectedWords);
    const repeatedWords: string[] = [];
    
    Object.entries(frequencies).forEach(([word, freq]) => {
      for (let i = 0; i < freq; i++) {
        repeatedWords.push(word);
      }
    });
    
    return shuffleArray(repeatedWords);
  };

  const startNewTest = () => {
    const wpmTarget = parseInt(localStorage.getItem('wpmTarget') || '40');
    const newWords = generateWordSet(wordCount, wpmTarget);
    if (newWords.length > 0) {
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
    }
  };

  const generateFrequencyDistribution = (wordCount: number, bottomWords: string[]) => {
    // Ensure at least 25% of words are the worst performer
    const worstWordCount = Math.max(Math.floor(wordCount * 0.25), 1);
    const remainingCount = wordCount - worstWordCount;
    
    // Calculate decreasing frequencies for remaining words
    const frequencies: Record<string, number> = {};
    let remainingSlots = remainingCount;
    
    bottomWords.forEach((word, index) => {
      if (index === 0) {
        // Worst word gets 25%
        frequencies[word] = worstWordCount;
      } else if (index === bottomWords.length - 1) {
        // Last word gets minimum 2 occurrences
        frequencies[word] = 2;
      } else {
        // Calculate decreasing frequency for middle words
        const portion = Math.floor((remainingSlots - 2) * (bottomWords.length - index) / 
          (bottomWords.length * (bottomWords.length - 1) / 2));
        frequencies[word] = Math.max(portion, 2);
        remainingSlots -= portion;
      }
    });

    return frequencies;
  };

  const aggregateWordStats = () => {
    const stats: Record<string, { totalTime: number, totalChars: number, attempts: number, normalizedScore: number }> = {};
    
    typedWordsData.forEach(({ word, time }) => {
      if (!stats[word]) {
        stats[word] = { totalTime: 0, totalChars: 0, attempts: 0, normalizedScore: 0 };
      }
      stats[word].totalTime += time;
      stats[word].totalChars += word.length;
      stats[word].attempts += 1;
      stats[word].normalizedScore = stats[word].totalTime / stats[word].totalChars / stats[word].attempts;
    });

    return stats;
  };

  const shuffleArray = (array: string[]) => {
    return [...array].sort(() => Math.random() - 0.5);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (testEnded) return;
    
    const value = e.target.value;
    const currentWord = words[currentWordIndex];

    if (!currentWord) {
      finishTest();
      return;
    }

    // Handle word completion with space
    if (value.endsWith(' ')) {
      // Only process space if the word is complete and correct
      if (value.trim() === currentWord) {
        setTypedWordsData([
          ...typedWordsData,
          { 
            word: currentWord, 
            time: Date.now() - typedWordStartTime, 
            errors: isWordErrored ? 1 : 0 
          },
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

    // Start the timer on first keypress
    if (!testStarted && value.length === 1) {
      setTestStarted(true);
      setTypedWordStartTime(Date.now());
    }

    // Handle backspace
    if (value.length < currentInput.length) {
      setCurrentInput(value);
      // Always allow cursor to move when backspacing
      setCurrentCharIndex(value.length);
      // Reset error states if backspacing to empty
      if (value.length === 0) {
        setHasError(false);
        setIsWordErrored(false);
      }
      return;
    }

    // Handle new character input
    const newChar = value[value.length - 1];
    const expectedChar = currentWord[currentInput.length];

    if (newChar !== expectedChar) {
      // Error case: Update error states
      setHasError(true);
      setIsWordErrored(true);
      // Keep cursor at current position, but allow input to be stored
      // This enables backspacing while maintaining visual cursor position
      setCurrentInput(value.slice(0, currentCharIndex + 1));
      return;
    }

    // Correct character input
    setCurrentInput(value);
    setCurrentCharIndex(value.length);
    if (hasError && value === currentWord.slice(0, value.length)) {
      setHasError(false);
    }
  };

  const finishTest = () => {
    savePerformanceData();
    startNewTest();
  };

  const savePerformanceData = () => {
    const updatedStats = { ...globalWordStats };
    
    // Group repeated words and calculate averages
    const wordGroups = typedWordsData.reduce((acc, { word, time }) => {
      if (!acc[word]) {
        acc[word] = { totalTime: 0, count: 0 };
      }
      acc[word].totalTime += time;
      acc[word].count += 1;
      return acc;
    }, {} as Record<string, { totalTime: number; count: number; }>);

    // Update global stats with averaged scores
    Object.entries(wordGroups).forEach(([word, { totalTime, count }]) => {
      const avgTime = totalTime / count;
      const normalizedScore = avgTime / word.length;
      
      updatedStats[word] = {
        ...updatedStats[word],
        time: avgTime,
        attempts: (updatedStats[word]?.attempts || 0) + 1,
        lastScore: normalizedScore
      };
    });

    setGlobalWordStats(updatedStats);
    localStorage.setItem('wordStats', JSON.stringify(updatedStats));
  };

  const normalizeWordTime = (time: number, wordLength: number): number => {
    return time / wordLength; // Time per character
  };

  const prepareNextTest = () => {
    // No need to read from localStorage since we're using globalWordStats
    const bottomWords = getWorstNonGraduatedWords();
    setAllWords(bottomWords.length > 0 ? bottomWords : wordList);
    const newWords = generateWordSet(wordCount);
    setWords(newWords);
    setCurrentWordIndex(0);
    setCorrectWords(0);
    setCurrentInput('');
    setTypedWordsData([]);
    setTestEnded(false);
    setStartTime(Date.now());
    setTypedWordStartTime(Date.now());
    setTestStarted(false);
  };

  const getWordStats = (): WordPerformance[] => {
    return typedWordsData
      .map(({ word, time, errors }) => ({
        word,
        time,
        normalizedScore: normalizeWordTime(time, word.length),
        errors
      }))
      .sort((a, b) => b.normalizedScore - a.normalizedScore);
  };

  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };

  const handleWordCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const count = parseInt(e.target.value);
    setWordCount(Math.max(10, Math.min(count, 200))); // Limit between 10 and 200 words
  };

  // Move settings button to top-right
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
      <div className={`transition-all duration-300 ${isSidebarOpen ? 'ml-64' : ''}`}>
        <div className="flex flex-col items-center gap-4" onClick={() => inputRef.current?.focus()}>
          <div className="flex items-center justify-between w-full max-w-[800px]">
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
            className="relative text-2xl min-h-[120px] max-w-[800px] leading-relaxed"
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