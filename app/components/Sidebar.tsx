'use client';

import { useState, KeyboardEvent } from 'react';

interface WordStats {
  word: string;
  time: number;
  attempts: number;
  lastScore: number;
}

export default function Sidebar({ 
  isOpen, 
  wordStats, 
  toggleSidebar 
}: { 
  isOpen: boolean;
  wordStats: Record<string, WordStats>;
  toggleSidebar: () => void;
}) {
  const [wpmTarget, setWpmTarget] = useState<number>(40);
  const [isEditingWpm, setIsEditingWpm] = useState(false);
  const [tempWpm, setTempWpm] = useState('');

  const handleWpmSubmit = () => {
    const newWpm = parseInt(tempWpm);
    if (newWpm > 0) {
      setWpmTarget(newWpm);
    }
    setIsEditingWpm(false);
    setTempWpm('');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleWpmSubmit();
    }
  };

  const calculateMsPerChar = (wpm: number): number => {
    const totalTimeInMilliseconds = 60000;
    const avgCharsPerWord = 5;
    const totalCharsPerMinute = wpm * avgCharsPerWord;
    return totalTimeInMilliseconds / totalCharsPerMinute;
  };

  const isGraduated = (score: number) => {
    return score > 0 && score < calculateMsPerChar(wpmTarget);
  };

  const sortedWords = Object.entries(wordStats)
    .sort(([, a], [, b]) => {
      const aScore = a.lastScore;
      const bScore = b.lastScore;
      const aGraduated = isGraduated(aScore);
      const bGraduated = isGraduated(bScore);

      // First handle graduated vs non-graduated
      if (aGraduated !== bGraduated) return aGraduated ? 1 : -1;

      // Then handle unscored (they go between non-graduated and graduated)
      if (!aScore) return 1;
      if (!bScore) return -1;

      // Within each group, sort by score (higher = worse)
      return bScore - aScore;
    });

  return (
    <div className={`fixed left-0 top-0 h-full bg-[#2c2c2c] transition-all duration-300 ${
      isOpen ? 'w-64' : 'w-0'
    }`}>
      <button
        onClick={toggleSidebar}
        className="absolute -right-10 top-4 bg-[#2c2c2c] p-2 rounded-r"
      >
        {isOpen ? '←' : '→'}
      </button>
      
      <div className="h-full overflow-y-auto p-4">
        {/* WPM Target UI */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg text-[#e2e2e2]">Word List</h2>
          {isEditingWpm ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={tempWpm}
                onChange={(e) => setTempWpm(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-12 p-1 bg-transparent text-[#e2b714] border-b border-[#e2b714] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                autoFocus
              />
              <button 
                onClick={handleWpmSubmit}
                className="text-xs text-[#e2b714] hover:text-white px-1"
              >
                set
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingWpm(true)}
              className="text-sm text-[#e2b714] hover:text-white"
            >
              {wpmTarget} wpm
            </button>
          )}
        </div>

        <ul className="space-y-1">
          {sortedWords.map(([word, stats], index) => (
            <li key={`${word}-${index}`}>
              <div className="flex justify-between text-sm">
                <span className={isGraduated(stats.lastScore) ? 'text-green-500' : ''}>
                  {word}
                </span>
                {stats.lastScore > 0 && (
                  <span className={`${isGraduated(stats.lastScore) ? 'text-green-500' : 'text-[#e2b714]'}`}>
                    {Math.round(stats.lastScore)}
                  </span>
                )}
              </div>
              {index === 9 && <hr className="my-2 border-[#e2b714]" />}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}