'use client';

import React, { useState, useRef } from 'react';

export default function TypingTest() {
  const [words, setWords] = useState(['hello', 'world', 'test', 'typing']);
  const [currentInput, setCurrentInput] = useState('');
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCurrentInput(value);

    if (value.endsWith(' ')) {
      if (value.trim() === words[currentWordIndex]) {
        setCurrentWordIndex(prev => prev + 1);
        setCurrentInput('');
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-8" onClick={() => inputRef.current?.focus()}>
      <div className="text-2xl min-h-[120px] max-w-[800px] leading-relaxed">
        {words.map((word, i) => (
          <span 
            key={i} 
            className={`word ${i === currentWordIndex ? 'current' : ''} 
                             ${i < currentWordIndex ? 'completed' : ''}`}
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
    </div>
  );
}