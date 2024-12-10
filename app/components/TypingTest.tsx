'use client';

import React, { useState, useRef, useEffect } from 'react';
import wordList from '../data/wordList';

interface WordData {
  totalTime: number;
  attempts: number;
  errors: number;
}

export default function TypingTest() {
  const [allWords, setAllWords] = useState<string[]>(wordList);
  const [words, setWords] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [correctWords, setCorrectWords] = useState<number>(0);
  const [incorrectWords, setIncorrectWords] = useState<number>(0);
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

  useEffect(() => {
    startNewTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (timeLeft > 0 && !testEnded) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && !testEnded) {
      endTest();
    }
  }, [timeLeft, testEnded]);

  const startNewTest = () => {
    const newWords = generateWordSet(50);
    setWords(newWords);
    setCurrentWordIndex(0);
    setCorrectWords(0);
    setIncorrectWords(0);
    setCurrentInput('');
    setTypedWordsData([]);
    setTimeLeft(testDuration);
    setTestEnded(false);
    setStartTime(Date.now());
    setTypedWordStartTime(Date.now());
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
    setCurrentInput(value);

    if (value.endsWith(' ')) {
      const typedWord = value.trim();
      const currentWord = words[currentWordIndex];
      const timeTaken = Date.now() - typedWordStartTime;
      const errors = typedWord !== currentWord ? 1 : 0;

      setTypedWordsData([
        ...typedWordsData,
        { word: currentWord, time: timeTaken, errors },
      ]);

      if (typedWord === currentWord) {
        setCorrectWords(correctWords + 1);
      } else {
        setIncorrectWords(incorrectWords + 1);
      }

      setCurrentWordIndex(currentWordIndex + 1);
      setCurrentInput('');
      setTypedWordStartTime(Date.now());
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

  const prepareNextTest = () => {
    const storedData: Record<string, WordData> = JSON.parse(
      localStorage.getItem('performanceData') || '{}'
    );

    const wordAverages = Object.keys(storedData).map((word) => ({
      word,
      averageTime: storedData[word].totalTime / storedData[word].attempts,
      errorRate: (storedData[word].errors / storedData[word].attempts) * 100,
    }));

    wordAverages.sort((a, b) => b.averageTime - a.averageTime);

    const bottomWords = wordAverages.slice(0, 10).map((item) => item.word);

    setAllWords(bottomWords.length > 0 ? bottomWords : wordList);
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTestDuration(parseInt(e.target.value));
  };

  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };

  return (
    <div
      className="flex flex-col items-center gap-4"
      onClick={() => inputRef.current?.focus()}
    >
      {!testEnded ? (
        <>
          <div className="flex items-center justify-between w-full max-w-[800px]">
            <div className="text-xl">Time Left: {timeLeft}s</div>
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
          <div className="text-2xl min-h-[120px] max-w-[800px] leading-relaxed">
            {words.map((word, index) => (
              <span
                key={index}
                className={`word ${
                  index === currentWordIndex ? 'current' : ''
                } ${index < currentWordIndex ? 'completed' : ''}`}
              >
                {word}
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
          <p>Correct Words: {correctWords}</p>
          <p>Incorrect Words: {incorrectWords}</p>
          <div className="mt-4">
            <h3 className="text-xl mb-2">Your Performance:</h3>
            <ul>
              {typedWordsData.map(({ word, time, errors }, index) => (
                <li key={index}>
                  {word}: {time}ms, Errors: {errors}
                </li>
              ))}
            </ul>
          </div>
          <button
            className="mt-4"
            onClick={startNewTest}
          >
            Start Next Test
          </button>
        </div>
      )}
    </div>
  );
}