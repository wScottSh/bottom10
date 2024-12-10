'use client';

import React, { useState, useRef, useEffect } from 'react';
import wordList from '../data/wordList';

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

  const startNewTest = () => {
    // Prepare the word set based on current allWords
    const newWords = generateWordSet(wordCount);
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

  const generateWordSet = (count: number) => {
    // For first test, use random selection from full word list
    if (!typedWordsData.length) {
      return shuffleArray(wordList).slice(0, count);
    }

    // For subsequent tests, use frequency-based repetition of bottom words
    const bottomWords = getBottomWords();
    if (!bottomWords.length) return shuffleArray(wordList).slice(0, count);

    const frequencies = generateFrequencyDistribution(count, bottomWords);
    const repeatedWords: string[] = [];
    
    Object.entries(frequencies).forEach(([word, freq]) => {
      for (let i = 0; i < freq; i++) {
        repeatedWords.push(word);
      }
    });

    return shuffleArray(repeatedWords);
  };

  const getBottomWords = () => {
    const wordStats = Object.entries(aggregateWordStats()).sort(
      ([, a], [, b]) => b.normalizedScore - a.normalizedScore
    );
    return wordStats.slice(0, 10).map(([word]) => word);
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
      endTest();
      return;
    }

    // Start the timer on first keypress
    if (!testStarted && value.length === 1) {
      setTestStarted(true);
      setTypedWordStartTime(Date.now());
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
        
        setCorrectWords(correctWords + 1);
        setCurrentWordIndex(currentWordIndex + 1);
        setCurrentInput('');
        setCurrentCharIndex(0);
        setTypedWordStartTime(Date.now());
        setHasError(false);
        setIsWordErrored(false);

        if (currentWordIndex + 1 === words.length) {
          endTest();
        }
      }
      return;
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

  const endTest = () => {
    setTestEnded(true);
    savePerformanceData();
    // Remove the automatic call to prepareNextTest
    // Let the user explicitly start the next test
  };

  const savePerformanceData = () => {
    const storedData: Record<string, WordData> = JSON.parse(
      localStorage.getItem('performanceData') || '{}'
    );

    const currentStats = aggregateWordStats();
    Object.entries(currentStats).forEach(([word, stats]) => {
      if (storedData[word]) {
        storedData[word].totalTime += stats.totalTime;
        storedData[word].attempts += stats.attempts;
      } else {
        storedData[word] = {
          totalTime: stats.totalTime,
          attempts: stats.attempts,
          errors: 0 // Keep track of errors separately
        };
      }
    });

    localStorage.setItem('performanceData', JSON.stringify(storedData));
  };

  const normalizeWordTime = (time: number, wordLength: number): number => {
    return time / wordLength; // Time per character
  };

  const prepareNextTest = () => {
    const storedData: Record<string, WordData> = JSON.parse(
      localStorage.getItem('performanceData') || '{}'
    );

    if (Object.keys(storedData).length === 0) {
      setAllWords(wordList);
      startNewTest();
      return;
    }

    const wordAverages = Object.keys(storedData).map((word) => ({
      word,
      // Calculate average time per character
      averageTime: normalizeWordTime(
        storedData[word].totalTime / storedData[word].attempts,
        word.length
      ),
      errorRate: (storedData[word].errors / storedData[word].attempts) * 100,
    }));

    wordAverages.sort((a, b) => b.averageTime - a.averageTime);
    const bottomWords = wordAverages.slice(0, 10).map((item) => item.word);
    
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

  return (
    <div className="flex flex-col items-center gap-4" onClick={() => inputRef.current?.focus()}>
      {!testEnded ? (
        <>
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
        </>
      ) : (
        <div className="text-center">
          <h2 className="text-2xl mb-4">Test Completed!</h2>
          <div className="mt-4">
            <h3 className="text-xl mb-2">Your Performance:</h3>
            <ul className="space-y-1">
              {getWordStats().map(({ word, time, normalizedScore, errors }, index) => (
                <li key={index} className="font-mono">
                  {word}: {Math.round(normalizedScore)} (raw: {Math.round(time)}ms)
                  {errors > 0 ? ' (with errors)' : ''}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col items-center gap-1">
            <button
              className="mt-4"
              onClick={startNewTest}
            >
              Start Next Test
            </button>
            <span className="text-sm text-gray-400">[press enter]</span>
          </div>
        </div>
      )}
    </div>
  );
}