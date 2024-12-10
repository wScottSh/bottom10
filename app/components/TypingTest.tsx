'use client';

import React, { useState, useRef, useEffect } from 'react';
import wordList from '../data/wordList';

export default function TypingTest() {
  const [allWords, setAllWords] = useState<string[]>(wordList);
  const [words, setWords] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [correctWords, setCorrectWords] = useState<number>(0);
  const [incorrectWords, setIncorrectWords] = useState<number>(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [testEnded, setTestEnded] = useState<boolean>(false);
  const [typedWordsData, setTypedWordsData] = useState<
    { word: string; time: number }[]
  >([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    startNewTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (timeLeft > 0 && startTime !== null) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && !testEnded) {
      endTest();
    }
  }, [timeLeft, testEnded, startTime]);

  const startNewTest = () => {
    const newWords = generateWordSet(50);
    setWords(newWords);
    setCurrentWordIndex(0);
    setCorrectWords(0);
    setIncorrectWords(0);
    setCurrentInput('');
    setTypedWordsData([]);
    setTimeLeft(60);
    setTestEnded(false);
    setStartTime(Date.now());
    inputRef.current?.focus();
  };

  const generateWordSet = (count: number) => {
    return shuffleArray(allWords).slice(0, count);
  };

  const shuffleArray = (array: string[]) => {
    return array.sort(() => Math.random() - 0.5);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (testEnded) return;
    const value = e.target.value;
    setCurrentInput(value);

    if (value.endsWith(' ')) {
      const typedWord = value.trim();
      const currentWord = words[currentWordIndex];
      const timeTaken = Date.now() - (startTime || Date.now());

      setTypedWordsData([
        ...typedWordsData,
        { word: currentWord, time: timeTaken },
      ]);

      if (typedWord === currentWord) {
        setCorrectWords(correctWords + 1);
      } else {
        setIncorrectWords(incorrectWords + 1);
      }

      setCurrentWordIndex(currentWordIndex + 1);
      setCurrentInput('');
      setStartTime(Date.now());
    }
  };

  const endTest = () => {
    setTestEnded(true);
    savePerformanceData();
    prepareNextTest();
  };

  const savePerformanceData = () => {
    const storedData = JSON.parse(
      localStorage.getItem('performanceData') || '{}'
    );

    typedWordsData.forEach(({ word, time }) => {
      if (storedData[word]) {
        storedData[word].totalTime += time;
        storedData[word].count += 1;
      } else {
        storedData[word] = { totalTime: time, count: 1 };
      }
    });

    localStorage.setItem('performanceData', JSON.stringify(storedData));
  };

  const prepareNextTest = () => {
    const storedData = JSON.parse(
      localStorage.getItem('performanceData') || '{}'
    );

    const wordAverages = Object.keys(storedData).map((word) => ({
      word,
      averageTime: storedData[word].totalTime / storedData[word].count,
    }));

    wordAverages.sort((a, b) => b.averageTime - a.averageTime);

    const bottomWords = wordAverages.slice(0, 10).map((item) => item.word);

    setAllWords(bottomWords.length > 0 ? bottomWords : wordList);
  };

  return (
    <div
      className="flex flex-col items-center gap-8"
      onClick={() => inputRef.current?.focus()}
    >
      {!testEnded ? (
        <>
          <div className="text-xl">Time Left: {timeLeft}s</div>
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
          <button
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
            onClick={startNewTest}
          >
            Start Next Test
          </button>
        </div>
      )}
    </div>
  );
}