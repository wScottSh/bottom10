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
  const [timeLeft, setTimeLeft] = useState<number>(60); // default to 60 seconds
  const [testEnded, setTestEnded] = useState<boolean>(false);
  const [typedWordStartTime, setTypedWordStartTime] = useState<number>(Date.now());
  const [typedWordsData, setTypedWordsData] = useState<
    { word: string; time: number; errors: number }[]
  >([]);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [testDuration, setTestDuration] = useState<number>(60);
  const inputRef = useRef<HTMLInputElement>(null);
  const wordsContainerRef = useRef<HTMLDivElement>(null);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [isWordErrored, setIsWordErrored] = useState(false);  // Track if word has had an error
  const [testStarted, setTestStarted] = useState(false);

  useEffect(() => {
    startNewTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (timeLeft > 0 && testStarted && !testEnded) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && !testEnded) {
      endTest();
    }
  }, [timeLeft, testEnded, testStarted]);

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
    const newWords = generateWordSet(50);
    setWords(newWords);
    setCurrentWordIndex(0);
    setCorrectWords(0);
    setCurrentInput('');
    setTypedWordsData([]);
    setTimeLeft(testDuration);
    setTestEnded(false);
    setStartTime(Date.now());
    setTypedWordStartTime(Date.now());
    setTestStarted(false);
    inputRef.current?.focus();
  };

  const generateWordSet = (count: number) => {
    return shuffleArray(allWords).slice(0, count);
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

    // Only allow typing if:
    // 1. No error, or
    // 2. Backspacing (value length decreasing), or
    // 3. Previously errored but now starting fresh
    if (hasError && value.length >= currentInput.length && value.length !== 0) {
      return;
    }

    setCurrentInput(value);
    setCurrentCharIndex(value.length);

    // Reset error state if we've backspaced to the start
    if (value.length === 0) {
      setHasError(false);
      setIsWordErrored(false);
    }
    // Check for errors in current word
    else if (!currentWord.startsWith(value)) {
      setHasError(true);
      setIsWordErrored(true);
    }

    if (value.endsWith(' ')) {
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
      }
    }
  };

  const endTest = () => {
    setTestEnded(true);
    savePerformanceData();
    prepareNextTest();
  };

  const savePerformanceData = () => {
    const storedData: Record<string, WordData> = JSON.parse(
      localStorage.getItem('performanceData') || '{}'
    );

    typedWordsData.forEach(({ word, time, errors }) => {
      if (storedData[word]) {
        storedData[word].totalTime += time;
        storedData[word].attempts += 1;
        storedData[word].errors += errors;
      } else {
        storedData[word] = { totalTime: time, attempts: 1, errors };
      }
    });

    localStorage.setItem('performanceData', JSON.stringify(storedData));
  };

  const normalizeWordTime = (time: number, attempts: number): number => {
    // Simple exponential moving average with more weight on recent attempts
    const alpha = 0.8; // Weight for most recent attempts
    return time * (1 - Math.pow(1 - alpha, attempts));
  };

  const prepareNextTest = () => {
    const storedData: Record<string, WordData> = JSON.parse(
      localStorage.getItem('performanceData') || '{}'
    );

    const wordAverages = Object.keys(storedData).map((word) => ({
      word,
      // Use raw timing data with attempt weighting
      averageTime: normalizeWordTime(
        storedData[word].totalTime / storedData[word].attempts,
        storedData[word].attempts
      ),
      errorRate: (storedData[word].errors / storedData[word].attempts) * 100,
    }));

    wordAverages.sort((a, b) => b.averageTime - a.averageTime);

    const bottomWords = wordAverages.slice(0, 10).map((item) => item.word);

    setAllWords(bottomWords.length > 0 ? bottomWords : wordList);
  };

  const getWordStats = (): WordPerformance[] => {
    return typedWordsData
      .map(({ word, time, errors }) => ({
        word,
        time,
        normalizedScore: normalizeWordTime(time, 1), // Single attempt for current test
        errors
      }))
      .sort((a, b) => b.normalizedScore - a.normalizedScore); // Sort from slowest to fastest
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTestDuration(parseInt(e.target.value));
  };

  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };

  return (
    <div className="flex flex-col items-center gap-4" onClick={() => inputRef.current?.focus()}>
      {!testEnded ? (
        <>
          <div className="flex items-center justify-between w-full max-w-[800px]">
            <div className="text-xl">
              {testStarted ? `Time Left: ${timeLeft}s` : 'Type to start'}
            </div>
            <button onClick={toggleSettings}>
              {showSettings ? 'Hide Settings' : 'Show Settings'}
            </button>
          </div>
          {showSettings && (
            <div className="mb-4">
              <label>
                Test Duration (seconds):
                <input
                  type="number"
                  value={testDuration}
                  onChange={handleDurationChange}
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
                    className="char relative pb-[0.3em]"  // Added padding-bottom
                  >
                    {char}
                    {wordIndex === currentWordIndex && 
                     charIndex === currentCharIndex && (
                      <span className="absolute left-0 bottom-[0.15em] w-full h-[2px] bg-[#e2b714] transition-all duration-[50ms] ease-out" />
                    )}
                  </span>
                ))}
                {' '}
              </span>
            ))}
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
          <p>Words Completed: {correctWords}</p>
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